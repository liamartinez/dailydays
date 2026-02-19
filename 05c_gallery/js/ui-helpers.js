// ui-helpers.js — Shared DOM helpers for all view modules

/** Create an element with optional className */
export function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

/** Add a label/value property row to a container */
export function addProp(container, label, value) {
  const row = el('div', 'prop-row');
  const l = el('span', 'prop-label');
  l.textContent = label;
  const v = el('span', 'prop-value');
  v.textContent = value;
  row.appendChild(l);
  row.appendChild(v);
  container.appendChild(row);
}
