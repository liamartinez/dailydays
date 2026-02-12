// app.js — State management and UI wiring
// Follows the 30Ducks pattern: state object, init(), event-driven re-renders.

import { OBJECTS } from './data.js';
import { renderUI } from './ui.js';
import * as store from './store.js';

const state = {
  objects: OBJECTS,
  filters: {},
  sortField: 'name',
  sortDirection: 'asc',
  groupBy: null,
  view: 'list',
};

function init() {
  const container = document.getElementById('app');
  render();

  // Expose store and state to console for visualization prototyping
  window.__store = store;
  window.__state = state;
  window.__objects = OBJECTS;

  function render() {
    renderUI(container, state, (changes) => {
      Object.assign(state, changes);
      render();
    });
  }
}

init();
