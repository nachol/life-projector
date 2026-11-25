// GPU particle systems simulated with WebGL2 transform feedback.
// Each particle: aPos = (x, y, z, age), aVel = (vx, vy, vz, lifespan).
// Simulation space: x in [-aspect, aspect], y in [-1, 1] (y up).
import { Program } from './gl.js';

const HASH = `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float h3(vec3 i) {
  uvec3 u = uvec3(ivec3(i) + ivec3(32768));
  return float(pcg(u.x + pcg(u.y + pcg(u.z)))) / 4294967295.;
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

const UPDATE_VS = `#version 300 es
precision highp float;
in vec4 aPos;
in vec4 aVel;
out vec4 vPos;
out vec4 vVel;
uniform float uTime, uDt, uSpeed, uP1, uP2, uAspect, uBass, uLevel;
uniform int uMode;
${HASH}
uint seed;
float rnd() { seed = pcg(seed); return float(seed) / 4294967295.; }
vec2 curl2(vec2 p, float t) {
  float e = 0.05;
  float n1 = vnoise(vec3(p + vec2(0., e), t)), n2 = vnoise(vec3(p - vec2(0., e), t));
  float n3 = vnoise(vec3(p + vec2(e, 0.), t)), n4 = vnoise(vec3(p - vec2(e, 0.), t));
  return vec2(n1 - n2, -(n3 - n4)) / (2. * e);
}
const float TAU = 6.2831853;

void spawn(inout vec3 pos, inout vec3 vel, inout float age, inout float life, bool first) {
  float A = uAspect;
  age = 0.;
  if (uMode == 0) { // flow
    pos = vec3((rnd() * 2. - 1.) * A, rnd() * 2. - 1., rnd());
    vel = vec3(0.); life = 2. + rnd() * 6.;
  } else if (uMode == 1) { // galaxy
    float arms = 2. + floor(uP1 * 5.);
    float r = pow(rnd(), 0.6) * 1.1;
    float arm = floor(rnd() * arms) / arms * TAU;
    float spread = (rnd() - 0.5) * (0.6 + 0.9 * (1. - r)) * (0.5 + rnd()) + (rnd() - 0.5) * 0.3;
    float a = arm + r * 3.5 + spread;
    if (rnd() < 0.18) { r = pow(rnd(), 2.) * 0.25; a = rnd() * TAU; }
    pos = vec3(cos(a) * r, sin(a) * r, rnd());
    vel = vec3(0.); life = 1e9;
  } else if (uMode == 2) { // fireflies
    pos = vec3((rnd() * 2. - 1.) * A, rnd() * 2. - 1., rnd());
    vel = vec3((rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.1, 0.); life = 6. + rnd() * 10.;
  } else if (uMode == 3) { // snow
    pos = vec3((rnd() * 2.4 - 1.2) * A, first ? rnd() * 2.2 - 1.1 : 1.08, rnd());
    vel = vec3(0.); life = 1e9;
  } else if (uMode == 4) { // embers
    float sp = 0.2 + uP2 * 0.9;
    pos = vec3((rnd() + rnd() - 1.) * A * sp, -1.05 - rnd() * 0.05, rnd());
    vel = vec3((rnd() - 0.5) * 0.1, 0.15 + rnd() * 0.5, 0.); life = 1.5 + rnd() * 3.5;
  } else if (uMode == 5) { // rain
    pos = vec3((rnd() * 2.6 - 1.3) * A, first ? rnd() * 2.2 - 1.1 : 1.1 + rnd() * 0.2, rnd());
    vel = vec3(0., -(1.6 + rnd() * 1.2), 0.); life = 1e9;
  } else if (uMode == 6) { // attractor (Aizawa)
    pos = vec3((rnd() - 0.5) * 2., (rnd() - 0.5) * 2., (rnd() - 0.5) * 2.);
    vel = vec3(0.); life = 8. + rnd() * 30.;
  } else if (uMode == 7) { // vortex
    float a = rnd() * TAU;
    float r = (first ? 0.15 + sqrt(rnd()) * 1.45 : 1.0 + rnd() * 0.6) * max(A, 1.);
    pos = vec3(cos(a) * r, sin(a) * r, rnd());
    vel = vec3(0.); life = 1e9;
  } else if (uMode == 8) { // fountain
    pos = vec3((rnd() - 0.5) * 0.04, -1.02, rnd());
    float spread = 0.15 + uP1 * 0.9;
    vel = vec3((rnd() - 0.5) * spread, 1.6 + rnd() * 0.8 + uBass * 0.8, 0.); life = 1e9;
  } else { // bokeh
    pos = vec3((rnd() * 2. - 1.) * A, rnd() * 2. - 1., rnd());
    vel = vec3((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.05 + 0.01, 0.); life = 8. + rnd() * 12.;
  }
  if (first && life < 1e8) age = rnd() * life;
}

void main() {
  seed = pcg(uint(gl_VertexID) * 1973u + floatBitsToUint(uTime) * 9277u + 26699u);
  vec3 pos = aPos.xyz; float age = aPos.w;
  vec3 vel = aVel.xyz; float life = aVel.w;
  float A = uAspect;
  float dt = uDt;
  float sp = (0.15 + uSpeed * 1.7) * (1. + uBass * 1.2);
  bool first = life <= 0.;
  if (first || age >= life) spawn(pos, vel, age, life, first);
  age += dt;
  float t = mod(uTime, 1000.);

  if (uMode == 0) {
    vec2 c = curl2(pos.xy * (0.6 + uP1 * 3.) + 10., t * 0.08 * (0.5 + uP2));
    vel.xy = mix(vel.xy, c * 0.18, 0.12);
    pos.xy += vel.xy * dt * sp;
    if (abs(pos.x) > A * 1.05 || abs(pos.y) > 1.05) age = life;
  } else if (uMode == 1) {
    float r = length(pos.xy) + 0.02;
    float w = 0.35 / pow(r + 0.12, 0.8);
    float a = w * dt * sp;
    pos.xy = mat2(cos(a), sin(a), -sin(a), cos(a)) * pos.xy;
  } else if (uMode == 2) {
    vec2 n = curl2(pos.xy * 1.5 + float(gl_VertexID % 7), t * 0.2) * (0.2 + uP1);
    vel.xy = mix(vel.xy, n * 0.15, 0.03);
    pos.xy += vel.xy * dt * sp;
    if (abs(pos.x) > A * 1.1 || abs(pos.y) > 1.1) age = life;
  } else if (uMode == 3) {
    float wind = (uP1 - 0.5) * 0.6;
    float sway = sin(t * (0.6 + pos.z) + float(gl_VertexID % 97)) * 0.12 * uP2;
    pos.x += (wind + sway) * dt * sp;
    pos.y -= (0.08 + pos.z * 0.22) * dt * sp;
    if (pos.y < -1.1) { age = 0.; life = 0.0001; spawn(pos, vel, age, life, false); }
    if (pos.x > A * 1.25) pos.x -= A * 2.5;
    if (pos.x < -A * 1.25) pos.x += A * 2.5;
  } else if (uMode == 4) {
    vec2 c = curl2(pos.xy * 2.5, t * 0.5) * (0.05 + uP1 * 0.4);
    vel.xy += c * dt;
    vel.y += 0.05 * dt;
    vel *= 0.995;
    pos.xy += vel.xy * dt * sp;
  } else if (uMode == 5) {
    float wind = (uP1 - 0.5) * 1.2;
    pos.x += wind * dt * sp;
    pos.y += vel.y * dt * sp * (0.6 + pos.z * 0.6);
    if (pos.y < -1.15) { age = 0.; life = 0.0001; spawn(pos, vel, age, life, false); }
    if (pos.x > A * 1.35) pos.x -= A * 2.7;
    if (pos.x < -A * 1.35) pos.x += A * 2.7;
  } else if (uMode == 6) {
    const float a = .95, b = .7, c = .6, d = 3.5, e = .25, f = .1;
    vec3 p = pos;
    vec3 dp = vec3((p.z - b) * p.x - d * p.y,
                   d * p.x + (p.z - b) * p.y,
                   c + a * p.z - p.z * p.z * p.z / 3. - (p.x * p.x + p.y * p.y) * (1. + e * p.z) + f * p.z * p.x * p.x * p.x);
    float h = min(dt, 0.033) * sp * 0.9;
    pos += dp * h;
    if (length(pos) > 4.) age = life;
  } else if (uMode == 7) {
    float r = length(pos.xy) + 1e-3;
    vec2 dir = -pos.xy / r;
    vec2 tang = vec2(-dir.y, dir.x);
    vec2 v = dir * (0.05 + uP1 * 0.5) / (0.4 + r) + tang * (0.2 + uP2 * 1.2) / (0.25 + r);
    v += curl2(pos.xy * 3., t * 0.3) * 0.03;
    pos.xy += v * dt * sp;
    if (r < 0.03) { age = 0.; life = 0.0001; spawn(pos, vel, age, life, false); }
  } else if (uMode == 8) {
    vel.y -= (0.5 + uP2 * 2.) * dt * sp;
    pos.xy += vel.xy * dt * sp * 0.7;
    if (pos.y < -1.1) { age = 0.; life = 0.0001; spawn(pos, vel, age, life, false); }
  } else {
    vec2 n = curl2(pos.xy * 0.6, t * 0.05) * 0.04 * (0.3 + uP1 * 2.);
    pos.xy += (vel.xy + n) * dt * sp;
  }
  vPos = vec4(pos, age);
  vVel = vec4(vel, life);
}`;

const UPDATE_FS = `#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.); }`;

const RENDER_VS = `#version 300 es
precision highp float;
in vec4 aPos;
in vec4 aVel;
uniform float uAspect, uSize, uTime, uP1, uP2, uPx, uBass, uHigh;
uniform int uMode;
uniform vec3 uC1, uC2, uC3;
out vec3 vColor;
out float vAlpha;
out float vSoft;
${HASH}
vec3 pal(float t) {
  t = fract(t) * 3.;
  if (t < 1.) return mix(uC1, uC2, t);
  if (t < 2.) return mix(uC2, uC3, t - 1.);
  return mix(uC3, uC1, t - 2.);
}
void main() {
  vec3 pos = aPos.xyz;
  float age = aPos.w, life = max(aVel.w, 1e-3);
  float k = clamp(age / life, 0., 1.);
  float hid = float(pcg(uint(gl_VertexID))) / 4294967295.;
  float size = uSize * (0.5 + pos.z) * 3.;
  float alpha = 1.;
  vec3 color = pal(hid);
  vSoft = 0.;
  vec2 screen = pos.xy;

  if (life < 1e8) alpha = smoothstep(0., 0.12, k) * smoothstep(1., 0.75, k);

  if (uMode == 0) {
    color = pal(hid * 0.5 + pos.x * 0.1 + uTime * 0.02);
    size *= 0.8;
  } else if (uMode == 1) {
    float tilt = 0.35 + uP2 * 0.65;
    screen = vec2(pos.x, pos.y * tilt) * 0.95;
    float r = length(pos.xy);
    color = mix(uC3 * 1.5, pal(hid * 0.6 + r * 0.4), smoothstep(0., 0.35, r));
    alpha = 0.6 + 0.4 * hid;
    size *= 0.8 + (1. - r) * 0.6;
  } else if (uMode == 2) {
    float blink = pow(0.5 + 0.5 * sin(uTime * (1. + hid * 2.) + hid * 60.), 2. + uP2 * 10.);
    alpha *= blink * 1.8;
    size *= 3.5 + 3. * blink;
    vSoft = 1.;
    color = mix(uC2, uC3, hid);
  } else if (uMode == 3) {
    color = mix(uC3, vec3(1.), 0.5);
    alpha = 0.5 + 0.5 * pos.z;
    vSoft = 0.6;
  } else if (uMode == 4) {
    color = mix(uC3 * 1.6, uC1, smoothstep(0., 0.9, k));
    color = mix(color, uC2 * 1.3, smoothstep(0.1, 0.5, k) * (1. - smoothstep(0.5, 1., k)));
    size *= 1. - k * 0.6;
  } else if (uMode == 5) {
    color = mix(uC3, vec3(0.8, 0.9, 1.), 0.6);
    alpha = 0.35 + 0.5 * pos.z;
    size *= 4.;
    vSoft = -1.;
  } else if (uMode == 6) {
    float rot = uTime * (0.05 + uP2 * 0.3);
    vec3 p = pos - vec3(0., 0., 0.4);
    float c = cos(rot), s = sin(rot);
    p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
    p = vec3(p.x, p.z * 0.95 + p.y * 0.3, p.y);
    float zoom = 0.35 + uP1 * 0.5;
    screen = p.xy * zoom;
    color = pal(length(pos.xy) * 0.4 + pos.z * 0.3 + uTime * 0.01);
    size *= 0.6 + 0.4 * (p.z + 1.);
  } else if (uMode == 7) {
    float r = length(pos.xy);
    color = pal(r * 0.5 - uTime * 0.05 + hid * 0.2);
    alpha = smoothstep(0.02, 0.2, r);
  } else if (uMode == 8) {
    color = pal(hid * 0.3 + aVel.x + uTime * 0.03);
  } else {
    size *= 25. * (0.4 + hid);
    alpha *= 0.12 + 0.18 * pos.z;
    vSoft = uP2;
    color = pal(hid);
  }
  vColor = color * (1. + uBass * 0.8 + uHigh * 0.4);
  vAlpha = alpha;
  gl_PointSize = clamp(size * uPx, 1., 256.);
  gl_Position = vec4(screen.x / uAspect, screen.y, 0., 1.);
}`;

const RENDER_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
in float vSoft;
out vec4 o;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.;
  if (d > 1.) discard;
  float hard = smoothstep(1., 0.6, d);
  float soft = exp(-d * d * 4.);
  float bokeh = smoothstep(1., 0.85, d) * (0.6 + 0.4 * smoothstep(0.5, 0.95, d));
  float a = vSoft < -0.5
    ? smoothstep(0.09, 0.0, abs(c.x)) * (1. - abs(c.y) * 2.)
    : mix(hard * hard, soft, vSoft);
  o = vec4(vColor * a * vAlpha, 1.);
}`;

let shared = new WeakMap();
function programs(gl) {
  let p = shared.get(gl);
  if (!p) {
    p = {
      update: new Program(gl, UPDATE_VS, UPDATE_FS, ['vPos', 'vVel'], 'particles-update'),
      render: new Program(gl, RENDER_VS, RENDER_FS, null, 'particles-render'),
    };
    shared.set(gl, p);
  }
  return p;
}

export class ParticleSystem {
  constructor(gl, count) {
    this.gl = gl;
    this.progs = programs(gl);
    this.tf = gl.createTransformFeedback();
    this.count = 0;
    this.buffers = [];
    this.vaos = [];
    this.alloc(count);
    this.time = 0;
  }

  alloc(count) {
    const gl = this.gl;
    this.disposeBuffers();
    this.count = Math.max(1, Math.floor(count));
    const zero = new Float32Array(this.count * 4); // life = 0 => spawn on first update
    this.buffers = [0, 1].map(() => {
      const pos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, pos);
      gl.bufferData(gl.ARRAY_BUFFER, zero, gl.DYNAMIC_COPY);
      const vel = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vel);
      gl.bufferData(gl.ARRAY_BUFFER, zero, gl.DYNAMIC_COPY);
      return { pos, vel };
    });
    this.vaos = this.buffers.map((b) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.vel);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      return vao;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.src = 0;
    this.resetMode = null;
  }

  /** Re-spawn every particle (e.g. after a mode change). */
  reset() { this.alloc(this.count); }

  update(dt, cfg) {
    const gl = this.gl;
    const { update } = this.progs;
    const dst = 1 - this.src;
    this.time += dt;
    update.use()
      .f('uTime', this.time).f('uDt', Math.min(dt, 0.05)).f('uSpeed', cfg.speed)
      .f('uP1', cfg.p1).f('uP2', cfg.p2).f('uAspect', cfg.aspect)
      .f('uBass', cfg.bass || 0).f('uLevel', cfg.level || 0).i('uMode', cfg.modeIndex);
    gl.bindVertexArray(this.vaos[this.src]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.buffers[dst].pos);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.buffers[dst].vel);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    this.src = dst;
  }

  /** Draw into the currently bound framebuffer with additive blending. */
  draw(cfg) {
    const gl = this.gl;
    const { render } = this.progs;
    render.use()
      .f('uAspect', cfg.aspect).f('uSize', cfg.size).f('uTime', this.time)
      .f('uP1', cfg.p1).f('uP2', cfg.p2).f('uPx', cfg.px)
      .f('uBass', cfg.bass || 0).f('uHigh', cfg.high || 0).i('uMode', cfg.modeIndex)
      .v3('uC1', cfg.c1).v3('uC2', cfg.c2).v3('uC3', cfg.c3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.vaos[this.src]);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  disposeBuffers() {
    const gl = this.gl;
    for (const b of this.buffers) { gl.deleteBuffer(b.pos); gl.deleteBuffer(b.vel); }
    for (const v of this.vaos) gl.deleteVertexArray(v);
    this.buffers = [];
    this.vaos = [];
  }

  dispose() {
    this.disposeBuffers();
    this.gl.deleteTransformFeedback(this.tf);
  }
}
