// Perspective (projective) transforms used for corner-pin mapping and keystone.
// Pure functions: shared by the browser engine, the controller UI and Node tests.
//
// Coordinates are normalized output space: (0,0) = top-left, (1,1) = bottom-right.
// Quads are always ordered TL, TR, BR, BL.

/** Matrix (row-major, 9 numbers) mapping the unit square onto quad q. */
export function squareToQuad(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    // Affine (parallelogram)
    a = x1 - x0; b = x3 - x0; c = x0;
    d = y1 - y0; e = y3 - y0; f = y0;
    g = 0; h = 0;
  } else {
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const det = dx1 * dy2 - dx2 * dy1 || 1e-12;
    g = (sx * dy2 - dx2 * sy) / det;
    h = (dx1 * sy - sx * dy1) / det;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  return [a, b, c, d, e, f, g, h, 1];
}

export function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  let det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) det = 1e-12;
  const inv = 1 / det;
  return [
    A * inv, -(b * i - c * h) * inv, (b * f - c * e) * inv,
    B * inv, (a * i - c * g) * inv, -(a * f - c * d) * inv,
    C * inv, -(a * h - b * g) * inv, (a * e - b * d) * inv,
  ];
}

export function multiply3(m, n) {
  const r = new Array(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      r[row * 3 + col] = m[row * 3] * n[col] + m[row * 3 + 1] * n[3 + col] + m[row * 3 + 2] * n[6 + col];
    }
  }
  return r;
}

export function apply(m, [x, y]) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

/** Row-major -> column-major Float32Array for gl.uniformMatrix3fv(loc, false, ...). */
export function toGL(m) {
  return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
}

/** Matrix mapping quad `from` onto quad `to`. */
export function quadToQuad(from, to) {
  return multiply3(squareToQuad(to), invert3(squareToQuad(from)));
}

export const UNIT_QUAD = Object.freeze([[0, 0], [1, 0], [1, 1], [0, 1]]);

/** True if the quad is convex and non-degenerate (renders correctly). */
export function isConvex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4], [cx, cy] = q[(i + 2) % 4];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}
