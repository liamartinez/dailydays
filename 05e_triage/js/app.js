// app.js — State management and render loop for declutter triage tool.
// Two modes: gallery (multi-select + action bar) and triage (one-at-a-time).

import { OBJECTS } from '../../shared/js/data.js';
import * as store from '../../shared/js/store.js';
import { renderApp } from './ui.js';

const state = {
  objects: OBJECTS,
  filters: {},
  sortField: 'name',
  sortDirection: 'asc',
  roomFilter: null,

  viewMode: 'gallery',       // 'gallery' | 'triage' | 'summary'
  decisions: {},              // { [itemId]: 'donate' | 'trash' | 'store' }
  undoStack: [],              // [{ type, itemIds, previousDecisions, action }]
  undoToast: null,            // { message, timeoutId } | null

  // Gallery selection
  selectionMode: false,
  selectedIds: new Set(),
  lastClickedId: null,

  // Lightbox
  lightboxItemId: null,

  // Triage
  triageQueue: [],
  triageIndex: 0,
  triageAnimation: null,      // 'slide-left' | 'slide-right' | 'slide-up' | null
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

  document.addEventListener('keydown', (e) => {
    // Triage mode keys
    if (state.viewMode === 'triage') {
      if (e.key === '1') { triageDecide('donate', render); return; }
      if (e.key === '2') { triageDecide('trash', render); return; }
      if (e.key === '3') { triageDecide('store', render); return; }
      if (e.key === 's' || e.key === 'S') { triageSkip(render); return; }
      if (e.key === 'b' || e.key === 'B') { triageBack(render); return; }
      if (e.key === 'Escape') {
        Object.assign(state, { viewMode: 'gallery' });
        render();
        return;
      }
      return;
    }

    // Gallery mode: T enters triage
    if (e.key === 't' || e.key === 'T') {
      if (!state.selectionMode && !state.lightboxItemId && state.viewMode === 'gallery') {
        Object.assign(state, enterTriageMode(state));
        render();
        return;
      }
    }

    // Gallery mode: Escape exits selection or lightbox
    if (e.key === 'Escape') {
      if (state.lightboxItemId) {
        Object.assign(state, { lightboxItemId: null });
        render();
      } else if (state.selectionMode) {
        Object.assign(state, { selectionMode: false, selectedIds: new Set() });
        render();
      }
      return;
    }

    // Lightbox navigation
    if (state.lightboxItemId) {
      if (e.key === 'ArrowRight') navigateLightbox(1, render);
      else if (e.key === 'ArrowLeft') navigateLightbox(-1, render);
    }
  });

  window.__store = store;
  window.__state = state;
  window.__objects = OBJECTS;
}

// ─── Visible Items Helper ───

export function getVisibleItems(st) {
  const filtered = store.filterMultiple(st.objects, st.filters);
  const sorted = store.sortBy(filtered, st.sortField, st.sortDirection);
  return st.roomFilter
    ? sorted.filter(i => i.tags.room === st.roomFilter)
    : sorted;
}

export function getVisibleItemIds(st) {
  return getVisibleItems(st).map(i => i.id);
}

// ─── Lightbox Navigation ───

function navigateLightbox(direction, render) {
  const items = getVisibleItems(state);
  const currentIndex = items.findIndex(i => i.id === state.lightboxItemId);
  if (currentIndex === -1) return;
  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < items.length) {
    Object.assign(state, { lightboxItemId: items[nextIndex].id });
    render();
  }
}

window.__navigateLightbox = navigateLightbox;

// ─── Action Application ───

export function applyAction(action, st, onStateChange) {
  const itemIds = [...st.selectedIds];
  const previousDecisions = {};
  for (const id of itemIds) {
    previousDecisions[id] = st.decisions[id] || null;
  }

  const undoEntry = { type: 'batch', itemIds, previousDecisions, action };
  const newDecisions = { ...st.decisions };
  for (const id of itemIds) {
    newDecisions[id] = action;
  }

  if (st.undoToast?.timeoutId) clearTimeout(st.undoToast.timeoutId);

  const timeoutId = setTimeout(() => {
    onStateChange({ undoToast: null });
  }, 5000);

  onStateChange({
    decisions: newDecisions,
    selectedIds: new Set(),
    selectionMode: false,
    undoStack: [...st.undoStack, undoEntry],
    undoToast: {
      message: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} → ${action}`,
      timeoutId,
    },
  });
}

export function applyActionSingle(action, itemId, st, onStateChange) {
  const previousDecision = st.decisions[itemId] || null;
  const undoEntry = { type: 'single', itemIds: [itemId], previousDecisions: { [itemId]: previousDecision }, action };
  const newDecisions = { ...st.decisions, [itemId]: action };

  if (st.undoToast?.timeoutId) clearTimeout(st.undoToast.timeoutId);

  const timeoutId = setTimeout(() => {
    onStateChange({ undoToast: null });
  }, 5000);

  onStateChange({
    decisions: newDecisions,
    undoStack: [...st.undoStack, undoEntry],
    undoToast: {
      message: `1 item → ${action}`,
      timeoutId,
    },
  });
}

export function undoLast(st, onStateChange) {
  if (st.undoStack.length === 0) return;
  const entry = st.undoStack[st.undoStack.length - 1];
  const newDecisions = { ...st.decisions };
  for (const id of entry.itemIds) {
    const prev = entry.previousDecisions[id];
    if (prev === null) {
      delete newDecisions[id];
    } else {
      newDecisions[id] = prev;
    }
  }

  if (st.undoToast?.timeoutId) clearTimeout(st.undoToast.timeoutId);

  onStateChange({
    decisions: newDecisions,
    undoStack: st.undoStack.slice(0, -1),
    undoToast: null,
  });
}

// ─── Triage Mode ───

export function enterTriageMode(st) {
  const items = getVisibleItems(st);
  const undecided = items.filter(item => !st.decisions[item.id]);
  return {
    viewMode: 'triage',
    triageQueue: undecided.map(item => item.id),
    triageIndex: 0,
    triageAnimation: null,
    selectionMode: false,
    selectedIds: new Set(),
    lightboxItemId: null,
  };
}

function triageDecide(action, render) {
  if (state.triageAnimation) return; // block during animation
  const currentId = state.triageQueue[state.triageIndex];
  if (!currentId) return;

  const previousDecision = state.decisions[currentId] || null;
  const undoEntry = {
    type: 'triage-single',
    itemIds: [currentId],
    previousDecisions: { [currentId]: previousDecision },
    action,
    triageIndex: state.triageIndex,
  };

  state.decisions = { ...state.decisions, [currentId]: action };
  state.undoStack = [...state.undoStack, undoEntry];
  state.triageAnimation = action === 'donate' ? 'slide-left'
                        : action === 'trash' ? 'slide-right'
                        : 'slide-up';
  render();

  setTimeout(() => {
    state.triageAnimation = null;
    state.triageIndex++;
    if (state.triageIndex >= state.triageQueue.length) {
      state.viewMode = 'summary';
    }
    render();
  }, 350);
}

function triageSkip(render) {
  if (state.triageAnimation) return;
  state.triageIndex++;
  if (state.triageIndex >= state.triageQueue.length) {
    state.viewMode = 'summary';
  }
  render();
}

function triageBack(render) {
  if (state.triageAnimation) return;
  if (state.triageIndex > 0) {
    state.triageIndex--;
    const lastUndo = state.undoStack[state.undoStack.length - 1];
    if (lastUndo && lastUndo.type === 'triage-single'
        && lastUndo.itemIds[0] === state.triageQueue[state.triageIndex]) {
      const newDecisions = { ...state.decisions };
      const prev = lastUndo.previousDecisions[lastUndo.itemIds[0]];
      if (prev === null) {
        delete newDecisions[lastUndo.itemIds[0]];
      } else {
        newDecisions[lastUndo.itemIds[0]] = prev;
      }
      state.decisions = newDecisions;
      state.undoStack = state.undoStack.slice(0, -1);
    }
    render();
  }
}

init();
