const MAX = 10;
const KEY_STATE = "stamp_state_v2"; // {count:number, logs:[{text, ts}]}

const countEl = document.getElementById("count");
const barFill = document.getElementById("barFill");
const stamps = Array.from(document.querySelectorAll(".stamp"));

const openModalBtn = document.getElementById("openModalBtn");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");

const noteBox = document.getElementById("noteBox");

const backdrop = document.getElementById("backdrop");
const achievementInput = document.getElementById("achievementInput");
const okBtn = document.getElementById("okBtn");
const cancelBtn = document.getElementById("cancelBtn");
const hint = document.getElementById("hint");

const logList = document.getElementById("logList");
const emptyLog = document.getElementById("emptyLog");

const confetti = document.getElementById("confetti");

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function loadState(){
  try{
    const raw = localStorage.getItem(KEY_STATE);
    if(!raw) return { count: 0, logs: [] };
    const obj = JSON.parse(raw);
    const count = clamp(Number(obj.count) || 0, 0, MAX);
    const logs = Array.isArray(obj.logs) ? obj.logs.slice(0, MAX).filter(x => x && typeof x.text === "string") : [];
    return { count, logs };
  }catch{
    return { count: 0, logs: [] };
  }
}

function saveState(state){
  localStorage.setItem(KEY_STATE, JSON.stringify(state));
}

function fmtDate(ts){
  const d = new Date(ts);
  return d.toLocaleString("es-ES", { dateStyle:"medium", timeStyle:"short" });
}

function render(state, justStampedIndex = null){
  countEl.textContent = String(state.count);
  barFill.style.width = `${(state.count / MAX) * 100}%`;

  stamps.forEach((s, idx) => {
    const i = idx + 1;
    const filled = i <= state.count;
    s.classList.toggle("filled", filled);

    // animación solo en el sello recién puesto
    if(justStampedIndex === i){
      s.classList.add("animate");
      setTimeout(() => s.classList.remove("animate"), 400);
    }
  });

  // botones
  openModalBtn.disabled = state.count >= MAX;
  undoBtn.disabled = state.count <= 0;

  // nota final
  noteBox.hidden = state.count < MAX;

  // log
  logList.innerHTML = "";
  if(state.logs.length === 0){
    emptyLog.hidden = false;
  }else{
    emptyLog.hidden = true;
    state.logs.slice().reverse().forEach((item, idx) => {
      const li = document.createElement("li");
      li.textContent = item.text.trim();
      const meta = document.createElement("span");
      meta.className = "log-meta";
      meta.textContent = fmtDate(item.ts);
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

function spawnConfetti(){
  // confetti simple sin librerías: 80 piezas
  confetti.innerHTML = "";
  const pieces = 80;
  for(let i=0;i<pieces;i++){
    const el = document.createElement("i");
    const left = Math.random() * 100;
    const delay = Math.random() * 0.25;
    const duration = 0.9 + Math.random() * 0.7;
    el.style.left = `${left}vw`;
    el.style.animationDelay = `${delay}s`;
    el.style.animationDuration = `${duration}s`;
    el.style.transform = `translateY(-10px) rotate(${Math.random()*180}deg)`;
    confetti.appendChild(el);
  }
  // limpiar después
  setTimeout(() => confetti.innerHTML = "", 1800);
}

// --- lógica principal ---
let state = loadState();
render(state);

openModalBtn.addEventListener("click", openModal);

cancelBtn.addEventListener("click", closeModal);

backdrop.addEventListener("click", (e) => {
  if(e.target === backdrop) closeModal();
});

achievementInput.addEventListener("keydown", (e) => {
  // Enter = OK, Shift+Enter = salto de línea
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

  const newCount = state.count + 1;
  const newLogs = state.logs.concat([{ text, ts: Date.now() }]).slice(0, MAX);

  state = { count: newCount, logs: newLogs };
  saveState(state);
  closeModal();

  render(state, newCount);

  if(newCount === MAX){
    spawnConfetti();
  }
});

undoBtn.addEventListener("click", () => {
  if(state.count <= 0) return;

  // quitamos último sello y último logro (si existe)
  const newCount = state.count - 1;
  const newLogs = state.logs.slice(0, Math.max(0, state.logs.length - 1));
  state = { count: newCount, logs: newLogs };
  saveState(state);
  render(state);
});

resetBtn.addEventListener("click", () => {
  state = { count: 0, logs: [] };
  saveState(state);
  render(state);
});

exportBtn.addEventListener("click", async () => {
  const lines = state.logs.map((l, i) => `${i+1}. ${l.text.trim()} (${fmtDate(l.ts)})`);
  const payload = lines.length ? lines.join("\n") : "Aún no hay logros guardados.";
  try{
    await navigator.clipboard.writeText(payload);
    exportBtn.textContent = "¡Copiado!";
    setTimeout(() => exportBtn.textContent = "Copiar", 900);
  }catch{
    // fallback: prompt
    window.prompt("Copia el texto:", payload);
  }
});