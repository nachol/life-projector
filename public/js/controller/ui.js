// Tiny DOM helpers (no framework, so anyone can hack on it).
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const fmt = (v, step) => (step >= 1 ? String(Math.round(v)) : step >= 0.1 ? v.toFixed(1) : v.toFixed(2));

/** Labelled range slider. onInput(value) fires continuously. */
export function slider(label, value, { min = 0, max = 1, step = 0.01, onInput, format } = {}) {
  const out = h('output', {}, format ? format(value) : fmt(value, step));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    out.textContent = format ? format(v) : fmt(v, step);
    onInput?.(v);
  });
  input.addEventListener('dblclick', () => input.dispatchEvent(new Event('reset')));
  return h('div', { class: 'field' }, h('label', { title: label }, label), input, out);
}

export function select(options, value, onChange) {
  const s = h('select', {}, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

export function checkbox(label, checked, onChange) {
  const input = h('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'toggle' }, input, h('span', {}, label));
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
