# Architecture / Arquitectura

## Overview

```
server/            Node.js (Express + ws) — no build step
  index.js         HTTP/HTTPS servers, REST API, static files, mDNS, self-signed cert
  hub.js           Real-time WebSocket hub (displays ⇄ controllers), playlist scheduler
  store.js         Atomic JSON-file storage (data/ volume)
public/            Browser code — plain ES modules, no bundler
  index.html       Controller (phone / desktop)
  display.html     Display (projector / TV)
  js/core/         Shared by browser AND server: catalog, homography, i18n, net, audio
  js/engine/       WebGL2 engine: renderer, effect shaders, GPU particles
  js/controller/   Controller UI: panels, drag handles, thumbnails
  js/display/      Display runtime
android-tv/        Kotlin WebView wrapper with mDNS discovery
test/              node:test unit tests
```

No bundler on purpose: anyone can clone, edit a `.js` file and reload.

## State model

Each display owns one **state** document (persisted in `data/displays/<id>.json`):

```js
{
  sceneId, sceneName,
  master:   { brightness, blackout },
  surfaces: [{ id, name, visible, corners: [[x,y]×4], effect, params, particles, media, opacity, feather, blend }],
  masks:    [{ id, name, enabled, mode: 'exclude'|'include', feather, points: [[x,y]…] }],
  output:   { keystone: [[x,y]×4], flipX, flipY, brightness, contrast, gamma, saturation, temperature,
              vignette, edgeBlend: { left, right, top, bottom, gamma }, renderScale, autoQuality, testPattern, showFps },
  audio:    { mode: 'off'|'bpm'|'remote'|'mic', bpm },
}
```

All coordinates are normalised (0..1, y down). Corners are ordered TL, TR, BR, BL.

- **Surface corners** live in *scene space* (before keystone).
- **Masks** live in *output space* (after keystone, as the audience sees it).
- **Flip** is applied last, only on the display (the controller preview shows the audience view).

Scenes (`data/scenes/*.json` and the built-in `PRESET_SCENES`) hold surfaces + masks + audio. Applying a scene in
**content** mode (`applyScene` in `catalog.js`) swaps only what is shown and keeps every corner, mask and optic setting —
so calibrating once is enough.

## Render pipeline (`engine/renderer.js`)

1. **Surface pass** — for each surface, the effect fragment shader renders into an offscreen target sized to the
   surface's on-screen footprint. If particles are enabled, a `ParticleSystem` advances with transform feedback and is
   drawn additively into a second persistent target that fades each frame (trails).
2. **Compose pass** — each surface is drawn full-screen; the fragment shader applies the inverse homography of its
   corners to find the source UV (perspective-correct corner pin), with anti-aliased / feathered edges.
3. **Output pass** — the scene is warped through the inverse keystone homography, colour-corrected, multiplied by the
   mask texture (polygons rasterised with blur on a 2D canvas), edge-blended, flipped and faded. Scene changes
   cross-fade from a snapshot.

Auto quality lowers the internal resolution if the display can't hold ~45 fps and raises it back when it can.

## Protocol (WebSocket `/ws`, JSON)

| From | Message | Meaning |
|---|---|---|
| any | `hello {role, id?, name?, w?, h?, token?}` | identify |
| display | `init-state {state}` | seed state if the server has none |
| display | `stats {fps, w, h, renderScale}` | relayed to controllers |
| controller | `subscribe {displayId}` | receive that display's state |
| controller | `state {displayId, state}` | replace state (persisted + relayed) |
| controller | `apply-scene {displayIds, sceneId, mode}` | server-side scene application |
| controller | `audio {displayId, v:[level,bass,mid,high]}` | live audio levels (not persisted) |
| controller | `cmd {displayId, cmd, value}` | `identify`, `reload`, `guides`, `info` |
| controller | `rename`, `forget`, `playlist` | display management |

## Adding an effect

1. Add GLSL in `public/js/engine/effects-glsl.js`:
   ```glsl
   vec3 effect(vec2 uv, vec2 p, float t) { return pal(fbm(p + t * .1)); }
   ```
   Helpers: `noise`, `fbm`, `hash21`, `hash22`, `pal(t)` (3-colour palette), `bass()`, `level()`, uniforms `uP1`, `uP2`.
2. Add metadata in `public/js/core/catalog.js` (`EFFECTS`): names (es/en), category, palette, labels for p1/p2.
3. `npm test` checks the two lists match. Thumbnails are generated automatically (bump `KEY` in `thumbs.js`).

## Adding a particle system

Add a mode to `PARTICLES` in `catalog.js` (order = mode index), then implement its `spawn` branch, update branch and
render branch in `engine/particles.js`.
