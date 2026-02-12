// ui.js — Main render function
// Replace this stub with your experiment's UI.

import { filterMultiple, sortBy, formatVolume, totalVolume } from '../../shared/js/store.js';
import { formatLabel } from '../../shared/js/colors.js';

export function renderApp(container, state, onStateChange) {
  container.innerHTML = '';

  const filtered = filterMultiple(state.objects, state.filters);
  const sorted = sortBy(filtered, state.sortField, state.sortDirection);

  const h = document.createElement('h1');
  h.textContent = `${sorted.length} items — ${formatVolume(totalVolume(sorted))}`;
  h.style.cssText = 'font-size: 1.5rem; margin: 40px 20px 20px;';
  container.appendChild(h);

  const p = document.createElement('p');
  p.textContent = 'Edit ui.js to build your experiment.';
  p.style.cssText = 'color: var(--text-secondary); margin: 0 20px;';
  container.appendChild(p);
}
