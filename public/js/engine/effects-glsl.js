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

// Shader that displays an image / video texture with cover/contain/stretch fit.
export const MEDIA_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uRes, uTexSize;
uniform float uFit, uIntensity, uHue;
${'' /* hue helper */}
vec3 hueShift(vec3 c, float h) {
  const vec3 k = vec3(0.57735);
  float ca = cos(h * 6.28318531);
  return c * ca + cross(k, c) * sin(h * 6.28318531) + k * dot(k, c) * (1. - ca);
}
void main() {
  vec2 uv = vUv;
  float ra = uRes.x / max(uRes.y, 1.);
  float ta = uTexSize.x / max(uTexSize.y, 1.);
  vec2 s = vec2(1.);
  if (uFit < 0.5) { // cover
    s = ra > ta ? vec2(1., ta / ra) : vec2(ra / ta, 1.);
  } else if (uFit < 1.5) { // contain
    s = ra > ta ? vec2(ra / ta, 1.) : vec2(1., ta / ra);
  }
  uv = (uv - 0.5) * s + 0.5;
  vec3 col = vec3(0.);
  if (uv.x >= 0. && uv.x <= 1. && uv.y >= 0. && uv.y <= 1.) col = texture(uTex, vec2(uv.x, 1. - uv.y)).rgb;
  outColor = vec4(hueShift(col, uHue) * uIntensity, 1.);
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
