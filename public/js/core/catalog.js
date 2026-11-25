// Catalog of effects, particle systems and palettes (metadata only, no GLSL).
// Shared by the controller UI, the display engine and the Node server.

export const PALETTES = {
  aurora:    { name: { es: 'Aurora boreal', en: 'Northern lights' }, colors: ['#00ffa3', '#00b3ff', '#7a2bff'] },
  sunset:    { name: { es: 'Atardecer', en: 'Sunset' }, colors: ['#ff4e50', '#f9d423', '#8e2de2'] },
  ocean:     { name: { es: 'Océano', en: 'Ocean' }, colors: ['#001f54', '#0a9396', '#94d2bd'] },
  fire:      { name: { es: 'Fuego', en: 'Fire' }, colors: ['#5c0a00', '#ff5a00', '#ffe08a'] },
  forest:    { name: { es: 'Bosque', en: 'Forest' }, colors: ['#0b3d20', '#5bd16b', '#e8f77a'] },
  neon:      { name: { es: 'Neón', en: 'Neon' }, colors: ['#ff00c8', '#00f0ff', '#faff00'] },
  cyberpunk: { name: { es: 'Cyberpunk', en: 'Cyberpunk' }, colors: ['#2b0057', '#ff2a6d', '#05d9e8'] },
  pastel:    { name: { es: 'Pastel', en: 'Pastel' }, colors: ['#ffc8dd', '#bde0fe', '#cdb4db'] },
  lava:      { name: { es: 'Lava', en: 'Lava' }, colors: ['#1a0000', '#c1121f', '#ffb703'] },
  ice:       { name: { es: 'Hielo', en: 'Ice' }, colors: ['#03045e', '#48cae4', '#ffffff'] },
  gold:      { name: { es: 'Oro', en: 'Gold' }, colors: ['#3d2b00', '#d4a017', '#fff4c2'] },
  mono:      { name: { es: 'Blanco', en: 'White' }, colors: ['#202020', '#9a9a9a', '#ffffff'] },
};

const P = (label, def = 0.5, min = 0, max = 1, step = 0.01) => ({ label, def, min, max, step });

// category: ambient | party | nature | geometric | utility
export const EFFECTS = {
  none:        { name: { es: 'Ninguno', en: 'None' }, category: 'utility', palette: 'mono' },
  aurora:      { name: { es: 'Aurora', en: 'Aurora' }, category: 'nature', palette: 'aurora',
                 p1: P({ es: 'Capas', en: 'Layers' }, 0.6), p2: P({ es: 'Nitidez', en: 'Sharpness' }, 0.4) },
  nebula:      { name: { es: 'Nebulosa', en: 'Nebula' }, category: 'ambient', palette: 'cyberpunk',
                 p1: P({ es: 'Turbulencia', en: 'Turbulence' }, 0.5), p2: P({ es: 'Estrellas', en: 'Stars' }, 0.5) },
  liquid:      { name: { es: 'Líquido', en: 'Liquid' }, category: 'ambient', palette: 'sunset',
                 p1: P({ es: 'Distorsión', en: 'Warp' }, 0.5), p2: P({ es: 'Variación', en: 'Variation' }, 0.3) },
  plasma:      { name: { es: 'Plasma', en: 'Plasma' }, category: 'party', palette: 'neon',
                 p1: P({ es: 'Ondas', en: 'Ripples' }, 0.3), p2: P({ es: 'Contraste', en: 'Contrast' }, 0.5) },
  fire:        { name: { es: 'Fuego', en: 'Fire' }, category: 'nature', palette: 'fire',
                 p1: P({ es: 'Altura', en: 'Height' }, 0.4), p2: P({ es: 'Suavidad', en: 'Softness' }, 0.3) },
  caustics:    { name: { es: 'Agua / cáusticas', en: 'Water caustics' }, category: 'nature', palette: 'ocean',
                 p1: P({ es: 'Brillo de luz', en: 'Light strength' }, 0.5), p2: P({ es: 'Profundidad', en: 'Depth' }, 0.5) },
  clouds:      { name: { es: 'Nubes / humo', en: 'Clouds / smoke' }, category: 'nature', palette: 'pastel',
                 p1: P({ es: 'Turbulencia', en: 'Turbulence' }, 0.4), p2: P({ es: 'Densidad', en: 'Density' }, 0.5) },
  tunnel:      { name: { es: 'Túnel', en: 'Tunnel' }, category: 'party', palette: 'cyberpunk',
                 p1: P({ es: 'Anillos', en: 'Rings' }, 0.3), p2: P({ es: 'Rayos', en: 'Spokes' }, 0.4) },
  kaleidoscope:{ name: { es: 'Caleidoscopio', en: 'Kaleidoscope' }, category: 'geometric', palette: 'neon',
                 p1: P({ es: 'Segmentos', en: 'Segments' }, 0.4), p2: P({ es: 'Detalle', en: 'Detail' }, 0.5) },
  mandala:     { name: { es: 'Espiral mandala', en: 'Mandala spiral' }, category: 'geometric', palette: 'gold',
                 p1: P({ es: 'Brazos', en: 'Arms' }, 0.3), p2: P({ es: 'Torsión', en: 'Twist' }, 0.4) },
  starwarp:    { name: { es: 'Hiperespacio', en: 'Star warp' }, category: 'party', palette: 'ice',
                 p1: P({ es: 'Velocidad', en: 'Velocity' }, 0.4), p2: P({ es: 'Densidad', en: 'Density' }, 0.5) },
  voronoi:     { name: { es: 'Cristales', en: 'Crystals' }, category: 'geometric', palette: 'ice',
                 p1: P({ es: 'Grosor borde', en: 'Edge width' }, 0.3), p2: P({ es: 'Parpadeo', en: 'Flicker' }, 0.4) },
  hexgrid:     { name: { es: 'Panal hexagonal', en: 'Hex pulse' }, category: 'geometric', palette: 'cyberpunk',
                 p1: P({ es: 'Aleatoriedad', en: 'Randomness' }, 0.3), p2: P({ es: 'Relleno', en: 'Fill' }, 0.5) },
  waves:       { name: { es: 'Ondas de luz', en: 'Light waves' }, category: 'party', palette: 'neon',
                 p1: P({ es: 'Turbulencia', en: 'Turbulence' }, 0.3), p2: P({ es: 'Grosor', en: 'Thickness' }, 0.4) },
  metaballs:   { name: { es: 'Lámpara de lava', en: 'Lava lamp' }, category: 'ambient', palette: 'lava',
                 p1: P({ es: 'Tamaño', en: 'Size' }, 0.4), p2: P({ es: 'Suavidad', en: 'Softness' }, 0.3) },
  matrix:      { name: { es: 'Lluvia digital', en: 'Digital rain' }, category: 'party', palette: 'forest',
                 p1: P({ es: 'Columnas', en: 'Columns' }, 0.5), p2: P({ es: 'Estela', en: 'Trail' }, 0.4) },
  gradient:    { name: { es: 'Degradado ambiente', en: 'Ambient gradient' }, category: 'ambient', palette: 'sunset',
                 p1: P({ es: 'Frecuencia', en: 'Frequency' }, 0.4), p2: P({ es: '—', en: '—' }, 0) },
  solid:       { name: { es: 'Color sólido', en: 'Solid color' }, category: 'utility', palette: 'sunset' },
  testgrid:    { name: { es: 'Patrón: grilla', en: 'Pattern: grid' }, category: 'utility', palette: 'mono',
                 p1: P({ es: 'Divisiones', en: 'Divisions' }, 0.3) },
  testbars:    { name: { es: 'Patrón: barras', en: 'Pattern: bars' }, category: 'utility', palette: 'mono' },
  media:       { name: { es: 'Imagen / video', en: 'Image / video' }, category: 'utility', palette: 'mono' },
};

export const PARTICLES = {
  none:      { name: { es: 'Sin partículas', en: 'No particles' } },
  flow:      { name: { es: 'Campo de flujo', en: 'Flow field' }, count: 60000, size: 0.35, trails: 0.85,
               p1: P({ es: 'Escala ruido', en: 'Noise scale' }, 0.4), p2: P({ es: 'Turbulencia', en: 'Turbulence' }, 0.5) },
  galaxy:    { name: { es: 'Galaxia', en: 'Galaxy' }, count: 80000, size: 0.3, trails: 0.5,
               p1: P({ es: 'Brazos', en: 'Arms' }, 0.3), p2: P({ es: 'Inclinación', en: 'Tilt' }, 0.5) },
  fireflies: { name: { es: 'Luciérnagas', en: 'Fireflies' }, count: 400, size: 0.8, trails: 0.3,
               p1: P({ es: 'Deambular', en: 'Wander' }, 0.5), p2: P({ es: 'Parpadeo', en: 'Blink' }, 0.5) },
  snow:      { name: { es: 'Nieve', en: 'Snow' }, count: 4000, size: 0.6, trails: 0,
               p1: P({ es: 'Viento', en: 'Wind' }, 0.5), p2: P({ es: 'Balanceo', en: 'Sway' }, 0.5) },
  embers:    { name: { es: 'Brasas', en: 'Embers' }, count: 6000, size: 0.45, trails: 0.6,
               p1: P({ es: 'Turbulencia', en: 'Turbulence' }, 0.5), p2: P({ es: 'Ancho', en: 'Spread' }, 0.6) },
  rain:      { name: { es: 'Lluvia', en: 'Rain' }, count: 5000, size: 0.3, trails: 0.75,
               p1: P({ es: 'Viento', en: 'Wind' }, 0.5), p2: P({ es: 'Intensidad', en: 'Heaviness' }, 0.5) },
  attractor: { name: { es: 'Atractor extraño', en: 'Strange attractor' }, count: 120000, size: 0.2, trails: 0.6,
               p1: P({ es: 'Zoom', en: 'Zoom' }, 0.5), p2: P({ es: 'Rotación', en: 'Rotation' }, 0.4) },
  vortex:    { name: { es: 'Vórtice', en: 'Vortex' }, count: 50000, size: 0.3, trails: 0.8,
               p1: P({ es: 'Succión', en: 'Pull' }, 0.4), p2: P({ es: 'Giro', en: 'Swirl' }, 0.6) },
  fountain:  { name: { es: 'Fuente', en: 'Fountain' }, count: 20000, size: 0.4, trails: 0.7,
               p1: P({ es: 'Apertura', en: 'Spread' }, 0.4), p2: P({ es: 'Gravedad', en: 'Gravity' }, 0.5) },
  bokeh:     { name: { es: 'Bokeh', en: 'Bokeh' }, count: 120, size: 1, trails: 0,
               p1: P({ es: 'Deriva', en: 'Drift' }, 0.4), p2: P({ es: 'Desenfoque', en: 'Blur' }, 0.6) },
};

export const PARTICLE_MODE_INDEX = Object.fromEntries(Object.keys(PARTICLES).map((k, i) => [k, i - 1]));

export const EFFECT_PARAMS = ['speed', 'intensity', 'scale', 'hue', 'p1', 'p2', 'audio'];

let idCounter = 0;
export function uid(prefix = 'id') {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${idCounter.toString(36)}`;
}

export function defaultEffectParams(effectId = 'aurora') {
  const fx = EFFECTS[effectId] || EFFECTS.aurora;
  return {
    speed: 0.5, intensity: 1, scale: 1, hue: 0, audio: 0.5,
    p1: fx.p1 ? fx.p1.def : 0.5,
    p2: fx.p2 ? fx.p2.def : 0.5,
    colors: [...(PALETTES[fx.palette] || PALETTES.aurora).colors],
  };
}

export function defaultParticles(mode = 'none') {
  const pm = PARTICLES[mode] || PARTICLES.none;
  return {
    mode,
    count: pm.count || 20000,
    size: pm.size ?? 0.4,
    speed: 0.5,
    trails: pm.trails ?? 0.6,
    p1: pm.p1 ? pm.p1.def : 0.5,
    p2: pm.p2 ? pm.p2.def : 0.5,
    colors: null, // null = follow the surface palette
  };
}

// ---------- Photo frames & artistic styles (for the media effect) ----------
export const FRAME_STYLES = {
  none:     { name: { es: 'Sin marco', en: 'No frame' } },
  wood:     { name: { es: 'Madera', en: 'Wood' }, color: '#8a5a2b', width: 0.07, mat: 0.05 },
  gold:     { name: { es: 'Dorado clásico', en: 'Classic gold' }, color: '#c9a227', width: 0.09, mat: 0.06 },
  gallery:  { name: { es: 'Galería (fino)', en: 'Gallery (thin)' }, color: '#1a1a1a', width: 0.025, mat: 0.12 },
  canvas:   { name: { es: 'Bastidor / lienzo', en: 'Stretched canvas' }, color: '#000000', width: 0.05, mat: 0 },
  polaroid: { name: { es: 'Polaroid', en: 'Polaroid' }, color: '#f4f2ec', width: 0.06, mat: 0 },
};
export const FRAME_STYLE_INDEX = Object.fromEntries(Object.keys(FRAME_STYLES).map((k, i) => [k, i]));

export const ART_STYLES = {
  none:        { name: { es: 'Foto original', en: 'Original photo' } },
  oil:         { name: { es: 'Óleo', en: 'Oil painting' } },
  watercolor:  { name: { es: 'Acuarela', en: 'Watercolour' } },
  sketch:      { name: { es: 'Lápiz', en: 'Pencil sketch' } },
  pointillism: { name: { es: 'Puntillismo', en: 'Pointillism' } },
};
export const ART_STYLE_INDEX = Object.fromEntries(Object.keys(ART_STYLES).map((k, i) => [k, i]));

export function defaultMedia() {
  return {
    url: '', type: '', fit: 'cover', loop: true, muted: true,
    frame: { style: 'none', width: 0.07, color: '#8a5a2b', mat: 0.05, matColor: '#eeeae0' },
    art: { style: 'none', amount: 0.6, paint: false, paintSeconds: 20, paintLoop: false, paintRun: 0 },
    gallery: defaultGallery(),
  };
}

export const GALLERY_TRANSITIONS = {
  fade:  { name: { es: 'Fundido', en: 'Crossfade' } },
  paint: { name: { es: 'Pinceladas', en: 'Brush strokes' } },
  cut:   { name: { es: 'Corte', en: 'Cut' } },
};
export const GALLERY_MAX_ITEMS = 200;
const isVideoUrl = (u) => /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(u);

export function defaultGallery() {
  // startedAt is a wall-clock timestamp (ms): every display and the preview compute the
  // same photo from it, so projectors don't drift apart.
  return { enabled: false, items: [], seconds: 10, transition: 'fade', transitionSeconds: 1.5, kenBurns: 0.5, shuffle: false, seed: 1, startedAt: 0 };
}

function normalizeGallery(g) {
  const d = defaultGallery();
  const src = g && typeof g === 'object' ? g : {};
  const num = (v, def, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : def);
  const out = { ...d, ...src };
  out.enabled = !!src.enabled;
  // Images only: a preloaded "next" video would autoplay hidden.
  out.items = (Array.isArray(src.items) ? src.items : [])
    .filter((it) => it && typeof it.url === 'string' && it.url && !isVideoUrl(it.url) && it.type !== 'video')
    .slice(0, GALLERY_MAX_ITEMS)
    .map((it) => ({ url: it.url, type: 'image' }));
  out.seconds = num(src.seconds, d.seconds, 2, 3600);
  out.transitionSeconds = num(src.transitionSeconds, d.transitionSeconds, 0, out.seconds * 0.6);
  out.kenBurns = num(src.kenBurns, d.kenBurns, 0, 1);
  out.seed = Math.floor(num(src.seed, d.seed, 0, 2 ** 31));
  out.startedAt = num(src.startedAt, 0, 0, 1e15);
  out.shuffle = !!src.shuffle;
  if (!GALLERY_TRANSITIONS[out.transition]) out.transition = 'fade';
  return out;
}

// ---------- slideshow schedule (pure; shared by the preview and every display) ----------
function hash01(a) {
  a = (a | 0) + 0x6d2b79f5 | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function permutation(cycle, n, seed) {
  const keys = Array.from({ length: n }, (_, i) => [hash01(Math.imul(seed, 73856093) ^ Math.imul(cycle, 19349663) ^ Math.imul(i + 1, 83492791)), i]);
  keys.sort((a, b) => a[0] - b[0]);
  return keys.map((k) => k[1]);
}
function shuffledIndex(k, n, seed) {
  if (n <= 2) return k % n; // nothing meaningful to shuffle
  const c = Math.floor(k / n), r = k - c * n;
  const p = permutation(c, n, seed);
  // Never show the same photo twice in a row across a cycle boundary.
  if (c > 0 && p[0] === permutation(c - 1, n, seed)[n - 1]) [p[0], p[1]] = [p[1], p[0]];
  return p[r];
}

/**
 * Which photos are on screen `elapsed` seconds after the gallery started.
 * Slot k shows photo order(k); during its last `trans` seconds it blends into order(k+1).
 * A photo's Ken Burns progress runs from the moment it starts fading in, so it is the same
 * value just before and just after a slot boundary (no jump when "next" becomes "current").
 */
export function gallerySchedule(elapsed, n, seconds, trans, shuffle = false, seed = 1) {
  if (!(n > 0)) return null;
  const S = Math.max(0.1, seconds);
  const T = Math.max(0, Math.min(trans, S * 0.9));
  const e = Math.max(0, elapsed);
  const slot = Math.floor(e / S);
  const t = e - slot * S;
  const idx = (k) => (shuffle ? shuffledIndex(k, n, seed) : k % n);
  const prog = (k) => Math.min(1, Math.max(0, (e - (k * S - T)) / (S + T)));
  const mix = T > 0 ? Math.min(1, Math.max(0, (t - (S - T)) / T)) : 0;
  return { cur: idx(slot), next: idx(slot + 1), mix, curSlot: slot, nextSlot: slot + 1, curProgress: prog(slot), nextProgress: prog(slot + 1) };
}

/** Ken Burns zoom / pan for one slide: zoom in only, pan bounded so the photo never leaves its box. */
export function kenBurns(slot, progress, amount, seed = 1) {
  const zoom = 1 + 0.18 * Math.max(0, Math.min(1, amount)) * progress;
  const a = hash01(Math.imul(slot + 1, 2654435761) ^ seed) * Math.PI * 2;
  const maxOff = (1 - 1 / zoom) / 2;
  return [zoom, Math.cos(a) * maxOff, Math.sin(a) * maxOff];
}

/** Fill in fields added after a state / scene was saved. */
export function normalizeMedia(m) {
  const d = defaultMedia();
  const src = m && typeof m === 'object' ? m : {};
  const out = { ...d, ...src, frame: { ...d.frame, ...(src.frame || {}) }, art: { ...d.art, ...(src.art || {}) }, gallery: normalizeGallery(src.gallery) };
  if (!FRAME_STYLES[out.frame.style]) out.frame.style = 'none';
  if (!ART_STYLES[out.art.style]) out.art.style = 'none';
  return out;
}

export function defaultSurface(name = 'Superficie 1', corners) {
  return {
    id: uid('srf'),
    name,
    visible: true,
    corners: corners || [[0, 0], [1, 0], [1, 1], [0, 1]],
    effect: 'aurora',
    params: defaultEffectParams('aurora'),
    particles: defaultParticles('none'),
    media: defaultMedia(),
    opacity: 1,
    feather: 0,
    blend: 'normal',
  };
}

export function defaultOutput() {
  return {
    keystone: [[0, 0], [1, 0], [1, 1], [0, 1]],
    flipX: false,
    flipY: false,
    brightness: 1,
    contrast: 1,
    gamma: 1,
    saturation: 1,
    temperature: 0,
    edgeBlend: { left: 0, right: 0, top: 0, bottom: 0, gamma: 2.2 },
    vignette: 0,
    renderScale: 1,
    autoQuality: true,
    testPattern: 'off',
    showFps: false,
  };
}

export function defaultState() {
  return {
    version: 1,
    sceneName: 'Aurora',
    sceneId: 'preset-aurora',
    master: { brightness: 1, blackout: false },
    surfaces: [defaultSurface('Fondo')],
    masks: [],
    output: defaultOutput(),
    audio: { mode: 'off', bpm: 120 },
  };
}

export function defaultMask(kind = 'rect') {
  let points;
  if (kind === 'circle') {
    points = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      points.push([0.5 + Math.cos(a) * 0.12, 0.5 + Math.sin(a) * 0.2]);
    }
  } else {
    points = [[0.4, 0.35], [0.6, 0.35], [0.6, 0.65], [0.4, 0.65]];
  }
  return { id: uid('msk'), name: kind === 'circle' ? 'Zona circular' : 'Zona protegida', enabled: true, mode: 'exclude', feather: 0.01, points };
}

// ---------- Built-in scenes ("ambientes") ----------
function scene(id, name, surfaceContents, extra = {}) {
  return {
    id, builtIn: true, name,
    surfaces: surfaceContents.map((c, i) => {
      const s = defaultSurface(`Capa ${i + 1}`);
      s.effect = c.effect;
      s.params = { ...defaultEffectParams(c.effect), ...(c.params || {}) };
      if (c.palette) s.params.colors = [...PALETTES[c.palette].colors];
      s.particles = { ...defaultParticles(c.particles || 'none'), ...(c.particleParams || {}) };
      if (c.corners) s.corners = c.corners;
      return s;
    }),
    ...extra,
  };
}

export const PRESET_SCENES = [
  scene('preset-aurora', { es: 'Noche de aurora', en: 'Aurora night' }, [{ effect: 'aurora', particles: 'snow', particleParams: { count: 1500, size: 0.35, speed: 0.25 } }]),
  scene('preset-galaxy', { es: 'Galaxia', en: 'Galaxy' }, [{ effect: 'nebula', params: { intensity: 0.55 }, particles: 'galaxy' }]),
  scene('preset-forest', { es: 'Bosque encantado', en: 'Enchanted forest' }, [{ effect: 'clouds', palette: 'forest', params: { intensity: 0.45, speed: 0.25 }, particles: 'fireflies' }]),
  scene('preset-ocean', { es: 'Fondo del mar', en: 'Deep ocean' }, [{ effect: 'caustics', particles: 'bokeh', particleParams: { count: 60, speed: 0.2 } }]),
  scene('preset-campfire', { es: 'Fogata', en: 'Campfire' }, [{ effect: 'fire', particles: 'embers' }]),
  scene('preset-snow', { es: 'Nevada tranquila', en: 'Quiet snowfall' }, [{ effect: 'gradient', palette: 'ice', params: { intensity: 0.5, speed: 0.2 }, particles: 'snow' }]),
  scene('preset-rain', { es: 'Tormenta', en: 'Rainstorm' }, [{ effect: 'clouds', palette: 'mono', params: { intensity: 0.35, speed: 0.6 }, particles: 'rain' }]),
  scene('preset-neon', { es: 'Fiesta neón', en: 'Neon party' }, [{ effect: 'tunnel', params: { audio: 1 }, particles: 'vortex', particleParams: { speed: 0.7 } }], { audio: { mode: 'bpm', bpm: 124 } }),
  scene('preset-zen', { es: 'Zen', en: 'Zen' }, [{ effect: 'liquid', palette: 'pastel', params: { speed: 0.2, intensity: 0.8 } }]),
  scene('preset-lava', { es: 'Lámpara de lava', en: 'Lava lamp' }, [{ effect: 'metaballs', params: { speed: 0.35 } }]),
  scene('preset-attractor', { es: 'Caos hipnótico', en: 'Hypnotic chaos' }, [{ effect: 'none', particles: 'attractor', palette: 'neon' }]),
  scene('preset-flow', { es: 'Seda fluida', en: 'Silk flow' }, [{ effect: 'none', palette: 'aurora', particles: 'flow' }]),
  scene('preset-crystal', { es: 'Cueva de cristal', en: 'Crystal cave' }, [{ effect: 'voronoi', particles: 'fireflies', particleParams: { count: 200 } }]),
  scene('preset-mandala', { es: 'Mandala', en: 'Mandala' }, [{ effect: 'kaleidoscope', palette: 'gold' }]),
];

const CONTENT_KEYS = ['effect', 'params', 'particles', 'media', 'blend', 'opacity'];

/**
 * Apply a scene to a display state.
 * mode 'content': keep calibration (surface corners, masks, output optics) and only replace what is shown.
 *   A one-surface scene is applied to every existing surface; otherwise surfaces are matched by index.
 * mode 'full': replace surfaces and masks (keeps output optics, which belong to the physical projector).
 */
export function applyScene(state, sceneDef, mode = 'content') {
  const next = structuredClone(state);
  const srcSurfaces = sceneDef.surfaces || [];
  next.sceneId = sceneDef.id;
  next.sceneName = sceneDef.name;
  if (sceneDef.audio) next.audio = { ...next.audio, ...sceneDef.audio };
  if (mode === 'full' || next.surfaces.length === 0) {
    next.surfaces = srcSurfaces.map((s) => ({ ...structuredClone(s), id: uid('srf') }));
    if (Array.isArray(sceneDef.masks)) next.masks = structuredClone(sceneDef.masks);
    return next;
  }
  if (srcSurfaces.length === 0) return next;
  next.surfaces = next.surfaces.map((surf, i) => {
    const src = srcSurfaces.length === 1 ? srcSurfaces[0] : srcSurfaces[i];
    if (!src) return surf;
    const merged = { ...surf };
    for (const k of CONTENT_KEYS) if (src[k] !== undefined) merged[k] = structuredClone(src[k]);
    // A custom shader travels with the surface; drop a stale one when the scene uses a built-in effect.
    if (src.effect === 'custom' && src.custom) merged.custom = structuredClone(src.custom);
    else delete merged.custom;
    return merged;
  });
  if (srcSurfaces.length > 1) {
    for (let i = next.surfaces.length; i < srcSurfaces.length; i++) {
      next.surfaces.push({ ...structuredClone(srcSurfaces[i]), id: uid('srf') });
    }
  }
  return next;
}

/** Extract a reusable scene from a display state. */
export function sceneFromState(state, name) {
  return {
    name: name || state.sceneName || 'Escena',
    surfaces: structuredClone(state.surfaces),
    masks: structuredClone(state.masks),
    audio: structuredClone(state.audio),
  };
}

export function localized(v, lang = 'es') {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.es || v.en || '';
}

/** Defensive normalisation of a state coming from disk or network. */
export function normalizeState(s) {
  const base = defaultState();
  if (!s || typeof s !== 'object') return base;
  const out = { ...base, ...s };
  out.master = { ...base.master, ...(s.master || {}) };
  out.output = { ...base.output, ...(s.output || {}) };
  out.output.edgeBlend = { ...base.output.edgeBlend, ...((s.output || {}).edgeBlend || {}) };
  out.audio = { ...base.audio, ...(s.audio || {}) };
  out.surfaces = Array.isArray(s.surfaces) ? s.surfaces.map((x) => {
    const d = defaultSurface(x.name);
    return {
      ...d, ...x,
      params: { ...defaultEffectParams(x.effect), ...(x.params || {}) },
      particles: { ...defaultParticles((x.particles || {}).mode || 'none'), ...(x.particles || {}) },
      media: normalizeMedia(x.media),
    };
  }) : base.surfaces;
  out.masks = Array.isArray(s.masks) ? s.masks : [];
  return out;
}

// ---------- Custom (user-written) effects ----------
export const CUSTOM_GLSL_MAX = 32 * 1024;

export const EFFECT_TEMPLATES = {
  basic: {
    name: { es: 'Básico: degradado animado', en: 'Basic: animated gradient' },
    glsl: `// uv: 0..1   p: centrado (-aspecto..aspecto, -1..1)   t: tiempo
// uP1, uP2: sliders 0..1   pal(x): paleta de 3 colores   bass(): audio
vec3 effect(vec2 uv, vec2 p, float t) {
  float v = sin(p.x * 3. + t) * 0.5 + 0.5;
  return pal(v * 0.5 + uv.y * uP1 + t * 0.05) * (0.6 + 0.4 * v);
}
`,
  },
  rings: {
    name: { es: 'Anillos que laten con el audio', en: 'Rings pulsing with audio' },
    glsl: `vec3 effect(vec2 uv, vec2 p, float t) {
  float r = length(p);
  float w = sin(r * (6. + uP1 * 20.) - t * 3.) * 0.5 + 0.5;
  w = pow(w, 2. + uP2 * 6.);
  return pal(r * 0.3 - t * 0.05) * w * (1. + bass());
}
`,
  },
  flow: {
    name: { es: 'Ruido fluido (fbm)', en: 'Flowing noise (fbm)' },
    glsl: `vec3 effect(vec2 uv, vec2 p, float t) {
  vec2 q = vec2(fbm(p + t * 0.1), fbm(p - t * 0.07 + 4.2));
  float f = fbm(p * 1.5 + q * (1. + uP1 * 3.));
  return pal(f + t * 0.02) * (0.3 + f * 1.4);
}
`,
  },
  stars: {
    name: { es: 'Cielo de estrellas', en: 'Starry sky' },
    glsl: `vec3 effect(vec2 uv, vec2 p, float t) {
  vec3 col = mix(uC1 * 0.1, vec3(0.), uv.y);
  vec2 g = p * (8. + uP1 * 30.);
  vec2 id = floor(g);
  float h = hash21(id);
  float d = length(fract(g) - hash22(id));
  float twinkle = 0.5 + 0.5 * sin(t * 3. + h * 40.);
  col += pal(h) * step(0.85 - uP2 * 0.3, h) * 0.02 / max(d * d, 0.0005) * twinkle * 0.05;
  return col;
}
`,
  },
};

/** Validate/normalise a custom effect definition (from the editor, server or an imported file). */
export function sanitizeCustomEffect(e) {
  if (!e || typeof e !== 'object') return null;
  const glsl = typeof e.glsl === 'string' ? e.glsl : '';
  if (!glsl.trim() || glsl.length > CUSTOM_GLSL_MAX) return null;
  const str = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);
  return {
    id: /^[a-zA-Z0-9_-]{1,80}$/.test(e.id || '') ? e.id : uid('fx'),
    name: str(e.name, 60, 'Mi efecto').trim() || 'Mi efecto',
    glsl,
    p1Label: str(e.p1Label, 30, 'P1'),
    p2Label: str(e.p2Label, 30, 'P2'),
    author: str(e.author, 60),
    colors: Array.isArray(e.colors) && e.colors.length === 3 && e.colors.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)) ? [...e.colors] : null,
  };
}

/** The part of a custom effect that is embedded in a surface (no thumbnail, no metadata). */
export function customForSurface(e) {
  return { id: e.id, name: e.name, glsl: e.glsl, p1Label: e.p1Label, p2Label: e.p2Label };
}
