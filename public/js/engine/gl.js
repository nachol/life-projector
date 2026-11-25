// Minimal WebGL2 helpers.

export class Program {
  constructor(gl, vsSrc, fsSrc, tfVaryings = null, label = 'program', { quiet = false } = {}) {
    this.gl = gl;
    this.label = label;
    const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, label, quiet);
    let fs;
    try { fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, label, quiet); } catch (e) { gl.deleteShader(vs); throw e; }
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.bindAttribLocation(p, 1, 'aVel');
    if (tfVaryings) gl.transformFeedbackVaryings(p, tfVaryings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const err = new Error(`[${label}] link error: ${log}`);
      err.log = log;
      throw err;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.p = p;
    this.locs = new Map();
  }
  use() { this.gl.useProgram(this.p); return this; }
  loc(name) {
    let l = this.locs.get(name);
    if (l === undefined) { l = this.gl.getUniformLocation(this.p, name); this.locs.set(name, l); }
    return l;
  }
  f(name, v) { const l = this.loc(name); if (l) this.gl.uniform1f(l, v); return this; }
  i(name, v) { const l = this.loc(name); if (l) this.gl.uniform1i(l, v); return this; }
  v2(name, x, y) { const l = this.loc(name); if (l) this.gl.uniform2f(l, x, y); return this; }
  v3(name, a) { const l = this.loc(name); if (l) this.gl.uniform3fv(l, a); return this; }
  v4(name, a) { const l = this.loc(name); if (l) this.gl.uniform4fv(l, a); return this; }
  m3(name, m) { const l = this.loc(name); if (l) this.gl.uniformMatrix3fv(l, false, m); return this; }
  attrib(name) { return this.gl.getAttribLocation(this.p, name); }
  dispose() { this.gl.deleteProgram(this.p); }
}

function compile(gl, type, src, label, quiet = false) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    if (!quiet) console.error(src.split('\n').map((l, i) => `${String(i + 1).padStart(4)}: ${l}`).join('\n'));
    const err = new Error(`[${label}] ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} compile error: ${log}`);
    err.log = log;
    throw err;
  }
  return s;
}

export class Target {
  constructor(gl, w, h) {
    this.gl = gl;
    this.tex = gl.createTexture();
    this.fb = gl.createFramebuffer();
    this.w = 0; this.h = 0;
    this.resize(w, h);
  }
  resize(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (w === this.w && h === this.h) return false;
    const gl = this.gl;
    this.w = w; this.h = h;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }
  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, this.w, this.h);
  }
  dispose() {
    this.gl.deleteTexture(this.tex);
    this.gl.deleteFramebuffer(this.fb);
  }
}

export const FULLSCREEN_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/** One big triangle covering the viewport. Attribute location 0. */
export function createFullscreenTriangle(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return {
    draw() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    },
  };
}

export function hexToRgb(hex) {
  const h = String(hex || '#ffffff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0'), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
