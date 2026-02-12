// app.js — State management and render loop
// Standard pattern: state object → render() → onStateChange callback

import { OBJECTS, TAG_DEFINITIONS } from '../../shared/js/data.js';
import * as store from '../../shared/js/store.js';
import { ROOM_COLORS, formatLabel, pluralize } from '../../shared/js/colors.js';
import { renderApp } from './ui.js';

const state = {
  objects: OBJECTS,
  filters: {},
  sortField: 'volume_liters',
  sortDirection: 'desc',
  // Add project-specific state fields here
};

function init() {
  const container = document.getElementById('app');

  function render() {
    renderApp(container, state, (changes) => {
      Object.assign(state, changes);
      render();
    });
  }

  render();

  // Expose to console for prototyping
  window.__store = store;
  window.__state = state;
  window.__objects = OBJECTS;
}

init();
