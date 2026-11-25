import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyScene, defaultState, defaultSurface, normalizeState, PRESET_SCENES, EFFECTS, PARTICLES, PALETTES, defaultEffectParams } from '../public/js/core/catalog.js';
import { EFFECT_GLSL } from '../public/js/engine/effects-glsl.js';

test('every effect in the catalog has GLSL (except media)', () => {
  for (const id of Object.keys(EFFECTS)) if (id !== 'media') assert.ok(EFFECT_GLSL[id], id);
});

test('every effect palette exists', () => {
  for (const [id, e] of Object.entries(EFFECTS)) assert.ok(PALETTES[e.palette], id);
  for (const id of Object.keys(EFFECTS)) assert.equal(defaultEffectParams(id).colors.length, 3);
});

test('presets reference known effects and particles', () => {
  for (const s of PRESET_SCENES) for (const sf of s.surfaces) {
    assert.ok(EFFECTS[sf.effect], `${s.id}: ${sf.effect}`);
    assert.ok(PARTICLES[sf.particles.mode], `${s.id}: ${sf.particles.mode}`);
  }
});

test('content mode keeps calibration of every surface', () => {
  const st = defaultState();
  st.surfaces = [defaultSurface('a', [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]]), defaultSurface('b', [[0.5, 0.5], [0.9, 0.5], [0.9, 0.9], [0.5, 0.9]])];
  st.masks = [{ id: 'm', points: [[0, 0], [1, 0], [0, 1]] }];
  st.output.keystone = [[0.05, 0], [1, 0], [1, 1], [0, 1]];
  const fire = PRESET_SCENES.find((s) => s.id === 'preset-campfire');
  const next = applyScene(st, fire, 'content');
  assert.equal(next.surfaces.length, 2);
  assert.deepEqual(next.surfaces[1].corners, st.surfaces[1].corners);
  assert.equal(next.surfaces[0].effect, 'fire');
  assert.equal(next.surfaces[1].effect, 'fire');
  assert.deepEqual(next.masks, st.masks);
  assert.deepEqual(next.output.keystone, st.output.keystone);
  assert.equal(st.surfaces[0].effect, 'aurora', 'input not mutated');
});

test('full mode replaces surfaces but keeps optics', () => {
  const st = defaultState();
  st.output.flipX = true;
  const next = applyScene(st, PRESET_SCENES[1], 'full');
  assert.equal(next.surfaces[0].effect, PRESET_SCENES[1].surfaces[0].effect);
  assert.equal(next.output.flipX, true);
});

test('normalizeState repairs partial input', () => {
  const s = normalizeState({ surfaces: [{ id: 'x', effect: 'plasma' }], output: { flipY: true } });
  assert.equal(s.surfaces[0].params.colors.length, 3);
  assert.equal(s.output.flipY, true);
  assert.equal(s.output.edgeBlend.gamma, 2.2);
  assert.ok(Array.isArray(s.masks));
});
