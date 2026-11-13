/* Pokémon TypeLink 2 — persistent player identity and inventory */
const CARDS = [
  {id:"katateka",slug:"katateka",name:"Katateka",rarity:"Común",color:"#8d9a9f",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/katateka.svg",image_path:"assets/katateka.svg"},
  {id:"cambio-tipo",slug:"cambio-tipo",name:"Cambio de Tipo",rarity:"Común",color:"#6b9b83",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/cambio-tipo.svg",image_path:"assets/cambio-tipo.svg"},
  {id:"proteccion",slug:"proteccion",name:"Protección",rarity:"Rara",color:"#6f8dbb",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/proteccion.svg",image_path:"assets/proteccion.svg"},
  {id:"intercambio",slug:"intercambio",name:"Intercambio",rarity:"Rara",color:"#9a79b7",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/intercambio.svg",image_path:"assets/intercambio.svg"},
  {id:"impacto",slug:"impacto",name:"Impacto Épico",rarity:"Épica",color:"#bd7a4e",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/impacto.svg",image_path:"assets/impacto.svg"},
  {id:"destino",slug:"destino",name:"Destino Legendario",rarity:"Legendaria",color:"#d4ae5b",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/destino.svg",image_path:"assets/destino.svg"}
];

const POKEMON_TYPES = [
  {slug:"normal",name:"Normal",color:"#A8A77A"},
  {slug:"fuego",name:"Fuego",color:"#EE8130"},
  {slug:"agua",name:"Agua",color:"#6390F0"},
  {slug:"electrico",name:"Eléctrico",color:"#F7D02C"},
  {slug:"planta",name:"Planta",color:"#7AC74C"},
  {slug:"hielo",name:"Hielo",color:"#96D9D6"},
  {slug:"lucha",name:"Lucha",color:"#C22E28"},
  {slug:"veneno",name:"Veneno",color:"#A33EA1"},
  {slug:"tierra",name:"Tierra",color:"#E2BF65"},
  {slug:"volador",name:"Volador",color:"#A98FF3"},
  {slug:"psiquico",name:"Psíquico",color:"#F95587"},
  {slug:"bicho",name:"Bicho",color:"#A6B91A"},
  {slug:"roca",name:"Roca",color:"#B6A136"},
  {slug:"fantasma",name:"Fantasma",color:"#735797"},
  {slug:"dragon",name:"Dragón",color:"#6F35FC"},
  {slug:"siniestro",name:"Siniestro",color:"#705746"},
  {slug:"acero",name:"Acero",color:"#B7B7CE"},
  {slug:"hada",name:"Hada",color:"#D685AD"}
];

const STORAGE_KEY = "typelink2-beta01-deck";
const ROUTE_STORAGE_KEY = "typelink2-beta01-route";
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinButton = document.getElementById("spinButton");
const deckList = document.getElementById("deckList");
const toast = document.getElementById("toast");
const TAU = Math.PI * 2;

let authClient = null;
let currentAuthUser = null;
let currentProfile = null;
let activeSessionUserId = null;
let inventoryChannel = null;
let profilesChannel = null;
let activityChannel = null;
let currentTramo = 0;
let tramoSpinsRemaining = 0;
let bonusTramoSpinsRemaining = 0;
let cloudMode = false;
let cloudDeck = [];
let cloudRoute = [];
let cloudSpecial = [];
let cloudInventory = [];
let evolutionRulesBySource = Object.create(null);
let cardEffectsById = Object.create(null);
let pendingCardAction = null;
let demoDeck = loadDeck();
let demoRouteState = loadRouteState();
let rotation = 0;
let spinning = false;
let normalCardLimit = 5;
let playerTypeStatus = Object.create(null);
let incomingCardEffects = [];
const pendingTypeUpdates = new Set();
const cardArtImages = {};

CARDS.forEach(card=>{
  const image=new Image();
  image.src=card.art;
  image.onload=()=>drawWheel();
  cardArtImages[card.id]=image;
});

function setText(id,value){
  const el=document.getElementById(id);
  if(el)el.textContent=value==null?"":String(value);
}
function loadDeck(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
    return Array.isArray(saved)?saved.filter(id=>CARDS.some(card=>card.id===id)):[];
  }catch{return []}
}
function saveDeck(){localStorage.setItem(STORAGE_KEY,JSON.stringify(demoDeck));}
function loadRouteState(){
  try{
    const saved=JSON.parse(localStorage.getItem(ROUTE_STORAGE_KEY)||'{"tramo":0,"cards":[]}');
    if(!saved||!Array.isArray(saved.cards))return {tramo:0,cards:[]};
    return {tramo:Number(saved.tramo)||0,cards:saved.cards};
  }catch{return {tramo:0,cards:[]}}
}
function saveRouteState(){localStorage.setItem(ROUTE_STORAGE_KEY,JSON.stringify(demoRouteState));}
function activeNormalCards(){
  return cloudMode?cloudDeck:demoDeck.map(id=>CARDS.find(card=>card.id===id)).filter(Boolean);
}
function activeTramoCards(){
  return cloudMode?cloudRoute:demoRouteState.cards;
}
function cardImage(card){
  return card.image_path||card.art||(card.slug?"assets/"+card.slug+".svg":"");
}
function applyAvatar(element,url,fallback){
  if(!element)return;
  element.textContent=fallback||"TL";
  element.style.backgroundImage="";
  if(url){
    try{
      const parsedUrl=new URL(String(url));
      if(parsedUrl.protocol==="https:"){
        element.style.backgroundImage='url("'+parsedUrl.href+'")';
        element.style.backgroundSize="cover";
        element.style.backgroundPosition="center";
        element.textContent="";
      }
    }catch(error){
      console.warn("Se omitió una URL de avatar no válida.");
    }
  }
}
function formatDate(dateValue){
  if(!dateValue)return "—";
  const date=new Date(dateValue);
  if(Number.isNaN(date.getTime()))return "—";
  return new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",year:"numeric"}).format(date);
}

function drawWheel(){
  const size=canvas.width,center=size/2,radius=size/2-10,slice=TAU/CARDS.length;
  ctx.clearRect(0,0,size,size);
  CARDS.forEach((card,i)=>{
    const start=rotation-Math.PI/2+i*slice,end=start+slice;
    ctx.beginPath();ctx.moveTo(center,center);ctx.arc(center,center,radius,start,end);ctx.closePath();
    ctx.fillStyle=i%2===0?"#e5e9ec":"#283541";ctx.fill();
    ctx.strokeStyle="#8f9aa3";ctx.lineWidth=3;ctx.stroke();
    const mid=start+slice/2,x=center+Math.cos(mid)*radius*.65,y=center+Math.sin(mid)*radius*.65;
    ctx.save();ctx.translate(x,y);
    const image=cardArtImages[card.id];
    if(image&&image.complete&&image.naturalWidth){
      ctx.shadowColor="#000";ctx.shadowBlur=9;ctx.drawImage(image,-34,-46,68,92);ctx.shadowBlur=0;
      ctx.strokeStyle="#f1f4f6";ctx.lineWidth=2;ctx.strokeRect(-34,-46,68,92);
    }else{
      ctx.fillStyle=card.color;ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(card.name.length>13?card.name.slice(0,12)+"…":card.name,0,0);
    }
    ctx.restore();
  });
  ctx.beginPath();ctx.arc(center,center,42,0,TAU);ctx.fillStyle="#111820";ctx.fill();ctx.strokeStyle="#f3f5f6";ctx.lineWidth=5;ctx.stroke();
}

function createDeckItem(card,index,route=false,allowActions=false){
  const row=document.createElement("div");row.className="deck-item";
  const img=document.createElement("img");img.className="deck-thumb";img.src=cardImage(card);img.alt=card.name||"Carta";
  const info=document.createElement("div");info.className="deck-info";
  const name=document.createElement("strong");name.textContent=card.name||"Carta TypeLink";
  const small=document.createElement("small");
  const uses=Number(card.remaining_uses??1),maxUses=Number(card.uses_per_card??1);
  small.textContent=(route?("Tramo "+(card.tramo_number||"?")+" · "):"")+(card.rarity||"Carta normal")+" · USOS "+uses+"/"+maxUses;
  info.append(name,small);
  const number=document.createElement("span");number.className="deck-index";number.textContent=String(index+1).padStart(2,"0");
  row.append(img,info,number);

  if(allowActions&&card.status==="available"&&cloudMode){
    const actions=document.createElement("div");actions.className="deck-actions";
    const actionButton=document.createElement("button");actionButton.type="button";
    if(card.disposition==="transfer"){
      actionButton.className="deck-action-button transfer";actionButton.textContent="TRANSFERIR";
      actionButton.addEventListener("click",()=>openCardAction(card.instance_id,"transfer"));
    }else{
      const hasEffects=Boolean(cardEffectsById[card.card_id]?.length);
      actionButton.className="deck-action-button use";
      actionButton.textContent=hasEffects?"USAR":"PENDIENTE";
      actionButton.disabled=!hasEffects;
      actionButton.title=hasEffects?"Usar esta carta":"Esta carta todavía no tiene un efecto configurado";
      actionButton.addEventListener("click",()=>openCardAction(card.instance_id,"use"));
    }
    actions.append(actionButton);
    const evolution=evolutionRulesBySource[card.card_id];
    if(evolution){
      const evolveButton=document.createElement("button");evolveButton.type="button";
      evolveButton.className="deck-action-button evolve";evolveButton.textContent="EVOLUCIONAR";
      evolveButton.addEventListener("click",()=>openCardAction(card.instance_id,"evolve"));
      actions.append(evolveButton);
    }
    row.append(actions);
  }
  return row;
}
function renderCardItems(cards,container,emptyText,allowActions=false){
  if(!container)return;
  container.replaceChildren();
  if(!cards.length){
    const empty=document.createElement("div");empty.className="deck-empty";empty.textContent=emptyText||"Todavía no tienes cartas.";container.append(empty);return;
  }
  cards.forEach((card,index)=>container.append(createDeckItem(card,index,false,allowActions)));
}
function renderRouteItems(cards,container,allowActions=false){
  if(!container)return;
  container.replaceChildren();
  if(!cards.length){
    const empty=document.createElement("div");empty.className="deck-empty";empty.textContent="Todavía no has iniciado un tramo.";container.append(empty);return;
  }
  cards.forEach((card,index)=>container.append(createDeckItem(card,index,true,allowActions)));
}
function renderDeck(){
  const normal=activeNormalCards(),route=activeTramoCards(),special=cloudMode?cloudSpecial:[],normalCount=normal.length;
  renderCardItems(normal,document.getElementById("deckList"),"Todavía no tienes cartas. ¡Haz tu primer giro!");
  renderCardItems(normal,document.getElementById("deckListFull"),"Todavía no tienes cartas. Ve a la ruleta para conseguir la primera.",true);
  renderRouteItems(route,document.getElementById("routeListFull"),true);
  renderCardItems(special,document.getElementById("specialListFull"),"Todavía no tienes cartas Fiesta u otras cartas especiales.",true);

  setText("deckCount",normalCount+"/"+normalCardLimit);
  setText("deckCountFull",normalCount+" / "+normalCardLimit);
  setText("routeCountFull",route.length);
  setText("specialCountFull",special.length);
  setText("navDeckCount",normalCount+"/"+normalCardLimit);
  setText("homeDeckCount",normalCount+"/"+normalCardLimit);
  setText("homeRouteCount",route.length);

  const width=(normalCardLimit>0?Math.min(normalCount,normalCardLimit)/normalCardLimit*100:0)+"%";
  ["capacityFill","capacityFillFull","homeCapacityFill"].forEach(id=>{
    const el=document.getElementById(id);if(el)el.style.width=width;
  });
  setText("homeDeckHint",normalCount?("Tienes "+normalCount+" de "+normalCardLimit+" cartas normales disponibles."):"Tu baraja todavía está vacía. Haz tu primer giro.");
  setText("profileNormalCount",normalCount+"/"+normalCardLimit);
  setText("profileRouteCount",route.length);

  const resetButton=document.getElementById("resetButton");
  if(resetButton)resetButton.hidden=cloudMode;

  const totalSpins=Math.max(0,tramoSpinsRemaining)+Math.max(0,bonusTramoSpinsRemaining);
  const freeSlots=Math.max(0,normalCardLimit-normalCount);
  const pendingSpins=totalSpins>0;
  spinButton.disabled=spinning||!currentAuthUser||pendingSpins===false||normalCount>=normalCardLimit;
  spinButton.querySelector("span").textContent=
    !currentAuthUser?"INICIA SESIÓN":
    spinning?"CONECTANDO...":
    normalCount>=normalCardLimit?"BARAJA COMPLETA":
    totalSpins<=0?"SIN GIROS DISPONIBLES":"GIRAR RULETA";
  setText("spinHint",!currentAuthUser
    ?"Inicia sesión con Discord para obtener cartas."
    :normalCount>=normalCardLimit
      ?"Tu baraja está completa. Utiliza o libera una carta para continuar."
      :totalSpins<=0
        ?"No tienes giros disponibles. Avanza de tramo para recibir 3 giros."
        :"Cada giro consume 1 crédito y entrega una carta normal.");
  setText("spinBudget",currentAuthUser
    ?("GIROS DEL TRAMO: "+tramoSpinsRemaining+" · EXTRA: "+bonusTramoSpinsRemaining)
    :"INICIA SESIÓN PARA VER TUS GIROS");

  let tramoHint="";
  if(!currentAuthUser){
    tramoHint="Inicia sesión con Discord para avanzar de tramo.";
  }else if(pendingSpins){
    tramoHint="Aún tienes "+totalSpins+" giros pendientes. Utilízalos antes de avanzar al siguiente tramo.";
  }else if(freeSlots<3){
    tramoHint="Te quedan cartas por utilizar, así que no puedes avanzar de tramo hasta tener suficiente espacio. Libera al menos 3 espacios en tu baraja.";
  }else{
    tramoHint="Tienes espacio suficiente. Al avanzar recibirás 2 cartas de tramo y 3 giros de la ruleta normal.";
  }
  setText("tramoProgressHint",tramoHint);
  setText("tramoProgressCount","TRAMO "+currentTramo+" · GIROS "+tramoSpinsRemaining+" NORMALES · "+bonusTramoSpinsRemaining+" EXTRA");
  ["tramoButton","tramoButtonFull"].forEach(id=>{
    const button=document.getElementById(id);
    if(!button)return;
    button.disabled=spinning||!currentAuthUser||pendingSpins||freeSlots<3;
    button.textContent=currentTramo>0?"AVANZAR DE TRAMO":"INICIAR PRIMER TRAMO";
    button.title=tramoHint;
  });

  setText("deckCloudNote",cloudMode
    ?"Tu baraja está conectada a Supabase. Los usos, acciones, giros y evoluciones se validan en el servidor."
    :"Inicia sesión con Discord para activar tu baraja en la nube.");
}
function showResult(card){
  const box=document.getElementById("resultCard");
  box.classList.remove("empty");box.classList.add("won");
  const image=document.createElement("img");image.className="card-art";image.src=cardImage(card);image.alt=card.name;
  const name=document.createElement("div");name.className="card-name";name.textContent=card.name;
  const rarity=document.createElement("div");rarity.className="card-rarity";rarity.textContent=card.rarity||"Carta TypeLink";
  box.replaceChildren(image,name,rarity);
  setText("resultMessage","¡"+card.name+" se ha unido a tu baraja!");
}
function clearResult(){
  const box=document.getElementById("resultCard");
  box.className="result-card empty";
  const holder=document.createElement("div");holder.className="card-placeholder";
  const star=document.createElement("span");star.textContent="✦";
  const strong=document.createElement("strong");strong.innerHTML="¿QUÉ TE<br>TOCARÁ?";
  const small=document.createElement("small");small.textContent="GIRA LA RULETA";
  holder.append(star,strong,small);box.replaceChildren(holder);
  setText("resultMessage","Tu próxima carta te espera.");
}
function notify(message){
  toast.textContent=message;toast.classList.add("show");
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),3000);
}

function renderProfile(profile){
  currentProfile=profile||null;
  const metadata=currentAuthUser?.user_metadata||{};
  const displayName=profile?.display_name||metadata.global_name||metadata.name||metadata.user_name||"Entrenador";
  const avatarUrl=profile?.avatar_url||metadata.avatar_url||metadata.picture||"";
  setText("userDisplayName",displayName);
  setText("homeProfileName",currentAuthUser?("¡Bienvenido, "+displayName+"!"):"Tu perfil te espera.");
  setText("homeProfileDescription",currentAuthUser
    ?"Tu identidad está conectada. Tu baraja y tus datos se guardan en tu cuenta."
    :"Inicia sesión con Discord para registrar tu identidad y guardar tu baraja en la nube.");
  setText("homeProfileStatus",currentAuthUser?"CONECTADO":"SIN SESIÓN");
  setText("homeProfileHandle",currentAuthUser?"ENTRENADOR · "+(metadata.preferred_username||metadata.user_name||displayName).toUpperCase():"ENTRENADOR NO IDENTIFICADO");
  setText("homeProfileSince",currentProfile?.created_at?("Miembro desde "+formatDate(currentProfile.created_at)):"Conecta tu cuenta de Discord.");
  setText("profileDiscordName",displayName);
  setText("profileDiscordHandle",currentAuthUser
    ?("@"+(metadata.preferred_username||metadata.user_name||displayName)+" · Discord")
    :"Discord · Sin conectar");
  setText("profileVerified",currentAuthUser?"● IDENTIDAD VERIFICADA POR DISCORD":"● INICIA SESIÓN PARA VERIFICAR TU IDENTIDAD");
  setText("profileJoinedDate",profile?.created_at?formatDate(profile.created_at):"—");
  const profileInput=document.getElementById("profileDisplayName");
  if(profileInput&&document.activeElement!==profileInput)profileInput.value=profile?.display_name||displayName;
  applyAvatar(document.getElementById("userAvatar"),avatarUrl,displayName.slice(0,2).toUpperCase());
  applyAvatar(document.getElementById("homeProfileAvatar"),avatarUrl,displayName.slice(0,2).toUpperCase());
  applyAvatar(document.getElementById("profileAvatarLarge"),avatarUrl,displayName.slice(0,2).toUpperCase());
}

function renderTypeTracker(){
  const container=document.getElementById("typeTrackerGrid");
  if(!container)return;
  container.replaceChildren();
  if(!currentAuthUser){
    const empty=document.createElement("div");empty.className="profile-module-empty";empty.textContent="Inicia sesión con Discord para marcar los tipos habilitados.";container.append(empty);
    setText("typeTrackerCount","SIN SESIÓN");return;
  }
  const enabledCount=POKEMON_TYPES.filter(type=>playerTypeStatus[type.slug]!==false).length;
  setText("typeTrackerCount",enabledCount+" / 18 ACTIVOS");
  POKEMON_TYPES.forEach(type=>{
    const enabled=playerTypeStatus[type.slug]!==false;
    const button=document.createElement("button");
    button.type="button";
    button.className="type-toggle "+(enabled?"enabled":"disabled");
    button.style.setProperty("--type-color",type.color);
    button.setAttribute("aria-pressed",String(enabled));
    button.setAttribute("aria-label",type.name+": "+(enabled?"habilitado":"bloqueado"));
    button.title=enabled?"Haz clic para bloquear el tipo "+type.name:"Haz clic para habilitar el tipo "+type.name;
    button.disabled=pendingTypeUpdates.has(type.slug);
    const dot=document.createElement("span");dot.className="type-dot";
    const label=document.createElement("span");label.className="type-toggle-label";
    const name=document.createElement("strong");name.textContent=type.name;
    const state=document.createElement("small");state.textContent=enabled?"HABILITADO":"BLOQUEADO";
    label.append(name,state);button.append(dot,label);
    button.addEventListener("click",()=>togglePokemonType(type.slug));
    container.append(button);
  });
}
function durationLabel(effect){
  switch(effect.duration_type){
    case "tramo_end":return "Hasta avanzar de tramo";
    case "next_tramo_end":return "Hasta el final del próximo tramo";
    case "timed":{
      if(effect.expires_at){
        const date=new Date(effect.expires_at);
        return "Finaliza "+date.toLocaleString("es-CO",{dateStyle:"short",timeStyle:"short"});
      }
      const units={seconds:"segundos",minutes:"minutos",hours:"horas",days:"días"};
      return "Duración: "+(effect.duration_value||"?")+" "+(units[effect.duration_unit]||"unidades");
    }
    case "charges":return (effect.remaining_uses??effect.duration_value??"?")+" cargas restantes";
    case "match_end":return "Hasta finalizar el combate";
    case "permanent":return "Efecto permanente";
    default:return "Efecto activo";
  }
}
function effectLabel(effect){
  const value=effect.effect_value;
  if(effect.effect_key==="normal_card_limit"){
    const amount=Number(value)||0;
    return "Límite de baraja "+(amount>=0?"+":"")+amount;
  }
  if(effect.effect_key==="tramo_spin_credit")return "+"+(Number(value)||0)+" giros extra";
  const name=String(effect.effect_key||"efecto").replace(/_/g," ");
  return value==null?name:(name+" · "+value);
}
function renderIncomingEffects(groups){
  const container=document.getElementById("incomingEffectsList");
  if(!container)return;
  container.replaceChildren();
  setText("incomingEffectsCount",groups.length+" ACTIVAS");
  if(!currentAuthUser){
    const empty=document.createElement("div");empty.className="profile-module-empty";empty.textContent="Inicia sesión para consultar las cartas que te afectan.";container.append(empty);return;
  }
  if(!groups.length){
    const empty=document.createElement("div");empty.className="profile-module-empty";empty.textContent="Ningún otro entrenador tiene cartas con efectos activos sobre ti ahora mismo.";container.append(empty);return;
  }
  groups.forEach(group=>{
    const card=document.createElement("article");card.className="incoming-effect-card";
    const imagePath=group.card?.image_path;
    if(imagePath){
      const image=document.createElement("img");image.className="incoming-effect-image";image.src=imagePath;image.alt=group.card.name||"Carta";card.append(image);
    }else{
      const image=document.createElement("div");image.className="incoming-effect-image fallback";image.textContent="✦";card.append(image);
    }
    const body=document.createElement("div");body.className="incoming-effect-body";
    const title=document.createElement("div");title.className="incoming-effect-title";
    const name=document.createElement("strong");name.textContent=group.card?.name||"Carta TypeLink";
    const rarity=document.createElement("span");rarity.className="incoming-effect-rarity";rarity.textContent=group.card?.rarity||"CARTA";
    title.append(name,rarity);
    const caster=document.createElement("p");caster.className="incoming-effect-caster";caster.textContent="Lanzada por "+(group.casterName||"otro entrenador");
    const tags=document.createElement("div");tags.className="incoming-effect-tags";
    const effects=[...new Set(group.effects.map(effectLabel))];
    const durations=[...new Set(group.effects.map(durationLabel))];
    [...effects,...durations].forEach(text=>{
      const tag=document.createElement("span");tag.className="incoming-effect-tag";tag.textContent=text;tags.append(tag);
    });
    body.append(title,caster,tags);card.append(body);container.append(card);
  });
}
async function togglePokemonType(typeSlug){
  if(!authClient||!currentAuthUser||pendingTypeUpdates.has(typeSlug))return;
  const nextValue=playerTypeStatus[typeSlug]===false;
  pendingTypeUpdates.add(typeSlug);renderTypeTracker();
  try{
    const {error}=await authClient.from("player_type_status").upsert({
      owner_id:currentAuthUser.id,type_slug:typeSlug,is_enabled:nextValue,updated_at:new Date().toISOString()
    },{onConflict:"owner_id,type_slug"});
    if(error)throw error;
    playerTypeStatus[typeSlug]=nextValue;
    const type=POKEMON_TYPES.find(item=>item.slug===typeSlug);
    notify((type?.name||"Tipo Pokémon")+(nextValue?" habilitado.":" bloqueado."));
  }catch(error){
    console.error("No se pudo actualizar el tipo Pokémon:",error);
    notify("No se pudo guardar el tipo: "+(error.message||"error desconocido"));
  }finally{
    pendingTypeUpdates.delete(typeSlug);renderTypeTracker();
  }
}
async function loadProfileMechanics(){
  if(!authClient||!currentAuthUser){
    playerTypeStatus=Object.create(null);incomingCardEffects=[];
    renderTypeTracker();renderIncomingEffects([]);return;
  }
  const [typesResult,effectsResult]=await Promise.all([
    authClient.from("player_type_status").select("type_slug,is_enabled")
      .eq("owner_id",currentAuthUser.id),
    authClient.from("player_effects").select("id,owner_id,applied_by,source_card_instance_id,effect_key,effect_value,parameters,duration_type,duration_value,duration_unit,expires_at,expires_after_tramo,remaining_uses,status,created_at")
      .eq("owner_id",currentAuthUser.id).eq("status","active")
      .order("created_at",{ascending:false})
  ]);
  if(typesResult.error){
    console.error("No se pudieron cargar los tipos Pokémon:",typesResult.error.message);
    notify("No pudimos cargar tu registro de tipos Pokémon.");
  }else{
    playerTypeStatus=Object.create(null);
    (typesResult.data||[]).forEach(row=>{playerTypeStatus[row.type_slug]=row.is_enabled;});
    const missing=POKEMON_TYPES.filter(type=>playerTypeStatus[type.slug]===undefined);
    if(missing.length){
      const seedRows=missing.map(type=>({owner_id:currentAuthUser.id,type_slug:type.slug,is_enabled:true}));
      const {error}=await authClient.from("player_type_status").upsert(seedRows,{onConflict:"owner_id,type_slug",ignoreDuplicates:true});
      if(error)console.warn("No se pudieron completar los estados de tipos:",error.message);
      missing.forEach(type=>{if(playerTypeStatus[type.slug]===undefined)playerTypeStatus[type.slug]=true;});
      if(!error){
        const refreshed=await authClient.from("player_type_status").select("type_slug,is_enabled").eq("owner_id",currentAuthUser.id);
        if(!refreshed.error)(refreshed.data||[]).forEach(row=>{playerTypeStatus[row.type_slug]=row.is_enabled;});
      }
    }
    renderTypeTracker();
  }

  if(effectsResult.error){
    console.error("No se pudieron cargar los efectos activos:",effectsResult.error.message);
    renderIncomingEffects([]);
    return;
  }
  const activeIncoming=(effectsResult.data||[]).filter(effect=>
    effect.applied_by&&effect.applied_by!==currentAuthUser.id&&
    (!effect.expires_at||new Date(effect.expires_at).getTime()>Date.now())&&
    (effect.expires_after_tramo==null||Number(effect.expires_after_tramo)>=currentTramo)
  );
  const sourceIds=[...new Set(activeIncoming.map(effect=>effect.source_card_instance_id).filter(Boolean))];
  const casterIds=[...new Set(activeIncoming.map(effect=>effect.applied_by).filter(Boolean))];
  const [cardsResult,profilesResult]=await Promise.all([
    sourceIds.length
      ?authClient.from("player_cards").select("id,card_catalog(name,rarity,image_path,description)").in("id",sourceIds)
      :Promise.resolve({data:[],error:null}),
    casterIds.length
      ?authClient.from("profiles").select("id,display_name").in("id",casterIds)
      :Promise.resolve({data:[],error:null})
  ]);
  if(cardsResult.error)console.warn("No se pudieron cargar las cartas fuente:",cardsResult.error.message);
  if(profilesResult.error)console.warn("No se pudieron cargar los lanzadores:",profilesResult.error.message);
  const cardMap=Object.create(null);
  (cardsResult.data||[]).forEach(row=>{
    const joined=Array.isArray(row.card_catalog)?row.card_catalog[0]:row.card_catalog;
    cardMap[row.id]=joined||null;
  });
  const profileMap=Object.fromEntries((profilesResult.data||[]).map(profile=>[profile.id,profile.display_name||"Entrenador"]));
  const grouped=new Map();
  activeIncoming.forEach(effect=>{
    const key=effect.source_card_instance_id||("effect-"+effect.id);
    if(!grouped.has(key))grouped.set(key,{sourceId:effect.source_card_instance_id,card:cardMap[key]||null,casterName:profileMap[effect.applied_by]||"otro entrenador",effects:[]});
    grouped.get(key).effects.push(effect);
  });
  incomingCardEffects=[...grouped.values()];
  renderIncomingEffects(incomingCardEffects);
}
async function loadMyProfile(){
  if(!authClient||!currentAuthUser){
    renderProfile(null);renderTypeTracker();renderIncomingEffects([]);return;
  }
  const {data,error}=await authClient.from("profiles")
    .select("id,display_name,avatar_url,created_at")
    .eq("id",currentAuthUser.id).single();
  if(error){
    console.error("No se pudo cargar el perfil:",error.message);
    notify("No pudimos cargar tu perfil de entrenador.");
    return;
  }
  renderProfile(data);
  await loadProfileMechanics();
}

function renderAuthState(user){
  currentAuthUser=user||null;
  const loginButton=document.getElementById("loginButton");
  const userChip=document.getElementById("userChip");
  const status=document.getElementById("connectionStatus");
  const avatar=document.getElementById("userAvatar");
  if(!loginButton||!userChip||!status||!avatar)return;

  if(!user){
    loginButton.hidden=false;userChip.hidden=true;
    status.innerHTML="<i></i> MODO DEMOSTRACIÓN";
    setText("userDisplayName","ENTRENADOR");setText("userStatus","Sin sesión");
    applyAvatar(avatar,"","TL");
    renderProfile(null);
    return;
  }

  loginButton.hidden=true;userChip.hidden=false;
  status.innerHTML="<i></i> DISCORD CONECTADO";
  setText("userStatus","Sesión iniciada");
  renderProfile(currentProfile);
}

function mapInventoryRow(row){
  const joined=Array.isArray(row.card_catalog)?row.card_catalog[0]:row.card_catalog;
  if(!joined)return null;
  const rarityLabels={common:"Común",rare:"Rara",epic:"Épica",legendary:"Legendaria",tramo:"Tramo",fiesta:"Fiesta"};
  return {
    instance_id:row.id,
    card_id:row.card_id||joined.id,
    slug:joined.slug,
    name:joined.name,
    rarity:rarityLabels[joined.rarity]||"Carta",
    category:joined.category,
    description:joined.description,
    image_path:joined.image_path,
    uses_per_card:Number(joined.uses_per_card||1),
    remaining_uses:Number(row.remaining_uses??joined.uses_per_card??1),
    target_scope:joined.target_scope||"self",
    disposition:joined.disposition||"consume",
    counts_toward_normal_limit:joined.counts_toward_normal_limit!==false,
    source:row.source,
    tramo_number:row.tramo_number,
    status:row.status,
    obtained_at:row.obtained_at
  };
}

async function loadCardEngineConfig(){
  if(!authClient||!currentAuthUser)return;
  const [rulesResult,effectsResult,settingsResult,playerEffectsResult,progressResult]=await Promise.all([
    authClient.from("card_evolution_rules").select("id,slug,name,description,source_card_id,result_card_id,same_tramo_only").eq("is_active",true),
    authClient.from("card_effects").select("id,card_id,effect_key,operation,effect_value,parameters,duration_type,duration_value,duration_unit").eq("is_active",true),
    authClient.from("event_settings").select("normal_card_limit,current_tramo").eq("singleton",true).single(),
    authClient.from("player_effects").select("effect_value,expires_at,expires_after_tramo")
      .eq("owner_id",currentAuthUser.id).eq("effect_key","normal_card_limit").eq("operation","add").eq("status","active"),
    authClient.from("player_tramo_progress").select("current_tramo,spins_remaining,bonus_spins_remaining")
      .eq("owner_id",currentAuthUser.id).maybeSingle()
  ]);
  evolutionRulesBySource=Object.create(null);
  cardEffectsById=Object.create(null);
  if(effectsResult.error)console.warn("No se pudieron cargar los efectos:",effectsResult.error.message);
  else (effectsResult.data||[]).forEach(effect=>{(cardEffectsById[effect.card_id] ||= []).push(effect);});
  if(progressResult.error)console.warn("No se pudo cargar el progreso de tramo:",progressResult.error.message);
  const progress=progressResult.data||{};
  currentTramo=Number(progress.current_tramo)||0;
  tramoSpinsRemaining=Number(progress.spins_remaining)||0;
  bonusTramoSpinsRemaining=Number(progress.bonus_spins_remaining)||0;
  if(!settingsResult.error&&settingsResult.data){
    const base=Number(settingsResult.data.normal_card_limit)||5;
    const bonus=(playerEffectsResult.data||[]).reduce((sum,effect)=>{
      const timeOk=!effect.expires_at||new Date(effect.expires_at).getTime()>Date.now();
      const tramoOk=effect.expires_after_tramo==null||Number(effect.expires_after_tramo)>=currentTramo;
      return sum+(timeOk&&tramoOk?(Number(effect.effect_value)||0):0);
    },0);
    normalCardLimit=Math.max(0,base+bonus);
  }else normalCardLimit=5;
  if(rulesResult.error){
    console.warn("No se pudieron cargar las evoluciones:",rulesResult.error.message);
    renderDeck();return;
  }
  const rules=rulesResult.data||[];
  const resultIds=[...new Set(rules.map(rule=>rule.result_card_id))];
  let resultCards=[];
  if(resultIds.length){
    const result=await authClient.from("card_catalog")
      .select("id,slug,name,category,rarity,description,image_path,uses_per_card").in("id",resultIds);
    if(result.error)console.warn("No se pudieron cargar las cartas evolucionadas:",result.error.message);
    else resultCards=result.data||[];
  }
  const resultMap=Object.fromEntries(resultCards.map(card=>[card.id,card]));
  rules.forEach(rule=>{
    const resultCard=resultMap[rule.result_card_id];
    if(resultCard)evolutionRulesBySource[rule.source_card_id]={...rule,resultCard};
  });
}

async function loadCloudInventory(){
  if(!authClient||!currentAuthUser)return;
  const {data,error}=await authClient.from("player_cards")
    .select("id,card_id,source,tramo_number,status,remaining_uses,obtained_at,card_catalog(id,slug,name,category,rarity,description,image_path,uses_per_card,target_scope,disposition,counts_toward_normal_limit)")
    .eq("owner_id",currentAuthUser.id)
    .order("obtained_at",{ascending:true});
  if(error){
    console.error("No se pudo cargar la baraja:",error.message);
    notify("No pudimos cargar tu baraja. Inténtalo de nuevo.");
    return;
  }
  cloudInventory=(data||[]).map(mapInventoryRow).filter(Boolean);
  const available=cloudInventory.filter(item=>item.status==="available"&&item.remaining_uses>0);
  cloudDeck=available.filter(item=>item.category==="normal"&&item.counts_toward_normal_limit);
  cloudRoute=available.filter(item=>item.category==="tramo");
  cloudSpecial=available.filter(item=>item.category!=="normal"&&item.category!=="tramo");
  await loadCardEngineConfig();
  renderDeck();
}


function initials(name){
  return String(name||"TL").trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase()||"TL";
}
function makeActivityPlaceholder(message){
  const box=document.createElement("div");box.className="activity-empty panel";box.textContent=message;return box;
}
function renderActivityFeed(entries,profiles){
  const container=document.getElementById("activityFeed");
  if(!container)return;
  container.replaceChildren();
  if(!entries.length){
    container.append(makeActivityPlaceholder("Aún no hay movimientos. Cuando un entrenador avance de tramo, gire la ruleta o juegue una carta, aparecerá aquí."));
    return;
  }
  entries.forEach(entry=>{
    const details=entry.details&&typeof entry.details==="object"?entry.details:{};
    const actor=profiles[entry.actor_id]||{};
    const target=profiles[entry.target_id]||{};
    const actorName=actor.display_name||"Entrenador";
    const targetName=target.display_name||"otro entrenador";
    const item=document.createElement("article");item.className="activity-item panel";
    const avatar=document.createElement("div");avatar.className="activity-avatar";
    if(actor.avatar_url){
      const avatarImage=document.createElement("img");avatarImage.src=actor.avatar_url;avatarImage.alt="";avatar.append(avatarImage);
    }else avatar.textContent=initials(actorName);
    const body=document.createElement("div");body.className="activity-body";
    const header=document.createElement("div");header.className="activity-header";
    const who=document.createElement("strong");who.textContent=actorName;
    const when=document.createElement("time");
    const date=new Date(entry.created_at);
    when.textContent=Number.isNaN(date.getTime())?"":date.toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"});
    header.append(who,when);
    const line=document.createElement("p");line.className="activity-message";
    let symbol="✦",message="";
    const cardName=details.card_name||details.name||"una carta";
    if(entry.activity_type==="tramo_award"){
      symbol="Ⅱ";message="ha avanzado al tramo "+(details.tramo_number||"?")+" y ha recibido 2 cartas de tramo";
    }else if(entry.activity_type==="roulette_spin"){
      symbol="◉";message="ha girado la ruleta y ha obtenido "+cardName;
    }else if(entry.activity_type==="transfer"){
      symbol="⇢";message="ha enviado "+cardName+" a "+targetName;
    }else if(entry.activity_type==="evolution"){
      symbol="⬡";message="ha evolucionado "+(details.source_name||"una carta")+" → "+(details.result_name||"nueva carta");
    }else{
      symbol="✦";
      message="ha utilizado "+cardName+(entry.target_id&&entry.target_id!==entry.actor_id?" sobre "+targetName:entry.target_id?" sobre sí mismo":"");
    }
    const mark=document.createElement("span");mark.className="activity-symbol";mark.textContent=symbol;
    const messageText=document.createElement("span");messageText.textContent=message;
    line.append(mark,messageText);
    body.append(header,line);
    const imagePath=details.image_path||details.result_image_path||details.source_image_path;
    if(imagePath){
      const cardImageEl=document.createElement("img");cardImageEl.className="activity-card-image";cardImageEl.src=imagePath;cardImageEl.alt=cardName;body.append(cardImageEl);
    }
    if(Array.isArray(details.cards)&&details.cards.length){
      const cards=document.createElement("div");cards.className="activity-card-thumbs";
      details.cards.forEach(card=>{
        if(!card.image_path)return;
        const image=document.createElement("img");image.src=card.image_path;image.alt=card.name||"Carta de tramo";image.title=card.name||"Carta de tramo";cards.append(image);
      });
      if(cards.childElementCount)body.append(cards);
    }
    item.append(avatar,body);container.append(item);
  });
}
async function loadActivityFeed(){
  const container=document.getElementById("activityFeed");
  if(!container)return;
  if(!currentAuthUser||!authClient){
    container.replaceChildren(makeActivityPlaceholder("Inicia sesión con Discord para ver los movimientos de todos los entrenadores."));
    return;
  }
  const {data,error}=await authClient.from("card_activity")
    .select("id,actor_id,target_id,activity_type,details,created_at")
    .in("activity_type",["tramo_award","roulette_spin","play","transfer","evolution"])
    .order("created_at",{ascending:false})
    .limit(60);
  if(error){
    console.error("No se pudo cargar el muro de cartas:",error.message);
    container.replaceChildren(makeActivityPlaceholder("No pudimos cargar el muro de cartas. Inténtalo de nuevo."));
    return;
  }
  const profileIds=[...new Set((data||[]).flatMap(row=>[row.actor_id,row.target_id]).filter(Boolean))];
  let profiles={};
  if(profileIds.length){
    const result=await authClient.from("profiles").select("id,display_name,avatar_url").in("id",profileIds);
    if(!result.error)profiles=Object.fromEntries((result.data||[]).map(profile=>[profile.id,profile]));
  }
  renderActivityFeed(data||[],profiles);
}

async function loadPlayers(){
  const container=document.getElementById("playersList");
  if(!container)return;
  container.replaceChildren();
  if(!currentAuthUser){
    const empty=document.createElement("div");empty.className="empty-feature panel";
    const icon=document.createElement("div");icon.className="empty-emblem";icon.textContent="♙";
    const title=document.createElement("h2");title.textContent="Inicia sesión para ver a los entrenadores.";
    const body=document.createElement("p");body.textContent="Los perfiles públicos están disponibles para los participantes registrados.";
    empty.append(icon,title,body);container.append(empty);setText("playersCount","0 ENTRENADORES");return;
  }
  const loading=document.createElement("div");loading.className="players-loading";loading.textContent="Cargando entrenadores de Teselia...";container.append(loading);
  const {data:profiles,error}=await authClient.from("profiles")
    .select("id,display_name,avatar_url,created_at")
    .order("created_at",{ascending:true});
  if(error){
    console.error("No se pudieron cargar los jugadores:",error.message);
    container.replaceChildren();const message=document.createElement("div");message.className="empty-feature panel";message.textContent="No pudimos cargar el directorio de jugadores.";container.append(message);return;
  }
  const {data:cards}=await authClient.from("player_cards").select("owner_id,card_catalog(category)");
  const counts={normal:{},tramo:{}};
  (cards||[]).forEach(row=>{
    const joined=Array.isArray(row.card_catalog)?row.card_catalog[0]:row.card_catalog;
    if(!joined)return;
    const type=joined.category==="tramo"?"tramo":"normal";
    counts[type][row.owner_id]=(counts[type][row.owner_id]||0)+1;
  });
  container.replaceChildren();
  setText("playersCount",(profiles||[]).length+" ENTRENADORES");
  if(!profiles||!profiles.length){
    const empty=document.createElement("div");empty.className="empty-feature panel";empty.textContent="Todavía no hay entrenadores registrados.";container.append(empty);return;
  }
  profiles.forEach(profile=>{
    const card=document.createElement("article");card.className="player-directory-card";
    const avatar=document.createElement("div");avatar.className="player-directory-avatar";
    applyAvatar(avatar,profile.avatar_url,(profile.display_name||"TL").slice(0,2).toUpperCase());
    const info=document.createElement("div");info.className="player-directory-info";
    const name=document.createElement("strong");name.textContent=profile.display_name||"Entrenador";
    const since=document.createElement("small");since.textContent="Entrenador desde "+formatDate(profile.created_at);
    info.append(name,since);
    const stats=document.createElement("div");stats.className="player-directory-stats";
    const normal=document.createElement("span");normal.textContent=(counts.normal[profile.id]||0)+" / 5 CARTAS";
    const tramo=document.createElement("span");tramo.textContent=(counts.tramo[profile.id]||0)+" TRAMO";
    stats.append(normal,tramo);
    const button=document.createElement("button");button.className="player-view-button";button.type="button";button.textContent="VER PERFIL ↗";
    button.addEventListener("click",()=>showPublicPlayer(profile.id));
    card.append(avatar,info,stats,button);container.append(card);
  });
}

async function showPublicPlayer(playerId){
  const modal=document.getElementById("publicProfileModal");
  const {data:profile,error}=await authClient.from("profiles")
    .select("id,display_name,avatar_url,created_at").eq("id",playerId).single();
  if(error||!profile){notify("No pudimos abrir este perfil.");return;}
  setText("publicPlayerName",profile.display_name||"Entrenador");
  setText("publicPlayerJoined","Entrenador desde "+formatDate(profile.created_at));
  applyAvatar(document.getElementById("publicPlayerAvatar"),profile.avatar_url,(profile.display_name||"TL").slice(0,2).toUpperCase());
  const container=document.getElementById("publicPlayerCards");container.replaceChildren();
  const {data:rows,error:cardsError}=await authClient.from("player_cards")
    .select("id,card_id,source,tramo_number,status,remaining_uses,obtained_at,card_catalog(id,name,category,rarity,image_path,uses_per_card,target_scope,disposition,counts_toward_normal_limit)")
    .eq("owner_id",playerId).order("obtained_at",{ascending:true});
  if(cardsError){notify("No pudimos cargar la baraja pública.");return;}
  const items=(rows||[]).map(mapInventoryRow).filter(Boolean);
  setText("publicPlayerCardCount",items.length+" CARTAS");
  if(!items.length){
    const empty=document.createElement("div");empty.className="deck-empty";empty.textContent="Este entrenador todavía no tiene cartas.";container.append(empty);
  }else{
    items.forEach((item,index)=>container.append(createDeckItem(item,index,item.category==="tramo")));
  }
  modal.hidden=false;
}
function closePublicPlayer(){document.getElementById("publicProfileModal").hidden=true;}


async function openCardAction(instanceId,mode){
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord para gestionar tus cartas.");return;}
  const card=cloudInventory.find(item=>item.instance_id===instanceId);
  if(!card||card.status!=="available"||card.remaining_uses<=0){notify("Esta carta ya no tiene usos disponibles.");return;}

  const modal=document.getElementById("cardActionModal");
  const targetWrap=document.getElementById("cardActionTargetWrap");
  const resultPreview=document.getElementById("cardActionResultPreview");
  const targetSelect=document.getElementById("cardActionTarget");
  const confirmButton=document.getElementById("confirmCardAction");
  const feedback=document.getElementById("cardActionFeedback");
  confirmButton.disabled=false;
  pendingCardAction={instanceId,mode,card};

  const sourceImage=document.getElementById("cardActionImage");
  sourceImage.src=cardImage(card);sourceImage.alt=card.name;
  setText("cardActionName",card.name);
  setText("cardActionUses",card.remaining_uses+"/"+card.uses_per_card+" USOS RESTANTES");
  targetWrap.hidden=true;
  resultPreview.hidden=true;
  feedback.textContent="";
  targetSelect.replaceChildren();

  if(mode==="evolve"){
    const rule=evolutionRulesBySource[card.card_id];
    if(!rule||!rule.resultCard){notify("Esta carta todavía no tiene una evolución disponible.");return;}
    setText("cardActionEyebrow","EVOLUCIÓN DE UNA CARTA");
    setText("cardActionTitle","Evolucionar carta");
    setText("cardActionArrow","→");
    document.getElementById("cardActionResultImage").src=cardImage(rule.resultCard);
    document.getElementById("cardActionResultImage").alt=rule.resultCard.name;
    setText("cardActionResultName",rule.resultCard.name);
    setText("cardActionResultUses",rule.resultCard.uses_per_card+" USOS AL EVOLUCIONAR");
    resultPreview.hidden=false;
    setText("cardActionDescription",rule.description||("Se transformará "+card.name+" en "+rule.resultCard.name+". La carta original se consumirá y recibirás una nueva."));
    confirmButton.textContent="CONFIRMAR EVOLUCIÓN";
  }else{
    const transfer=mode==="transfer";
    setText("cardActionEyebrow",transfer?"TRANSFERENCIA DE CARTA":"USO DE CARTA");
    setText("cardActionTitle",transfer?"Transferir carta":"Usar carta");
    setText("cardActionArrow",transfer?"⇢":"✦");
    setText("cardActionDescription",transfer
      ?"La carta pasará al inventario del entrenador seleccionado sin activar su efecto."
      :"La carta activará su efecto configurado. Cada uso resta una carga; al llegar a cero, la carta se agotará.");
    confirmButton.textContent=transfer?"CONFIRMAR TRANSFERENCIA":"USAR CARTA";

    if(card.target_scope==="opponent"||card.target_scope==="either"){
      targetWrap.hidden=false;
      const prompt=document.createElement("option");
      prompt.value="";
      prompt.textContent=mode==="transfer"
        ?"Selecciona otro entrenador"
        :(card.target_scope==="either"?"Usarla sobre mí":"Selecciona un entrenador");
      targetSelect.append(prompt);
      if(card.target_scope==="opponent"||mode==="transfer")prompt.disabled=true;
      try{
        const {data,error}=await authClient.from("profiles")
          .select("id,display_name").neq("id",currentAuthUser.id).order("display_name",{ascending:true});
        if(error)throw error;
        (data||[]).forEach(profile=>{
          const option=document.createElement("option");
          option.value=profile.id;option.textContent=profile.display_name||"Entrenador";
          targetSelect.append(option);
        });
      }catch(error){
        feedback.textContent="No pudimos cargar la lista de entrenadores: "+(error.message||"error desconocido");
        confirmButton.disabled=true;
      }
    }
  }
  modal.hidden=false;
}

function closeCardAction(){
  const modal=document.getElementById("cardActionModal");
  if(modal)modal.hidden=true;
  pendingCardAction=null;
  const button=document.getElementById("confirmCardAction");
  if(button){button.disabled=false;button.textContent="CONFIRMAR";}
}

async function confirmCardAction(){
  if(!pendingCardAction||!authClient||!currentAuthUser)return;
  const {instanceId,mode,card}=pendingCardAction;
  const button=document.getElementById("confirmCardAction");
  const targetSelect=document.getElementById("cardActionTarget");
  const feedback=document.getElementById("cardActionFeedback");
  let targetId=null;

  if(mode!=="evolve"&&(card.target_scope==="opponent"||card.target_scope==="either")){
    targetId=targetSelect.value||null;
    if(card.target_scope==="opponent"&&!targetId){
      feedback.textContent="Selecciona un entrenador antes de continuar.";
      return;
    }
    if(mode==="transfer"&&!targetId){
      feedback.textContent="Selecciona quién recibirá la carta.";
      return;
    }
  }

  button.disabled=true;button.textContent="PROCESANDO...";
  feedback.textContent="Validando la acción en el servidor...";
  try{
    const rpcName=mode==="evolve"?"evolve_card":"play_card";
    const args=mode==="evolve"
      ?{p_card_instance_id:instanceId}
      :{p_card_instance_id:instanceId,p_target_id:targetId};
    const {data,error}=await authClient.rpc(rpcName,args);
    if(error)throw error;
    closeCardAction();
    await loadCloudInventory();

    if(mode==="evolve"){
      showResult({
        name:data.result_name,
        rarity:data.result_rarity,
        image_path:data.result_image_path,
        description:data.result_description
      });
      notify("¡"+data.source_name+" evolucionó a "+data.result_name+"!");
    }else if(mode==="transfer"){
      notify("¡"+card.name+" se transfirió correctamente!");
    }else{
      const remaining=Number(data.remaining_uses??0);
      notify(remaining>0
        ?"¡"+card.name+" utilizada! Te quedan "+remaining+" usos."
        :"¡"+card.name+" agotó todos sus usos!");
    }
  }catch(error){
    console.error("No se pudo completar la acción de carta:",error);
    feedback.textContent=error.message||"No se pudo completar la acción.";
    button.disabled=false;
    button.textContent=mode==="evolve"?"CONFIRMAR EVOLUCIÓN":mode==="transfer"?"CONFIRMAR TRANSFERENCIA":"USAR CARTA";
  }
}

async function saveProfile(){
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord primero.");return;}
  const input=document.getElementById("profileDisplayName");
  const button=document.getElementById("saveProfileButton");
  const status=document.getElementById("profileSaveStatus");
  const name=(input.value||"").trim();
  if(name.length<2||name.length>28){status.textContent="El nombre debe tener entre 2 y 28 caracteres.";status.classList.add("error");return;}
  button.disabled=true;button.textContent="GUARDANDO...";
  status.classList.remove("error");status.textContent="Guardando tu identidad...";
  try{
    const {data,error}=await authClient.from("profiles")
      .update({display_name:name}).eq("id",currentAuthUser.id)
      .select("id,display_name,avatar_url,created_at").single();
    if(error)throw error;
    renderProfile(data);
    status.textContent="¡Tu nombre público se ha guardado!";
    notify("Perfil actualizado correctamente.");
    await loadPlayers();
  }catch(error){
    console.error("Error al guardar perfil:",error);
    status.textContent="No se pudo guardar: "+(error.message||"error desconocido.");
    status.classList.add("error");
  }finally{
    button.disabled=false;button.textContent="GUARDAR PERFIL";
  }
}

function setupRealtime(){
  if(!authClient||!currentAuthUser)return;
  if(inventoryChannel)authClient.removeChannel(inventoryChannel);
  if(profilesChannel)authClient.removeChannel(profilesChannel);
  if(activityChannel)authClient.removeChannel(activityChannel);
  inventoryChannel=authClient.channel("typelink-player-cards-"+currentAuthUser.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"player_cards",filter:"owner_id=eq."+currentAuthUser.id},()=>loadCloudInventory())
    .subscribe();
  profilesChannel=authClient.channel("typelink-public-profiles")
    .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>loadPlayers())
    .subscribe();
  activityChannel=authClient.channel("typelink-community-activity")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"card_activity"},()=>loadActivityFeed())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_tramo_progress",filter:"owner_id=eq."+currentAuthUser.id},()=>loadCloudInventory())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_effects",filter:"owner_id=eq."+currentAuthUser.id},()=>loadProfileMechanics())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_type_status",filter:"owner_id=eq."+currentAuthUser.id},()=>loadProfileMechanics())
    .subscribe();
}
async function activateUserSession(user){
  if(!user){
    if(inventoryChannel&&authClient)authClient.removeChannel(inventoryChannel);
    if(profilesChannel&&authClient)authClient.removeChannel(profilesChannel);
    if(activityChannel&&authClient)authClient.removeChannel(activityChannel);
    inventoryChannel=null;profilesChannel=null;activityChannel=null;
    activeSessionUserId=null;currentProfile=null;cloudMode=false;cloudDeck=[];cloudRoute=[];cloudSpecial=[];cloudInventory=[];
    currentTramo=0;tramoSpinsRemaining=0;bonusTramoSpinsRemaining=0;
    playerTypeStatus=Object.create(null);incomingCardEffects=[];
    evolutionRulesBySource=Object.create(null);cardEffectsById=Object.create(null);
    demoDeck=loadDeck();demoRouteState=loadRouteState();
    renderAuthState(null);renderDeck();loadPlayers();loadActivityFeed();renderTypeTracker();renderIncomingEffects([]);return;
  }
  if(activeSessionUserId===user.id&&cloudMode)return;
  activeSessionUserId=user.id;currentAuthUser=user;cloudMode=true;
  cloudDeck=[];cloudRoute=[];cloudSpecial=[];cloudInventory=[];
  renderAuthState(user);renderDeck();
  await Promise.all([loadMyProfile(),loadCloudInventory(),loadPlayers(),loadActivityFeed()]);
  setupRealtime();
}

function startWheelAnimation(card){
  return new Promise(resolve=>{
    const index=Math.max(0,CARDS.findIndex(item=>item.slug===card.slug));
    const slice=TAU/CARDS.length;
    const currentNorm=((rotation%TAU)+TAU)%TAU;
    const desiredNorm=((TAU-(index+.5)*slice)%TAU+TAU)%TAU;
    const delta=(desiredNorm-currentNorm+TAU)%TAU;
    const start=rotation,target=start+TAU*5+delta;
    const duration=4200,startTime=performance.now();
    function animate(now){
      const progress=Math.min(1,(now-startTime)/duration),eased=1-Math.pow(1-progress,5);
      rotation=start+(target-start)*eased;drawWheel();
      if(progress<1){requestAnimationFrame(animate);return;}
      rotation=target%TAU;resolve();
    }
    requestAnimationFrame(animate);
  });
}
async function spin(){
  if(spinning)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord para obtener cartas.");return;}
  if(activeNormalCards().length>=normalCardLimit){notify("Tu baraja ya tiene el límite de "+normalCardLimit+" cartas normales.");return;}
  if(tramoSpinsRemaining+bonusTramoSpinsRemaining<=0){notify("No tienes giros disponibles. Avanza de tramo para recibir 3 giros.");return;}
  spinning=true;renderDeck();
  try{
    // The server selects and awards the card in one protected transaction.
    const {data,error}=await authClient.rpc("draw_random_card");
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result||!result.slug)throw new Error("El servidor no devolvió una carta válida.");
    const card=CARDS.find(item=>item.slug===result.slug)||{
      slug:result.slug,name:result.name,rarity:result.rarity,image_path:result.image_path,description:result.description
    };
    notify("¡Carta obtenida! La ruleta está girando...");
    await startWheelAnimation(card);
    await loadCloudInventory();
    showResult(card);
    notify("¡"+card.name+" se ha guardado en tu baraja!");
  }catch(error){
    console.error("No se pudo completar el giro:",error);
    const message=error.message||"error desconocido";
    if(message.toLowerCase().includes("completa")||message.toLowerCase().includes("límite")){
      await loadCloudInventory();notify(message);
    }else{
      notify("No pudimos girar la ruleta: "+message);
    }
  }finally{
    spinning=false;renderDeck();
  }
}

async function startNewTramo(){
  if(spinning)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord para avanzar de tramo.");return;}
  const count=activeNormalCards().length;
  const freeSlots=normalCardLimit-count;
  if(tramoSpinsRemaining+bonusTramoSpinsRemaining>0){
    notify("Utiliza los giros pendientes antes de avanzar de tramo.");return;
  }
  if(freeSlots<3){
    notify("Te quedan cartas por utilizar, así que no puedes avanzar de tramo hasta tener suficiente espacio.");return;
  }
  spinning=true;renderDeck();
  try{
    const {data,error}=await authClient.rpc("start_new_tramo");
    if(error)throw error;
    await loadCloudInventory();
    await loadProfileMechanics();
    const cardCount=Array.isArray(data?.cards)?data.cards.length:2;
    const tramo=data?.tramo_number||currentTramo;
    notify("¡Tramo "+tramo+" iniciado! Recibiste "+cardCount+" cartas de tramo y 3 giros normales.");
  }catch(error){
    console.error("No se pudo avanzar de tramo:",error);
    notify("No se pudo avanzar de tramo: "+(error.message||"error desconocido"));
    await loadCloudInventory();
  }finally{
    spinning=false;renderDeck();
  }
}

function setPage(page){
  document.querySelectorAll(".page-view").forEach(view=>{view.hidden=view.id!=="page-"+page;});
  document.querySelectorAll("[data-page]").forEach(button=>{
    if(button.classList.contains("nav-link"))button.classList.toggle("active",button.dataset.page===page);
  });
  const labels={home:"INICIO",roulette:"RULETA",players:"JUGADORES",activity:"MURO DE CARTAS",profile:"MI PERFIL",deck:"MI BARAJA",pokemon:"MI EQUIPO POKÉMON",notifications:"NOTIFICACIONES",admin:"ADMINISTRACIÓN"};
  setText("currentSection",labels[page]||"INICIO");
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileScrim").classList.remove("show");
  if(page==="roulette")drawWheel();
  if(page==="players")loadPlayers();
  if(page==="activity")loadActivityFeed();
  if(page==="deck"&&cloudMode)loadCloudInventory();
  if(page==="profile"&&currentAuthUser)loadMyProfile();
  window.scrollTo({top:0,behavior:"smooth"});
}

function initSupabaseAuth(){
  const config=window.TYPELINK_SUPABASE_CONFIG;
  const loginButton=document.getElementById("loginButton");
  const logoutButton=document.getElementById("logoutButton");
  if(!config||!window.supabase||typeof window.supabase.createClient!=="function"){
    if(loginButton){loginButton.disabled=true;loginButton.title="No se pudo cargar el cliente de Supabase.";}
    notify("No se pudo cargar el servicio de inicio de sesión.");return;
  }
  authClient=window.supabase.createClient(config.url,config.publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  authClient.auth.onAuthStateChange((event,session)=>{
    renderAuthState(session?session.user:null);
    // Defer data queries until after the auth callback releases its internal lock.
    Promise.resolve().then(()=>activateUserSession(session?session.user:null));
    if(event==="SIGNED_IN")notify("¡Bienvenido a Pokémon TypeLink 2!");
    if(event==="SIGNED_OUT")notify("Has cerrado tu sesión.");
  });

  authClient.auth.getSession().then(({data,error})=>{
    if(error){console.error("No se pudo recuperar la sesión:",error.message);notify("No se pudo comprobar tu sesión.");return;}
    renderAuthState(data.session?data.session.user:null);
    activateUserSession(data.session?data.session.user:null);
  });

  if(loginButton){
    loginButton.addEventListener("click",async()=>{
      loginButton.disabled=true;loginButton.textContent="CONECTANDO...";
      try{
        const redirectTo=window.location.origin+window.location.pathname;
        const {error}=await authClient.auth.signInWithOAuth({
          provider:"discord",options:{redirectTo,scopes:"identify email"}
        });
        if(error)throw error;
      }catch(error){
        console.error("Error al iniciar sesión:",error);
        notify("No se pudo iniciar sesión: "+(error.message||"revisa la configuración OAuth."));
        loginButton.disabled=false;loginButton.innerHTML='<span class="discord-symbol">◉</span> ENTRAR CON DISCORD';
      }
    });
  }
  if(logoutButton){
    logoutButton.addEventListener("click",async()=>{
      logoutButton.disabled=true;
      try{const {error}=await authClient.auth.signOut();if(error)throw error;}
      catch(error){console.error("Error al cerrar sesión:",error);notify("No se pudo cerrar sesión: "+(error.message||"error desconocido."));}
      finally{logoutButton.disabled=false;}
    });
  }
}

document.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>setPage(button.dataset.page)));
spinButton.addEventListener("click",spin);
document.getElementById("tramoButton").addEventListener("click",startNewTramo);
document.getElementById("tramoButtonFull").addEventListener("click",startNewTramo);
document.getElementById("saveProfileButton").addEventListener("click",saveProfile);
document.getElementById("closePublicProfile").addEventListener("click",closePublicPlayer);
document.getElementById("closeCardAction").addEventListener("click",closeCardAction);
document.getElementById("cancelCardAction").addEventListener("click",closeCardAction);
document.getElementById("confirmCardAction").addEventListener("click",confirmCardAction);
document.getElementById("cardActionModal").addEventListener("click",event=>{if(event.target.id==="cardActionModal")closeCardAction();});
document.getElementById("publicProfileModal").addEventListener("click",event=>{if(event.target.id==="publicProfileModal")closePublicPlayer();});
document.getElementById("profileDisplayName").addEventListener("keydown",event=>{if(event.key==="Enter")saveProfile();});
document.getElementById("resetButton").addEventListener("click",()=>{
  if(cloudMode){notify("Tu baraja real está protegida y no se reinicia desde la demo.");return;}
  if(spinning||!confirm("¿Seguro que quieres borrar las cartas de esta demo local?"))return;
  demoDeck=[];demoRouteState={tramo:0,cards:[]};saveDeck();saveRouteState();
  clearResult();renderDeck();notify("Datos de demostración local reiniciados.");
});
document.getElementById("mobileMenu").addEventListener("click",()=>{
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("mobileScrim").classList.toggle("show");
});
document.getElementById("mobileScrim").addEventListener("click",()=>{
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileScrim").classList.remove("show");
});

drawWheel();
renderDeck();
initSupabaseAuth();
