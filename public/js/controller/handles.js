// Interactive corner-pin / mask / keystone handles drawn over the preview (SVG).
import { squareToQuad, invert3, apply as applyH } from '../core/homography.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const clamp = (v) => Math.max(-0.5, Math.min(1.5, v));

export class Handles {
  constructor(app, svg) {
    this.app = app;
    this.svg = svg;
    this.drag = null;
    this.raf = 0;
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', (e) => this.up(e));
    svg.addEventListener('pointercancel', (e) => this.up(e));
  }

  size() {
    const r = this.svg.getBoundingClientRect();
    return [r.width || 1, r.height || 1];
  }

  K() { return squareToQuad(this.app.state.output.keystone); }

  toPx(p, keystone) {
    const [w, h] = this.size();
    const o = keystone ? applyH(this.K(), p) : p;
    return [o[0] * w, o[1] * h];
  }

  eventPos(e) {
    const r = this.svg.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  render() {
    const { app, svg } = this;
    const st = app.state;
    svg.replaceChildren();
    if (!st) return;
    const mode = app.handleMode();
    const [w, h] = this.size();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const poly = (pts, keystone, cls, data) => {
      const el = s('polygon', { points: pts.map((p) => this.toPx(p, keystone).join(',')).join(' '), class: cls });
      for (const [k, v] of Object.entries(data || {})) el.dataset[k] = v;
      svg.append(el);
      return el;
    };
    const point = (p, keystone, cls, data, selected) => {
      const [x, y] = this.toPx(p, keystone);
      const g = s('g');
      const hit = s('circle', { cx: x, cy: y, r: 22, class: 'h-hit' });
      const dot = s('circle', { cx: x, cy: y, r: selected ? 10 : 8, class: `h-pt ${cls}${selected ? ' sel' : ''}` });
      for (const [k, v] of Object.entries(data)) { hit.dataset[k] = v; dot.dataset[k] = v; }
      g.append(dot, hit);
      svg.append(g);
    };
    const center = (pts, keystone, data) => {
      const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
      const [x, y] = this.toPx(c, keystone);
      const el = s('rect', { x: x - 13, y: y - 13, width: 26, height: 26, rx: 7, class: 'h-move' });
      for (const [k, v] of Object.entries(data)) el.dataset[k] = v;
      svg.append(el);
      const arrows = s('path', { d: `M${x - 7} ${y}h14M${x} ${y - 7}v14`, stroke: '#fff', 'stroke-width': 1.5, 'pointer-events': 'none' });
      svg.append(arrows);
    };
    const label = (pts, keystone, text) => {
      const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
      const [x, y] = this.toPx(c, keystone);
      const t = s('text', { x, y: y - 22, class: 'h-label', 'text-anchor': 'middle' });
      t.textContent = text;
      svg.append(t);
    };

    if (mode === 'keystone') {
      const k = st.output.keystone;
      poly(k, false, 'h-poly key');
      k.forEach((p, i) => point(p, false, 'key', { kind: 'key', idx: i }, app.sel.point?.kind === 'key' && app.sel.point.idx === i));
      return;
    }
    if (mode === 'masks') {
      for (const m of st.masks) {
        const sel = m.id === app.sel.mask;
        poly(m.points, false, `h-poly mask${sel ? ' sel' : ''}${m.mode === 'include' ? ' include' : ''}`, { kind: 'mask-select', id: m.id });
      }
      const m = st.masks.find((x) => x.id === app.sel.mask);
      if (m) {
        m.points.forEach((p, i) => point(p, false, 'mask', { kind: 'mask-pt', id: m.id, idx: i }, app.sel.point?.kind === 'mask-pt' && app.sel.point.idx === i));
        center(m.points, false, { kind: 'mask-move', id: m.id });
      }
      return;
    }
    // surfaces
    st.surfaces.forEach((sf, i) => {
      const sel = sf.id === app.sel.surface;
      poly(sf.corners, true, `h-poly${sel ? ' sel' : ''}`, { kind: 'surface-select', id: sf.id });
      if (st.surfaces.length > 1 || sel) label(sf.corners, true, `${i + 1}. ${sf.name}`);
    });
    const sf = st.surfaces.find((x) => x.id === app.sel.surface);
    if (sf) {
      sf.corners.forEach((p, i) => point(p, true, '', { kind: 'corner', id: sf.id, idx: i }, app.sel.point?.kind === 'corner' && app.sel.point.idx === i));
      center(sf.corners, true, { kind: 'surface-move', id: sf.id });
    }
  }

  down(e) {
    const d = e.target.dataset || {};
    if (!d.kind) return;
    const app = this.app;
    const st = app.state;
    const pos = this.eventPos(e);
    if (d.kind === 'surface-select') { app.select({ surface: d.id, point: null }); return; }
    if (d.kind === 'mask-select') { app.select({ mask: d.id, point: null }); return; }
    e.preventDefault();
    this.svg.setPointerCapture(e.pointerId);
    const Kinv = invert3(this.K());
    const idx = d.idx !== undefined ? Number(d.idx) : null;
    let orig, offset = [0, 0];
    if (d.kind === 'corner' || d.kind === 'surface-move') {
      const sf = st.surfaces.find((x) => x.id === d.id);
      if (!sf) return;
      orig = structuredClone(sf.corners);
      if (idx !== null) {
        const hp = applyH(this.K(), orig[idx]);
        offset = [hp[0] - pos[0], hp[1] - pos[1]];
      }
    } else if (d.kind === 'mask-pt' || d.kind === 'mask-move') {
      const m = st.masks.find((x) => x.id === d.id);
      if (!m) return;
      orig = structuredClone(m.points);
      if (idx !== null) offset = [orig[idx][0] - pos[0], orig[idx][1] - pos[1]];
    } else if (d.kind === 'key') {
      orig = structuredClone(st.output.keystone);
      offset = [orig[idx][0] - pos[0], orig[idx][1] - pos[1]];
    }
    this.drag = { kind: d.kind, id: d.id, idx, start: pos, orig, offset, Kinv };
    if (idx !== null) app.select({ point: { kind: d.kind, idx } }, { quiet: true });
  }

  move(e) {
    const dr = this.drag;
    if (!dr) return;
    const p = this.eventPos(e);
    const target = [clamp(p[0] + dr.offset[0]), clamp(p[1] + dr.offset[1])];
    this.app.commit((st) => {
      if (dr.kind === 'corner') {
        const sf = st.surfaces.find((x) => x.id === dr.id);
        if (sf) sf.corners[dr.idx] = applyH(dr.Kinv, target);
      } else if (dr.kind === 'surface-move') {
        const sf = st.surfaces.find((x) => x.id === dr.id);
        const a = applyH(dr.Kinv, dr.start), b = applyH(dr.Kinv, p);
        if (sf) sf.corners = dr.orig.map(([x, y]) => [x + b[0] - a[0], y + b[1] - a[1]]);
      } else if (dr.kind === 'mask-pt') {
        const m = st.masks.find((x) => x.id === dr.id);
        if (m) m.points[dr.idx] = target;
      } else if (dr.kind === 'mask-move') {
        const m = st.masks.find((x) => x.id === dr.id);
        if (m) m.points = dr.orig.map(([x, y]) => [x + p[0] - dr.start[0], y + p[1] - dr.start[1]]);
      } else if (dr.kind === 'key') {
        st.output.keystone[dr.idx] = target;
      }
    }, { panels: false });
    this.schedule();
  }

  up(e) {
    if (!this.drag) return;
    this.drag = null;
    try { this.svg.releasePointerCapture(e.pointerId); } catch {}
    this.app.commit(() => {}, { panels: true });
  }

  /** Move the selected point by (dx, dy) display pixels. */
  nudge(dx, dy, displayW, displayH) {
    const app = this.app;
    const pt = app.sel.point;
    if (!pt) return;
    const ddx = dx / (displayW || 1920), ddy = dy / (displayH || 1080);
    app.commit((st) => {
      if (pt.kind === 'corner') {
        const sf = st.surfaces.find((x) => x.id === app.sel.surface);
        if (!sf) return;
        const K = squareToQuad(st.output.keystone);
        const o = applyH(K, sf.corners[pt.idx]);
        sf.corners[pt.idx] = applyH(invert3(K), [o[0] + ddx, o[1] + ddy]);
      } else if (pt.kind === 'mask-pt') {
        const m = st.masks.find((x) => x.id === app.sel.mask);
        if (m) m.points[pt.idx] = [m.points[pt.idx][0] + ddx, m.points[pt.idx][1] + ddy];
      } else if (pt.kind === 'key') {
        const k = st.output.keystone[pt.idx];
        st.output.keystone[pt.idx] = [k[0] + ddx, k[1] + ddy];
      }
    }, { panels: false });
    this.schedule();
  }
}
