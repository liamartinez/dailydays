// app.js — State management and UI wiring
// Extended for disk-analyzer visualization with treemap, sunburst, and list views.

import { OBJECTS } from './data.js?v=4';
import { renderApp } from './ui.js?v=4';
import * as store from './store.js?v=4';

const state = {
  objects: OBJECTS,
  filters: {},
  sortField: 'volume_liters',
  sortDirection: 'desc',
  groupBy: null,
  view: 'treemap',        // 'treemap' | 'sunburst' | 'list'
  drillPath: [],           // e.g. ['kitchen'] or ['kitchen', 'appliances']
  hoveredItemId: null,
  selectedItemId: null,
};

function init() {
  let rendering = false;
  let pendingRender = false;

  function render() {
    if (rendering) {
      pendingRender = true;
      return;
    }
    rendering = true;
    renderApp(state, (changes) => {
      Object.assign(state, changes);
      requestAnimationFrame(render);
    });
    rendering = false;
    if (pendingRender) {
      pendingRender = false;
      requestAnimationFrame(render);
    }
  }

  render();

  // Expose store and state to console for prototyping
  window.__store = store;
  window.__state = state;
  window.__objects = OBJECTS;

  // ResizeObserver for responsive treemap/sunburst
  const vizArea = document.getElementById('viz-area');
  if (vizArea) {
    let lastWidth = 0;
    let lastHeight = 0;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w !== lastWidth || h !== lastHeight) {
        lastWidth = w;
        lastHeight = h;
        render();
      }
    });
    ro.observe(vizArea);
  }
}

init();
