// Generates small preview images for every effect / particle system using one
// offscreen WebGL renderer, then caches them in localStorage.
import { Renderer } from '../engine/renderer.js';
import { EFFECTS, PARTICLES, defaultState, defaultEffectParams, defaultParticles } from '../core/catalog.js';

const KEY = 'lp.thumbs.v4';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { cache = {}; }
const listeners = new Set();
let started = false;

export const thumb = (key) => cache[key] || null;
export const onThumbs = (fn) => listeners.add(fn);

export function generateThumbs() {
  if (started) return;
  started = true;
  const jobs = [
    ...Object.keys(EFFECTS).filter((k) => !['none', 'media'].includes(k)).map((k) => ['fx:' + k, k, 'none']),
    ...Object.keys(PARTICLES).filter((k) => k !== 'none').map((k) => ['pt:' + k, 'none', k]),
  ].filter(([key]) => !cache[key]);
  if (!jobs.length) return;
  const canvas = document.createElement('canvas');
  canvas.width = 240; canvas.height = 150;
  canvas.style.cssText = 'position:fixed;left:-9999px;top:0;width:240px;height:150px;';
  document.body.append(canvas);
  let r;
  try {
    r = new Renderer(canvas, { preview: true, transitions: false, preserveDrawingBuffer: true, maxParticles: 30000, maxSize: 240 });
  } catch { canvas.remove(); return; }
  const next = () => {
    const job = jobs.shift();
    if (!job) {
      r.dispose();
      canvas.remove();
      return;
    }
    const [key, effect, particles] = job;
    const st = defaultState();
    st.output.autoQuality = false;
    const s = st.surfaces[0];
    s.effect = effect;
    s.params = defaultEffectParams(effect === 'none' ? 'aurora' : effect);
    s.particles = { ...defaultParticles(particles), count: Math.min(defaultParticles(particles).count, 12000) };
    if (particles === 'bokeh') s.particles.count = 40;
    r.setState(st);
    const frames = particles === 'none' ? 2 : 40;
    for (let i = 0; i < frames; i++) r.render(1 / 15);
    cache[key] = canvas.toDataURL('image/jpeg', 0.82);
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
    listeners.forEach((fn) => fn(key));
    idle(next);
  };
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 30));
  setTimeout(next, 200);
}
