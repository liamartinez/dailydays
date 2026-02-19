// app.js — State management and render loop
// Exploration gallery: browse items through derived insight tags.

import { OBJECTS } from '../../shared/js/data.js';
import { sortBy } from '../../shared/js/store.js';
import { computeTags } from './tags.js';
import { renderApp } from './ui.js';
import { initSandbox } from './sandbox.js';

// Restore persisted state
const savedView = localStorage.getItem('gallery-view') || 'landing';

const state = {
  objects: OBJECTS,
  activeTag: null,        // tag id or null for "all"
  activeRoom: null,       // room key or null for "all rooms"
  selectedItemId: null,   // for modal detail
  gridSize: 160,          // card min-width in px (100, 160, or 260)
  view: savedView,        // 'landing', 'stack', or 'gallery'
  stackTag: null,         // tag id for card stack view
  stackIndex: 0,          // current card index in stack
};

// Pre-compute tags for every item once
const itemTags = new Map();
for (const item of OBJECTS) {
  itemTags.set(item.id, computeTags(item));
}

/** Get items matching active room + tag filters, sorted */
export function getVisibleItems() {
  let items = state.objects;
  if (state.activeRoom) {
    items = items.filter(item => item.tags.room === state.activeRoom);
  }
  if (state.activeTag) {
    items = items.filter(item => itemTags.get(item.id).includes(state.activeTag));
  }
  return sortBy(items, 'name', 'asc');
}

/** Get items for a specific tag, sorted by name */
export function getStackItems(tagId) {
  if (!tagId) return sortBy([...state.objects], 'name', 'asc');
  return sortBy(
    state.objects.filter(item => itemTags.get(item.id).includes(tagId)),
    'name',
    'asc'
  );
}

/** Get pre-computed tags for an item */
export function getItemTags(itemId) {
  return itemTags.get(itemId) || [];
}

function init() {
  const container = document.getElementById('app');

  function render() {
    renderApp(container, state, (changes) => {
      // Persist view to localStorage
      if (changes.view) {
        localStorage.setItem('gallery-view', changes.view);
      }
      Object.assign(state, changes);
      render();
    });
  }

  render();

  // Keyboard: Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.view === 'gallery' && state.selectedItemId) {
        // Close modal in gallery
        Object.assign(state, { selectedItemId: null });
        render();
      } else if (state.view === 'stack') {
        // Back to landing from stack
        Object.assign(state, { view: 'landing', stackTag: null, stackIndex: 0 });
        localStorage.setItem('gallery-view', 'landing');
        render();
      } else if (state.view === 'gallery') {
        // Back to landing from gallery
        Object.assign(state, { view: 'landing', activeTag: null, activeRoom: null });
        localStorage.setItem('gallery-view', 'landing');
        render();
      }
    }
    // Arrow keys in stack view
    if (state.view === 'stack') {
      const items = getStackItems(state.stackTag);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.stackIndex < items.length - 1) {
          Object.assign(state, { stackIndex: state.stackIndex + 1 });
          render();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.stackIndex > 0) {
          Object.assign(state, { stackIndex: state.stackIndex - 1 });
          render();
        }
      }
    }
  });

  // Initialize sandbox controls
  initSandbox();
}

init();
