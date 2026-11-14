create or replace function app_private.play_card_with_message_core(
  p_card_instance_id uuid,
  p_target_id uuid,
  p_custom_message text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_message text := nullif(pg_catalog.btrim(p_custom_message), '');
  v_result jsonb;
  v_status text;
  v_remaining integer;
  v_updated_count integer := 0;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión con Discord para jugar una carta.'
      using errcode = '28000';
  end if;

  if v_message is not null and pg_catalog.char_length(v_message) > 280 then
    raise exception 'El mensaje del muro no puede superar los 280 caracteres.'
      using errcode = '22023';
  end if;

  v_result := app_private.play_card_core(p_card_instance_id, p_target_id);

  if v_message is not null then
    if v_result ->> 'action' <> 'play' then
      raise exception 'Solo puedes añadir un mensaje al utilizar una carta, no al transferirla.'
        using errcode = '22023';
    end if;

    update public.card_activity ca
      set details = coalesce(ca.details, '{}'::jsonb)
        || pg_catalog.jsonb_build_object('custom_message', v_message)
    where ca.actor_id = v_user
      and ca.card_instance_id = p_card_instance_id
      and ca.activity_type in ('play', 'roulette_unlock')
      and ca.created_at = pg_catalog.transaction_timestamp();

    get diagnostics v_updated_count = row_count;

    if v_updated_count = 0 then
      raise exception 'No se pudo asociar el mensaje con el movimiento de la carta.'
        using errcode = 'P0001';
    end if;
  end if;

  select pc.status, pc.remaining_uses
    into v_status, v_remaining
  from public.player_cards pc
  where pc.id = (v_result ->> 'card_instance_id')::uuid;

  return v_result || pg_catalog.jsonb_build_object(
    'status', v_status,
    'remaining_uses', v_remaining
  );
end;
$function$;

revoke all on function app_private.play_card_with_message_core(uuid, uuid, text) from public, anon;
grant execute on function app_private.play_card_with_message_core(uuid, uuid, text) to authenticated;

create or replace function public.play_card_with_message(
  p_card_instance_id uuid,
  p_target_id uuid,
  p_custom_message text
)
returns jsonb
language sql
set search_path to ''
as $function$
  select app_private.play_card_with_message_core(
    p_card_instance_id,
    p_target_id,
    p_custom_message
  );
$function$;

revoke all on function public.play_card_with_message(uuid, uuid, text) from public, anon;
grant execute on function public.play_card_with_message(uuid, uuid, text) to authenticated;
