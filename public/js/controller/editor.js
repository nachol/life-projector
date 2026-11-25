// In-app effect editor: write a GLSL `effect()` function, see it live on the preview
// (and optionally on the projector), save it to the library, export / import as JSON.
//
// The editor DOM is built once and re-attached, never rebuilt, so incoming state updates
// don't destroy the caret, focus or undo history while someone is typing.
import { h, toast, select, checkbox } from './ui.js';
import { t, lang } from '../core/i18n.js';
import { EFFECT_TEMPLATES, sanitizeCustomEffect, customForSurface, localized, uid } from '../core/catalog.js';
import { api } from '../core/net.js';
import { renderCustomThumb } from './thumbs.js';

const DRAFT_KEY = 'lp.effectDraft';
const FORMAT = 'life-projector-effect';

function newDraft(template = 'basic') {
  return {
    id: uid('fx'),
    name: lang === 'es' ? 'Mi efecto' : 'My effect',
    glsl: EFFECT_TEMPLATES[template].glsl,
    p1Label: 'P1',
    p2Label: 'P2',
  };
}

function loadDraft() {
  try {
    const d = sanitizeCustomEffect(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'));
    if (d) return d;
  } catch {}
  return newDraft();
}

const HELP = {
  es: `vec3 effect(vec2 uv, vec2 p, float t)  → color RGB del píxel
  uv   0..1 dentro de la superficie (y hacia arriba)
  p    centrado, corregido por aspecto y por el slider Escala
  t    tiempo (ya multiplicado por el slider Velocidad)
Sliders:   uP1, uP2 (0..1)
Paleta:    pal(x) mezcla los 3 colores · uC1 uC2 uC3
Audio:     level() bass() mids() highs()
Ruido:     noise(p) fbm(p) hash21(p) hash22(p) hash11(x)
Otros:     uRes (tamaño en píxeles), PI, TAU, hueShift(c, h)
Tono, intensidad y reacción al audio se aplican solos.`,
  en: `vec3 effect(vec2 uv, vec2 p, float t)  → pixel RGB colour
  uv   0..1 inside the surface (y up)
  p    centred, aspect-corrected, scaled by the Scale slider
  t    time (already multiplied by the Speed slider)
Sliders:   uP1, uP2 (0..1)
Palette:   pal(x) blends the 3 colours · uC1 uC2 uC3
Audio:     level() bass() mids() highs()
Noise:     noise(p) fbm(p) hash21(p) hash22(p) hash11(x)
Other:     uRes (size in pixels), PI, TAU, hueShift(c, h)
Hue, intensity and audio reactivity are applied for you.`,
};

export class EffectEditor {
  constructor(app) {
    this.app = app;
    this.draft = loadDraft();
    this.library = [];
    this.errors = [];
    this.lastOk = null;
    this.target = null;
    this.live = true;
    this.timer = 0;
    this.build();
    this.compileSoon(0, false); // check the saved draft, but never touch a surface on page load
  }

  // ------------------------------------------------------------ DOM (built once)
  build() {
    const d = this.draft;
    this.surfaceSlot = h('div', { class: 'grow' });
    this.name = h('input', { type: 'text', value: d.name, maxLength: 60, placeholder: t('effect_name') });
    this.p1 = h('input', { type: 'text', value: d.p1Label, maxLength: 30, placeholder: 'P1' });
    this.p2 = h('input', { type: 'text', value: d.p2Label, maxLength: 30, placeholder: 'P2' });
    for (const [el, key] of [[this.name, 'name'], [this.p1, 'p1Label'], [this.p2, 'p2Label']]) {
      el.addEventListener('input', () => { this.draft[key] = el.value; this.saveDraft(); this.compileSoon(400); });
    }

    this.gutter = h('div', { class: 'code-gutter', 'aria-hidden': 'true' });
    this.code = h('textarea', {
      class: 'code-input', spellcheck: false, autocapitalize: 'off', autocomplete: 'off', wrap: 'off',
      'aria-label': 'GLSL',
    });
    this.code.value = d.glsl;
    this.code.setAttribute('autocorrect', 'off');
    this.code.addEventListener('input', () => { this.draft.glsl = this.code.value; this.saveDraft(); this.updateGutter(); this.compileSoon(450); });
    this.code.addEventListener('scroll', () => { this.gutter.scrollTop = this.code.scrollTop; });
    this.code.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertText', false, '  '); // keeps native undo
      }
    });

    this.status = h('div', { class: 'code-status' });
    this.displayStatus = h('div', { class: 'code-status bad', hidden: true });
    this.librarySlot = h('div', { class: 'list' });

    const templateSel = select(
      [['', `${t('template')}…`], ...Object.entries(EFFECT_TEMPLATES).map(([k, v]) => [k, localized(v.name, lang)])],
      '', (v) => {
        if (!v) return;
        this.setCode(EFFECT_TEMPLATES[v].glsl);
        templateSel.value = '';
      },
    );
    const importInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    importInput.addEventListener('change', () => this.importFile(importInput));

    this.root = h('div', { class: 'editor' },
      h('div', { class: 'hint' }, lang === 'es'
        ? 'Escribe la función effect() en GLSL. Se compila mientras escribes y se ve en la vista previa. Si hay un error, la pantalla sigue mostrando la última versión que funcionó.'
        : 'Write the effect() function in GLSL. It compiles as you type and shows in the preview. On errors, the display keeps the last version that worked.'),
      h('div', { class: 'row' }, h('span', { class: 'muted' }, t('target_surface')), this.surfaceSlot),
      h('div', { class: 'row' },
        checkbox(t('live_to_display'), this.live, (v) => { this.live = v; if (v) this.apply(); }),
      ),
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, templateSel),
        h('button', { type: 'button', class: 'btn small', onclick: () => this.startNew() }, '+ ' + t('new_effect')),
      ),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, this.name)),
      h('div', { class: 'row' },
        h('span', { class: 'muted small' }, 'uP1'), h('div', { class: 'grow' }, this.p1),
        h('span', { class: 'muted small' }, 'uP2'), h('div', { class: 'grow' }, this.p2)),
      h('div', { class: 'code-wrap' }, this.gutter, this.code),
      this.status,
      this.displayStatus,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => this.save() }, t('save_library')),
        h('button', { type: 'button', class: 'btn small', onclick: () => this.exportEffect(this.draft) }, '⬇ ' + t('export')),
        h('button', { type: 'button', class: 'btn small', onclick: () => importInput.click() }, '⬆ ' + t('import')),
        importInput),
      h('details', { class: 'help' }, h('summary', {}, t('editor_help')), h('pre', {}, HELP[lang] || HELP.es)),
      h('h3', {}, t('my_effects')),
      this.librarySlot,
    );
    this.updateGutter();
  }

  /** Attach to the panel body (without rebuilding) and refresh the dynamic bits. */
  show(body) {
    if (this.root.parentNode !== body) body.replaceChildren(this.root);
    this.refresh();
  }

  refresh() {
    const st = this.app.state;
    if (!st) return;
    if (!st.surfaces.some((s) => s.id === this.target)) this.target = this.app.sel.surface || st.surfaces[0]?.id;
    this.surfaceSlot.replaceChildren(select(
      st.surfaces.map((s, i) => [s.id, `${i + 1}. ${s.name}`]), this.target,
      (v) => { this.target = v; this.apply(); },
    ));
    this.renderLibrary();
    this.renderDisplayErrors();
  }

  updateGutter() {
    const n = this.code.value.split('\n').length;
    const bad = new Set(this.errors.map((e) => e.line).filter(Boolean));
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= n; i++) frag.append(h('div', { class: bad.has(i) ? 'bad' : '' }, i));
    this.gutter.replaceChildren(frag);
    this.gutter.scrollTop = this.code.scrollTop;
  }

  setCode(glsl) {
    this.code.focus();
    this.code.select();
    // insertText keeps it undoable; fall back to assignment where unsupported.
    if (!document.execCommand('insertText', false, glsl)) this.code.value = glsl;
    this.draft.glsl = this.code.value;
    this.saveDraft();
    this.updateGutter();
    this.compileSoon(0);
  }

  loadIntoEditor(fx) {
    this.draft = { id: fx.id, name: fx.name, glsl: fx.glsl, p1Label: fx.p1Label, p2Label: fx.p2Label };
    this.name.value = fx.name;
    this.p1.value = fx.p1Label;
    this.p2.value = fx.p2Label;
    this.code.value = fx.glsl;
    this.saveDraft();
    this.updateGutter();
    this.compileSoon(0);
  }

  startNew() {
    this.loadIntoEditor(newDraft('basic'));
  }

  saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(this.draft)); } catch {}
  }

  // ------------------------------------------------------------ compile & apply
  compileSoon(ms, apply = true) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.compile(apply), ms);
  }

  compile(apply = true) {
    const fx = sanitizeCustomEffect(this.draft);
    const renderer = this.app.renderer;
    if (!fx) {
      this.setErrors([{ line: null, message: lang === 'es' ? 'El código está vacío o es demasiado largo.' : 'Code is empty or too long.' }]);
      return;
    }
    const res = renderer ? renderer.compileCustom(fx.glsl) : { ok: true, errors: [] };
    this.setErrors(res.errors);
    if (!res.ok) return;
    this.lastOk = fx;
    if (apply) this.apply();
  }

  setErrors(errors) {
    this.errors = errors;
    this.updateGutter();
    if (!errors.length) {
      this.status.className = 'code-status ok';
      this.status.replaceChildren(`✓ ${t('compiles')}`);
      return;
    }
    this.status.className = 'code-status bad';
    this.status.replaceChildren(...errors.slice(0, 6).map((e) => h('div', {
      class: e.line ? 'err-line' : '',
      onclick: () => e.line && this.goToLine(e.line),
    }, e.line ? `${t('line')} ${e.line}: ${e.message}` : e.message)));
  }

  goToLine(line) {
    const lines = this.code.value.split('\n');
    const start = lines.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0);
    this.code.focus();
    this.code.setSelectionRange(start, start + (lines[line - 1] || '').length);
    const lh = parseFloat(getComputedStyle(this.code).lineHeight) || 18;
    this.code.scrollTop = Math.max(0, (line - 4) * lh);
  }

  /** Put the last compiling version on the target surface: preview first, display after a clean frame. */
  apply() {
    const fx = this.lastOk;
    const app = this.app;
    if (!fx || !app.state || !this.target) return;
    const custom = customForSurface(fx);
    app.commit((st) => {
      const s = st.surfaces.find((x) => x.id === this.target);
      if (!s) return;
      s.effect = 'custom';
      s.custom = custom;
    }, { panels: false, send: false });
    if (!this.live) return;
    // Only push to the projector once the preview rendered without losing the GPU context
    // (a runaway loop could otherwise hang the projector).
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!app.renderer?.lost) app.commit(() => {}, { panels: false });
    }));
  }

  renderDisplayErrors() {
    const d = this.app.displays.find((x) => x.id === this.app.displayId);
    const errs = (d?.shaderErrors || []).filter((e) => e.errors?.length);
    this.displayStatus.hidden = !errs.length;
    this.displayStatus.replaceChildren(...errs.map((e) => h('div', {},
      `⚠ ${t('display_error')} "${e.name}": `,
      e.errors.map((x) => (x.line ? `${t('line')} ${x.line}: ${x.message}` : x.message)).join(' · '))));
  }

  // ------------------------------------------------------------ library
  async refreshLibrary() {
    try { this.library = await api('/api/effects'); } catch (e) { console.warn(e); }
    this.renderLibrary();
    this.app.onLibrary?.();
  }

  renderLibrary() {
    if (!this.library.length) {
      this.librarySlot.replaceChildren(h('p', { class: 'muted small' }, '—'));
      return;
    }
    this.librarySlot.replaceChildren(...this.library.map((fx) => h('div', { class: `item${fx.id === this.draft.id ? ' active' : ''}` },
      safeThumb(fx.thumb) ? h('img', { src: fx.thumb, alt: '', class: 'fx-thumb' }) : h('span', { class: 'fx-thumb ph' }),
      h('span', { class: 'name', onclick: () => this.loadIntoEditor(fx) }, fx.name),
      h('button', { type: 'button', class: 'mini', title: t('apply'), onclick: () => { this.lastOk = sanitizeCustomEffect(fx); this.apply(); toast(`✓ ${fx.name}`); } }, '▶'),
      h('button', { type: 'button', class: 'mini', title: t('edit'), onclick: () => this.loadIntoEditor(fx) }, '✎'),
      h('button', { type: 'button', class: 'mini', title: t('export'), onclick: () => this.exportEffect(fx) }, '⬇'),
      h('button', {
        type: 'button', class: 'mini', title: t('delete'), onclick: async () => {
          if (!confirm(`${t('delete')} "${fx.name}"?`)) return;
          await api(`/api/effects/${fx.id}`, { method: 'DELETE' });
          this.refreshLibrary();
        },
      }, '🗑'))));
  }

  async save() {
    const fx = sanitizeCustomEffect(this.draft);
    if (!fx) return;
    const res = this.app.renderer ? this.app.renderer.compileCustom(fx.glsl) : { ok: true };
    if (!res.ok) { toast(`${t('error')}: ${t('line')} ${res.errors[0]?.line ?? '?'}`); return; }
    const surface = this.app.state?.surfaces.find((s) => s.id === this.target);
    const thumb = renderCustomThumb(customForSurface(fx), surface?.params?.colors);
    try {
      await api(`/api/effects/${fx.id}`, { method: 'PUT', json: { ...fx, thumb } });
    } catch (e) {
      toast(`${t('error')}: ${e.message}`, 4000);
      return;
    }
    // Surfaces already using this effect get the new code.
    const custom = customForSurface(fx);
    this.app.commit((st) => {
      for (const s of st.surfaces) if (s.effect === 'custom' && s.custom?.id === fx.id) s.custom = custom;
    }, { panels: false });
    toast(t('effect_saved'));
    this.refreshLibrary();
  }

  exportEffect(fx) {
    const clean = sanitizeCustomEffect(fx);
    if (!clean) return;
    const data = { format: FORMAT, version: 1, ...clean };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${slug(clean.name)}.lpfx.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async importFile(input) {
    const file = input.files[0];
    input.value = '';
    if (!file || file.size > 200 * 1024) { toast(t('import_invalid')); return; }
    let data;
    try { data = JSON.parse(await file.text()); } catch { toast(t('import_invalid')); return; }
    if (data?.format !== FORMAT) { toast(t('import_invalid')); return; }
    // Imported thumbnails are never trusted; a fresh one is rendered on save.
    const fx = sanitizeCustomEffect({ ...data, thumb: undefined });
    if (!fx) { toast(t('import_invalid')); return; }
    if (this.library.some((x) => x.id === fx.id)) fx.id = uid('fx');
    this.loadIntoEditor(fx);
    toast(`⬆ ${fx.name}`);
  }
}

function safeThumb(src) {
  return typeof src === 'string' && /^data:image\/(jpeg|png);base64,/.test(src);
}

function slug(s) {
  return String(s).normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'effect';
}
