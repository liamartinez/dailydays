// sandbox.js — Dev controls for fine-tuning the Already Got It demo
// Activate via ?sandbox URL param or Ctrl+, keyboard shortcut

const STORAGE_KEY = 'agi-sandbox';

// ── Shared config (read by app.js and ui.js) ─────────────────────
const DEFAULTS = {
  matchCount: 4,      // 0–6: how many cart items are flagged as owned
  detailLevel: 1,     // 0 = compact, 1 = persuade
  speed: 1,           // timeline multiplier (0.5 = slow, 2 = fast)
  panelWidth: 380,    // px
  backdropOpacity: 4, // 0–30 (percent)
  autoCycle: true,     // auto-advance to next theme
  showLocation: false, // show "Find it" location line on match rows
};

// Load saved config or use defaults
function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch (e) { /* ignore */ }
  return { ...DEFAULTS };
}

export const config = loadConfig();

const CONTROLS = [
  { section: 'Content' },
  { type: 'range', key: 'matchCount', label: 'Matches shown', min: 0, max: 6, step: 1, unit: '' },
  { type: 'select', key: 'detailLevel', label: 'Panel detail',
    options: [
      { label: 'Compact',  value: 0 },
      { label: 'Persuade', value: 1 },
    ]
  },
  { type: 'toggle', key: 'showLocation', label: 'Show location' },

  { section: 'Timing' },
  { type: 'select', key: 'speed', label: 'Speed',
    options: [
      { label: '0.5x (slow)', value: 0.5 },
      { label: '1x',          value: 1 },
      { label: '1.5x',        value: 1.5 },
      { label: '2x (fast)',   value: 2 },
    ]
  },
  { type: 'toggle', key: 'autoCycle', label: 'Auto-cycle themes' },

  { section: 'Layout' },
  { type: 'range', key: 'panelWidth', label: 'Panel width', min: 280, max: 500, step: 10, unit: 'px' },
  { type: 'range', key: 'backdropOpacity', label: 'Backdrop dim', min: 0, max: 30, step: 1, unit: '%' },
];

let panelEl = null;
let toggleEl = null;
let isOpen = false;

function createEl(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function notify() {
  document.documentElement.style.setProperty('--panel-width', config.panelWidth + 'px');
  window.dispatchEvent(new CustomEvent('sandbox-change'));
}

function saveConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) { /* ignore */ }
}

function buildPanel() {
  toggleEl = createEl('button', 'sandbox-toggle');
  toggleEl.textContent = '\u2699';
  toggleEl.title = 'Toggle sandbox controls (Ctrl+,)';
  toggleEl.addEventListener('click', togglePanel);
  document.body.appendChild(toggleEl);

  panelEl = createEl('div', 'sandbox-panel');
  panelEl.style.display = 'none';

  const header = createEl('div', 'sandbox-panel-header');
  header.textContent = 'Sandbox';
  panelEl.appendChild(header);

  const inputMap = {};

  for (const ctrl of CONTROLS) {
    if (ctrl.section) {
      const s = createEl('div', 'sandbox-section-title');
      s.textContent = ctrl.section;
      panelEl.appendChild(s);
      continue;
    }

    const row = createEl('div', 'sandbox-row');

    if (ctrl.type === 'range') {
      const labelEl = createEl('div', 'sandbox-label');
      const valueSpan = createEl('span', 'sandbox-value');
      valueSpan.textContent = `${config[ctrl.key]}${ctrl.unit}`;
      labelEl.appendChild(document.createTextNode(ctrl.label));
      labelEl.appendChild(valueSpan);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = ctrl.min;
      input.max = ctrl.max;
      input.step = ctrl.step;
      input.value = config[ctrl.key];
      input.addEventListener('input', () => {
        config[ctrl.key] = Number(input.value);
        valueSpan.textContent = `${input.value}${ctrl.unit}`;
        notify();
      });
      row.appendChild(labelEl);
      row.appendChild(input);
      inputMap[ctrl.key] = { input, valueSpan, ctrl };

    } else if (ctrl.type === 'select') {
      const labelEl = createEl('div', 'sandbox-label');
      labelEl.textContent = ctrl.label;

      const select = document.createElement('select');
      for (const opt of ctrl.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (Number(opt.value) === config[ctrl.key]) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        config[ctrl.key] = Number(select.value);
        notify();
      });
      row.appendChild(labelEl);
      row.appendChild(select);
      inputMap[ctrl.key] = { input: select, ctrl };

    } else if (ctrl.type === 'toggle') {
      const labelEl = createEl('div', 'sandbox-label');
      labelEl.textContent = ctrl.label;

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = config[ctrl.key];
      toggle.className = 'sandbox-checkbox';
      toggle.addEventListener('change', () => {
        config[ctrl.key] = toggle.checked;
        notify();
      });
      row.appendChild(labelEl);
      row.appendChild(toggle);
      inputMap[ctrl.key] = { input: toggle, ctrl };
    }

    panelEl.appendChild(row);
  }

  // Actions
  const actions = createEl('div', 'sandbox-actions');

  const restartBtn = createEl('button', 'sandbox-btn');
  restartBtn.textContent = 'Restart';
  restartBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('sandbox-restart'));
  });
  actions.appendChild(restartBtn);

  const saveBtn = createEl('button', 'sandbox-btn sandbox-btn--save');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    saveConfig();
    saveBtn.textContent = 'Saved!';
    setTimeout(() => { saveBtn.textContent = 'Save'; }, 1200);
  });
  actions.appendChild(saveBtn);

  const resetBtn = createEl('button', 'sandbox-btn');
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => {
    Object.assign(config, DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
    for (const key in inputMap) {
      const { input, valueSpan, ctrl } = inputMap[key];
      if (ctrl.type === 'range') {
        input.value = DEFAULTS[key];
        valueSpan.textContent = `${DEFAULTS[key]}${ctrl.unit}`;
      } else if (ctrl.type === 'select') {
        input.value = DEFAULTS[key];
      } else if (ctrl.type === 'toggle') {
        input.checked = DEFAULTS[key];
      }
    }
    notify();
  });
  actions.appendChild(resetBtn);

  panelEl.appendChild(actions);
  document.body.appendChild(panelEl);
}

function togglePanel() {
  isOpen = !isOpen;
  panelEl.style.display = isOpen ? '' : 'none';
}

export function initSandbox() {
  const shouldShow = new URLSearchParams(location.search).has('sandbox');

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
    togglePanel();
  }
}
