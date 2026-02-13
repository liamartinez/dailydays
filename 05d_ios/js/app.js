// app.js — State management and render loop

import { OBJECTS, TAG_DEFINITIONS } from '../../shared/js/data.js';
import * as store from '../../shared/js/store.js';
import { ROOM_COLORS, formatLabel, pluralize } from '../../shared/js/colors.js';
import { generateRecommendations } from './recommendations.js';
import { renderApp } from './ui.js';

const STORAGE_KEY = 'home-storage-triage';

const state = {
  objects: OBJECTS,
  viewMode: 'main',        // 'main' | 'drill'
  groupBy: 'room',         // 'room' | 'category'
  drillTarget: null,       // { type, value, label, color } or { type: 'filter', ids, label }
  detailItem: null,        // item object when modal open
  triageDecisions: {},     // { 'obj-001': 'keep'|'donate'|'toss' }
  sortField: 'volume_liters',
  sortDirection: 'desc',
  totalCapacity: 12500,
  recommendations: [],
};

function init() {
  const container = document.getElementById('app');

  // Load persisted triage decisions
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state.triageDecisions = JSON.parse(saved);
  } catch (e) { /* ignore */ }

  // Compute initial recommendations
  state.recommendations = generateRecommendations(state.objects, state.triageDecisions);

  function render() {
    renderApp(container, state, (changes) => {
      Object.assign(state, changes);

      // Recompute recommendations when triage changes
      if (changes.triageDecisions) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.triageDecisions));
        state.recommendations = generateRecommendations(state.objects, state.triageDecisions);
      }

      render();
    });
  }

  render();

  // Expose for debugging
  window.__store = store;
  window.__state = state;
  window.__objects = OBJECTS;
}

init();
