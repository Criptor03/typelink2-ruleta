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
let isAdmin = false;
let adminAccessChecked = false;
let activeSessionUserId = null;
let inventoryChannel = null;
let profilesChannel = null;
let activityChannel = null;
let notificationChannel = null;
let notificationCache = [];
let currentTramo = 0;
let tramoSpinsRemaining = 0;
let bonusTramoSpinsRemaining = 0;
let rouletteAccessByPool = {legendary:0,fiesta:0};
let cloudMode = false;
let cloudDeck = [];
let cloudRoute = [];
let cloudSpecial = [];
let cloudInventory = [];
let wheelPoolSlug = "demo";
let evolutionRulesBySource = Object.create(null);
let cardEffectsById = Object.create(null);
let pendingCardAction = null;
let demoDeck = loadDeck();
let demoRouteState = loadRouteState();
let rotation = 0;
let spinning = false;
let normalCardLimit = 5;
let cardsPerTramo = 2;
let normalSpinsPerTramo = 3;
let playerTypeStatus = Object.create(null);
let incomingCardEffects = [];
const pendingTypeUpdates = new Set();
const cardArtImages = {};
let adminCatalogItems = [];
let adminEditingCardId = null;
let adminEditingImagePath = null;
let adminPendingImageFile = null;
let adminImageObjectUrl = null;
let adminTrainerItems = [];
let adminSelectedTrainerId = null;
let adminSelectedTrainerName = "";
let adminTrainerDetail = null;
let adminRoulettePools = [];
let adminSelectedRouletteSlug = null;
let adminMechanicsItems = [];
let adminSelectedMechanicsCardId = null;
let spinRewardResolver = null;

shuffleRouletteItems(CARDS);

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
  const size=canvas.width,center=size/2,radius=size/2-10;
  ctx.clearRect(0,0,size,size);
  const totalWeight=CARDS.reduce((sum,card)=>sum+Math.max(1,Number(card.weight||1)),0);
  let accumulatedWeight=0;
  CARDS.forEach((card,i)=>{
    const slice=totalWeight>0?TAU*Math.max(1,Number(card.weight||1))/totalWeight:0;
    const start=rotation-Math.PI/2+(accumulatedWeight/totalWeight)*TAU,end=start+slice;
    accumulatedWeight+=Math.max(1,Number(card.weight||1));
    ctx.beginPath();ctx.moveTo(center,center);ctx.arc(center,center,radius,start,end);ctx.closePath();
    ctx.fillStyle=i%2===0?"#e5e9ec":"#283541";ctx.fill();
    ctx.strokeStyle="#8f9aa3";ctx.lineWidth=3;ctx.stroke();
    const mid=start+slice/2,x=center+Math.cos(mid)*radius*.65,y=center+Math.sin(mid)*radius*.65;
    ctx.save();ctx.translate(x,y);
    const image=cardArtImages[card.id];
    if(image&&image.complete&&image.naturalWidth){
      ctx.shadowColor="#000";ctx.shadowBlur=9;ctx.drawImage(image,-31,-46.5,62,93);ctx.shadowBlur=0;
      ctx.strokeStyle="#f1f4f6";ctx.lineWidth=2;ctx.strokeRect(-31,-46.5,62,93);
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
      const allowsNoEffect=card.allow_no_effect_play===true;
      actionButton.className="deck-action-button use";
      actionButton.textContent=hasEffects?"USAR":allowsNoEffect?"LANZAR":"PENDIENTE";
      actionButton.disabled=!hasEffects&&!allowsNoEffect;
      actionButton.title=hasEffects
        ?"Usar esta carta"
        :allowsNoEffect
          ?"Lanzar sin efecto automático."
          :"Sin efectos ni permiso de uso manual.";
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
  renderCardItems(normal,document.getElementById("deckList"),"Sin cartas todavía.");
  renderCardItems(normal,document.getElementById("deckListFull"),"Sin cartas todavía.",true);
  renderRouteItems(route,document.getElementById("routeListFull"),true);
  renderCardItems(special,document.getElementById("specialListFull"),"Sin cartas especiales.",true);

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
  setText("homeDeckHint",normalCount?("Tienes "+normalCount+" de "+normalCardLimit+" cartas normales disponibles."):"Sin cartas todavía.");
  setText("profileNormalCount",normalCount+"/"+normalCardLimit);
  setText("profileRouteCount",route.length);

  const resetButton=document.getElementById("resetButton");
  if(resetButton)resetButton.hidden=cloudMode;

  const totalSpins=Math.max(0,tramoSpinsRemaining)+Math.max(0,bonusTramoSpinsRemaining);
  const freeSlots=Math.max(0,normalCardLimit-normalCount);
  const pendingSpins=totalSpins>0;
  spinButton.disabled=spinning||!currentAuthUser||pendingSpins===false||normalCount>=normalCardLimit;
  const shuffleWheelButton=document.getElementById("shuffleWheelButton");
  if(shuffleWheelButton)shuffleWheelButton.disabled=spinning||CARDS.length<2;
  spinButton.querySelector("span").textContent=
    !currentAuthUser?"INICIA SESIÓN":
    spinning?"CONECTANDO...":
    normalCount>=normalCardLimit?"BARAJA COMPLETA":
    totalSpins<=0?"SIN GIROS DISPONIBLES":"GIRAR RULETA";
  setText("spinHint",!currentAuthUser
    ?"Inicia sesión para girar."
    :normalCount>=normalCardLimit
      ?"Baraja completa. Libera un espacio para continuar."
      :totalSpins<=0
        ?"Sin giros. Avanza de tramo para recibir "+normalSpinsPerTramo+" giros."
        :"Cada giro entrega 1 carta.");
  setText("spinBudget",currentAuthUser
    ?("GIROS DEL TRAMO: "+tramoSpinsRemaining+" · EXTRA: "+bonusTramoSpinsRemaining)
    :"INICIA SESIÓN PARA VER TUS GIROS");

  let tramoHint="";
  if(!currentAuthUser){
    tramoHint="Inicia sesión para avanzar.";
  }else if(pendingSpins){
    tramoHint="Tienes "+totalSpins+" giros pendientes. Úsalos antes de avanzar.";
  }else if(freeSlots<normalSpinsPerTramo){
    tramoHint="Libera al menos "+normalSpinsPerTramo+" espacio(s) antes de avanzar.";
  }else{
    tramoHint="Listo para avanzar: recibirás "+cardsPerTramo+" cartas de tramo y "+normalSpinsPerTramo+" giros.";
  }
  setText("tramoProgressHint",tramoHint);
  setText("tramoProgressCount","TRAMO "+currentTramo+" · GIROS "+tramoSpinsRemaining+" NORMALES · "+bonusTramoSpinsRemaining+" EXTRA");
  ["tramoButton","tramoButtonFull"].forEach(id=>{
    const button=document.getElementById(id);
    if(!button)return;
    button.disabled=spinning||!currentAuthUser||pendingSpins||freeSlots<normalSpinsPerTramo;
    button.textContent=currentTramo>0?"AVANZAR DE TRAMO":"INICIAR PRIMER TRAMO";
    button.title=tramoHint;
  });

  setText("deckCloudNote",cloudMode
    ?"Baraja sincronizada."
    :"Inicia sesión para sincronizar.");
  updateSpecialRouletteAccessUI();
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
function showSpinReward(card){
  const modal=document.getElementById("spinRewardModal");
  const image=document.getElementById("spinRewardImage");
  image.src=cardImage(card)||"";
  image.alt=card.name||"Carta obtenida";
  setText("spinRewardName",card.name||"Carta TypeLink");
  setText("spinRewardRarity",String(card.rarity||"Carta TypeLink").toUpperCase());
  setText("spinRewardDescription",card.description||"Una nueva carta se ha unido a tu baraja.");
  modal.hidden=false;
  document.getElementById("spinRewardAccept").focus();
  return new Promise(resolve=>{spinRewardResolver=resolve;});
}
function closeSpinReward(){
  const modal=document.getElementById("spinRewardModal");
  if(modal)modal.hidden=true;
  if(spinRewardResolver){
    const resolve=spinRewardResolver;
    spinRewardResolver=null;
    resolve();
  }
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
    ?"Cuenta conectada."
    :"Inicia sesión para guardar tu perfil y baraja.");
  setText("homeProfileStatus",currentAuthUser?"CONECTADO":"SIN SESIÓN");
  setText("homeProfileHandle",currentAuthUser?"ENTRENADOR · "+(metadata.preferred_username||metadata.user_name||displayName).toUpperCase():"ENTRENADOR");
  setText("homeProfileSince",currentProfile?.created_at?("Miembro desde "+formatDate(currentProfile.created_at)):"Conecta Discord.");
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
    const empty=document.createElement("div");empty.className="profile-module-empty";empty.textContent="Inicia sesión para editar tus tipos.";container.append(empty);
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
    const empty=document.createElement("div");empty.className="profile-module-empty";empty.textContent="Inicia sesión para ver tus efectos.";container.append(empty);return;
  }
  if(!groups.length){
    const empty=document.createElement("div");empty.className="profile-module-empty";empty.textContent="Sin efectos activos.";container.append(empty);return;
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
    const caster=document.createElement("p");caster.className="incoming-effect-caster";caster.textContent="De "+(group.casterName||"otro entrenador");
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
    allow_no_effect_play:joined.allow_no_effect_play===true,
    source:row.source,
    tramo_number:row.tramo_number,
    status:row.status,
    obtained_at:row.obtained_at
  };
}

async function loadCardEngineConfig(){
  if(!authClient||!currentAuthUser)return;
  const [rulesResult,effectsResult,settingsResult,playerEffectsResult,progressResult]=await Promise.all([
    authClient.from("card_evolution_rules").select("id,slug,name,description,source_card_id,result_card_id,same_tramo_only,trigger_type").eq("is_active",true).eq("trigger_type","manual"),
    authClient.from("card_effects").select("id,card_id,effect_key,operation,effect_value,parameters,duration_type,duration_value,duration_unit").eq("is_active",true),
    authClient.from("event_settings").select("normal_card_limit,current_tramo,cards_per_tramo,normal_spins_per_tramo").eq("singleton",true).single(),
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
    cardsPerTramo=Math.max(1,Number(settingsResult.data.cards_per_tramo)||2);
    normalSpinsPerTramo=Math.max(1,Number(settingsResult.data.normal_spins_per_tramo)||3);
  }else{
    normalCardLimit=5;
    cardsPerTramo=2;
    normalSpinsPerTramo=3;
  }
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
    .select("id,card_id,source,tramo_number,status,remaining_uses,obtained_at,card_catalog(id,slug,name,category,rarity,description,image_path,uses_per_card,target_scope,disposition,counts_toward_normal_limit,allow_no_effect_play)")
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
function activityTargetLabel(entry,details,targetName){
  if(entry.target_id&&entry.target_id!==entry.actor_id)return "PARA "+targetName;
  if(entry.target_id===entry.actor_id)return "USO PROPIO";
  if(details.target_scope==="all_players")return "PARA TODOS LOS ENTRENADORES";
  return "CONSUMO PROPIO";
}

function openActivityCardPreview(imagePath,cardName,rarity,trigger){
  if(!imagePath)return;
  const modal=document.getElementById("activityCardModal");
  const image=document.getElementById("activityCardModalImage");
  if(!modal||!image)return;
  activityCardModalTrigger=trigger||null;
  image.src=imagePath;
  image.alt=cardName||"Carta TypeLink";
  setText("activityCardModalName",cardName||"Carta TypeLink");
  setText("activityCardModalRarity",rarity||"CARTA TYPELINK");
  modal.hidden=false;
  document.getElementById("closeActivityCardModal")?.focus();
}

function closeActivityCardPreview(){
  const modal=document.getElementById("activityCardModal");
  const image=document.getElementById("activityCardModalImage");
  if(modal)modal.hidden=true;
  if(image){image.removeAttribute("src");image.alt="";}
  if(activityCardModalTrigger?.isConnected)activityCardModalTrigger.focus();
  activityCardModalTrigger=null;
}

let activityCardModalTrigger=null;

function renderActivityFeed(entries,profiles){
  const container=document.getElementById("activityFeed");
  if(!container)return;
  container.replaceChildren();
  if(!entries.length){
    container.append(makeActivityPlaceholder("Sin cartas todavía."));
    return;
  }
  entries.forEach(entry=>{
    const details=entry.details&&typeof entry.details==="object"?entry.details:{};
    const actor=profiles[entry.actor_id]||{};
    const target=profiles[entry.target_id]||{};
    const actorName=actor.display_name||"Entrenador";
    const targetName=target.display_name||"otro entrenador";
    const cardName=details.card_name||details.name||"Carta TypeLink";
    const rarity=details.rarity||"Carta TypeLink";
    const imagePath=details.image_path||"";
    const targetLabel=activityTargetLabel(entry,details,targetName);

    const item=document.createElement("article");
    item.className="activity-item activity-chat-item panel";

    const avatar=document.createElement("div");
    avatar.className="activity-avatar";
    if(actor.avatar_url){
      const avatarImage=document.createElement("img");
      avatarImage.src=actor.avatar_url;
      avatarImage.alt="";
      avatar.append(avatarImage);
    }else{
      avatar.textContent=initials(actorName);
    }

    const body=document.createElement("div");
    body.className="activity-body";

    const header=document.createElement("div");
    header.className="activity-header";
    const who=document.createElement("strong");
    who.textContent=actorName;
    const when=document.createElement("time");
    const date=new Date(entry.created_at);
    when.textContent=Number.isNaN(date.getTime())?"":date.toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"});
    header.append(who,when);

    const customMessage=typeof details.custom_message==="string"?details.custom_message.trim():"";
    const bubble=document.createElement("div");
    bubble.className="activity-chat-bubble"+(customMessage?"":" is-automatic");
    const bubbleText=document.createElement("p");
    bubbleText.textContent=customMessage||(
      entry.target_id&&entry.target_id!==entry.actor_id
        ?"Ha lanzado una carta a "+targetName+"."
        :targetLabel==="PARA TODOS LOS ENTRENADORES"
          ?"Ha lanzado una carta para todos."
          :"Ha usado una carta para sí mismo."
    );
    bubble.append(bubbleText);

    const recipient=document.createElement("div");
    recipient.className="activity-recipient";
    recipient.textContent=targetLabel;

    const cardPreview=imagePath?document.createElement("button"):document.createElement("div");
    cardPreview.className="activity-card-preview"+(imagePath?"":" is-no-image");
    if(imagePath){
      cardPreview.type="button";
      cardPreview.title="Toca para ampliar la carta";
      cardPreview.setAttribute("aria-label","Ampliar "+cardName);
      cardPreview.dataset.imagePath=imagePath;
      cardPreview.dataset.cardName=cardName;
      cardPreview.dataset.cardRarity=rarity;

      const cardImageEl=document.createElement("img");
      cardImageEl.className="activity-card-preview-image";
      cardImageEl.src=imagePath;
      cardImageEl.alt=cardName;
      cardPreview.append(cardImageEl);
    }else{
      const missingArt=document.createElement("span");
      missingArt.className="activity-card-preview-placeholder";
      missingArt.textContent="▧";
      cardPreview.append(missingArt);
    }

    const cardCopy=document.createElement("div");
    cardCopy.className="activity-card-preview-copy";
    const cardLabel=document.createElement("small");
    cardLabel.textContent="CARTA LANZADA";
    const cardTitle=document.createElement("strong");
    cardTitle.textContent=cardName;
    const cardMeta=document.createElement("span");
    cardMeta.textContent=rarity.toUpperCase()+(details.category?" · "+String(details.category).toUpperCase():"");
    const cardAction=document.createElement("span");
    cardAction.className="activity-card-preview-action";
    cardAction.textContent=imagePath?"VER CARTA ↗":"SIN ILUSTRACIÓN";
    cardCopy.append(cardLabel,cardTitle,cardMeta,cardAction);
    cardPreview.append(cardCopy);

    body.append(header,bubble,recipient,cardPreview);
    item.append(avatar,body);
    container.append(item);
  });
}

async function loadActivityFeed(){
  const container=document.getElementById("activityFeed");
  if(!container)return;
  if(!currentAuthUser||!authClient){
    container.replaceChildren(makeActivityPlaceholder("Inicia sesión para ver el chat."));
    return;
  }
  const {data,error}=await authClient.from("card_activity")
    .select("id,actor_id,target_id,activity_type,details,created_at")
    .eq("activity_type","play")
    .order("created_at",{ascending:false})
    .limit(80);
  if(error){
    console.error("No se pudo cargar el muro de cartas:",error.message);
    container.replaceChildren(makeActivityPlaceholder("No pudimos cargar el chat de cartas. Inténtalo de nuevo."));
    return;
  }
  const visibleEntries=(data||[]).filter(entry=>{
    const details=entry.details&&typeof entry.details==="object"?entry.details:{};
    const hasPlayerTarget=Boolean(entry.target_id);
    const affectsAllPlayers=details.target_scope==="all_players";
    const personalConsumption=details.disposition==="consume"&&details.target_scope!=="event";
    return hasPlayerTarget||affectsAllPlayers||personalConsumption;
  });
  const profileIds=[...new Set(visibleEntries.flatMap(row=>[row.actor_id,row.target_id]).filter(Boolean))];
  let profiles={};
  if(profileIds.length){
    const result=await authClient.from("profiles").select("id,display_name,avatar_url").in("id",profileIds);
    if(!result.error)profiles=Object.fromEntries((result.data||[]).map(profile=>[profile.id,profile]));
  }
  renderActivityFeed(visibleEntries,profiles);
}

function setNotificationBadge(count){
  const badge=document.getElementById("navNotificationCount");
  if(!badge)return;
  const total=Math.max(0,Number(count)||0);
  badge.hidden=total===0;
  badge.textContent=total>99?"99+":String(total);
  badge.setAttribute("aria-label",total+" notificaciones sin leer");
}
function notificationDate(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":date.toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"});
}
function notificationPlaceholder(message){
  const box=document.createElement("div");
  box.className="activity-empty panel";
  box.textContent=message;
  return box;
}
function renderNotifications(rows,profiles,unreadCount){
  const container=document.getElementById("notificationsList");
  if(!container)return;
  container.replaceChildren();
  const unread=Math.max(0,Number(unreadCount)||0);
  setText("notificationsTotal",rows.length+" "+(rows.length===1?"NOTIFICACIÓN":"NOTIFICACIONES"));
  setText("notificationsUnreadLabel",unread
    ? "Tienes "+unread+" "+(unread===1?"aviso sin leer.":"avisos sin leer.")
    : "Tu bandeja está al día.");
  const markAll=document.getElementById("markAllNotificationsRead");
  if(markAll)markAll.disabled=unread===0;
  if(!rows.length){
    container.append(notificationPlaceholder("Sin notificaciones."));
    return;
  }
  rows.forEach(notification=>{
    const payload=notification.payload&&typeof notification.payload==="object"?notification.payload:{};
    const actor=profiles[notification.actor_id]||{};
    const actorName=actor.display_name||"Entrenador";
    const unreadItem=!notification.read_at;
    const item=document.createElement("article");
    item.className="notification-item panel"+(unreadItem?" unread":"");

    const avatar=document.createElement("div");
    avatar.className="notification-avatar";
    applyAvatar(avatar,actor.avatar_url,initials(actorName));

    const content=document.createElement("div");
    content.className="notification-content";

    const header=document.createElement("div");
    header.className="notification-header";
    const identity=document.createElement("div");
    identity.className="notification-identity";
    const name=document.createElement("strong");
    name.textContent=actorName;
    const state=document.createElement("span");
    state.className="notification-state"+(unreadItem?" unread":"");
    state.textContent=unreadItem?"SIN LEER":"LEÍDA";
    identity.append(name,state);
    const time=document.createElement("time");
    time.textContent=notificationDate(notification.created_at);
    header.append(identity,time);

    const title=document.createElement("h3");
    title.className="notification-title";
    title.textContent=notification.title||"Nueva notificación";
    const body=document.createElement("p");
    body.className="notification-body";
    body.textContent=notification.body||"Un entrenador ha utilizado una carta sobre ti.";

    content.append(header,title,body);

    const cardName=payload.card_name||"Carta TypeLink";
    const cardRow=document.createElement("div");
    cardRow.className="notification-card-row";
    if(payload.image_path){
      const image=document.createElement("img");
      image.className="notification-card-image";
      image.src=payload.image_path;
      image.alt=cardName;
      image.loading="lazy";
      cardRow.append(image);
    }
    const cardMeta=document.createElement("div");
    cardMeta.className="notification-card-meta";
    const cardTitle=document.createElement("strong");
    cardTitle.textContent=cardName;
    const rarity=document.createElement("small");
    rarity.textContent=[payload.rarity,payload.category].filter(Boolean).join(" · ")||"Carta utilizada";
    cardMeta.append(cardTitle,rarity);
    cardRow.append(cardMeta);
    content.append(cardRow);

    if(typeof payload.custom_message==="string"&&payload.custom_message.trim()){
      const note=document.createElement("div");
      note.className="notification-custom-note";
      const label=document.createElement("span");
      label.className="notification-custom-label";
      label.textContent="MENSAJE DEL ENTRENADOR";
      const message=document.createElement("p");
      message.textContent=payload.custom_message;
      note.append(label,message);
      content.append(note);
    }

    const footer=document.createElement("div");
    footer.className="notification-footer";
    const date=document.createElement("span");
    date.textContent=notificationDate(notification.created_at);
    footer.append(date);
    if(unreadItem){
      const readButton=document.createElement("button");
      readButton.type="button";
      readButton.className="notification-read-button";
      readButton.textContent="MARCAR COMO LEÍDA";
      readButton.addEventListener("click",()=>markNotificationAsRead(notification.id,readButton));
      footer.append(readButton);
    }
    content.append(footer);
    item.append(avatar,content);
    container.append(item);
  });
}
async function loadNotifications(){
  const container=document.getElementById("notificationsList");
  if(!currentAuthUser||!authClient){
    setNotificationBadge(0);
    setText("notificationsTotal","0 NOTIFICACIONES");
    setText("notificationsUnreadLabel","Inicia sesión para ver tus avisos.");
    const markAll=document.getElementById("markAllNotificationsRead");
    if(markAll)markAll.disabled=true;
    if(container)container.replaceChildren(notificationPlaceholder("Inicia sesión para ver tus avisos."));
    return;
  }
  const [listResult,unreadResult]=await Promise.all([
    authClient.from("notifications")
      .select("id,actor_id,notification_type,title,body,payload,read_at,created_at")
      .order("created_at",{ascending:false})
      .limit(60),
    authClient.from("notifications")
      .select("id",{count:"exact",head:true})
      .is("read_at",null)
  ]);
  if(listResult.error){
    console.error("No se pudieron cargar las notificaciones:",listResult.error.message);
    if(container)container.replaceChildren(notificationPlaceholder("No pudimos cargar tus notificaciones. Inténtalo de nuevo."));
    return;
  }
  notificationCache=listResult.data||[];
  const unreadCount=unreadResult.error?notificationCache.filter(item=>!item.read_at).length:Number(unreadResult.count||0);
  if(unreadResult.error)console.warn("No se pudo actualizar el contador de notificaciones:",unreadResult.error.message);
  setNotificationBadge(unreadCount);

  const actorIds=[...new Set(notificationCache.map(item=>item.actor_id).filter(Boolean))];
  let profiles={};
  if(actorIds.length){
    const result=await authClient.from("profiles")
      .select("id,display_name,avatar_url")
      .in("id",actorIds);
    if(!result.error)profiles=Object.fromEntries((result.data||[]).map(profile=>[profile.id,profile]));
    else console.warn("No se pudieron cargar los perfiles de las notificaciones:",result.error.message);
  }
  renderNotifications(notificationCache,profiles,unreadCount);
}
async function markNotificationAsRead(notificationId,button){
  if(!authClient||!currentAuthUser||!notificationId)return;
  if(button){button.disabled=true;button.textContent="GUARDANDO...";}
  const {error}=await authClient.from("notifications")
    .update({read_at:new Date().toISOString()})
    .eq("id",notificationId)
    .eq("recipient_id",currentAuthUser.id)
    .is("read_at",null);
  if(error){
    console.error("No se pudo marcar la notificación como leída:",error.message);
    if(button){button.disabled=false;button.textContent="MARCAR COMO LEÍDA";}
    notify("No se pudo actualizar la notificación.");
    return;
  }
  await loadNotifications();
}
async function markAllNotificationsRead(){
  if(!authClient||!currentAuthUser)return;
  const button=document.getElementById("markAllNotificationsRead");
  if(button){button.disabled=true;button.textContent="GUARDANDO...";}
  const {error}=await authClient.from("notifications")
    .update({read_at:new Date().toISOString()})
    .eq("recipient_id",currentAuthUser.id)
    .is("read_at",null);
  if(error){
    console.error("No se pudieron marcar las notificaciones como leídas:",error.message);
    notify("No se pudieron actualizar las notificaciones.");
  }else{
    await loadNotifications();
    notify("Todas tus notificaciones están marcadas como leídas.");
  }
  if(button)button.textContent="MARCAR TODO COMO LEÍDO";
}

async function loadPlayers(){
  const container=document.getElementById("playersList");
  if(!container)return;
  container.replaceChildren();
  if(!currentAuthUser){
    const empty=document.createElement("div");empty.className="empty-feature panel";
    const icon=document.createElement("div");icon.className="empty-emblem";icon.textContent="♙";
    const title=document.createElement("h2");title.textContent="Inicia sesión para ver los participantes.";
    const body=document.createElement("p");body.textContent="";
    empty.append(icon,title,body);container.append(empty);setText("playersCount","0 ENTRENADORES");return;
  }
  const loading=document.createElement("div");loading.className="players-loading";loading.textContent="Cargando participantes...";container.append(loading);
  const {data:profiles,error}=await authClient.from("profiles")
    .select("id,display_name,avatar_url,created_at")
    .order("created_at",{ascending:true});
  if(error){
    console.error("No se pudieron cargar los jugadores:",error.message);
    container.replaceChildren();const message=document.createElement("div");message.className="empty-feature panel";message.textContent="No se pudo cargar la lista.";container.append(message);return;
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
    const empty=document.createElement("div");empty.className="empty-feature panel";empty.textContent="Sin participantes todavía.";container.append(empty);return;
  }
  profiles.forEach(profile=>{
    const displayName=profile.display_name||"Entrenador";
    const card=document.createElement("button");
    card.type="button";
    card.className="player-directory-card";
    card.setAttribute("aria-label","Abrir perfil de "+displayName);
    const avatar=document.createElement("div");avatar.className="player-directory-avatar";
    applyAvatar(avatar,profile.avatar_url,displayName.slice(0,2).toUpperCase());
    const info=document.createElement("div");info.className="player-directory-info";
    const name=document.createElement("strong");name.textContent=displayName;
    const since=document.createElement("small");since.textContent="Desde "+formatDate(profile.created_at);
    info.append(name,since);
    const stats=document.createElement("div");stats.className="player-directory-stats";
    const normal=document.createElement("span");normal.textContent=(counts.normal[profile.id]||0)+" normales";
    const tramo=document.createElement("span");tramo.textContent=(counts.tramo[profile.id]||0)+" tramo";
    stats.append(normal,tramo);
    const action=document.createElement("span");action.className="player-view-button";action.textContent="VER PERFIL ↗";
    card.append(avatar,info,stats,action);
    card.addEventListener("click",()=>showPublicPlayer(profile.id));
    container.append(card);
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
    const empty=document.createElement("div");empty.className="deck-empty";empty.textContent="Sin cartas todavía.";container.append(empty);
  }else{
    items.forEach((item,index)=>container.append(createDeckItem(item,index,item.category==="tramo")));
  }
  modal.hidden=false;
}
function closePublicPlayer(){document.getElementById("publicProfileModal").hidden=true;}



let cardActionTargetProfiles=Object.create(null);
let cardActionTargetPreviewRequest=0;

function setCardActionTargetProfile(profile){
  const wrap=document.getElementById("cardActionTargetProfile");
  const image=document.getElementById("cardActionTargetAvatar");
  const initials=document.getElementById("cardActionTargetInitials");
  if(!wrap)return;
  if(!profile){
    wrap.hidden=true;
    if(image){image.hidden=true;image.removeAttribute("src");}
    return;
  }
  wrap.hidden=false;
  const name=profile.display_name||"Entrenador";
  setText("cardActionTargetName",name);
  if(initials)initials.textContent=initialsForTrainer(name);
  if(image&&profile.avatar_url){
    image.src=profile.avatar_url;
    image.alt="";
    image.hidden=false;
    if(initials)initials.hidden=true;
    image.onerror=()=>{image.hidden=true;if(initials)initials.hidden=false;};
  }else{
    if(image){image.hidden=true;image.removeAttribute("src");}
    if(initials)initials.hidden=false;
  }
  setText("cardActionTargetEffectCount","…");
  setText("cardActionTargetStatus","CONSULTANDO");
}

function initialsForTrainer(name){
  return String(name||"TL").trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase()||"TL";
}

async function refreshCardActionTargetProfile(profile){
  const request=++cardActionTargetPreviewRequest;
  if(!profile){
    setCardActionTargetProfile(null);
    return;
  }
  setCardActionTargetProfile(profile);
  try{
    const {data,error}=await authClient.rpc("get_trainer_active_card_effect_count",{
      p_trainer_id:profile.id
    });
    if(request!==cardActionTargetPreviewRequest)return;
    if(error)throw error;
    const count=Number(data);
    if(!Number.isInteger(count)||count<0)throw new Error("El servidor devolvió un contador no válido.");
    setText("cardActionTargetEffectCount",count);
    setText("cardActionTargetStatus","EFECTOS ACTIVOS");
  }catch(error){
    if(request!==cardActionTargetPreviewRequest)return;
    console.warn("No se pudo consultar el contador de efectos del entrenador:",error.message);
    setText("cardActionTargetEffectCount","—");
    setText("cardActionTargetStatus","NO DISPONIBLE");
  }
}

async function openCardAction(instanceId,mode){
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord para gestionar tus cartas.");return;}
  const card=cloudInventory.find(item=>item.instance_id===instanceId);
  if(!card||card.status!=="available"||card.remaining_uses<=0){notify("Esta carta ya no tiene usos disponibles.");return;}

  const modal=document.getElementById("cardActionModal");
  const targetWrap=document.getElementById("cardActionTargetWrap");
  const resultPreview=document.getElementById("cardActionResultPreview");
  const targetSelect=document.getElementById("cardActionTarget");
  const messageWrap=document.getElementById("cardActionMessageWrap");
  const messageInput=document.getElementById("cardActionMessage");
  const messageCount=document.getElementById("cardActionMessageCount");
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
  setCardActionTargetProfile(null);
  cardActionTargetProfiles=Object.create(null);
  cardActionTargetPreviewRequest++;
  feedback.textContent="";
  targetSelect.replaceChildren();
  targetSelect.onchange=null;
  if(messageInput)messageInput.value="";
  if(messageCount)messageCount.textContent="0";
  if(messageWrap)messageWrap.hidden=mode!=="use";
  if(messageInput){
    messageInput.oninput=()=>{if(messageCount)messageCount.textContent=String(messageInput.value.length);};
  }

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
    const noAutomaticEffect=mode==="use"
      &&card.allow_no_effect_play===true
      &&!cardEffectsById[card.card_id]?.length;
    setText("cardActionEyebrow",transfer
      ?"TRANSFERENCIA DE CARTA"
      :noAutomaticEffect?"CARTA SIN EFECTO AUTOMÁTICO":"USO DE CARTA");
    setText("cardActionTitle",transfer
      ?"Transferir carta"
      :noAutomaticEffect?"Lanzar carta":"Usar carta");
    setText("cardActionArrow",transfer?"⇢":noAutomaticEffect?"↗":"✦");
    setText("cardActionDescription",transfer
      ?"La carta pasará al inventario del entrenador."
      :noAutomaticEffect
        ?"No aplica efectos automáticos. Se registra en el muro, notifica al objetivo y consume una carga."
        :"Activa su efecto y consume una carga por uso.");
    confirmButton.textContent=transfer
      ?"CONFIRMAR TRANSFERENCIA"
      :noAutomaticEffect?"LANZAR CARTA":"USAR CARTA";

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
          .select("id,display_name,avatar_url").order("display_name",{ascending:true});
        if(error)throw error;
        (data||[]).forEach(profile=>{
          cardActionTargetProfiles[profile.id]=profile;
          if(profile.id===currentAuthUser.id)return;
          const option=document.createElement("option");
          option.value=profile.id;option.textContent=profile.display_name||"Entrenador";
          targetSelect.append(option);
        });
        targetSelect.onchange=()=>{
          const selectedId=targetSelect.value||(
            card.target_scope==="either"&&mode!=="transfer"?currentAuthUser.id:null
          );
          const selectedProfile=selectedId?cardActionTargetProfiles[selectedId]:null;
          if(mode==="use"||mode==="transfer")void refreshCardActionTargetProfile(selectedProfile);
          else setCardActionTargetProfile(null);
        };
        if(card.target_scope==="either"&&mode!=="transfer"){
          targetSelect.value="";
          void refreshCardActionTargetProfile(cardActionTargetProfiles[currentAuthUser.id]||null);
        }else if(targetSelect.options.length>1){
          targetSelect.selectedIndex=1;
          targetSelect.dispatchEvent(new Event("change"));
        }else{
          setCardActionTargetProfile(null);
          if(card.target_scope==="opponent"||mode==="transfer"){
            confirmButton.disabled=true;
            feedback.textContent="Todavía no hay otro entrenador disponible para seleccionar.";
          }
        }
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
  cardActionTargetPreviewRequest++;
  setCardActionTargetProfile(null);
  pendingCardAction=null;
  const button=document.getElementById("confirmCardAction");
  if(button){button.disabled=false;button.textContent="CONFIRMAR";}
  const messageInput=document.getElementById("cardActionMessage");
  const messageCount=document.getElementById("cardActionMessageCount");
  if(messageInput)messageInput.value="";
  if(messageCount)messageCount.textContent="0";
}

async function confirmCardAction(){
  if(!pendingCardAction||!authClient||!currentAuthUser)return;
  const {instanceId,mode,card}=pendingCardAction;
  const button=document.getElementById("confirmCardAction");
  const targetSelect=document.getElementById("cardActionTarget");
  const feedback=document.getElementById("cardActionFeedback");
  const messageInput=document.getElementById("cardActionMessage");
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

  const customMessage=mode==="use"?(messageInput?.value||"").trim():"";

  button.disabled=true;button.textContent="PROCESANDO...";
  feedback.textContent="Validando la acción en el servidor...";
  try{
    const rpcName=mode==="evolve"?"evolve_card":mode==="use"?"play_card_with_message":"play_card";
    const args=mode==="evolve"
      ?{p_card_instance_id:instanceId}
      :mode==="use"
        ?{p_card_instance_id:instanceId,p_target_id:targetId,p_custom_message:customMessage||null}
        :{p_card_instance_id:instanceId,p_target_id:targetId};
    const {data,error}=await authClient.rpc(rpcName,args);
    if(error)throw error;
    closeCardAction();
    await loadCloudInventory();
    if(mode==="use")await loadRouletteAccess();
    await loadActivityFeed();

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
      const unlock=Array.isArray(data.roulette_unlocks)?data.roulette_unlocks[0]:null;
      if(unlock){
        const poolName=unlock.pool_slug==="legendary"?"Ruleta Legendaria":"Ruleta Fiesta";
        const granted=Number(unlock.spins_granted||1);
        notify("¡"+card.name+" canjeada! Has desbloqueado "+granted+" "+(granted===1?"giro":"giros")+" en "+poolName+".");
      }else{
        const remaining=Number(data.remaining_uses??0);
        notify(remaining>0
          ?"¡"+card.name+" utilizada! Te quedan "+remaining+" usos."
          :"¡"+card.name+" agotó todos sus usos!");
      }
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
  if(notificationChannel)authClient.removeChannel(notificationChannel);
  inventoryChannel=authClient.channel("typelink-player-cards-"+currentAuthUser.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"player_cards",filter:"owner_id=eq."+currentAuthUser.id},()=>{if(!spinning)loadCloudInventory();})
    .subscribe();
  profilesChannel=authClient.channel("typelink-public-profiles")
    .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>loadPlayers())
    .subscribe();
  activityChannel=authClient.channel("typelink-community-activity")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"card_activity"},()=>loadActivityFeed())
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"card_activity"},()=>loadActivityFeed())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_tramo_progress",filter:"owner_id=eq."+currentAuthUser.id},()=>{if(!spinning)loadCloudInventory();})
    .on("postgres_changes",{event:"*",schema:"public",table:"player_effects",filter:"owner_id=eq."+currentAuthUser.id},()=>loadProfileMechanics())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_type_status",filter:"owner_id=eq."+currentAuthUser.id},()=>loadProfileMechanics())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_roulette_unlocks",filter:"owner_id=eq."+currentAuthUser.id},()=>loadRouletteAccess())
    .subscribe();
  notificationChannel=authClient.channel("typelink-private-notifications-"+currentAuthUser.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"recipient_id=eq."+currentAuthUser.id},()=>loadNotifications())
    .subscribe();
}

function renderAdminAccess(){
  const nav=document.getElementById("adminNavLink");
  const label=document.getElementById("adminSectionLabel");
  if(nav)nav.hidden=!isAdmin;
  if(label)label.hidden=!isAdmin;
  setText("adminAccountName",currentProfile?.display_name||currentAuthUser?.user_metadata?.global_name||currentAuthUser?.email||"Administrador");
  setText("adminAccountProvider",isAdmin?"Discord · Permiso verificado por Supabase":"Acceso administrativo no disponible");
}

function showAdminOverview(){
  const overview=document.getElementById("adminOverview");
  const catalogWorkspace=document.getElementById("adminCatalogWorkspace");
  const trainersWorkspace=document.getElementById("adminTrainersWorkspace");
  const rouletteWorkspace=document.getElementById("adminRouletteWorkspace");
  const mechanicsWorkspace=document.getElementById("adminMechanicsWorkspace");
  const progressionWorkspace=document.getElementById("adminProgressionWorkspace");
  const platformWorkspace=document.getElementById("adminPlatformWorkspace");
  if(overview)overview.hidden=false;
  if(catalogWorkspace)catalogWorkspace.hidden=true;
  if(trainersWorkspace)trainersWorkspace.hidden=true;
  if(rouletteWorkspace)rouletteWorkspace.hidden=true;
  if(mechanicsWorkspace)mechanicsWorkspace.hidden=true;
  if(progressionWorkspace)progressionWorkspace.hidden=true;
  if(platformWorkspace)platformWorkspace.hidden=true;
  const list=document.getElementById("adminCatalogListView");
  const editor=document.getElementById("adminCardEditorView");
  const trainerList=document.getElementById("adminTrainersListView");
  const trainerDetail=document.getElementById("adminTrainerDetailView");
  const rouletteList=document.getElementById("adminRouletteListView");
  const rouletteEditor=document.getElementById("adminRouletteEditorView");
  const mechanicsList=document.getElementById("adminMechanicsListView");
  const mechanicsEditor=document.getElementById("adminMechanicsEditorView");
  if(list)list.hidden=false;
  if(editor)editor.hidden=true;
  if(trainerList)trainerList.hidden=false;
  if(trainerDetail)trainerDetail.hidden=true;
  if(rouletteList)rouletteList.hidden=false;
  if(rouletteEditor)rouletteEditor.hidden=true;
  if(mechanicsList)mechanicsList.hidden=false;
  if(mechanicsEditor)mechanicsEditor.hidden=true;
}
function showAdminCatalogList(){
  const list=document.getElementById("adminCatalogListView");
  const editor=document.getElementById("adminCardEditorView");
  if(list)list.hidden=false;
  if(editor)editor.hidden=true;
}
function showAdminTrainerList(){
  const list=document.getElementById("adminTrainersListView");
  const detail=document.getElementById("adminTrainerDetailView");
  if(list)list.hidden=false;
  if(detail)detail.hidden=true;
}
function renderAdminTrainers(){
  const grid=document.getElementById("adminTrainersGrid");
  if(!grid)return;
  const search=(document.getElementById("adminTrainersSearch")?.value||"").trim().toLowerCase();
  const filtered=adminTrainerItems.filter(trainer=>
    !search||String(trainer.display_name||"").toLowerCase().includes(search)
  );
  setText("adminTrainersTotal",adminTrainerItems.length);
  setText("adminTrainersCardsTotal",adminTrainerItems.reduce((sum,trainer)=>sum+Number(trainer.cards_total||0),0));
  setText("adminTrainersNormalTotal",adminTrainerItems.reduce((sum,trainer)=>sum+Number(trainer.normal_available||0),0));
  grid.replaceChildren();
  if(!filtered.length){
    const empty=document.createElement("div");empty.className="admin-catalog-loading";
    empty.textContent=adminTrainerItems.length?"Sin resultados.":"Sin participantes todavía.";
    grid.append(empty);return;
  }
  filtered.forEach(trainer=>{
    const article=document.createElement("article");article.className="admin-trainer-row panel";
    const avatar=document.createElement("div");avatar.className="admin-trainer-avatar small";
    applyAvatar(avatar,trainer.avatar_url,initials(trainer.display_name||"TL"));
    const identity=document.createElement("div");identity.className="admin-trainer-row-identity";
    const name=document.createElement("strong");name.textContent=trainer.display_name||"Entrenador";
    const since=document.createElement("small");since.textContent="Registrado el "+formatDate(trainer.created_at);
    identity.append(name,since);
    const meta=document.createElement("div");meta.className="admin-trainer-row-stats";
    const tramo=document.createElement("span");tramo.textContent="TRAMO "+Number(trainer.current_tramo||0);
    const cards=document.createElement("span");cards.textContent=Number(trainer.cards_available||0)+" DISPONIBLES / "+Number(trainer.cards_total||0)+" TOTAL";
    const spins=document.createElement("span");spins.textContent=Number(trainer.spins_remaining||0)+" GIROS · "+Number(trainer.bonus_spins_remaining||0)+" EXTRA";
    meta.append(tramo,cards,spins);
    const button=document.createElement("button");button.type="button";button.className="player-view-button admin-trainer-open";button.textContent="VER ENTRENADOR ↗";
    button.addEventListener("click",()=>openAdminTrainerDetail(trainer.id));
    article.append(avatar,identity,meta,button);grid.append(article);
  });
}
async function loadAdminTrainers(){
  const grid=document.getElementById("adminTrainersGrid");
  if(grid){grid.replaceChildren();const loading=document.createElement("div");loading.className="admin-catalog-loading";loading.textContent="Cargando participantes...";grid.append(loading);}
  if(!authClient||!currentAuthUser||!isAdmin){notify("No tienes permiso para consultar los entrenadores.");return;}
  try{
    const {data,error}=await authClient.rpc("admin_list_trainers");
    if(error)throw error;
    adminTrainerItems=Array.isArray(data)?data:[];
    renderAdminTrainers();
  }catch(error){
    console.error("No se pudo cargar la gestión de entrenadores:",error);
    if(grid){grid.replaceChildren();const message=document.createElement("div");message.className="admin-catalog-loading is-error";message.textContent="No se pudo cargar la lista: "+(error.message||"error desconocido");grid.append(message);}
  }
}
function adminTrainerDurationLabel(effect){
  if(effect.duration_type==="timed")return "Temporal · "+(effect.duration_value||"—")+" "+(effect.duration_unit||"horas");
  if(effect.duration_type==="charges")return "Por cargas · "+(effect.remaining_uses??effect.duration_value??"—")+" restantes";
  if(effect.duration_type==="tramo_end")return "Hasta el final del tramo";
  if(effect.duration_type==="next_tramo_end")return "Hasta el final del próximo tramo";
  if(effect.duration_type==="permanent")return "Permanente";
  return effect.duration_type||"Duración no indicada";
}
function renderAdminTrainerDetail(data){
  if(!data)return;
  const trainer=data.trainer||{};
  const progress=data.progress||{};
  const stats=data.stats||{};
  adminSelectedTrainerId=trainer.id||adminSelectedTrainerId;
  adminSelectedTrainerName=trainer.display_name||"Entrenador";
  setText("adminTrainerName",adminSelectedTrainerName);
  setText("adminTrainerSince","Entrenador desde "+formatDate(trainer.created_at));
  setText("adminTrainerUpdated","Última actualización: "+formatDate(progress.updated_at||trainer.updated_at));
  applyAvatar(document.getElementById("adminTrainerAvatar"),trainer.avatar_url,initials(adminSelectedTrainerName));
  setText("adminTrainerTramo",Number(progress.current_tramo||0));
  const tramoInput=document.getElementById("adminTrainerTramoInput");
  if(tramoInput)tramoInput.value=Number(progress.current_tramo||0);
  setText("adminTrainerSpins",Number(progress.spins_remaining||0));
  setText("adminTrainerBonusSpins",Number(progress.bonus_spins_remaining||0));
  setText("adminTrainerCardCount",Number(stats.cards_total||0));
  setText("adminTrainerInventoryCount",Number(stats.cards_total||0)+" CARTAS");
  const note="Límite de baraja normal: "+Number(stats.normal_available||0)+" / "+Number(data.normal_card_limit||5)+
    " · Cartas de tramo: "+Number(stats.tramo_available||0)+
    " · Fiesta: "+Number(stats.fiesta_available||0)+
    ". El vaciado de inventario no cambia estos avances ni los giros.";
  setText("adminTrainerProgressNote",note);

  const inventory=document.getElementById("adminTrainerInventory");
  inventory.replaceChildren();
  const cards=Array.isArray(data.inventory)?data.inventory:[];
  if(!cards.length){
    const empty=document.createElement("div");empty.className="admin-catalog-loading";
    empty.textContent="Sin cartas en el inventario.";
    inventory.append(empty);
  }else{
    cards.forEach(item=>{
      const card=item.card||{};
      const row=document.createElement("article");row.className="admin-trainer-card-item";
      const imageWrap=document.createElement("div");imageWrap.className="admin-trainer-card-image";
      if(card.image_path){
        const image=document.createElement("img");image.src=card.image_path;image.alt=card.name||"Carta";
        image.onerror=()=>{image.remove();const fallback=document.createElement("span");fallback.textContent="▧";imageWrap.append(fallback);};
        imageWrap.append(image);
      }else{
        const fallback=document.createElement("span");fallback.textContent="▧";imageWrap.append(fallback);
      }
      const body=document.createElement("div");body.className="admin-trainer-card-body";
      const title=document.createElement("strong");title.textContent=card.name||"Carta sin nombre";
      const state=item.status==="available"&&Number(item.remaining_uses)>0?"DISPONIBLE":"USADA";
      const category=adminCategoryLabel(card.category);
      const rarity=adminRarityLabel(card.rarity);
      const meta=document.createElement("small");meta.textContent=category+" · "+rarity+" · "+state;
      const uses=document.createElement("span");
      uses.textContent=(item.remaining_uses??0)+"/"+(card.uses_per_card??1)+" USOS"+
        (item.tramo_number!=null?" · OBTENIDA EN TRAMO "+item.tramo_number:"");
      const source=document.createElement("span");source.textContent="ORIGEN: "+(item.source==="admin"?"REGALO ADMINISTRATIVO":item.source||"—")+" · "+formatDate(item.obtained_at);
      body.append(title,meta,uses,source);
      const remove=document.createElement("button");remove.type="button";remove.className="admin-trainer-card-remove";
      remove.textContent="RETIRAR ESTA COPIA";remove.title="Eliminar solo esta copia del inventario";
      remove.addEventListener("click",()=>removeAdminTrainerCard(item,card));
      row.append(imageWrap,body,remove);inventory.append(row);
    });
  }

  const typesWrap=document.getElementById("adminTrainerTypes");
  typesWrap.replaceChildren();
  const typeMap=Object.fromEntries((data.types||[]).map(item=>[item.type_slug,item.is_enabled]));
  let enabledCount=0;
  POKEMON_TYPES.forEach(type=>{
    const enabled=typeMap[type.slug]!==false;
    if(enabled)enabledCount++;
    const chip=document.createElement("div");chip.className="admin-trainer-type"+(enabled?" enabled":" disabled");
    const dot=document.createElement("i");dot.style.backgroundColor=type.color;
    const name=document.createElement("strong");name.textContent=type.name;
    const state=document.createElement("small");state.textContent=enabled?"HABILITADO":"BLOQUEADO";
    chip.append(dot,name,state);typesWrap.append(chip);
  });
  setText("adminTrainerTypesCount",enabledCount+" / 18 ACTIVOS");

  const effectsWrap=document.getElementById("adminTrainerEffects");
  effectsWrap.replaceChildren();
  const effects=Array.isArray(data.effects)?data.effects:[];
  setText("adminTrainerEffectsCount",effects.length+" ACTIVOS");
  if(!effects.length){
    const empty=document.createElement("div");empty.className="profile-module-empty";
    empty.textContent="Sin efectos activos.";
    effectsWrap.append(empty);
  }else{
    effects.forEach(effect=>{
      const row=document.createElement("article");row.className="admin-trainer-effect-item";
      const copy=document.createElement("div");copy.className="admin-trainer-effect-copy";
      const title=document.createElement("strong");title.textContent=effect.source_card_name||effect.effect_key||"Efecto activo";
      const detail=document.createElement("small");detail.textContent=(effect.effect_key||"efecto")+" · "+(effect.operation||"")+
        (effect.effect_value!=null?" "+effect.effect_value:"");
      const source=document.createElement("span");source.textContent="Aplicado por: "+(effect.applied_by_name||"evento")+" · "+adminTrainerDurationLabel(effect);
      copy.append(title,detail,source);
      if(effect.source_card_image){
        const image=document.createElement("img");image.src=effect.source_card_image;image.alt=effect.source_card_name||"Carta fuente";image.className="admin-trainer-effect-image";row.append(image);
      }
      row.append(copy);effectsWrap.append(row);
    });
  }

  const unlocksWrap=document.getElementById("adminTrainerUnlocks");
  unlocksWrap.replaceChildren();
  const unlocks=Array.isArray(data.unlocks)?data.unlocks:[];
  setText("adminTrainerUnlocksCount",unlocks.length+" DESBLOQUEOS");
  if(!unlocks.length){
    const empty=document.createElement("div");empty.className="profile-module-empty";
    empty.textContent="Sin ruletas desbloqueadas.";
    unlocksWrap.append(empty);
  }else{
    unlocks.forEach(unlock=>{
      const row=document.createElement("div");row.className="admin-trainer-unlock-item";
      const info=document.createElement("div");info.className="admin-trainer-unlock-copy";
      const title=document.createElement("strong");title.textContent=unlock.pool_name||unlock.pool_slug||"Ruleta especial";
      const detail=document.createElement("small");detail.textContent=
        Number(unlock.spins_remaining||0)+" GIROS DISPONIBLES · "+
        Number(unlock.spins_used||0)+"/"+Number(unlock.spins_granted||0)+" UTILIZADOS";
      const created=document.createElement("span");created.textContent="Desbloqueada el "+formatDate(unlock.created_at)+
        (unlock.expires_at?" · Caduca "+formatDate(unlock.expires_at):"");
      info.append(title,detail,created);
      const pill=document.createElement("b");pill.textContent=Number(unlock.spins_remaining||0)>0?"DISPONIBLE":"AGOTADA";
      row.append(info,pill);unlocksWrap.append(row);
    });
  }

  const activityWrap=document.getElementById("adminTrainerActivity");
  activityWrap.replaceChildren();
  const activity=Array.isArray(data.activity)?data.activity:[];
  setText("adminTrainerActivityCount",activity.length+" MOVIMIENTOS");
  const activityMessages={
    tramo_award:"Avanzó de tramo y recibió cartas de tramo",
    roulette_spin:"Giró la ruleta",
    admin_grant:"Recibió un regalo administrativo",
    admin_remove:"Se retiró una carta de su inventario",
    tramo_adjustment:"Se ajustó su tramo",
    play:"Utilizó una carta",
    transfer:"Transfirió una carta",
    evolution:"Evolucionó una carta",
    effect_applied:"Aplicó un efecto",
    consume:"Canjeó una carta",
    roulette_unlock:"Desbloqueó una ruleta"
  };
  if(!activity.length){
    const empty=document.createElement("div");empty.className="profile-module-empty";
    empty.textContent="Sin movimientos.";
    activityWrap.append(empty);
  }else{
    activity.forEach(entry=>{
      const row=document.createElement("div");row.className="admin-trainer-activity-item";
      const marker=document.createElement("i");marker.textContent=
        entry.activity_type==="tramo_award"?"Ⅱ":
        entry.activity_type==="roulette_spin"?"◉":
        entry.activity_type==="transfer"?"⇢":
        entry.activity_type==="evolution"?"⬡":"✦";
      const copy=document.createElement("div");copy.className="admin-trainer-activity-copy";
      const title=document.createElement("strong");
      title.textContent=activityMessages[entry.activity_type]||String(entry.activity_type||"Actividad").replaceAll("_"," ");
      const detail=document.createElement("small");
      const cardName=entry.card_name||entry.details?.card_name||entry.details?.name||"";
      const targetName=entry.target_name&&entry.target_name!==entry.actor_name?" · Objetivo: "+entry.target_name:"";
      const tramo=entry.details?.tramo_number?" · Tramo "+entry.details.tramo_number:"";
      const adjustment=entry.activity_type==="tramo_adjustment"?" · "+entry.details?.old_tramo+" → "+entry.details?.new_tramo:"";
      const quantity=entry.activity_type==="admin_grant"&&Number(entry.details?.quantity)>1?" · ×"+entry.details.quantity:"";
      const evolution=entry.activity_type==="evolution"
        ?" · "+(entry.details?.source_name||"Carta")+" → "+(entry.details?.result_name||"Resultado")+
          (entry.details?.evolution_trigger==="tramo_advance"?" · Automática al pasar al tramo "+entry.details?.to_tramo:" · Manual")
        :"";
      detail.textContent=(cardName?cardName:"")+targetName+tramo+adjustment+quantity+evolution;
      const when=document.createElement("span");when.textContent=formatDate(entry.created_at);
      copy.append(title,detail,when);row.append(marker,copy);activityWrap.append(row);
    });
  }
}
async function openAdminTrainerDetail(playerId){
  if(!isAdmin||!authClient||!playerId){notify("No tienes permiso para abrir este entrenador.");return;}
  const list=document.getElementById("adminTrainersListView");
  const detail=document.getElementById("adminTrainerDetailView");
  if(list)list.hidden=true;
  if(detail){detail.hidden=false;detail.scrollIntoView({behavior:"smooth",block:"start"});}
  const inventory=document.getElementById("adminTrainerInventory");
  if(inventory){inventory.replaceChildren();const loading=document.createElement("div");loading.className="admin-catalog-loading";loading.textContent="Cargando ficha del entrenador...";inventory.append(loading);}
  try{
    const {data,error}=await authClient.rpc("admin_get_trainer",{p_player_id:playerId});
    if(error)throw error;
    if(!data?.trainer?.id)throw new Error("Supabase no devolvió la ficha del entrenador.");
    adminTrainerDetail=data;
    renderAdminTrainerDetail(data);
  }catch(error){
    console.error("No se pudo abrir la ficha del entrenador:",error);
    notify("No se pudo abrir el entrenador: "+(error.message||"error desconocido"));
    showAdminTrainerList();
  }
}
async function loadAdminGiftCatalog(){
  const select=document.getElementById("adminTrainerGiftCard");
  if(!select)return;
  select.replaceChildren();
  const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Cargando catálogo...";select.append(placeholder);
  if(!isAdmin||!authClient)return;
  try{
    const {data,error}=await authClient.rpc("admin_list_catalog");
    if(error)throw error;
    adminCatalogItems=Array.isArray(data)?data:[];
    select.replaceChildren();
    const choose=document.createElement("option");choose.value="";choose.textContent="Selecciona una carta...";select.append(choose);
    adminCatalogItems.forEach(card=>{
      const option=document.createElement("option");option.value=card.id;
      option.textContent=card.name+" · "+adminCategoryLabel(card.category)+" · "+adminRarityLabel(card.rarity)+(card.is_active?"":" · DESACTIVADA");
      select.append(option);
    });
  }catch(error){
    console.error("No se pudo cargar el catálogo para regalos:",error);
    select.replaceChildren();
    const option=document.createElement("option");option.value="";option.textContent="No se pudo cargar el catálogo";select.append(option);
    notify("No se pudo cargar el catálogo de cartas.");
  }
}
async function saveAdminTrainerTramo(){
  if(!isAdmin||!authClient||!adminSelectedTrainerId){notify("No hay un entrenador seleccionado.");return;}
  const input=document.getElementById("adminTrainerTramoInput");
  const newTramo=Number(input.value);
  if(!Number.isInteger(newTramo)||newTramo<0||newTramo>999){
    notify("El tramo debe ser un número entero entre 0 y 999.");return;
  }
  const oldTramo=Number(adminTrainerDetail?.progress?.current_tramo||0);
  if(newTramo===oldTramo){notify("El entrenador ya está en ese tramo.");return;}
  if(!window.confirm("¿Cambiar el tramo de "+adminSelectedTrainerName+" de "+oldTramo+" a "+newTramo+"?\n\nSus cartas, giros y efectos no se reiniciarán automáticamente."))return;
  const button=document.getElementById("adminTrainerSaveTramo");
  button.disabled=true;button.textContent="GUARDANDO...";
  try{
    const {data,error}=await authClient.rpc("admin_adjust_trainer_tramo",{
      p_player_id:adminSelectedTrainerId,p_new_tramo:newTramo
    });
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó el cambio de tramo.");
    notify("Tramo ajustado: "+result.old_tramo+" → "+result.new_tramo+". Los giros se conservaron.");
    await loadAdminTrainers();
    await openAdminTrainerDetail(adminSelectedTrainerId);
    if(currentAuthUser?.id===adminSelectedTrainerId){
      await loadCloudInventory();
      await loadProfileMechanics();
    }
    await loadActivityFeed();
  }catch(error){
    console.error("No se pudo ajustar el tramo:",error);
    notify("No se pudo ajustar el tramo: "+(error.message||"error desconocido"));
  }finally{
    button.disabled=false;button.textContent="GUARDAR TRAMO";
  }
}
async function grantAdminTrainerCard(){
  if(!isAdmin||!authClient||!adminSelectedTrainerId){notify("No hay un entrenador seleccionado.");return;}
  const select=document.getElementById("adminTrainerGiftCard");
  const cardId=select.value;
  const quantity=Number(document.getElementById("adminTrainerGiftQuantity").value);
  const card=adminCatalogItems.find(item=>item.id===cardId);
  if(!card){notify("Selecciona una carta del catálogo.");return;}
  if(!Number.isInteger(quantity)||quantity<1||quantity>20){notify("La cantidad debe estar entre 1 y 20.");return;}
  if(!window.confirm("¿Entregar "+quantity+" copia(s) de «"+card.name+"» a "+adminSelectedTrainerName+"?\n\nCada copia recibirá "+card.uses_per_card+" uso(s). La entrega quedará registrada como regalo administrativo."))return;
  const button=document.getElementById("adminTrainerGrantCard");
  button.disabled=true;button.textContent="ENTREGANDO...";
  try{
    const {data,error}=await authClient.rpc("admin_grant_trainer_card",{
      p_player_id:adminSelectedTrainerId,p_card_id:cardId,p_quantity:quantity
    });
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó la entrega.");
    notify("Entregadas "+result.quantity_added+" copia(s) de «"+result.card_name+"» a "+result.trainer_name+".");
    document.getElementById("adminTrainerGiftQuantity").value=1;
    await loadAdminTrainers();
    await openAdminTrainerDetail(adminSelectedTrainerId);
    await loadActivityFeed();
    await loadPlayers();
    if(currentAuthUser?.id===adminSelectedTrainerId)await loadCloudInventory();
  }catch(error){
    console.error("No se pudo entregar la carta:",error);
    notify("No se pudo entregar la carta: "+(error.message||"error desconocido"));
  }finally{
    button.disabled=false;button.textContent="ENTREGAR CARTA ↗";
  }
}
async function removeAdminTrainerCard(item,card){
  if(!isAdmin||!authClient||!adminSelectedTrainerId||!item?.id){notify("No se pudo identificar la copia que quieres retirar.");return;}
  const cardName=card?.name||"esta carta";
  const remaining=Number(item.remaining_uses||0);
  const previousStatus=item.status==="available"?"disponible":"usada";
  if(!window.confirm("¿Retirar solo esta copia de «"+cardName+"» del inventario de "+adminSelectedTrainerName+"?\n\nUsos restantes: "+remaining+". Estado: "+previousStatus+".\n\nEl movimiento quedará registrado en el historial. Los efectos o desbloqueos que ya se activaron no se revierten."))return;
  try{
    const {data,error}=await authClient.rpc("admin_remove_trainer_card",{
      p_player_id:adminSelectedTrainerId,p_card_instance_id:item.id
    });
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó la retirada.");
    notify("Se retiró una copia de «"+(result.card_name||cardName)+"».");
    await loadAdminTrainers();
    await openAdminTrainerDetail(adminSelectedTrainerId);
    await loadActivityFeed();
    await loadPlayers();
    if(currentAuthUser?.id===adminSelectedTrainerId)await loadCloudInventory();
  }catch(error){
    console.error("No se pudo retirar la copia:",error);
    notify("No se pudo retirar la carta: "+(error.message||"error desconocido"));
  }
}

async function clearAdminTrainerCards(){
  if(!isAdmin||!authClient||!adminSelectedTrainerId){notify("No hay un entrenador seleccionado.");return;}
  const warning="Vas a borrar TODAS las cartas de "+adminSelectedTrainerName+".\n\n"+
    "Se eliminarán cartas normales, de tramo, Fiesta y copias usadas.\n"+
    "Se conservarán su tramo, giros, tipos, efectos activos recibidos y el historial del muro.\n\n"+
    "Esta acción no se puede deshacer. ¿Deseas continuar?";
  if(!window.confirm(warning))return;
  const confirmation=window.prompt("Para confirmar el vaciado, escribe exactamente VACIAR.");
  if(confirmation!=="VACIAR"){notify("Vaciado cancelado. No se modificó el inventario.");return;}
  const button=document.getElementById("adminClearTrainerCardsButton");
  button.disabled=true;button.textContent="VACIANDO INVENTARIO...";
  try{
    const {data,error}=await authClient.rpc("admin_clear_trainer_cards",{p_player_id:adminSelectedTrainerId});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó el vaciado.");
    notify("Inventario de "+(result.trainer_name||adminSelectedTrainerName)+" vaciado: "+Number(result.deleted_count||0)+" cartas eliminadas.");
    await loadAdminTrainers();
    await openAdminTrainerDetail(adminSelectedTrainerId);
    if(currentAuthUser?.id===adminSelectedTrainerId){
      await loadCloudInventory();
      await loadProfileMechanics();
    }
    await loadPlayers();
  }catch(error){
    console.error("No se pudo vaciar el inventario del entrenador:",error);
    notify("No se pudo vaciar el inventario: "+(error.message||"error desconocido"));
  }finally{
    button.disabled=false;button.textContent="VACIAR TODAS SUS CARTAS";
  }
}

function showAdminRouletteList(){
  const list=document.getElementById("adminRouletteListView");
  const editor=document.getElementById("adminRouletteEditorView");
  if(list)list.hidden=false;
  if(editor)editor.hidden=true;
}
function adminRouletteName(slug){
  return ({normal:"Ruleta normal",legendary:"Ruleta legendaria",fiesta:"Ruleta Fiesta"})[slug]||"Ruleta";
}
function adminRouletteSubtitle(slug){
  return ({
    normal:"Cartas normales comunes, raras y épicas",
    legendary:"Cartas de rareza legendaria",
    fiesta:"Cartas de categoría Fiesta"
  })[slug]||"Configuración de cartas";
}
async function loadAdminRoulettePools(){
  const grid=document.getElementById("adminRoulettePoolGrid");
  if(grid){grid.replaceChildren();const loading=document.createElement("div");loading.className="admin-catalog-loading";loading.textContent="Cargando configuración de las ruletas...";grid.append(loading);}
  if(!isAdmin||!authClient){notify("Acceso reservado al administrador.");return;}
  try{
    const {data,error}=await authClient.rpc("admin_list_roulette_pools");
    if(error)throw error;
    adminRoulettePools=Array.isArray(data)?data:[];
    renderAdminRoulettePoolGrid();
  }catch(error){
    console.error("No se pudieron cargar las ruletas:",error);
    if(grid){grid.replaceChildren();const message=document.createElement("div");message.className="admin-catalog-loading is-error";message.textContent="No se pudieron cargar las ruletas: "+(error.message||"error desconocido");grid.append(message);}
  }
}
function renderAdminRoulettePoolGrid(){
  const grid=document.getElementById("adminRoulettePoolGrid");
  if(!grid)return;
  grid.replaceChildren();
  const descriptions={normal:"◉",legendary:"✦",fiesta:"★"};
  adminRoulettePools.forEach(pool=>{
    const members=Array.isArray(pool.cards)?pool.cards:[];
    const activeMembers=members.filter(card=>card.is_active&&card.catalog_active).length;
    const button=document.createElement("button");button.type="button";button.className="admin-roulette-pool-card panel";
    const icon=document.createElement("span");icon.className="admin-roulette-pool-icon "+pool.slug;icon.textContent=descriptions[pool.slug]||"◉";
    const title=document.createElement("strong");title.textContent=pool.name||adminRouletteName(pool.slug);
    const subtitle=document.createElement("small");subtitle.textContent=adminRouletteSubtitle(pool.slug);
    const counts=document.createElement("span");counts.className="admin-roulette-pool-count";
    counts.textContent=members.length+" cartas · "+activeMembers+" habilitadas";
    const status=document.createElement("b");status.className="admin-roulette-pool-status "+(pool.is_active?"is-active":"is-inactive");
    status.textContent=pool.is_active?"ACTIVA":"DESACTIVADA";
    const open=document.createElement("span");open.className="admin-roulette-pool-open";open.textContent="EDITAR RULETA ↗";
    button.append(icon,title,subtitle,counts,status,open);
    button.addEventListener("click",()=>openAdminRouletteEditor(pool.slug));
    grid.append(button);
  });
  if(!adminRoulettePools.length){
    const empty=document.createElement("div");empty.className="admin-catalog-loading";empty.textContent="No encontramos las tres ruletas configuradas.";grid.append(empty);
  }
}
function openAdminRouletteEditor(slug){
  if(!isAdmin)return;
  const pool=adminRoulettePools.find(item=>item.slug===slug);
  if(!pool){notify("No encontramos esa ruleta.");return;}
  adminSelectedRouletteSlug=slug;
  document.getElementById("adminRouletteListView").hidden=true;
  document.getElementById("adminRouletteEditorView").hidden=false;
  setText("adminRouletteEditorKind",adminRouletteName(slug).toUpperCase());
  setText("adminRouletteEditorName",pool.name||adminRouletteName(slug));
  setText("adminRouletteEditorHelp",adminRouletteSubtitle(slug)+". Selecciona qué cartas pueden salir y ajusta su peso.");
  document.getElementById("adminRouletteDescription").value=pool.description||"";
  document.getElementById("adminRouletteIsActive").checked=Boolean(pool.is_active);
  const status=document.getElementById("adminRouletteSaveStatus");
  status.textContent="Los cambios todavía no se han guardado.";
  status.classList.remove("is-error");
  renderAdminRouletteCards(pool);
  window.scrollTo({top:0,behavior:"smooth"});
}
function updateAdminRouletteProbabilities(){
  const grid=document.getElementById("adminRouletteCardsGrid");
  if(!grid)return;
  const rows=[...grid.querySelectorAll(".admin-roulette-card-row")];
  const active=rows.filter(row=>
    row.querySelector('[data-role="include"]').checked&&
    row.querySelector('[data-role="member-active"]').checked&&
    row.dataset.catalogActive==="true"
  );
  const total=active.reduce((sum,row)=>sum+Number(row.querySelector('[data-role="weight"]').value||0),0);
  let included=rows.filter(row=>row.querySelector('[data-role="include"]').checked).length;
  setText("adminRouletteCardSummary",included+" cartas seleccionadas");
  setText("adminRouletteWeightSummary","Peso activo total: "+total);
  rows.forEach(row=>{
    const include=row.querySelector('[data-role="include"]').checked;
    const enabled=row.querySelector('[data-role="member-active"]').checked;
    const weight=Number(row.querySelector('[data-role="weight"]').value||0);
    const percent=include&&enabled&&row.dataset.catalogActive==="true"&&total>0
      ?(weight/total*100).toFixed(1)+"%"
      :"—";
    row.querySelector('[data-role="probability"]').textContent=percent;
    row.classList.toggle("is-included",include);
    row.classList.toggle("is-disabled",include&&(!enabled||row.dataset.catalogActive!=="true"));
  });
}
function renderAdminRouletteCards(pool){
  const grid=document.getElementById("adminRouletteCardsGrid");
  if(!grid)return;
  grid.replaceChildren();
  const eligible=Array.isArray(pool.eligible_cards)?pool.eligible_cards:[];
  const memberMap=new Map((pool.cards||[]).map(card=>[card.id,card]));
  if(!eligible.length){
    const empty=document.createElement("div");empty.className="admin-catalog-loading";
    empty.textContent=pool.slug==="legendary"
      ?"Todavía no hay cartas de rareza legendaria en el catálogo."
      :pool.slug==="fiesta"
        ?"Todavía no hay cartas de categoría Fiesta en el catálogo."
        :"No hay cartas normales comunes, raras o épicas en el catálogo.";
    grid.append(empty);
    updateAdminRouletteProbabilities();
    return;
  }
  eligible.forEach(card=>{
    const member=memberMap.get(card.id);
    const row=document.createElement("article");row.className="admin-roulette-card-row";
    row.dataset.cardId=card.id;
    row.dataset.catalogActive=card.is_active?"true":"false";
    const imageWrap=document.createElement("div");imageWrap.className="admin-roulette-card-image";
    if(card.image_path){
      const image=document.createElement("img");image.src=card.image_path;image.alt=card.name||"Carta";
      image.onerror=()=>{image.remove();const fallback=document.createElement("span");fallback.textContent="▧";imageWrap.append(fallback);};
      imageWrap.append(image);
    }else{
      const fallback=document.createElement("span");fallback.textContent="▧";imageWrap.append(fallback);
    }
    const info=document.createElement("div");info.className="admin-roulette-card-info";
    const title=document.createElement("strong");title.textContent=card.name||"Carta";
    const meta=document.createElement("small");meta.textContent=adminCategoryLabel(card.category)+" · "+adminRarityLabel(card.rarity);
    const catalog=document.createElement("span");catalog.className="admin-roulette-catalog-state";
    catalog.textContent=card.is_active?"ACTIVA EN CATÁLOGO":"DESACTIVADA EN CATÁLOGO";
    info.append(title,meta,catalog);

    const includeLabel=document.createElement("label");includeLabel.className="admin-roulette-include";
    const include=document.createElement("input");include.type="checkbox";include.dataset.role="include";include.checked=Boolean(member);
    const includeText=document.createElement("span");includeText.textContent="INCLUIR";
    includeLabel.append(include,includeText);

    const weightLabel=document.createElement("label");weightLabel.className="admin-roulette-weight";
    const weightText=document.createElement("span");weightText.textContent="PESO";
    const weight=document.createElement("input");weight.type="number";weight.min="1";weight.max="10000";weight.step="1";weight.value=String(member?.weight||1);weight.dataset.role="weight";weight.setAttribute("aria-label","Peso para "+card.name);
    weightLabel.append(weightText,weight);

    const activeLabel=document.createElement("label");activeLabel.className="admin-roulette-member-active";
    const active=document.createElement("input");active.type="checkbox";active.dataset.role="member-active";
    active.checked=member?Boolean(member.is_active&&card.is_active):Boolean(card.is_active);
    active.disabled=!card.is_active;
    const activeText=document.createElement("span");activeText.textContent="HABILITADA";
    activeLabel.append(active,activeText);

    const probability=document.createElement("b");probability.className="admin-roulette-probability";probability.dataset.role="probability";probability.textContent="—";
    row.append(imageWrap,info,includeLabel,weightLabel,activeLabel,probability);
    grid.append(row);
  });
  updateAdminRouletteProbabilities();
}
async function saveAdminRoulettePool(){
  if(!isAdmin||!authClient||!adminSelectedRouletteSlug){notify("No hay una ruleta seleccionada.");return;}
  const grid=document.getElementById("adminRouletteCardsGrid");
  const rows=[...grid.querySelectorAll(".admin-roulette-card-row")];
  const cards=[];
  for(const row of rows){
    if(!row.querySelector('[data-role="include"]').checked)continue;
    const weight=Number(row.querySelector('[data-role="weight"]').value);
    if(!Number.isInteger(weight)||weight<1||weight>10000){
      notify("Cada peso debe ser un número entero entre 1 y 10000.");return;
    }
    cards.push({
      card_id:row.dataset.cardId,
      weight,
      is_active:row.querySelector('[data-role="member-active"]').checked
    });
  }
  const isActive=document.getElementById("adminRouletteIsActive").checked;
  if(isActive&&!cards.some(card=>card.is_active)){
    notify("Para activar la ruleta, incluye al menos una carta habilitada.");return;
  }
  const button=document.getElementById("adminRouletteSave");
  const status=document.getElementById("adminRouletteSaveStatus");
  button.disabled=true;button.textContent="GUARDANDO...";
  status.textContent="Guardando cartas, pesos y estado de la ruleta...";
  status.classList.remove("is-error");
  try{
    const {data,error}=await authClient.rpc("admin_save_roulette_pool",{
      p_pool_slug:adminSelectedRouletteSlug,
      p_is_active:isActive,
      p_description:document.getElementById("adminRouletteDescription").value,
      p_cards:cards
    });
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó la configuración.");
    await loadAdminRoulettePools();
    if(adminSelectedRouletteSlug==="normal")await loadPublicNormalCards();
    const savedPool=adminRoulettePools.find(pool=>pool.slug===adminSelectedRouletteSlug);
    if(savedPool)openAdminRouletteEditor(savedPool.slug);
    notify(adminRouletteName(adminSelectedRouletteSlug)+" guardada correctamente.");
    status.textContent="Guardada: "+result.cards_saved+" cartas · "+result.active_cards+" habilitadas.";
  }catch(error){
    console.error("No se pudo guardar la ruleta:",error);
    status.textContent=error.message||"No se pudo guardar la ruleta.";
    status.classList.add("is-error");
    notify("No se pudo guardar la ruleta: "+(error.message||"error desconocido"));
  }finally{
    button.disabled=false;button.textContent="GUARDAR RULETA ↗";
  }
}

function adminMechanicsEffectLabel(effect){
  if(effect.effect_key==="normal_card_limit"){
    const value=Number(effect.effect_value||0);
    return (value>0?"+":"")+value+" espacios de baraja";
  }
  if(effect.effect_key==="tramo_spin_credit")return "+"+Number(effect.effect_value||0)+" giros extra";
  if(effect.effect_key==="unlock_roulette"){
    const pool=effect.parameters?.pool_slug==="fiesta"?"Fiesta":"Legendaria";
    return "Desbloquea ruleta "+pool;
  }
  return effect.effect_key||"Efecto";
}
function renderAdminMechanicsList(){
  const grid=document.getElementById("adminMechanicsGrid");
  if(!grid)return;
  const search=(document.getElementById("adminMechanicsSearch")?.value||"").trim().toLowerCase();
  const category=document.getElementById("adminMechanicsCategory")?.value||"all";
  const filtered=adminMechanicsItems.filter(item=>{
    const card=item.card||{};
    const nameMatch=!search||String(card.name||"").toLowerCase().includes(search)||String(card.slug||"").toLowerCase().includes(search);
    return nameMatch&&(category==="all"||card.category===category);
  });
  setText("adminMechanicsCardsTotal",adminMechanicsItems.length);
  setText("adminMechanicsEffectsTotal",adminMechanicsItems.filter(item=>(item.effects||[]).some(effect=>effect.is_active)).length);
  setText("adminMechanicsEvolutionsTotal",adminMechanicsItems.filter(item=>item.evolution?.is_active).length);
  grid.replaceChildren();
  if(!filtered.length){
    const empty=document.createElement("div");empty.className="admin-catalog-loading";
    empty.textContent=adminMechanicsItems.length?"No hay cartas que coincidan con la búsqueda.":"No hay cartas en el catálogo.";
    grid.append(empty);return;
  }
  filtered.forEach(item=>{
    const card=item.card||{};
    const article=document.createElement("article");article.className="admin-mechanics-card panel";
    const art=document.createElement("div");art.className="admin-mechanics-list-art";
    if(card.image_path){const image=document.createElement("img");image.src=card.image_path;image.alt=card.name||"Carta";image.onerror=()=>image.remove();art.append(image);}
    else art.textContent="▧";
    const body=document.createElement("div");body.className="admin-mechanics-list-copy";
    const name=document.createElement("strong");name.textContent=card.name||"Carta";
    const meta=document.createElement("small");meta.textContent=adminCategoryLabel(card.category)+" · "+adminRarityLabel(card.rarity);
    const effectCount=(item.effects||[]).filter(effect=>effect.is_active).length;
    const effect=document.createElement("span");effect.textContent=effectCount?effectCount+" efecto(s) activo(s)":"Sin efectos activos";
    const evolution=document.createElement("span");
    if(item.evolution?.is_active){
      evolution.textContent=item.evolution.trigger_type==="tramo_advance"?"Evoluciona al avanzar de tramo":"Evolución manual configurada";
      evolution.className="is-configured";
    }else{evolution.textContent="Sin evolución configurada";}
    body.append(name,meta,effect,evolution);
    const button=document.createElement("button");button.type="button";button.className="admin-card-edit";button.textContent="CONFIGURAR ↗";
    button.addEventListener("click",()=>openAdminMechanicsEditor(card.id));
    article.append(art,body,button);grid.append(article);
  });
}
async function loadAdminMechanics(){
  const grid=document.getElementById("adminMechanicsGrid");
  if(grid){grid.replaceChildren();const loading=document.createElement("div");loading.className="admin-catalog-loading";loading.textContent="Cargando catálogo, efectos y evoluciones...";grid.append(loading);}
  if(!isAdmin||!authClient){notify("Acceso reservado al administrador.");return;}
  try{
    const {data,error}=await authClient.rpc("admin_list_card_mechanics");
    if(error)throw error;
    adminMechanicsItems=Array.isArray(data)?data:[];
    renderAdminMechanicsList();
  }catch(error){
    console.error("No se pudieron cargar las mecánicas de las cartas:",error);
    if(grid){grid.replaceChildren();const message=document.createElement("div");message.className="admin-catalog-loading is-error";message.textContent="No se pudieron cargar las mecánicas: "+(error.message||"error desconocido");grid.append(message);}
  }
}
function updateAdminEvolutionMethodNote(){
  const trigger=document.getElementById("adminEvolutionTrigger")?.value;
  const sameTramo=document.getElementById("adminEvolutionSameTramo")?.checked;
  let message=trigger==="tramo_advance"
    ?"La carta se transformará automáticamente cuando su entrenador avance al siguiente tramo. La copia anterior quedará registrada como usada y recibirá la carta resultado con sus usos configurados."
    :"La evolución manual aparecerá como botón en la baraja del entrenador. El jugador decidirá cuándo utilizarla.";
  if(sameTramo)message+=" Las copias antiguas que no tengan registrado el tramo en que se obtuvieron no cumplirán esta condición.";
  setText("adminEvolutionMethodNote",message);
}
function createAdminEffectRow(effect={}){
  const row=document.createElement("article");row.className="admin-mechanics-effect-row";
  const top=document.createElement("div");top.className="admin-mechanics-effect-top";
  const typeLabel=document.createElement("label");typeLabel.className="admin-field";
  typeLabel.textContent="TIPO DE EFECTO";
  const type=document.createElement("select");type.dataset.role="effect-key";
  type.innerHTML='<option value="normal_card_limit">Modificar límite de baraja</option><option value="tramo_spin_credit">Conceder giros extra</option><option value="unlock_roulette">Desbloquear ruleta</option>';
  type.value=["normal_card_limit","tramo_spin_credit","unlock_roulette"].includes(effect.effect_key)?effect.effect_key:"normal_card_limit";
  typeLabel.append(type);
  const activeLabel=document.createElement("label");activeLabel.className="admin-mechanics-check-row";
  const active=document.createElement("input");active.type="checkbox";active.dataset.role="is-active";active.checked=effect.is_active!==false;
  activeLabel.append(active,document.createTextNode(" EFECTO ACTIVO"));
  const remove=document.createElement("button");remove.type="button";remove.className="admin-card-delete";remove.textContent="QUITAR";
  remove.addEventListener("click",()=>{row.remove();renderAdminEffectsEmptyState();});
  top.append(typeLabel,activeLabel,remove);

  const limitFields=document.createElement("div");limitFields.className="admin-mechanics-effect-fields";limitFields.dataset.role="limit-fields";
  const valueLabel=document.createElement("label");valueLabel.className="admin-field";valueLabel.textContent="CAMBIO DE ESPACIOS (+/-)";
  const value=document.createElement("input");value.type="number";value.min="-10";value.max="10";value.step="1";value.value=String(effect.effect_value??1);value.dataset.role="effect-value";valueLabel.append(value);
  const durationLabel=document.createElement("label");durationLabel.className="admin-field";durationLabel.textContent="DURACIÓN";
  const duration=document.createElement("select");duration.dataset.role="duration-type";
  duration.innerHTML='<option value="tramo_end">Hasta finalizar este tramo</option><option value="next_tramo_end">Hasta finalizar el próximo tramo</option><option value="timed">Por tiempo</option><option value="permanent">Permanente</option>';
  duration.value=["tramo_end","next_tramo_end","timed","permanent"].includes(effect.duration_type)?effect.duration_type:"tramo_end";durationLabel.append(duration);
  const timedWrap=document.createElement("div");timedWrap.className="admin-mechanics-timed-fields";timedWrap.dataset.role="timed-fields";
  const amountLabel=document.createElement("label");amountLabel.className="admin-field";amountLabel.textContent="DURACIÓN";
  const amount=document.createElement("input");amount.type="number";amount.min="1";amount.max="100000";amount.step="1";amount.value=String(effect.duration_value??1);amount.dataset.role="duration-value";amountLabel.append(amount);
  const unitLabel=document.createElement("label");unitLabel.className="admin-field";unitLabel.textContent="UNIDAD";
  const unit=document.createElement("select");unit.dataset.role="duration-unit";
  unit.innerHTML='<option value="minutes">Minutos</option><option value="hours">Horas</option><option value="days">Días</option><option value="seconds">Segundos</option>';
  unit.value=effect.duration_unit||"hours";unitLabel.append(unit);
  timedWrap.append(amountLabel,unitLabel);
  limitFields.append(valueLabel,durationLabel,timedWrap);

  const spinFields=document.createElement("div");spinFields.className="admin-mechanics-effect-fields";spinFields.dataset.role="spin-fields";
  const spinValueLabel=document.createElement("label");spinValueLabel.className="admin-field";spinValueLabel.textContent="GIROS EXTRA QUE CONCEDE";
  const spinValue=document.createElement("input");spinValue.type="number";spinValue.min="1";spinValue.max="100";spinValue.step="1";spinValue.value=String(effect.effect_key==="tramo_spin_credit"?effect.effect_value??1:1);spinValue.dataset.role="effect-value";spinValueLabel.append(spinValue);
  const spinNote=document.createElement("p");spinNote.className="admin-mechanics-inline-note";spinNote.textContent="Se acreditan al instante y no caducan.";
  spinFields.append(spinValueLabel,spinNote);

  const unlockFields=document.createElement("div");unlockFields.className="admin-mechanics-effect-fields";unlockFields.dataset.role="unlock-fields";
  const poolLabel=document.createElement("label");poolLabel.className="admin-field";poolLabel.textContent="RULETA A DESBLOQUEAR";
  const pool=document.createElement("select");pool.dataset.role="pool-slug";
  pool.innerHTML='<option value="legendary">Ruleta Legendaria</option><option value="fiesta">Ruleta Fiesta</option>';
  pool.value=effect.parameters?.pool_slug==="fiesta"?"fiesta":"legendary";poolLabel.append(pool);
  const spinsLabel=document.createElement("label");spinsLabel.className="admin-field";spinsLabel.textContent="GIROS QUE CONCEDE";
  const spins=document.createElement("input");spins.type="number";spins.min="1";spins.max="100";spins.step="1";spins.value=String(effect.parameters?.spins_granted??1);spins.dataset.role="spins-granted";spinsLabel.append(spins);
  const instantNote=document.createElement("p");instantNote.className="admin-mechanics-inline-note";instantNote.textContent="Se acredita al canjear. Requiere una ruleta activa.";
  unlockFields.append(poolLabel,spinsLabel,instantNote);

  function sync(){
    const key=type.value;
    const unlock=key==="unlock_roulette";
    const spin=key==="tramo_spin_credit";
    limitFields.hidden=unlock||spin;
    spinFields.hidden=!spin;
    unlockFields.hidden=!unlock;
    timedWrap.hidden=unlock||spin||duration.value!=="timed";
    if(type.dataset.changed==="true"){
      const target=document.getElementById("adminMechanicsTargetScope");
      const disposition=document.getElementById("adminMechanicsDisposition");
      target.value=unlock?"none":"self";disposition.value="consume";
    }
  }
  type.addEventListener("change",()=>{type.dataset.changed="true";sync();});
  duration.addEventListener("change",sync);
  row.append(top,limitFields,spinFields,unlockFields);
  row._sync=sync;
  sync();
  return row;
}
function renderAdminEffectsEmptyState(){
  const list=document.getElementById("adminMechanicsEffectsList");
  if(list&&!list.querySelector(".admin-mechanics-effect-row")){
    const empty=document.createElement("div");empty.className="profile-module-empty";
    empty.textContent="Esta carta no tiene efectos configurados. Puedes añadir uno.";
    list.replaceChildren(empty);
  }
}
function openAdminMechanicsEditor(cardId){
  if(!isAdmin)return;
  const item=adminMechanicsItems.find(entry=>entry.card?.id===cardId);
  if(!item){notify("No encontramos esta carta.");return;}
  adminSelectedMechanicsCardId=cardId;
  const card=item.card||{};
  document.getElementById("adminMechanicsListView").hidden=true;
  document.getElementById("adminMechanicsEditorView").hidden=false;
  setText("adminMechanicsCardName",card.name||"Carta");
  setText("adminMechanicsCardSlug",card.slug||"");
  setText("adminMechanicsCardMeta",adminCategoryLabel(card.category)+" · "+adminRarityLabel(card.rarity)+" · "+Number(card.uses_per_card||1)+" uso(s)");
  const art=document.getElementById("adminMechanicsCardArt");art.replaceChildren();
  if(card.image_path){const image=document.createElement("img");image.src=card.image_path;image.alt=card.name||"Carta";image.onerror=()=>image.remove();art.append(image);}
  else{const empty=document.createElement("span");empty.textContent="▧";art.append(empty);}
  document.getElementById("adminMechanicsTargetScope").value=card.target_scope||"self";
  document.getElementById("adminMechanicsDisposition").value=card.disposition||"consume";

  const effectsList=document.getElementById("adminMechanicsEffectsList");effectsList.replaceChildren();
  (item.effects||[]).forEach(effect=>effectsList.append(createAdminEffectRow(effect)));
  renderAdminEffectsEmptyState();

  const evolution=item.evolution;
  const enabled=Boolean(evolution&&evolution.is_active);
  document.getElementById("adminEvolutionEnabled").checked=enabled;
  document.getElementById("adminEvolutionFields").hidden=!enabled;
  document.getElementById("adminEvolutionDisabledNote").hidden=enabled;
  const resultSelect=document.getElementById("adminEvolutionResultCard");
  resultSelect.replaceChildren();
  const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Selecciona la carta a la que evoluciona...";resultSelect.append(placeholder);
  adminMechanicsItems.forEach(entry=>{
    const candidate=entry.card||{};
    if(candidate.id===cardId||candidate.is_active===false)return;
    const option=document.createElement("option");option.value=candidate.id;
    option.textContent=candidate.name+" · "+adminCategoryLabel(candidate.category)+" · "+adminRarityLabel(candidate.rarity);
    resultSelect.append(option);
  });
  resultSelect.value=evolution?.result_card_id||"";
  document.getElementById("adminEvolutionTrigger").value=evolution?.trigger_type||"manual";
  document.getElementById("adminEvolutionSameTramo").checked=Boolean(evolution?.same_tramo_only);
  document.getElementById("adminEvolutionName").value=evolution?.name||"";
  document.getElementById("adminEvolutionDescription").value=evolution?.description||"";
  updateAdminEvolutionMethodNote();
  setText("adminMechanicsSaveStatus","Los cambios todavía no se han guardado.");
  document.getElementById("adminMechanicsSaveStatus").classList.remove("is-error");
  window.scrollTo({top:0,behavior:"smooth"});
}
async function saveAdminMechanics(){
  if(!isAdmin||!authClient||!adminSelectedMechanicsCardId){notify("No hay una carta seleccionada.");return;}
  const rows=[...document.querySelectorAll("#adminMechanicsEffectsList .admin-mechanics-effect-row")];
  if(rows.length>10){notify("Puedes configurar hasta 10 efectos por carta.");return;}
  const effects=rows.map(row=>{
    const key=row.querySelector('[data-role="effect-key"]').value;
    if(key==="unlock_roulette"){
      return {
        effect_key:key,
        parameters:{
          pool_slug:row.querySelector('[data-role="pool-slug"]').value,
          spins_granted:Number(row.querySelector('[data-role="spins-granted"]').value)
        },
        is_active:row.querySelector('[data-role="is-active"]').checked
      };
    }
    if(key==="tramo_spin_credit"){
      return {
        effect_key:key,
        effect_value:Number(row.querySelector('[data-role="effect-value"]').value),
        is_active:row.querySelector('[data-role="is-active"]').checked
      };
    }
    const duration=row.querySelector('[data-role="duration-type"]').value;
    return {
      effect_key:key,
      effect_value:Number(row.querySelector('[data-role="effect-value"]').value),
      duration_type:duration,
      duration_value:duration==="timed"?Number(row.querySelector('[data-role="duration-value"]').value):null,
      duration_unit:duration==="timed"?row.querySelector('[data-role="duration-unit"]').value:"hours",
      is_active:row.querySelector('[data-role="is-active"]').checked
    };
  });
  const evolutionEnabled=document.getElementById("adminEvolutionEnabled").checked;
  const evolution=evolutionEnabled?{
    enabled:true,
    result_card_id:document.getElementById("adminEvolutionResultCard").value,
    trigger_type:document.getElementById("adminEvolutionTrigger").value,
    same_tramo_only:document.getElementById("adminEvolutionSameTramo").checked,
    name:document.getElementById("adminEvolutionName").value,
    description:document.getElementById("adminEvolutionDescription").value
  }:{enabled:false};
  const targetScope=document.getElementById("adminMechanicsTargetScope").value;
  if(effects.some(effect=>effect.effect_key==="unlock_roulette")&&targetScope!=="self"){
    notify("Desbloquear una ruleta solo puede afectar a quien utiliza la carta. Selecciona «A quien la utiliza».");
    return;
  }
  const button=document.getElementById("adminSaveMechanics");
  const status=document.getElementById("adminMechanicsSaveStatus");
  button.disabled=true;button.textContent="GUARDANDO...";
  status.textContent="Guardando efectos y evolución en el servidor...";
  status.classList.remove("is-error");
  try{
    const {data,error}=await authClient.rpc("admin_save_card_mechanics",{
      p_card_id:adminSelectedMechanicsCardId,
      p_target_scope:targetScope,
      p_disposition:document.getElementById("adminMechanicsDisposition").value,
      p_effects:effects,
      p_evolution:evolution
    });
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó las mecánicas.");
    await loadAdminMechanics();
    const cardId=adminSelectedMechanicsCardId;
    openAdminMechanicsEditor(cardId);
    await loadAdminCatalog();
    await loadAdminRoulettePools();
    status.textContent="Guardado: "+result.effects_saved+" efecto(s) · "+(result.evolution_enabled?"evolución configurada · excluida de ruletas":"sin evolución nueva");
    notify(result.evolution_enabled
      ?"Evolución guardada. La carta ha sido excluida de todas las ruletas."
      :"Mecánicas de «"+result.card_name+"» guardadas correctamente.");
    if(currentAuthUser){
      await loadCloudInventory();
      await loadProfileMechanics();
    }
  }catch(error){
    console.error("No se pudieron guardar las mecánicas:",error);
    status.textContent=error.message||"No se pudieron guardar las mecánicas.";
    status.classList.add("is-error");
    notify("No se pudieron guardar las mecánicas: "+(error.message||"error desconocido"));
  }finally{
    button.disabled=false;button.textContent="GUARDAR MECÁNICAS ↗";
  }
}
function adminCategoryLabel(category){
  return ({normal:"Normal",tramo:"Tramo",fiesta:"Fiesta"})[category]||category||"—";
}
function adminRarityLabel(rarity){
  return ({common:"Común",rare:"Rara",epic:"Épica",legendary:"Legendaria",tramo:"Tramo",fiesta:"Fiesta"})[rarity]||rarity||"—";
}
function adminSlugFromName(name){
  return String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,64);
}
function renderAdminCatalog(){
  const grid=document.getElementById("adminCardGrid");
  if(!grid)return;
  const category=document.getElementById("adminCatalogFilter")?.value||"all";
  const search=(document.getElementById("adminCatalogSearch")?.value||"").trim().toLowerCase();
  const activeCount=adminCatalogItems.filter(card=>card.is_active).length;
  setText("adminCatalogTotal",adminCatalogItems.length);
  setText("adminCatalogActive",activeCount);
  setText("adminCatalogInactive",adminCatalogItems.length-activeCount);
  const filtered=adminCatalogItems.filter(card=>{
    const matchesCategory=category==="all"||card.category===category;
    const matchesSearch=!search||String(card.name||"").toLowerCase().includes(search)||String(card.slug||"").toLowerCase().includes(search);
    return matchesCategory&&matchesSearch;
  });
  grid.replaceChildren();
  if(!filtered.length){
    const empty=document.createElement("div");empty.className="admin-catalog-loading";
    empty.textContent=adminCatalogItems.length?"No hay cartas que coincidan con la búsqueda.":"Todavía no hay cartas en el catálogo.";
    grid.append(empty);return;
  }
  filtered.forEach(card=>{
    const article=document.createElement("article");article.className="admin-card-item panel";
    const imageWrap=document.createElement("div");imageWrap.className="admin-card-item-image";
    if(card.image_path){
      const image=document.createElement("img");image.src=card.image_path;image.alt=card.name||"Carta";
      image.onerror=()=>{image.remove();const fallback=document.createElement("span");fallback.textContent="▧";imageWrap.append(fallback);};
      imageWrap.append(image);
    }else{
      const fallback=document.createElement("span");fallback.textContent="▧";imageWrap.append(fallback);
    }
    const copy=document.createElement("div");copy.className="admin-card-item-copy";
    const title=document.createElement("strong");title.textContent=card.name||"Carta sin nombre";
    const meta=document.createElement("small");meta.textContent=adminCategoryLabel(card.category)+" · "+adminRarityLabel(card.rarity)+" · "+Number(card.uses_per_card||1)+" uso(s)";
    const slug=document.createElement("code");slug.textContent=card.slug||"";
    const status=document.createElement("span");status.className="admin-card-status "+(card.is_active?"is-active":"is-inactive");
    status.textContent=card.is_active?"ACTIVA":"DESACTIVADA";
    const rouletteStatus=document.createElement("span");rouletteStatus.className="admin-card-roulette-status";
    const assignedPools=Array.isArray(card.roulette_pools)?card.roulette_pools:[];
    if(card.has_active_evolution){
      rouletteStatus.classList.add("is-excluded");
      rouletteStatus.textContent="EXCLUIDA · TIENE EVOLUCIÓN";
    }else if(card.roulette_eligible===false){
      rouletteStatus.classList.add("is-excluded");
      rouletteStatus.textContent="NO APARECE EN RULETAS";
    }else if(assignedPools.length){
      rouletteStatus.classList.add("is-included");
      const labels=assignedPools.map(slug=>({normal:"Normal",legendary:"Legendaria",fiesta:"Fiesta"}[slug]||slug));
      rouletteStatus.textContent="CONFIGURADA EN: "+labels.join(" · ");
    }else{
      rouletteStatus.classList.add("is-pending");
      rouletteStatus.textContent="HABILITADA · AÚN SIN ASIGNAR";
    }
    copy.append(title,meta,slug,status,rouletteStatus);
    const actions=document.createElement("div");actions.className="admin-card-item-actions";
    const edit=document.createElement("button");edit.className="admin-card-edit";edit.type="button";edit.textContent="EDITAR";
    edit.addEventListener("click",()=>openAdminCardEditor(card));
    const remove=document.createElement("button");remove.className="admin-card-delete";remove.type="button";remove.textContent="BORRAR";
    remove.title="Borrar solo si la carta no tiene copias en inventarios ni reglas de evolución";
    remove.addEventListener("click",()=>deleteAdminCard(card));
    actions.append(edit,remove);
    article.append(imageWrap,copy,actions);grid.append(article);
  });
}
async function loadAdminCatalog(){
  const grid=document.getElementById("adminCardGrid");
  if(grid){grid.replaceChildren();const loading=document.createElement("div");loading.className="admin-catalog-loading";loading.textContent="Cargando catálogo desde Supabase...";grid.append(loading);}
  if(!authClient||!currentAuthUser||!isAdmin){notify("No tienes permiso para consultar el catálogo.");return;}
  try{
    const {data,error}=await authClient.rpc("admin_list_catalog");
    if(error)throw error;
    adminCatalogItems=Array.isArray(data)?data:[];
    renderAdminCatalog();
  }catch(error){
    console.error("No se pudo cargar el catálogo administrativo:",error);
    if(grid){grid.replaceChildren();const message=document.createElement("div");message.className="admin-catalog-loading is-error";message.textContent="No se pudo cargar el catálogo: "+(error.message||"error desconocido");grid.append(message);}
  }
}
function showAdminCardImage(path){
  const image=document.getElementById("adminCardImagePreview");
  const empty=document.getElementById("adminCardImageEmpty");
  if(image){image.hidden=!path;if(path)image.src=path;else image.removeAttribute("src");}
  if(empty)empty.hidden=Boolean(path);
}
function updateAdminCardRarity(preferred){
  const category=document.getElementById("adminCardCategory").value;
  const rarity=document.getElementById("adminCardRarity");
  const options=category==="normal"
    ?[{value:"common",label:"Común"},{value:"rare",label:"Rara"},{value:"epic",label:"Épica"},{value:"legendary",label:"Legendaria"}]
    :[{value:category,label:category==="tramo"?"Tramo":"Fiesta"}];
  rarity.replaceChildren();
  options.forEach(option=>{const item=document.createElement("option");item.value=option.value;item.textContent=option.label;rarity.append(item);});
  rarity.value=options.some(option=>option.value===preferred)?preferred:options[0].value;
  const countInput=document.getElementById("adminCardCounts");
  if(category!=="normal"){countInput.checked=false;countInput.disabled=true;}
  else{countInput.disabled=false;}
}
function openAdminCardEditor(card){
  if(!isAdmin)return;
  const form=document.getElementById("adminCardForm");
  form.reset();
  adminEditingCardId=card?.id||null;
  adminEditingImagePath=card?.image_path||null;
  adminPendingImageFile=null;
  if(adminImageObjectUrl){URL.revokeObjectURL(adminImageObjectUrl);adminImageObjectUrl=null;}
  document.getElementById("adminCardEditorTitle").textContent=card?"Editar carta":"Crear nueva carta";
  document.getElementById("adminCardName").value=card?.name||"";
  const slugInput=document.getElementById("adminCardSlug");
  slugInput.value=card?.slug||"";
  slugInput.disabled=false;
  slugInput.readOnly=Boolean(card);
  slugInput.dataset.touched=card?"true":"false";
  document.getElementById("adminCardCategory").value=card?.category||"normal";
  updateAdminCardRarity(card?.rarity||"common");
  document.getElementById("adminCardUses").value=Number(card?.uses_per_card||1);
  document.getElementById("adminCardScope").value=card?.target_scope||"self";
  document.getElementById("adminCardDisposition").value=card?.disposition||"consume";
  document.getElementById("adminCardDescription").value=card?.description||"";
  document.getElementById("adminCardCounts").checked=card?.counts_toward_normal_limit!==false;
  document.getElementById("adminCardAllowNoEffect").checked=card?.allow_no_effect_play===true;
  if(card?.category!=="normal")document.getElementById("adminCardCounts").disabled=true;
  document.getElementById("adminCardActive").checked=card?Boolean(card.is_active):true;
  const rouletteEligibleInput=document.getElementById("adminCardRouletteEligible");
  const rouletteHelp=document.getElementById("adminCardRouletteHelp");
  const hasActiveEvolution=Boolean(card?.has_active_evolution);
  rouletteEligibleInput.checked=card?card.roulette_eligible!==false&&!hasActiveEvolution:true;
  rouletteEligibleInput.disabled=hasActiveEvolution;
  rouletteHelp.textContent=hasActiveEvolution
    ?"Esta carta tiene una evolución activa, por eso queda excluida automáticamente de todas las ruletas."
    :"Activa esta opción para permitir que la carta se añada a una ruleta. La inclusión concreta se configura en Administración → Ruletas.";
  document.getElementById("adminCardImageFile").value="";
  document.getElementById("adminCardImageHelp").textContent=adminEditingImagePath?"Ilustración actual vinculada. Puedes reemplazarla con otro PNG.":"PNG hasta 5 MB. La imagen se subirá al almacenamiento de TypeLink al guardar.";
  document.getElementById("adminCardFormStatus").textContent="Completa los datos de la carta.";
  document.getElementById("adminCardFormStatus").classList.remove("is-error");
  showAdminCardImage(adminEditingImagePath);
  document.getElementById("adminCatalogListView").hidden=true;
  document.getElementById("adminCardEditorView").hidden=false;
  document.getElementById("adminCardName").focus();
}
async function uploadAdminCardImage(file,slug){
  const safeSlug=adminSlugFromName(slug)||"carta";
  const fileName=Date.now()+"-"+crypto.randomUUID()+".png";
  const objectPath="cards/"+safeSlug+"/"+fileName;
  const {data,error}=await authClient.storage.from("typelink-card-art").upload(objectPath,file,{
    cacheControl:"31536000",contentType:"image/png",upsert:false
  });
  if(error)throw error;
  const publicResult=authClient.storage.from("typelink-card-art").getPublicUrl(data.path);
  if(!publicResult?.data?.publicUrl)throw new Error("La imagen se subió, pero no pudimos generar su dirección pública.");
  return publicResult.data.publicUrl;
}
async function saveAdminCard(event){
  event.preventDefault();
  if(!isAdmin||!authClient){notify("No tienes permiso para guardar cartas.");return;}
  const saveButton=document.getElementById("adminCardSave");
  const status=document.getElementById("adminCardFormStatus");
  const name=document.getElementById("adminCardName").value.trim();
  const slug=document.getElementById("adminCardSlug").value.trim();
  const category=document.getElementById("adminCardCategory").value;
  const rarity=document.getElementById("adminCardRarity").value;
  const file=adminPendingImageFile;
  if(!name||!slug){status.textContent="Completa el nombre y el identificador.";status.classList.add("is-error");return;}
  if(file&&(file.type!=="image/png"||!file.name.toLowerCase().endsWith(".png"))){status.textContent="Solo se permiten imágenes PNG.";status.classList.add("is-error");return;}
  if(file&&file.size>5*1024*1024){status.textContent="La imagen supera el límite de 5 MB.";status.classList.add("is-error");return;}
  saveButton.disabled=true;saveButton.textContent="GUARDANDO...";
  status.classList.remove("is-error");status.textContent="Guardando carta e ilustración...";
  try{
    if(file){
      status.textContent="Subiendo PNG al almacenamiento seguro...";
      adminEditingImagePath=await uploadAdminCardImage(file,slug);
      adminPendingImageFile=null;
      document.getElementById("adminCardImageFile").value="";
      document.getElementById("adminCardImageHelp").textContent="PNG subido. Se vinculará al guardar la carta.";
      showAdminCardImage(adminEditingImagePath);
    }
    const payload={
      id:adminEditingCardId,
      slug:slug,
      name:name,
      category:category,
      rarity:rarity,
      description:document.getElementById("adminCardDescription").value,
      image_path:adminEditingImagePath,
      uses_per_card:Number(document.getElementById("adminCardUses").value),
      target_scope:document.getElementById("adminCardScope").value,
      disposition:document.getElementById("adminCardDisposition").value,
      counts_toward_normal_limit:document.getElementById("adminCardCounts").checked,
      allow_no_effect_play:document.getElementById("adminCardAllowNoEffect").checked,
      roulette_eligible:document.getElementById("adminCardRouletteEligible").checked,
      is_active:document.getElementById("adminCardActive").checked
    };
    const {data,error}=await authClient.rpc("admin_save_card",{p_card:payload});
    if(error)throw error;
    const saved=Array.isArray(data)?data[0]:data;
    if(!saved?.id)throw new Error("Supabase no devolvió la carta guardada.");
    adminPendingImageFile=null;
    if(adminImageObjectUrl){URL.revokeObjectURL(adminImageObjectUrl);adminImageObjectUrl=null;}
    notify(adminEditingCardId?"Carta actualizada correctamente.":"Nueva carta creada correctamente.");
    await loadAdminCatalog();
    await loadAdminRoulettePools();
    await loadPublicNormalCards();
    showAdminCatalogList();
  }catch(error){
    console.error("No se pudo guardar la carta:",error);
    status.textContent=error.message||"No se pudo guardar la carta.";
    status.classList.add("is-error");
    notify("No se pudo guardar la carta: "+(error.message||"error desconocido"));
  }finally{
    saveButton.disabled=false;saveButton.textContent="GUARDAR CARTA ↗";
  }
}
function getCardArtStoragePath(imagePath){
  if(!imagePath||!authClient)return null;
  try{
    const parsed=new URL(imagePath);
    const expectedOrigin=new URL(window.TYPELINK_SUPABASE_CONFIG.url).origin;
    const prefix="/storage/v1/object/public/typelink-card-art/";
    if(parsed.origin!==expectedOrigin||!parsed.pathname.startsWith(prefix))return null;
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  }catch{return null;}
}
async function deleteAdminCard(card){
  if(!isAdmin||!authClient||!card?.id){notify("No tienes permiso para borrar cartas.");return;}
  const confirmed=window.confirm(
    "¿Borrar definitivamente «"+card.name+"»?\n\n"+
    "Se eliminará del catálogo y de las ruletas. Si tiene copias en inventarios o reglas de evolución, el servidor bloqueará el borrado para proteger el historial.\n\n"+
    "Cuando una carta ya fue entregada a un jugador, debes desactivarla en lugar de borrarla."
  );
  if(!confirmed)return;
  try{
    const {data,error}=await authClient.rpc("admin_delete_card",{p_card_id:card.id});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("Supabase no confirmó el borrado de la carta.");
    let artworkRemoved=true;
    const storagePath=getCardArtStoragePath(card.image_path);
    if(storagePath){
      const {error:removeError}=await authClient.storage.from("typelink-card-art").remove([storagePath]);
      if(removeError){artworkRemoved=false;console.warn("La carta se borró, pero no se pudo retirar el PNG:",removeError.message);}
    }
    adminCatalogItems=adminCatalogItems.filter(item=>item.id!==card.id);
    renderAdminCatalog();
    await loadPublicNormalCards();
    notify(artworkRemoved?"«"+card.name+"» se ha borrado del catálogo.":"La carta se borró; su PNG quedó pendiente de limpieza.");
  }catch(error){
    console.error("No se pudo borrar la carta:",error);
    notify(error.message||"No se pudo borrar la carta.");
  }
}

async function loadRouletteAccess(){
  if(!authClient||!currentAuthUser){
    rouletteAccessByPool={legendary:0,fiesta:0};
    updateSpecialRouletteAccessUI();
    return;
  }
  const {data,error}=await authClient.rpc("get_my_roulette_unlocks");
  if(error){
    console.warn("No se pudieron cargar los accesos de ruletas:",error.message);
    return;
  }
  const next={legendary:0,fiesta:0};
  (Array.isArray(data)?data:[]).forEach(row=>{
    const slug=row.pool_slug;
    if(!Object.prototype.hasOwnProperty.call(next,slug))return;
    if(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now())return;
    next[slug]+=Math.max(0,Number(row.spins_granted||0)-Number(row.spins_used||0));
  });
  rouletteAccessByPool=next;
  updateSpecialRouletteAccessUI();
}
function updateSpecialRouletteAccessUI(){
  const definitions=[
    {slug:"legendary",countId:"legendaryAccessCount",buttonId:"legendarySpinButton",hintId:"legendaryAccessHint",ticket:"Legenleta",label:"la Ruleta Legendaria"},
    {slug:"fiesta",countId:"fiestaAccessCount",buttonId:"fiestaSpinButton",hintId:"fiestaAccessHint",ticket:"Rumba",label:"la Ruleta Fiesta"}
  ];
  definitions.forEach(item=>{
    const count=Math.max(0,Number(rouletteAccessByPool[item.slug]||0));
    setText(item.countId,count);
    const button=document.getElementById(item.buttonId);
    if(button){
      button.disabled=spinning||!currentAuthUser||count<=0;
      button.textContent=count>0
        ?(item.slug==="legendary"?"GIRAR RULETA LEGENDARIA":"GIRAR RULETA FIESTA")+" · "+count
        :("CANJEA "+item.ticket.toUpperCase());
    }
    setText(item.hintId,!currentAuthUser
      ?"Inicia sesión con Discord para ver tus accesos."
      :count>0
        ?"Tienes "+count+" "+(count===1?"giro disponible":"giros disponibles")+". El acceso se consume al recibir un premio."
        :"Canjea "+item.ticket+" en tu baraja para conseguir 1 giro.");
  });
}
function mapRouletteCardRecord(card){
  const rarityLabels={common:"Común",rare:"Rara",epic:"Épica",legendary:"Legendaria",tramo:"Tramo",fiesta:"Fiesta"};
  const rarityColors={common:"#8d9a9f",rare:"#6f8dbb",epic:"#bd7a4e",legendary:"#d4ae5b",fiesta:"#a66c77"};
  return {
    id:card.slug,slug:card.slug,name:card.name,rarity:rarityLabels[card.rarity]||card.rarity,
    color:rarityColors[card.rarity]||"#8d9a9f",description:card.description,
    art:card.image_path||("assets/"+card.slug+".svg"),image_path:card.image_path,
    weight:Number(card.weight||1)
  };
}
function shuffleRouletteItems(items){
  for(let i=items.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [items[i],items[j]]=[items[j],items[i]];
  }
  return items;
}
function setWheelCards(cards,poolSlug="normal",forceShuffle=false){
  const nextCards=[...cards];
  const poolChanged=wheelPoolSlug!==poolSlug;
  if(forceShuffle||poolChanged){
    shuffleRouletteItems(nextCards);
    wheelPoolSlug=poolSlug;
    rotation=0;
  }else{
    const previousOrder=new Map(CARDS.map((card,index)=>[card.slug,index]));
    nextCards.sort((a,b)=>{
      const aIndex=previousOrder.get(a.slug);
      const bIndex=previousOrder.get(b.slug);
      if(aIndex===undefined&&bIndex===undefined)return 0;
      if(aIndex===undefined)return 1;
      if(bIndex===undefined)return -1;
      return aIndex-bIndex;
    });
  }
  CARDS.splice(0,CARDS.length,...nextCards);
  nextCards.forEach(card=>{
    const image=new Image();
    image.src=card.image_path||("assets/"+card.slug+".svg");
    image.onload=()=>drawWheel();
    cardArtImages[card.id]=image;
    cardArtImages[card.slug]=image;
  });
  drawWheel();
}
function shuffleWheelCards(){
  if(spinning){notify("Espera a que termine el giro para mezclar la ruleta.");return;}
  if(CARDS.length<2){notify("No hay suficientes cartas para mezclar la ruleta.");return;}
  shuffleRouletteItems(CARDS);
  rotation=0;
  drawWheel();
  notify("¡Ruleta mezclada! Las probabilidades de cada carta siguen siendo las mismas.");
}
async function getPublicRouletteCards(poolSlug){
  if(!authClient||!currentAuthUser)return [];
  const {data,error}=await authClient.rpc("get_active_roulette_cards",{p_pool_slug:poolSlug});
  if(error)throw error;
  return (Array.isArray(data)?data:[]).map(mapRouletteCardRecord);
}

async function loadPublicNormalCards(){
  if(!authClient||!currentAuthUser)return;
  try{
    const cards=await getPublicRouletteCards("normal");
    setWheelCards(cards,"normal");
  }catch(error){
    console.warn("No se pudo cargar la ruleta normal configurada:",error.message);
  }
}
async function loadAdminAccess(){
  isAdmin=false;
  adminAccessChecked=false;
  renderAdminAccess();
  if(!authClient||!currentAuthUser)return false;
  try{
    const {data,error}=await authClient.rpc("is_current_user_admin");
    if(error)throw error;
    isAdmin=data===true;
    adminAccessChecked=true;
  }catch(error){
    console.error("No se pudo verificar el acceso administrativo:",error);
    isAdmin=false;
    adminAccessChecked=false;
  }
  renderAdminAccess();
  if(!isAdmin&&!document.getElementById("page-admin").hidden)setPage("home");
  return isAdmin;
}

async function activateUserSession(user){
  if(!user){
    if(inventoryChannel&&authClient)authClient.removeChannel(inventoryChannel);
    if(profilesChannel&&authClient)authClient.removeChannel(profilesChannel);
    if(activityChannel&&authClient)authClient.removeChannel(activityChannel);
    if(notificationChannel&&authClient)authClient.removeChannel(notificationChannel);
    inventoryChannel=null;profilesChannel=null;activityChannel=null;notificationChannel=null;
    notificationCache=[];
    setNotificationBadge(0);
    activeSessionUserId=null;currentProfile=null;isAdmin=false;adminAccessChecked=false;cloudMode=false;cloudDeck=[];cloudRoute=[];cloudSpecial=[];cloudInventory=[];
    currentTramo=0;tramoSpinsRemaining=0;bonusTramoSpinsRemaining=0;
    normalCardLimit=5;cardsPerTramo=2;normalSpinsPerTramo=3;
    rouletteAccessByPool={legendary:0,fiesta:0};
    playerTypeStatus=Object.create(null);incomingCardEffects=[];
    evolutionRulesBySource=Object.create(null);cardEffectsById=Object.create(null);
    demoDeck=loadDeck();demoRouteState=loadRouteState();
    renderAuthState(null);renderDeck();loadPlayers();loadActivityFeed();renderTypeTracker();renderIncomingEffects([]);renderAdminAccess();
    if(!document.getElementById("page-admin").hidden)setPage("home");
    return;
  }
  if(activeSessionUserId===user.id&&cloudMode)return;
  activeSessionUserId=user.id;currentAuthUser=user;cloudMode=true;
  cloudDeck=[];cloudRoute=[];cloudSpecial=[];cloudInventory=[];
  renderAuthState(user);renderDeck();
  await Promise.all([loadAdminAccess(),loadMyProfile(),loadCloudInventory(),loadPlayers(),loadActivityFeed(),loadNotifications(),loadPublicNormalCards(),loadRouletteAccess()]);
  renderAdminAccess();
  setupRealtime();
}

function startWheelAnimation(card){
  return new Promise(resolve=>{
    const index=Math.max(0,CARDS.findIndex(item=>item.slug===card.slug));
    const totalWeight=CARDS.reduce((sum,item)=>sum+Math.max(1,Number(item.weight||1)),0);
    const prefixWeight=CARDS.slice(0,index).reduce((sum,item)=>sum+Math.max(1,Number(item.weight||1)),0);
    const selectedWeight=Math.max(1,Number(CARDS[index]?.weight||card.weight||1));
    const desiredNorm=((TAU-((prefixWeight+selectedWeight/2)/Math.max(1,totalWeight))*TAU)%TAU+TAU)%TAU;
    const currentNorm=((rotation%TAU)+TAU)%TAU;
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
  if(!currentAuthUser||!authClient){notify("Inicia sesión para girar.");return;}
  if(activeNormalCards().length>=normalCardLimit){notify("Tu baraja ya tiene el límite de "+normalCardLimit+" cartas normales.");return;}
  if(tramoSpinsRemaining+bonusTramoSpinsRemaining<=0){notify("Sin giros. Avanza de tramo para recibir "+normalSpinsPerTramo+" giros.");return;}
  spinning=true;renderDeck();
  try{
    // The server selects and awards the card in one protected transaction.
    const {data,error}=await authClient.rpc("draw_random_card");
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result||!result.slug)throw new Error("El servidor no devolvió una carta válida.");
    await loadPublicNormalCards();
    let card=CARDS.find(item=>item.slug===result.slug);
    if(!card){
      card={
        id:result.slug,slug:result.slug,name:result.name,rarity:result.rarity,
        image_path:result.image_path,description:result.description,
        art:result.image_path||("assets/"+result.slug+".svg"),
        weight:Number(result.roulette_weight||1)
      };
      CARDS.push(card);
      const fallbackImage=new Image();fallbackImage.src=card.art;fallbackImage.onload=()=>drawWheel();cardArtImages[card.slug]=fallbackImage;
    }
    notify("¡Carta obtenida! La ruleta está girando...");
    await startWheelAnimation(card);
    await loadCloudInventory();
    showResult(card);
    await showSpinReward(card);
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

async function spinSpecialRoulette(poolSlug){
  if(spinning)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord para usar las ruletas especiales.");return;}
  if(!["legendary","fiesta"].includes(poolSlug)){notify("La ruleta especial seleccionada no es válida.");return;}
  if(Number(rouletteAccessByPool[poolSlug]||0)<=0){
    notify(poolSlug==="legendary"?"Canjea Legenleta para conseguir un giro Legendario.":"Canjea Rumba para conseguir un giro Fiesta.");
    return;
  }
  const poolName=poolSlug==="legendary"?"Ruleta Legendaria":"Ruleta Fiesta";
  spinning=true;renderDeck();
  try{
    const prizeCards=await getPublicRouletteCards(poolSlug);
    if(!prizeCards.length){
      throw new Error(poolName+" todavía no está abierta o no tiene premios activos. Tu acceso se conserva.");
    }
    setWheelCards(prizeCards,poolSlug);
    const {data,error}=await authClient.rpc("draw_special_roulette_card",{p_pool_slug:poolSlug});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result||!result.slug)throw new Error("El servidor no devolvió un premio válido.");
    let card=CARDS.find(item=>item.slug===result.slug);
    if(!card){
      card=mapRouletteCardRecord(result);
      CARDS.push(card);
    }
    card.image_path=result.image_path||card.image_path;
    card.art=card.image_path||card.art;
    notify("¡Acceso validado! La "+poolName+" está girando...");
    await startWheelAnimation(card);
    await loadCloudInventory();
    await loadRouletteAccess();
    showResult(card);
    await showSpinReward(card);
    notify("¡Has obtenido "+card.name+" en la "+poolName+"!");
  }catch(error){
    console.error("No se pudo completar el giro especial:",error);
    notify("No pudimos girar "+poolName+": "+(error.message||"error desconocido"));
    await loadRouletteAccess();
  }finally{
    await loadPublicNormalCards();
    spinning=false;
    renderDeck();
  }
}

async function startNewTramo(){
  if(spinning)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión para avanzar.");return;}
  try{
    await loadCardEngineConfig();
    renderDeck();
    if(tramoSpinsRemaining+bonusTramoSpinsRemaining>0){
      notify("Utiliza los giros pendientes antes de avanzar de tramo.");return;
    }
    spinning=true;renderDeck();
    const {data,error}=await authClient.rpc("start_new_tramo");
    if(error)throw error;
    await loadCloudInventory();
    await loadProfileMechanics();
    const cardCount=Array.isArray(data?.cards)?data.cards.length:cardsPerTramo;
    const grantedSpins=Number(data?.normal_spins_remaining??normalSpinsPerTramo);
    const evolutions=Array.isArray(data?.automatic_evolutions)?data.automatic_evolutions:[];
    const evolvedCount=Number(data?.automatic_evolutions_count??evolutions.length);
    const tramo=data?.tramo_number||currentTramo;
    const evolutionNames=evolutions.slice(0,2).map(item=>(item.source_name||"Carta")+" → "+(item.result_name||"evolución")).join("; ");
    notify("¡Tramo "+tramo+" iniciado! Recibiste "+cardCount+" cartas de tramo y "+grantedSpins+" giros normales."+
      (evolvedCount>0?" Evoluciones automáticas: "+evolvedCount+(evolutionNames?" · "+evolutionNames:"")+".":""));
  }catch(error){
    console.error("No se pudo avanzar de tramo:",error);
    notify("No se pudo avanzar de tramo: "+(error.message||"error desconocido"));
    await loadCloudInventory();
  }finally{
    spinning=false;renderDeck();
  }
}



function renderAdminProgressionSettings(data){
  const settings=data?.settings||{},cards=data?.tramo_cards||{};
  const activeCards=Array.isArray(cards.active_cards)?cards.active_cards:[];
  const normalLimit=Number(settings.normal_card_limit||5);
  const cardsPer=Number(settings.cards_per_tramo||2);
  const spinsPer=Number(settings.normal_spins_per_tramo||3);
  document.getElementById("adminProgressionNormalLimit").value=String(normalLimit);
  document.getElementById("adminProgressionCardsPerTramo").value=String(cardsPer);
  document.getElementById("adminProgressionSpinsPerTramo").value=String(spinsPer);
  setText("adminProgressionCurrentLimit",normalLimit);
  setText("adminProgressionCurrentCards",cardsPer);
  setText("adminProgressionCurrentSpins",spinsPer);
  setText("adminProgressionActiveCardsCount",Number(cards.active_count||0)+" CARTAS ACTIVAS · "+Number(cards.total_count||0)+" EN CATÁLOGO");
  const list=document.getElementById("adminProgressionActiveCardsList");
  list.replaceChildren();
  if(!activeCards.length){
    const empty=document.createElement("span");empty.className="admin-progression-card-chip is-empty";empty.textContent="No hay cartas de tramo activas";list.append(empty);
  }else{
    activeCards.forEach(card=>{
      const chip=document.createElement("span");chip.className="admin-progression-card-chip";chip.textContent=card.name||card.slug||"Carta de tramo";list.append(chip);
    });
  }
  const enough=Number(cards.active_count||0)>=cardsPer;
  setText("adminProgressionCatalogHint",enough
    ?"Cartas suficientes."
    :"Faltan cartas activas.");
  setAdminPlatformIndicator("adminProgressionStatus",enough?"online":"warning",enough?"CONFIGURACIÓN CARGADA":"REVISAR CATÁLOGO");
  setText("adminProgressionSaveStatus","Última configuración guardada: "+formatAdminPlatformDate(settings.updated_at));
}
async function loadAdminProgressionSettings(){
  if(!authClient||!currentAuthUser||!isAdmin){notify("Acceso reservado al administrador.");return;}
  const refresh=document.getElementById("adminProgressionRefresh");
  if(refresh){refresh.disabled=true;refresh.textContent="CONSULTANDO...";}
  setText("adminProgressionSaveStatus","Consultando reglas del evento...");
  try{
    const {data,error}=await authClient.rpc("admin_get_event_progression_settings");
    if(error)throw error;
    if(!data?.settings)throw new Error("Supabase no devolvió la configuración del evento.");
    renderAdminProgressionSettings(data);
  }catch(error){
    console.error("No se pudo cargar la progresión del evento:",error);
    setAdminPlatformIndicator("adminProgressionStatus","offline","SIN DATOS");
    setText("adminProgressionSaveStatus","No se pudo cargar la configuración: "+(error.message||"error desconocido."));
  }finally{
    if(refresh){refresh.disabled=false;refresh.textContent="↻ ACTUALIZAR";}
  }
}
async function saveAdminProgressionSettings(){
  if(!authClient||!currentAuthUser||!isAdmin){notify("Acceso reservado al administrador.");return;}
  const normalLimit=Number(document.getElementById("adminProgressionNormalLimit").value);
  const cardsPer=Number(document.getElementById("adminProgressionCardsPerTramo").value);
  const spinsPer=Number(document.getElementById("adminProgressionSpinsPerTramo").value);
  if(!Number.isInteger(normalLimit)||normalLimit<1||normalLimit>20){setText("adminProgressionSaveStatus","El límite de baraja debe ser un entero entre 1 y 20.");return;}
  if(!Number.isInteger(cardsPer)||cardsPer<1||cardsPer>10){setText("adminProgressionSaveStatus","Las cartas por tramo deben ser un entero entre 1 y 10.");return;}
  if(!Number.isInteger(spinsPer)||spinsPer<1||spinsPer>20){setText("adminProgressionSaveStatus","Los giros por avance deben ser un entero entre 1 y 20.");return;}
  const button=document.getElementById("adminProgressionSave");
  button.disabled=true;button.textContent="GUARDANDO...";
  setText("adminProgressionSaveStatus","Guardando reglas...");
  try{
    const {data,error}=await authClient.rpc("admin_save_event_progression_settings",{
      p_normal_card_limit:normalLimit,p_cards_per_tramo:cardsPer,p_normal_spins_per_tramo:spinsPer
    });
    if(error)throw error;
    if(!data?.settings)throw new Error("El servidor no confirmó la nueva configuración.");
    renderAdminProgressionSettings(data);
    setText("adminProgressionSaveStatus","Reglas guardadas. Se aplican en el próximo avance.");
    notify("Progresión del evento actualizada.");
    await loadCloudInventory();
  }catch(error){
    console.error("No se pudo guardar la progresión del evento:",error);
    setText("adminProgressionSaveStatus",error.message||"No se pudieron guardar las reglas.");
    setAdminPlatformIndicator("adminProgressionStatus","warning","NO GUARDADO");
  }finally{
    button.disabled=false;button.textContent="GUARDAR REGLAS ↗";
  }
}

function formatAdminPlatformBytes(value){
  const bytes=Math.max(0,Number(value)||0);
  if(bytes<1024)return Math.round(bytes)+" B";
  const units=["KB","MB","GB","TB"];let amount=bytes/1024,index=0;
  while(amount>=1024&&index<units.length-1){amount/=1024;index++;}
  return amount.toLocaleString("es-CO",{maximumFractionDigits:1})+" "+units[index];
}
function formatAdminPlatformDate(value){
  if(!value)return "Sin registros";
  const date=new Date(value);if(Number.isNaN(date.getTime()))return "—";
  return new Intl.DateTimeFormat("es-CO",{dateStyle:"medium",timeStyle:"short"}).format(date);
}
function setAdminPlatformIndicator(id,state,label){
  const element=document.getElementById(id);if(!element)return;
  element.className="admin-platform-state is-"+state;element.textContent=label;
}
function renderAdminPlatformBuckets(buckets){
  const container=document.getElementById("adminPlatformBuckets");if(!container)return;
  container.replaceChildren();
  if(!Array.isArray(buckets)||!buckets.length){const empty=document.createElement("div");empty.className="admin-catalog-loading";empty.textContent="No hay buckets registrados.";container.append(empty);return;}
  buckets.forEach(bucket=>{
    const row=document.createElement("article");row.className="admin-platform-bucket";
    const copy=document.createElement("div");copy.className="admin-platform-bucket-copy";
    const name=document.createElement("strong");name.textContent=bucket.name||"Bucket sin nombre";
    const access=document.createElement("small");access.textContent=bucket.is_public?"Acceso público":"Acceso privado";
    copy.append(name,access);
    const stats=document.createElement("div");stats.className="admin-platform-bucket-stats";
    const count=document.createElement("strong");count.textContent=Number(bucket.file_count||0).toLocaleString("es-CO")+" archivos";
    const size=document.createElement("small");size.textContent=formatAdminPlatformBytes(bucket.size_bytes);
    stats.append(count,size);row.append(copy,stats);container.append(row);
  });
}
function renderAdminPlatformFiles(files){
  const container=document.getElementById("adminPlatformFiles");if(!container)return;
  container.replaceChildren();
  if(!Array.isArray(files)||!files.length){const empty=document.createElement("div");empty.className="admin-catalog-loading";empty.textContent="Todavía no hay archivos almacenados.";container.append(empty);return;}
  files.forEach(file=>{
    const row=document.createElement("article");row.className="admin-platform-file";
    const copy=document.createElement("div");copy.className="admin-platform-file-copy";
    const name=document.createElement("strong");name.textContent=file.name||"Archivo sin nombre";name.title=file.name||"";
    const meta=document.createElement("small");meta.textContent=(file.bucket||"Storage")+" · "+formatAdminPlatformDate(file.created_at);
    copy.append(name,meta);
    const size=document.createElement("span");size.className="admin-platform-file-size";size.textContent=formatAdminPlatformBytes(file.size_bytes);
    row.append(copy,size);container.append(row);
  });
}
function renderAdminPlatformModules(data){
  const container=document.getElementById("adminPlatformModules");if(!container)return;
  container.replaceChildren();
  const catalog=data.catalog||{},pools=Array.isArray(data.roulettes)?data.roulettes:[];
  const activePools=pools.filter(pool=>pool.is_active).length;
  const activePoolCards=pools.reduce((total,pool)=>total+Number(pool.active_cards||0),0);
  const activity=data.activity||{},settings=data.event_settings||{};
  const modules=[
    {name:"Catálogo de cartas",value:Number(catalog.active||0)+"/"+Number(catalog.total||0)+" activas",note:Number(catalog.inactive||0)+" desactivadas",state:Number(catalog.active||0)>0?"online":"warning"},
    {name:"Ruletas",value:activePools+"/"+pools.length+" abiertas",note:activePoolCards+" cartas habilitadas.",state:activePools>0?"online":"warning"},
    {name:"Muro de cartas",value:Number(activity.total||0).toLocaleString("es-CO")+" movimientos",note:Number(activity.last_7_days||0)+" en 7 días · último: "+formatAdminPlatformDate(activity.last_activity_at),state:Number(activity.total||0)>0?"online":"warning"},
    {name:"Progresión del evento",value:settings.singleton?(Number(settings.cards_per_tramo||0)+" cartas · "+Number(settings.normal_spins_per_tramo||3)+" giros por avance"):"Sin configuración",note:settings.singleton?("Límite base: "+Number(settings.normal_card_limit||0)+" · progreso individual"):"No se encontró la configuración principal del evento.",state:settings.singleton?"online":"warning"}
  ];
  modules.forEach(module=>{
    const row=document.createElement("article");row.className="admin-platform-module";
    const marker=document.createElement("span");marker.className="admin-platform-module-marker is-"+module.state;
    const copy=document.createElement("div");copy.className="admin-platform-module-copy";
    const name=document.createElement("strong");name.textContent=module.name;
    const value=document.createElement("span");value.textContent=module.value;
    const note=document.createElement("small");note.textContent=module.note;copy.append(name,value,note);
    const status=document.createElement("span");status.className="admin-platform-state is-"+module.state;status.textContent=module.state==="online"?"REGISTRADO":"REVISAR";
    row.append(marker,copy,status);container.append(row);
  });
}
function renderAdminPlatformStatus(data){
  const database=data.database||{},storage=data.storage||{},auth=data.auth||{},activity=data.activity||{};
  const databaseOk=database.status==="online",storageOk=storage.status==="online",authOk=auth.status==="online";
  const healthy=databaseOk&&storageOk&&authOk;
  setText("adminPlatformOverallStatus",healthy?"SERVICIOS OPERATIVOS":"ATENCIÓN REQUERIDA");
  setText("adminPlatformLastCheck","Última comprobación: "+formatAdminPlatformDate(data.checked_at));
  setAdminPlatformIndicator("adminPlatformOverallPill",healthy?"online":"warning",healthy?"OPERATIVA":"REVISAR");
  setAdminPlatformIndicator("adminPlatformApiState","online","RESPONDE");
  setAdminPlatformIndicator("adminPlatformDatabaseState",databaseOk?"online":"offline",databaseOk?"CONECTADA":"SIN CONEXIÓN");
  setAdminPlatformIndicator("adminPlatformStorageState",storageOk?"online":"offline",storageOk?"DISPONIBLE":"SIN CONEXIÓN");
  setAdminPlatformIndicator("adminPlatformAuthState",authOk?"online":"offline",authOk?"DISPONIBLE":"SIN CONEXIÓN");
  setText("adminPlatformDbSize",database.size_pretty||formatAdminPlatformBytes(database.size_bytes));
  setText("adminPlatformDbMeta",Number(database.public_tables||0).toLocaleString("es-CO")+" tablas públicas · "+(database.name||"PostgreSQL"));
  setText("adminPlatformStorageSize",formatAdminPlatformBytes(storage.size_bytes));
  setText("adminPlatformStorageMeta",Number(storage.object_count||0).toLocaleString("es-CO")+" archivos en "+Number(storage.bucket_count||0).toLocaleString("es-CO")+" buckets");
  setText("adminPlatformUsers",Number(auth.users||0).toLocaleString("es-CO"));
  setText("adminPlatformProfiles","Perfiles TypeLink: "+Number(auth.profiles||0).toLocaleString("es-CO"));
  setText("adminPlatformActivityCount",Number(activity.last_7_days||0).toLocaleString("es-CO")+" movimientos");
  setText("adminPlatformActivityMeta","Últimos 7 días · total histórico: "+Number(activity.total||0).toLocaleString("es-CO"));
  setText("adminPlatformBucketCount",Number(storage.bucket_count||0).toLocaleString("es-CO")+" BUCKETS");
  renderAdminPlatformBuckets(storage.buckets);renderAdminPlatformFiles(storage.recent_files);renderAdminPlatformModules(data);
}
function renderAdminPlatformError(){
  setText("adminPlatformOverallStatus","NO SE PUDO COMPLETAR LA COMPROBACIÓN");
  setText("adminPlatformLastCheck","Comprueba tu conexión y vuelve a actualizar.");
  setAdminPlatformIndicator("adminPlatformOverallPill","offline","SIN DATOS");
  setAdminPlatformIndicator("adminPlatformApiState","offline","SIN RESPUESTA");
  setAdminPlatformIndicator("adminPlatformDatabaseState","pending","SIN DATOS");
  setAdminPlatformIndicator("adminPlatformStorageState","pending","SIN DATOS");
  setAdminPlatformIndicator("adminPlatformAuthState","pending","SIN DATOS");
}
async function loadAdminPlatformStatus(){
  if(!authClient||!currentAuthUser||!isAdmin){renderAdminPlatformError();return;}
  const button=document.getElementById("adminPlatformRefresh");
  if(button){button.disabled=true;button.textContent="CONSULTANDO...";}
  setText("adminPlatformOverallStatus","CONSULTANDO SERVICIOS");
  setAdminPlatformIndicator("adminPlatformOverallPill","pending","CONSULTANDO");
  try{
    const {data,error}=await authClient.rpc("admin_get_platform_status");
    if(error)throw error;
    if(!data||typeof data!=="object")throw new Error("Supabase no devolvió datos de estado.");
    renderAdminPlatformStatus(data);
  }catch(error){
    console.error("No se pudo consultar el estado de la plataforma:",error);renderAdminPlatformError();
  }finally{if(button){button.disabled=false;button.textContent="↻ ACTUALIZAR";}}
}

function setPage(page){
  if(page==="admin"&&(!currentAuthUser||!isAdmin)){
    notify("Este apartado es privado y solo está disponible para administradores autorizados.");
    page="home";
  }
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
  if(page==="notifications")loadNotifications();
  if(page==="deck"&&cloudMode)loadCloudInventory();
  if(page==="profile"&&currentAuthUser)loadMyProfile();
  if(page==="admin"&&isAdmin){renderAdminAccess();showAdminOverview();}
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
document.getElementById("markAllNotificationsRead").addEventListener("click",markAllNotificationsRead);
document.getElementById("openAdminProgression").addEventListener("click",async()=>{
  if(!isAdmin){notify("Acceso reservado al administrador.");return;}
  showAdminOverview();
  document.getElementById("adminOverview").hidden=true;
  document.getElementById("adminProgressionWorkspace").hidden=false;
  await loadAdminProgressionSettings();
  window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("adminProgressionBack").addEventListener("click",showAdminOverview);
document.getElementById("adminProgressionRefresh").addEventListener("click",loadAdminProgressionSettings);
document.getElementById("adminProgressionSave").addEventListener("click",saveAdminProgressionSettings);

document.getElementById("openAdminPlatformStatus").addEventListener("click",async()=>{
  if(!isAdmin){notify("Acceso reservado al administrador.");return;}
  showAdminOverview();
  document.getElementById("adminOverview").hidden=true;
  document.getElementById("adminPlatformWorkspace").hidden=false;
  await loadAdminPlatformStatus();
  window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("adminPlatformBack").addEventListener("click",showAdminOverview);
document.getElementById("adminPlatformRefresh").addEventListener("click",loadAdminPlatformStatus);
document.getElementById("openAdminCatalog").addEventListener("click",async()=>{
  if(!isAdmin){notify("Acceso reservado al administrador.");return;}
  document.getElementById("adminOverview").hidden=true;
  document.getElementById("adminCatalogWorkspace").hidden=false;
  document.getElementById("adminCatalogListView").hidden=false;
  document.getElementById("adminCardEditorView").hidden=true;
  await loadAdminCatalog();
  window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("adminCatalogBack").addEventListener("click",showAdminOverview);
document.getElementById("openAdminMechanics").addEventListener("click",async()=>{
  if(!isAdmin){notify("Acceso reservado al administrador.");return;}
  document.getElementById("adminOverview").hidden=true;
  document.getElementById("adminCatalogWorkspace").hidden=true;
  document.getElementById("adminTrainersWorkspace").hidden=true;
  document.getElementById("adminRouletteWorkspace").hidden=true;
  document.getElementById("adminMechanicsWorkspace").hidden=false;
  document.getElementById("adminMechanicsListView").hidden=false;
  document.getElementById("adminMechanicsEditorView").hidden=true;
  await loadAdminMechanics();
  window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("adminMechanicsBack").addEventListener("click",showAdminOverview);
document.getElementById("adminMechanicsEditorBack").addEventListener("click",()=>{
  document.getElementById("adminMechanicsListView").hidden=false;
  document.getElementById("adminMechanicsEditorView").hidden=true;
});
document.getElementById("adminMechanicsSearch").addEventListener("input",renderAdminMechanicsList);
document.getElementById("adminMechanicsCategory").addEventListener("change",renderAdminMechanicsList);
document.getElementById("adminAddEffect").addEventListener("click",()=>{
  const list=document.getElementById("adminMechanicsEffectsList");
  if(list.querySelectorAll(".admin-mechanics-effect-row").length>=10){notify("Puedes configurar hasta 10 efectos por carta.");return;}
  const empty=list.querySelector(".profile-module-empty");if(empty)empty.remove();
  list.append(createAdminEffectRow());
});
document.getElementById("adminEvolutionEnabled").addEventListener("change",event=>{
  document.getElementById("adminEvolutionFields").hidden=!event.target.checked;
  document.getElementById("adminEvolutionDisabledNote").hidden=event.target.checked;
});
document.getElementById("adminEvolutionTrigger").addEventListener("change",updateAdminEvolutionMethodNote);
document.getElementById("adminEvolutionSameTramo").addEventListener("change",updateAdminEvolutionMethodNote);
document.getElementById("adminSaveMechanics").addEventListener("click",saveAdminMechanics);

document.getElementById("openAdminRoulettes").addEventListener("click",async()=>{
  if(!isAdmin){notify("Acceso reservado al administrador.");return;}
  document.getElementById("adminOverview").hidden=true;
  document.getElementById("adminCatalogWorkspace").hidden=true;
  document.getElementById("adminTrainersWorkspace").hidden=true;
  document.getElementById("adminRouletteWorkspace").hidden=false;
  showAdminRouletteList();
  await loadAdminRoulettePools();
  window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("adminRoulettesBack").addEventListener("click",showAdminOverview);
document.getElementById("adminRouletteEditorBack").addEventListener("click",showAdminRouletteList);
document.getElementById("adminRouletteSave").addEventListener("click",saveAdminRoulettePool);
document.getElementById("adminRouletteCardsGrid").addEventListener("input",event=>{
  if(event.target.matches('[data-role="weight"]'))updateAdminRouletteProbabilities();
});
document.getElementById("adminRouletteCardsGrid").addEventListener("change",event=>{
  if(event.target.matches('[data-role="include"],[data-role="member-active"],[data-role="weight"]'))updateAdminRouletteProbabilities();
});
document.getElementById("openAdminTrainers").addEventListener("click",async()=>{
  if(!isAdmin){notify("Acceso reservado al administrador.");return;}
  document.getElementById("adminOverview").hidden=true;
  document.getElementById("adminCatalogWorkspace").hidden=true;
  document.getElementById("adminTrainersWorkspace").hidden=false;
  showAdminTrainerList();
  await Promise.all([loadAdminTrainers(),loadAdminGiftCatalog()]);
  window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("adminTrainersBack").addEventListener("click",showAdminOverview);
document.getElementById("adminTrainerDetailBack").addEventListener("click",showAdminTrainerList);
document.getElementById("adminTrainersSearch").addEventListener("input",renderAdminTrainers);
document.getElementById("adminClearTrainerCardsButton").addEventListener("click",clearAdminTrainerCards);
document.getElementById("adminTrainerSaveTramo").addEventListener("click",saveAdminTrainerTramo);
document.getElementById("adminTrainerGrantCard").addEventListener("click",grantAdminTrainerCard);
document.getElementById("adminCreateCard").addEventListener("click",()=>openAdminCardEditor(null));
document.getElementById("adminCardCancel").addEventListener("click",showAdminCatalogList);
document.getElementById("adminCardForm").addEventListener("submit",saveAdminCard);
document.getElementById("spinRewardAccept").addEventListener("click",closeSpinReward);
document.getElementById("adminCatalogSearch").addEventListener("input",renderAdminCatalog);
document.getElementById("adminCatalogFilter").addEventListener("change",renderAdminCatalog);
document.getElementById("adminCardCategory").addEventListener("change",()=>updateAdminCardRarity());
document.getElementById("adminCardName").addEventListener("input",event=>{
  const slug=document.getElementById("adminCardSlug");
  if(!slug.disabled&&slug.dataset.touched!=="true")slug.value=adminSlugFromName(event.target.value);
});
document.getElementById("adminCardSlug").addEventListener("input",event=>{event.target.dataset.touched="true";});
document.getElementById("adminCardImageFile").addEventListener("change",event=>{
  const file=event.target.files?.[0]||null;
  adminPendingImageFile=file;
  if(adminImageObjectUrl){URL.revokeObjectURL(adminImageObjectUrl);adminImageObjectUrl=null;}
  if(file){
    if(file.type!=="image/png"||!file.name.toLowerCase().endsWith(".png")){
      adminPendingImageFile=null;event.target.value="";notify("Selecciona un archivo PNG.");return;
    }
    if(file.size>5*1024*1024){
      adminPendingImageFile=null;event.target.value="";notify("La imagen supera el límite de 5 MB.");return;
    }
    adminImageObjectUrl=URL.createObjectURL(file);
    showAdminCardImage(adminImageObjectUrl);
    document.getElementById("adminCardImageHelp").textContent=file.name+" · "+(file.size/1024/1024).toFixed(2)+" MB · Pendiente de subir al guardar.";
  }
});
document.getElementById("adminCardRemoveImage").addEventListener("click",()=>{
  adminEditingImagePath=null;adminPendingImageFile=null;
  if(adminImageObjectUrl){URL.revokeObjectURL(adminImageObjectUrl);adminImageObjectUrl=null;}
  document.getElementById("adminCardImageFile").value="";
  document.getElementById("adminCardImageHelp").textContent="La carta se guardará sin una ilustración vinculada.";
  showAdminCardImage(null);
});
spinButton.addEventListener("click",spin);
document.getElementById("shuffleWheelButton").addEventListener("click",shuffleWheelCards);
document.getElementById("legendarySpinButton").addEventListener("click",()=>spinSpecialRoulette("legendary"));
document.getElementById("fiestaSpinButton").addEventListener("click",()=>spinSpecialRoulette("fiesta"));
document.getElementById("tramoButton").addEventListener("click",startNewTramo);
document.getElementById("tramoButtonFull").addEventListener("click",startNewTramo);
document.getElementById("saveProfileButton").addEventListener("click",saveProfile);
document.getElementById("closePublicProfile").addEventListener("click",closePublicPlayer);
document.getElementById("closeCardAction").addEventListener("click",closeCardAction);
document.getElementById("cancelCardAction").addEventListener("click",closeCardAction);
document.getElementById("confirmCardAction").addEventListener("click",confirmCardAction);
document.getElementById("cardActionModal").addEventListener("click",event=>{if(event.target.id==="cardActionModal")closeCardAction();});
document.getElementById("publicProfileModal").addEventListener("click",event=>{if(event.target.id==="publicProfileModal")closePublicPlayer();});
document.getElementById("closeActivityCardModal").addEventListener("click",closeActivityCardPreview);
document.getElementById("activityCardModal").addEventListener("click",event=>{
  if(event.target.id==="activityCardModal")closeActivityCardPreview();
});
document.getElementById("activityFeed").addEventListener("click",event=>{
  const preview=event.target.closest?.(".activity-card-preview[data-image-path]");
  if(!preview)return;
  openActivityCardPreview(
    preview.dataset.imagePath,
    preview.dataset.cardName,
    preview.dataset.cardRarity,
    preview
  );
});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&!document.getElementById("activityCardModal").hidden){
    closeActivityCardPreview();
  }
});
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
