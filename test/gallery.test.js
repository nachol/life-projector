import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gallerySchedule, kenBurns, normalizeMedia, GALLERY_MAX_ITEMS } from '../public/js/core/catalog.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('slot boundary is seamless: next becomes current with the same Ken Burns progress', () => {
  for (const [n, shuffle] of [[1, false], [4, false], [5, true], [7, true]]) {
    const S = 10, T = 2, eps = 1e-6;
    for (let k = 1; k < 30; k++) {
      const before = gallerySchedule(k * S - eps, n, S, T, shuffle, 42);
      const after = gallerySchedule(k * S + eps, n, S, T, shuffle, 42);
      assert.equal(before.next, after.cur, `n=${n} k=${k} photo`);
      near(before.nextProgress, after.curProgress);
      near(before.mix, 1); // fully blended into "next" ...
      near(after.mix, 0);  // ... which is now shown alone
      assert.equal(before.nextSlot, after.curSlot);
    }
  }
});

test('blend only happens in the last transition seconds', () => {
  const s = (e) => gallerySchedule(e, 3, 10, 2);
  assert.equal(s(0).mix, 0);
  assert.equal(s(7.9).mix, 0);
  near(s(9).mix, 0.5);
  assert.equal(s(5).cur, 0);
  assert.equal(s(15).cur, 1);
  assert.equal(s(35).cur, 0); // wraps
  assert.equal(gallerySchedule(-50, 3, 10, 2).cur, 0); // clock skew clamps
  assert.equal(gallerySchedule(5, 0, 10, 2), null);
});

test('cut transition never blends', () => {
  for (let e = 0; e < 40; e += 0.37) assert.equal(gallerySchedule(e, 3, 10, 0).mix, 0);
});

test('shuffle covers every photo per cycle and never repeats back to back', () => {
  for (const n of [3, 4, 6, 9]) {
    for (const seed of [1, 7, 12345]) {
      let prev = -1;
      for (let c = 0; c < 12; c++) {
        const seen = new Set();
        for (let r = 0; r < n; r++) {
          const cur = gallerySchedule((c * n + r) * 10 + 1, n, 10, 2, true, seed).cur;
          assert.notEqual(cur, prev, `n=${n} seed=${seed} repeat at cycle ${c}`);
          seen.add(cur);
          prev = cur;
        }
        assert.equal(seen.size, n);
      }
    }
  }
});

test('Ken Burns only zooms in and keeps the photo inside its box', () => {
  for (let slot = 0; slot < 50; slot++) {
    for (const p of [0, 0.3, 1]) {
      const [zoom, px, py] = kenBurns(slot, p, 1, 3);
      assert.ok(zoom >= 1);
      const half = 0.5 / zoom;
      for (const c of [0.5 + px - half, 0.5 + px + half, 0.5 + py - half, 0.5 + py + half]) assert.ok(c >= -1e-9 && c <= 1 + 1e-9);
    }
  }
  const [z0, x0, y0] = kenBurns(3, 0, 1);
  assert.equal(z0, 1); near(x0, 0); near(y0, 0); // a slide starts unzoomed and centred
});

test('gallery normalisation: images only, capped, clamped', () => {
  const m = normalizeMedia({ gallery: {
    enabled: true, seconds: 1, transitionSeconds: 99, kenBurns: 5, transition: 'bogus',
    items: [{ url: '/media/a.jpg' }, { url: '/media/b.mp4' }, { url: '/media/c.png', type: 'video' }, null, { url: 3 },
      ...Array.from({ length: 300 }, (_, i) => ({ url: `/media/p${i}.jpg` }))],
  } });
  const g = m.gallery;
  assert.equal(g.items[0].url, '/media/a.jpg');
  assert.ok(g.items.every((it) => !/\.mp4$/.test(it.url) && it.url !== '/media/c.png'));
  assert.equal(g.items.length, GALLERY_MAX_ITEMS);
  assert.equal(g.seconds, 2);
  assert.ok(g.transitionSeconds <= g.seconds * 0.6);
  assert.equal(g.kenBurns, 1);
  assert.equal(g.transition, 'fade');
  assert.equal(normalizeMedia({}).gallery.enabled, false);
});
