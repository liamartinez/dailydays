// sandbox.js — Development sandbox controls for live CSS variable tweaking
// Activate via ?sandbox URL param or Ctrl+, keyboard shortcut.

const CONTROLS = [
  // Colors
  { section: 'Colors' },
  { type: 'color', label: 'Background',   prop: '--color-bg',           default: '#f8f4e9' },
  { type: 'color', label: 'Card BG',      prop: '--color-bg-card',      default: '#ffffff' },
  { type: 'color', label: 'Accent',       prop: '--color-accent',       default: '#b84b30' },
  { type: 'color', label: 'Border',       prop: '--color-border',       default: '#e0d8c8' },
  { type: 'color', label: 'Border Light', prop: '--color-border-light', default: '#ebe5d8' },
  { type: 'color', label: 'Text',         prop: '--color-text',         default: '#b84b30' },
  { type: 'color', label: 'Text Muted',   prop: '--color-text-muted',   default: '#c07a5f' },

  // Typography
  { section: 'Typography' },
  { type: 'select', label: 'Display Font', prop: '--font-display', default: "'DM Sans', system-ui, sans-serif",
    options: [
      { label: 'DM Sans',            value: "'DM Sans', system-ui, sans-serif" },
      { label: 'System Sans',        value: "system-ui, -apple-system, sans-serif" },
      { label: 'Georgia (serif)',    value: "Georgia, 'Times New Roman', serif" },
      { label: 'DM Serif Display',   value: "'DM Serif Display', Georgia, serif" },
    ]
  },
  { type: 'range', label: 'Title Size',   prop: '--font-size-xxl', default: 48, min: 24, max: 72, unit: 'px' },
  { type: 'range', label: 'Heading Size',  prop: '--font-size-lg',  default: 24, min: 14, max: 40, unit: 'px' },
  { type: 'range', label: 'Body Size',     prop: '--font-size-base', default: 16, min: 10, max: 20, unit: 'px' },

  // Spacing
  { section: 'Spacing' },
  { type: 'range', label: 'Space MD',     prop: '--space-md',  default: 16, min: 4,  max: 40, unit: 'px' },
  { type: 'range', label: 'Space LG',     prop: '--space-lg',  default: 24, min: 8,  max: 64, unit: 'px' },
  { type: 'range', label: 'Space XL',     prop: '--space-xl',  default: 56, min: 16, max: 96, unit: 'px' },

  // Borders
  { section: 'Borders' },
  { type: 'range', label: 'Border Width', prop: '--border-width', default: 1, min: 0, max: 6, unit: 'px' },
  { type: 'range', label: 'Radius SM',    prop: '--radius-sm',   default: 6, min: 0, max: 16, unit: 'px' },
  { type: 'range', label: 'Radius MD',    prop: '--radius-md',   default: 10, min: 0, max: 24, unit: 'px' },
  { type: 'range', label: 'Radius LG',    prop: '--radius-lg',   default: 14, min: 0, max: 32, unit: 'px' },
];

let panelEl = null;
let toggleEl = null;
let isOpen = false;

function createEl(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function setProp(prop, value) {
  document.documentElement.style.setProperty(prop, value);
}

function buildPanel() {
  // Toggle button
  toggleEl = createEl('button', 'sandbox-toggle');
  toggleEl.textContent = '\u2699';
  toggleEl.title = 'Toggle sandbox controls (Ctrl+,)';
  toggleEl.addEventListener('click', togglePanel);
  document.body.appendChild(toggleEl);

  // Panel
  panelEl = createEl('div', 'sandbox-panel');
  panelEl.style.display = 'none';

  // Header
  const header = createEl('div', 'sandbox-panel-header');
  const title = document.createTextNode('Sandbox');
  header.appendChild(title);
  panelEl.appendChild(header);

  // Controls
  for (const ctrl of CONTROLS) {
    if (ctrl.section) {
      const sectionTitle = createEl('div', 'sandbox-section-title');
      sectionTitle.textContent = ctrl.section;
      panelEl.appendChild(sectionTitle);
      continue;
    }

    const row = createEl('div', 'sandbox-row');
    const labelEl = createEl('div', 'sandbox-label');
    const labelText = document.createTextNode(ctrl.label);
    labelEl.appendChild(labelText);

    if (ctrl.type === 'color') {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = ctrl.default;
      input.addEventListener('input', () => {
        setProp(ctrl.prop, input.value);
      });
      row.appendChild(labelEl);
      row.appendChild(input);

    } else if (ctrl.type === 'range') {
      const valueSpan = createEl('span', 'sandbox-value');
      valueSpan.textContent = `${ctrl.default}${ctrl.unit}`;
      labelEl.appendChild(valueSpan);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = ctrl.min;
      input.max = ctrl.max;
      input.value = ctrl.default;
      input.addEventListener('input', () => {
        const val = input.value;
        valueSpan.textContent = `${val}${ctrl.unit}`;
        setProp(ctrl.prop, `${val}${ctrl.unit}`);
      });
      row.appendChild(labelEl);
      row.appendChild(input);

    } else if (ctrl.type === 'select') {
      const select = document.createElement('select');
      for (const opt of ctrl.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === ctrl.default) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        setProp(ctrl.prop, select.value);
      });
      row.appendChild(labelEl);
      row.appendChild(select);
    }

    panelEl.appendChild(row);
  }

  // Actions
  const actions = createEl('div', 'sandbox-actions');

  const resetBtn = createEl('button', 'sandbox-btn');
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => {
    document.documentElement.removeAttribute('style');
    // Reset all inputs to defaults
    const inputs = panelEl.querySelectorAll('input, select');
    let inputIdx = 0;
    for (const ctrl of CONTROLS) {
      if (ctrl.section) continue;
      const input = inputs[inputIdx++];
      if (!input) continue;
      if (ctrl.type === 'range') {
        input.value = ctrl.default;
        const valueSpan = input.closest('.sandbox-row').querySelector('.sandbox-value');
        if (valueSpan) valueSpan.textContent = `${ctrl.default}${ctrl.unit}`;
      } else if (ctrl.type === 'color') {
        input.value = ctrl.default;
      } else if (ctrl.type === 'select') {
        input.value = ctrl.default;
      }
    }
  });
  actions.appendChild(resetBtn);

  const copyBtn = createEl('button', 'sandbox-btn');
  copyBtn.textContent = 'Copy CSS';
  copyBtn.addEventListener('click', () => {
    const style = document.documentElement.style;
    const overrides = [];
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      const value = style.getPropertyValue(prop);
      overrides.push(`  ${prop}: ${value};`);
    }
    if (overrides.length === 0) {
      copyBtn.textContent = 'No changes';
      setTimeout(() => { copyBtn.textContent = 'Copy CSS'; }, 1500);
      return;
    }
    const css = `:root {\n${overrides.join('\n')}\n}`;
    navigator.clipboard.writeText(css).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy CSS'; }, 1500);
    });
  });
  actions.appendChild(copyBtn);

  panelEl.appendChild(actions);
  document.body.appendChild(panelEl);
}

function togglePanel() {
  isOpen = !isOpen;
  panelEl.style.display = isOpen ? '' : 'none';
}

export function initSandbox() {
  const shouldShow = new URLSearchParams(location.search).has('sandbox');

  // Always listen for keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      if (!panelEl) buildPanel();
      toggleEl.style.display = '';
      togglePanel();
    }
  });

  if (shouldShow) {
    buildPanel();
  }
}
