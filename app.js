const MAX = 10;

const KEY = "sellos_v4_state";   // {count, logs:[{text, ts}], theme, sound, streak, lastDayISO}
const $ = (id) => document.getElementById(id);

const countEl = $("count");
const streakEl = $("streak");
const barFill = $("barFill");

const grid = $("grid");
const cells = Array.from(document.querySelectorAll(".cell"));

const openBtn = $("openBtn");
const undoBtn = $("undoBtn");
const resetBtn = $("resetBtn");
const copyBtn = $("copyBtn");

const doneCard = $("doneCard");

const modalBack = $("modalBack");
const closeBtn = $("closeBtn");
const cancelBtn = $("cancelBtn");
const okBtn = $("okBtn");
const input = $("input");
const warn = $("warn");

const themeBtn = $("themeBtn");
const soundBtn = $("soundBtn");

const stampOverlay = $("stampOverlay");
const stamp = $("stamp");

const confetti = $("confetti");

const logList = $("logList");
const emptyLog = $("emptyLog");

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function fmt(ts) {
    const d = new Date(ts);
    return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return {
            count: 0, logs: [],
            theme: "dark",
            sound: true,
            streak: 0,
            lastDayISO: null
        };
        const s = JSON.parse(raw);
        return {
            count: clamp(Number(s.count) || 0, 0, MAX),
            logs: Array.isArray(s.logs) ? s.logs.filter(x => x && typeof x.text === "string").slice(0, MAX) : [],
            theme: (s.theme === "light") ? "light" : "dark",
            sound: (s.sound !== false),
            streak: clamp(Number(s.streak) || 0, 0, 9999),
            lastDayISO: (typeof s.lastDayISO === "string") ? s.lastDayISO : null
        };
    } catch {
        return { count: 0, logs: [], theme: "dark", sound: true, streak: 0, lastDayISO: null };
    }
}

function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
}
// ===== Firebase Cloud Sync =====
let uid = null;

async function cloudLoad() {
    if (!uid || !window.__fb) return null;
    const { db, doc, getDoc } = window.__fb;
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

async function cloudSave(state) {
    if (!uid || !window.__fb) return;
    const { db, doc, setDoc } = window.__fb;
    const ref = doc(db, "users", uid);

    const payload = {
        count: state.count,
        logs: state.logs,
        theme: state.theme,
        sound: state.sound,
        streak: state.streak,
        lastDayISO: state.lastDayISO,
        updatedAt: Date.now()
    };

    await setDoc(ref, payload, { merge: true });
}

async function initCloud() {
    if (!window.__fb) return; // por si Firebase no cargó
    const { auth, signInAnonymously, onAuthStateChanged } = window.__fb;

    // Importante: esto debe pasar por un click del usuario en algunos móviles.
    // Pero normalmente vale al cargar.
    await signInAnonymously(auth);

    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            uid = user.uid;

            // 1) intenta cargar remoto
            const remote = await cloudLoad();

            if (remote && typeof remote.count === "number") {
                // mezcla remoto -> state
                state.count = Math.max(0, Math.min(10, remote.count || 0));
                state.logs = Array.isArray(remote.logs) ? remote.logs : [];
                if (remote.theme) state.theme = remote.theme;
                if (typeof remote.sound === "boolean") state.sound = remote.sound;
                if (typeof remote.streak === "number") state.streak = remote.streak;
                if (remote.lastDayISO) state.lastDayISO = remote.lastDayISO;
            } else {
                // si no hay remoto, sube lo local como primera copia
                await cloudSave(state);
            }

            resolve();
        });
    });
}
function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
}

function setSoundUI(on) {
    const icon = soundBtn.querySelector(".chipIcon");
    const text = soundBtn.querySelector(".chipText");
    icon.textContent = on ? "🔊" : "🔇";
    text.textContent = on ? "Sonido" : "Silencio";
}

function setThemeUI(theme) {
    const text = themeBtn.querySelector(".chipText");
    text.textContent = (theme === "light") ? "Claro" : "Oscuro";
}

function stampMarkSVG() {
    // Marca “tinta” dentro de la casilla
    return `
    <div class="markInCell" aria-hidden="true">
      <svg viewBox="0 0 200 200" fill="none">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="rgba(80,240,189,0.95)"/>
            <stop offset="0.55" stop-color="rgba(122,168,255,0.95)"/>
            <stop offset="1" stop-color="rgba(255,210,122,0.95)"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="74" stroke="url(#g)" stroke-width="10" opacity="0.98"/>
        <circle cx="100" cy="100" r="56" stroke="url(#g)" stroke-width="3" stroke-dasharray="6 8" opacity="0.88"/>
        <path d="M70 104 L92 126 L134 78" stroke="url(#g)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
}

function render(state) {
    countEl.textContent = String(state.count);
    streakEl.textContent = String(state.streak);
    barFill.style.width = `${(state.count / MAX) * 100}%`;

    cells.forEach((c, idx) => {
        const i = idx + 1;
        const filled = i <= state.count;
        c.classList.toggle("filled", filled);

        const existing = c.querySelector(".markInCell");
        if (filled && !existing) c.insertAdjacentHTML("beforeend", stampMarkSVG());
        if (!filled && existing) existing.remove();

        c.setAttribute("aria-label", filled ? `Sello ${i} completado` : `Sello ${i} vacío`);
    });

    undoBtn.disabled = state.count <= 0;
    openBtn.disabled = state.count >= MAX;
    doneCard.hidden = state.count < MAX;

    // Log
    logList.innerHTML = "";
    if (state.logs.length === 0) {
        emptyLog.hidden = false;
    } else {
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

    setTheme(state.theme);
    setThemeUI(state.theme);
    setSoundUI(state.sound);
}

function openModal() {
    warn.hidden = true;
    input.value = "";
    modalBack.hidden = false;
    input.focus();
}

function closeModal() {
    modalBack.hidden = true;
}

function playStampFX(targetCell) {
    // posiciona sello sobre la casilla y reproduce animación
    const wrapRect = grid.getBoundingClientRect();
    const cellRect = targetCell.getBoundingClientRect();

    const cx = (cellRect.left - wrapRect.left) + cellRect.width / 2;
    const cy = (cellRect.top - wrapRect.top) + cellRect.height / 2;

    stampOverlay.hidden = false;

    // Overlay está dentro del panel, y grid es el contenedor de referencia
    stampOverlay.style.inset = "0";
    stampOverlay.style.left = `${grid.offsetLeft}px`;
    stampOverlay.style.top = `${grid.offsetTop}px`;
    stampOverlay.style.width = `${grid.offsetWidth}px`;
    stampOverlay.style.height = `${grid.offsetHeight}px`;

    stamp.style.left = `${cx}px`;
    stamp.style.top = `${cy}px`;

    stamp.classList.remove("play");
    void stamp.offsetWidth;
    stamp.classList.add("play");

    setTimeout(() => { stampOverlay.hidden = true; }, 580);
}

function spawnConfetti() {
    confetti.innerHTML = "";
    const pieces = 120;
    for (let i = 0; i < pieces; i++) {
        const el = document.createElement("i");
        const left = Math.random() * 100;
        const delay = Math.random() * 0.25;
        const duration = 0.95 + Math.random() * 0.9;
        const size = 8 + Math.random() * 9;

        el.style.left = `${left}vw`;
        el.style.animationDelay = `${delay}s`;
        el.style.animationDuration = `${duration}s`;
        el.style.width = `${size}px`;
        el.style.height = `${size * 1.25}px`;
        el.style.transform = `translateY(-14px) rotate(${Math.random() * 180}deg)`;
        confetti.appendChild(el);
    }
    setTimeout(() => confetti.innerHTML = "", 2200);
}

/* ----- Sonido suave opcional (WebAudio) ----- */
let audioCtx = null;
function softClick() {
    if (!state.sound) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const t = audioCtx.currentTime;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(620, t);
        osc.frequency.exponentialRampToValueAtTime(330, t + 0.07);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(t);
        osc.stop(t + 0.13);
    } catch {
        // si falla, no pasa nada
    }
}

/* ----- Racha (1 por día si añade al menos 1 sello ese día) ----- */
function updateStreakOnAdd() {
    const today = todayISO();
    if (state.lastDayISO === today) return; // ya contó hoy

    // si ayer fue el último día, incrementa, si no reinicia a 1
    if (state.lastDayISO) {
        const last = new Date(state.lastDayISO + "T00:00:00");
        const now = new Date(today + "T00:00:00");
        const diffDays = Math.round((now - last) / 86400000);
        state.streak = (diffDays === 1) ? (state.streak + 1) : 1;
    } else {
        state.streak = 1;
    }
    state.lastDayISO = today;
}

/* ================== APP ================== */
let state = load();

(async () => {
    // 1) pinta algo rápido con local (para no esperar)
    render(state);

    // 2) intenta nube y vuelve a pintar con lo remoto
    try {
        await initCloud();
        render(state);
    } catch (e) {
        // si falla nube, se queda en local y listo
        console.warn("Cloud init failed:", e);
    }
})();

/* ---- Modal events ---- */
openBtn.addEventListener("click", openModal);
closeBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

modalBack.addEventListener("click", (e) => {
    if (e.target === modalBack) closeModal();
});

input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        okBtn.click();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalBack.hidden) closeModal();
});

/* ---- OK -> sellar ---- */
okBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) {
        warn.hidden = false;
        input.focus();
        return;
    }
    if (state.count >= MAX) return;

    const next = state.count + 1;
    const targetCell = cells[next - 1];

    // Actualiza estado
    state.count = next;
    state.logs = state.logs.concat([{ text, ts: Date.now() }]).slice(0, MAX);
    updateStreakOnAdd();
    save(state);
    cloudSave(state).catch(() => { });
    closeModal();

    // FX sello + sonido
    playStampFX(targetCell);
    softClick();

    // Pinta la marca justo después del “golpe”
    setTimeout(() => render(state), 220);

    if (next === MAX) {
        setTimeout(() => {
            spawnConfetti();
            softClick();
        }, 520);
    }
});

/* ---- Undo / Reset ---- */
undoBtn.addEventListener("click", () => {
    if (state.count <= 0) return;
    state.count -= 1;
    state.logs = state.logs.slice(0, Math.max(0, state.logs.length - 1));
    save(state);
    cloudSave(state).catch(() => { });
    render(state);
});

resetBtn.addEventListener("click", () => {
    state.count = 0;
    state.logs = [];
    state.streak = 0;
    state.lastDayISO = null;
    save(state);
    cloudSave(state).catch(() => { });
    render(state);
});

/* ---- Copy ---- */
copyBtn.addEventListener("click", async () => {
    const lines = state.logs.map((l, i) => `${i + 1}. ${l.text.trim()} (${fmt(l.ts)})`);
    const payload = lines.length ? lines.join("\n") : "Aún no hay logros guardados.";
    try {
        await navigator.clipboard.writeText(payload);
        const old = copyBtn.textContent;
        copyBtn.textContent = "¡Copiado!";
        setTimeout(() => copyBtn.textContent = old, 900);
    } catch {
        window.prompt("Copia el texto:", payload);
    }
});

/* ---- Theme / Sound ---- */
themeBtn.addEventListener("click", () => {
    state.theme = (state.theme === "light") ? "dark" : "light";
    save(state);
    cloudSave(state).catch(() => { });
    render(state);
});

soundBtn.addEventListener("click", () => {
    state.sound = !state.sound;
    save(state);
    cloudSave(state).catch(() => { });
    render(state);
});

/* ---- Bonus: click en casillas para “ver” (sin editar) ---- */
cells.forEach((c, idx) => {
    c.addEventListener("click", () => {
        const i = idx + 1;
        if (i <= state.count) {
            // micro “bounce” amable al tocar un sello completado
            c.animate(
                [{ transform: "scale(1)" }, { transform: "scale(1.03)" }, { transform: "scale(1)" }],
                { duration: 220, easing: "ease-out" }
            );
            softClick();
        }
    });
});