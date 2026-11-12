const CARDS = [
  {id:"katateka",name:"Katateka",rarity:"Común",color:"#8d9a9f",description:"Carta de prueba de TypeLink 2.",art:"assets/katateka.svg"},
  {id:"cambio-tipo",name:"Cambio de Tipo",rarity:"Común",color:"#6b9b83",description:"Carta de prueba de TypeLink 2.",art:"assets/cambio-tipo.svg"},
  {id:"proteccion",name:"Protección",rarity:"Rara",color:"#6f8dbb",description:"Carta de prueba de TypeLink 2.",art:"assets/proteccion.svg"},
  {id:"intercambio",name:"Intercambio",rarity:"Rara",color:"#9a79b7",description:"Carta de prueba de TypeLink 2.",art:"assets/intercambio.svg"},
  {id:"impacto",name:"Impacto Épico",rarity:"Épica",color:"#bd7a4e",description:"Carta de prueba de TypeLink 2.",art:"assets/impacto.svg"},
  {id:"destino",name:"Destino Legendario",rarity:"Legendaria",color:"#d4ae5b",description:"Carta de prueba de TypeLink 2.",art:"assets/destino.svg"}
];
const STORAGE_KEY = "typelink2-beta01-deck";
const ROUTE_STORAGE_KEY = "typelink2-beta01-route";
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinButton = document.getElementById("spinButton");
const deckList = document.getElementById("deckList");
const toast = document.getElementById("toast");
let deck = loadDeck();
let rotation = 0;
let spinning = false;
let lastCard = null;
let routeState = loadRouteState();
const TAU = Math.PI * 2;

function loadDeck(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(id => CARDS.some(card => card.id === id)) : [];
  }catch{return []}
}
function saveDeck(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(deck)); }
function loadRouteState(){
  try{
    const saved = JSON.parse(localStorage.getItem(ROUTE_STORAGE_KEY) || '{"tramo":0,"cards":[]}');
    if(!saved || !Array.isArray(saved.cards)) return {tramo:0,cards:[]};
    return {tramo:Number(saved.tramo)||0,cards:saved.cards};
  }catch{return {tramo:0,cards:[]}}
}
function saveRouteState(){ localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(routeState)); }
function drawWheel(){
  const size = canvas.width, center = size/2, radius = size/2-10;
  const slice = TAU/CARDS.length;
  ctx.clearRect(0,0,size,size);
  CARDS.forEach((card,i)=>{
    const start = rotation - Math.PI/2 + i*slice;
    const end = start+slice;
    ctx.beginPath();ctx.moveTo(center,center);ctx.arc(center,center,radius,start,end);ctx.closePath();
    ctx.fillStyle = i%2===0 ? "#252b36" : "#191f29";ctx.fill();
    ctx.strokeStyle = "#b28b4d";ctx.lineWidth=3;ctx.stroke();
    const mid=start+slice/2;
    ctx.save();ctx.translate(center+Math.cos(mid)*radius*.67,center+Math.sin(mid)*radius*.67);ctx.rotate(mid+Math.PI/2);
    ctx.fillStyle=card.color;ctx.font="bold 19px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(card.name.length>17?card.name.slice(0,16)+"…":card.name,0,0);
    ctx.restore();
  });
  ctx.beginPath();ctx.arc(center,center,42,0,TAU);ctx.fillStyle="#101319";ctx.fill();ctx.strokeStyle="#dfbd73";ctx.lineWidth=5;ctx.stroke();
}
function renderDeck(){
  document.getElementById("deckCount").textContent = deck.length+"/5";
  document.getElementById("capacityFill").style.width = (deck.length/5*100)+"%";
  if(!deck.length){
    deckList.innerHTML='<div class="deck-empty">Todavía no tienes cartas.<br><span>¡Haz tu primer giro!</span></div>';
  }else{
    deckList.innerHTML=deck.map((id,index)=>{
      const card=CARDS.find(item=>item.id===id);
      return '<div class="deck-item"><img class="deck-thumb" src="'+card.art+'" alt=""><div class="deck-info"><strong>'+card.name+'</strong><small>'+card.rarity+'</small></div><span class="deck-index">'+String(index+1).padStart(2,"0")+'</span></div>';
    }).join("");
  }
  document.getElementById("routeCount").textContent = routeState.cards.length;
  const routeList=document.getElementById("routeList");
  routeList.innerHTML=routeState.cards.length ? routeState.cards.map(card=>
    '<div class="route-item"><img src="'+card.art+'" alt=""><div><strong>'+card.name+'</strong><small>Obtenida con /tramo</small></div></div>'
  ).join("") : '<div class="route-empty">Todavía no has iniciado un tramo.</div>';
  spinButton.disabled = spinning || deck.length>=5;
  spinButton.querySelector("span").textContent = deck.length>=5 ? "BARAJA COMPLETA" : (spinning ? "GIRANDO..." : "GIRAR RULETA");
  document.getElementById("spinHint").textContent = deck.length>=5 ? "Has alcanzado el límite de 5 cartas normales." : "Cada giro entrega una carta normal aleatoria.";
}
function addTramo(){
  routeState.tramo += 1;
  const n=routeState.tramo;
  routeState.cards.push(
    {name:"Tramo "+n+" · Carta A",art:"assets/tramo-a.svg"},
    {name:"Tramo "+n+" · Carta B",art:"assets/tramo-b.svg"}
  );
  saveRouteState();
  renderDeck();
  notify("¡Tramo "+n+": has recibido 2 cartas!");
}
function showResult(card){
  const box=document.getElementById("resultCard");
  box.classList.remove("empty");box.classList.add("won");
  box.innerHTML='<img class="card-art" src="'+card.art+'" alt="'+card.name+'"><div class="card-name">'+card.name+'</div><div class="card-rarity">'+card.rarity+'</div>';
  document.getElementById("resultMessage").textContent="¡"+card.name+" se ha unido a tu baraja!";
}
function notify(message){
  toast.textContent=message;toast.classList.add("show");
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),2600);
}
function spin(){
  if(spinning || deck.length>=5)return;
  const selected=CARDS[Math.floor(Math.random()*CARDS.length)];
  const index=CARDS.findIndex(card=>card.id===selected.id);
  const slice=TAU/CARDS.length;
  const currentNorm=((rotation%TAU)+TAU)%TAU;
  const desiredNorm=((TAU-(index+.5)*slice)%TAU+TAU)%TAU;
  const delta=(desiredNorm-currentNorm+TAU)%TAU;
  const start=rotation;
  const target=start+TAU*5+delta;
  const duration=4200;
  const startTime=performance.now();
  spinning=true;renderDeck();
  function animate(now){
    const progress=Math.min(1,(now-startTime)/duration);
    const eased=1-Math.pow(1-progress,5);
    rotation=start+(target-start)*eased;
    drawWheel();
    if(progress<1){requestAnimationFrame(animate);return}
    rotation=target%TAU;spinning=false;
    deck.push(selected.id);saveDeck();lastCard=selected;
    showResult(selected);renderDeck();notify("¡Nueva carta: "+selected.name+"!");
  }
  requestAnimationFrame(animate);
}
spinButton.addEventListener("click",spin);
document.getElementById("tramoButton").addEventListener("click",()=>{
  if(spinning)return;
  addTramo();
});
document.getElementById("resetButton").addEventListener("click",()=>{
  if(spinning)return;
  if(!confirm("¿Seguro que quieres borrar las cartas de esta demo?"))return;
  deck=[];routeState={tramo:0,cards:[]};saveDeck();saveRouteState();
  document.getElementById("resultCard").className="result-card empty";
  document.getElementById("resultCard").innerHTML='<div class="card-placeholder"><span>✦</span><strong>¿QUÉ TE<br>TOCARÁ?</strong><small>GIRA LA RULETA</small></div>';
  document.getElementById("resultMessage").textContent="Tu próxima carta te espera.";
  renderDeck();notify("Demo reiniciada.");
});
drawWheel();renderDeck();
