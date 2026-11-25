import { test } from 'node:test';
import assert from 'node:assert/strict';
import { squareToQuad, invert3, apply, quadToQuad, isConvex, UNIT_QUAD } from '../public/js/core/homography.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('unit square maps onto each quad corner', () => {
  const q = [[0.1, 0.2], [0.9, 0.05], [0.8, 0.95], [0.15, 0.7]];
  const m = squareToQuad(q);
  UNIT_QUAD.forEach((p, i) => {
    const r = apply(m, p);
    close(r[0], q[i][0]); close(r[1], q[i][1]);
  });
});

test('identity quad gives identity transform', () => {
  const m = squareToQuad(UNIT_QUAD);
  const r = apply(m, [0.37, 0.61]);
  close(r[0], 0.37); close(r[1], 0.61);
});

test('inverse round-trips', () => {
  const m = squareToQuad([[0.2, 0.1], [1.1, 0.3], [0.9, 1], [0, 0.8]]);
  const inv = invert3(m);
  for (const p of [[0.5, 0.5], [0.1, 0.9], [0.77, 0.03]]) {
    const r = apply(inv, apply(m, p));
    close(r[0], p[0], 1e-7); close(r[1], p[1], 1e-7);
  }
});

test('quadToQuad maps corners', () => {
  const a = [[0, 0], [2, 0], [2, 1], [0, 1]];
  const b = [[1, 1], [3, 1.5], [2.5, 3], [0.5, 2]];
  const m = quadToQuad(a, b);
  a.forEach((p, i) => { const r = apply(m, p); close(r[0], b[i][0], 1e-7); close(r[1], b[i][1], 1e-7); });
});

test('convexity check', () => {
  assert.equal(isConvex(UNIT_QUAD), true);
  assert.equal(isConvex([[0, 0], [1, 1], [1, 0], [0, 1]]), false); // bow-tie
});
