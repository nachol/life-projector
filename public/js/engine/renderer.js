// Projection-mapping render pipeline (WebGL2).
//
//  1. Each surface renders its effect into an offscreen target (bg) and, optionally,
//     a GPU particle system into a second persistent target (fx) that keeps trails.
//  2. Surfaces are composited into the scene target through a per-surface homography
//     (corner pin), with soft edges, opacity and blend mode.
//  3. The final pass warps the scene through the global keystone, applies protection
//     masks, edge blending, colour correction, flips and master fades.
import { Program, Target, FULLSCREEN_VS, createFullscreenTriangle, hexToRgb } from './gl.js';
import { effectFragmentSource, MEDIA_FS, EFFECT_GLSL } from './effects-glsl.js';
import { ParticleSystem } from './particles.js';
import { squareToQuad, invert3, toGL } from '../core/homography.js';
import { PARTICLE_MODE_INDEX, normalizeState } from '../core/catalog.js';

const COMPOSE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uBg, uFx;
uniform float uHasBg, uHasFx, uOpacity, uFeather;
uniform mat3 uInv;
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y);
  vec3 h = uInv * vec3(p, 1.);
  if (h.z <= 0.) discard;
  vec2 uv = h.xy / h.z;
  float e = min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y));
  if (e < -0.01) discard;
  float fw = max(fwidth(uv.x), fwidth(uv.y)) * 1.2;
  float a = smoothstep(0., max(uFeather, fw), e) * uOpacity;
  vec2 tuv = vec2(uv.x, 1. - uv.y);
  vec3 c = vec3(0.);
  if (uHasBg > 0.5) c += texture(uBg, tuv).rgb;
  if (uHasFx > 0.5) c += texture(uFx, tuv).rgb;
  o = vec4(c * a, a);
}`;

const FINAL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uScene, uMask, uSnap;
uniform mat3 uKInv;
uniform vec2 uFlip, uRes;
uniform float uHasMask, uBright, uContrast, uGamma, uSat, uTemp, uVignette, uFade, uSnapMix, uBlendGamma;
uniform vec4 uBlend; // left, right, top, bottom (fraction of output)
uniform int uTest;

float ramp(float x) {
  x = clamp(x, 0., 1.);
  float c = x < 0.5 ? 0.5 * pow(2. * x, 2.) : 1. - 0.5 * pow(2. * (1. - x), 2.);
  return pow(c, 1. / max(uBlendGamma, 0.1));
}
vec3 grid(vec2 s) {
  vec2 g = s * 16.;
  vec2 d = abs(fract(g + 0.5) - 0.5) / max(fwidth(g), 1e-4);
  float line = 1. - clamp(min(d.x, d.y) - 0.5, 0., 1.);
  vec2 c = abs(s - 0.5) / max(fwidth(s), 1e-4);
  float cross = 1. - clamp(min(c.x, c.y) - 1., 0., 1.);
  vec3 col = vec3(0.04) + vec3(0.7) * line;
  col = mix(col, vec3(1., 0.2, 0.3), cross);
  float m = 0.05;
  if (s.x < m && s.y < m) col = vec3(1., 0.15, 0.15);
  if (s.x > 1. - m && s.y < m) col = vec3(0.15, 1., 0.15);
  if (s.x > 1. - m && s.y > 1. - m) col = vec3(0.2, 0.45, 1.);
  if (s.x < m && s.y > 1. - m) col = vec3(1., 1., 0.15);
  return col;
}
void main() {
  vec2 p = vec2(vUv.x, 1. - vUv.y);
  if (uFlip.x > 0.5) p.x = 1. - p.x;
  if (uFlip.y > 0.5) p.y = 1. - p.y;
  vec3 h = uKInv * vec3(p, 1.);
  vec2 s = h.xy / h.z;
  float e = min(min(s.x, 1. - s.x), min(s.y, 1. - s.y));
  float fw = max(fwidth(s.x), fwidth(s.y));
  float inside = h.z > 0. ? smoothstep(0., fw * 1.5, e) : 0.;
  vec3 col;
  if (uTest == 1) {
    col = grid(s) * inside;
  } else if (uTest == 2) {
    col = vec3(1.);
  } else {
    vec2 tuv = vec2(s.x, 1. - s.y);
    col = texture(uScene, tuv).rgb;
    if (uSnapMix > 0.001) col = mix(col, texture(uSnap, tuv).rgb, uSnapMix);
    col *= inside;
    col = (col - 0.5) * uContrast + 0.5;
    col *= uBright;
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSat);
    col *= vec3(1. + uTemp * 0.25, 1. + uTemp * 0.02, 1. - uTemp * 0.25);
    col = pow(max(col, 0.), vec3(1. / max(uGamma, 0.05)));
    float v = length((p - 0.5) * vec2(uRes.x / uRes.y, 1.));
    col *= mix(1., smoothstep(1.0, 0.25, v), uVignette);
    col *= uFade;
  }
  if (uHasMask > 0.5) col *= texture(uMask, p).r;
  float eb = 1.;
  if (uBlend.x > 0.) eb *= ramp(p.x / uBlend.x);
  if (uBlend.y > 0.) eb *= ramp((1. - p.x) / uBlend.y);
  if (uBlend.z > 0.) eb *= ramp(p.y / uBlend.z);
  if (uBlend.w > 0.) eb *= ramp((1. - p.y) / uBlend.w);
  o = vec4(clamp(col * eb, 0., 1.), 1.);
}`;

const SOLID_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform vec4 uColor;
void main() { o = uColor; }`;

const FIT = { cover: 0, contain: 1, stretch: 2 };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export class Renderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = { preview: false, ignoreFlip: false, maxParticles: 250000, transitions: true, maxSize: 4096, ...opts };
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 no está disponible en este navegador / WebGL2 is not available');
    this.gl = gl;
    this.tri = createFullscreenTriangle(gl);
    this.effectProgs = new Map();
    this.compose = new Program(gl, FULLSCREEN_VS, COMPOSE_FS, null, 'compose');
    this.final = new Program(gl, FULLSCREEN_VS, FINAL_FS, null, 'final');
    this.solid = new Program(gl, FULLSCREEN_VS, SOLID_FS, null, 'solid');
    this.mediaProg = new Program(gl, FULLSCREEN_VS, MEDIA_FS, null, 'media');
    this.scene = new Target(gl, 2, 2);
    this.snap = new Target(gl, 2, 2);
    this.runtimes = new Map();
    this.state = normalizeState(null);
    this.remoteAudio = { v: [0, 0, 0, 0], at: 0 };
    this.audioValues = [0, 0, 0, 0];
    this.maskTex = this.#createTex();
    this.maskKey = '';
    this.hasMask = false;
    this.maskCanvas = document.createElement('canvas');
    this.fade = 1;
    this.snapMix = 0;
    this.signature = null;
    this.time = 0;
    this.fps = 60;
    this.autoScale = 1;
    this.lowFpsTime = 0;
    this.highFpsTime = 0;
    this.lost = false;
    this.errors = new Set();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => this.opts.onContextRestored?.());
  }

  #createTex() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  }

  effectProgram(id) {
    if (!EFFECT_GLSL[id]) id = 'none';
    let p = this.effectProgs.get(id);
    if (p) return p;
    try {
      p = new Program(this.gl, FULLSCREEN_VS, effectFragmentSource(id), null, `effect:${id}`);
    } catch (e) {
      console.error(e);
      this.errors.add(`${id}: ${e.message}`);
      p = id === 'none' ? null : this.effectProgram('none');
    }
    this.effectProgs.set(id, p);
    return p;
  }

  /** Compile every effect up-front (used by tests and the thumbnail generator). */
  compileAll() {
    for (const id of Object.keys(EFFECT_GLSL)) this.effectProgram(id);
    return [...this.errors];
  }

  setState(state) {
    this.state = normalizeState(state);
    const sig = this.state.surfaces.map((s) => `${s.effect}|${s.particles.mode}|${s.media?.url}`).join(',') + `#${this.state.sceneId}`;
    if (this.opts.transitions && this.signature !== null && sig !== this.signature && this.scene.w > 2) {
      this.#snapshot();
      this.snapMix = 1;
    }
    this.signature = sig;
  }

  setRemoteAudio(v) {
    if (Array.isArray(v) && v.length === 4) this.remoteAudio = { v: v.map((x) => Math.max(0, Math.min(2, +x || 0))), at: performance.now() };
  }

  #snapshot() {
    const gl = this.gl;
    this.snap.resize(this.scene.w, this.scene.h);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.scene.fb);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.snap.fb);
    gl.blitFramebuffer(0, 0, this.scene.w, this.scene.h, 0, 0, this.snap.w, this.snap.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  #computeAudio(dt) {
    const a = this.state.audio || {};
    let target = [0, 0, 0, 0];
    if (a.mode === 'bpm') {
      const bpm = Math.max(30, Math.min(240, a.bpm || 120));
      const phase = (this.time * bpm / 60) % 1;
      const bar = (this.time * bpm / 240) % 1;
      const bass = Math.exp(-phase * 7);
      const mid = Math.exp(-((phase + 0.5) % 1) * 10) * 0.6;
      const high = Math.exp(-((phase * 4) % 1) * 12) * 0.35;
      target = [bass * 0.7 + 0.1 * Math.sin(bar * Math.PI * 2) + 0.1, bass, mid, high];
    } else if (a.mode === 'remote' || a.mode === 'mic') {
      const age = performance.now() - this.remoteAudio.at;
      target = age < 600 ? this.remoteAudio.v : [0, 0, 0, 0];
    }
    const k = 1 - Math.exp(-dt * 25);
    this.audioValues = this.audioValues.map((v, i) => v + (target[i] - v) * k);
    return this.audioValues;
  }

  #runtime(s) {
    let rt = this.runtimes.get(s.id);
    if (!rt) {
      rt = { bg: new Target(this.gl, 4, 4), fx: null, ps: null, psMode: null, time: Math.random() * 100, media: null };
      this.runtimes.set(s.id, rt);
    }
    return rt;
  }

  #disposeRuntime(rt) {
    rt.bg.dispose();
    rt.fx?.dispose();
    rt.ps?.dispose();
    this.#disposeMedia(rt);
  }

  #disposeMedia(rt) {
    if (!rt.media) return;
    if (rt.media.el instanceof HTMLVideoElement) { rt.media.el.pause(); rt.media.el.removeAttribute('src'); rt.media.el.load(); }
    this.gl.deleteTexture(rt.media.tex);
    rt.media = null;
  }

  #media(rt, m) {
    const gl = this.gl;
    if (!m?.url) { this.#disposeMedia(rt); return null; }
    if (rt.media && rt.media.url !== m.url) this.#disposeMedia(rt);
    if (!rt.media) {
      const isVideo = m.type === 'video' || /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(m.url);
      const media = { url: m.url, tex: this.#createTex(), ready: false, w: 1, h: 1, el: null, isVideo };
      if (isVideo) {
        const v = document.createElement('video');
        v.crossOrigin = 'anonymous';
        v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
        v.setAttribute('playsinline', '');
        v.src = m.url;
        v.addEventListener('loadeddata', () => { media.ready = true; media.w = v.videoWidth; media.h = v.videoHeight; });
        v.play().catch(() => {});
        media.el = v;
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          gl.bindTexture(gl.TEXTURE_2D, media.tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          media.ready = true; media.w = img.naturalWidth; media.h = img.naturalHeight;
        };
        img.src = m.url;
        media.el = img;
      }
      rt.media = media;
    }
    const media = rt.media;
    if (media.isVideo) {
      const v = media.el;
      v.loop = m.loop !== false;
      v.muted = m.muted !== false;
      if (v.paused && v.readyState >= 2) v.play().catch(() => {});
      if (media.ready && v.readyState >= 2) {
        gl.bindTexture(gl.TEXTURE_2D, media.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      }
    }
    return media;
  }

  #surfaceSize(s, W, H) {
    const c = s.corners.map(([x, y]) => [x * W, y * H]);
    const w = Math.max(dist(c[0], c[1]), dist(c[3], c[2]));
    const h = Math.max(dist(c[0], c[3]), dist(c[1], c[2]));
    const max = Math.min(2048, this.opts.maxSize);
    const k = Math.min(1, max / Math.max(w, h, 1));
    return [Math.max(16, Math.round(w * k)), Math.max(16, Math.round(h * k))];
  }

  #renderSurface(s, dt, W, H, audio) {
    const gl = this.gl;
    const rt = this.#runtime(s);
    const [w, h] = this.#surfaceSize(s, W, H);
    // Only reallocate when the size changes noticeably (dragging corners must stay smooth).
    if (Math.abs(rt.bg.w - w) / w > 0.12 || Math.abs(rt.bg.h - h) / h > 0.12) {
      rt.bg.resize(w, h);
      rt.fx?.resize(w, h);
    }
    const prm = s.params;
    const colors = (prm.colors || []).map(hexToRgb);
    while (colors.length < 3) colors.push([1, 1, 1]);
    rt.time += dt * (prm.speed ?? 0.5) * 2;

    rt.hasBg = s.effect !== 'none';
    if (s.effect === 'media') {
      const media = this.#media(rt, s.media);
      rt.bg.bind();
      if (media?.ready) {
        this.mediaProg.use()
          .v2('uRes', rt.bg.w, rt.bg.h).v2('uTexSize', media.w, media.h)
          .f('uFit', FIT[s.media.fit] ?? 0).f('uIntensity', prm.intensity ?? 1).f('uHue', prm.hue || 0).i('uTex', 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, media.tex);
        this.tri.draw();
      } else {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    } else {
      if (rt.media) this.#disposeMedia(rt);
      if (rt.hasBg) {
        const prog = this.effectProgram(s.effect);
        rt.bg.bind();
        if (prog) {
          prog.use()
            .f('uTime', rt.time).v2('uRes', rt.bg.w, rt.bg.h)
            .f('uIntensity', prm.intensity ?? 1).f('uScale', prm.scale ?? 1).f('uHue', prm.hue || 0)
            .f('uP1', prm.p1 ?? 0.5).f('uP2', prm.p2 ?? 0.5).f('uAudioReact', prm.audio ?? 0.5)
            .v3('uC1', colors[0]).v3('uC2', colors[1]).v3('uC3', colors[2]).v4('uAudio', audio);
          this.tri.draw();
        }
      }
    }

    const pc = s.particles || {};
    const modeIndex = PARTICLE_MODE_INDEX[pc.mode] ?? -1;
    if (modeIndex >= 0) {
      const count = Math.min(this.opts.maxParticles, Math.max(10, pc.count | 0));
      if (!rt.ps) rt.ps = new ParticleSystem(gl, count);
      else if (rt.ps.count !== count || rt.psMode !== pc.mode) rt.ps.alloc(count);
      rt.psMode = pc.mode;
      if (!rt.fx) rt.fx = new Target(gl, rt.bg.w, rt.bg.h);
      const pcolors = (pc.colors || prm.colors || []).map(hexToRgb);
      while (pcolors.length < 3) pcolors.push([1, 1, 1]);
      const audioReact = prm.audio ?? 0.5;
      const cfg = {
        modeIndex, speed: pc.speed ?? 0.5, p1: pc.p1 ?? 0.5, p2: pc.p2 ?? 0.5,
        aspect: rt.fx.w / rt.fx.h, size: pc.size ?? 0.4, px: rt.fx.h / 720,
        bass: audio[1] * audioReact, level: audio[0] * audioReact, high: audio[3] * audioReact,
        c1: pcolors[0], c2: pcolors[1], c3: pcolors[2],
      };
      rt.ps.update(dt, cfg);
      rt.fx.bind();
      const trails = Math.max(0, Math.min(1, pc.trails ?? 0));
      if (trails <= 0.001) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else {
        const keep = Math.pow(Math.min(0.995, 1 - Math.pow(1 - trails, 1.6) * 0.9), Math.min(dt, 0.1) * 60);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
        this.solid.use().v4('uColor', [0, 0, 0, 1 - keep]);
        this.tri.draw();
        gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
        gl.blendFunc(gl.ONE, gl.ONE);
        this.solid.use().v4('uColor', [1.5 / 255, 1.5 / 255, 1.5 / 255, 0]);
        this.tri.draw();
        gl.blendEquation(gl.FUNC_ADD);
        gl.disable(gl.BLEND);
      }
      rt.ps.draw(cfg);
      rt.hasFx = true;
    } else {
      if (rt.ps) { rt.ps.dispose(); rt.ps = null; rt.psMode = null; }
      if (rt.fx) { rt.fx.dispose(); rt.fx = null; }
      rt.hasFx = false;
    }
    return rt;
  }

  #updateMask(W, H) {
    const masks = (this.state.masks || []).filter((m) => m.enabled !== false && m.points?.length >= 3);
    const mw = Math.max(64, Math.min(1024, Math.round(W / 2)));
    const mh = Math.max(36, Math.round(mw * H / W));
    const key = JSON.stringify([mw, mh, masks]);
    if (key === this.maskKey) return;
    this.maskKey = key;
    this.hasMask = masks.length > 0;
    if (!this.hasMask) return;
    const c = this.maskCanvas;
    c.width = mw; c.height = mh;
    const ctx = c.getContext('2d');
    const includes = masks.filter((m) => m.mode === 'include');
    const excludes = masks.filter((m) => m.mode !== 'include');
    ctx.filter = 'none';
    ctx.fillStyle = includes.length ? '#000' : '#fff';
    ctx.fillRect(0, 0, mw, mh);
    const draw = (m, color) => {
      const blur = Math.max(0, (m.feather || 0) * mw);
      ctx.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
      ctx.fillStyle = color;
      ctx.beginPath();
      m.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * mw, y * mh) : ctx.moveTo(x * mw, y * mh)));
      ctx.closePath();
      ctx.fill();
    };
    includes.forEach((m) => draw(m, '#fff'));
    excludes.forEach((m) => draw(m, '#000'));
    ctx.filter = 'none';
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  #resizeCanvas() {
    const out = this.state.output;
    const scale = Math.min(out.renderScale ?? 1, this.autoScale);
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.preview ? 1.5 : 2);
    const cw = this.canvas.clientWidth || this.canvas.width;
    const ch = this.canvas.clientHeight || this.canvas.height;
    let w = Math.round(cw * dpr * scale);
    let h = Math.round(ch * dpr * scale);
    const k = Math.min(1, this.opts.maxSize / Math.max(w, h));
    w = Math.max(2, Math.round(w * k)); h = Math.max(2, Math.round(h * k));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return [w, h];
  }

  #autoQuality(dt) {
    const out = this.state.output;
    if (!out.autoQuality || this.opts.preview) { this.autoScale = 1; return; }
    if (this.fps < 42) { this.lowFpsTime += dt; this.highFpsTime = 0; }
    else if (this.fps > 57) { this.highFpsTime += dt; this.lowFpsTime = 0; }
    else { this.lowFpsTime = 0; this.highFpsTime = 0; }
    if (this.lowFpsTime > 3 && this.autoScale > 0.45) { this.autoScale = Math.round((this.autoScale - 0.1) * 100) / 100; this.lowFpsTime = 0; }
    if (this.highFpsTime > 12 && this.autoScale < 1) { this.autoScale = Math.min(1, Math.round((this.autoScale + 0.1) * 100) / 100); this.highFpsTime = 0; }
  }

  /** Render one frame. dt in seconds. */
  render(dt) {
    if (this.lost) return;
    const gl = this.gl;
    dt = Math.max(0, Math.min(dt, 0.1));
    this.time += dt;
    if (dt > 0) this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
    this.#autoQuality(dt);
    const [W, H] = this.#resizeCanvas();
    if (this.scene.resize(W, H)) this.snapMix = 0;
    const audio = this.#computeAudio(dt);
    const st = this.state;

    // 1. surfaces
    const alive = new Set();
    const drawn = [];
    for (const s of st.surfaces) {
      alive.add(s.id);
      if (s.visible === false || (s.opacity ?? 1) <= 0) continue;
      drawn.push([s, this.#renderSurface(s, dt, W, H, audio)]);
    }
    for (const [id, rt] of this.runtimes) if (!alive.has(id)) { this.#disposeRuntime(rt); this.runtimes.delete(id); }

    // 2. compose
    this.scene.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    this.compose.use().i('uBg', 0).i('uFx', 1);
    for (const [s, rt] of drawn) {
      if (s.blend === 'add' || s.blend === 'screen') gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, rt.bg.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, rt.fx ? rt.fx.tex : rt.bg.tex);
      this.compose
        .m3('uInv', toGL(invert3(squareToQuad(s.corners))))
        .f('uOpacity', s.opacity ?? 1).f('uFeather', (s.feather || 0) * 0.5)
        .f('uHasBg', rt.hasBg ? 1 : 0).f('uHasFx', rt.hasFx ? 1 : 0);
      this.tri.draw();
    }
    gl.disable(gl.BLEND);

    // 3. output
    this.#updateMask(W, H);
    const out = st.output;
    const target = st.master.blackout ? 0 : (st.master.brightness ?? 1);
    this.fade += (target - this.fade) * (1 - Math.exp(-dt * 6));
    this.snapMix = Math.max(0, this.snapMix - dt / 1.2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.snap.tex);
    const eb = out.edgeBlend || {};
    const flip = this.opts.ignoreFlip ? [0, 0] : [out.flipX ? 1 : 0, out.flipY ? 1 : 0];
    const test = { grid: 1, white: 2 }[out.testPattern] || 0;
    this.final.use()
      .i('uScene', 0).i('uMask', 1).i('uSnap', 2)
      .m3('uKInv', toGL(invert3(squareToQuad(out.keystone))))
      .v2('uFlip', flip[0], flip[1]).v2('uRes', W, H)
      .f('uHasMask', this.hasMask ? 1 : 0)
      .f('uBright', out.brightness ?? 1).f('uContrast', out.contrast ?? 1).f('uGamma', out.gamma ?? 1)
      .f('uSat', out.saturation ?? 1).f('uTemp', out.temperature || 0).f('uVignette', out.vignette || 0)
      .f('uFade', this.fade).f('uSnapMix', this.snapMix * this.snapMix)
      .v4('uBlend', [eb.left || 0, eb.right || 0, eb.top || 0, eb.bottom || 0]).f('uBlendGamma', eb.gamma || 2.2)
      .i('uTest', test);
    this.tri.draw();
    gl.activeTexture(gl.TEXTURE0);
  }

  get effectiveScale() {
    return Math.min(this.state.output.renderScale ?? 1, this.autoScale);
  }

  dispose() {
    for (const rt of this.runtimes.values()) this.#disposeRuntime(rt);
    this.runtimes.clear();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
