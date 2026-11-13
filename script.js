/* Pokémon TypeLink 2 — persistent player identity and inventory */
const CARDS = [
  {id:"katateka",slug:"katateka",name:"Katateka",rarity:"Común",color:"#8d9a9f",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/katateka.svg",image_path:"assets/katateka.svg"},
  {id:"cambio-tipo",slug:"cambio-tipo",name:"Cambio de Tipo",rarity:"Común",color:"#6b9b83",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/cambio-tipo.svg",image_path:"assets/cambio-tipo.svg"},
  {id:"proteccion",slug:"proteccion",name:"Protección",rarity:"Rara",color:"#6f8dbb",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/proteccion.svg",image_path:"assets/proteccion.svg"},
  {id:"intercambio",slug:"intercambio",name:"Intercambio",rarity:"Rara",color:"#9a79b7",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/intercambio.svg",image_path:"assets/intercambio.svg"},
  {id:"impacto",slug:"impacto",name:"Impacto Épico",rarity:"Épica",color:"#bd7a4e",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/impacto.svg",image_path:"assets/impacto.svg"},
  {id:"destino",slug:"destino",name:"Destino Legendario",rarity:"Legendaria",color:"#d4ae5b",description:"Carta provisional de demostración de TypeLink 2.",art:"assets/destino.svg",image_path:"assets/destino.svg"}
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
let cloudMode = false;
let cloudDeck = [];
let cloudRoute = [];
let demoDeck = loadDeck();
let demoRouteState = loadRouteState();
let rotation = 0;
let spinning = false;
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
    const safeUrl=String(url).replace(/["\\\\]/g,"");
    element.style.backgroundImage='url("'+safeUrl+'")';
    element.style.backgroundSize="cover";
    element.style.backgroundPosition="center";
    element.textContent="";
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

function createDeckItem(card,index,route=false){
  const row=document.createElement("div");row.className="deck-item";
  const img=document.createElement("img");img.className="deck-thumb";img.src=cardImage(card);img.alt=card.name||"Carta";
  const info=document.createElement("div");info.className="deck-info";
  const name=document.createElement("strong");name.textContent=card.name||"Carta TypeLink";
  const small=document.createElement("small");
  small.textContent=route?("Tramo "+(card.tramo_number||"?")):(card.rarity||"Carta normal");
  info.append(name,small);
  const number=document.createElement("span");number.className="deck-index";number.textContent=String(index+1).padStart(2,"0");
  row.append(img,info,number);
  return row;
}
function renderCardItems(cards,container,emptyText){
  if(!container)return;
  container.replaceChildren();
  if(!cards.length){
    const empty=document.createElement("div");empty.className="deck-empty";empty.textContent=emptyText||"Todavía no tienes cartas.";container.append(empty);return;
  }
  cards.forEach((card,index)=>container.append(createDeckItem(card,index,false)));
}
function renderRouteItems(cards,container){
  if(!container)return;
  container.replaceChildren();
  if(!cards.length){
    const empty=document.createElement("div");empty.className="deck-empty";empty.textContent="Todavía no has iniciado un tramo.";container.append(empty);return;
  }
  cards.forEach((card,index)=>container.append(createDeckItem(card,index,true)));
}
function renderDeck(){
  const normal=activeNormalCards(),route=activeTramoCards(),normalCount=normal.length;
  renderCardItems(normal,document.getElementById("deckList"),"Todavía no tienes cartas. ¡Haz tu primer giro!");
  renderCardItems(normal,document.getElementById("deckListFull"),"Todavía no tienes cartas. Ve a la ruleta para conseguir la primera.");
  renderRouteItems(route,document.getElementById("routeListFull"));

  setText("deckCount",normalCount+"/5");
  setText("deckCountFull",normalCount+" / 5");
  setText("routeCountFull",route.length);
  setText("navDeckCount",normalCount+"/5");
  setText("homeDeckCount",normalCount+"/5");
  setText("homeRouteCount",route.length);

  const width=(Math.min(normalCount,5)/5*100)+"%";
  const fillIds=["capacityFill","capacityFillFull","homeCapacityFill"];
  fillIds.forEach(id=>{const el=document.getElementById(id);if(el)el.style.width=width;});
  setText("homeDeckHint",normalCount?("Tienes "+normalCount+" de 5 cartas normales."):"Tu baraja todavía está vacía. Haz tu primer giro.");
  setText("profileNormalCount",normalCount+"/5");
  setText("profileRouteCount",route.length);

  const resetButton=document.getElementById("resetButton");
  if(resetButton)resetButton.hidden=cloudMode;

  spinButton.disabled=spinning||!currentAuthUser||normalCount>=5;
  spinButton.querySelector("span").textContent=
    !currentAuthUser?"INICIA SESIÓN":normalCount>=5?"BARAJA COMPLETA":spinning?"CONECTANDO...":"GIRAR RULETA";
  setText("spinHint",!currentAuthUser
    ?"Inicia sesión con Discord para obtener cartas."
    :normalCount>=5?"Has alcanzado el límite de 5 cartas normales."
    :"La carta ganadora se guardará en tu cuenta.");

  const routeButtons=["tramoButton","tramoButtonFull"];
  routeButtons.forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=spinning||!currentAuthUser;});
  setText("deckCloudNote",cloudMode
    ?"Tu baraja está conectada a Supabase y disponible al iniciar sesión desde otro dispositivo."
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
  return {
    instance_id:row.id,
    slug:joined.slug,
    name:joined.name,
    rarity:joined.rarity==="common"?"Común":joined.rarity==="rare"?"Rara":joined.rarity==="epic"?"Épica":joined.rarity==="legendary"?"Legendaria":"Tramo",
    category:joined.category,
    description:joined.description,
    image_path:joined.image_path,
    source:row.source,
    tramo_number:row.tramo_number,
    status:row.status,
    obtained_at:row.obtained_at
  };
}

async function loadMyProfile(){
  if(!authClient||!currentAuthUser)return;
  const {data,error}=await authClient.from("profiles")
    .select("id,display_name,avatar_url,created_at")
    .eq("id",currentAuthUser.id).single();
  if(error){
    console.error("No se pudo cargar el perfil TypeLink:",error.message);
    notify("Tu sesión funciona, pero no pudimos cargar el perfil.");
    return;
  }
  renderProfile(data);
}

async function loadCloudInventory(){
  if(!authClient||!currentAuthUser)return;
  const {data,error}=await authClient.from("player_cards")
    .select("id,source,tramo_number,status,obtained_at,card_catalog(id,slug,name,category,rarity,description,image_path)")
    .eq("owner_id",currentAuthUser.id)
    .order("obtained_at",{ascending:true});
  if(error){
    console.error("No se pudo cargar la baraja:",error.message);
    notify("No pudimos cargar tu baraja. Inténtalo de nuevo.");
    return;
  }
  const items=(data||[]).map(mapInventoryRow).filter(Boolean);
  cloudDeck=items.filter(item=>item.category==="normal");
  cloudRoute=items.filter(item=>item.category==="tramo");
  renderDeck();
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
    .select("id,source,tramo_number,obtained_at,card_catalog(name,category,rarity,image_path)")
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
  inventoryChannel=authClient.channel("typelink-player-cards-"+currentAuthUser.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"player_cards",filter:"owner_id=eq."+currentAuthUser.id},()=>loadCloudInventory())
    .subscribe();
  profilesChannel=authClient.channel("typelink-public-profiles")
    .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>loadPlayers())
    .subscribe();
}

async function activateUserSession(user){
  if(!user){
    if(inventoryChannel&&authClient)authClient.removeChannel(inventoryChannel);
    if(profilesChannel&&authClient)authClient.removeChannel(profilesChannel);
    inventoryChannel=null;profilesChannel=null;
    activeSessionUserId=null;currentProfile=null;cloudMode=false;cloudDeck=[];cloudRoute=[];
    demoDeck=loadDeck();demoRouteState=loadRouteState();
    renderAuthState(null);renderDeck();loadPlayers();return;
  }
  if(activeSessionUserId===user.id&&cloudMode)return;
  activeSessionUserId=user.id;currentAuthUser=user;cloudMode=true;
  cloudDeck=[];cloudRoute=[];
  renderAuthState(user);renderDeck();
  await Promise.all([loadMyProfile(),loadCloudInventory(),loadPlayers()]);
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
  if(activeNormalCards().length>=5){notify("Tu baraja ya tiene cinco cartas normales.");return;}
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

async function addTramo(){
  if(spinning)return;
  if(!currentAuthUser||!authClient){notify("Inicia sesión con Discord para recibir cartas de tramo.");return;}
  spinning=true;renderDeck();
  try{
    const {data,error}=await authClient.rpc("issue_tramo_cards");
    if(error)throw error;
    await loadCloudInventory();
    const count=Array.isArray(data?.cards)?data.cards.length:2;
    const tramo=data?.tramo_number||"";
    notify("¡Tramo "+tramo+": has recibido "+count+" cartas acumulables!");
  }catch(error){
    console.error("No se pudieron entregar las cartas de tramo:",error);
    notify("No se pudo iniciar el tramo: "+(error.message||"error desconocido"));
  }finally{
    spinning=false;renderDeck();
  }
}

function setPage(page){
  document.querySelectorAll(".page-view").forEach(view=>{view.hidden=view.id!=="page-"+page;});
  document.querySelectorAll("[data-page]").forEach(button=>{
    if(button.classList.contains("nav-link"))button.classList.toggle("active",button.dataset.page===page);
  });
  const labels={home:"INICIO",roulette:"RULETA",players:"JUGADORES",profile:"MI PERFIL",deck:"MI BARAJA",pokemon:"MI EQUIPO POKÉMON",notifications:"NOTIFICACIONES",admin:"ADMINISTRACIÓN"};
  setText("currentSection",labels[page]||"INICIO");
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileScrim").classList.remove("show");
  if(page==="roulette")drawWheel();
  if(page==="players")loadPlayers();
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
document.getElementById("tramoButton").addEventListener("click",addTramo);
document.getElementById("tramoButtonFull").addEventListener("click",addTramo);
document.getElementById("saveProfileButton").addEventListener("click",saveProfile);
document.getElementById("closePublicProfile").addEventListener("click",closePublicPlayer);
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
