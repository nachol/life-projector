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

test('content mode carries custom shaders and drops stale ones', () => {
  const st = defaultState();
  const custom = { id: 'fx1', name: 'Mine', glsl: 'vec3 effect(vec2 uv, vec2 p, float t){return vec3(1.);}', p1Label: 'a', p2Label: 'b' };
  const sceneWithCustom = { id: 's1', name: 'x', surfaces: [{ ...defaultSurface('a'), effect: 'custom', custom }] };
  const next = applyScene(st, sceneWithCustom, 'content');
  assert.equal(next.surfaces[0].effect, 'custom');
  assert.deepEqual(next.surfaces[0].custom, custom);
  const back = applyScene(next, PRESET_SCENES[0], 'content');
  assert.equal(back.surfaces[0].effect, PRESET_SCENES[0].surfaces[0].effect);
  assert.equal(back.surfaces[0].custom, undefined);
});

test('sanitizeCustomEffect validates input', async () => {
  const { sanitizeCustomEffect, CUSTOM_GLSL_MAX } = await import('../public/js/core/catalog.js');
  assert.equal(sanitizeCustomEffect(null), null);
  assert.equal(sanitizeCustomEffect({ glsl: '   ' }), null);
  assert.equal(sanitizeCustomEffect({ glsl: 'x'.repeat(CUSTOM_GLSL_MAX + 1) }), null);
  const e = sanitizeCustomEffect({ id: '../evil', name: 'n', glsl: 'vec3 effect(vec2 a, vec2 b, float t){return vec3(0.);}', colors: ['#fff'] });
  assert.match(e.id, /^fx_/);
  assert.equal(e.colors, null);
});

test('shader error lines map to the user code', async () => {
  const { COMMON, parseShaderErrors } = await import('../public/js/engine/effects-glsl.js');
  const glsl = 'vec3 effect(vec2 uv, vec2 p, float t) {\n  return vec3(oops);\n}';
  const base = COMMON.split('\n').length - 1;
  const errs = parseShaderErrors(`ERROR: 0:${base + 2}: 'oops' : undeclared identifier\nERROR: 0:${base + 9}: 'effect' : no matching overloaded function found`, glsl);
  assert.equal(errs[0].line, 2);
  assert.match(errs[0].message, /oops/);
  assert.equal(errs[1].line, null);
});

test('pre-frame media state gets frame / art defaults', async () => {
  const { normalizeMedia } = await import('../public/js/core/catalog.js');
  const old = normalizeState({ surfaces: [{ id: 'x', effect: 'media', media: { url: '/media/a.jpg', type: 'image', fit: 'contain' } }] });
  const m = old.surfaces[0].media;
  assert.equal(m.url, '/media/a.jpg');
  assert.equal(m.fit, 'contain');
  assert.equal(m.frame.style, 'none');
  assert.equal(m.art.style, 'none');
  assert.equal(typeof m.frame.width, 'number');
  const partial = normalizeMedia({ frame: { style: 'gold' }, art: { style: 'bogus' } });
  assert.equal(partial.frame.style, 'gold');
  assert.equal(typeof partial.frame.mat, 'number');
  assert.equal(partial.art.style, 'none');
});
