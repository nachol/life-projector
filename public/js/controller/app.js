import { Renderer } from '../engine/renderer.js';
import { Connection, api } from '../core/net.js';
import { normalizeState, defaultState, localized } from '../core/catalog.js';
import { t, lang, setLang, applyI18n } from '../core/i18n.js';
import { AudioAnalyser } from '../core/audio.js';
import { Handles } from './handles.js';
import { renderPanel, fillThumb } from './panels.js';
import { h, toast } from './ui.js';
import { generateThumbs, onThumbs } from './thumbs.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.get('token')) localStorage.setItem('lp.token', params.get('token'));
setLang(lang);
applyI18n();

const app = {
  state: null,
  displays: [],
  displayId: params.get('display') || localStorage.getItem('lp.lastDisplay') || null,
  playlist: null,
  scenes: { presets: [], user: [] },
  media: [],
  info: null,
  tab: localStorage.getItem('lp.tab') || 'scenes',
  sel: { surface: null, mask: null, point: null },
  applyAll: false,
  keepPalette: false,
  effectCat: 'all',
  mic: new AudioAnalyser(),
  dirty: false,
};
window.lpApp = app;

// ---------------------------------------------------------------- preview
const previewCanvas = $('preview');
let renderer = null;
try {
  renderer = new Renderer(previewCanvas, { preview: true, ignoreFlip: true, maxParticles: 60000, maxSize: 1280 });
} catch (e) {
  $('preview-empty').textContent = e.message;
  $('preview-empty').classList.add('show');
}
const handles = new Handles(app, $('handles'));

function currentDisplay() { return app.displays.find((d) => d.id === app.displayId) || null; }

function fitPreview() {
  const d = currentDisplay();
  const ratio = d?.w && d?.h ? d.w / d.h : 16 / 9;
  const outer = $('preview-outer');
  const mobile = innerWidth <= 980;
  const maxW = outer.clientWidth - (innerWidth <= 980 ? 20 : 24); // minus padding
  const maxH = mobile ? innerHeight * (innerHeight > innerWidth ? 0.36 : 0.6) : innerHeight - 190;
  const w = Math.max(120, Math.min(maxW, maxH * ratio));
  const wrap = $('preview-wrap');
  wrap.style.aspectRatio = 'auto';
  wrap.style.width = `${w}px`;
  wrap.style.height = `${w / ratio}px`;
  handles.schedule();
}
addEventListener('resize', fitPreview);

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (renderer && app.state && $('opt-live').checked) renderer.render(dt);
  if (app.mic.active) {
    const v = app.mic.read();
    if (app.state?.audio.mode === 'remote') {
      conn.send({ t: 'audio', displayId: app.displayId, v: v.map((x) => +x.toFixed(3)) });
      renderer?.setRemoteAudio(v);
    }
  }
  if (app.tab === 'audio') {
    const vals = renderer ? renderer.audioValues : [0, 0, 0, 0];
    document.querySelectorAll('[data-meter]').forEach((el) => { el.style.width = `${Math.min(100, vals[el.dataset.meter] * 60)}%`; });
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------- connection
const conn = new Connection(() => ({ role: 'controller' }));
conn.addEventListener('auth-required', () => {
  const tok = prompt(t('token_prompt'));
  if (tok) localStorage.setItem('lp.token', tok);
});
conn.addEventListener('status', (e) => {
  if (e.detail.connected && app.displayId) conn.send({ t: 'subscribe', displayId: app.displayId });
  updatePill();
});

conn.on('displays', (m) => {
  app.displays = m.list;
  if (!app.displayId || !app.displays.some((d) => d.id === app.displayId)) {
    const first = app.displays.find((d) => d.online) || app.displays[0];
    if (first) selectDisplay(first.id);
  }
  updatePill();
  renderDisplays();
  fitPreview();
});

conn.on('stats', (m) => {
  const d = app.displays.find((x) => x.id === m.displayId);
  if (d) {
    const resized = d.w !== m.w || d.h !== m.h;
    Object.assign(d, { fps: m.fps, w: m.w, h: m.h, online: true });
    if (m.displayId === app.displayId) { updatePill(); if (resized) fitPreview(); }
  }
});

conn.on('state', (m) => {
  if (m.displayId !== app.displayId) return;
  if (!m.state) {
    // Brand-new display without state: seed it.
    app.state = normalizeState(defaultState());
    sendState(true);
  } else {
    if (handles.drag) return; // don't fight the user's finger
    app.state = normalizeState(m.state);
  }
  fixSelection();
  renderer?.setState(app.state);
  $('master').value = app.state.master.brightness;
  $('btn-blackout').classList.toggle('active', !!app.state.master.blackout);
  renderPanels();
  handles.schedule();
});

conn.on('playlist', (m) => {
  if (m.displayId !== app.displayId) return;
  app.playlist = m.playlist;
  if (app.tab === 'playlist') renderPanels();
});

conn.on('error', (m) => toast(`${t('error')}: ${m.message}`));

function selectDisplay(id) {
  app.displayId = id;
  localStorage.setItem('lp.lastDisplay', id);
  app.state = null;
  app.sel = { surface: null, mask: null, point: null };
  conn.send({ t: 'subscribe', displayId: id });
  updatePill();
  fitPreview();
  renderPanels();
}

// ---------------------------------------------------------------- state changes
let sendTimer = null;
function sendState(now = false) {
  if (!app.state || !app.displayId) return;
  const go = () => {
    sendTimer = null;
    conn.send({ t: 'state', displayId: app.displayId, state: app.state });
  };
  if (now) { clearTimeout(sendTimer); go(); return; }
  if (!sendTimer) sendTimer = setTimeout(go, 33);
}

app.commit = (fn, { panels = true, send = true } = {}) => {
  if (!app.state) return;
  fn(app.state);
  renderer?.setState(app.state);
  if (send) sendState();
  if (panels) renderPanels();
  handles.schedule();
  sendGuides();
};

app.select = (patch, { quiet = false } = {}) => {
  Object.assign(app.sel, patch);
  if (!quiet) renderPanels();
  handles.schedule();
  updateNudge();
  sendGuides();
};

app.handleMode = () => {
  if (app.tab === 'masks') return 'masks';
  if (app.tab === 'optics') return 'keystone';
  return 'surfaces';
};

function fixSelection() {
  const st = app.state;
  if (!st) return;
  if (!st.surfaces.some((s) => s.id === app.sel.surface)) app.sel.surface = st.surfaces[0]?.id || null;
  if (!st.masks.some((m) => m.id === app.sel.mask)) app.sel.mask = st.masks[0]?.id || null;
}

app.applyScene = (sceneId, mode) => {
  const ids = app.applyAll ? app.displays.filter((d) => d.online).map((d) => d.id) : [app.displayId];
  if (!ids.includes(app.displayId)) ids.push(app.displayId);
  conn.send({ t: 'apply-scene', displayIds: ids, sceneId, mode });
};

app.savePlaylist = (pl) => {
  app.playlist = pl;
  conn.send({ t: 'playlist', displayId: app.displayId, playlist: pl });
};

app.refreshScenes = async () => {
  try { app.scenes = await api('/api/scenes'); } catch (e) { console.warn(e); }
  renderPanels();
};
app.refreshMedia = async () => {
  try { app.media = await api('/api/media'); } catch (e) { console.warn(e); }
};

app.startMic = async () => {
  try {
    await app.mic.start();
    toast('🎤 OK');
  } catch (e) {
    toast(`${t('error')}: ${e.message}`, 4000);
  }
  renderPanels();
};
app.stopMic = () => { if (app.mic.active) { app.mic.stop(); renderPanels(); } };

function renderPanels() {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === app.tab));
  const body = $('tab-body');
  const scroll = body.scrollTop;
  renderPanel(app, body);
  body.scrollTop = scroll;
  updateNudge();
}
app.renderPanels = renderPanels;

// ---------------------------------------------------------------- guides on the real display
let guidesOn = false;
function sendGuides() {
  if (!app.displayId) return;
  const want = $('opt-guides').checked && ['surfaces', 'effect', 'masks', 'optics'].includes(app.tab);
  if (!want && !guidesOn) return;
  guidesOn = want;
  const mode = app.handleMode();
  conn.send({
    t: 'cmd', displayId: app.displayId, cmd: 'guides',
    value: want ? { mode: mode === 'keystone' ? 'keystone' : mode, selected: mode === 'masks' ? app.sel.mask : app.sel.surface, point: app.sel.point?.idx ?? -1 } : null,
  });
}
$('opt-guides').addEventListener('change', sendGuides);
$('opt-live').addEventListener('change', () => {
  if (!$('opt-live').checked && renderer) {
    const gl = renderer.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0.02, 0.02, 0.03, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
});

// ---------------------------------------------------------------- top bar / tabs
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
  app.tab = b.dataset.tab;
  localStorage.setItem('lp.tab', app.tab);
  app.sel.point = null;
  renderPanels();
  handles.schedule();
  sendGuides();
}));

$('master').addEventListener('input', (e) => app.commit((s) => { s.master.brightness = parseFloat(e.target.value); }, { panels: false }));
$('btn-blackout').addEventListener('click', () => {
  app.commit((s) => { s.master.blackout = !s.master.blackout; }, { panels: false });
  $('btn-blackout').classList.toggle('active', !!app.state?.master.blackout);
});
$('btn-blackout').classList.add('danger');
$('btn-lang').textContent = lang.toUpperCase();
$('btn-lang').addEventListener('click', () => {
  setLang(lang === 'es' ? 'en' : 'es');
  location.reload();
});

function updatePill() {
  const d = currentDisplay();
  $('display-name').textContent = d ? d.name : (conn.connected ? t('select_display') : t('connecting'));
  $('display-dot').classList.toggle('on', !!d?.online);
  $('display-fps').textContent = d?.online && d.fps ? `${d.fps} fps` : '';
  const empty = $('preview-empty');
  if (!app.displays.length) {
    empty.textContent = `${t('no_displays')} ${t('no_displays_help', { url: `${location.origin}/display` })}`;
    empty.classList.add('show');
  } else empty.classList.remove('show');
}

function updateNudge() {
  $('nudge').hidden = !app.sel.point;
}
$('nudge').addEventListener('click', (e) => {
  const v = e.target.dataset.nudge;
  if (!v) return;
  const [dx, dy] = v.split(',').map(Number);
  const d = currentDisplay();
  handles.nudge(dx, dy, d?.w, d?.h);
});
addEventListener('keydown', (e) => {
  if (!app.sel.point || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const m = map[e.key];
  if (!m) return;
  e.preventDefault();
  const k = e.shiftKey ? 10 : 1;
  const d = currentDisplay();
  handles.nudge(m[0] * k, m[1] * k, d?.w, d?.h);
});

// ---------------------------------------------------------------- displays dialog
const dialog = $('displays-dialog');
$('display-pill').addEventListener('click', () => { renderDisplays(); dialog.showModal(); });

function renderDisplays() {
  const list = $('displays-list');
  list.replaceChildren();
  if (!app.displays.length) list.append(h('p', { class: 'muted' }, t('no_displays')));
  for (const d of app.displays) {
    const active = d.id === app.displayId;
    list.append(h('div', { class: `item${active ? ' active' : ''}` },
      h('span', { class: `dot${d.online ? ' on' : ''}` }),
      h('span', { class: 'name', onclick: () => { selectDisplay(d.id); dialog.close(); } },
        d.name, h('div', { class: 'meta' },
          [d.online ? t('online') : t('offline'), d.w ? `${d.w}×${d.h}` : '', d.fps ? `${d.fps} fps` : '', localized(d.sceneName, lang), d.playlist ? '⟳' : ''].filter(Boolean).join(' · '))),
      h('button', { type: 'button', class: 'mini', title: t('identify'), onclick: () => conn.send({ t: 'cmd', displayId: d.id, cmd: 'identify' }) }, '◎'),
      h('button', {
        type: 'button', class: 'mini', title: t('rename'), onclick: () => {
          const name = prompt(t('rename_display'), d.name);
          if (name) conn.send({ t: 'rename', displayId: d.id, name });
        },
      }, '✎'),
      h('button', { type: 'button', class: 'mini', title: 'Reload', onclick: () => conn.send({ t: 'cmd', displayId: d.id, cmd: 'reload' }) }, '↻'),
      !d.online ? h('button', {
        type: 'button', class: 'mini', title: t('forget'), onclick: () => { if (confirm(`${t('forget')} ${d.name}?`)) conn.send({ t: 'forget', displayId: d.id }); },
      }, '🗑') : null,
    ));
  }
  const url = `${location.origin}/display`;
  $('displays-help').textContent = t('no_displays_help', { url });
  $('share-url').textContent = location.origin + '/';
  $('share-qr').src = `/api/qr?text=${encodeURIComponent(location.origin + '/')}`;
}

function displayUrl(id, name) {
  const u = new URL('/display', location.origin);
  u.searchParams.set('id', id);
  if (name) u.searchParams.set('name', name);
  return u.toString();
}

$('btn-open-here').addEventListener('click', () => {
  window.open(displayUrl(`local-${Math.random().toString(36).slice(2, 7)}`), '_blank');
});

$('btn-second').addEventListener('click', async () => {
  const url = displayUrl(`screen-${Math.random().toString(36).slice(2, 7)}`, 'Segunda pantalla');
  // Window Management API (Chrome): open directly on another monitor / projector.
  if ('getScreenDetails' in window) {
    try {
      const details = await window.getScreenDetails();
      const other = details.screens.find((s) => s !== details.currentScreen) || details.currentScreen;
      window.open(url, '_blank', `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`);
      toast(lang === 'es' ? 'Haz clic en la nueva ventana y pulsa F para pantalla completa' : 'Click the new window and press F for fullscreen', 4000);
      return;
    } catch (e) { console.warn(e); }
  }
  window.open(url, '_blank', 'popup,width=1280,height=720');
});

$('btn-cast').addEventListener('click', async () => {
  // Presentation API: Chrome shows the Cast dialog (Chromecast / Google TV) and wired displays.
  if (!('PresentationRequest' in window)) {
    toast(lang === 'es' ? 'Tu navegador no soporta Cast. Usa Chrome, o abre /display en la TV.' : 'Your browser does not support Cast. Use Chrome, or open /display on the TV.', 4500);
    return;
  }
  try {
    const req = new PresentationRequest([displayUrl(`cast-${Math.random().toString(36).slice(2, 7)}`, 'Cast')]);
    await req.start();
  } catch (e) {
    if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') toast(`${t('error')}: ${e.message}`, 4000);
  }
});
if (!('PresentationRequest' in window)) $('btn-cast').title = 'Chrome only';

// ---------------------------------------------------------------- boot
(async () => {
  try { app.info = await api('/api/info'); } catch {}
  await Promise.all([app.refreshScenes(), app.refreshMedia()]);
  fitPreview();
  renderPanels();
  generateThumbs();
  onThumbs((key) => fillThumb(key));
})();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
