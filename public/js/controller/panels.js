import { h, slider, select, checkbox, toast } from './ui.js';
import { t, lang } from '../core/i18n.js';
import {
  EFFECTS, PARTICLES, PALETTES, localized, defaultSurface, defaultEffectParams, defaultParticles,
  defaultMask, defaultOutput, uid, sceneFromState, customForSurface,
} from '../core/catalog.js';
import { thumb } from './thumbs.js';
import { api } from '../core/net.js';

const L = (v) => localized(v, lang);

export function renderPanel(app, body) {
  // The editor is re-attached, never rebuilt: emptying the body first would steal focus mid-typing.
  if (app.tab === 'create' && app.state) { app.editor.show(body); return; }
  body.replaceChildren();
  if (!app.state) {
    body.append(h('p', { class: 'muted' }, t('select_display')));
    return;
  }
  const fn = { scenes, effect, surfaces, masks, optics, audio, playlist }[app.tab] || scenes;
  body.append(...[fn(app)].flat());
}

/** Thumbnail image; placeholders are swapped in place when the image is generated. */
function thumbEl(key) {
  const src = key ? thumb(key) : null;
  return src ? h('img', { src, alt: '', 'data-thumb': key }) : h('div', { class: 'ph', 'data-thumb': key || '' });
}

export function fillThumb(key) {
  const src = thumb(key);
  if (!src) return;
  document.querySelectorAll(`.ph[data-thumb="${key}"]`).forEach((el) => el.replaceWith(h('img', { src, alt: '', 'data-thumb': key })));
}

function selectedSurface(app) {
  return app.state.surfaces.find((s) => s.id === app.sel.surface) || app.state.surfaces[0];
}

// ---------------------------------------------------------------- scenes
function scenes(app) {
  const card = (sc, user) => {
    const key = sc.effect && sc.effect !== 'none' ? `fx:${sc.effect}` : `pt:${sc.particles}`;
    const active = app.state.sceneId === sc.id;
    return h('button', {
      type: 'button', class: `card${active ? ' active' : ''}`, title: t('apply_content'),
      onclick: () => app.applyScene(sc.id, 'content'),
    },
    thumbEl(key),
    h('span', { class: 'label' }, L(sc.name)),
    h('span', { class: 'tools' },
      h('button', { type: 'button', title: t('apply_full'), onclick: (e) => { e.stopPropagation(); app.applyScene(sc.id, 'full'); } }, '⤢'),
      user ? h('button', {
        type: 'button', title: t('delete'), onclick: async (e) => {
          e.stopPropagation();
          if (!confirm(`${t('delete')} "${sc.name}"?`)) return;
          await api(`/api/scenes/${sc.id}`, { method: 'DELETE' });
          app.refreshScenes();
        },
      }, '🗑') : null));
  };
  const nameInput = h('input', { type: 'text', placeholder: t('scene_name'), value: '' });
  const allDisplays = checkbox(lang === 'es' ? 'Aplicar a todas las pantallas en línea' : 'Apply to all online displays', app.applyAll, (v) => { app.applyAll = v; });
  return [
    h('div', { class: 'hint' }, lang === 'es'
      ? 'Toca un ambiente para aplicarlo manteniendo tu calibración. ⤢ reemplaza superficies y zonas.'
      : 'Tap an ambience to apply it while keeping your calibration. ⤢ replaces surfaces and zones.'),
    allDisplays,
    h('h3', {}, t('presets')),
    h('div', { class: 'gallery' }, app.scenes.presets.map((sc) => card(sc, false))),
    h('h3', {}, t('my_scenes')),
    app.scenes.user.length
      ? h('div', { class: 'gallery' }, app.scenes.user.map((sc) => card(sc, true)))
      : h('p', { class: 'muted small' }, '—'),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, nameInput),
      h('button', {
        type: 'button', class: 'btn primary', onclick: async () => {
          const name = nameInput.value.trim() || `${L(app.state.sceneName) || 'Escena'} ${new Date().toLocaleTimeString().slice(0, 5)}`;
          const id = uid('scn');
          const scene = sceneFromState(app.state, name);
          await api(`/api/scenes/${id}`, { method: 'PUT', json: scene });
          toast(t('saved'));
          app.refreshScenes();
        },
      }, t('save_scene'))),
  ];
}

// ---------------------------------------------------------------- effect
function effect(app) {
  const sf = selectedSurface(app);
  if (!sf) return h('p', { class: 'muted' }, '—');
  const fx = sf.effect === 'custom'
    ? { name: sf.custom?.name || 'Custom', p1: { label: sf.custom?.p1Label || 'P1' }, p2: { label: sf.custom?.p2Label || 'P2' } }
    : EFFECTS[sf.effect] || EFFECTS.none;
  const set = (fn, opts) => app.commit((st) => { const s = st.surfaces.find((x) => x.id === sf.id); if (s) fn(s); }, opts);
  const cats = ['all', 'ambient', 'nature', 'party', 'geometric', 'utility'];
  const cat = app.effectCat || 'all';
  const effects = Object.entries(EFFECTS).filter(([id, e]) => cat === 'all' || e.category === cat);

  const out = [];
  if (app.state.surfaces.length > 1) {
    out.push(h('div', { class: 'row' }, h('span', { class: 'muted' }, t('surfaces') + ':'),
      h('div', { class: 'grow' }, select(app.state.surfaces.map((s, i) => [s.id, `${i + 1}. ${s.name}`]), sf.id, (v) => app.select({ surface: v, point: null })))));
  }
  out.push(h('div', { class: 'chips' }, cats.map((c) => h('button', {
    type: 'button', class: `chip${c === cat ? ' active' : ''}`, onclick: () => { app.effectCat = c; app.renderPanels(); },
  }, t(c)))));
  out.push(h('div', { class: 'gallery', style: { marginTop: '10px' } }, effects.map(([id, e]) => {
    return h('button', {
      type: 'button', class: `card${sf.effect === id ? ' active' : ''}`,
      onclick: () => set((s) => {
        const keepColors = s.params?.colors;
        s.effect = id;
        delete s.custom;
        s.params = { ...defaultEffectParams(id), speed: s.params?.speed ?? 0.5, audio: s.params?.audio ?? 0.5 };
        if (app.keepPalette && keepColors) s.params.colors = keepColors;
      }),
    }, thumbEl(`fx:${id}`), h('span', { class: 'label' }, L(e.name)));
  })));
  const library = app.editor?.library || [];
  if (library.length && (cat === 'all' || cat === 'custom')) {
    out.push(h('h3', {}, t('my_effects')), h('div', { class: 'gallery' }, library.map((c) => h('button', {
      type: 'button', class: `card${sf.effect === 'custom' && sf.custom?.id === c.id ? ' active' : ''}`,
      onclick: () => set((s) => { s.effect = 'custom'; s.custom = customForSurface(c); }),
    },
    /^data:image\/(jpeg|png);base64,/.test(c.thumb || '') ? h('img', { src: c.thumb, alt: '' }) : h('div', { class: 'ph' }),
    h('span', { class: 'label' }, c.name)))));
  }
  out.push(h('button', { type: 'button', class: 'btn small', style: { marginTop: '8px' }, onclick: () => { app.setTab('create'); } }, '✎ ' + t('create') + '…'));
  out.push(checkbox(lang === 'es' ? 'Mantener paleta al cambiar efecto' : 'Keep palette when switching', !!app.keepPalette, (v) => { app.keepPalette = v; }));

  if (sf.effect === 'media') out.push(...mediaControls(app, sf, set));

  // parameters
  const p = sf.params;
  const sl = (key, label, o = {}) => slider(label, p[key] ?? o.def ?? 0.5, { ...o, onInput: (v) => set((s) => { s.params[key] = v; }, { panels: false }) });
  out.push(h('h3', {}, L(fx.name)));
  if (sf.effect !== 'none') {
    out.push(sl('speed', t('speed')), sl('intensity', t('intensity'), { max: 2 }));
    if (sf.effect !== 'media') out.push(sl('scale', t('scale'), { min: 0.2, max: 4 }));
    out.push(sl('hue', t('hue'), { min: -0.5, max: 0.5 }));
    if (fx.p1) out.push(sl('p1', L(fx.p1.label)));
    if (fx.p2 && L(fx.p2.label) !== '—') out.push(sl('p2', L(fx.p2.label)));
  }
  out.push(sl('audio', t('audio_react'), { max: 2 }));
  out.push(paletteControls(p.colors, (colors, opts) => set((s) => { s.params.colors = colors; }, opts)));

  // particles
  const pc = sf.particles;
  const pm = PARTICLES[pc.mode] || PARTICLES.none;
  const psl = (key, label, o = {}) => slider(label, pc[key] ?? 0.5, { ...o, onInput: (v) => set((s) => { s.particles[key] = v; }, { panels: false }) });
  out.push(h('h3', {}, t('particles')));
  out.push(h('div', { class: 'gallery' }, Object.entries(PARTICLES).map(([id, m]) => {
    return h('button', {
      type: 'button', class: `card${pc.mode === id ? ' active' : ''}`,
      onclick: () => set((s) => { s.particles = { ...defaultParticles(id), colors: s.particles.colors }; }),
    }, thumbEl(id === 'none' ? null : `pt:${id}`), h('span', { class: 'label' }, L(m.name)));
  })));
  if (pc.mode !== 'none') {
    const maxCount = pc.mode === 'bokeh' ? 400 : pc.mode === 'fireflies' ? 3000 : 250000;
    out.push(
      slider(t('count'), pc.count, { min: 10, max: maxCount, step: 10, format: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)), onInput: (v) => set((s) => { s.particles.count = v; }, { panels: false }) }),
      psl('size', t('size'), { min: 0.05, max: 2 }), psl('speed', t('speed')), psl('trails', t('trails'), { max: 0.99 }),
    );
    if (pm.p1) out.push(psl('p1', L(pm.p1.label)));
    if (pm.p2) out.push(psl('p2', L(pm.p2.label)));
    out.push(checkbox(lang === 'es' ? 'Colores propios para partículas' : 'Custom particle colours', !!pc.colors, (v) => set((s) => { s.particles.colors = v ? [...s.params.colors] : null; })));
    if (pc.colors) out.push(paletteControls(pc.colors, (colors, opts) => set((s) => { s.particles.colors = colors; }, opts)));
  }
  return out;
}

function paletteControls(colors, onChange) {
  const inputs = [0, 1, 2].map((i) => {
    const inp = h('input', { type: 'color', value: colors?.[i] || '#ffffff' });
    inp.addEventListener('input', () => {
      const c = [...colors]; c[i] = inp.value; colors = c;
      onChange(c, { panels: false });
    });
    return inp;
  });
  return h('div', {},
    h('div', { class: 'row' }, h('span', { class: 'muted' }, t('palette')), ...inputs),
    h('div', { class: 'palettes' }, Object.entries(PALETTES).map(([id, pal]) => h('button', {
      type: 'button', class: 'palette', title: L(pal.name),
      style: { background: `linear-gradient(90deg, ${pal.colors.join(',')})` },
      onclick: () => onChange([...pal.colors]),
    }))));
}

function mediaControls(app, sf, set) {
  const file = h('input', { type: 'file', accept: 'image/*,video/*', hidden: true });
  const status = h('span', { class: 'muted small' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    status.textContent = '⏳ 0%';
    try {
      const res = await uploadWithProgress(f, (p) => { status.textContent = `⏳ ${Math.round(p * 100)}%`; });
      status.textContent = '';
      await app.refreshMedia();
      set((s) => { s.media = { ...s.media, url: res.url, type: res.type }; });
    } catch (e) {
      status.textContent = `${t('error')}: ${e.message}`;
    }
  });
  return [
    h('h3', {}, t('media')),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, t('upload')), status, file),
    h('div', { class: 'list' }, app.media.map((m) => h('div', { class: `item${sf.media.url === m.url ? ' active' : ''}` },
      h('span', {}, m.type === 'video' ? '🎬' : '🖼'),
      h('span', { class: 'name', onclick: () => set((s) => { s.media = { ...s.media, url: m.url, type: m.type }; }) }, m.name),
      h('span', { class: 'meta' }, `${(m.size / 1048576).toFixed(1)} MB`),
      h('button', {
        type: 'button', class: 'mini', title: t('delete'), onclick: async () => {
          if (!confirm(`${t('delete')} ${m.name}?`)) return;
          await api(`/api/media/${encodeURIComponent(m.name)}`, { method: 'DELETE' });
          app.refreshMedia().then(() => app.renderPanels());
        },
      }, '🗑')))),
    h('div', { class: 'row' }, h('span', { class: 'muted' }, t('fit')),
      h('div', { class: 'grow' }, select([['cover', t('fit_cover')], ['contain', t('fit_contain')], ['stretch', t('fit_stretch')]], sf.media.fit, (v) => set((s) => { s.media.fit = v; })))),
  ];
}

function uploadWithProgress(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media');
    xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
    const token = localStorage.getItem('lp.token');
    if (token) xhr.setRequestHeader('x-access-token', token);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(xhr.responseText || xhr.status)));
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(file);
  });
}

// ---------------------------------------------------------------- surfaces
function surfaces(app) {
  const st = app.state;
  const sf = selectedSurface(app);
  const list = h('div', { class: 'list' }, st.surfaces.map((s, i) => h('div', { class: `item${s.id === sf?.id ? ' active' : ''}` },
    h('input', { type: 'checkbox', checked: s.visible !== false, title: t('visible'), onchange: (e) => app.commit((x) => { x.surfaces[i].visible = e.target.checked; }) }),
    h('span', { class: 'name', onclick: () => app.select({ surface: s.id, point: null }) }, `${i + 1}. ${s.name}`),
    h('span', { class: 'meta' }, s.effect === 'custom' ? s.custom?.name : L(EFFECTS[s.effect]?.name)),
    h('button', { type: 'button', class: 'mini', title: '↑', disabled: i === 0, onclick: () => app.commit((x) => { const [a] = x.surfaces.splice(i, 1); x.surfaces.splice(i - 1, 0, a); }) }, '↑'),
    h('button', { type: 'button', class: 'mini', title: '↓', disabled: i === st.surfaces.length - 1, onclick: () => app.commit((x) => { const [a] = x.surfaces.splice(i, 1); x.surfaces.splice(i + 1, 0, a); }) }, '↓'),
  )));
  const out = [
    h('div', { class: 'hint' }, lang === 'es'
      ? 'Cada superficie es una zona de la pared (cuadro, columna, mueble…). Arrastra sus 4 esquinas en la vista previa para que calce con el objeto real. El cuadrado central la mueve completa.'
      : 'Each surface is an area of the wall (frame, column, furniture…). Drag its 4 corners in the preview to match the real object. The centre square moves it.'),
    list,
    h('div', { class: 'row' },
      h('button', {
        type: 'button', class: 'btn', onclick: () => {
          const n = defaultSurface(`${t('surfaces').slice(0, -1) || 'Surface'} ${st.surfaces.length + 1}`,
            [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]]);
          app.commit((x) => { x.surfaces.push(n); });
          app.select({ surface: n.id, point: null });
        },
      }, '+ ' + t('add_surface')),
      sf ? h('button', {
        type: 'button', class: 'btn', onclick: () => {
          const c = structuredClone(sf);
          c.id = uid('srf'); c.name = `${sf.name} (2)`;
          c.corners = c.corners.map(([x, y]) => [x + 0.03, y + 0.03]);
          app.commit((x) => { x.surfaces.push(c); });
          app.select({ surface: c.id, point: null });
        },
      }, t('duplicate')) : null,
      sf && st.surfaces.length > 1 ? h('button', {
        type: 'button', class: 'btn danger', onclick: () => {
          if (!confirm(`${t('delete')} "${sf.name}"?`)) return;
          app.commit((x) => { x.surfaces = x.surfaces.filter((s) => s.id !== sf.id); });
          app.select({ surface: app.state.surfaces[0]?.id, point: null });
        },
      }, t('delete')) : null),
  ];
  if (!sf) return out;
  const set = (fn, opts) => app.commit((x) => { const s = x.surfaces.find((y) => y.id === sf.id); if (s) fn(s); }, opts);
  const name = h('input', { type: 'text', value: sf.name });
  name.addEventListener('change', () => set((s) => { s.name = name.value.slice(0, 40) || s.name; }));
  out.push(
    h('h3', {}, sf.name),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, name)),
    slider(t('opacity'), sf.opacity ?? 1, { onInput: (v) => set((s) => { s.opacity = v; }, { panels: false }) }),
    slider(t('feather'), sf.feather ?? 0, { max: 0.5, onInput: (v) => set((s) => { s.feather = v; }, { panels: false }) }),
    h('div', { class: 'row' }, h('span', { class: 'muted' }, t('blend')),
      h('div', { class: 'grow' }, select([['normal', t('blend_normal')], ['add', t('blend_add')]], sf.blend || 'normal', (v) => set((s) => { s.blend = v; })))),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', onclick: () => set((s) => { s.corners = [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]]; }) }, t('reset_corners')),
      h('button', { type: 'button', class: 'btn small', onclick: () => set((s) => { s.corners = [[0, 0], [1, 0], [1, 1], [0, 1]]; }) }, t('full_frame')),
      h('button', { type: 'button', class: 'btn small', onclick: () => set((s) => { s.corners = [s.corners[1], s.corners[0], s.corners[3], s.corners[2]]; }) }, '⇋'),
      h('button', { type: 'button', class: 'btn small', onclick: () => set((s) => { s.corners = [s.corners[3], s.corners[2], s.corners[1], s.corners[0]]; }) }, '⇵')),
    h('p', { class: 'muted small' }, lang === 'es'
      ? 'Ajuste fino: selecciona una esquina y usa las flechas (teclado o botones). Shift = 10 px.'
      : 'Fine adjust: select a corner and use the arrows (keyboard or buttons). Shift = 10 px.'),
  );
  return out;
}

// ---------------------------------------------------------------- masks
function masks(app) {
  const st = app.state;
  const m = st.masks.find((x) => x.id === app.sel.mask);
  const add = (kind) => {
    const n = defaultMask(kind);
    n.name = `${kind === 'circle' ? t('add_mask_circle') : t('add_mask_rect')} ${st.masks.length + 1}`;
    app.commit((x) => { x.masks.push(n); });
    app.select({ mask: n.id, point: null });
  };
  const out = [
    h('div', { class: 'hint' }, t('masks_help')),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => add('rect') }, '▭ ' + t('add_mask_rect')),
      h('button', { type: 'button', class: 'btn', onclick: () => add('circle') }, '◯ ' + t('add_mask_circle'))),
    h('div', { class: 'list' }, st.masks.map((x, i) => h('div', { class: `item${x.id === app.sel.mask ? ' active' : ''}` },
      h('input', { type: 'checkbox', checked: x.enabled !== false, title: t('enabled'), onchange: (e) => app.commit((s) => { s.masks[i].enabled = e.target.checked; }) }),
      h('span', { class: 'name', onclick: () => app.select({ mask: x.id, point: null }) }, x.name),
      h('span', { class: 'meta' }, x.mode === 'include' ? '◉' : '⛔'),
      h('button', { type: 'button', class: 'mini', title: t('delete'), onclick: () => app.commit((s) => { s.masks = s.masks.filter((y) => y.id !== x.id); }) }, '🗑')))),
  ];
  if (m) {
    const set = (fn, opts) => app.commit((s) => { const y = s.masks.find((z) => z.id === m.id); if (y) fn(y); }, opts);
    const name = h('input', { type: 'text', value: m.name });
    name.addEventListener('change', () => set((y) => { y.name = name.value.slice(0, 40) || y.name; }));
    const pIdx = app.sel.point?.kind === 'mask-pt' ? app.sel.point.idx : null;
    out.push(
      h('h3', {}, m.name),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, name)),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, select([['exclude', t('mask_exclude')], ['include', t('mask_include')]], m.mode || 'exclude', (v) => set((y) => { y.mode = v; })))),
      slider(t('feather'), m.feather ?? 0, { max: 0.1, step: 0.001, onInput: (v) => set((y) => { y.feather = v; }, { panels: false }) }),
      h('div', { class: 'row' },
        h('button', {
          type: 'button', class: 'btn small', onclick: () => set((y) => {
            const i = pIdx ?? y.points.length - 1;
            const a = y.points[i], b = y.points[(i + 1) % y.points.length];
            y.points.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
          }),
        }, t('add_point')),
        h('button', {
          type: 'button', class: 'btn small', disabled: m.points.length <= 3, onclick: () => {
            set((y) => { if (y.points.length > 3) y.points.splice(pIdx ?? y.points.length - 1, 1); });
            app.select({ point: null });
          },
        }, t('remove_point'))),
    );
  }
  return out;
}

// ---------------------------------------------------------------- optics
function optics(app) {
  const o = app.state.output;
  const set = (fn, opts) => app.commit((s) => fn(s.output), opts);
  const sl = (key, label, opts) => slider(label, o[key] ?? 0, { ...opts, onInput: (v) => set((x) => { x[key] = v; }, { panels: false }) });
  const eb = o.edgeBlend;
  const esl = (key, label, opts) => slider(label, eb[key] ?? 0, { max: 0.5, ...opts, onInput: (v) => set((x) => { x.edgeBlend[key] = v; }, { panels: false }) });
  return [
    h('h3', {}, t('keystone')),
    h('div', { class: 'hint' }, t('keystone_help')),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', onclick: () => set((x) => { x.keystone = [[0, 0], [1, 0], [1, 1], [0, 1]]; }) }, t('reset')),
      h('span', { class: 'muted' }, t('test_pattern')),
      h('div', { class: 'grow' }, select([['off', t('off')], ['grid', t('grid')], ['white', t('white')]], o.testPattern || 'off', (v) => set((x) => { x.testPattern = v; })))),
    h('div', { class: 'row' }, checkbox(t('flip_x'), o.flipX, (v) => set((x) => { x.flipX = v; }))),
    h('div', { class: 'row' }, checkbox(t('flip_y'), o.flipY, (v) => set((x) => { x.flipY = v; }))),
    h('h3', {}, lang === 'es' ? 'Color' : 'Colour'),
    sl('brightness', t('brightness'), { max: 2 }),
    sl('contrast', t('contrast'), { min: 0.3, max: 2 }),
    sl('gamma', t('gamma'), { min: 0.3, max: 3 }),
    sl('saturation', t('saturation'), { max: 2 }),
    sl('temperature', t('temperature'), { min: -1, max: 1 }),
    sl('vignette', t('vignette')),
    h('h3', {}, t('edge_blend')),
    esl('left', t('left')), esl('right', t('right')), esl('top', t('top')), esl('bottom', t('bottom')),
    slider('Gamma', eb.gamma ?? 2.2, { min: 1, max: 3.5, onInput: (v) => set((x) => { x.edgeBlend.gamma = v; }, { panels: false }) }),
    h('h3', {}, t('quality')),
    sl('renderScale', t('quality'), { min: 0.3, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` }),
    h('div', { class: 'row' }, checkbox(t('auto_quality'), o.autoQuality, (v) => set((x) => { x.autoQuality = v; }))),
    h('div', { class: 'row' }, checkbox(t('show_fps'), o.showFps, (v) => set((x) => { x.showFps = v; }))),
    h('div', { class: 'row' }, h('button', {
      type: 'button', class: 'btn small danger', onclick: () => {
        if (confirm(t('reset') + '?')) set((x) => { Object.assign(x, defaultOutput()); });
      },
    }, t('reset') + ' ' + t('optics'))),
  ];
}

// ---------------------------------------------------------------- audio
function audio(app) {
  const a = app.state.audio;
  const set = (fn, opts) => app.commit((s) => fn(s.audio), opts);
  const out = [
    h('div', { class: 'row' }, h('span', { class: 'muted' }, t('audio_mode')),
      h('div', { class: 'grow' }, select([
        ['off', t('audio_off')], ['bpm', t('audio_bpm')], ['remote', t('audio_remote')], ['mic', t('audio_mic')],
      ], a.mode, (v) => { set((x) => { x.mode = v; }); if (v !== 'remote') app.stopMic(); }))),
  ];
  if (a.mode === 'bpm') {
    const taps = app.taps || (app.taps = []);
    out.push(
      slider(t('bpm'), a.bpm, { min: 40, max: 200, step: 1, onInput: (v) => set((x) => { x.bpm = v; }, { panels: false }) }),
      h('button', {
        type: 'button', class: 'btn primary', style: { width: '100%', padding: '18px' }, onpointerdown: () => {
          const now = performance.now();
          if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
          taps.push(now);
          if (taps.length > 8) taps.shift();
          if (taps.length >= 3) {
            const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
            const bpm = Math.round(60000 / avg);
            set((x) => { x.bpm = Math.max(40, Math.min(200, bpm)); });
          }
        },
      }, `${t('tap_tempo')} · ${a.bpm} BPM`),
    );
  }
  if (a.mode === 'remote') {
    if (!window.isSecureContext) {
      const url = app.info?.httpsPort ? `https://${location.hostname}:${app.info.httpsPort}/` : 'https://…';
      out.push(h('div', { class: 'hint' }, t('mic_https', { url }), ' ', h('a', { href: url, style: { color: 'var(--accent)' } }, url)));
    }
    out.push(h('button', {
      type: 'button', class: 'btn primary', onclick: () => (app.mic.active ? app.stopMic() : app.startMic()),
    }, app.mic.active ? t('mic_stop') : t('mic_start')));
  }
  if (a.mode === 'mic') {
    out.push(h('div', { class: 'hint' }, lang === 'es'
      ? 'La pantalla usará su propio micrófono (necesita HTTPS y permiso en ese dispositivo).'
      : 'The display will use its own microphone (needs HTTPS and permission on that device).'));
  }
  const meters = h('div', { class: 'meters' }, ['Nivel', 'Bass', 'Mid', 'High'].flatMap((n, i) => [h('span', {}, n), h('div', { class: 'meter' }, h('div', { 'data-meter': i }))]));
  out.push(h('h3', {}, lang === 'es' ? 'Señal' : 'Signal'), meters);
  out.push(h('p', { class: 'muted small' }, lang === 'es'
    ? 'Cada efecto tiene su propio control de "Reacción al audio" en la pestaña Efecto.'
    : 'Each effect has its own "Audio reactivity" control in the Effect tab.'));
  return out;
}

// ---------------------------------------------------------------- playlist
function playlist(app) {
  const pl = app.playlist || { enabled: false, sceneIds: [], intervalSec: 300, shuffle: false, mode: 'content' };
  const save = (patch) => app.savePlaylist({ ...pl, ...patch });
  const all = [...app.scenes.presets, ...app.scenes.user];
  return [
    h('div', { class: 'hint' }, t('playlist_help')),
    h('div', { class: 'row' }, checkbox(t('playlist_enable'), pl.enabled, (v) => save({ enabled: v }))),
    slider(t('interval_min'), pl.intervalSec / 60, { min: 0.5, max: 120, step: 0.5, onInput: (v) => { pl.intervalSec = Math.round(v * 60); clearTimeout(app.plTimer); app.plTimer = setTimeout(() => save({}), 400); } }),
    h('div', { class: 'row' }, checkbox(t('shuffle'), pl.shuffle, (v) => save({ shuffle: v }))),
    h('div', { class: 'row' }, h('span', { class: 'muted' }, lang === 'es' ? 'Modo' : 'Mode'),
      h('div', { class: 'grow' }, select([['content', t('apply_content')], ['full', t('apply_full')]], pl.mode || 'content', (v) => save({ mode: v })))),
    h('h3', {}, t('scenes')),
    h('div', { class: 'list' }, all.map((sc) => h('label', { class: 'item' },
      h('input', {
        type: 'checkbox', checked: pl.sceneIds.includes(sc.id), onchange: (e) => {
          const ids = new Set(pl.sceneIds);
          e.target.checked ? ids.add(sc.id) : ids.delete(sc.id);
          save({ sceneIds: all.map((x) => x.id).filter((id) => ids.has(id)) });
        },
      }),
      h('span', { class: 'name' }, L(sc.name)),
      sc.builtIn ? h('span', { class: 'meta' }, '★') : null))),
  ];
}
