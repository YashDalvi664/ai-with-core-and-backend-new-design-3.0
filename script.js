/* script.js — Ultron AI Frontend | Created by Yash Datta Dalvi */

const canvas = document.getElementById('aiBall');
const ctx = canvas.getContext('2d');

let cx, cy;
let bigRadius;
const particleCount = 450;
let particles = [];
let aiThinking = false;
let mouse = { x: -9999, y: -9999 };
let mandalaRotation = 0;
let mandalaProgress = 0;
const rings = 6;

// === CONFIG — loaded from config.js ===
const BACKEND_URL = ULTRON_CONFIG.BACKEND_URL + "/api/chat";
const TEACH_URL   = ULTRON_CONFIG.BACKEND_URL + "/api/teach";
const API_KEY     = ULTRON_CONFIG.API_KEY;

// Tracks if Ultron asked the user to teach it something
let pendingTeach = null; // { question: "..." }

// Chat elements
const chatMessages = document.getElementById("chatMessages");
const chatInput    = document.getElementById("chatInput");

// ─── UTILS ───────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ─── PARTICLES ───────────────────────────────────────────────────────────────
function initParticles() {
  particles = [];
  const particlesPerRing = Math.floor(particleCount / rings) || 1;
  for (let r = 1; r <= rings; r++) {
    const radius = (bigRadius * 0.4) * r / rings;
    for (let i = 0; i < particlesPerRing; i++) {
      const angle        = (2 * Math.PI * i) / particlesPerRing;
      const scatterAngle = Math.random() * 2 * Math.PI;
      const scatterRadius = Math.sqrt(Math.random()) * bigRadius;
      const phase        = Math.random() * 2 * Math.PI;
      const speed        = 0.001 + Math.random() * 0.002;
      particles.push({
        x: cx + Math.random() * 10 - 5,
        y: cy + Math.random() * 10 - 5,
        scatterAngle, scatterRadius, phase, speed,
        mandalaRadius: radius,
        mandalaAngle: angle,
        baseSize: 1.5
      });
    }
  }
}

function resizeCanvas() {
  const oldCx = cx || window.innerWidth / 2;
  const oldCy = cy || window.innerHeight / 2;
  const oldBigRadius = bigRadius || Math.min(oldCx, oldCy) * 0.45;

  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  cx = canvas.width / 2;
  cy = canvas.height / 4;
  bigRadius = Math.min(cx, cy) * 0.80;

  if (particles.length > 0) {
    const scaleX = cx / oldCx;
    const scaleY = cy / oldCy;
    const scaleR = bigRadius / oldBigRadius;
    for (let p of particles) {
      p.x *= scaleX;
      p.y *= scaleY;
      p.scatterRadius *= scaleR;
      p.mandalaRadius  *= scaleR;
    }
  } else {
    initParticles();
  }
}

// ─── MOUSE ───────────────────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

// ─── THINKING ANIMATION ──────────────────────────────────────────────────────
let thinkingStartedAt   = 0;
const MIN_THINK_MS      = 1200;
const MANDALA_RAMP_FAST = 0.04;
const MANDALA_RAMP_SLOW = 0.01;

function startThinking() {
  aiThinking = true;
  thinkingStartedAt = performance.now();
}

function stopThinking() {
  const elapsed = performance.now() - thinkingStartedAt;
  const remain  = Math.max(0, MIN_THINK_MS - elapsed);
  setTimeout(() => { aiThinking = false; }, remain);
}

// ─── RENDER LOOP ─────────────────────────────────────────────────────────────
function animate(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Glow background
  ctx.beginPath();
  ctx.arc(cx, cy, bigRadius + 20, 0, 2 * Math.PI);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, bigRadius + 60);
  gradient.addColorStop(0, "rgba(0, 200, 255, 0.3)");
  gradient.addColorStop(1, "rgba(0, 200, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fill();

  // Mandala progress
  if (aiThinking && mandalaProgress < 1)
    mandalaProgress = Math.min(1, mandalaProgress + MANDALA_RAMP_FAST);
  else if (!aiThinking && mandalaProgress > 0)
    mandalaProgress = Math.max(0, mandalaProgress - MANDALA_RAMP_SLOW);

  const easedProgress = easeInOut(Math.max(0, Math.min(1, mandalaProgress)));
  if (aiThinking) mandalaRotation += 0.012 * (1 + easedProgress);

  // Draw particles
  for (let p of particles) {
    p.scatterAngle += p.speed;

    let idleX = cx + p.scatterRadius * Math.cos(p.scatterAngle);
    let idleY = cy + p.scatterRadius * Math.sin(p.scatterAngle);

    let mandalaX = cx + p.mandalaRadius * Math.cos(p.mandalaAngle + mandalaRotation);
    let mandalaY = cy + p.mandalaRadius * Math.sin(p.mandalaAngle + mandalaRotation);

    let targetX = lerp(idleX, mandalaX, easedProgress);
    let targetY = lerp(idleY, mandalaY, easedProgress);

    const osc = Math.sin(time * 0.003 + p.phase) * 3 * (1 - easedProgress);
    targetX += osc;
    targetY += osc;

    // Mouse repulsion (only when idle)
    if (!aiThinking) {
      const dx   = p.x - mouse.x;
      const dy   = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 120) {
        const force = (120 - dist) / 120 * 20;
        targetX += dx / dist * force;
        targetY += dy / dist * force;
      }
    }

    p.x = lerp(p.x, targetX, 0.05);
    p.y = lerp(p.y, targetY, 0.05);

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.baseSize, 0, 2 * Math.PI);
    ctx.fillStyle = "#000";
    ctx.fill();
  }

  // Neural lines (during thinking)
  if (mandalaProgress > 0.05) {
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth   = 0.3;
    for (let i = 0; i < particles.length; i += 12) {
      for (let j = i + 1; j < particles.length; j += 12) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  requestAnimationFrame(animate);
}

// ─── BACKEND CALLS ───────────────────────────────────────────────────────────
async function sendToBackend(msg) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"   // prevents ngrok's interstitial page
    },
    body: JSON.stringify({ message: msg, apiKey: API_KEY })
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return await res.json();
}

async function sendTeach(question, answer) {
  const res = await fetch(TEACH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    },
    body: JSON.stringify({ question, answer, apiKey: API_KEY })
  });
  if (!res.ok) throw new Error(`Teach error ${res.status}`);
  const data = await res.json();
  return data.reply || "Stored.";
}

// ─── CHAT LOGIC ──────────────────────────────────────────────────────────────
chatInput.addEventListener("keypress", async e => {
  if (e.key !== "Enter" || chatInput.value.trim() === "") return;

  const msg = chatInput.value.trim();
  chatInput.value = "";
  addMessage("user", msg);
  startThinking();

  try {
    // TEACH flow — user is answering something Ultron didn't know
    if (pendingTeach && msg.toUpperCase().startsWith("TEACH:")) {
      const userAnswer = msg.slice(6).trim();
      if (userAnswer) {
        const confirmation = await sendTeach(pendingTeach.question, userAnswer);
        stopThinking();
        addMessage("ai", `✅ ${confirmation}`);
      } else {
        stopThinking();
        addMessage("ai", "Please provide an answer after TEACH: so I can store it.");
      }
      pendingTeach = null;
      return;
    }

    // Normal chat
    pendingTeach = null;
    const data  = await sendToBackend(msg);
    stopThinking();

    addMessage("ai", data.reply || "Ultron: (no response)");

    // If Ultron flagged unknown — remember the question for TEACH
    if (data.unknown && data.question) {
      pendingTeach = { question: data.question };
    }

  } catch (err) {
    stopThinking();
    addMessage("ai", "⚠️ Unable to reach Ultron. Make sure the server is running and config.js has the correct ngrok URL.");
    console.error(err);
  }
});

function addMessage(sender, text) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
resizeCanvas();
initParticles();
animate(0);
window.addEventListener('resize', resizeCanvas);