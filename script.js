/* ═══════════════════════════════════════════════════════════
   script.js — Ultron AI Frontend Logic
   Created by: Yash Datta Dalvi

   Sections:
   1.  Config
   2.  DOM References
   3.  Dark Mode Toggle
   4.  Status Indicator
   5.  Canvas Setup
   6.  Particle System
   7.  Thinking Animation Control
   8.  Render Loop
   9.  Backend API Calls
   10. Chat UI Helpers
   11. Chat Logic
   12. Init
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   1. CONFIG — loaded from config.js
═══════════════════════════════════════════════════════════ */
const BACKEND_URL = ULTRON_CONFIG.BACKEND_URL + "/api/chat";
const TEACH_URL   = ULTRON_CONFIG.BACKEND_URL + "/api/teach";
const STATUS_URL  = ULTRON_CONFIG.BACKEND_URL + "/api/status";
const API_KEY     = ULTRON_CONFIG.API_KEY;

// Resume hosted on GitHub Pages — update filename if different
const RESUME_URL  = "https://yashdalvi664.github.io/ai-with-backend-2.0/resume.pdf";

// Keywords that trigger resume download (checked before sending to backend)
const RESUME_KEYWORDS = [
  "resume", "download resume", "cv", "your cv",
  "download cv", "get resume", "share resume"
];


/* ═══════════════════════════════════════════════════════════
   2. DOM REFERENCES
═══════════════════════════════════════════════════════════ */
const canvas       = document.getElementById('aiBall');
const ctx          = canvas.getContext('2d');
const chatMessages = document.getElementById('chatMessages');
const chatInput    = document.getElementById('chatInput');
const sendBtn      = document.getElementById('sendBtn');
const statusBar    = document.getElementById('statusBar');
const statusText   = document.getElementById('statusText');
const themeBtn     = document.getElementById('themeBtn');
const moonIcon     = document.getElementById('moonIcon');
const sunIcon      = document.getElementById('sunIcon');


/* ═══════════════════════════════════════════════════════════
   3. DARK MODE TOGGLE
   - Toggles body class "dark"
   - Switches moon/sun icon
   - Saves preference to localStorage
   - Particle colors update automatically via getParticleColors()
═══════════════════════════════════════════════════════════ */
let isDark = localStorage.getItem('ultron-theme') === 'dark';

function applyTheme() {
  if (isDark) {
    document.body.classList.add('dark');
    moonIcon.style.display = 'none';
    sunIcon.style.display  = 'block';
  } else {
    document.body.classList.remove('dark');
    moonIcon.style.display = 'block';
    sunIcon.style.display  = 'none';
  }
}

// Read current particle/orb colors from CSS variables
// This means colors are controlled in style.css, not hardcoded here
function getParticleColors() {
  const style = getComputedStyle(document.body);
  return {
    particle: style.getPropertyValue('--particle-color').trim() || '#000000',
    glow:     style.getPropertyValue('--orb-glow').trim()       || 'rgba(0,200,255,0.25)',
    lines:    style.getPropertyValue('--line-color').trim()     || 'rgba(0,0,0,0.08)',
  };
}

themeBtn.addEventListener('click', () => {
  isDark = !isDark;
  localStorage.setItem('ultron-theme', isDark ? 'dark' : 'light');

  // Rotate animation on button
  themeBtn.classList.add('rotating');
  setTimeout(() => themeBtn.classList.remove('rotating'), 300);

  applyTheme();
});

// Apply saved theme immediately on load
applyTheme();


/* ═══════════════════════════════════════════════════════════
   4. STATUS INDICATOR
   Pings /api/status every 15s
   Sets green (online) / red (offline) dot
═══════════════════════════════════════════════════════════ */
function setStatus(state) {
  statusBar.className = 'status-bar ' + state;
  if      (state === 'online')  statusText.textContent = 'Ultron is online';
  else if (state === 'offline') statusText.textContent = 'Ultron is offline';
  else {
    statusBar.className   = 'status-bar';
    statusText.textContent = 'Connecting...';
  }
}

async function checkStatus() {
  try {
    const res = await fetch(STATUS_URL, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(5000)
    });
    setStatus(res.ok ? 'online' : 'offline');
  } catch {
    setStatus('offline');
  }
}

checkStatus();
setInterval(checkStatus, 15000);


/* ═══════════════════════════════════════════════════════════
   5. CANVAS SETUP
   Sizes canvas to fill .core-canvas-wrap
   Uses devicePixelRatio to fix blur on retina/mobile screens
   Called on load and window resize
═══════════════════════════════════════════════════════════ */
let cx, cy, bigRadius;

// Detect mobile — fewer particles + sparser lines for performance
const isMobile = () => window.innerWidth < 768;

function resizeCanvas() {
  const parent = canvas.parentElement;
  const dpr    = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x — 3x is overkill

  const cssW = parent.clientWidth;
  const cssH = parent.clientHeight;

  // Store old CSS dimensions for particle rescaling
  const oldCssW = cx ? cx * 2 : cssW;
  const oldCssH = cy ? cy * 2 : cssH;

  // Set canvas internal pixel buffer size
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  // Set CSS display size to match container exactly
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';

  // Reset transform first (CRITICAL — prevents scale accumulation on resize)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Now scale once for DPR
  ctx.scale(dpr, dpr);

  // Update center + radius in CSS pixel space
  cx        = cssW / 2;
  cy        = cssH / 2;
  bigRadius = Math.min(cx, cy) * 0.75;

  if (particles.length > 0) {
    const scaleX = cssW / oldCssW;
    const scaleY = cssH / oldCssH;
    const oldRadius = Math.min(oldCssW, oldCssH) / 2 * 0.75;
    const scaleR = bigRadius / (oldRadius || bigRadius);
    for (let p of particles) {
      p.x             *= scaleX;
      p.y             *= scaleY;
      p.scatterRadius *= scaleR;
      p.mandalaRadius *= scaleR;
    }
  } else {
    initParticles();
  }
}


/* ═══════════════════════════════════════════════════════════
   6. PARTICLE SYSTEM
   Desktop: 450 particles, step 8 lines
   Mobile:  200 particles, step 16 lines (much lighter)
═══════════════════════════════════════════════════════════ */
const rings     = 6;
let particles   = [];
let mouse       = { x: -9999, y: -9999 };

// Particle count based on device — mobile gets fewer for performance
function getParticleCount() { return isMobile() ? 200 : 450; }
// Line step — higher = fewer lines = faster on mobile
function getLineStep()      { return isMobile() ? 16  : 8;   }

function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t)  { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }

function initParticles() {
  particles = [];
  const count   = getParticleCount();
  const perRing = Math.floor(count / rings) || 1;
  for (let r = 1; r <= rings; r++) {
    const radius = (bigRadius * 0.4) * r / rings;
    for (let i = 0; i < perRing; i++) {
      particles.push({
        x:             cx + Math.random() * 10 - 5,
        y:             cy + Math.random() * 10 - 5,
        scatterAngle:  Math.random() * 2 * Math.PI,
        scatterRadius: Math.sqrt(Math.random()) * bigRadius,
        phase:         Math.random() * 2 * Math.PI,
        speed:         0.001 + Math.random() * 0.002,
        mandalaRadius: radius,
        mandalaAngle:  (2 * Math.PI * i) / perRing,
        baseSize:      1.5
      });
    }
  }
}

// Mouse repulsion
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});
canvas.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

// Touch support
canvas.addEventListener('touchmove', e => {
  const rect  = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  mouse.x = touch.clientX - rect.left;
  mouse.y = touch.clientY - rect.top;
}, { passive: true });
canvas.addEventListener('touchend', () => { mouse.x = -9999; mouse.y = -9999; });


/* ═══════════════════════════════════════════════════════════
   7. THINKING ANIMATION CONTROL
   startThinking() → mandala forms
   stopThinking()  → mandala dissolves after min time
═══════════════════════════════════════════════════════════ */
let aiThinking      = false;
let mandalaRotation = 0;
let mandalaProgress = 0;
let thinkingStartAt = 0;
const MIN_THINK_MS  = 1200;
const RAMP_IN       = 0.04;
const RAMP_OUT      = 0.01;

function startThinking() {
  aiThinking      = true;
  thinkingStartAt = performance.now();
}

function stopThinking() {
  const elapsed = performance.now() - thinkingStartAt;
  const wait    = Math.max(0, MIN_THINK_MS - elapsed);
  setTimeout(() => { aiThinking = false; }, wait);
}


/* ═══════════════════════════════════════════════════════════
   8. RENDER LOOP
   
   Key change from previous version:
   - Neural connection lines are NOW ALWAYS VISIBLE (not just when thinking)
   - Line opacity scales with proximity — closer = more opaque
   - In dark mode: lines are cyan; in light mode: dark/subtle
   - Particle color reads from CSS variable --particle-color
     so dark mode automatically gets cyan particles
═══════════════════════════════════════════════════════════ */
function animate(time) {
  // Clear in CSS pixel space (cx*2, cy*2) — context is already scaled by DPR
  ctx.clearRect(0, 0, cx * 2, cy * 2);

  // Read current theme colors from CSS variables every frame
  const colors = getParticleColors();

  // — Glow orb background —
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bigRadius + 60);
  grad.addColorStop(0, colors.glow);
  grad.addColorStop(1, 'rgba(0, 200, 255, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, bigRadius + 20, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  ctx.fill();

  // — Mandala progress ramp —
  if (aiThinking && mandalaProgress < 1)
    mandalaProgress = Math.min(1, mandalaProgress + RAMP_IN);
  else if (!aiThinking && mandalaProgress > 0)
    mandalaProgress = Math.max(0, mandalaProgress - RAMP_OUT);

  const eased = easeInOut(Math.max(0, Math.min(1, mandalaProgress)));
  if (aiThinking) mandalaRotation += 0.012 * (1 + eased);

  // — Move + draw particles —
  for (let p of particles) {
    p.scatterAngle += p.speed;

    const idleX = cx + p.scatterRadius * Math.cos(p.scatterAngle);
    const idleY = cy + p.scatterRadius * Math.sin(p.scatterAngle);

    const mX = cx + p.mandalaRadius * Math.cos(p.mandalaAngle + mandalaRotation);
    const mY = cy + p.mandalaRadius * Math.sin(p.mandalaAngle + mandalaRotation);

    let tx = lerp(idleX, mX, eased);
    let ty = lerp(idleY, mY, eased);

    const osc = Math.sin(time * 0.003 + p.phase) * 3 * (1 - eased);
    tx += osc;
    ty += osc;

    if (!aiThinking) {
      const dx   = p.x - mouse.x;
      const dy   = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 120) {
        const force = (120 - dist) / 120 * 20;
        tx += dx / dist * force;
        ty += dy / dist * force;
      }
    }

    p.x = lerp(p.x, tx, 0.05);
    p.y = lerp(p.y, ty, 0.05);

    // Draw particle dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.baseSize, 0, 2 * Math.PI);
    ctx.fillStyle = colors.particle;
    ctx.fill();
  }

  // — Neural connection lines —
  // Step size adapts to device — mobile uses larger step = fewer lines
  const step = getLineStep();
  ctx.lineWidth = 0.6;
  for (let i = 0; i < particles.length; i += step) {
    for (let j = i + 1; j < particles.length; j += step) {
      const dx   = particles[i].x - particles[j].x;
      const dy   = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Max connection distance — closer = more visible
      const maxDist = 70;
      if (dist < maxDist) {
        // Opacity: 1.0 at dist=0, 0.0 at dist=maxDist
        const opacity = (1 - dist / maxDist) * 0.35;

        // Parse line color base and apply dynamic opacity
        // In dark mode lines are cyan, in light mode dark gray
        const lineBase = isDark ? `rgba(0, 200, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity * 0.6})`;

        ctx.strokeStyle = lineBase;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(animate);
}


/* ═══════════════════════════════════════════════════════════
   9. BACKEND API CALLS
═══════════════════════════════════════════════════════════ */
async function sendToBackend(msg) {
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ message: msg, apiKey: API_KEY })
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return await res.json();
}

async function sendTeach(question, answer) {
  const res = await fetch(TEACH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ question, answer, apiKey: API_KEY })
  });
  if (!res.ok) throw new Error(`Teach error ${res.status}`);
  const data = await res.json();
  return data.reply || 'Stored.';
}


/* ═══════════════════════════════════════════════════════════
   10. CHAT UI HELPERS
═══════════════════════════════════════════════════════════ */
let pendingTeach = null;
let typingRow    = null;

function addMessage(sender, text) {
  const row = document.createElement('div');
  row.classList.add('message-row', sender);

  if (sender === 'ai') {
    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    avatar.textContent = 'U';
    row.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  bubble.textContent = text;
  row.appendChild(bubble);

  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Special message with a download button — used for resume
function addDownloadMessage(text, fileUrl, fileName) {
  const row = document.createElement('div');
  row.classList.add('message-row', 'ai');

  // Avatar
  const avatar = document.createElement('div');
  avatar.classList.add('avatar');
  avatar.textContent = 'U';

  // Bubble with text + download button
  const bubble = document.createElement('div');
  bubble.classList.add('bubble', 'download-bubble');

  const msg = document.createElement('p');
  msg.textContent = text;

  // Download anchor — triggers browser download immediately
  const btn = document.createElement('a');
  btn.href     = fileUrl;
  btn.download = fileName;
  btn.target   = '_blank';
  btn.classList.add('download-btn');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    Download Resume
  `;

  bubble.appendChild(msg);
  bubble.appendChild(btn);
  row.appendChild(avatar);
  row.appendChild(bubble);

  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Auto-trigger download so user doesn't need to click
  const autoLink = document.createElement('a');
  autoLink.href     = fileUrl;
  autoLink.download = fileName;
  autoLink.target   = '_blank';
  document.body.appendChild(autoLink);
  autoLink.click();
  document.body.removeChild(autoLink);
}

function showTyping() {
  typingRow = document.createElement('div');
  typingRow.classList.add('message-row', 'ai');

  const avatar = document.createElement('div');
  avatar.classList.add('avatar');
  avatar.textContent = 'U';

  const indicator = document.createElement('div');
  indicator.classList.add('typing-indicator');
  indicator.innerHTML = '<span></span><span></span><span></span>';

  typingRow.appendChild(avatar);
  typingRow.appendChild(indicator);
  chatMessages.appendChild(typingRow);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  if (typingRow) { typingRow.remove(); typingRow = null; }
}


/* ═══════════════════════════════════════════════════════════
   11. CHAT LOGIC
═══════════════════════════════════════════════════════════ */
async function handleSend() {
  const msg = chatInput.value.trim();
  if (!msg) return;

  // Stop suggestion typing permanently on first user message
  stopSuggestions();

  chatInput.value = '';
  addMessage('user', msg);
  startThinking();
  showTyping();

  // ── Resume keyword check — handled entirely on frontend ──
  // No backend call needed — just trigger download directly
  const msgLower = msg.toLowerCase();
  const isResumeRequest = RESUME_KEYWORDS.some(kw => msgLower.includes(kw));
  if (isResumeRequest) {
    hideTyping();
    stopThinking();
    addDownloadMessage(
      "Here is Yash Datta Dalvi's resume. Downloading now...",
      RESUME_URL,
      "Yash_Datta_Dalvi_Resume.pdf"
    );
    return;
  }

  try {
    // TEACH flow
    if (pendingTeach && msg.toUpperCase().startsWith('TEACH:')) {
      const userAnswer = msg.slice(6).trim();
      if (userAnswer) {
        const confirmation = await sendTeach(pendingTeach.question, userAnswer);
        hideTyping(); stopThinking();
        addMessage('ai', '✅ ' + confirmation);
      } else {
        hideTyping(); stopThinking();
        addMessage('ai', 'Please provide an answer after TEACH:');
      }
      pendingTeach = null;
      return;
    }

    // Normal chat
    pendingTeach   = null;
    const data     = await sendToBackend(msg);
    hideTyping();
    stopThinking();
    addMessage('ai', data.reply || '(no response)');

    // ── Resume download — backend returns resume_url ──
    // Creates a hidden <a> tag and clicks it to trigger download
    if (data.resume_url) {
      const a = document.createElement('a');
      a.href     = data.resume_url;
      a.download = 'Yash_Datta_Dalvi_Resume.pdf';
      a.target   = '_blank';           // fallback: opens in new tab if download blocked
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    if (data.unknown && data.question) {
      pendingTeach = { question: data.question };
    }

    setStatus('online');

  } catch (err) {
    hideTyping();
    stopThinking();
    setStatus('offline');
    addMessage('ai', '⚠️ Unable to reach Ultron. Check that the server is running and config.js has the correct ngrok URL.');
    console.error('[Ultron]', err);
  }
}

chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSend(); });
sendBtn.addEventListener('click', handleSend);

// ── Voice button — under development ──
document.getElementById('voiceBtn').addEventListener('click', () => {
  addMessage('ai', '🎤 Voice input is currently under development. Please type your message for now.');
});


/* ═══════════════════════════════════════════════════════════
   12. SUGGESTION TYPING SYSTEM
   Mobile:  appears below the orb in a fixed-height bar
   Desktop: overlays the right side of the core (opacity fade)
   Canvas width NEVER changes — orb stays perfectly centered
   Stops when user sends first message
═══════════════════════════════════════════════════════════ */
const SUGGESTIONS = [
  'Who created you?',
  'Who are you?',
  'What can you do?',
  'Tell me about Yash',
  'What is your purpose?'
];

const suggestionPanel = document.getElementById('suggestionPanel');
const suggestionText  = document.getElementById('suggestionText');

let suggestionActive  = true;
let suggestionIndex   = 0;
let typeTimer         = null;

// Show panel — width expands from 0 to 280px (desktop only)
// Canvas shrinks automatically since it uses flex:1
function showPanel() {
  suggestionPanel.classList.remove('hidden');
  suggestionPanel.classList.add('visible');
  // Resize canvas after CSS transition completes (0.5s)
  setTimeout(resizeCanvas, 550);
}

// Hide panel — width collapses to 0, canvas expands back
function hidePanel() {
  suggestionPanel.classList.remove('visible');
  suggestionPanel.classList.add('hidden');
  // Resize canvas after CSS transition so orb fills full width
  setTimeout(resizeCanvas, 550);
}

// Stop permanently when user sends first message
function stopSuggestions() {
  suggestionActive = false;
  clearTimeout(typeTimer);
  hidePanel();
}

// Fade out current text then call callback
function fadeOutSuggestion(cb) {
  suggestionText.classList.add('fading');
  suggestionText.style.transition = 'opacity 0.4s ease';
  suggestionText.style.opacity    = '0';
  typeTimer = setTimeout(() => {
    suggestionText.textContent      = '';
    suggestionText.style.opacity    = '1';
    suggestionText.style.transition = '';
    suggestionText.classList.remove('fading');
    if (cb) cb();
  }, 450);
}

// Type one question character by character
function typeQuestion(question, onDone) {
  let i = 0;
  suggestionText.textContent = '';

  function typeNext() {
    if (!suggestionActive) return;
    if (i < question.length) {
      suggestionText.textContent += question[i];
      i++;
      typeTimer = setTimeout(typeNext, 55);
    } else {
      // Hold for 2.5s then fade out
      typeTimer = setTimeout(() => {
        if (!suggestionActive) return;
        fadeOutSuggestion(onDone);
      }, 2500);
    }
  }
  typeNext();
}

// Cycle through all questions then hide
function runSuggestions() {
  if (!suggestionActive) return;

  if (suggestionIndex >= SUGGESTIONS.length) {
    hidePanel();   // all done — panel fades out, orb stays centered
    return;
  }

  // Show panel on first question
  if (suggestionIndex === 0) showPanel();

  const question = SUGGESTIONS[suggestionIndex];
  suggestionIndex++;

  typeQuestion(question, () => {
    typeTimer = setTimeout(() => {
      if (suggestionActive) runSuggestions();
    }, 500);
  });
}

// Start after 1.5s so orb loads and settles first
typeTimer = setTimeout(runSuggestions, 1500);


/* ═══════════════════════════════════════════════════════════
   13. INIT
═══════════════════════════════════════════════════════════ */
resizeCanvas();
animate(0);
window.addEventListener('resize', resizeCanvas);
