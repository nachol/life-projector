import { Renderer } from '../engine/renderer.js';
import { Connection } from '../core/net.js';
import { defaultState, normalizeState } from '../core/catalog.js';
import { squareToQuad, apply as applyH } from '../core/homography.js';
import { AudioAnalyser } from '../core/audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function guessName() {
  const ua = navigator.userAgent;
  if (/Android TV|AFT|BRAVIA|GoogleTV|Chromecast|SMART-TV|SmartTV|Tizen|Web0S/i.test(ua)) return 'TV';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Mac OS/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Display';
}

function storedId() {
  const q = params.get('id');
  if (q && /^[a-zA-Z0-9_-]{1,80}$/.test(q)) return q;
  let id = localStorage.getItem('lp.displayId');
  if (!id) {
    id = `d-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
    localStorage.setItem('lp.displayId', id);
  }
  return id;
}

const displayId = storedId();
let displayName = params.get('name') || localStorage.getItem('lp.displayName') || `${guessName()} ${displayId.slice(-4).toUpperCase()}`;
const tokenParam = params.get('token');
if (tokenParam) localStorage.setItem('lp.token', tokenParam);

const canvas = $('gl');
let renderer;
try {
  renderer = new Renderer(canvas, { onContextRestored: () => location.reload() });
} catch (e) {
  $('error').style.display = 'grid';
  $('error').textContent = e.message;
  throw e;
}

let state = normalizeState(defaultState());
renderer.setState(state);

// ---------- info overlay ----------
const controllerUrl = `${location.origin}/`;
$('info-name').textContent = displayName;
$('info-url').textContent = controllerUrl;
$('qr').src = `/api/qr?text=${encodeURIComponent(controllerUrl + '?display=' + displayId)}`;
let infoTimer = null;
function showInfo(ms = 0) {
  $('info').classList.remove('hidden');
  clearTimeout(infoTimer);
  if (ms) infoTimer = setTimeout(() => $('info').classList.add('hidden'), ms);
}
function toggleInfo() {
  if ($('info').classList.contains('hidden')) showInfo(15000);
  else $('info').classList.add('hidden');
}
showInfo(10000);

// ---------- connection ----------
const conn = new Connection(() => ({
  role: 'display', id: displayId, name: displayName,
  w: Math.round(innerWidth * devicePixelRatio), h: Math.round(innerHeight * devicePixelRatio),
  ua: navigator.userAgent,
}));

conn.addEventListener('status', (e) => {
  $('status').textContent = e.detail.connected ? '' : 'Reconectando… / Reconnecting…';
  if (!e.detail.connected) showInfo();
});

conn.on('welcome', (m) => {
  if (m.name) setName(m.name);
});

conn.on('state', (m) => {
  if (!m.state) {
    conn.send({ t: 'init-state', state });
    return;
  }
  state = normalizeState(m.state);
  renderer.setState(state);
  updateAudioSource();
  $('fps').style.display = state.output.showFps ? 'block' : 'none';
});

conn.on('audio', (m) => renderer.setRemoteAudio(m.v));

let guides = null;
let guidesTimer = null;
conn.on('cmd', (m) => {
  switch (m.cmd) {
    case 'identify': identify(); break;
    case 'reload': location.reload(); break;
    case 'rename': setName(m.value); break;
    case 'info': showInfo(15000); break;
    case 'guides':
      guides = m.value || null;
      clearTimeout(guidesTimer);
      if (guides) guidesTimer = setTimeout(() => { guides = null; }, 10 * 60 * 1000);
      break;
  }
});

function setName(n) {
  displayName = String(n);
  localStorage.setItem('lp.displayName', displayName);
  $('info-name').textContent = displayName;
}

function identify() {
  const el = $('identify');
  el.textContent = displayName;
  el.style.display = 'grid';
  clearTimeout(identify.t);
  identify.t = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ---------- display-side microphone ----------
const mic = new AudioAnalyser();
async function updateAudioSource() {
  const want = state.audio?.mode === 'mic';
  if (want && !mic.active) {
    try { await mic.start(); } catch (e) { console.warn('mic unavailable', e.message); }
  } else if (!want && mic.active) mic.stop();
}

// ---------- guides overlay (calibration) ----------
const ov = $('overlay');
const octx = ov.getContext('2d');
function drawGuides() {
  const w = ov.clientWidth, h = ov.clientHeight;
  if (ov.width !== w || ov.height !== h) { ov.width = w; ov.height = h; }
  octx.clearRect(0, 0, w, h);
  if (!guides) return;
  const out = state.output;
  const K = squareToQuad(out.keystone);
  const toScreen = ([x, y], keystone = true) => {
    let p = keystone ? applyH(K, [x, y]) : [x, y];
    if (out.flipX) p = [1 - p[0], p[1]];
    if (out.flipY) p = [p[0], 1 - p[1]];
    return [p[0] * w, p[1] * h];
  };
  const poly = (pts, color, width, keystone, dash = []) => {
    octx.beginPath();
    pts.forEach((p, i) => { const [x, y] = toScreen(p, keystone); i ? octx.lineTo(x, y) : octx.moveTo(x, y); });
    octx.closePath();
    octx.setLineDash(dash);
    octx.strokeStyle = color;
    octx.lineWidth = width;
    octx.stroke();
    octx.setLineDash([]);
  };
  const dot = (p, color, r, keystone, label) => {
    const [x, y] = toScreen(p, keystone);
    octx.beginPath(); octx.arc(x, y, r, 0, Math.PI * 2);
    octx.fillStyle = color; octx.fill();
    octx.lineWidth = 2; octx.strokeStyle = '#000'; octx.stroke();
    if (label) { octx.fillStyle = '#fff'; octx.font = 'bold 16px system-ui'; octx.fillText(label, x + r + 4, y - r - 2); }
  };
  if (guides.mode === 'keystone') {
    poly([[0, 0], [1, 0], [1, 1], [0, 1]], '#ffcc00', 4, true);
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach((p, i) => dot(p, i === guides.point ? '#fff' : '#ffcc00', 12, true));
  } else if (guides.mode === 'surfaces') {
    state.surfaces.forEach((s, i) => {
      const sel = s.id === guides.selected;
      poly(s.corners, sel ? '#00e5ff' : 'rgba(255,255,255,.5)', sel ? 4 : 2, true, sel ? [] : [10, 8]);
      if (sel) s.corners.forEach((c, k) => dot(c, k === guides.point ? '#fff' : '#00e5ff', 11, true));
      const [cx, cy] = toScreen([s.corners.reduce((a, c) => a + c[0], 0) / 4, s.corners.reduce((a, c) => a + c[1], 0) / 4]);
      octx.fillStyle = sel ? '#00e5ff' : 'rgba(255,255,255,.7)';
      octx.font = 'bold 22px system-ui';
      octx.textAlign = 'center';
      octx.fillText(`${i + 1}. ${s.name}`, cx, cy);
      octx.textAlign = 'start';
    });
  } else if (guides.mode === 'masks') {
    state.masks.forEach((m) => {
      const sel = m.id === guides.selected;
      poly(m.points, sel ? '#ff2a6d' : 'rgba(255,42,109,.5)', sel ? 4 : 2, false, m.mode === 'include' ? [12, 6] : []);
      if (sel) m.points.forEach((p, k) => dot(p, k === guides.point ? '#fff' : '#ff2a6d', 9, false));
    });
  }
}

// ---------- loop ----------
let last = performance.now();
let statsAt = 0;
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (mic.active) renderer.setRemoteAudio(mic.read());
  renderer.render(dt);
  drawGuides();
  if (state.output.showFps) $('fps').textContent = `${Math.round(renderer.fps)} fps · ${Math.round(renderer.effectiveScale * 100)}%`;
  if (now - statsAt > 2000) {
    statsAt = now;
    conn.send({ t: 'stats', fps: renderer.fps, w: canvas.width, h: canvas.height, renderScale: renderer.effectiveScale });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- fullscreen, wake lock, cursor ----------
async function goFullscreen() {
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch {}
}
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', keepAwake);
keepAwake();

document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') goFullscreen();
  else if (e.key === 'i' || e.key === 'I' || e.key === 'Enter' || e.key === 'MediaPlayPause') toggleInfo();
  else if (e.key === 'r' || e.key === 'R') location.reload();
});
document.addEventListener('click', () => { goFullscreen(); toggleInfo(); keepAwake(); });

let cursorTimer;
document.addEventListener('mousemove', () => {
  document.body.classList.remove('hide-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 2000);
});
document.body.classList.add('hide-cursor');

// Expose for debugging / automated tests.
window.lp = { renderer, conn, get state() { return state; } };
