const MAX = 10;
const KEY = "stamp_app_v3"; // {count, logs:[{text, ts}]}

const countEl = document.getElementById("count");
const barFill = document.getElementById("barFill");
const cells = Array.from(document.querySelectorAll(".cell"));

const openModalBtn = document.getElementById("openModalBtn");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");

const finalCard = document.getElementById("finalCard");

const backdrop = document.getElementById("backdrop");
const achievementInput = document.getElementById("achievementInput");
const okBtn = document.getElementById("okBtn");
const cancelBtn = document.getElementById("cancelBtn");
const closeX = document.getElementById("closeX");
const hint = document.getElementById("hint");

const logList = document.getElementById("logList");
const emptyLog = document.getElementById("emptyLog");

const stampFX = document.getElementById("stampFX");
const stamp = stampFX.querySelector(".stamp");

const confetti = document.getElementById("confetti");

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return {count:0, logs:[]};
    const obj = JSON.parse(raw);
    const count = clamp(Number(obj.count)||0, 0, MAX);
    const logs = Array.isArray(obj.logs) ? obj.logs.filter(x => x && typeof x.text==="string").slice(0, MAX) : [];
    return {count, logs};
  }catch{
    return {count:0, logs:[]};
  }
}
function save(state){ localStorage.setItem(KEY, JSON.stringify(state)); }

function fmt(ts){
  const d = new Date(ts);
  return d.toLocaleString("es-ES", {dateStyle:"medium", timeStyle:"short"});
}

function stampSVG(){
  // “Sello” marcado dentro de la casilla
  return `
    <div class="mark" aria-hidden="true">
      <svg viewBox="0 0 200 200" fill="none">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="rgba(77,230,179,0.95)"/>
            <stop offset="0.55" stop-color="rgba(118,169,255,0.95)"/>
            <stop offset="1" stop-color="rgba(255,218,123,0.95)"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="74" stroke="url(#g)" stroke-width="10" opacity="0.95"/>
        <circle cx="100" cy="100" r="56" stroke="url(#g)" stroke-width="3" stroke-dasharray="6 8" opacity="0.85"/>
        <path d="M70 104 L92 126 L134 78" stroke="url(#g)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
}

function render(state){
  countEl.textContent = String(state.count);
  barFill.style.width = `${(state.count / MAX) * 100}%`;

  cells.forEach((c, idx) => {
    const i = idx + 1;
    const filled = i <= state.count;
    c.classList.toggle("filled", filled);
    // poner/quitar marca
    const existing = c.querySelector(".mark");
    if(filled && !existing) c.insertAdjacentHTML("beforeend", stampSVG());
    if(!filled && existing) existing.remove();
  });

  undoBtn.disabled = state.count <= 0;
  openModalBtn.disabled = state.count >= MAX;

  finalCard.hidden = state.count < MAX;

  // log
  logList.innerHTML = "";
  if(state.logs.length === 0){
    emptyLog.hidden = false;
  }else{
    emptyLog.hidden = true;
    state.logs.slice().reverse().forEach(item => {
      const li = document.createElement("li");
      li.textContent = item.text.trim();
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = fmt(item.ts);
      li.appendChild(meta);
      logList.appendChild(li);
    });
  }
}

function openModal(){
  hint.hidden = true;
  achievementInput.value = "";
  backdrop.hidden = false;
  achievementInput.focus();
}
function closeModal(){
  backdrop.hidden = true;
}

function playStampFX(targetCell){
  // Coloca el sello encima de la casilla objetivo y lo anima cayendo
  const gridRect = document.getElementById("grid").getBoundingClientRect();
  const cellRect = targetCell.getBoundingClientRect();

  // Posición relativa dentro de gridWrap (stampFX está absolute dentro)
  // Convertimos al sistema de coordenadas del gridWrap:
  const wrap = stampFX.parentElement.getBoundingClientRect();
  const cx = (cellRect.left - wrap.left) + (cellRect.width / 2);
  const cy = (cellRect.top  - wrap.top ) + (cellRect.height / 2);

  stampFX.hidden = false;

  // Centramos el sello sobre la casilla
  stampFX.style.placeItems = "unset";
  stampFX.style.display = "block";
  stampFX.style.position = "absolute";
  stampFX.style.inset = "0";

  stamp.style.position = "absolute";
  stamp.style.left = `${cx}px`;
  stamp.style.top  = `${cy}px`;
  stamp.style.transform = "translate(-50%, -50%)"; // base (la animación aplica encima)

  // Reiniciar animación
  stamp.classList.remove("play");
  void stamp.offsetWidth; // reflow
  stamp.classList.add("play");

  // Ocultar al terminar
  setTimeout(() => {
    stampFX.hidden = true;
  }, 560);
}

function spawnConfetti(){
  confetti.innerHTML = "";
  const pieces = 110;
  for(let i=0;i<pieces;i++){
    const el = document.createElement("i");
    const left = Math.random()*100;
    const delay = Math.random()*0.25;
    const duration = 0.95 + Math.random()*0.75;
    const size = 8 + Math.random()*8;

    el.style.left = `${left}vw`;
    el.style.animationDelay = `${delay}s`;
    el.style.animationDuration = `${duration}s`;
    el.style.width = `${size}px`;
    el.style.height = `${size*1.25}px`;
    el.style.transform = `translateY(-12px) rotate(${Math.random()*180}deg)`;
    confetti.appendChild(el);
  }
  setTimeout(() => confetti.innerHTML = "", 2000);
}

let state = load();
render(state);

// --- Eventos ---
openModalBtn.addEventListener("click", openModal);

cancelBtn.addEventListener("click", closeModal);
closeX.addEventListener("click", closeModal);

backdrop.addEventListener("click", (e) => {
  if(e.target === backdrop) closeModal();
});

achievementInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    okBtn.click();
  }
});

okBtn.addEventListener("click", () => {
  const text = achievementInput.value.trim();
  if(!text){
    hint.hidden = false;
    achievementInput.focus();
    return;
  }
  if(state.count >= MAX) return;

  const next = state.count + 1;
  const logs = state.logs.concat([{text, ts: Date.now()}]).slice(0, MAX);

  state = {count: next, logs};
  save(state);
  closeModal();

  // Animación de sello sobre la casilla que se va a completar
  const targetCell = cells[next - 1];
  playStampFX(targetCell);

  // Pintamos la marca justo después del “golpe” del sello
  setTimeout(() => render(state), 220);

  if(next === MAX){
    setTimeout(spawnConfetti, 520);
  }
});

undoBtn.addEventListener("click", () => {
  if(state.count <= 0) return;
  state = {
    count: state.count - 1,
    logs: state.logs.slice(0, Math.max(0, state.logs.length - 1))
  };
  save(state);
  render(state);
});

resetBtn.addEventListener("click", () => {
  state = {count:0, logs:[]};
  save(state);
  render(state);
});

exportBtn.addEventListener("click", async () => {
  const lines = state.logs.map((l, i) => `${i+1}. ${l.text.trim()} (${fmt(l.ts)})`);
  const payload = lines.length ? lines.join("\n") : "Aún no hay logros guardados.";
  try{
    await navigator.clipboard.writeText(payload);
    exportBtn.textContent = "¡Copiado!";
    setTimeout(() => exportBtn.textContent = "Copiar", 900);
  }catch{
    window.prompt("Copia el texto:", payload);
  }
});