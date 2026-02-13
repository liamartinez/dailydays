// app.js — State management and render loop
// Photo gallery experiment: room-grouped grid of AI-generated item photos.

import { OBJECTS, TAG_DEFINITIONS } from '../../shared/js/data.js';
import * as store from '../../shared/js/store.js';
import { ROOM_COLORS, formatLabel, pluralize } from '../../shared/js/colors.js';
import { renderApp } from './ui.js';

const state = {
  objects: OBJECTS,
  filters: {},
  sortField: 'name',
  sortDirection: 'asc',
  selectedItemId: null,   // for lightbox
  roomFilter: null,       // null = all rooms
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

  // Keyboard navigation for lightbox
  document.addEventListener('keydown', (e) => {
    if (!state.selectedItemId) return;

    if (e.key === 'Escape') {
      Object.assign(state, { selectedItemId: null });
      render();
    } else if (e.key === 'ArrowRight') {
      navigateLightbox(1, render);
    } else if (e.key === 'ArrowLeft') {
      navigateLightbox(-1, render);
    }
  });

  // Expose to console for prototyping
  window.__store = store;
  window.__state = state;
  window.__objects = OBJECTS;
}

function navigateLightbox(direction, render) {
  const filtered = store.filterMultiple(state.objects, state.filters);
  const sorted = store.sortBy(filtered, state.sortField, state.sortDirection);

  // If roomFilter is set, filter by room
  const items = state.roomFilter
    ? sorted.filter(i => i.tags.room === state.roomFilter)
    : sorted;

  const currentIndex = items.findIndex(i => i.id === state.selectedItemId);
  if (currentIndex === -1) return;

  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < items.length) {
    Object.assign(state, { selectedItemId: items[nextIndex].id });
    render();
  }
}

// Expose navigation for the lightbox arrows
window.__navigateLightbox = navigateLightbox;

init();
