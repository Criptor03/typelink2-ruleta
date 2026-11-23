import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type CardWallPayload = {
  actor_name?: string;
  target_name?: string | null;
  card_name?: string;
  rarity?: string;
  image_path?: string | null;
  custom_message?: string | null;
  action_label?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function clean(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const channelId = Deno.env.get("DISCORD_CHANNEL_ID");
  if (!botToken || !channelId) {
    return new Response(JSON.stringify({ error: "Discord no está configurado. Faltan DISCORD_BOT_TOKEN o DISCORD_CHANNEL_ID." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: CardWallPayload;
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const actorName = clean(payload.actor_name, 80) || "Entrenador";
  const targetName = clean(payload.target_name, 80);
  const cardName = clean(payload.card_name, 100) || "Carta TypeLink";
  const rarity = clean(payload.rarity, 40) || "CARTA TYPELINK";
  const customMessage = clean(payload.custom_message, 500);
  const actionLabel = clean(payload.action_label, 80) || (targetName ? "CARTA LANZADA" : "CARTA UTILIZADA");
  const imagePath = clean(payload.image_path, 1000);

  const messageLine = customMessage ? "> " + customMessage.replaceAll("\n", "\n> ") : "Carta registrada en TypeLink 2.";
  const description = targetName
    ? "**" + actorName + "** ha utilizado **" + cardName + "** sobre **" + targetName + "**.\n\n" + messageLine
    : "**" + actorName + "** ha utilizado **" + cardName + "**.\n\n" + messageLine;

  const embed: Record<string, unknown> = {
    title: "🃏 Muro de cartas",
    description,
    fields: [
      { name: "CARTA", value: cardName, inline: true },
      { name: "RAREZA", value: rarity, inline: true },
      { name: "ACCIÓN", value: actionLabel, inline: true },
    ],
    footer: { text: "Pokémon TypeLink 2 · Registro de cartas" },
    timestamp: new Date().toISOString(),
  };
  if (imagePath) embed.image = { url: imagePath };

  const discordResponse = await fetch("https://discord.com/api/v10/channels/" + encodeURIComponent(channelId) + "/messages", {
    method: "POST",
    headers: { Authorization: "Bot " + botToken, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
  });

  if (!discordResponse.ok) {
    const detail = await discordResponse.text();
    console.error("Discord API error:", discordResponse.status, detail);
    return new Response(JSON.stringify({ error: "Discord rechazó el mensaje.", status: discordResponse.status }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const discordMessage = await discordResponse.json();
  return new Response(JSON.stringify({ success: true, message_id: discordMessage.id }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});