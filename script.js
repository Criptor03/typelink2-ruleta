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
  {slug:"normal",name:"Normal",color:"#A8A77A",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Normal.png"},
  {slug:"fuego",name:"Fuego",color:"#EE8130",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Fire.png"},
  {slug:"agua",name:"Agua",color:"#6390F0",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Water.png"},
  {slug:"electrico",name:"Eléctrico",color:"#F7D02C",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Electric.png"},
  {slug:"planta",name:"Planta",color:"#7AC74C",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Grass.png"},
  {slug:"hielo",name:"Hielo",color:"#96D9D6",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Ice.png"},
  {slug:"lucha",name:"Lucha",color:"#C22E28",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Fighting.png"},
  {slug:"veneno",name:"Veneno",color:"#A33EA1",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Poison.png"},
  {slug:"tierra",name:"Tierra",color:"#E2BF65",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Ground.png"},
  {slug:"volador",name:"Volador",color:"#A98FF3",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Flying.png"},
  {slug:"psiquico",name:"Psíquico",color:"#F95587",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Psychic.png"},
  {slug:"bicho",name:"Bicho",color:"#A6B91A",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Bug.png"},
  {slug:"roca",name:"Roca",color:"#B6A136",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Rock.png"},
  {slug:"fantasma",name:"Fantasma",color:"#735797",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Ghost.png"},
  {slug:"dragon",name:"Dragón",color:"#6F35FC",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Dragon.png"},
  {slug:"siniestro",name:"Siniestro",color:"#705746",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Dark.png"},
  {slug:"acero",name:"Acero",color:"#B7B7CE",icon:"https://play.pokemonshowdown.com/sprites/typeicons/Steel.png"}
];

const TRAMO_MILESTONES = [
  {tramo:1,goal:"Entrega de Poké Balls"},
  {tramo:2,goal:"Derrotar a Cheren (1.º Gimnasio)"},
  {tramo:3,goal:"Derrotar a Hiedra (2.º Gimnasio)"},
  {tramo:4,goal:"Derrotar a Camus (3.º Gimnasio)"},
  {tramo:5,goal:"Derrotar a Camila (4.º Gimnasio)"},
  {tramo:6,goal:"Derrotar a Yakón (5.º Gimnasio)"},
  {tramo:7,goal:"Derrotar a Gerania (6.º Gimnasio)"},
  {tramo:8,goal:"Derrotar a Lirio (7.º Gimnasio)"},
  {tramo:9,goal:"Derrotar a Ciprián (8.º Gimnasio)"},
  {tramo:10,goal:"Derrotar a Ghechis y Kyurem (Boquete Gigante)"},
  {tramo:11,goal:"Derrotar a la Campeona Iris (Liga Pokémon)"},
  {tramo:12,goal:"Consagrarse campeón Pokémon"}
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
let pokemonChannel = null;
let notificationCache = [];
let currentTramo = 0;
let tramoSpinsRemaining = 0;
let bonusTramoSpinsRemaining = 0;
let rouletteAccessByPool = {legendary:0,fiesta:0};
let selectedSpecialPool = null;
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
let tramoStartPending = false;
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
let typeLeagueVisible = false;
let rouletteAudio = null;
let rouletteAudioLastTick = null;
let rouletteAudioTickCount = 0;

function getRouletteAudio(){
  if(rouletteAudio)return rouletteAudio;
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return null;
    rouletteAudio=new AudioCtx();
    return rouletteAudio;
  }catch(error){
    console.warn("El audio de la ruleta no está disponible:",error);
    return null;
  }
}

function playRouletteTone(frequency,duration,gainValue,type="square",when=0){
  const audio=getRouletteAudio();
  if(!audio)return;
  try{
    if(audio.state==="suspended")audio.resume();
    const now=audio.currentTime+when;
    const oscillator=audio.createOscillator();
    const gain=audio.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,now);
    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,gainValue),now+0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now+duration+0.015);
  }catch(error){
    console.warn("No se pudo reproducir un sonido de la ruleta:",error);
  }
}

function startRouletteAudio(){
  const audio=getRouletteAudio();
  if(!audio)return;
  try{
    if(audio.state==="suspended")audio.resume();
    rouletteAudioLastTick=rotation;
    rouletteAudioTickCount=0;
    // Pequeño golpe inicial para marcar que la ruleta arrancó.
    playRouletteTone(170,0.16,0.045,"sawtooth");
    playRouletteTone(330,0.12,0.028,"triangle",0.025);
  }catch(error){
    console.warn("No se pudo iniciar el audio de la ruleta:",error);
  }
}

function updateRouletteAudio(previousRotation,currentRotation){
  const audio=getRouletteAudio();
  if(!audio||rouletteAudioLastTick==null)return;
  const distance=Math.abs(currentRotation-rouletteAudioLastTick);
  const tickDistance=0.36;
  if(distance<tickDistance)return;
  const ticks=Math.min(4,Math.floor(distance/tickDistance));
  for(let i=0;i<ticks;i++){
    rouletteAudioTickCount++;
    const frequency=rouletteAudioTickCount%5===0?980:760;
    playRouletteTone(frequency,0.045,0.022,"square");
  }
  rouletteAudioLastTick=currentRotation;
}

function finishRouletteAudio(){
  const audio=getRouletteAudio();
  if(!audio)return;
  try{
    playRouletteTone(660,0.18,0.035,"triangle");
    playRouletteTone(880,0.24,0.045,"triangle",0.12);
    playRouletteTone(1320,0.32,0.035,"sine",0.25);
    rouletteAudioLastTick=null;
  }catch(error){
    console.warn("No se pudo cerrar el audio de la ruleta:",error);
  }
}


let typeLeagueProfiles = [];
let typeLeagueMatches = [];
let typeLeagueChannel = null;


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
  if(!CARDS.length){
    ctx.beginPath();ctx.arc(center,center,radius,0,TAU);
    ctx.fillStyle="#283541";ctx.fill();
    ctx.strokeStyle="#8f9aa3";ctx.lineWidth=3;ctx.stroke();
    ctx.beginPath();ctx.arc(center,center,42,0,TAU);
    ctx.fillStyle="#111820";ctx.fill();
    ctx.strokeStyle="#f3f5f6";ctx.lineWidth=5;ctx.stroke();
    return;
  }

  const weights=CARDS.map(card=>Math.max(1,Number(card.weight||1)));
  const totalWeight=weights.reduce((sum,weight)=>sum+weight,0);
  const cardRadius=radius*.67;
  let accumulatedWeight=0;

  CARDS.forEach((card,i)=>{
    const slice=TAU*weights[i]/totalWeight;
    const start=rotation-Math.PI/2+(accumulatedWeight/totalWeight)*TAU;
    const end=start+slice;
    accumulatedWeight+=weights[i];

    ctx.beginPath();
    ctx.moveTo(center,center);
    ctx.arc(center,center,radius,start,end);
    ctx.closePath();
    ctx.fillStyle=i%2===0?"#e5e9ec":"#283541";
    ctx.fill();
    ctx.strokeStyle="#8f9aa3";
    ctx.lineWidth=3;
    ctx.stroke();

    // The card stays inside its own slice. Narrower slices automatically get
    // smaller cards, preventing collisions as the roulette catalog grows.
    const mid=start+slice/2;
    const arcSpace=2*cardRadius*Math.sin(Math.min(slice,Math.PI)/2);
    const cardWidth=Math.min(62,Math.max(14,arcSpace*.72));
    const cardHeight=cardWidth*1.5;
    const x=center+Math.cos(mid)*cardRadius;
    const y=center+Math.sin(mid)*cardRadius;

    ctx.save();
    ctx.translate(x,y);
    // The card's top edge always points toward the outside of its sector.
    ctx.rotate(mid+Math.PI/2);

    const image=cardArtImages[card.id]||cardArtImages[card.slug];
    if(image&&image.complete&&image.naturalWidth){
      ctx.shadowColor="#000";
      ctx.shadowBlur=Math.min(9,cardWidth*.15);
      ctx.drawImage(image,-cardWidth/2,-cardHeight/2,cardWidth,cardHeight);
      ctx.shadowBlur=0;
      ctx.strokeStyle="#f1f4f6";
      ctx.lineWidth=Math.max(1,cardWidth*.025);
      ctx.strokeRect(-cardWidth/2,-cardHeight/2,cardWidth,cardHeight);
    }else{
      const label=String(card.name||"Carta");
      ctx.fillStyle=card.color||"#758795";
      ctx.fillRect(-cardWidth/2,-cardHeight/2,cardWidth,cardHeight);
      ctx.strokeStyle="#e6edf1";
      ctx.lineWidth=1;
      ctx.strokeRect(-cardWidth/2,-cardHeight/2,cardWidth,cardHeight);
      if(cardWidth>=34){
        ctx.fillStyle="#fff";
        ctx.font="bold "+Math.max(7,Math.min(11,cardWidth*.19))+"px Arial";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(label.length>9?label.slice(0,8)+"…":label,0,0,cardWidth-4);
      }
    }
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(center,center,42,0,TAU);
  ctx.fillStyle="#111820";
  ctx.fill();
  ctx.strokeStyle="#f3f5f6";
  ctx.lineWidth=5;
  ctx.stroke();
}

function createDeckItem(card,index,route=false,allowActions=false){
  const row=document.createElement("div");row.className="deck-item";
  const img=document.createElement("img");img.className="deck-thumb";img.src=cardImage(card);img.alt=card.name||"Carta";
  img.setAttribute("role","button");
  img.setAttribute("tabindex","0");
  img.setAttribute("aria-label","Ver información de "+(card.name||"Carta TypeLink"));
  img.dataset.cardPreviewImage=cardImage(card);
  img.dataset.cardPreviewName=card.name||"Carta TypeLink";
  img.dataset.cardPreviewRarity=card.rarity||"CARTA TYPELINK";
  img.dataset.cardPreviewDescription=card.description||"Sin descripción disponible.";
  img.classList.add("deck-thumb-clickable");
  img.style.cursor="pointer";
  const info=document.createElement("div");info.className="deck-info";
  const name=document.createElement("strong");name.textContent=card.name||"Carta TypeLink";
  const small=document.createElement("small");
  const uses=Number(card.remaining_uses??1),maxUses=Number(card.uses_per_card??1);
  small.textContent=(route?("Tramo "+(card.tramo_number||"?")+" · "):"")+(card.rarity||"Carta normal")+" · USOS "+uses+"/"+maxUses;
  info.append(name,small);
  const number=document.createElement("span");number.className="deck-index";number.textContent=String(index+1).padStart(2,"0");
  row.append(img,info,number);

  // Vista ampliada de la carta en "Mi baraja".
  // Los botones de acción mantienen su comportamiento independiente.
  row.classList.add("my-deck-card-clickable");
  row.dataset.cardPreviewImage=cardImage(card);
  row.dataset.cardPreviewName=card.name||"Carta TypeLink";
  row.dataset.cardPreviewRarity=card.rarity||"CARTA TYPELINK";
  row.dataset.cardPreviewDescription=card.description||"Sin descripción disponible.";
  row.setAttribute("role","button");
  row.setAttribute("tabindex","0");
  row.setAttribute("aria-label","Ver información de "+(card.name||"carta"));

  if(allowActions&&card.status==="available"&&cloudMode){
    const actions=document.createElement("div");actions.className="deck-actions";
    const actionButton=document.createElement("button");actionButton.type="button";
    if(card.disposition==="transfer"){
      actionButton.className="deck-action-button transfer";actionButton.textContent="TRANSFERIR";
      actionButton.addEventListener("click",event=>{event.stopPropagation();openCardAction(card.instance_id,"transfer");});
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
      actionButton.addEventListener("click",event=>{event.stopPropagation();openCardAction(card.instance_id,"use");});
    }
    actions.append(actionButton);
    const evolution=evolutionRulesBySource[card.card_id];
    if(evolution){
      const evolveButton=document.createElement("button");evolveButton.type="button";
      evolveButton.className="deck-action-button evolve";evolveButton.textContent="EVOLUCIONAR";
      evolveButton.addEventListener("click",event=>{event.stopPropagation();openCardAction(card.instance_id,"evolve");});
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
    const empty=document.createElement("div");empty.className="deck-empty";empty.textContent="Sin tramo iniciado.";container.append(empty);return;
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
  setText("homeDeckHint",normalCount?(normalCount+"/"+normalCardLimit+" cartas normales."):"Sin cartas todavía.");
  setText("profileNormalCount",normalCount+"/"+normalCardLimit);
  setText("profileRouteCount",route.length);

  const resetButton=document.getElementById("resetButton");
  if(resetButton)resetButton.hidden=cloudMode;

  const totalSpins=Math.max(0,tramoSpinsRemaining)+Math.max(0,bonusTramoSpinsRemaining);
  const freeSlots=Math.max(0,normalCardLimit-normalCount);
  const pendingSpins=totalSpins>0;
  const specialSelected=selectedSpecialPool==="legendary"||selectedSpecialPool==="fiesta";
  const selectedSpecialCredits=specialSelected?Math.max(0,Number(rouletteAccessByPool[selectedSpecialPool]||0)):0;
  const canSpinSpecial=specialSelected&&selectedSpecialCredits>0;
  const canSpinNormal=pendingSpins&&(normalCount<normalCardLimit||bonusTramoSpinsRemaining>0);
  spinButton.disabled=spinning||!currentAuthUser||(specialSelected?!canSpinSpecial:!canSpinNormal);
  const shuffleWheelButton=document.getElementById("shuffleWheelButton");
  if(shuffleWheelButton)shuffleWheelButton.disabled=spinning||CARDS.length<2;
  spinButton.querySelector("span").textContent=
    !currentAuthUser?"INICIA SESIÓN":
    spinning?"GIRANDO...":
    specialSelected&&!canSpinSpecial?"ACCESO AGOTADO":
    !specialSelected&&normalCount>=normalCardLimit&&bonusTramoSpinsRemaining<=0?"BARAJA COMPLETA":
    !specialSelected&&totalSpins<=0?"SIN GIROS DISPONIBLES":"GIRAR RULETA";
  setText("spinHint",!currentAuthUser
    ?"Inicia sesión para girar."
    :spinning
      ?"La ruleta está girando..."
      :specialSelected
        ?(selectedSpecialPool==="legendary"?"Ruleta Legendaria seleccionada.":"Ruleta Fiesta seleccionada.")+" Pulsa GIRAR RULETA cuando quieras utilizar tu acceso."
        :normalCount>=normalCardLimit&&bonusTramoSpinsRemaining<=0
          ?"Baraja completa. Libera un espacio para continuar."
          :normalCount>=normalCardLimit&&bonusTramoSpinsRemaining>0
            ?"Tienes giros extra: puedes obtener cartas aunque hayas superado el límite de baraja."
            :totalSpins<=0
            ?"Sin giros. Avanza de tramo para recibir "+normalSpinsPerTramo+" giros."
            :"Cada giro entrega 1 carta.");
  setText("spinBudget",currentAuthUser
    ?(specialSelected
      ?("GIROS "+(selectedSpecialPool==="legendary"?"LEGENDARIOS":"FIESTA")+": "+selectedSpecialCredits)
      :("GIROS DEL TRAMO: "+tramoSpinsRemaining+" · EXTRA: "+bonusTramoSpinsRemaining))
    :"INICIA SESIÓN PARA VER TUS GIROS");

  const tramoActual = Math.min(TRAMO_MILESTONES.length,Math.max(0,Number(currentTramo)||0));
  const finalTramo = tramoActual >= TRAMO_MILESTONES.length;
  const nextTramo = tramoActual + 1;
  const nextStage = TRAMO_MILESTONES[tramoActual] || null;
  const currentStage = tramoActual > 0 ? TRAMO_MILESTONES[tramoActual-1] : null;

  setText("tramoNextNumber",finalTramo
    ? "TRAMO ACTUAL · 12 / 12"
    : "SIGUIENTE TRAMO · "+nextTramo+" / "+TRAMO_MILESTONES.length);
  setText("tramoNextGoal",finalTramo
    ? "Consagrarse campeón Pokémon"
    : (nextStage?.goal||"Ruta de TESELIA completada."));
  setText("tramoCurrentStage",currentStage
    ? "TRAMO ACTUAL: "+tramoActual+" / "+TRAMO_MILESTONES.length+" · "+currentStage.goal
    : "AVENTURA SIN INICIAR · 0 / "+TRAMO_MILESTONES.length);

  let tramoHint="";
  if(!currentAuthUser){
    tramoHint="Inicia sesión para avanzar y recibir las recompensas del siguiente tramo.";
  }else if(finalTramo){
    tramoHint="¡Te has consagrado Campeón Pokémon! Desde este momento ningún rival puede lanzarte cartas.";
  }else if(pendingSpins){
    tramoHint="Tienes "+totalSpins+" giros pendientes. Úsalos antes de avanzar.";
  }else if(freeSlots<normalSpinsPerTramo){
    tramoHint="Libera al menos "+normalSpinsPerTramo+" espacio(s) en tu baraja antes de avanzar.";
  }else{
    tramoHint="Al avanzar iniciarás el Tramo "+nextTramo+": "+(nextStage?.goal||"siguiente hito")+". Recibirás "+cardsPerTramo+" cartas de tramo y "+normalSpinsPerTramo+" giros normales.";
  }
  setText("tramoProgressHint",tramoHint);
  setText("tramoProgressCount",currentAuthUser
    ? "GIROS DISPONIBLES: "+tramoSpinsRemaining+" NORMALES · "+bonusTramoSpinsRemaining+" EXTRA"
    : "INICIA SESIÓN PARA VER TUS GIROS");
  renderTramoRoadmap();

  ["tramoButton","tramoButtonFull"].forEach(id=>{
    const button=document.getElementById(id);
    if(!button)return;
    button.disabled=spinning||tramoStartPending||!currentAuthUser||pendingSpins||freeSlots<normalSpinsPerTramo||finalTramo;
    button.textContent=finalTramo
      ? "TRAMO FINAL ALCANZADO"
      : currentTramo>0
        ? "AVANZAR AL TRAMO "+nextTramo
        : "INICIAR TRAMO 1";
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
  setText("typeTrackerCount",enabledCount+" / "+POKEMON_TYPES.length+" ACTIVOS");
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
    const iconWrap=document.createElement("span");iconWrap.className="type-toggle-icon";
    const icon=document.createElement("img");icon.src=type.icon;icon.alt="";icon.setAttribute("aria-hidden","true");icon.loading="lazy";icon.decoding="async";
    icon.onerror=()=>{iconWrap.classList.add("is-missing");icon.remove();const fallback=document.createElement("span");fallback.textContent=type.name.slice(0,1);iconWrap.append(fallback);};
    iconWrap.append(icon);
    const label=document.createElement("span");label.className="type-toggle-label";
    const name=document.createElement("strong");name.textContent=type.name;
    const state=document.createElement("small");state.textContent=enabled?"HABILITADO":"BLOQUEADO";
    label.append(name,state);button.append(iconWrap,label);
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
  if(effect.effect_key==="protection_normal")return "Protección normal";
  if(effect.effect_key==="protection_ultimate")return "Protección definitiva";
  if(effect.effect_key==="destroy_normal_deck")return "Romper baraja";
  if(effect.effect_key==="copy_opponent_card")return "Copiar carta de un rival";
  if(effect.effect_key==="copy_incoming_card")return "Copiar carta recibida";
  if(effect.effect_key==="steal_opponent_card")return "Robar carta de un rival";
  if(effect.effect_key==="steal_full_deck")return "Robar baraja completa";
  if(effect.effect_key==="swap_full_deck")return "Intercambiar barajas completas";
  if(effect.effect_key==="reverse_effect")return "Revierte Efecto";
  if(effect.effect_key==="transform_card")return "Transformar carta";
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
    .select("id,display_name,avatar_url,discord_id,created_at")
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

function openActivityCardPreview(imagePath,cardName,rarity,trigger,description=""){
  if(!imagePath)return;
  const modal=document.getElementById("activityCardModal");
  const image=document.getElementById("activityCardModalImage");
  if(!modal||!image)return;
  activityCardModalTrigger=trigger||null;
  image.src=imagePath;
  image.alt=cardName||"Carta TypeLink";
  setText("activityCardModalName",cardName||"Carta TypeLink");
  setText("activityCardModalRarity",rarity||"CARTA TYPELINK");
  setText("activityCardModalDescription",description||"");
  setText("activityCardModalHint","Toca fuera de la carta o pulsa × para volver.");
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
  const wallSince=new Date(Date.now()-24*60*60*1000).toISOString();
  const {data,error}=await authClient.from("card_activity")
    .select("id,actor_id,target_id,activity_type,details,created_at")
    .eq("activity_type","play")
    .gte("created_at",wallSince)
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
    const result=await authClient.from("profiles").select("id,display_name,avatar_url,discord_id").in("id",profileIds);
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
    .select("id,display_name,avatar_url,discord_id,created_at")
    .order("created_at",{ascending:true});
  if(error){
    console.error("No se pudieron cargar los jugadores:",error.message);
    container.replaceChildren();const message=document.createElement("div");message.className="empty-feature panel";message.textContent="No se pudo cargar la lista.";container.append(message);return;
  }
  const [cardsResult,progressResult,snapshotResult]=await Promise.all([
    authClient.from("player_cards")
      .select("owner_id,status,remaining_uses")
      .eq("status","available")
      .gt("remaining_uses",0),
    authClient.rpc("get_public_trainer_progress"),
    authClient.from("player_save_snapshots").select("player_id,synced_at")
  ]);
  // Count every usable card copy together: normal, tramo and fiesta.
  // Spent copies remain in the database/history but never inflate the public count.
  const cardCounts=Object.create(null);
  (cardsResult.data||[]).forEach(row=>{
    if(row.status!=="available"||Number(row.remaining_uses)<=0)return;
    cardCounts[row.owner_id]=(cardCounts[row.owner_id]||0)+1;
  });
  if(cardsResult.error)console.warn("No se pudieron cargar los contadores de cartas:",cardsResult.error.message);
  if(progressResult.error)console.warn("No se pudo consultar el tramo de los participantes:",progressResult.error.message);
  const currentTramos=Object.create(null);
  (progressResult.data||[]).forEach(row=>{
    currentTramos[row.trainer_id]=Math.max(0,Number(row.current_tramo)||0);
  });
  const pokemonSyncByPlayer=Object.create(null);
  (snapshotResult.data||[]).forEach(row=>{pokemonSyncByPlayer[row.player_id]=row.synced_at||null;});
  if(snapshotResult.error)console.warn("No se pudieron cargar los estados de sincronización Pokémon:",snapshotResult.error.message);

  container.replaceChildren();
  setText("playersCount",(profiles||[]).length+" ENTRENADORES");
  if(!profiles||!profiles.length){
    const empty=document.createElement("div");empty.className="empty-feature panel";empty.textContent="Sin participantes todavía.";container.append(empty);return;
  }
  profiles.forEach(profile=>{
    const displayName=profile.display_name||"Entrenador";
    const trainerTramo=currentTramos[profile.id]||0;
    const isChampion=trainerTramo>=12;
    const card=document.createElement("button");
    card.type="button";
    card.className="player-directory-card"+(isChampion?" is-champion":"");
    card.setAttribute("aria-label","Abrir perfil de "+displayName);
    const avatar=document.createElement("div");avatar.className="player-directory-avatar";
    applyAvatar(avatar,profile.avatar_url,displayName.slice(0,2).toUpperCase());
    const info=document.createElement("div");info.className="player-directory-info";
    const name=document.createElement("strong");name.textContent=displayName;
    const since=document.createElement("small");since.textContent="Desde "+formatDate(profile.created_at);
    const tramoBadge=document.createElement("small");
    tramoBadge.className="player-current-tramo"+(isChampion?" is-champion":"");
    tramoBadge.textContent=isChampion
      ?"🏆 CAMPEÓN POKÉMON · TRAMO 12 / 12"
      :"TRAMO ACTUAL · "+trainerTramo+" / 12"+(trainerTramo===0?" · SIN INICIAR":"");
    info.append(name,since,tramoBadge);
    const stats=document.createElement("div");stats.className="player-directory-stats";
    const totalCards=document.createElement("span");totalCards.className="player-directory-card-total";
    const availableCount=Number(cardCounts[profile.id]||0);
    totalCards.textContent=availableCount+" "+(availableCount===1?"CARTA":"CARTAS");
    stats.append(totalCards);
    const action=document.createElement("span");action.className="player-view-button";
    action.textContent="VER PERFIL ↗";
    card.append(avatar,info,stats,action);
    card.addEventListener("click",()=>showPublicPlayer(profile.id,trainerTramo));
    container.append(card);
  });
}

async function showPublicPlayer(playerId,currentTramo=0){
  const modal=document.getElementById("publicProfileModal");
  modal.dataset.playerId=playerId;
  const {data:profile,error}=await authClient.from("profiles")
    .select("id,display_name,avatar_url,discord_id,created_at").eq("id",playerId).single();
  if(error||!profile){notify("No pudimos abrir este perfil.");return;}
  setText("publicPlayerName",profile.display_name||"Entrenador");
  setText("publicPlayerJoined","Entrenador desde "+formatDate(profile.created_at));
  applyAvatar(document.getElementById("publicPlayerAvatar"),profile.avatar_url,(profile.display_name||"TL").slice(0,2).toUpperCase());

  const [cardsResult,typesResult,incomingResult]=await Promise.all([
    authClient.from("player_cards")
      .select("id,card_id,source,tramo_number,status,remaining_uses,obtained_at,card_catalog(id,name,category,rarity,description,image_path,uses_per_card,target_scope,disposition,counts_toward_normal_limit)")
      .eq("owner_id",playerId).eq("status","available").gt("remaining_uses",0).order("obtained_at",{ascending:true}),
    authClient.from("player_type_status").select("type_slug,is_enabled").eq("owner_id",playerId),
    authClient.rpc("get_trainer_incoming_cards",{p_trainer_id:playerId})
  ]);
  if(cardsResult.error){notify("No pudimos cargar la baraja pública.");return;}

  const container=document.getElementById("publicPlayerCards");container.replaceChildren();
  const items=(cardsResult.data||[]).map(mapInventoryRow)
    .filter(item=>item&&item.status==="available"&&Number(item.remaining_uses)>0);
  setText("publicPlayerCardCount",items.length+" CARTAS");
  if(!items.length){
    const empty=document.createElement("div");empty.className="deck-empty";empty.textContent="Sin cartas todavía.";container.append(empty);
  }else{
    items.forEach((item,index)=>{
      const cardItem=createDeckItem(item,index,item.category==="tramo");
      cardItem.classList.add("public-profile-card-clickable");
      cardItem.setAttribute("role","button");
      cardItem.setAttribute("tabindex","0");
      cardItem.setAttribute("aria-label","Ver información de "+(item.name||"carta"));
      cardItem.dataset.cardPreviewImage=item.image_path||"";
      cardItem.dataset.cardPreviewName=item.name||"Carta TypeLink";
      cardItem.dataset.cardPreviewRarity=item.rarity||"CARTA TYPELINK";
      cardItem.dataset.cardPreviewDescription=item.description||"Sin descripción disponible.";
      container.append(cardItem);
    });
  }

  renderPublicPlayerTypes(typesResult.data||[],typesResult.error);
  renderPublicIncomingCards(incomingResult.data||[],incomingResult.error);
  const pokemonSection=document.getElementById("publicPlayerPokemonSection");
  const pokemonCta=document.querySelector(".public-profile-pokemon-cta");
  if(pokemonSection)pokemonSection.hidden=true;
  if(pokemonCta)pokemonCta.classList.remove("is-open");
  await showPublicPokemonSnapshot(playerId);
  bindPublicPokemonViewer();
  const tramoLabel=currentTramo>=12
    ?"🏆 CAMPEÓN POKÉMON · TRAMO 12 / 12"
    :"TRAMO ACTUAL · "+Math.max(0,Number(currentTramo)||0)+" / 12";
  setText("publicPlayerTramo",tramoLabel);
  modal.hidden=false;
}

function renderPublicIncomingCards(rows,error){
  const container=document.getElementById("publicPlayerIncomingCards");
  if(!container)return;
  container.replaceChildren();
  if(error){
    console.error("No se pudieron cargar las cartas recibidas durante el tramo:",error.message);
    setText("publicPlayerIncomingCount","NO DISPONIBLE");
    const message=document.createElement("div");message.className="deck-empty";
    message.textContent="No se pudo consultar el historial de cartas de este tramo.";
    container.append(message);return;
  }
  const cards=Array.isArray(rows)?rows:[];
  setText("publicPlayerIncomingCount",cards.length+" "+(cards.length===1?"CARTA":"CARTAS"));
  if(!cards.length){
    const empty=document.createElement("div");empty.className="deck-empty";
    empty.textContent="Todavía no le han lanzado cartas en este tramo.";
    container.append(empty);return;
  }
  const rarityLabels={common:"COMÚN",rare:"RARA",epic:"ÉPICA",legendary:"LEGENDARIA",tramo:"TRAMO",fiesta:"FIESTA"};
  cards.forEach(card=>{
    const item=document.createElement("article");item.className="public-incoming-card";
    const artButton=document.createElement("button");artButton.type="button";artButton.className="public-incoming-card-art";
    const image=document.createElement("img");
    image.alt=card.card_name||"Carta recibida";
    image.loading="lazy";image.decoding="async";
    if(card.image_path){
      image.src=card.image_path;
      image.addEventListener("error",()=>{image.hidden=true;artButton.classList.add("is-missing");});
      artButton.addEventListener("click",()=>openActivityCardPreview(card.image_path,card.card_name,rarityLabels[card.rarity]||"CARTA",artButton));
    }else{
      image.hidden=true;artButton.classList.add("is-missing");
    }
    artButton.append(image);
    if(!card.image_path){const fallback=document.createElement("span");fallback.textContent="✦";artButton.append(fallback);}
    const copy=document.createElement("div");copy.className="public-incoming-card-copy";
    const rarity=document.createElement("small");rarity.className="public-incoming-card-rarity";
    rarity.textContent=rarityLabels[card.rarity]||"CARTA TYPELINK";
    const name=document.createElement("strong");name.textContent=card.card_name||"Carta TypeLink";
    const sender=document.createElement("span");sender.className="public-incoming-card-sender";
    sender.textContent="LANZADA POR "+(card.sender_name||"Entrenador");
    const date=document.createElement("time");date.className="public-incoming-card-date";
    const timestamp=new Date(card.created_at);
    date.textContent=Number.isNaN(timestamp.getTime())?"":new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"short"}).format(timestamp);
    if(card.created_at)date.dateTime=card.created_at;
    copy.append(rarity,name,sender,date);
    if(card.custom_message){
      const note=document.createElement("p");note.className="public-incoming-card-message";
      note.textContent="“"+card.custom_message+"”";copy.append(note);
    }
    item.append(artButton,copy);container.append(item);
  });
}

function renderPublicPlayerTypes(rows,error){
  const container=document.getElementById("publicPlayerTypes");
  if(!container)return;
  container.replaceChildren();
  if(error){
    console.error("No se pudieron cargar los tipos del participante:",error.message);
    setText("publicPlayerTypesCount","NO DISPONIBLE");
    const message=document.createElement("div");message.className="deck-empty";
    message.textContent="No se pudo consultar el registro de tipos.";
    container.append(message);return;
  }
  const typeMap=Object.fromEntries((rows||[]).map(row=>[row.type_slug,row.is_enabled]));
  let enabledCount=0;
  POKEMON_TYPES.forEach(type=>{
    const enabled=typeMap[type.slug]!==false;
    if(enabled)enabledCount++;
    const item=document.createElement("div");
    item.className="public-player-type "+(enabled?"is-enabled":"is-disabled");
    item.style.setProperty("--type-color",type.color);
    const iconWrap=document.createElement("span");iconWrap.className="public-player-type-icon";
    const icon=document.createElement("img");icon.src=type.icon;icon.alt="";icon.setAttribute("aria-hidden","true");
    icon.loading="lazy";icon.decoding="async";
    icon.onerror=()=>{
      iconWrap.classList.add("is-missing");icon.remove();
      const fallback=document.createElement("span");fallback.textContent=type.name.slice(0,1);iconWrap.append(fallback);
    };
    iconWrap.append(icon);
    const copy=document.createElement("span");copy.className="public-player-type-copy";
    const name=document.createElement("strong");name.textContent=type.name;
    const state=document.createElement("small");state.textContent=enabled?"DISPONIBLE":"BLOQUEADO";
    copy.append(name,state);item.append(iconWrap,copy);container.append(item);
  });
  setText("publicPlayerTypesCount",enabledCount+" / "+POKEMON_TYPES.length+" DISPONIBLES");
}
function closePublicPlayer(){
  const modal=document.getElementById("publicProfileModal");
  modal.hidden=true;
  delete modal.dataset.playerId;
}
async function refreshPublicIncomingCards(playerId){
  if(!authClient||!playerId)return;
  const {data,error}=await authClient.rpc("get_trainer_incoming_cards",{p_trainer_id:playerId});
  renderPublicIncomingCards(data||[],error);
}



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
    const {data,error}=await authClient.rpc("get_trainer_incoming_card_count",{
      p_trainer_id:profile.id
    });
    if(request!==cardActionTargetPreviewRequest)return;
    if(error)throw error;
    const count=Number(data);
    if(!Number.isInteger(count)||count<0)throw new Error("El servidor devolvió un contador no válido.");
    setText("cardActionTargetEffectCount",count);
    setText("cardActionTargetStatus","EN SU TRAMO ACTUAL");
  }catch(error){
    if(request!==cardActionTargetPreviewRequest)return;
    console.warn("No se pudo consultar el contador de cartas recibidas en el tramo:",error.message);
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
  const protectionWrap=document.getElementById("cardActionProtectionWrap");
  const protectionSelect=document.getElementById("cardActionProtectionSelect");
  const manipulationWrap=document.getElementById("cardActionManipulationWrap");
  const manipulationSelect=document.getElementById("cardActionManipulationSelect");
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
  if(protectionWrap)protectionWrap.hidden=true;
  if(protectionSelect)protectionSelect.replaceChildren();
  if(manipulationWrap)manipulationWrap.hidden=true;
  if(manipulationSelect)manipulationSelect.replaceChildren();
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

  const protectionEffect=(cardEffectsById[card.card_id]||[]).find(effect=>effect.effect_key==="protection_normal"||effect.effect_key==="protection_ultimate");
  if(protectionEffect&&mode==="use"){
    if(protectionWrap)protectionWrap.hidden=false;
    const protectionLevel=protectionEffect.effect_key==="protection_ultimate"?"ultimate":"normal";
    try{
      const {data,error}=await authClient.rpc("get_trainer_incoming_cards",{p_trainer_id:currentAuthUser.id});
      if(error)throw error;
      const incoming=Array.isArray(data)?data:[];
      const eligible=incoming.filter(item=>protectionLevel==="ultimate"||(item.rarity!=="legendary"&&item.rarity!=="fiesta"));
      if(protectionSelect){
        const placeholder=document.createElement("option");
        placeholder.value="";placeholder.textContent=eligible.length?"Selecciona la carta que quieres bloquear":"No hay cartas compatibles que te hayan lanzado";placeholder.disabled=true;placeholder.selected=true;
        protectionSelect.append(placeholder);
        eligible.forEach(item=>{
          const option=document.createElement("option");
          option.value=item.activity_id;
          option.textContent=(item.card_name||"Carta TypeLink")+" · "+(item.rarity||"CARTA")+" · de "+(item.sender_name||"otro entrenador");
          protectionSelect.append(option);
        });
      }
      if(!eligible.length){
        confirmButton.disabled=true;
        feedback.textContent=protectionLevel==="normal"?"No tienes una carta compatible que te hayan lanzado. La Protección normal no bloquea Legendarias ni Fiesta.":"No tienes cartas lanzadas que puedas bloquear.";
      }
    }catch(error){
      console.error("No se pudieron cargar las cartas recibidas para proteger:",error);
      confirmButton.disabled=true;
      feedback.textContent="No pudimos cargar las cartas que te han lanzado.";
    }
  }

  const cardActionOpenToken=++cardActionTargetPreviewRequest;
  const manipulationEffect=(cardEffectsById[card.card_id]||[]).find(effect=>[
    "copy_opponent_card","copy_incoming_card","steal_opponent_card","reverse_effect","transform_card"
  ].includes(effect.effect_key));
  if(manipulationEffect&&mode==="use"){
    if(manipulationWrap)manipulationWrap.hidden=false;
    if(manipulationSelect)manipulationSelect.replaceChildren();
    const key=manipulationEffect.effect_key;

    if(key==="steal_opponent_card"||key==="copy_opponent_card"){
      // Robar carta: primero elegimos al rival y después cargamos SOLO sus cartas
      // compatibles. Legendarias y Fiesta nunca aparecen.
      if(targetWrap)targetWrap.hidden=false;
      const targetLabel=targetWrap?.querySelector("label");
      const targetHint=document.getElementById("cardActionTargetHint");
      if(targetLabel)targetLabel.textContent=key==="steal_opponent_card"?"RIVAL OBJETIVO":"RIVAL DEL QUE COPIAR";
      if(targetHint)targetHint.textContent=key==="steal_opponent_card"?"Elige primero al entrenador cuya carta quieres robar.":"Elige primero al entrenador del que quieres copiar una carta.";
      targetSelect.replaceChildren();
      const rivalPlaceholder=document.createElement("option");
      rivalPlaceholder.value="";
      rivalPlaceholder.textContent="Selecciona un rival";
      rivalPlaceholder.disabled=true;
      rivalPlaceholder.selected=true;
      targetSelect.append(rivalPlaceholder);

      const cardPlaceholder=document.createElement("option");
      cardPlaceholder.value="";
      cardPlaceholder.textContent="Selecciona una carta";
      cardPlaceholder.disabled=true;
      cardPlaceholder.selected=true;
      manipulationSelect?.append(cardPlaceholder);

      const loadRivalCards=async(rivalId)=>{
        manipulationSelect.replaceChildren();
        const waiting=document.createElement("option");
        waiting.value="";
        waiting.textContent="Cargando cartas del rival...";
        waiting.disabled=true;
        waiting.selected=true;
        manipulationSelect.append(waiting);
        confirmButton.disabled=true;
        try{
          const {data,error}=await authClient.rpc("get_opponent_card_choices_for_trainer",{p_opponent_id:rivalId});
          if(error)throw error;
          if(cardActionOpenToken!==cardActionTargetPreviewRequest)return;
          let cards=[];
          if(Array.isArray(data))cards=data;
          else if(typeof data==="string"){
            try{
              const parsed=JSON.parse(data);
              cards=Array.isArray(parsed)?parsed:[];
            }catch(_){}
          }else if(data&&Array.isArray(data.items))cards=data.items;
          manipulationSelect.replaceChildren();
          const placeholder=document.createElement("option");
          placeholder.value="";
          placeholder.textContent=cards.length?"Selecciona una carta":"Este rival no tiene cartas compatibles para robar";
          placeholder.disabled=true;
          placeholder.selected=true;
          manipulationSelect.append(placeholder);
          cards.forEach(item=>{
            const option=document.createElement("option");
            option.value=item.card_instance_id;
            option.textContent=(item.card_name||"Carta TypeLink")+" · "+(item.rarity||"CARTA")+" · "+(item.remaining_uses||0)+" usos";
            manipulationSelect.append(option);
          });
          confirmButton.disabled=!cards.length;
          feedback.textContent=cards.length
            ?(key==="steal_opponent_card"?"Ahora selecciona la carta que quieres robar.":"Ahora selecciona la carta que quieres copiar.")
            :"Este rival no tiene cartas disponibles compatibles (Legendarias y Fiesta están excluidas).";
        }catch(error){
          console.error("No se pudieron cargar las cartas del rival:",error);
          manipulationSelect.replaceChildren();
          const errorOption=document.createElement("option");
          errorOption.value="";
          errorOption.textContent="No se pudieron cargar las cartas";
          errorOption.disabled=true;
          errorOption.selected=true;
          manipulationSelect.append(errorOption);
          confirmButton.disabled=true;
          feedback.textContent=key==="steal_opponent_card"?"No pudimos cargar las cartas de ese rival.":"No pudimos cargar las cartas de ese rival.";
        }
      };

      try{
        const [profilesResult,progressResult]=await Promise.all([
          authClient.from("profiles")
            .select("id,display_name,avatar_url")
            .order("display_name",{ascending:true}),
          authClient.rpc("get_public_trainer_progress")
        ]);
        if(profilesResult.error)throw profilesResult.error;
        if(progressResult.error)console.warn("No se pudo consultar el tramo de los rivales:",progressResult.error.message);
        const progressMap=Object.create(null);
        (progressResult.data||[]).forEach(row=>{
          progressMap[row.trainer_id]=Math.max(0,Number(row.current_tramo)||0);
        });
        if(cardActionOpenToken!==cardActionTargetPreviewRequest)return;
        targetSelect.replaceChildren();
        const freshPlaceholder=document.createElement("option");
        freshPlaceholder.value="";
        freshPlaceholder.textContent="Selecciona un rival";
        freshPlaceholder.disabled=true;
        freshPlaceholder.selected=true;
        targetSelect.append(freshPlaceholder);
        (profilesResult.data||[]).forEach(profile=>{
          if(profile.id===currentAuthUser.id)return;
          const trainerTramo=progressMap[profile.id]||0;
          if(trainerTramo>=12)return;
          const option=document.createElement("option");
          option.value=profile.id;
          option.textContent=profile.display_name||"Entrenador";
          targetSelect.append(option);
        });
        targetSelect.onchange=()=>{
          const rivalId=targetSelect.value||"";
          if(!rivalId){
            manipulationSelect.replaceChildren();
            const placeholder=document.createElement("option");
            placeholder.value="";
            placeholder.textContent="Selecciona primero un rival";
            placeholder.disabled=true;
            placeholder.selected=true;
            manipulationSelect.append(placeholder);
            confirmButton.disabled=true;
            return;
          }
          void loadRivalCards(rivalId);
        };
        if(targetSelect.options.length===1){
          confirmButton.disabled=true;
          feedback.textContent=key==="steal_opponent_card"?"No hay rivales disponibles para robar cartas.":"No hay rivales disponibles para copiar cartas.";
        }else{
          confirmButton.disabled=true;
          feedback.textContent="Selecciona primero un rival.";
        }
      }catch(error){
        console.error("No se pudo cargar la lista de rivales:",error);
        confirmButton.disabled=true;
        feedback.textContent="No pudimos cargar la lista de rivales.";
      }
    }else if(key==="reverse_effect"){
      const placeholder=document.createElement("option");
      placeholder.value="";
      placeholder.disabled=true;
      placeholder.selected=true;
      placeholder.textContent="Selecciona la carta que quieres devolver";
      manipulationSelect?.append(placeholder);
      try{
        const {data,error}=await authClient.rpc("get_trainer_reversible_cards",{p_trainer_id:currentAuthUser.id});
        if(error)throw error;
        const cards=Array.isArray(data)?data:[];
        cards.forEach(item=>{
          const option=document.createElement("option");
          option.value=item.activity_id;
          option.textContent=(item.card_name||"Carta TypeLink")+" · "+(item.rarity||"CARTA")+" · de "+(item.sender_name||"otro entrenador");
          manipulationSelect.append(option);
        });
        if(!cards.length){
          confirmButton.disabled=true;
          feedback.textContent="No tienes ninguna carta con un efecto activo que puedas devolver.";
        }
      }catch(error){
        console.error("No se pudieron cargar las cartas reversibles:",error);
        confirmButton.disabled=true;
        feedback.textContent="No pudimos cargar las cartas que puedes devolver.";
      }
    }else{
      const placeholder=document.createElement("option");
      placeholder.value="";
      placeholder.disabled=true;
      placeholder.selected=true;
      placeholder.textContent=key==="transform_card"?"Selecciona en qué carta quieres transformarla":"Selecciona una carta";
      manipulationSelect?.append(placeholder);
      try{
        if(key==="copy_incoming_card"){
          const {data,error}=await authClient.rpc("get_trainer_incoming_cards",{p_trainer_id:currentAuthUser.id});
          if(error)throw error;
          (Array.isArray(data)?data:[]).filter(item=>item.rarity!=="legendary"&&item.category!=="fiesta").forEach(item=>{
            const option=document.createElement("option");
            option.value=item.activity_id;
            option.textContent=(item.card_name||"Carta TypeLink")+" · "+(item.rarity||"CARTA")+" · de "+(item.sender_name||"otro entrenador");
            manipulationSelect.append(option);
          });
        }else if(key==="transform_card"){
          const {data,error}=await authClient.from("card_catalog")
            .select("id,name,rarity,category,image_path,uses_per_card")
            .eq("is_active",true).order("name",{ascending:true});
          if(error)throw error;
          (data||[]).filter(item=>item.id!==card.card_id).forEach(item=>{
            const option=document.createElement("option");
            option.value=item.id;
            option.textContent=(item.name||"Carta TypeLink")+" · "+(item.rarity||"CARTA");
            manipulationSelect.append(option);
          });
        }else{
          const {data,error}=await authClient.rpc("get_opponent_card_choices");
          if(error)throw error;
          (Array.isArray(data)?data:[]).forEach(item=>{
            const option=document.createElement("option");
            option.value=item.card_instance_id;
            option.textContent=(item.card_name||"Carta TypeLink")+" · "+(item.rarity||"CARTA")+" · de "+(item.owner_name||"rival");
            manipulationSelect.append(option);
          });
        }
        const count=manipulationSelect?.options.length||0;
        if(count<=1){
          confirmButton.disabled=true;
          feedback.textContent=key==="transform_card"
            ?"No hay otra carta disponible para transformar esta carta."
            :"No hay cartas compatibles disponibles para seleccionar.";
        }
      }catch(error){
        console.error("No se pudieron cargar las cartas para este efecto:",error);
        confirmButton.disabled=true;
        feedback.textContent="No pudimos cargar las cartas disponibles para este efecto.";
      }
    }
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
        ?"Sin efecto automático. Se registra, avisa al objetivo y consume una carga."
        :"Activa su efecto y consume una carga por uso.");
    confirmButton.textContent=transfer
      ?"CONFIRMAR TRANSFERENCIA"
      :noAutomaticEffect?"LANZAR CARTA":"USAR CARTA";

    if(!manipulationEffect && (card.target_scope==="opponent"||card.target_scope==="either")){
      targetWrap.hidden=false;
      const prompt=document.createElement("option");
      prompt.value="";
      prompt.textContent=mode==="transfer"
        ?"Selecciona otro entrenador"
        :(card.target_scope==="either"?"Usarla sobre mí":"Selecciona un entrenador");
      targetSelect.append(prompt);
      if(card.target_scope==="opponent"||mode==="transfer")prompt.disabled=true;
      try{
        const [profilesResult,progressResult]=await Promise.all([
          authClient.from("profiles")
            .select("id,display_name,avatar_url,discord_id").order("display_name",{ascending:true}),
          authClient.rpc("get_public_trainer_progress")
        ]);
        if(profilesResult.error)throw profilesResult.error;
        if(progressResult.error)console.warn("No se pudo consultar el tramo de los objetivos:",progressResult.error.message);
        const progressMap=Object.create(null);
        (progressResult.data||[]).forEach(row=>{
          progressMap[row.trainer_id]=Math.max(0,Number(row.current_tramo)||0);
        });
        (profilesResult.data||[]).forEach(profile=>{
          const trainerTramo=progressMap[profile.id]||0;
          const enrichedProfile={...profile,current_tramo:trainerTramo};
          cardActionTargetProfiles[profile.id]=enrichedProfile;
          if(profile.id===currentAuthUser.id)return;
          const isChampion=mode==="use"&&trainerTramo>=12;
          const option=document.createElement("option");
          option.value=profile.id;
          option.disabled=isChampion;
          option.textContent=isChampion
            ?(profile.display_name||"Entrenador")+" · 🏆 CAMPEÓN (NO ADMITE CARTAS)"
            :(profile.display_name||"Entrenador");
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
        }else{
          const firstAvailable=[...targetSelect.options].find((option,index)=>index>0&&option.value&&!option.disabled);
          if(firstAvailable){
            targetSelect.value=firstAvailable.value;
            targetSelect.dispatchEvent(new Event("change"));
          }else{
            setCardActionTargetProfile(null);
            if(card.target_scope==="opponent"||mode==="transfer"){
              confirmButton.disabled=true;
              feedback.textContent="No hay entrenadores disponibles para recibir esta carta. Los campeones no pueden ser objetivo.";
            }
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

async function sendCardActivityToDiscord({card,targetId,customMessage,mode,data}){
  if(!authClient||!currentAuthUser||mode!=="use"||!card)return;
  try{
    const targetProfile=targetId?cardActionTargetProfiles[targetId]:null;
    const targetName=targetProfile?.display_name||"";
    const imagePath=card.image_path||cardImage(card)||"";
    const absoluteImagePath=imagePath
      ?new URL(imagePath,window.location.href).href
      :"";
    const actorName=currentProfile?.display_name||currentAuthUser.user_metadata?.full_name||currentAuthUser.user_metadata?.name||"Entrenador";
    const actionLabel=targetName?"CARTA LANZADA":"CARTA UTILIZADA";
    await authClient.functions.invoke("discord-card-wall",{
      body:{
        actor_name:actorName,
        actor_discord_id:currentProfile?.discord_id||currentAuthUser.user_metadata?.provider_id||currentAuthUser.user_metadata?.sub||null,
        target_name:targetName||null,
        target_discord_id:targetProfile?.discord_id||null,
        card_name:card.name||"Carta TypeLink",
        rarity:card.rarity||"CARTA TYPELINK",
        image_path:absoluteImagePath||null,
        custom_message:customMessage||null,
        action_label:actionLabel
      }
    });
  }catch(error){
    console.warn("No se pudo registrar la carta en Discord:",error?.message||error);
  }
}

async function confirmCardAction(){
  if(!pendingCardAction||!authClient||!currentAuthUser)return;
  const {instanceId,mode,card}=pendingCardAction;
  const button=document.getElementById("confirmCardAction");
  const targetSelect=document.getElementById("cardActionTarget");
  const feedback=document.getElementById("cardActionFeedback");
  const messageInput=document.getElementById("cardActionMessage");
  let targetId=null;
  let manipulationCardId=null;
  const protectionEffect=(cardEffectsById[card.card_id]||[]).find(effect=>effect.effect_key==="protection_normal"||effect.effect_key==="protection_ultimate");
  const manipulationEffect=(cardEffectsById[card.card_id]||[]).find(effect=>[
    "copy_opponent_card","copy_incoming_card","steal_opponent_card","transform_card"
  ].includes(effect.effect_key));
  if(mode==="use"&&protectionEffect){
    targetId=document.getElementById("cardActionProtectionSelect")?.value||null;
    if(!targetId){feedback.textContent="Selecciona una carta que te hayan lanzado antes de continuar.";return;}
  }

  if(mode!=="evolve"&&!protectionEffect&&!manipulationEffect&&(card.target_scope==="opponent"||card.target_scope==="either")){
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

  if(mode==="use"&&manipulationEffect){
    const selectedCardId=document.getElementById("cardActionManipulationSelect")?.value||null;
    if(manipulationEffect.effect_key==="steal_opponent_card"){
      targetId=targetSelect?.value||null;
      manipulationCardId=selectedCardId;
      if(!targetId){
        feedback.textContent="Selecciona un rival antes de continuar.";
        return;
      }
      if(!manipulationCardId){
        feedback.textContent="Selecciona una carta para robar antes de continuar.";
        return;
      }
    }else{
      targetId=selectedCardId;
      if(!targetId){
        feedback.textContent="Selecciona una carta antes de continuar.";
        return;
      }
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
        ?(manipulationEffect?.effect_key==="steal_opponent_card"
          ?{p_card_instance_id:instanceId,p_target_id:targetId,p_manipulation_card_id:manipulationCardId,p_custom_message:customMessage||null}
          :{p_card_instance_id:instanceId,p_target_id:targetId,p_custom_message:customMessage||null})
        :{p_card_instance_id:instanceId,p_target_id:targetId};
    const {data,error}=await authClient.rpc(rpcName,args);
    if(error)throw error;
    if(mode==="use"){
      void sendCardActivityToDiscord({card,targetId,customMessage,mode,data});
    }
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
      if(data.protection){
        notify("¡"+card.name+" utilizada! Te has protegido de "+(data.protected_card_name||"la carta seleccionada")+".");
      }else if(data.manipulation_action==="copy"){
        notify("¡"+card.name+" utilizada! Has copiado "+(data.result_name||"la carta seleccionada")+".");
      }else if(data.manipulation_action==="steal"){
        notify("¡"+card.name+" utilizada! Has robado "+(data.result_name||"la carta seleccionada")+".");
      }else if(data.manipulation_action==="transform"){
        notify("¡"+card.name+" se ha transformado en "+(data.result_name||"la carta seleccionada")+"!");
      }else if(data.manipulation_action==="reverse"){
        notify("¡"+card.name+" utilizada! Has devuelto "+(data.result_name||"la carta seleccionada")+" a su rival.");
      }else if(unlock){
        const poolName=unlock.pool_slug==="legendary"?"Ruleta Legendaria":"Ruleta Fiesta";
        const granted=Number(unlock.spins_granted||1);
        notify("¡"+card.name+" canjeada! Has desbloqueado "+granted+" "+(granted===1?"giro":"giros")+" en "+poolName+". Pulsa el botón de giro cuando quieras utilizarlo.");
        if(!document.getElementById("page-roulette")?.hidden)focusWheelForSpecialSpin();
      }else{
        const remaining=Number(data.remaining_uses??0);
        notify(remaining>0
          ?"¡"+card.name+" utilizada! Te quedan "+remaining+" usos."
          :"¡"+card.name+" agotó todos sus usos!");
      }
    }
  }catch(error){
    console.error("No se pudo completar la acción de carta:",error);
    const detail=[error?.message,error?.details,error?.hint,error?.code].filter(Boolean).join(" · ");
    feedback.textContent=detail||"No se pudo completar la acción.";
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


let pokemonNamesEsCache=null;
let myPokemonSnapshot=null;

async function loadPokemonNamesEs(){
  if(pokemonNamesEsCache)return pokemonNamesEsCache;
  try{
    const response=await fetch("assets/pokemon-names-es.json",{cache:"force-cache"});
    if(!response.ok)throw new Error("No se pudo cargar el catálogo de nombres Pokémon.");
    pokemonNamesEsCache=await response.json();
  }catch(error){
    console.warn("No se pudo cargar el catálogo de nombres Pokémon:",error);
    pokemonNamesEsCache=[];
  }
  return pokemonNamesEsCache;
}

function pokemonName(speciesId){
  return pokemonNamesEsCache?.[Number(speciesId)-1]||("Pokémon #"+String(speciesId).padStart(3,"0"));
}

function pokemonSpriteUrl(mon){
  const base="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/";
  return base+(mon.shiny?"shiny/":"")+String(mon.species_id)+".png";
}
const pokemonDetailCache=new Map();
const pokemonNatureNames=[
  "Fuerte","Huraña","Audaz","Firme","Pícara","Osada","Dócil","Plácida","Agitada","Floja",
  "Miedosa","Activa","Seria","Alegre","Ingenua","Modesta","Afable","Mansa","Tímida","Alocada",
  "Serena","Amable","Grosera","Cauta","Rara"
];
const pokemonStatLabels=["PS","ATQ","DEF","VEL","AT. ESP.","DEF. ESP."];

function pokemonNatureName(id){
  const index=Number(id);
  return pokemonNatureNames[index]||("Naturaleza #"+String(index));
}
async function pokeApiJson(path){
  const url="https://pokeapi.co/api/v2/"+path;
  if(pokemonDetailCache.has(url))return pokemonDetailCache.get(url);
  const promise=fetch(url,{cache:"force-cache"}).then(response=>{
    if(!response.ok)throw new Error("No se pudo consultar "+path);
    return response.json();
  });
  pokemonDetailCache.set(url,promise);
  try{return await promise;}catch(error){pokemonDetailCache.delete(url);throw error;}
}
function localizedName(data){
  const name=data?.names?.find(entry=>entry.language?.name==="es");
  return name?.name||data?.name||"—";
}
const GEN5_ITEM_GAME_INDEX_URL="https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/item_game_indices.csv";
let gen5ItemApiIdMapPromise=null;
function loadGen5ItemApiIdMap(){
  if(gen5ItemApiIdMapPromise)return gen5ItemApiIdMapPromise;
  gen5ItemApiIdMapPromise=fetch(GEN5_ITEM_GAME_INDEX_URL).then(r=>{
    if(!r.ok)throw new Error("No se pudo cargar el índice de objetos de Gen 5");
    return r.text();
  }).then(csv=>{
    const map=new Map();
    const lines=csv.split(/\r?\n/);
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(",");
      if(cols.length<3)continue;
      const itemId=Number(cols[0]), generationId=Number(cols[1]), gameIndex=Number(cols[2]);
      if(generationId===5&&!map.has(gameIndex))map.set(gameIndex,itemId);
    }
    return map;
  }).catch(error=>{
    gen5ItemApiIdMapPromise=null;
    throw error;
  });
  return gen5ItemApiIdMapPromise;
}
async function resolveGen5ItemName(itemId){
  const id=Number(itemId);
  if(!id)return "Sin objeto";
  try{
    const map=await loadGen5ItemApiIdMap();
    const apiId=map.get(id);
    if(!apiId)return "Objeto #"+id;
    const itemData=await pokeApiJson("item/"+apiId);
    return localizedName(itemData)||itemData.name||("Objeto #"+id);
  }catch(error){
    return "Objeto #"+id;
  }
}
async function resolvePokemonDetailNames(mon){
  const result={moveDetails:[],ability:"—",item:"—"};
  const moveIds=(mon.moves||[]).filter(id=>Number(id)>0);
  const [moves,abilityData]=await Promise.all([
    Promise.all(moveIds.map(id=>pokeApiJson("move/"+id).catch(()=>null))),
    Number(mon.ability_id)>0?pokeApiJson("ability/"+Number(mon.ability_id)).catch(()=>null):Promise.resolve(null)
  ]);
  result.moveDetails=moves.map((move,index)=>move?{
    id:move.id,name:localizedName(move),type:move.type?.name||"",
    power:move.power,accuracy:move.accuracy,pp:mon.move_pp?.[index]??move.pp,
    ppUps:mon.move_pp_ups?.[index]??0
  }:{id:moveIds[index],name:"Movimiento #"+moveIds[index],type:"",power:null,accuracy:null,pp:mon.move_pp?.[index]??"—",ppUps:mon.move_pp_ups?.[index]??0});
  if(abilityData)result.ability=localizedName(abilityData)||abilityData.name;
  result.item=await resolveGen5ItemName(mon.held_item_id);
  return result;
}
function natureStatModifiers(natureId){
  const table=[
    [0,0],[1,2],[1,3],[1,4],[1,5],[2,1],[0,0],[2,3],[2,4],[2,5],
    [3,1],[3,2],[0,0],[3,4],[3,5],[4,1],[4,2],[4,3],[0,0],[4,5],
    [5,1],[5,2],[5,3],[5,4],[0,0]
  ];
  const [up,down]=table[Number(natureId)]||[0,0];
  const mods=[1,1,1,1,1,1];
  if(up&&down){mods[up]=1.1;mods[down]=0.9;}
  return mods;
}
function expForLevel(level,growth){
  const n=Number(level);
  if(growth==="fast")return Math.floor(4*n*n*n/5);
  if(growth==="medium-slow")return Math.floor(6*n*n*n/5-15*n*n+100*n-140);
  if(growth==="slow")return Math.floor(5*n*n*n/4);
  if(growth==="erratic"){
    if(n<=50)return Math.floor(n*n*n*(100-n)/50);
    if(n<=68)return Math.floor(n*n*n*(150-n)/100);
    if(n<=98)return Math.floor(n*n*n*((1911-10*n)/3)/500);
    return Math.floor(n*n*n*(160-n)/100);
  }
  if(growth==="fluctuating"){
    if(n<=15)return Math.floor(n*n*n*((n+1)/3+24)/50);
    if(n<=36)return Math.floor(n*n*n*(n+14)/50);
    return Math.floor(n*n*n*((n/2)+32)/50);
  }
  return n*n*n;
}
function levelFromExp(exp,growth){
  const value=Math.max(0,Number(exp)||0);
  let low=1,high=100,best=1;
  while(low<=high){
    const mid=(low+high)>>1;
    if(expForLevel(mid,growth)<=value){best=mid;low=mid+1;}else high=mid-1;
  }
  return best;
}
function calculatePokemonStats(mon,baseStats,level){
  const lvl=Number(level||mon.level);
  if(!lvl||!baseStats)return null;
  const evs=mon.evs||[0,0,0,0,0,0], ivs=mon.ivs||[0,0,0,0,0,0];
  const mods=natureStatModifiers(mon.nature_id);
  const raw=baseStats.map((base,i)=>Math.floor(((2*Number(base)+Number(ivs[i]||0)+Math.floor(Number(evs[i]||0)/4))*lvl)/100));
  return {
    hp:raw[0]+lvl+10,
    attack:Math.floor((raw[1]+5)*mods[1]),
    defense:Math.floor((raw[2]+5)*mods[2]),
    speed:Math.floor((raw[3]+5)*mods[3]),
    spAtk:Math.floor((raw[4]+5)*mods[4]),
    spDef:Math.floor((raw[5]+5)*mods[5])
  };
}
function pokemonDetailStatSet(mon,baseStats,level){
  const stats=mon.current_stats||mon.stats||null;
  const complete=stats && [stats.hp,stats.attack,stats.defense,stats.speed,stats.special_attack,stats.special_defense].every(v=>Number(v)>0);
  if(complete)return {
    hp:stats.hp,attack:stats.attack,defense:stats.defense,speed:stats.speed,
    spAtk:stats.special_attack,spDef:stats.special_defense
  };
  return calculatePokemonStats(mon,baseStats,level)||{
    hp:stats?.hp??mon.max_hp??mon.current_hp??"—",
    attack:stats?.attack??"—",
    defense:stats?.defense??"—",
    spAtk:stats?.special_attack??stats?.sp_atk??"—",
    spDef:stats?.special_defense??stats?.sp_def??"—",
    speed:stats?.speed??"—"
  };
}
function fillPokemonTrainingGrid(id,values){
  const root=document.getElementById(id);
  if(!root)return;
  root.replaceChildren();
  (values||[0,0,0,0,0,0]).forEach((value,index)=>{
    const row=document.createElement("div");
    row.className="pokemon-detail-training-row";
    row.innerHTML="<b>"+pokemonStatLabels[index]+"</b><span>"+Number(value||0)+"</span>";
    root.append(row);
  });
}
async function openPokemonDetail(mon){
  const modal=document.getElementById("pokemonDetailModal");
  if(!modal||!mon)return;
  modal.hidden=false;
  document.body.classList.add("pokemon-detail-open");
  const name=mon.nickname&&mon.nickname_is_custom?mon.nickname:pokemonName(mon.species_id);
  setText("pokemonDetailName",name);
  setText("pokemonDetailMeta","N.º "+String(mon.species_id).padStart(3,"0")+" · NIVEL "+(mon.level||"—"));
  setText("pokemonDetailGender",mon.gender_flag===1?"♀":mon.gender_flag===2?"♂":"●");
  const sprite=document.getElementById("pokemonDetailSprite");
  if(sprite){sprite.src=pokemonSpriteUrl(mon);sprite.alt=name;}
  const shiny=document.getElementById("pokemonDetailShiny");
  if(shiny)shiny.hidden=!mon.shiny;
  let baseStats=null, calculatedLevel=Number(mon.level)||null;
  try{
    const speciesData=await pokeApiJson("pokemon/"+mon.species_id);
    baseStats=["hp","attack","defense","speed","special-attack","special-defense"].map(name=>{
      const entry=speciesData.stats?.find(st=>st.stat?.name===name);
      return entry?.base_stat||0;
    });
    if(!calculatedLevel && mon.exp!=null){
      const growthUrl=speciesData.species?.url;
      const speciesDataDetail=growthUrl?await pokeApiJson(growthUrl.replace("https://pokeapi.co/api/v2/","")):null;
      const growth=speciesDataDetail?.growth_rate?.name||"medium-fast";
      calculatedLevel=levelFromExp(mon.exp,growth);
    }
  }catch(error){console.warn("No se pudieron cargar los datos de estadísticas:",error);}
  if(!calculatedLevel && mon.level)calculatedLevel=Number(mon.level);
  setText("pokemonDetailMeta","N.º "+String(mon.species_id).padStart(3,"0")+" · NIVEL "+(calculatedLevel||"—"));
  const stats=pokemonDetailStatSet(mon,baseStats,calculatedLevel);
  setText("pokemonStatHp",stats.hp);setText("pokemonStatAttack",stats.attack);setText("pokemonStatDefense",stats.defense);
  setText("pokemonStatSpAtk",stats.spAtk);setText("pokemonStatSpDef",stats.spDef);setText("pokemonStatSpeed",stats.speed);
  setText("pokemonDetailNature",pokemonNatureName(mon.nature_id));
  setText("pokemonDetailAbility","Cargando…");setText("pokemonDetailItem",Number(mon.held_item_id)>0?"Cargando…":"Ninguno");
  setText("pokemonDetailFriendship",mon.friendship??"—");
  fillPokemonTrainingGrid("pokemonDetailEvs",mon.evs);
  fillPokemonTrainingGrid("pokemonDetailIvs",mon.ivs);
  const movesRoot=document.getElementById("pokemonDetailMoves");
  if(movesRoot){
    movesRoot.innerHTML='<div class="pokemon-detail-loading">Cargando datos de ataques…</div>';
    try{
      const details=await resolvePokemonDetailNames(mon);
      if(document.getElementById("pokemonDetailModal")?.hidden)return;
      movesRoot.replaceChildren();
      if(!details.moveDetails.length){
        movesRoot.innerHTML='<div class="pokemon-detail-loading">Sin ataques registrados.</div>';
      }else{
        details.moveDetails.forEach(move=>{
          const row=document.createElement("div");
          row.className="pokemon-detail-move";
          const top=document.createElement("div");top.className="pokemon-detail-move-top";
          const moveName=document.createElement("strong");moveName.textContent=move.name;
          const type=document.createElement("span");type.textContent=move.type?move.type.toUpperCase():"—";
          top.append(moveName,type);
          const bottom=document.createElement("div");bottom.className="pokemon-detail-move-bottom";
          bottom.textContent="PP "+move.pp+(move.ppUps?" · +"+move.ppUps:"")+(move.power!=null?" · POT "+move.power:"")+(move.accuracy!=null?" · PREC "+move.accuracy:"");
          row.append(top,bottom);movesRoot.append(row);
        });
      }
      setText("pokemonDetailAbility",details.ability);
      setText("pokemonDetailItem",details.item);
    }catch(error){
      console.warn("No se pudieron cargar datos ampliados del Pokémon:",error);
      movesRoot.innerHTML='<div class="pokemon-detail-loading">Los ataques están guardados, pero no se pudo cargar su catálogo ampliado.</div>';
      setText("pokemonDetailAbility",mon.ability_id?"Habilidad #"+mon.ability_id:"—");
    }
  }
}
function bindPokemonDetailUI(){
  const modal=document.getElementById("pokemonDetailModal");
  const close=document.getElementById("closePokemonDetail");
  if(!modal||modal.dataset.bound==="true")return;
  modal.dataset.bound="true";
  close?.addEventListener("click",()=>{modal.hidden=true;document.body.classList.remove("pokemon-detail-open");});
  modal.addEventListener("click",event=>{
    if(event.target===modal){modal.hidden=true;document.body.classList.remove("pokemon-detail-open");}
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!modal.hidden){modal.hidden=true;document.body.classList.remove("pokemon-detail-open");}
  });
}

function formatPokemonUpdated(timestamp){
  if(!timestamp)return "SIN SINCRONIZAR";
  const date=new Date(timestamp);
  if(Number.isNaN(date.getTime()))return "SIN SINCRONIZAR";
  return "ACTUALIZADO · "+new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"short"}).format(date);
}

function renderPokemonCard(mon,{compact=false}={}){
  const article=document.createElement("article");
  article.className="pokemon-card pokemon-card-clickable"+(compact?" pokemon-card-compact":"");
  article.tabIndex=0;
  article.setAttribute("role","button");
  article.setAttribute("aria-label","Ver datos de "+(mon.nickname&&mon.nickname_is_custom?mon.nickname:pokemonName(mon.species_id)));
  article.addEventListener("click",()=>openPokemonDetail(mon));
  article.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openPokemonDetail(mon);}});
  const imageWrap=document.createElement("div");imageWrap.className="pokemon-card-image";
  const img=document.createElement("img");
  img.src=pokemonSpriteUrl(mon);img.alt=pokemonName(mon.species_id);img.loading="lazy";img.decoding="async";
  img.onerror=()=>{img.hidden=true;imageWrap.classList.add("is-missing");};
  imageWrap.append(img);
  const copy=document.createElement("div");copy.className="pokemon-card-copy";
  const name=document.createElement("strong");name.className="pokemon-card-name";
  name.textContent=mon.nickname&&mon.nickname_is_custom?mon.nickname:pokemonName(mon.species_id);
  const meta=document.createElement("span");meta.className="pokemon-card-meta";
  meta.textContent=(mon.shiny?"✨ SHINY · ":"")+"N.º "+String(mon.species_id).padStart(3,"0");
  if(mon.level)meta.textContent+=" · NIVEL "+mon.level;
  copy.append(name,meta);
  article.append(imageWrap,copy);
  if(mon.level){
    const level=document.createElement("span");level.className="pokemon-card-level";level.textContent="Lv "+mon.level;article.append(level);
  }
  return article;
}

function renderPokemonParty(container,party,emptyText="Sin Pokémon en el equipo."){
  if(!container)return;
  container.replaceChildren();
  const mons=Array.isArray(party)?party.filter(Boolean):[];
  if(!mons.length){
    const empty=document.createElement("div");empty.className="pokemon-empty";empty.textContent=emptyText;container.append(empty);return;
  }
  mons.forEach(mon=>container.append(renderPokemonCard(mon)));
}

function renderPokemonBoxes(container,boxes){
  if(!container)return;
  container.replaceChildren();
  const list=Array.isArray(boxes)?boxes:[];
  if(!list.length){
    const empty=document.createElement("div");
    empty.className="pokemon-empty";
    empty.textContent="No hay datos de PC disponibles.";
    container.append(empty);
    return;
  }

  const viewer=document.createElement("div");
  viewer.className="pokemon-box-viewer";

  const nav=document.createElement("div");
  nav.className="pokemon-box-nav";

  const previous=document.createElement("button");
  previous.type="button";
  previous.className="pokemon-box-nav-button";
  previous.innerHTML="<span>‹</span><b>ANTERIOR</b>";

  const identity=document.createElement("div");
  identity.className="pokemon-box-identity";
  const title=document.createElement("strong");
  const count=document.createElement("span");
  identity.append(title,count);

  const next=document.createElement("button");
  next.type="button";
  next.className="pokemon-box-nav-button";
  next.innerHTML="<b>SIGUIENTE</b><span>›</span>";

  nav.append(previous,identity,next);

  const grid=document.createElement("div");
  grid.className="pokemon-box-grid pokemon-box-grid-viewer";

  viewer.append(nav,grid);
  container.append(viewer);

  let currentIndex=0;

  function draw(){
    const box=list[currentIndex]||{number:currentIndex+1,slots:[]};
    const slots=Array.isArray(box.slots)?box.slots:[];
    const occupied=slots.filter(Boolean).length;
    title.textContent="CAJA "+box.number;
    count.textContent=occupied+" POKÉMON · "+(currentIndex+1)+" / "+list.length;
    previous.disabled=currentIndex===0;
    next.disabled=currentIndex===list.length-1;
    previous.setAttribute("aria-label","Ver caja anterior");
    next.setAttribute("aria-label","Ver caja siguiente");
    grid.replaceChildren();

    for(let i=0;i<30;i++){
      const slot=document.createElement("div");
      slot.className="pokemon-slot";
      const mon=slots[i];
      if(mon){
        const img=document.createElement("img");
        img.src=pokemonSpriteUrl(mon);
        img.alt=pokemonName(mon.species_id);
        img.loading="lazy";
        img.decoding="async";
        img.onerror=()=>{
          img.hidden=true;
          slot.textContent="N.º "+String(mon.species_id).padStart(3,"0");
        };
        slot.append(img);
        slot.title=(mon.nickname&&mon.nickname_is_custom?mon.nickname:pokemonName(mon.species_id))+(mon.shiny?" · Shiny":"");
        slot.tabIndex=0;
        slot.setAttribute("role","button");
        slot.setAttribute("aria-label","Ver datos de "+(mon.nickname&&mon.nickname_is_custom?mon.nickname:pokemonName(mon.species_id)));
        slot.addEventListener("click",()=>openPokemonDetail(mon));
        slot.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openPokemonDetail(mon);}});
      }else{
        const empty=document.createElement("span");
        empty.textContent="—";
        slot.append(empty);
      }
      grid.append(slot);
    }
  }

  previous.addEventListener("click",()=>{
    if(currentIndex>0){currentIndex--;draw();}
  });
  next.addEventListener("click",()=>{
    if(currentIndex<list.length-1){currentIndex++;draw();}
  });

  draw();
}
async function loadMyPokemonSnapshot(){
  const party=document.getElementById("myPokemonParty");
  const boxes=document.getElementById("myPokemonBoxes");
  if(!party||!boxes)return;
  if(!currentAuthUser||!authClient){
    myPokemonSnapshot=null;
    renderPokemonParty(party,[], "Inicia sesión para sincronizar tu partida.");
    renderPokemonBoxes(boxes,[]);
    setText("myPokemonUpdated","SIN SESIÓN");
    setText("myPokemonBoxCount","0 POKÉMON");
    return;
  }
  const {data,error}=await authClient.from("player_save_snapshots")
    .select("player_id,game_title,save_format,trainer_data,party,boxes,parser_version,save_checksum,synced_at,updated_at")
    .eq("player_id",currentAuthUser.id).maybeSingle();
  if(error){
    console.error("No se pudo cargar tu partida sincronizada:",error.message);
    setText("saveImportStatus","No se pudo consultar tu partida sincronizada.");
    return;
  }
  myPokemonSnapshot=data||null;
  if(!data){
    renderPokemonParty(party,[],"Todavía no has sincronizado una partida.");
    renderPokemonBoxes(boxes,[]);
    setText("myPokemonUpdated","SIN SINCRONIZAR");
    setText("myPokemonBoxCount","0 POKÉMON");
    return;
  }
  await loadPokemonNamesEs();
  renderPokemonParty(party,data.party,"Tu equipo está vacío.");
  renderPokemonBoxes(boxes,data.boxes);
  const occupied=Number(data.boxes?.reduce((sum,box)=>sum+(box.slots||[]).filter(Boolean).length,0)||0);
  setText("myPokemonUpdated",formatPokemonUpdated(data.synced_at||data.updated_at));
  setText("myPokemonBoxCount",occupied+" POKÉMON");
}

function saveFormatFromFile(file){
  const ext=(file?.name||"").toLowerCase().split(".").pop();
  return ext==="dsv"?"dsv":ext==="main"?"main":"sav";
}

async function importPokemonSaveFile(file){
  const status=document.getElementById("saveImportStatus");
  const button=document.getElementById("saveImportButton");
  if(!file||!currentAuthUser||!authClient)return;
  if(file.size<0x80000){
    status.textContent="El archivo es demasiado pequeño para una partida Negro 2 / Blanco 2 válida.";
    status.className="save-import-status error";return;
  }
  button.disabled=true;status.textContent="PROCESANDO PARTIDA…";status.className="save-import-status busy";
  try{
    const saveBuffer=await file.arrayBuffer();
    const parsed=window.TypeLinkGen5SaveParser.parseSave(saveBuffer);
    await loadPokemonNamesEs();
    const occupied=Number(parsed.occupied_pc_slots||0);
    const partyCount=Number(parsed.party?.length||0);
    if(!partyCount&&!occupied)throw new Error("No encontramos Pokémon en el equipo ni en el PC. Comprueba que sea una partida de Pokémon Negro 2 / Blanco 2.");
    const checksumBuffer=await crypto.subtle.digest("SHA-256",window.TypeLinkGen5SaveParser.normalizeSave(saveBuffer));
    const checksum=Array.from(new Uint8Array(checksumBuffer)).map(v=>v.toString(16).padStart(2,"0")).join("");
    parsed.trainer.filename=file.name;
    parsed.trainer.file_size=file.size;
    parsed.trainer.source_format=saveFormatFromFile(file);
    const payload={
      player_id:currentAuthUser.id,
      game_title:parsed.game_title,
      save_format:saveFormatFromFile(file),
      trainer_data:parsed.trainer,
      party:parsed.party,
      boxes:parsed.boxes,
      bag:{},
      save_checksum:checksum,
      parser_version:parsed.parser_version,
      synced_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    const {error}=await authClient.from("player_save_snapshots").upsert(payload,{onConflict:"player_id"});
    if(error)throw error;
    myPokemonSnapshot=payload;
    renderPokemonParty(document.getElementById("myPokemonParty"),payload.party);
    renderPokemonBoxes(document.getElementById("myPokemonBoxes"),payload.boxes);
    setText("myPokemonUpdated",formatPokemonUpdated(payload.synced_at));
    setText("myPokemonBoxCount",occupied+" POKÉMON");
    status.textContent="PARTIDA IMPORTADA · "+partyCount+" EN EQUIPO · "+occupied+" EN PC";
    status.className="save-import-status success";
    notify("¡Partida sincronizada correctamente!");
    await loadPlayers();
  }catch(error){
    console.error("No se pudo importar la partida:",error);
    status.textContent="No se pudo importar: "+(error.message||"archivo no válido.");
    status.className="save-import-status error";
  }finally{
    button.disabled=false;
  }
}

function bindPublicPokemonViewer(){
  const button=document.getElementById("publicPlayerPokemonButton");
  const section=document.getElementById("publicPlayerPokemonSection");
  if(!button||!section||button.dataset.bound==="true")return;
  button.dataset.bound="true";
  button.addEventListener("click",()=>{
    section.hidden=false;
    section.classList.add("is-revealed");
    button.closest(".public-profile-pokemon-cta")?.classList.add("is-open");
    requestAnimationFrame(()=>{
      const cta=button.closest(".public-profile-pokemon-cta");
      const top=cta ? cta.getBoundingClientRect().top + window.scrollY - 18 : window.scrollY;
      window.scrollTo({top,behavior:"smooth"});
    });
  });
}
async function showPublicPokemonSnapshot(playerId){
  const partyContainer=document.getElementById("publicPlayerPokemonParty");
  const boxesContainer=document.getElementById("publicPlayerPokemonBoxes");
  if(!partyContainer||!boxesContainer)return;
  const {data,error}=await authClient.from("player_save_snapshots")
    .select("game_title,save_format,party,boxes,synced_at,updated_at")
    .eq("player_id",playerId).maybeSingle();
  if(error){
    console.error("No se pudo cargar el equipo Pokémon del entrenador:",error.message);
    renderPokemonParty(partyContainer,[],"No se pudo consultar su partida.");
    renderPokemonBoxes(boxesContainer,[]);
    setText("publicPlayerPokemonUpdated","NO DISPONIBLE");
    setText("publicPlayerPokemonBoxCount","0 POKÉMON");
    return;
  }
  if(!data){
    renderPokemonParty(partyContainer,[],"Este entrenador todavía no ha sincronizado su partida.");
    renderPokemonBoxes(boxesContainer,[]);
    setText("publicPlayerPokemonUpdated","SIN SINCRONIZAR");
    setText("publicPlayerPokemonBoxCount","0 POKÉMON");
    return;
  }
  await loadPokemonNamesEs();
  renderPokemonParty(partyContainer,data.party,"Su equipo está vacío.");
  renderPokemonBoxes(boxesContainer,data.boxes);
  const occupied=Number(data.boxes?.reduce((sum,box)=>sum+(box.slots||[]).filter(Boolean).length,0)||0);
  setText("publicPlayerPokemonUpdated",formatPokemonUpdated(data.synced_at||data.updated_at));
  setText("publicPlayerPokemonBoxCount",occupied+" POKÉMON");
}

function bindPokemonSyncUI(){
  bindPokemonDetailUI();
  const input=document.getElementById("saveFileInput");
  const choose=document.getElementById("saveFileButton");
  const importButton=document.getElementById("saveImportButton");
  const fileName=document.getElementById("saveFileName");
  if(!input||!choose||!importButton||choose.dataset.bound==="true")return;
  choose.dataset.bound="true";
  choose.addEventListener("click",()=>input.click());
  input.addEventListener("change",()=>{
    const file=input.files?.[0]||null;
    fileName.textContent=file?file.name:"Ningún archivo seleccionado.";
    importButton.disabled=!file;
    const status=document.getElementById("saveImportStatus");
    if(status){status.textContent=file?"Listo para importar: "+file.name:"Selecciona tu partida para comenzar.";status.className="save-import-status";}
  });
  importButton.addEventListener("click",()=>{
    const file=input.files?.[0]||null;
    if(file)void importPokemonSaveFile(file);
  });
}

function setupRealtime(){
  if(!authClient||!currentAuthUser)return;
  if(inventoryChannel)authClient.removeChannel(inventoryChannel);
  if(profilesChannel)authClient.removeChannel(profilesChannel);
  if(activityChannel)authClient.removeChannel(activityChannel);
  if(notificationChannel)authClient.removeChannel(notificationChannel);
  if(pokemonChannel)authClient.removeChannel(pokemonChannel);
  if(typeLeagueChannel)authClient.removeChannel(typeLeagueChannel);
  inventoryChannel=authClient.channel("typelink-player-cards-"+currentAuthUser.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"player_cards",filter:"owner_id=eq."+currentAuthUser.id},()=>{
      if(!spinning){loadCloudInventory();loadPlayers();}
    })
    .subscribe();
  profilesChannel=authClient.channel("typelink-public-profiles")
    .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>loadPlayers())
    .subscribe();
  activityChannel=authClient.channel("typelink-community-activity")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"card_activity"},payload=>{
      loadActivityFeed();
      loadPlayers();
      const entry=payload.new||{};
      const profileModal=document.getElementById("publicProfileModal");
      const openPlayerId=profileModal?.dataset.playerId;
      if(entry.activity_type==="tramo_award"||entry.activity_type==="tramo_adjustment"){
        if(openPlayerId&&(entry.actor_id===openPlayerId||entry.target_id===openPlayerId)){
          void refreshPublicIncomingCards(openPlayerId);
        }
      }else if(entry.activity_type==="play"&&openPlayerId&&entry.target_id===openPlayerId){
        void refreshPublicIncomingCards(openPlayerId);
      }
    })
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"card_activity"},()=>loadActivityFeed())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_tramo_progress",filter:"owner_id=eq."+currentAuthUser.id},()=>{if(!spinning){loadCloudInventory();loadPlayers();}})
    .on("postgres_changes",{event:"*",schema:"public",table:"player_effects",filter:"owner_id=eq."+currentAuthUser.id},()=>loadProfileMechanics())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_type_status",filter:"owner_id=eq."+currentAuthUser.id},()=>loadProfileMechanics())
    .on("postgres_changes",{event:"*",schema:"public",table:"player_roulette_unlocks",filter:"owner_id=eq."+currentAuthUser.id},()=>loadRouletteAccess())
    .subscribe();
  pokemonChannel=authClient.channel("typelink-pokemon-snapshots")
    .on("postgres_changes",{event:"*",schema:"public",table:"player_save_snapshots"},payload=>{
      const playerId=payload.new?.player_id||payload.old?.player_id;
      if(playerId===currentAuthUser.id)void loadMyPokemonSnapshot();
      const profileModal=document.getElementById("publicProfileModal");
      if(profileModal&&!profileModal.hidden&&profileModal.dataset.playerId===playerId)void showPublicPokemonSnapshot(playerId);
      loadPlayers();
    })
    .subscribe();
  notificationChannel=authClient.channel("typelink-private-notifications-"+currentAuthUser.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"recipient_id=eq."+currentAuthUser.id},()=>loadNotifications())
    .subscribe();
  typeLeagueChannel=authClient.channel("typelink-typeleague-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"typeleague_matches"},()=>{
      const publicPage=document.getElementById("page-typeleague");
      const adminWorkspace=document.getElementById("adminTypeLeagueWorkspace");
      if(publicPage&&!publicPage.hidden)void loadTypeLeagueData({quiet:true});
      if(isAdmin&&adminWorkspace&&!adminWorkspace.hidden)void loadTypeLeagueData({quiet:true});
    })
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
  const typeLeagueWorkspace=document.getElementById("adminTypeLeagueWorkspace");
  if(overview)overview.hidden=false;
  if(catalogWorkspace)catalogWorkspace.hidden=true;
  if(trainersWorkspace)trainersWorkspace.hidden=true;
  if(rouletteWorkspace)rouletteWorkspace.hidden=true;
  if(mechanicsWorkspace)mechanicsWorkspace.hidden=true;
  if(progressionWorkspace)progressionWorkspace.hidden=true;
  if(platformWorkspace)platformWorkspace.hidden=true;
  if(typeLeagueWorkspace)typeLeagueWorkspace.hidden=true;
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
  setText("adminTrainersCardsTotal",adminTrainerItems.reduce((sum,trainer)=>sum+Number(trainer.cards_available||0),0));
  
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
    const cards=document.createElement("span");cards.textContent=Number(trainer.cards_available||0)+" "+(Number(trainer.cards_available||0)===1?"CARTA":"CARTAS");
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
function renderAdminTrainerIncomingCards(cards){
  const wrap=document.getElementById("adminTrainerIncomingCards");
  if(!wrap)return;
  wrap.replaceChildren();
  const rows=Array.isArray(cards)?cards:[];
  setText("adminTrainerIncomingCount",rows.length+" "+(rows.length===1?"CARTA":"CARTAS"));
  if(!rows.length){
    const empty=document.createElement("div");
    empty.className="profile-module-empty";
    empty.textContent="Todavía no le han lanzado cartas en este tramo.";
    wrap.append(empty);
    return;
  }

  // Las cartas lanzadas usan exactamente la misma ficha visual que las cartas
  // que el entrenador tiene en su inventario. Solo cambia la información y
  // la acción disponible (retirar la carta lanzada).
  rows.forEach(card=>{
    const row=document.createElement("article");
    row.className="admin-trainer-card-item";

    const imageWrap=document.createElement("div");
    imageWrap.className="admin-trainer-card-image";
    if(card.image_path){
      const image=document.createElement("img");
      image.src=card.image_path;
      image.alt=card.card_name||"Carta TypeLink";
      image.loading="lazy";
      image.onerror=()=>{
        image.remove();
        const fallback=document.createElement("span");
        fallback.textContent="▧";
        imageWrap.append(fallback);
      };
      imageWrap.append(image);
    }else{
      const fallback=document.createElement("span");
      fallback.textContent="▧";
      imageWrap.append(fallback);
    }

    const body=document.createElement("div");
    body.className="admin-trainer-card-body";

    const title=document.createElement("strong");
    title.textContent=card.card_name||"Carta TypeLink";

    const meta=document.createElement("small");
    meta.textContent=(adminCategoryLabel(card.category)||"CARTA")+" · "+
      (adminRarityLabel(card.rarity)||"CARTA")+" · LANZADA POR "+(card.sender_name||"Entrenador");

    const message=document.createElement("span");
    const customMessage=typeof card.custom_message==="string"?card.custom_message.trim():"";
    message.textContent=customMessage
      ? "MENSAJE: “"+customMessage+"”"
      : "SIN MENSAJE PERSONALIZADO";

    const when=document.createElement("span");
    when.textContent="LANZADA EL "+formatDate(card.created_at);

    body.append(title,meta,message,when);

    const remove=document.createElement("button");
    remove.type="button";
    remove.className="admin-trainer-card-remove";
    remove.textContent="RETIRAR CARTA LANZADA";
    remove.title="Retirar esta carta del apartado de cartas lanzadas";
    remove.addEventListener("click",()=>removeAdminTrainerIncomingCard(card));

    row.append(imageWrap,body,remove);
    wrap.append(row);
  });
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
  const usableCardCount=Number(stats.cards_available??stats.cards_total??0);
  setText("adminTrainerCardCount",usableCardCount);
  setText("adminTrainerInventoryCount",usableCardCount+" DISPONIBLES");
  const note="Límite de baraja normal: "+Number(stats.normal_available||0)+" / "+Number(data.normal_card_limit||5)+
    " · Cartas de tramo: "+Number(stats.tramo_available||0)+
    " · Fiesta: "+Number(stats.fiesta_available||0)+
    " · Gastadas: "+Number(stats.cards_used||0)+" (ocultas de la baraja)";
  setText("adminTrainerProgressNote",note);

  const inventory=document.getElementById("adminTrainerInventory");
  inventory.replaceChildren();
  const cards=(Array.isArray(data.inventory)?data.inventory:[])
    .filter(item=>item&&item.status==="available"&&Number(item.remaining_uses)>0);
  if(!cards.length){
    const empty=document.createElement("div");empty.className="admin-catalog-loading";
    empty.textContent="Sin cartas disponibles en este inventario.";
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
    const iconWrap=document.createElement("span");iconWrap.className="admin-trainer-type-icon";
    iconWrap.style.setProperty("--type-color",type.color);
    const icon=document.createElement("img");icon.src=type.icon;icon.alt="";icon.setAttribute("aria-hidden","true");icon.loading="lazy";icon.decoding="async";
    icon.onerror=()=>{iconWrap.classList.add("is-missing");icon.remove();const fallback=document.createElement("span");fallback.textContent=type.name.slice(0,1);iconWrap.append(fallback);};
    iconWrap.append(icon);
    const name=document.createElement("strong");name.textContent=type.name;
    const state=document.createElement("small");state.textContent=enabled?"HABILITADO":"BLOQUEADO";
    chip.append(iconWrap,name,state);typesWrap.append(chip);
  });
  setText("adminTrainerTypesCount",enabledCount+" / "+POKEMON_TYPES.length+" ACTIVOS");

  const effectsWrap=document.getElementById("adminTrainerEffects");
  effectsWrap.replaceChildren();
  const effects=Array.isArray(data.effects)?data.effects:[];
  renderAdminTrainerIncomingCards(data.incoming_cards);
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
    const [trainerResult,incomingResult]=await Promise.all([
      authClient.rpc("admin_get_trainer",{p_player_id:playerId}),
      authClient.rpc("get_trainer_incoming_cards",{p_trainer_id:playerId})
    ]);
    if(trainerResult.error)throw trainerResult.error;
    if(!trainerResult.data?.trainer?.id)throw new Error("Supabase no devolvió la ficha del entrenador.");
    const incomingCards=Array.isArray(incomingResult.data)?incomingResult.data:[];
    if(incomingResult.error){
      console.warn("No se pudieron cargar las cartas lanzadas al entrenador:",incomingResult.error.message);
    }
    trainerResult.data.incoming_cards=incomingCards;
    adminTrainerDetail=trainerResult.data;
    renderAdminTrainerDetail(trainerResult.data);
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
async function removeAdminTrainerIncomingCard(card){
  if(!isAdmin||!authClient||!adminSelectedTrainerId||!card?.activity_id){
    notify("No se pudo identificar la carta lanzada que quieres retirar.");
    return;
  }
  const cardName=card.card_name||"esta carta";
  if(!window.confirm("¿Retirar «"+cardName+"» de las cartas lanzadas a "+adminSelectedTrainerName+"?\\n\\nSe quitará de este tramo y quedará registrado que fue retirada por administración. Los efectos que ya se hayan aplicado no se revierten."))return;
  try{
    const {data,error}=await authClient.rpc("admin_remove_incoming_card",{
      p_player_id:adminSelectedTrainerId,
      p_activity_id:card.activity_id
    });
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó la retirada.");
    notify("Se retiró «"+(result.card_name||cardName)+"» de las cartas lanzadas.");
    await openAdminTrainerDetail(adminSelectedTrainerId);
    await loadActivityFeed();
    await loadPlayers();
  }catch(error){
    console.error("No se pudo retirar la carta lanzada:",error);
    notify("No se pudo retirar la carta lanzada: "+(error.message||"error desconocido"));
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

async function clearAdminTrainerSync(){
  if(!isAdmin||!authClient||!adminSelectedTrainerId){
    notify("No hay un entrenador seleccionado.");
    return;
  }
  const trainerName=adminSelectedTrainerName||"este entrenador";
  if(!window.confirm(
    "¿Quitar TypeLink Sync de «"+trainerName+"»?\n\n"+
    "Se eliminará su partida sincronizada, equipo y PC guardados en TypeLink Sync. "+
    "No se borrará su cuenta, progreso, cartas ni otros datos del evento.\n\n"+
    "Podrá volver a importar su partida después."
  ))return;
  const button=document.getElementById("adminClearTrainerSyncButton");
  if(button){button.disabled=true;button.textContent="QUITANDO...";}
  try{
    const {data,error}=await authClient.rpc("admin_clear_trainer_sync",{p_player_id:adminSelectedTrainerId});
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó la eliminación de TypeLink Sync.");
    notify("TypeLink Sync de "+(result.trainer_name||trainerName)+" ha sido eliminado.");
    await openAdminTrainerDetail(adminSelectedTrainerId);
    await loadPlayers();
  }catch(error){
    console.error("No se pudo quitar TypeLink Sync:",error);
    notify("No se pudo quitar TypeLink Sync: "+(error.message||"error desconocido"));
  }finally{
    if(button){button.disabled=false;button.textContent="QUITAR TYPELINK SYNC";}
  }
}

async function deleteAdminTrainer(){
  if(!isAdmin||!authClient||!adminSelectedTrainerId){
    notify("No hay un entrenador seleccionado.");
    return;
  }

  const trainerName=adminSelectedTrainerName||"este entrenador";
  const warning=
    "VAS A ELIMINAR PERMANENTEMENTE A «"+trainerName+"».\n\n"+
    "Se eliminarán su cuenta, inventario, progreso, efectos, desbloqueos, guardado y partidas de TypeLeague. "+
    "El historial general de actividad se conservará cuando sea posible.\n\n"+
    "ESTA ACCIÓN NO SE PUEDE DESHACER.\n\n"+
    "¿Deseas continuar?";
  if(!window.confirm(warning))return;

  const confirmation=window.prompt(
    "Para confirmar la eliminación de «"+trainerName+"», escribe exactamente ELIMINAR."
  );
  if(confirmation!=="ELIMINAR"){
    notify("Eliminación cancelada. No se modificó el entrenador.");
    return;
  }

  const button=document.getElementById("adminDeleteTrainerButton");
  if(button){
    button.disabled=true;
    button.textContent="ELIMINANDO...";
  }

  try{
    const {data,error}=await authClient.rpc("admin_delete_trainer",{
      p_player_id:adminSelectedTrainerId
    });
    if(error)throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.success)throw new Error("El servidor no confirmó la eliminación.");

    notify("Se eliminó definitivamente a "+(result.trainer_name||trainerName)+".");
    adminSelectedTrainerId=null;
    adminSelectedTrainerName="";
    adminTrainerDetail=null;

    await loadAdminTrainers();
    await loadActivityFeed();
    await loadPlayers();
    showAdminTrainerList();
  }catch(error){
    console.error("No se pudo eliminar el entrenador:",error);
    notify("No se pudo eliminar el entrenador: "+(error.message||"error desconocido"));
  }finally{
    if(button){
      button.disabled=false;
      button.textContent="ELIMINAR ENTRENADOR";
    }
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
  if(effect.effect_key==="protection_normal")return "Protección normal";
  if(effect.effect_key==="protection_ultimate")return "Protección definitiva";
  if(effect.effect_key==="destroy_normal_deck")return "Romper baraja";
  if(effect.effect_key==="copy_opponent_card")return "Copiar carta de un rival";
  if(effect.effect_key==="copy_incoming_card")return "Copiar carta recibida";
  if(effect.effect_key==="steal_opponent_card")return "Robar carta de un rival";
  if(effect.effect_key==="transform_card")return "Transformar carta";
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
  const activeEffectCount=item=> (item.effects||[]).filter(effect=>effect.is_active).length;
  const pendingCount=adminMechanicsItems.filter(item=>{
    const card=item.card||{};
    return activeEffectCount(item)===0 && card.allow_no_effect_play!==true && card.category!=="tramo";
  }).length;
  setText("adminMechanicsCardsTotal",adminMechanicsItems.length);
  setText("adminMechanicsEffectsTotal",adminMechanicsItems.filter(item=>activeEffectCount(item)>0).length);
  setText("adminMechanicsEvolutionsTotal",adminMechanicsItems.filter(item=>item.evolution?.is_active).length);
  setText("adminMechanicsPendingTotal",pendingCount);
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
    const effect=document.createElement("span");
    if(effectCount){
      effect.textContent=effectCount+" efecto(s) activo(s)";
      effect.className="is-configured";
    }else if(card.allow_no_effect_play===true){
      effect.textContent="Sin efecto automático · permitido";
      effect.className="is-neutral";
    }else{
      effect.textContent="PENDIENTE · sin efecto configurado";
      effect.className="is-pending";
    }
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
    ?"Evoluciona automáticamente al avanzar de tramo."
    :"El entrenador elige cuándo evolucionar desde su baraja.";
  if(sameTramo)message+=" Solo copias del mismo tramo.";
  setText("adminEvolutionMethodNote",message);
}
function createAdminEffectRow(effect={}){
  const row=document.createElement("article");row.className="admin-mechanics-effect-row";
  const top=document.createElement("div");top.className="admin-mechanics-effect-top";
  const typeLabel=document.createElement("label");typeLabel.className="admin-field";
  typeLabel.textContent="TIPO DE EFECTO";
  const type=document.createElement("select");type.dataset.role="effect-key";
  type.innerHTML='<option value="normal_card_limit">Modificar límite de baraja</option><option value="tramo_spin_credit">Conceder giros extra</option><option value="protection_normal">Protección normal</option><option value="protection_ultimate">Protección definitiva</option><option value="destroy_normal_deck">Romper baraja</option><option value="copy_opponent_card">Copiar carta de un rival</option><option value="copy_incoming_card">Copiar carta recibida</option><option value="steal_opponent_card">Robar carta de un rival</option><option value="steal_full_deck">Robar baraja completa</option><option value="swap_full_deck">Intercambiar barajas completas</option><option value="reverse_effect">Revierte Efecto</option><option value="transform_card">Transformar carta</option><option value="unlock_roulette">Desbloquear ruleta</option>';
  type.value=["normal_card_limit","tramo_spin_credit","protection_normal","protection_ultimate","destroy_normal_deck","copy_opponent_card","copy_incoming_card","steal_opponent_card","steal_full_deck","swap_full_deck","reverse_effect","transform_card","unlock_roulette"].includes(effect.effect_key)?effect.effect_key:"normal_card_limit";
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
  const spinValue=document.createElement("input");spinValue.type="number";spinValue.min="1";spinValue.max="100";spinValue.step="1";spinValue.inputMode="numeric";spinValue.value=String(effect.effect_key==="tramo_spin_credit"&&effect.effect_value!=null?effect.effect_value:3);spinValue.dataset.role="effect-value";spinValue.setAttribute("aria-label","Cantidad de giros extra, de 1 a 100");spinValueLabel.append(spinValue);
  const spinNote=document.createElement("p");spinNote.className="admin-mechanics-inline-note";spinNote.textContent="Se acreditan al instante y no caducan.";
  spinFields.append(spinValueLabel,spinNote);

  const protectionFields=document.createElement("div");protectionFields.className="admin-mechanics-effect-fields";protectionFields.dataset.role="protection-fields";
  const protectionNote=document.createElement("p");protectionNote.className="admin-mechanics-inline-note";protectionNote.textContent="Al usarla, el entrenador elegirá una carta que le hayan lanzado. La protección se aplica en ese momento.";
  protectionFields.append(protectionNote);

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
    const protection=key==="protection_normal"||key==="protection_ultimate";
    const destroyDeck=key==="destroy_normal_deck";
    const cardManipulation=["copy_opponent_card","copy_incoming_card","steal_opponent_card","steal_full_deck","swap_full_deck","reverse_effect","transform_card"].includes(key);
    const hideLimitFields=unlock||spin||protection||destroyDeck||cardManipulation;
    limitFields.hidden=hideLimitFields;
    limitFields.style.setProperty("display",hideLimitFields?"none":"", "important");
    spinFields.hidden=!spin;
    spinFields.style.setProperty("display",spin?"":"none", "important");
    protectionFields.hidden=!protection;
    protectionFields.style.setProperty("display",protection?"":"none", "important");
    unlockFields.hidden=!unlock;
    unlockFields.style.setProperty("display",unlock?"":"none", "important");
    timedWrap.hidden=hideLimitFields||duration.value!=="timed";
    timedWrap.style.setProperty("display",(hideLimitFields||duration.value!=="timed")?"none":"", "important");
    if(type.dataset.changed==="true"){
      const target=document.getElementById("adminMechanicsTargetScope");
      const disposition=document.getElementById("adminMechanicsDisposition");
      if(key==="destroy_normal_deck"||key==="steal_full_deck"||key==="swap_full_deck"){
        target.value="opponent";
      }else{
        target.value="self";
      }
      disposition.value="consume";
    }
  }
  type.addEventListener("change",()=>{
    type.dataset.changed="true";
    if(type.value==="tramo_spin_credit")spinValue.value="3";
    const target=document.getElementById("adminMechanicsTargetScope");
    const disposition=document.getElementById("adminMechanicsDisposition");
    if(target&&disposition){
      target.value=(type.value==="destroy_normal_deck"||type.value==="steal_full_deck"||type.value==="swap_full_deck")?"opponent":"self";
      disposition.value="consume";
    }
    sync();
  });
  duration.addEventListener("change",sync);
  row.append(top,limitFields,spinFields,protectionFields,unlockFields);
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
  const hasWholeDeckTargetEffect=(item.effects||[]).some(effect=>(effect.effect_key==="steal_full_deck"||effect.effect_key==="swap_full_deck")&&effect.is_active!==false);
  const initialTargetScope=hasWholeDeckTargetEffect?"opponent":(card.target_scope||"self");
  const initialDisposition=hasWholeDeckTargetEffect?"consume":(card.disposition||"consume");
  document.getElementById("adminMechanicsTargetScope").value=initialTargetScope;
  document.getElementById("adminMechanicsDisposition").value=initialDisposition;

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
  const invalidSpinRow=rows.find(row=>{
    if(row.querySelector('[data-role="effect-key"]')?.value!=="tramo_spin_credit")return false;
    const input=row.querySelector('[data-role="spin-fields"] [data-role="effect-value"]');
    const amount=input?.valueAsNumber;
    return !Number.isInteger(amount)||amount<1||amount>100;
  });
  if(invalidSpinRow){
    const input=invalidSpinRow.querySelector('[data-role="effect-value"]');
    input?.focus();
    notify("Los giros extra deben ser un número entero entre 1 y 100.");
    return;
  }
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
        effect_value:Number(row.querySelector('[data-role="spin-fields"] [data-role="effect-value"]').value),
        is_active:row.querySelector('[data-role="is-active"]').checked
      };
    }
    if(key==="protection_normal"||key==="protection_ultimate"||key==="destroy_normal_deck"||key==="copy_opponent_card"||key==="copy_incoming_card"||key==="steal_opponent_card"||key==="steal_full_deck"||key==="swap_full_deck"||key==="reverse_effect"||key==="transform_card"){
      return {effect_key:key,is_active:row.querySelector('[data-role="is-active"]').checked};
    }
    const duration=row.querySelector('[data-role="duration-type"]').value;
    return {
      effect_key:key,
      effect_value:Number(row.querySelector('[data-role="limit-fields"] [data-role="effect-value"]').value),
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
  let targetScope=document.getElementById("adminMechanicsTargetScope").value;
  let disposition=document.getElementById("adminMechanicsDisposition").value;
  if(effects.some(effect=>effect.effect_key==="steal_full_deck"||effect.effect_key==="swap_full_deck")){
    targetScope="opponent";
    disposition="consume";
    document.getElementById("adminMechanicsTargetScope").value="opponent";
    document.getElementById("adminMechanicsDisposition").value="consume";
  }
  if(effects.some(effect=>effect.effect_key==="unlock_roulette")&&targetScope!=="self"){
    notify("El desbloqueo debe afectar a quien utiliza la carta.");
    return;
  }
  if(effects.some(effect=>effect.effect_key==="destroy_normal_deck")&&targetScope!=="opponent"){
    notify("Romper baraja debe tener como objetivo a otro entrenador.");
    return;
  }
  const cardManipulationEffects=["copy_opponent_card","copy_incoming_card","steal_opponent_card","reverse_effect","transform_card"];
  if(effects.some(effect=>cardManipulationEffects.includes(effect.effect_key))&&targetScope!=="self"){
    notify("Estos efectos se aplican sobre quien utiliza la carta.");
    return;
  }
  if(effects.some(effect=>effect.effect_key==="steal_full_deck"||effect.effect_key==="swap_full_deck")&&targetScope!=="opponent"){
    notify("Robar o intercambiar toda la baraja requiere elegir a un rival.");
    return;
  }
    if(effects.some(effect=>effect.effect_key==="transform_card")&&disposition!=="consume"){
    notify("Transformar carta debe consumir la carta utilizada.");
    return;
  }
  if(effects.some(effect=>effect.effect_key!=="transform_card"&&cardManipulationEffects.includes(effect.effect_key))&&disposition!=="consume"){
    notify("Copiar o robar una carta requiere consumir la carta utilizada.");
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
      p_disposition:disposition,
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
    status.textContent="Guardado: "+result.effects_saved+" efecto(s) · "+(result.evolution_enabled?"evolución configurada · puede seguir en ruletas":"sin evolución nueva");
    notify(result.evolution_enabled
      ?"Evolución guardada. La carta conserva su configuración de ruleta."
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
function bindAdminMechanicsSaveButton(){
  const button=document.getElementById("adminSaveMechanics");
  if(!button)return false;
  if(button.dataset.mechanicsSaveBound==="true")return true;
  button.dataset.mechanicsSaveBound="true";
  button.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
    saveAdminMechanics();
  });
  return true;
}
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",bindAdminMechanicsSaveButton,{once:true});
}else{
  bindAdminMechanicsSaveButton();
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
    if(card.roulette_eligible===false){
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
  rouletteEligibleInput.checked=card?card.roulette_eligible!==false:true;
  rouletteEligibleInput.disabled=false;
  rouletteHelp.textContent="Las cartas con evolución también pueden aparecer en una ruleta. Activa esta opción para permitirlo.";
  document.getElementById("adminCardImageFile").value="";
  document.getElementById("adminCardImageHelp").textContent=adminEditingImagePath?"PNG actual. Puedes reemplazarlo.":"PNG · máximo 5 MB.";
  document.getElementById("adminCardFormStatus").textContent="Revisa los datos.";
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
    selectedSpecialPool=null;
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
    {slug:"legendary",countId:"legendaryAccessCount",buttonId:"legendarySpinButton",hintId:"legendaryAccessHint",ticket:"Legenleta"},
    {slug:"fiesta",countId:"fiestaAccessCount",buttonId:"fiestaSpinButton",hintId:"fiestaAccessHint",ticket:"Rumba"}
  ];
  definitions.forEach(item=>{
    const count=Math.max(0,Number(rouletteAccessByPool[item.slug]||0));
    const available=Boolean(currentAuthUser)&&count>0;
    const selected=selectedSpecialPool===item.slug;
    setText(item.countId,count);
    const accessButton=document.getElementById(item.buttonId);
    if(accessButton){
      accessButton.disabled=spinning||!available||selected;
      accessButton.classList.toggle("is-selected",selected);
      accessButton.textContent=selected?"SELECCIONADA ✓":available?"CANJEAR":"CANJEA "+item.ticket.toUpperCase();
      accessButton.setAttribute("aria-pressed",selected?"true":"false");
    }
    setText(item.hintId,!currentAuthUser
      ?"Inicia sesión para ver tus accesos."
      :selected
        ?"Esta ruleta ya está cargada arriba. Pulsa GIRAR RULETA cuando quieras."
        :available
          ?count+" "+(count===1?"giro disponible.":"giros disponibles.")+" Pulsa CANJEAR para cargarla sin girar."
          :"Canjea "+item.ticket+" para obtener 1 giro.");
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
  const wheelTitle=poolSlug==="legendary"?"Ruleta Legendaria":poolSlug==="fiesta"?"Ruleta Fiesta":"Ruleta de cartas";
  setText("wheelTitle",wheelTitle);
  nextCards.forEach(card=>{
    const image=new Image();
    image.src=card.image_path||("assets/"+card.slug+".svg");
    image.onload=()=>drawWheel();
    image.onerror=()=>drawWheel();
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
  notify("Ruleta mezclada. Probabilidades sin cambios.");
}
async function getPublicRouletteCards(poolSlug){
  if(!authClient||!currentAuthUser)return [];
  const {data,error}=await authClient.rpc("get_active_roulette_cards",{p_pool_slug:poolSlug});
  if(error)throw error;
  return (Array.isArray(data)?data:[]).map(mapRouletteCardRecord);
}

async function loadPublicNormalCards(forceNormal=false){
  if(!authClient||!currentAuthUser)return;
  if(selectedSpecialPool&&!forceNormal)return;
  try{
    const cards=await getPublicRouletteCards("normal");
    if(forceNormal)selectedSpecialPool=null;
    setWheelCards(cards,"normal");
    renderDeck();
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
    if(pokemonChannel&&authClient)authClient.removeChannel(pokemonChannel);
    inventoryChannel=null;profilesChannel=null;activityChannel=null;notificationChannel=null;pokemonChannel=null;
    if(typeLeagueChannel&&authClient)authClient.removeChannel(typeLeagueChannel);
    typeLeagueChannel=null;
    typeLeagueVisible=false;typeLeagueProfiles=[];typeLeagueMatches=[];
    const typeLeagueNav=document.getElementById("typeLeagueNavLink");
    if(typeLeagueNav)typeLeagueNav.hidden=true;

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
  const discordId=user.user_metadata?.provider_id||user.user_metadata?.sub||null;
  if(discordId){
    const {error:discordProfileError}=await authClient.from("profiles").update({discord_id:String(discordId)}).eq("id",user.id);
    if(discordProfileError)console.warn("No se pudo sincronizar el Discord ID del perfil:",discordProfileError.message);
  }
  cloudDeck=[];cloudRoute=[];cloudSpecial=[];cloudInventory=[];
  renderAuthState(user);renderDeck();
  await Promise.all([loadAdminAccess(),loadMyProfile(),loadCloudInventory(),loadPlayers(),loadActivityFeed(),loadNotifications(),loadPublicNormalCards(),loadRouletteAccess(),loadMyPokemonSnapshot()]);
  renderAdminAccess();
  await loadTypeLeagueVisibility();
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
    const start=rotation,target=start+TAU*7+delta;
    const duration=7200,startTime=performance.now();
    rouletteAudioLastTick=start;
    function animate(now){
      const progress=Math.min(1,(now-startTime)/duration);
      const eased=1-Math.pow(1-progress,5);
      const previousRotation=rotation;
      rotation=start+(target-start)*eased;
      drawWheel();
      updateRouletteAudio(previousRotation,rotation);
      if(progress<1){requestAnimationFrame(animate);return;}
      rotation=target%TAU;
      drawWheel();
      finishRouletteAudio();
      resolve();
    }
    requestAnimationFrame(animate);
  });
}
async function spin(){
  if(spinning)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión para girar.");return;}
  if(selectedSpecialPool){
    await spinSpecialRoulette(selectedSpecialPool);
    return;
  }
  if(activeNormalCards().length>=normalCardLimit&&bonusTramoSpinsRemaining<=0){notify("Tu baraja ya alcanzó el límite. Necesitas giros extra para superarlo.");return;}
  if(tramoSpinsRemaining+bonusTramoSpinsRemaining<=0){notify("Sin giros. Avanza de tramo para recibir "+normalSpinsPerTramo+" giros.");return;}
  spinning=true;renderDeck();
  startRouletteAudio();
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

function focusWheelForSpecialSpin(){
  const panel=document.querySelector("#page-roulette .wheel-panel");
  if(panel)panel.scrollIntoView({behavior:"smooth",block:"start"});
}

async function selectSpecialRoulette(poolSlug){
  if(spinning)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord para usar las ruletas especiales.");return;}
  if(!["legendary","fiesta"].includes(poolSlug)){notify("La ruleta especial seleccionada no es válida.");return;}
  if(Number(rouletteAccessByPool[poolSlug]||0)<=0){
    notify(poolSlug==="legendary"?"Canjea Legenleta para conseguir un giro Legendario.":"Canjea Rumba para conseguir un giro Fiesta.");
    return;
  }
  if(selectedSpecialPool===poolSlug){focusWheelForSpecialSpin();return;}
  const poolName=poolSlug==="legendary"?"Ruleta Legendaria":"Ruleta Fiesta";
  const button=document.getElementById(poolSlug==="legendary"?"legendarySpinButton":"fiestaSpinButton");
  if(button){button.disabled=true;button.textContent="CARGANDO...";}
  try{
    const prizeCards=await getPublicRouletteCards(poolSlug);
    if(!prizeCards.length)throw new Error(poolName+" cerrada o sin premios. Tu acceso se conserva.");
    selectedSpecialPool=poolSlug;
    setWheelCards(prizeCards,poolSlug,true);
    clearResult();
    updateSpecialRouletteAccessUI();
    renderDeck();
    focusWheelForSpecialSpin();
    notify(poolName+" cargada. Pulsa GIRAR RULETA cuando quieras.");
  }catch(error){
    console.error("No se pudo cargar la ruleta especial:",error);
    notify("No pudimos cargar "+poolName+": "+(error.message||"error desconocido"));
    updateSpecialRouletteAccessUI();
  }
}

async function spinSpecialRoulette(poolSlug){
  if(spinning)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord para usar las ruletas especiales.");return;}
  if(!["legendary","fiesta"].includes(poolSlug)||selectedSpecialPool!==poolSlug){
    notify("Primero canjea el acceso para cargar la ruleta especial.");
    return;
  }
  if(Number(rouletteAccessByPool[poolSlug]||0)<=0){
    notify("No tienes giros disponibles para esta ruleta.");
    selectedSpecialPool=null;
    await loadPublicNormalCards(true);
    renderDeck();
    return;
  }
  const poolName=poolSlug==="legendary"?"Ruleta Legendaria":"Ruleta Fiesta";
  spinning=true;
  updateSpecialRouletteAccessUI();
  renderDeck();
  startRouletteAudio();
  try{
    // The server consumes one unlock and selects the prize in the same protected transaction.
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
    notify("¡"+poolName+" en marcha!");
    await startWheelAnimation(card);
    await loadCloudInventory();
    await loadRouletteAccess();
    showResult(card);
    await showSpinReward(card);
    notify("¡Has obtenido "+card.name+" en la "+poolName+"!");
    selectedSpecialPool=null;
    await loadPublicNormalCards(true);
  }catch(error){
    console.error("No se pudo completar el giro especial:",error);
    notify("No pudimos girar "+poolName+": "+(error.message||"error desconocido"));
    await loadRouletteAccess();
    if(Number(rouletteAccessByPool[poolSlug]||0)<=0){
      selectedSpecialPool=null;
      await loadPublicNormalCards(true);
    }
  }finally{
    spinning=false;
    updateSpecialRouletteAccessUI();
    renderDeck();
  }
}

function renderTramoRoadmap(){
  const list=document.getElementById("tramoRoadmapList");
  if(!list)return;
  list.replaceChildren();
  const tramoActual=Math.min(TRAMO_MILESTONES.length,Math.max(0,Number(currentTramo)||0));
  TRAMO_MILESTONES.forEach(stage=>{
    const item=document.createElement("li");
    const completed=stage.tramo<tramoActual;
    const active=tramoActual>0&&stage.tramo===tramoActual;
    const next=stage.tramo===tramoActual+1;
    item.className="tramo-roadmap-item"+(completed?" is-complete":active?" is-active":next?" is-next":"");
    const number=document.createElement("span");
    number.className="tramo-roadmap-number";
    number.textContent=String(stage.tramo).padStart(2,"0");
    const copy=document.createElement("span");
    copy.className="tramo-roadmap-copy";
    const title=document.createElement("strong");
    title.textContent=stage.goal;
    const state=document.createElement("small");
    state.textContent=completed?"COMPLETADO":active?"EN CURSO":next?"SIGUIENTE":"PENDIENTE";
    copy.append(title,state);
    item.append(number,copy);
    list.append(item);
  });
}

function openTramoConfirmation(){
  if(spinning||tramoStartPending)return;
  if(!currentAuthUser||!authClient){
    notify("Inicia sesión para avanzar.");
    return;
  }
  const tramoActual=Math.min(TRAMO_MILESTONES.length,Math.max(0,Number(currentTramo)||0));
  const nextTramo=tramoActual+1;
  const stage=TRAMO_MILESTONES[tramoActual];
  if(!stage){
    notify("Has llegado al último tramo de la aventura.");
    return;
  }
  const totalSpins=Math.max(0,tramoSpinsRemaining)+Math.max(0,bonusTramoSpinsRemaining);
  const freeSlots=Math.max(0,normalCardLimit-activeNormalCards().length);
  if(totalSpins>0){
    notify("Utiliza los giros pendientes antes de avanzar de tramo.");
    return;
  }
  if(freeSlots<normalSpinsPerTramo){
    notify("Libera al menos "+normalSpinsPerTramo+" espacio(s) en tu baraja antes de avanzar.");
    return;
  }
  setText("tramoConfirmTitle","¿Seguro que quieres avanzar al Tramo "+nextTramo+"?");
  setText("tramoConfirmGoal",stage.goal);
  setText("tramoConfirmCards",cardsPerTramo+" CARTAS DE TRAMO");
  setText("tramoConfirmSpins",normalSpinsPerTramo+" GIROS NORMALES");
  const modal=document.getElementById("tramoConfirmModal");
  modal.hidden=false;
  document.getElementById("confirmTramoAdvance")?.focus();
}

function closeTramoConfirmation(){
  const modal=document.getElementById("tramoConfirmModal");
  if(modal)modal.hidden=true;
}

async function startNewTramo(){
  if(spinning||tramoStartPending)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión para avanzar.");return;}
  tramoStartPending=true;
  renderDeck();
  try{
    await loadCardEngineConfig();
    renderDeck();
    if(currentTramo>=TRAMO_MILESTONES.length){
      notify("Has llegado al último tramo de la aventura.");
      return;
    }
    if(tramoSpinsRemaining+bonusTramoSpinsRemaining>0){
      notify("Utiliza los giros pendientes antes de avanzar de tramo.");return;
    }
    const freeSlots=Math.max(0,normalCardLimit-activeNormalCards().length);
    if(freeSlots<normalSpinsPerTramo){
      notify("Libera al menos "+normalSpinsPerTramo+" espacio(s) en tu baraja antes de avanzar.");return;
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
    tramoStartPending=false;
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


function typeLeagueInitials(name){
  return String(name||"TL").trim().split(/\\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase()||"TL";
}
function typeLeagueProfileMap(){
  return new Map(typeLeagueProfiles.map(profile=>[profile.id,profile]));
}
function typeLeagueLocalDateTime(dateValue){
  const date=dateValue?new Date(dateValue):new Date();
  if(Number.isNaN(date.getTime()))return "";
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
function typeLeagueFormatDate(dateValue,withTime=false){
  if(!dateValue)return "—";
  const date=new Date(dateValue);
  if(Number.isNaN(date.getTime()))return "—";
  return new Intl.DateTimeFormat("es-CO",withTime
    ?{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}
    :{day:"2-digit",month:"short",year:"numeric"}).format(date);
}
async function loadTypeLeagueVisibility(){
  const nav=document.getElementById("typeLeagueNavLink");
  if(!authClient||!currentAuthUser){
    typeLeagueVisible=false;
    if(nav)nav.hidden=true;
    return false;
  }
  try{
    const {data,error}=await authClient.from("event_settings")
      .select("typeleague_visible").eq("singleton",true).single();
    if(error)throw error;
    typeLeagueVisible=Boolean(data?.typeleague_visible);
    if(nav)nav.hidden=!(typeLeagueVisible||isAdmin);
    return typeLeagueVisible;
  }catch(error){
    console.warn("No se pudo consultar la visibilidad de TypeLeague:",error.message);
    if(!isAdmin){typeLeagueVisible=false;if(nav)nav.hidden=true;}
    return typeLeagueVisible;
  }
}
function buildTypeLeagueStandings(profiles,matches){
  const stats=new Map();
  profiles.forEach(profile=>stats.set(profile.id,{
    id:profile.id,name:profile.display_name||"Entrenador",avatar_url:profile.avatar_url||null,
    PJ:0,PG:0,PE:0,PP:0,PKD:0,PTS:0
  }));
  matches.forEach(match=>{
    const a=stats.get(match.participant_a_id);
    const b=stats.get(match.participant_b_id);
    if(!a||!b)return;
    const aDefeated=Math.max(0,Number(match.participant_a_pokemon_defeated)||0);
    const bDefeated=Math.max(0,Number(match.participant_b_pokemon_defeated)||0);
    a.PJ+=1;b.PJ+=1;
    a.PKD+=aDefeated;b.PKD+=bDefeated;
    if(match.winner_id===a.id){
      a.PG+=1;
      if(bDefeated>3)b.PE+=1;else b.PP+=1;
    }else if(match.winner_id===b.id){
      b.PG+=1;
      if(aDefeated>3)a.PE+=1;else a.PP+=1;
    }
  });
  const rows=[...stats.values()];
  rows.forEach(row=>row.PTS=row.PG*3+row.PE);
  rows.sort((a,b)=>b.PTS-a.PTS||b.PKD-a.PKD||b.PG-a.PG||a.PP-b.PP||a.name.localeCompare(b.name,"es"));
  return rows;
}
function createTypeLeagueAvatar(profile){
  const wrap=document.createElement("span");wrap.className="typeleague-avatar";
  if(profile.avatar_url){
    try{
      const url=new URL(profile.avatar_url);
      if(url.protocol==="https:"){
        const image=document.createElement("img");
        image.src=url.href;image.alt="";image.loading="lazy";
        image.onerror=()=>{image.remove();wrap.textContent=typeLeagueInitials(profile.name||profile.display_name);};
        wrap.append(image);return wrap;
      }
    }catch(error){}
  }
  wrap.textContent=typeLeagueInitials(profile.name||profile.display_name);
  return wrap;
}
function renderTypeLeague(){
  const body=document.getElementById("typeLeagueStandingsBody");
  const history=document.getElementById("typeLeagueHistoryList");
  if(!body||!history)return;
  const profiles=typeLeagueProfiles;
  const matches=typeLeagueMatches;
  const rows=buildTypeLeagueStandings(profiles,matches);
  body.replaceChildren();
  if(!profiles.length){
    const tr=document.createElement("tr"),td=document.createElement("td");
    td.colSpan=8;td.className="typeleague-empty-cell";td.textContent="No hay participantes registrados.";
    tr.append(td);body.append(tr);
  }else{
    rows.forEach((row,index)=>{
      const tr=document.createElement("tr");
      if(index===0&&row.PTS>0)tr.classList.add("is-leader");
      const pos=document.createElement("td");pos.className="typeleague-position";pos.textContent=String(index+1)+"º";
      const trainer=document.createElement("td");trainer.className="typeleague-player-cell";
      trainer.append(createTypeLeagueAvatar(row));
      const name=document.createElement("strong");name.textContent=row.name;trainer.append(name);
      tr.append(pos,trainer);
      ["PJ","PG","PE","PP","PKD"].forEach(key=>{
        const td=document.createElement("td");td.className="typeleague-number";td.textContent=String(row[key]);tr.append(td);
      });
      const points=document.createElement("td");points.className="typeleague-points";points.textContent=String(row.PTS);tr.append(points);
      body.append(tr);
    });
  }
  const totalKOs=rows.reduce((sum,row)=>sum+row.PKD,0);
  setText("typeLeagueMatchCount",matches.length);
  setText("typeLeagueParticipantCount",profiles.length);
  setText("typeLeaguePokemonCount",totalKOs);
  setText("typeLeagueUpdatedAt",matches.length
    ?"ÚLTIMA PARTIDA · "+typeLeagueFormatDate(matches[0].played_at)
    :"SIN REGISTROS");

  history.replaceChildren();
  if(!matches.length){
    const empty=document.createElement("div");empty.className="typeleague-history-empty";
    empty.textContent="Todavía no hay enfrentamientos registrados.";
    history.append(empty);
  }else{
    const byId=typeLeagueProfileMap();
    matches.slice(0,12).forEach(match=>{
      const a=byId.get(match.participant_a_id),b=byId.get(match.participant_b_id),winner=byId.get(match.winner_id);
      const item=document.createElement("article");item.className="typeleague-history-item";
      const left=document.createElement("div");left.className="typeleague-history-match";
      const matchup=document.createElement("strong");
      matchup.textContent=(a?.display_name||"Entrenador")+ " vs. "+(b?.display_name||"Entrenador");
      const result=document.createElement("small");
      result.textContent="GANADOR · "+(winner?.display_name||"Participante");
      left.append(matchup,result);
      const meta=document.createElement("div");meta.className="typeleague-history-meta";
      const knocked=document.createElement("span");
      knocked.textContent="PKD "+Number(match.participant_a_pokemon_defeated||0)+" — "+Number(match.participant_b_pokemon_defeated||0);
      const date=document.createElement("time");date.textContent=typeLeagueFormatDate(match.played_at,true);
      meta.append(knocked,date);
      item.append(left,meta);
      if(match.notes){
        const note=document.createElement("p");note.className="typeleague-history-note";note.textContent=match.notes;item.append(note);
      }
      history.append(item);
    });
  }
}
async function loadTypeLeagueData(options={}){
  if(!authClient||!currentAuthUser)return;
  const publicPage=document.getElementById("page-typeleague");
  const body=document.getElementById("typeLeagueStandingsBody");
  if(body&&publicPage&&!publicPage.hidden&&!options.quiet){
    body.replaceChildren();
    const tr=document.createElement("tr"),td=document.createElement("td");
    td.colSpan=8;td.className="typeleague-empty-cell";td.textContent="Cargando clasificación...";
    tr.append(td);body.append(tr);
  }
  try{
    await loadTypeLeagueVisibility();
    if(!typeLeagueVisible&&!isAdmin){
      if(publicPage&&!publicPage.hidden)setPage("home");
      return;
    }
    const [profilesResult,matchesResult]=await Promise.all([
      authClient.from("profiles").select("id,display_name,avatar_url").order("display_name",{ascending:true}),
      authClient.from("typeleague_matches")
        .select("id,participant_a_id,participant_b_id,winner_id,participant_a_pokemon_defeated,participant_b_pokemon_defeated,played_at,notes,created_at")
        .order("played_at",{ascending:false}).order("created_at",{ascending:false})
    ]);
    if(profilesResult.error)throw profilesResult.error;
    if(matchesResult.error)throw matchesResult.error;
    typeLeagueProfiles=Array.isArray(profilesResult.data)?profilesResult.data:[];
    typeLeagueMatches=Array.isArray(matchesResult.data)?matchesResult.data:[];
    renderTypeLeague();
    if(isAdmin)renderAdminTypeLeagueMatches();
    setText("adminTypeLeagueTotalMatches",typeLeagueMatches.length);
    setText("adminTypeLeagueTotalPlayers",typeLeagueProfiles.length);
    setText("adminTypeLeagueState",typeLeagueVisible?"PUBLICADA":"PREPARACIÓN");
    setText("adminTypeLeagueVisibilityStatus",typeLeagueVisible?"VISIBLE PARA PARTICIPANTES":"OCULTA PARA PARTICIPANTES");
  }catch(error){
    console.error("No se pudo cargar TypeLeague:",error);
    if(body){
      body.replaceChildren();
      const tr=document.createElement("tr"),td=document.createElement("td");
      td.colSpan=8;td.className="typeleague-empty-cell is-error";
      td.textContent="No se pudo cargar la clasificación: "+(error.message||"error desconocido");
      tr.append(td);body.append(tr);
    }
    notify("No se pudo cargar TypeLeague: "+(error.message||"error desconocido"));
  }
}
function fillAdminTypeLeagueParticipants(){
  const a=document.getElementById("adminTypeLeagueParticipantA");
  const b=document.getElementById("adminTypeLeagueParticipantB");
  if(!a||!b)return;
  [a,b].forEach(select=>{
    const previous=select.value;
    select.replaceChildren();
    const placeholder=document.createElement("option");
    placeholder.value="";placeholder.textContent="Selecciona entrenador...";
    select.append(placeholder);
    typeLeagueProfiles.forEach(profile=>{
      const option=document.createElement("option");
      option.value=profile.id;option.textContent=profile.display_name||"Entrenador";
      select.append(option);
    });
    if(previous&&typeLeagueProfiles.some(profile=>profile.id===previous))select.value=previous;
  });
  if(!a.value&&typeLeagueProfiles[0])a.value=typeLeagueProfiles[0].id;
  if(!b.value&&typeLeagueProfiles[1])b.value=typeLeagueProfiles[1].id;
  if(a.value&&b.value===a.value){
    const other=typeLeagueProfiles.find(profile=>profile.id!==a.value);
    b.value=other?.id||"";
  }
  syncAdminTypeLeagueWinner();
}
function syncAdminTypeLeagueWinner(preferredValue){
  const winner=document.getElementById("adminTypeLeagueWinner");
  const a=document.getElementById("adminTypeLeagueParticipantA");
  const b=document.getElementById("adminTypeLeagueParticipantB");
  if(!winner||!a||!b)return;
  const current=preferredValue||winner.value;
  winner.replaceChildren();
  [[a.value,a.selectedOptions[0]?.textContent],[b.value,b.selectedOptions[0]?.textContent]].forEach((entry,index)=>{
    if(!entry[0])return;
    const option=document.createElement("option");
    option.value=entry[0];option.textContent="Ganador: "+(entry[1]||("Participante "+(index+1)));
    winner.append(option);
  });
  if([...winner.options].some(option=>option.value===current))winner.value=current;
  else if(winner.options.length)winner.selectedIndex=0;
}
function resetAdminTypeLeagueForm(){
  const form=document.getElementById("adminTypeLeagueForm");
  if(!form)return;
  form.reset();
  document.getElementById("adminTypeLeagueMatchId").value="";
  document.getElementById("adminTypeLeaguePlayedAt").value=typeLeagueLocalDateTime();
  document.getElementById("adminTypeLeaguePokemonA").value="0";
  document.getElementById("adminTypeLeaguePokemonB").value="0";
  setText("adminTypeLeagueFormTitle","Registrar enfrentamiento");
  setText("adminTypeLeagueSave","REGISTRAR PARTIDA ↗");
  setText("adminTypeLeagueFormStatus","Cada enfrentamiento cuenta como una partida jugada para ambos.");
  fillAdminTypeLeagueParticipants();
}
function renderAdminTypeLeagueMatches(){
  const list=document.getElementById("adminTypeLeagueMatchesList");
  if(!list)return;
  const map=typeLeagueProfileMap();
  list.replaceChildren();
  setText("adminTypeLeagueHistoryCount",typeLeagueMatches.length+" PARTIDAS");
  if(!typeLeagueMatches.length){
    const empty=document.createElement("div");empty.className="typeleague-history-empty";
    empty.textContent="Todavía no hay resultados registrados.";
    list.append(empty);return;
  }
  typeLeagueMatches.forEach(match=>{
    const a=map.get(match.participant_a_id),b=map.get(match.participant_b_id),winner=map.get(match.winner_id);
    const card=document.createElement("article");card.className="admin-typeleague-match";
    const copy=document.createElement("div");copy.className="admin-typeleague-match-copy";
    const title=document.createElement("strong");
    title.textContent=(a?.display_name||"Entrenador")+" vs. "+(b?.display_name||"Entrenador");
    const result=document.createElement("small");
    result.textContent="GANADOR · "+(winner?.display_name||"—")+" · PKD "+Number(match.participant_a_pokemon_defeated||0)+"–"+Number(match.participant_b_pokemon_defeated||0);
    const date=document.createElement("span");date.textContent=typeLeagueFormatDate(match.played_at,true);
    copy.append(title,result,date);
    const actions=document.createElement("div");actions.className="admin-typeleague-match-actions";
    const edit=document.createElement("button");edit.type="button";edit.className="admin-typeleague-edit";edit.textContent="EDITAR";
    edit.addEventListener("click",()=>editAdminTypeLeagueMatch(match));
    const remove=document.createElement("button");remove.type="button";remove.className="admin-typeleague-delete";remove.textContent="BORRAR";
    remove.addEventListener("click",()=>deleteAdminTypeLeagueMatch(match));
    actions.append(edit,remove);
    card.append(copy,actions);list.append(card);
  });
}
function editAdminTypeLeagueMatch(match){
  const form=document.getElementById("adminTypeLeagueForm");
  document.getElementById("adminTypeLeagueMatchId").value=match.id;
  document.getElementById("adminTypeLeagueParticipantA").value=match.participant_a_id;
  document.getElementById("adminTypeLeagueParticipantB").value=match.participant_b_id;
  document.getElementById("adminTypeLeaguePokemonA").value=String(match.participant_a_pokemon_defeated||0);
  document.getElementById("adminTypeLeaguePokemonB").value=String(match.participant_b_pokemon_defeated||0);
  syncAdminTypeLeagueWinner(match.winner_id);
  document.getElementById("adminTypeLeaguePlayedAt").value=typeLeagueLocalDateTime(match.played_at);
  document.getElementById("adminTypeLeagueNotes").value=match.notes||"";
  setText("adminTypeLeagueFormTitle","Editar enfrentamiento");
  setText("adminTypeLeagueSave","GUARDAR CAMBIOS ↗");
  setText("adminTypeLeagueFormStatus","Estás editando una partida existente. Las estadísticas se recalcularán.");
  form.scrollIntoView({behavior:"smooth",block:"start"});
}
async function deleteAdminTypeLeagueMatch(match){
  if(!isAdmin||!authClient)return;
  const map=typeLeagueProfileMap();
  const a=map.get(match.participant_a_id),b=map.get(match.participant_b_id);
  if(!window.confirm("¿Eliminar la partida "+(a?.display_name||"Participante")+" vs. "+(b?.display_name||"Participante")+"? La clasificación se recalculará sin este resultado."))return;
  try{
    const {data,error}=await authClient.rpc("admin_delete_typeleague_match",{p_match_id:match.id});
    if(error)throw error;
    if(!data?.success)throw new Error("El servidor no confirmó la eliminación.");
    await loadTypeLeagueData({quiet:true});
    notify("Partida eliminada. Clasificación actualizada.");
  }catch(error){
    console.error("No se pudo eliminar la partida de TypeLeague:",error);
    notify("No se pudo eliminar la partida: "+(error.message||"error desconocido"));
  }
}
async function saveAdminTypeLeagueMatch(event){
  event.preventDefault();
  if(!isAdmin||!authClient){notify("Acceso reservado al administrador.");return;}
  const id=document.getElementById("adminTypeLeagueMatchId").value||null;
  const participantA=document.getElementById("adminTypeLeagueParticipantA").value;
  const participantB=document.getElementById("adminTypeLeagueParticipantB").value;
  const winner=document.getElementById("adminTypeLeagueWinner").value;
  const defeatedA=Number(document.getElementById("adminTypeLeaguePokemonA").value);
  const defeatedB=Number(document.getElementById("adminTypeLeaguePokemonB").value);
  const playedAt=document.getElementById("adminTypeLeaguePlayedAt").value;
  const notes=(document.getElementById("adminTypeLeagueNotes").value||"").trim();
  const status=document.getElementById("adminTypeLeagueFormStatus");
  const button=document.getElementById("adminTypeLeagueSave");
  if(!participantA||!participantB||participantA===participantB){status.textContent="Selecciona dos participantes diferentes.";return;}
  if(!winner||![participantA,participantB].includes(winner)){status.textContent="Selecciona como ganador a uno de los participantes.";return;}
  if(!Number.isInteger(defeatedA)||defeatedA<0||defeatedA>6||!Number.isInteger(defeatedB)||defeatedB<0||defeatedB>6){
    status.textContent="Los Pokémon derrotados deben estar entre 0 y 6.";return;
  }
  if(!playedAt||Number.isNaN(new Date(playedAt).getTime())){status.textContent="Indica una fecha y hora válidas.";return;}
  button.disabled=true;button.textContent="GUARDANDO...";
  status.textContent="Guardando resultado y recalculando la clasificación...";
  try{
    const {data,error}=await authClient.rpc("admin_save_typeleague_match",{
      p_match_id:id,
      p_participant_a_id:participantA,
      p_participant_b_id:participantB,
      p_winner_id:winner,
      p_participant_a_pokemon_defeated:defeatedA,
      p_participant_b_pokemon_defeated:defeatedB,
      p_played_at:new Date(playedAt).toISOString(),
      p_notes:notes
    });
    if(error)throw error;
    if(!data?.success)throw new Error("El servidor no confirmó el registro.");
    resetAdminTypeLeagueForm();
    await loadTypeLeagueData({quiet:true});
    notify(id?"Partida actualizada correctamente.":"Partida registrada correctamente.");
  }catch(error){
    console.error("No se pudo guardar la partida de TypeLeague:",error);
    status.textContent=error.message||"No se pudo guardar el resultado.";
    notify("No se pudo guardar el resultado: "+(error.message||"error desconocido"));
  }finally{
    button.disabled=false;
    if(document.getElementById("adminTypeLeagueMatchId").value){
      button.textContent="GUARDAR CAMBIOS ↗";
    }else{
      button.textContent="REGISTRAR PARTIDA ↗";
    }
  }
}
async function setAdminTypeLeagueVisibility(visible){
  if(!isAdmin||!authClient)return;
  const input=document.getElementById("adminTypeLeagueVisible");
  const status=document.getElementById("adminTypeLeagueVisibilityStatus");
  input.disabled=true;
  status.textContent="ACTUALIZANDO...";
  try{
    const {data,error}=await authClient.rpc("admin_set_typeleague_visibility",{p_visible:Boolean(visible)});
    if(error)throw error;
    if(!data?.success)throw new Error("El servidor no confirmó el cambio de visibilidad.");
    typeLeagueVisible=Boolean(data.visible);
    if(document.getElementById("typeLeagueNavLink"))document.getElementById("typeLeagueNavLink").hidden=!(typeLeagueVisible||isAdmin);
    status.textContent=typeLeagueVisible?"VISIBLE PARA PARTICIPANTES":"OCULTA PARA PARTICIPANTES";
    setText("adminTypeLeagueState",typeLeagueVisible?"PUBLICADA":"PREPARACIÓN");
    if(typeLeagueVisible)notify("TypeLeague ya está visible para los participantes.");
    else notify("TypeLeague se ha ocultado para los participantes. Los resultados se conservan.");
  }catch(error){
    input.checked=typeLeagueVisible;
    status.textContent=typeLeagueVisible?"VISIBLE PARA PARTICIPANTES":"OCULTA PARA PARTICIPANTES";
    console.error("No se pudo cambiar la visibilidad de TypeLeague:",error);
    notify("No se pudo cambiar la visibilidad: "+(error.message||"error desconocido"));
  }finally{
    input.disabled=false;
  }
}
async function openAdminTypeLeague(){
  if(!isAdmin){notify("Acceso reservado al administrador.");return;}
  showAdminOverview();
  document.getElementById("adminOverview").hidden=true;
  document.getElementById("adminTypeLeagueWorkspace").hidden=false;
  await loadTypeLeagueData({quiet:true});
  document.getElementById("adminTypeLeagueVisible").checked=typeLeagueVisible;
  fillAdminTypeLeagueParticipants();
  resetAdminTypeLeagueForm();
  window.scrollTo({top:0,behavior:"smooth"});
}

function setPage(page){
  if(page==="typeleague"&&(!currentAuthUser||(!typeLeagueVisible&&!isAdmin))){
    notify("TypeLeague todavía no está disponible para los participantes.");
    page="home";
  }
  if(page==="admin"&&(!currentAuthUser||!isAdmin)){
    notify("Solo disponible para administradores autorizados.");
    page="home";
  }
  document.querySelectorAll(".page-view").forEach(view=>{view.hidden=view.id!=="page-"+page;});
  document.querySelectorAll("[data-page]").forEach(button=>{
    if(button.classList.contains("nav-link"))button.classList.toggle("active",button.dataset.page===page);
  });
  const labels={home:"INICIO",roulette:"RULETA",typeleague:"TYPELEAGUE",players:"JUGADORES",activity:"MURO DE CARTAS",profile:"MI PERFIL",deck:"MI BARAJA",pokemon:"MI EQUIPO POKÉMON",notifications:"NOTIFICACIONES",admin:"ADMINISTRACIÓN"};
  setText("currentSection",labels[page]||"INICIO");
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileScrim").classList.remove("show");
  if(page==="roulette")drawWheel();
  if(page==="players")loadPlayers();
  if(page==="activity")loadActivityFeed();
  if(page==="notifications")loadNotifications();
  if(page==="deck"&&cloudMode)loadCloudInventory();
  if(page==="profile"&&currentAuthUser)loadMyProfile();
  if(page==="pokemon"&&currentAuthUser)loadMyPokemonSnapshot();
  if(page==="typeleague"&&currentAuthUser)void loadTypeLeagueData();
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


document.getElementById("openAdminTypeLeague").addEventListener("click",openAdminTypeLeague);
document.getElementById("adminTypeLeagueBack").addEventListener("click",showAdminOverview);
document.getElementById("adminTypeLeagueRefresh").addEventListener("click",()=>loadTypeLeagueData());
document.getElementById("adminTypeLeagueVisible").addEventListener("change",event=>setAdminTypeLeagueVisibility(event.target.checked));
document.getElementById("adminTypeLeagueForm").addEventListener("submit",saveAdminTypeLeagueMatch);
document.getElementById("adminTypeLeagueReset").addEventListener("click",resetAdminTypeLeagueForm);
document.getElementById("adminTypeLeagueParticipantA").addEventListener("change",()=>syncAdminTypeLeagueWinner());
document.getElementById("adminTypeLeagueParticipantB").addEventListener("change",()=>syncAdminTypeLeagueWinner());

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
document.getElementById("adminClearTrainerSyncButton").addEventListener("click",clearAdminTrainerSync);
document.getElementById("adminDeleteTrainerButton").addEventListener("click",deleteAdminTrainer);
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
async function pngHasTransparentPixels(file){
  if(typeof createImageBitmap!=="function")return null;
  let bitmap=null;
  try{
    bitmap=await createImageBitmap(file);
    const canvas=document.createElement("canvas");
    canvas.width=bitmap.width;
    canvas.height=bitmap.height;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if(!context)return null;
    context.drawImage(bitmap,0,0);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    for(let index=3;index<pixels.length;index+=4){
      if(pixels[index]===0)return true;
    }
    return false;
  }catch(error){
    console.warn("No se pudo comprobar el canal alfa del PNG:",error);
    return null;
  }finally{
    if(bitmap&&typeof bitmap.close==="function")bitmap.close();
  }
}

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
    const imageHelp=document.getElementById("adminCardImageHelp");
    const imageSize=(file.size/1024/1024).toFixed(2)+" MB";
    imageHelp.textContent=file.name+" · "+imageSize+" · Comprobando transparencia...";
    pngHasTransparentPixels(file).then(hasTransparency=>{
      if(adminPendingImageFile!==file)return;
      if(hasTransparency===false){
        imageHelp.textContent=file.name+" · "+imageSize+" · AVISO: no hay píxeles transparentes. El fondo se verá en la web; exporta el PNG con fondo transparente.";
        notify("Este PNG no tiene transparencia real. La web no puede quitar el fondo blanco automáticamente.");
      }else if(hasTransparency===true){
        imageHelp.textContent=file.name+" · "+imageSize+" · Transparencia detectada · Pendiente de subir al guardar.";
      }else{
        imageHelp.textContent=file.name+" · "+imageSize+" · No se pudo verificar el canal alfa; comprueba el fondo antes de guardar.";
      }
    });
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
document.getElementById("legendarySpinButton").addEventListener("click",()=>selectSpecialRoulette("legendary"));
document.getElementById("fiestaSpinButton").addEventListener("click",()=>selectSpecialRoulette("fiesta"));
document.getElementById("tramoButton").addEventListener("click",openTramoConfirmation);
document.getElementById("tramoButtonFull").addEventListener("click",openTramoConfirmation);
document.getElementById("closeTramoConfirm").addEventListener("click",closeTramoConfirmation);
document.getElementById("cancelTramoConfirm").addEventListener("click",closeTramoConfirmation);
document.getElementById("confirmTramoAdvance").addEventListener("click",()=>{
  closeTramoConfirmation();
  startNewTramo();
});
document.getElementById("tramoConfirmModal").addEventListener("click",event=>{
  if(event.target.id==="tramoConfirmModal")closeTramoConfirmation();
});
document.getElementById("saveProfileButton").addEventListener("click",saveProfile);
bindPokemonSyncUI();
document.getElementById("closePublicProfile").addEventListener("click",closePublicPlayer);
document.getElementById("closeCardAction").addEventListener("click",closeCardAction);
document.getElementById("cancelCardAction").addEventListener("click",closeCardAction);
document.getElementById("confirmCardAction").addEventListener("click",confirmCardAction);
document.getElementById("cardActionModal").addEventListener("click",event=>{if(event.target.id==="cardActionModal")closeCardAction();});
document.getElementById("publicProfileModal").addEventListener("click",event=>{if(event.target.id==="publicProfileModal")closePublicPlayer();});
document.addEventListener("click",event=>{
  const card=event.target.closest?.("#deckListFull .my-deck-card-clickable, #routeListFull .my-deck-card-clickable, #specialListFull .my-deck-card-clickable");
  if(!card||event.target.closest(".deck-actions,button"))return;
  event.preventDefault();
  event.stopPropagation();
  openActivityCardPreview(
    card.dataset.cardPreviewImage,
    card.dataset.cardPreviewName,
    card.dataset.cardPreviewRarity,
    card,
    card.dataset.cardPreviewDescription||"Sin descripción disponible."
  );
});
document.addEventListener("keydown",event=>{
  if(event.key!=="Enter"&&event.key!==" ")return;
  const card=event.target.closest?.("#deckListFull .my-deck-card-clickable, #routeListFull .my-deck-card-clickable, #specialListFull .my-deck-card-clickable");
  if(!card||event.target.closest(".deck-actions,button"))return;
  event.preventDefault();
  openActivityCardPreview(
    card.dataset.cardPreviewImage,
    card.dataset.cardPreviewName,
    card.dataset.cardPreviewRarity,
    card,
    card.dataset.cardPreviewDescription||"Sin descripción disponible."
  );
});
document.getElementById("publicPlayerCards").addEventListener("click",event=>{
  const card=event.target.closest?.(".public-profile-card-clickable");
  if(!card)return;
  event.preventDefault();
  event.stopPropagation();
  openActivityCardPreview(
    card.dataset.cardPreviewImage,
    card.dataset.cardPreviewName,
    card.dataset.cardPreviewRarity,
    card,
    card.dataset.cardPreviewDescription||"Sin descripción disponible."
  );
});
document.addEventListener("click",event=>{
  const card=event.target.closest?.("#publicPlayerCards .public-profile-card-clickable");
  if(!card)return;
  event.preventDefault();
  openActivityCardPreview(
    card.dataset.cardPreviewImage,
    card.dataset.cardPreviewName,
    card.dataset.cardPreviewRarity,
    card,
    card.dataset.cardPreviewDescription||"Sin descripción disponible."
  );
});
document.getElementById("publicPlayerCards").addEventListener("keydown",event=>{
  if(event.key!=="Enter"&&event.key!==" ")return;
  const card=event.target.closest?.(".public-profile-card-clickable");
  if(!card)return;
  event.preventDefault();
  openActivityCardPreview(
    card.dataset.cardPreviewImage,
    card.dataset.cardPreviewName,
    card.dataset.cardPreviewRarity,
    card,
    card.dataset.cardPreviewDescription||"Sin descripción disponible."
  );
});
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
  if(event.key!=="Escape")return;
  if(!document.getElementById("tramoConfirmModal").hidden){
    closeTramoConfirmation();
  }else if(!document.getElementById("activityCardModal").hidden){
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
