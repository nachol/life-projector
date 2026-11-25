// GLSL fragment shader library. Each effect implements:
//   vec3 effect(vec2 uv, vec2 p, float t)
// uv: 0..1 surface coordinates (y up), p: centred, aspect-corrected and scaled, t: effect time.
// Uniforms available: uRes, uP1, uP2, uC1..uC3 (palette), uAudio (level, bass, mid, high), uAudioReact.

export const COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uTime, uIntensity, uScale, uP1, uP2, uHue, uAudioReact;
uniform vec2 uRes;
uniform vec3 uC1, uC2, uC3;
uniform vec4 uAudio;
#define PI 3.14159265
#define TAU 6.28318531

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= .5; }
  return v;
}
vec3 pal(float t) {
  t = fract(t) * 3.;
  if (t < 1.) return mix(uC1, uC2, smoothstep(0., 1., t));
  if (t < 2.) return mix(uC2, uC3, smoothstep(0., 1., t - 1.));
  return mix(uC3, uC1, smoothstep(0., 1., t - 2.));
}
vec3 hueShift(vec3 c, float h) {
  const vec3 k = vec3(0.57735);
  float ca = cos(h * TAU);
  return c * ca + cross(k, c) * sin(h * TAU) + k * dot(k, c) * (1. - ca);
}
float level() { return uAudio.x * uAudioReact; }
float bass() { return uAudio.y * uAudioReact; }
float mids() { return uAudio.z * uAudioReact; }
float highs() { return uAudio.w * uAudioReact; }
`;

const MAIN = `
void main() {
  float aspect = uRes.x / max(uRes.y, 1.);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.) * 2. / max(uScale, 0.05);
  vec3 col = effect(vUv, p, uTime);
  col = hueShift(col, uHue);
  col *= uIntensity * (1. + 0.5 * level());
  outColor = vec4(max(col, 0.), 1.);
}`;

export const EFFECT_GLSL = {
  none: `vec3 effect(vec2 uv, vec2 p, float t) { return vec3(0.); }`,

  aurora: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec3 col = mix(uC3 * 0.06, vec3(0.0, 0.004, 0.015), uv.y);
  vec2 sg = floor(uv * uRes / 3.);
  float s = hash21(sg);
  col += vec3(smoothstep(0.996, 1., s)) * (0.5 + 0.5 * sin(t * 2. + s * 60.));
  float layers = 2. + floor(uP1 * 4.);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= layers) break;
    float base = -0.35 + fi * 0.13;
    float wave = base + 0.22 * sin(p.x * 0.7 + t * 0.25 + fi * 1.7)
               + 0.45 * (fbm(vec2(p.x * 0.6 + fi * 7.3, t * 0.1 + fi)) - 0.5);
    float d = p.y - wave;
    float glow = exp(-max(d, 0.) * (1.6 + (1. - uP2) * 3.)) * smoothstep(-0.04, 0.03, d);
    float rays = 0.35 + 1.1 * pow(fbm(vec2(p.x * 9. + fi * 3.1, t * 0.35)), 1.5);
    vec3 c = pal(fi * 0.17 + d * 0.35 + t * 0.015);
    col += c * glow * rays * 0.62 * (1. + bass() * 1.5);
  }
  return col;
}`,

  nebula: `
vec3 effect(vec2 uv, vec2 p, float t) {
  p *= 1.2;
  vec2 q = vec2(fbm(p + t * 0.04), fbm(p + vec2(5.2, 1.3) - t * 0.03));
  vec2 r = vec2(fbm(p + 3. * q + vec2(1.7, 9.2) + t * 0.06), fbm(p + 3. * q + vec2(8.3, 2.8)));
  float f = fbm(p + (1.5 + uP1 * 3.) * r);
  vec3 col = mix(uC1 * 0.15, uC2, clamp(f * f * 2.2, 0., 1.));
  col = mix(col, uC3, clamp(length(q) * 0.9 - 0.25, 0., 1.) * 0.85);
  col *= f * 1.7 * (1. + bass() * 0.8);
  float s = hash21(floor(uv * uRes / 2.));
  col += smoothstep(0.995, 1., s) * (0.4 + 0.6 * sin(t * 3. + s * 90.)) * uP2 * 1.5;
  return col;
}`,

  liquid: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec2 q = p * 1.3;
  for (int i = 1; i < 7; i++) {
    float fi = float(i);
    q += vec2(0.7 / fi * sin(fi * q.y + t + 0.3 * fi), 0.7 / fi * cos(fi * q.x + t * 0.8 + 0.3 * fi)) * (0.4 + uP1);
  }
  float v = 0.5 + 0.5 * sin(q.x + q.y + bass());
  vec3 col = pal(v * 0.8 + t * 0.03 + uP2 * length(q) * 0.15);
  return col * (0.55 + 0.55 * v);
}`,

  plasma: `
vec3 effect(vec2 uv, vec2 p, float t) {
  p *= 1.5;
  float v = sin(p.x * 3. + t) + sin(p.y * 3. + t * 1.3) + sin((p.x + p.y) * 2. + t * 0.7)
          + sin(length(p * vec2(1., 1.3)) * 4. - t * 1.5);
  v += uP1 * 2. * sin(length(p - vec2(sin(t * .4), cos(t * .3))) * 6. - t * 2.);
  vec3 col = pal(v * 0.125 + t * 0.05);
  float k = 0.5 + 0.5 * sin(v * PI);
  return col * mix(1., k * 1.4, uP2) * (1. + bass());
}`,

  fire: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec2 q = vec2(p.x, uv.y * 2.);
  float n = fbm(vec2(q.x * 1.6, q.y * 1.3 - t * 1.6));
  n += 0.5 * fbm(vec2(q.x * 3.2, q.y * 2.6 - t * 2.6));
  float h = (1.2 + uP1 * 1.4) - q.y * 0.85;
  float f = clamp(n * h - 0.35 + bass() * 0.35, 0., 1.6);
  f = pow(f, 1.2 + (1. - uP2) * 1.2);
  vec3 col = mix(vec3(0.), uC1, smoothstep(0., 0.35, f));
  col = mix(col, uC2, smoothstep(0.25, 0.8, f));
  col = mix(col, uC3, smoothstep(0.7, 1.25, f));
  return col;
}`,

  caustics: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec2 q = mod(p * 2.2, TAU) - 250.;
  vec2 i = q;
  float c = 1.;
  float inten = 0.005;
  float tt = t * 0.6;
  for (int n = 0; n < 5; n++) {
    float tn = tt * (1. - (3.5 / float(n + 1)));
    i = q + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    c += 1. / length(vec2(q.x / (sin(i.x + tn) / inten), q.y / (cos(i.y + tn) / inten)));
  }
  c /= 5.;
  c = 1.17 - pow(c, 1.4);
  float v = pow(abs(c), 8.);
  vec3 base = mix(uC1, uC2, clamp(uv.y * (0.6 + uP2) + 0.1 * sin(t * 0.3 + p.x), 0., 1.));
  return base * 0.65 + uC3 * clamp(v, 0., 1.5) * (0.3 + uP1) * (1. + bass());
}`,

  clouds: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec2 q = p + vec2(t * 0.12, t * 0.02);
  float f = fbm(q * 1.1 + fbm(q * 0.7 + t * 0.05) * (1. + uP1 * 2.5));
  float f2 = fbm(q * 2.6 - t * 0.09);
  vec3 sky = mix(uC1, uC2, uv.y);
  float c = smoothstep(0.55 - uP2 * 0.35, 0.95, f * 0.85 + f2 * 0.3);
  return mix(sky * 0.6, uC3, c) * (1. + bass() * 0.5);
}`,

  tunnel: `
vec3 effect(vec2 uv, vec2 p, float t) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float z = 0.6 / (r + 0.04) + t * 2.;
  float rings = 0.5 + 0.5 * sin(z * PI * (0.6 + uP1 * 2.));
  float spokes = 0.5 + 0.5 * sin(a * (3. + floor(uP2 * 12.)) + z * 0.4);
  vec3 col = pal(z * 0.04 + a / TAU) * (pow(rings, 3.) * 0.9 + spokes * 0.35);
  col *= smoothstep(0.0, 0.5, r) * (1. + bass() * 1.5);
  col += pal(t * 0.1) * exp(-r * 5.) * 0.6 * (1. + bass() * 2.);
  return col;
}`,

  kaleidoscope: `
vec3 effect(vec2 uv, vec2 p, float t) {
  float seg = 3. + floor(uP1 * 12.);
  float r = length(p);
  float a = atan(p.y, p.x) + t * 0.1;
  float s = TAU / seg;
  a = mod(a, s);
  a = abs(a - s * 0.5);
  vec2 q = r * vec2(cos(a), sin(a));
  q += vec2(t * 0.15, t * 0.05);
  float f = fbm(q * 2. + fbm(q * 3. - t * 0.1) * (1. + uP2 * 2.5));
  vec3 col = pal(f * 1.6 + r * 0.3 - t * 0.05);
  col *= 0.3 + 1.3 * f * (1. + bass());
  col *= smoothstep(2.0, 0.3, r) * 0.8 + 0.2;
  return col;
}`,

  mandala: `
vec3 effect(vec2 uv, vec2 p, float t) {
  float r = length(p) + 1e-3;
  float a = atan(p.y, p.x);
  float arms = 2. + floor(uP1 * 8.);
  float s = sin(a * arms + log(r) * (3. + uP2 * 9.) - t * 2.);
  float g = smoothstep(0., 0.9, s) * exp(-r * 0.5);
  vec3 col = pal(r * 0.4 - t * 0.1 + a / TAU) * g * 1.5;
  col += pal(t * 0.05) * 0.07 / (r + 0.12) * (1. + bass() * 2.);
  return col;
}`,

  starwarp: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec3 col = vec3(0.);
  float density = 0.85 - uP2 * 0.4;
  for (int l = 0; l < 5; l++) {
    float fl = float(l);
    float depth = fract(t * 0.12 * (0.5 + uP1 * 2.5) + fl * 0.2);
    float sc = mix(18., 0.6, depth);
    float fade = smoothstep(0., 0.4, depth) * smoothstep(1., 0.85, depth);
    vec2 g = p * sc + fl * 17.31;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 o = hash22(id) - 0.5;
    float d = length(f - o * 0.7);
    float on = step(density, hash21(id + 3.7));
    float star = on * 0.025 / max(d, 0.004) * smoothstep(0.5, 0.1, d);
    col += pal(hash21(id) + fl * 0.13) * star * fade * (1. + bass());
  }
  return col;
}`,

  voronoi: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec2 g = p * 2.5;
  vec2 i = floor(g), f = fract(g);
  float d1 = 8., d2 = 8.;
  vec2 cid = vec2(0.);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 b = vec2(float(x), float(y));
    vec2 o = hash22(i + b);
    o = 0.5 + 0.5 * sin(t * 0.6 + TAU * o);
    float d = length(b + o - f);
    if (d < d1) { d2 = d1; d1 = d; cid = i + b; } else if (d < d2) { d2 = d; }
  }
  float edge = d2 - d1;
  float h = hash21(cid);
  vec3 col = pal(h + t * 0.02) * (0.15 + 0.45 * (1. - d1));
  col *= 1. + uP2 * 0.8 * sin(h * TAU + t * 2.);
  col += uC3 * smoothstep(0.04 + uP1 * 0.15, 0., edge) * (1.1 + bass() * 2.);
  return col;
}`,

  hexgrid: `
vec4 hexCoords(vec2 p) {
  const vec2 s = vec2(1., 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + .5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + .5);
}
float hexDist(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1., 1.7320508))), p.x); }
vec3 effect(vec2 uv, vec2 p, float t) {
  vec4 h = hexCoords(p * 3.5);
  float d = hexDist(h.xy);
  float wave = sin(length(h.zw) * 0.6 - t * 2. + hash21(h.zw) * uP1 * 8.);
  float w = max(wave, 0.);
  float fill = smoothstep(0.5, 0.44, d);
  float line = smoothstep(0.035, 0., abs(d - 0.45));
  vec3 c = pal(length(h.zw) * 0.05 + t * 0.05);
  return c * (fill * uP2 * 0.5 * (0.3 + w) + line * (0.25 + 1.1 * w) * (1. + bass() * 1.5));
}`,

  waves: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec3 col = vec3(0.);
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float y = (fi / 11. - 0.5) * 1.8;
    float w = y + 0.15 * sin(p.x * (1.5 + fi * 0.2) + t * (0.8 + fi * 0.07) + fi)
            + 0.25 * (fbm(vec2(p.x * 0.8 + fi, t * 0.2)) - 0.5) * (1. + uP1 * 3.);
    float d = abs(p.y - w);
    col += pal(fi / 12. + t * 0.03) * (0.003 + 0.006 * uP2) / max(d, 0.002) * (1. + bass() * 1.5);
  }
  return col * 0.55;
}`,

  metaballs: `
vec3 effect(vec2 uv, vec2 p, float t) {
  float aspect = uRes.x / uRes.y;
  float v = 0.;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * 0.3 * (1. + fi * 0.13) + fi * 2.1) * 0.85 * aspect, sin(t * 0.23 * (1. + fi * 0.11) + fi * 1.7) * 0.85);
    float r = 0.14 + 0.1 * hash11(fi + 0.5) + 0.12 * uP1 + 0.05 * bass();
    vec2 d = p - c;
    v += r * r / max(dot(d, d), 1e-4);
  }
  float m = smoothstep(0.9, 1.05 + uP2 * 0.8, v);
  vec3 bg = mix(uC1 * 0.25, uC1 * 0.6, uv.y);
  vec3 blob = mix(uC2, uC3, clamp((v - 1.) * 0.25, 0., 1.));
  return mix(bg, blob, m) + uC2 * 0.25 * smoothstep(0.4, 1., v) * (1. - m);
}`,

  matrix: `
vec3 effect(vec2 uv, vec2 p, float t) {
  float cols = floor(20. + uP1 * 60.);
  float aspect = uRes.x / uRes.y;
  vec2 g = vec2(uv.x * cols, uv.y * cols / aspect * 1.6);
  vec2 id = floor(g);
  vec2 f = fract(g);
  float sp = 0.4 + hash11(id.x * 1.7) * 1.2;
  float rows = cols / aspect * 1.6;
  float head = fract(-t * sp * 0.12 + hash11(id.x * 3.7));
  float y = uv.y;
  float dist = fract(y - head);
  float trail = exp(-dist * (4. + (1. - uP2) * 18.));
  vec2 sub = floor(f * vec2(3., 5.));
  float flick = floor(t * (2. + 6. * hash21(id)));
  float on = step(0.4, hash21(id * 13.1 + sub + flick));
  float inside = step(0.12, f.x) * step(f.x, 0.88) * step(0.08, f.y) * step(f.y, 0.92);
  float glyph = on * inside;
  float isHead = smoothstep(1. / rows * 1.5, 0., dist);
  vec3 col = uC2 * glyph * trail * (1. + bass());
  col = mix(col, uC3 * glyph * 1.5, isHead);
  col += uC1 * 0.05 * trail;
  return col;
}`,

  gradient: `
vec3 effect(vec2 uv, vec2 p, float t) {
  float v = 0.5 + 0.5 * sin(p.x * (0.5 + uP1 * 2.) + t * 0.5) * cos(p.y * 0.8 + t * 0.3);
  return pal(v * 0.6 + t * 0.02) * (0.8 + 0.4 * bass());
}`,

  solid: `vec3 effect(vec2 uv, vec2 p, float t) { return uC1 * (1. + 0.5 * bass()); }`,

  testgrid: `
vec3 effect(vec2 uv, vec2 p, float t) {
  float n = 8. + floor(uP1 * 24.);
  vec2 gp = uv * n;
  vec2 g = abs(fract(gp + 0.5) - 0.5) / max(fwidth(gp), 1e-4);
  float line = 1. - clamp(min(g.x, g.y) - 0.5, 0., 1.);
  vec2 px = uv * uRes;
  vec2 c = abs(uv - 0.5) * uRes;
  float cross = 1. - step(2., min(c.x, c.y));
  float border = 1. - step(4., min(min(px.x, px.y), min(uRes.x - px.x, uRes.y - px.y)));
  vec2 pp = (uv - .5) * vec2(uRes.x / uRes.y, 1.);
  float lr = length(pp);
  float circ = 1. - clamp(abs(lr - 0.45) / max(fwidth(lr), 1e-4) - 0.5, 0., 1.);
  vec3 col = vec3(0.03) + vec3(0.55) * line;
  col = mix(col, vec3(0.3, 0.7, 1.), circ);
  col = mix(col, vec3(1., 0.25, 0.25), cross);
  col = mix(col, vec3(0.2, 1., 0.35), border);
  // corner markers: TL red, TR green, BR blue, BL yellow
  vec2 cu = vec2(uv.x, 1. - uv.y);
  float m = 0.06;
  if (cu.x < m && cu.y < m) col = vec3(1., 0.1, 0.1);
  if (cu.x > 1. - m && cu.y < m) col = vec3(0.1, 1., 0.1);
  if (cu.x > 1. - m && cu.y > 1. - m) col = vec3(0.2, 0.4, 1.);
  if (cu.x < m && cu.y > 1. - m) col = vec3(1., 1., 0.1);
  return col / max(uIntensity, 0.01);
}`,

  testbars: `
vec3 effect(vec2 uv, vec2 p, float t) {
  vec3 bars[8] = vec3[8](vec3(1.), vec3(1., 1., 0.), vec3(0., 1., 1.), vec3(0., 1., 0.), vec3(1., 0., 1.), vec3(1., 0., 0.), vec3(0., 0., 1.), vec3(0.));
  if (uv.y < 0.25) return vec3(floor(uv.x * 16.) / 15.);
  int i = int(clamp(floor(uv.x * 8.), 0., 7.));
  return bars[i] * 0.75 / max(uIntensity, 0.01);
}`,
};

export function effectFragmentSource(id) {
  const body = EFFECT_GLSL[id] || EFFECT_GLSL.none;
  return COMMON + body + MAIN;
}

const PHOTO_HELPERS = `
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= .5; }
  return v;
}
`;

// One-off "stylise" pass. Output keeps the source texture's orientation (row 0 = top of the
// photo) because it samples and writes at the same vUv, so the photo pass reads both alike.
export const ART_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uSize;     // target size in pixels
uniform int uStyle;     // 1 oil, 2 watercolour, 3 sketch, 4 pointillism
uniform float uAmount;  // 0..1
uniform int uMaxR;      // Kuwahara brush radius cap in pixels (lower for video)
${PHOTO_HELPERS}
vec3 src(vec2 uv) { return texture(uSrc, clamp(uv, 0., 1.)).rgb; }
float lum(vec2 uv) { return dot(src(uv), vec3(0.299, 0.587, 0.114)); }
float sobel(vec2 uv, float d) {
  vec2 t = d / uSize;
  float tl = lum(uv + vec2(-t.x, t.y)), tc = lum(uv + vec2(0., t.y)), tr = lum(uv + t);
  float ml = lum(uv - vec2(t.x, 0.)), mr = lum(uv + vec2(t.x, 0.));
  float bl = lum(uv - t), bc = lum(uv - vec2(0., t.y)), br = lum(uv + vec2(t.x, -t.y));
  float gx = -tl - 2. * ml - bl + tr + 2. * mr + br;
  float gy = -bl - 2. * bc - br + tl + 2. * tc + tr;
  return length(vec2(gx, gy));
}
// Fixed 9x9 taps (81) whose spacing grows with the radius: a large brush costs the same
// as a small one, so a slow TV GPU can't time out on a big photo.
vec3 kuwahara(vec2 uv, float r) {
  vec2 tx = (r / 4.) / uSize;
  vec3 m0 = vec3(0.), m1 = vec3(0.), m2 = vec3(0.), m3 = vec3(0.);
  vec3 s0 = vec3(0.), s1 = vec3(0.), s2 = vec3(0.), s3 = vec3(0.);
  for (int j = -4; j <= 4; j++) {
    for (int i = -4; i <= 4; i++) {
      vec3 c = src(uv + vec2(float(i), float(j)) * tx);
      vec3 c2 = c * c;
      if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
      if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
      if (i <= 0 && j >= 0) { m2 += c; s2 += c2; }
      if (i >= 0 && j >= 0) { m3 += c; s3 += c2; }
    }
  }
  const float n = 25.;
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  float v0 = dot(abs(s0 / n - m0 * m0), vec3(1.)), v1 = dot(abs(s1 / n - m1 * m1), vec3(1.));
  float v2 = dot(abs(s2 / n - m2 * m2), vec3(1.)), v3 = dot(abs(s3 / n - m3 * m3), vec3(1.));
  vec3 best = m0; float bv = v0;
  if (v1 < bv) { best = m1; bv = v1; }
  if (v2 < bv) { best = m2; bv = v2; }
  if (v3 < bv) { best = m3; }
  return best;
}
void main() {
  float k = clamp(uAmount, 0., 1.);
  float sc = uSize.y / 800.;
  vec2 p = vUv * uSize;
  vec3 c = src(vUv);
  if (uStyle == 1) {
    float r = min(float(uMaxR), 2. + k * 6. * max(sc, 0.5));
    c = kuwahara(vUv, r);
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 1.15 + 0.15 * k);
  } else if (uStyle == 2) {
    vec2 asp = vec2(uSize.x / uSize.y, 1.);
    vec2 warp = (vec2(fbm(vUv * asp * 6.), fbm(vUv * asp * 6. + 3.7)) - 0.5) * 0.012 * k;
    vec3 acc = vec3(0.);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++)
      acc += src(vUv + warp + vec2(float(i), float(j)) * (1. + k * 3.) * sc / uSize);
    c = acc / 9.;
    c = mix(c, floor(c * 5. + 0.5) / 5., 0.35 * k);
    float e = sobel(vUv + warp, (1. + k * 2.) * max(sc, 0.5));
    c *= 1. - clamp(e * 2., 0., 1.) * 0.55 * k;
    c = mix(c, vec3(1.), 0.1 + 0.1 * k);
    c *= 0.92 + 0.08 * fbm(p / (40. * sc));
    c *= 0.95 + 0.05 * noise(p / (3. * sc));
  } else if (uStyle == 3) {
    float l = 0.;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) l += lum(vUv + vec2(float(i), float(j)) * sc / uSize);
    l /= 9.;
    float sp = (6. + (1. - k) * 3.) * max(sc, 0.5);
    float w = 1.1 * max(sc, 0.5);
    float h1 = 1. - smoothstep(w * 0.5, w * 0.5 + 1., abs(fract((p.x + p.y) / (sp * 1.4)) - 0.5) * sp * 1.4);
    float h2 = 1. - smoothstep(w * 0.5, w * 0.5 + 1., abs(fract((p.x - p.y) / (sp * 1.4)) - 0.5) * sp * 1.4);
    float h3 = 1. - smoothstep(w * 0.5, w * 0.5 + 1., abs(fract(p.y / sp) - 0.5) * sp);
    float hatch = max(h1 * (1. - smoothstep(0.5, 0.72, l)), max(h2 * (1. - smoothstep(0.3, 0.48, l)), h3 * (1. - smoothstep(0.12, 0.26, l))));
    float e = smoothstep(0.08, 0.35, sobel(vUv, 1.5 * max(sc, 0.5)));
    float ink = clamp(max(e, hatch * 0.85), 0., 1.) * (0.75 + 0.25 * noise(p * 0.5));
    vec3 paper = vec3(0.96, 0.95, 0.92) * (0.95 + 0.05 * fbm(p / (30. * sc)));
    c = mix(paper, vec3(0.22, 0.22, 0.26), ink * (0.6 + 0.4 * k));
  } else if (uStyle == 4) {
    float cell = (5. + k * 9.) * max(sc, 0.4);
    vec3 col = vec3(0.95, 0.93, 0.88);
    for (int layer = 0; layer < 2; layer++) {
      vec2 off = vec2(float(layer) * cell * 0.5);
      vec2 id = floor((p + off) / cell);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 cid = id + vec2(float(i), float(j));
        vec2 ctr = (cid + 0.5 + (hash22(cid + float(layer) * 17.) - 0.5) * 0.7) * cell - off;
        vec3 cc = src(ctr / uSize);
        float cl = dot(cc, vec3(0.299, 0.587, 0.114));
        cc = clamp(mix(vec3(cl), cc, 1.45), 0., 1.);
        float r = cell * (0.42 + 0.12 * hash21(cid + 3.));
        float a = smoothstep(r, r - 1.2, length(p - ctr));
        col = mix(col, cc, a * 0.9);
      }
    }
    c = col;
  }
  o = vec4(clamp(c, 0., 1.), 1.);
}`;

// Photo / video pass: fit, frame, mat, canvas texture and the "painting itself" reveal.
// Frame and mat widths are fractions of the surface's shorter side, using the surface's true
// aspect (uAspect), not the render target's, so the frame is equally thick on every side.
export const MEDIA_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform float uAspect, uFit, uIntensity, uHue, uFrameW, uMatW, uPaint, uWeave;
uniform int uFrame; // 0 none, 1 wood, 2 gold, 3 gallery, 4 canvas, 5 polaroid
uniform vec3 uFrameColor, uMatColor;
${PHOTO_HELPERS}
vec3 hueShift(vec3 c, float h) {
  const vec3 k = vec3(0.57735);
  float ca = cos(h * 6.28318531);
  return c * ca + cross(k, c) * sin(h * 6.28318531) + k * dot(k, c) * (1. - ca);
}
const vec2 LIGHT = vec2(-0.7071, 0.7071); // from the top-left
vec3 photoAt(vec2 puv, vec2 area) {
  float ra = area.x / max(area.y, 1e-5);
  float ta = uTexSize.x / max(uTexSize.y, 1.);
  vec2 s = vec2(1.);
  if (uFit < 0.5) s = ra > ta ? vec2(1., ta / ra) : vec2(ra / ta, 1.);
  else if (uFit < 1.5) s = ra > ta ? vec2(ra / ta, 1.) : vec2(1., ta / ra);
  vec2 uv = (puv - 0.5) * s + 0.5;
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) return vec3(-1.); // letterbox
  return texture(uTex, vec2(uv.x, 1. - uv.y)).rgb;
}
float mirror1(float x) { return x < 0. ? -x : (x > 1. ? 2. - x : x); }

vec3 frameColor(float along, float across, vec2 dir, float seed) {
  float lit = dot(-dir, LIGHT);
  vec3 c = uFrameColor;
  if (uFrame == 1) { // wood: grain runs along each side, rounded profile, inner lip
    float g = fbm(vec2(along * 3., across * 2. + seed * 7.));
    float grain = 0.5 + 0.5 * sin((across * 9. + g * 5. + along * 0.4) * 6.2831);
    float fine = noise(vec2(along * 120., across * 6. + seed * 3.));
    c *= mix(0.7, 1.12, grain) * (0.92 + 0.12 * fine);
    c *= 0.85 + 0.45 * lit * cos(across * 3.14159);
    c += uFrameColor * 0.25 * smoothstep(0.84, 0.93, across) * (1. - smoothstep(0.93, 1., across));
    c *= smoothstep(0., 0.05, across) * 0.6 + 0.4;
  } else if (uFrame == 2) { // gold: three ridges, beading, specular
    float slope = cos(across * 9.42478);
    float l = lit * slope;
    vec3 base = c * (0.5 + 0.6 * (0.5 + 0.5 * l));
    float bead = 0.5 + 0.5 * sin(along * 95.);
    float beadMask = smoothstep(0.36, 0.4, across) * (1. - smoothstep(0.6, 0.64, across));
    base *= mix(1., 0.7 + 0.55 * bead, beadMask);
    base += vec3(1., 0.93, 0.7) * pow(max(l, 0.), 6.) * 0.8;
    base *= 0.94 + 0.08 * fbm(vec2(along, across) * 25. + seed);
    c = base * (smoothstep(0., 0.04, across) * 0.5 + 0.5);
  } else if (uFrame == 3) { // gallery: flat, slight sheen
    c *= 0.9 + 0.3 * lit * cos(across * 3.14159) + 0.08 * fbm(vec2(along * 8., across));
  } else if (uFrame == 5) { // polaroid paper
    c *= 0.96 + 0.04 * fbm(vec2(along, across) * 40. + seed);
    c *= 1. - 0.12 * smoothstep(0.82, 1., across);
  }
  return c;
}

void main() {
  vec2 size = uAspect >= 1. ? vec2(uAspect, 1.) : vec2(1., 1. / uAspect);
  vec2 q = vUv * size;
  // Fine textures (canvas threads, mat paper) fade out when they'd be under ~3 px, e.g. on a
  // small preview, instead of aliasing into moiré.
  float fine = 1. - smoothstep(0.08, 0.16, fwidth(q.x) * 380. / 6.2831);
  float fw = uFrame == 0 ? 0. : uFrameW;
  vec4 b = vec4(fw); // left, right, bottom, top
  if (uFrame == 5) b.z = fw * 3.2;
  float mw = (uFrame >= 1 && uFrame <= 3) ? uMatW : 0.;
  vec2 pmin = vec2(b.x + mw, b.z + mw);
  vec2 pmax = size - vec2(b.y + mw, b.w + mw);
  vec2 area = max(pmax - pmin, vec2(1e-4));
  vec2 puv = (q - pmin) / area;

  float rl = q.x / max(b.x, 1e-5), rr = (size.x - q.x) / max(b.y, 1e-5);
  float rb = q.y / max(b.z, 1e-5), rt = (size.y - q.y) / max(b.w, 1e-5);
  float rmin = min(min(rl, rr), min(rb, rt));
  bool inPhoto = q.x >= pmin.x && q.x <= pmax.x && q.y >= pmin.y && q.y <= pmax.y;
  vec3 col;

  if (fw > 0. && rmin < 1.) {
    float along; vec2 dir; float seed; float sideShade;
    if (rmin == rl)      { along = q.y; dir = vec2(1., 0.);  seed = 1.; sideShade = 0.62; }
    else if (rmin == rr) { along = q.y; dir = vec2(-1., 0.); seed = 2.; sideShade = 0.42; }
    else if (rmin == rb) { along = q.x; dir = vec2(0., 1.);  seed = 3.; sideShade = 0.38; }
    else                 { along = q.x; dir = vec2(0., -1.); seed = 4.; sideShade = 0.75; }
    if (uFrame == 4) { // stretched canvas: the photo wraps around the sides
      vec3 c = photoAt(vec2(mirror1(puv.x), mirror1(puv.y)), area);
      if (c.x < 0.) c = vec3(0.);
      col = c * sideShade * mix(0.75, 1., rmin) * (1. - 0.5 * smoothstep(0.9, 1., rmin));
    } else {
      col = frameColor(along, rmin, dir, seed);
    }
  } else if (!inPhoto) { // mat (passe-partout) with a bevelled inner cut
    col = uMatColor * (0.97 + 0.03 * noise(q * 300.) * fine);
    float dIn = max(max(pmin.x - q.x, q.x - pmax.x), max(pmin.y - q.y, q.y - pmax.y));
    float bevel = 0.006;
    if (dIn < bevel) {
      vec2 n = (pmin.x - q.x) == dIn ? vec2(1., 0.) : (q.x - pmax.x) == dIn ? vec2(-1., 0.) : (pmin.y - q.y) == dIn ? vec2(0., 1.) : vec2(0., -1.);
      col = vec3(0.97) * (0.88 + 0.2 * dot(-n, LIGHT));
    }
    float dOut = min(min(q.x - b.x, size.x - b.y - q.x), min(q.y - b.z, size.y - b.w - q.y));
    col *= 1. - 0.25 * exp(-max(dOut, 0.) / 0.012) * (fw > 0. ? 1. : 0.);
  } else {
    vec3 c = photoAt(puv, area);
    if (c.x < 0.) c = (fw > 0. || mw > 0.) ? uMatColor : vec3(0.); // letterbox bars take the mat colour inside a frame
    if (fw > 0. && mw <= 0. && uFrame != 4) {
      float dTop = (pmax.y - q.y), dLeft = (q.x - pmin.x);
      c *= (1. - 0.3 * exp(-dTop / 0.012)) * (1. - 0.22 * exp(-dLeft / 0.012));
    }
    if (uPaint >= 0.) {
      // Brush strokes follow a smooth direction field (no per-cell blocks); large regions are
      // blocked in first, and the order is spread over 0..1 so the painting fills in evenly.
      vec2 sp = puv * vec2(area.x / area.y, 1.);
      float a = fbm(sp * 1.3 + 7.1) * 6.2831;
      vec2 r = mat2(cos(a), sin(a), -sin(a), cos(a)) * sp;
      float stroke = noise(r * vec2(22., 4.)) * 0.6 + noise(r * vec2(45., 8.)) * 0.4;
      float order = smoothstep(0.26, 0.74, 0.6 * fbm(sp * 1.8 + 3.1) + 0.4 * stroke);
      float reveal = smoothstep(order - 0.04, order + 0.04, uPaint * 1.1 - 0.05);
      c = mix(vec3(0.93, 0.91, 0.86), c, reveal);
    }
    col = c;
  }
  // Canvas threads only on the painted surface (and the wrapped sides of a stretched canvas),
  // never on the mat or a wooden / gold frame.
  bool woven = inPhoto || (uFrame == 4 && fw > 0. && rmin < 1.);
  if (uWeave > 0. && woven) col *= 1. - uWeave * fine * 0.1 * (0.5 + 0.5 * sin(q.x * 380.) * sin(q.y * 380.));
  outColor = vec4(max(hueShift(col, uHue) * uIntensity, 0.), 1.);
}`;

// ---------- user-written effects ----------
const COMMON_OFFSET = COMMON.split('\n').length - 1; // lines before the user's first line

export function customFragmentSource(glsl) {
  return COMMON + String(glsl) + '\n' + MAIN;
}

/**
 * Convert a WebGL shader info log into errors relative to the user's code.
 * Errors that fall after the user's last line are in our main(): usually a missing
 * effect() function or unbalanced braces.
 */
export function parseShaderErrors(log, glsl) {
  const userLines = String(glsl).split('\n').length;
  const out = [];
  for (const raw of String(log || '').split('\n')) {
    const m = raw.match(/ERROR:\s*\d+:(\d+):\s*(.*)$/);
    if (!m) continue;
    const line = Number(m[1]) - COMMON_OFFSET;
    if (line >= 1 && line <= userLines) out.push({ line, message: m[2].trim() });
    else out.push({ line: null, message: `${m[2].trim()} — ¿falta la función effect() o hay llaves sin cerrar? / missing effect() or unbalanced braces?` });
  }
  if (!out.length && log) out.push({ line: null, message: String(log).trim().slice(0, 300) });
  return out;
}

/** Small stable hash used to cache compiled custom programs. */
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
