// ui.js — Declutter triage tool with gallery selection, triage mode, and summary view.

import { filterMultiple, sortBy, formatVolume, totalVolume, groupByTag, staleness } from '../../shared/js/store.js';
import { ROOM_COLORS, formatLabel } from '../../shared/js/colors.js';
import { imageUrl } from '../../shared/js/images.js';
import { getVisibleItems, getVisibleItemIds, applyAction, applyActionSingle, undoLast, enterTriageMode } from './app.js';

// ─── Main Render ───

export function renderApp(container, state, onStateChange) {
  container.innerHTML = '';

  if (state.viewMode === 'triage') {
    container.appendChild(renderTriageView(state, onStateChange));
    return;
  }

  if (state.viewMode === 'summary') {
    container.appendChild(renderSummaryView(state, onStateChange));
    return;
  }

  // Gallery mode
  container.appendChild(renderHeader(state, onStateChange));
  container.appendChild(renderGallery(state, onStateChange));

  if (state.selectionMode && state.selectedIds.size > 0) {
    container.appendChild(renderActionBar(state, onStateChange));
  }

  if (state.undoToast) {
    container.appendChild(renderUndoToast(state, onStateChange));
  }

  if (state.lightboxItemId) {
    const item = state.objects.find(i => i.id === state.lightboxItemId);
    if (item) {
      container.appendChild(renderLightbox(item, state, onStateChange));
    }
  }
}

// ─── Header ───

function renderHeader(state, onStateChange) {
  const header = el('div', 'gallery-header');

  // Top row: title + action buttons
  const topRow = el('div', 'header-top-row');

  const title = el('h1', 'gallery-title');
  title.textContent = 'Declutter Triage';
  topRow.appendChild(title);

  const actions = el('div', 'header-actions');

  const selectBtn = el('button', `header-btn ${state.selectionMode ? 'active' : ''}`);
  selectBtn.textContent = state.selectionMode ? 'Done' : 'Select';
  selectBtn.addEventListener('click', () => {
    if (state.selectionMode) {
      onStateChange({ selectionMode: false, selectedIds: new Set() });
    } else {
      onStateChange({ selectionMode: true });
    }
  });
  actions.appendChild(selectBtn);

  const triageBtn = el('button', 'header-btn header-btn-accent');
  triageBtn.textContent = 'Triage';
  triageBtn.addEventListener('click', () => {
    onStateChange(enterTriageMode(state));
  });
  actions.appendChild(triageBtn);

  const decisionCount = Object.keys(state.decisions).length;
  if (decisionCount > 0) {
    const summaryBtn = el('button', 'header-btn');
    summaryBtn.textContent = 'Summary';
    summaryBtn.addEventListener('click', () => onStateChange({ viewMode: 'summary' }));
    actions.appendChild(summaryBtn);
  }

  topRow.appendChild(actions);
  header.appendChild(topRow);

  // Subtitle
  const subtitle = el('div', 'gallery-subtitle');
  const filtered = filterMultiple(state.objects, state.filters);
  const decided = Object.keys(state.decisions).length;
  const decidedText = decided > 0 ? ` — ${decided} decided` : '';
  subtitle.textContent = `${filtered.length} items — ${formatVolume(totalVolume(filtered))}${decidedText}`;
  header.appendChild(subtitle);

  // Selection toolbar
  if (state.selectionMode) {
    const toolbar = el('div', 'selection-toolbar');

    const count = el('span', 'selection-count');
    count.textContent = `${state.selectedIds.size} selected`;
    toolbar.appendChild(count);

    const selectAllBtn = el('button', 'toolbar-btn');
    const visibleIds = getVisibleItemIds(state);
    selectAllBtn.textContent = `Select All (${visibleIds.length})`;
    selectAllBtn.addEventListener('click', () => {
      onStateChange({ selectedIds: new Set(visibleIds) });
    });
    toolbar.appendChild(selectAllBtn);

    if (state.selectedIds.size > 0) {
      const clearBtn = el('button', 'toolbar-btn');
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () => {
        onStateChange({ selectedIds: new Set() });
      });
      toolbar.appendChild(clearBtn);
    }

    header.appendChild(toolbar);
  }

  // Room filter tabs
  const tabs = el('div', 'room-tabs');

  const allTab = el('button', `room-tab ${state.roomFilter === null ? 'active' : ''}`);
  allTab.textContent = 'All';
  allTab.addEventListener('click', () => onStateChange({ roomFilter: null }));
  tabs.appendChild(allTab);

  const roomGroups = groupByTag(state.objects, 'room');
  const rooms = Object.keys(roomGroups).sort((a, b) => roomGroups[b].length - roomGroups[a].length);

  for (const room of rooms) {
    const tab = el('button', `room-tab ${state.roomFilter === room ? 'active' : ''}`);
    tab.textContent = formatLabel(room);
    tab.style.setProperty('--room-color', ROOM_COLORS[room] || '#888');
    tab.addEventListener('click', () => onStateChange({ roomFilter: room }));
    tabs.appendChild(tab);
  }

  header.appendChild(tabs);
  return header;
}

// ─── Gallery Grid ───

function renderGallery(state, onStateChange) {
  const wrapper = el('div', 'gallery-wrapper');
  if (state.selectionMode && state.selectedIds.size > 0) {
    wrapper.classList.add('has-action-bar');
  }

  const filtered = filterMultiple(state.objects, state.filters);
  const sorted = sortBy(filtered, state.sortField, state.sortDirection);
  const items = state.roomFilter
    ? sorted.filter(i => i.tags.room === state.roomFilter)
    : sorted;

  if (state.roomFilter) {
    wrapper.appendChild(renderGrid(items, state, onStateChange));
  } else {
    const groups = groupByTag(items, 'room');
    const roomOrder = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    for (const room of roomOrder) {
      const section = el('div', 'room-section');
      const sectionHeader = el('div', 'room-section-header');
      const dot = el('span', 'room-dot');
      dot.style.background = ROOM_COLORS[room] || '#888';
      sectionHeader.appendChild(dot);
      const label = el('span', 'room-section-label');
      label.textContent = `${formatLabel(room)} (${groups[room].length})`;
      sectionHeader.appendChild(label);
      section.appendChild(sectionHeader);
      section.appendChild(renderGrid(groups[room], state, onStateChange));
      wrapper.appendChild(section);
    }
  }

  return wrapper;
}

function renderGrid(items, state, onStateChange) {
  const grid = el('div', 'gallery-grid');

  for (const item of items) {
    const isSelected = state.selectionMode && state.selectedIds.has(item.id);
    const decision = state.decisions[item.id];
    const cardClasses = ['gallery-card'];
    if (isSelected) cardClasses.push('selected');
    if (decision) cardClasses.push('decided', `decided-${decision}`);

    const card = el('div', cardClasses.join(' '));

    card.addEventListener('click', (e) => {
      if (!state.selectionMode) {
        onStateChange({ lightboxItemId: item.id });
        return;
      }

      const newSelected = new Set(state.selectedIds);
      if (e.shiftKey && state.lastClickedId) {
        const ids = getVisibleItemIds(state);
        const startIdx = ids.indexOf(state.lastClickedId);
        const endIdx = ids.indexOf(item.id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          for (let i = lo; i <= hi; i++) newSelected.add(ids[i]);
        }
      } else {
        if (newSelected.has(item.id)) newSelected.delete(item.id);
        else newSelected.add(item.id);
      }
      onStateChange({ selectedIds: newSelected, lastClickedId: item.id });
    });

    // Photo area
    const photoArea = el('div', 'card-photo');
    photoArea.style.setProperty('--room-color', ROOM_COLORS[item.tags.room] || '#888');

    const img = document.createElement('img');
    img.src = imageUrl(item.id, true);
    img.alt = item.name;
    img.loading = 'lazy';
    img.className = 'card-img';
    img.onerror = function () {
      this.style.display = 'none';
      const fallback = el('div', 'card-fallback');
      fallback.textContent = item.icon;
      photoArea.appendChild(fallback);
    };
    photoArea.appendChild(img);

    // Selection checkmark
    if (state.selectionMode) {
      const check = el('div', `card-check ${isSelected ? 'checked' : ''}`);
      check.textContent = isSelected ? '✓' : '';
      photoArea.appendChild(check);
    }

    // Decision badge
    if (decision) {
      const badge = el('div', `card-badge decision-${decision}`);
      badge.textContent = decision === 'donate' ? 'DONATE' : decision === 'trash' ? 'TRASH' : 'STORE';
      photoArea.appendChild(badge);
    }

    // Text above photo (Freitag layout)
    const textArea = el('div', 'card-text');
    const name = el('div', 'card-name');
    name.textContent = item.name;
    textArea.appendChild(name);
    const meta = el('div', 'card-meta');
    meta.textContent = formatLabel(item.tags.category);
    textArea.appendChild(meta);
    card.appendChild(textArea);

    card.appendChild(photoArea);

    grid.appendChild(card);
  }

  return grid;
}

// ─── Floating Action Bar ───

function renderActionBar(state, onStateChange) {
  const bar = el('div', 'action-bar visible');

  const inner = el('div', 'action-bar-inner');

  const count = el('span', 'action-bar-count');
  count.textContent = `${state.selectedIds.size} item${state.selectedIds.size !== 1 ? 's' : ''} selected`;
  inner.appendChild(count);

  const buttons = el('div', 'action-bar-buttons');

  const donateBtn = el('button', 'action-btn action-donate');
  donateBtn.textContent = 'Donate';
  donateBtn.addEventListener('click', () => applyAction('donate', state, onStateChange));
  buttons.appendChild(donateBtn);

  const trashBtn = el('button', 'action-btn action-trash');
  trashBtn.textContent = 'Trash';
  trashBtn.addEventListener('click', () => applyAction('trash', state, onStateChange));
  buttons.appendChild(trashBtn);

  const storeBtn = el('button', 'action-btn action-store');
  storeBtn.textContent = 'Store';
  storeBtn.addEventListener('click', () => applyAction('store', state, onStateChange));
  buttons.appendChild(storeBtn);

  inner.appendChild(buttons);
  bar.appendChild(inner);
  return bar;
}

// ─── Undo Toast ───

function renderUndoToast(state, onStateChange) {
  const toast = el('div', 'undo-toast visible');

  const msg = el('span', 'undo-toast-msg');
  msg.textContent = state.undoToast.message;
  toast.appendChild(msg);

  const undoBtn = el('button', 'undo-btn');
  undoBtn.textContent = 'Undo';
  undoBtn.addEventListener('click', () => undoLast(state, onStateChange));
  toast.appendChild(undoBtn);

  return toast;
}

// ─── Lightbox ───

function renderLightbox(item, state, onStateChange) {
  const overlay = el('div', 'lightbox-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onStateChange({ lightboxItemId: null });
  });

  const modal = el('div', 'lightbox-modal');

  const close = el('button', 'lightbox-close');
  close.textContent = '✕';
  close.addEventListener('click', () => onStateChange({ lightboxItemId: null }));
  modal.appendChild(close);

  // Navigation arrows
  const prevBtn = el('button', 'lightbox-nav lightbox-prev');
  prevBtn.textContent = '‹';
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.__navigateLightbox(-1, () => onStateChange({}));
  });
  modal.appendChild(prevBtn);

  const nextBtn = el('button', 'lightbox-nav lightbox-next');
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.__navigateLightbox(1, () => onStateChange({}));
  });
  modal.appendChild(nextBtn);

  // Photo
  const photoWrap = el('div', 'lightbox-photo');
  const fullImg = document.createElement('img');
  fullImg.src = imageUrl(item.id);
  fullImg.alt = item.name;
  fullImg.className = 'lightbox-img';
  fullImg.onerror = function () {
    this.style.display = 'none';
    const fallback = el('div', 'lightbox-fallback');
    fallback.textContent = item.icon;
    photoWrap.appendChild(fallback);
  };
  photoWrap.appendChild(fullImg);
  modal.appendChild(photoWrap);

  // Info panel
  const info = el('div', 'lightbox-info');

  const header = el('div', 'lightbox-header');
  const icon = el('span', 'lightbox-icon');
  icon.textContent = item.icon;
  header.appendChild(icon);
  const nameEl = el('h2', 'lightbox-name');
  nameEl.textContent = item.name;
  header.appendChild(nameEl);
  info.appendChild(header);

  const path = el('div', 'lightbox-path');
  const roomDot = el('span', 'room-dot');
  roomDot.style.background = ROOM_COLORS[item.tags.room] || '#888';
  path.appendChild(roomDot);
  path.appendChild(document.createTextNode(` ${formatLabel(item.tags.room)} › ${formatLabel(item.tags.category)}`));
  info.appendChild(path);

  if (item.description) {
    const desc = el('div', 'lightbox-desc');
    desc.textContent = item.description;
    info.appendChild(desc);
  }

  const props = el('div', 'lightbox-props');
  addProp(props, 'Size', `${item.size} — ${formatVolume(item.volume_liters)}`);
  addProp(props, 'Usage', formatLabel(item.usageFrequency));
  addProp(props, 'Attachment', formatLabel(item.attachment));
  if (item.dateObtained) addProp(props, 'Obtained', item.dateObtained);
  if (item.lastUsed) {
    const days = staleness(item);
    addProp(props, 'Last Used', `${item.lastUsed} (${days}d ago)`);
  }
  info.appendChild(props);

  if (item.detail) {
    const det = item.detail;
    const detailSection = el('div', 'lightbox-detail');
    if (det.brand) addProp(detailSection, 'Brand', det.brand);
    if (det.model) addProp(detailSection, 'Model', det.model);
    if (det.color) addProp(detailSection, 'Color', det.color);
    if (det.material) addProp(detailSection, 'Material', det.material);
    if (det.contents) addProp(detailSection, 'Contents', det.contents);
    if (det.titles && Array.isArray(det.titles)) {
      const titles = det.titles.map(t => typeof t === 'string' ? t : `${t.title} — ${t.author}`).join(', ');
      addProp(detailSection, 'Titles', titles);
    }
    info.appendChild(detailSection);
  }

  // Triage action buttons (replace old status toggle)
  const decision = state.decisions[item.id];
  const triageActions = el('div', 'lightbox-triage-actions');

  for (const [action, label] of [['donate', 'Donate'], ['trash', 'Trash'], ['store', 'Store']]) {
    const btn = el('button', `lightbox-triage-btn ${action} ${decision === action ? 'active' : ''}`);
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (decision === action) {
        // Toggle off: remove decision
        const newDecisions = { ...state.decisions };
        delete newDecisions[item.id];
        onStateChange({ decisions: newDecisions });
      } else {
        applyActionSingle(action, item.id, state, onStateChange);
      }
    });
    triageActions.appendChild(btn);
  }
  info.appendChild(triageActions);

  modal.appendChild(info);
  overlay.appendChild(modal);

  preloadAdjacent(item, state);
  return overlay;
}

// ─── Triage View ───

function renderTriageView(state, onStateChange) {
  const view = el('div', 'triage-view');

  // Header
  const header = el('div', 'triage-header');

  const backBtn = el('button', 'triage-back');
  backBtn.textContent = '← Exit';
  backBtn.addEventListener('click', () => onStateChange({ viewMode: 'gallery' }));
  header.appendChild(backBtn);

  const progress = el('div', 'triage-progress');
  progress.textContent = `${state.triageIndex + 1} / ${state.triageQueue.length}`;
  header.appendChild(progress);

  if (state.roomFilter) {
    const roomLabel = el('div', 'triage-room-label');
    roomLabel.textContent = formatLabel(state.roomFilter);
    roomLabel.style.color = ROOM_COLORS[state.roomFilter] || '#888';
    header.appendChild(roomLabel);
  } else {
    header.appendChild(el('div')); // spacer
  }

  view.appendChild(header);

  // Progress bar
  const progressBar = el('div', 'triage-progress-bar');
  const progressFill = el('div', 'triage-progress-fill');
  const pct = state.triageQueue.length > 0 ? (state.triageIndex / state.triageQueue.length) * 100 : 0;
  progressFill.style.width = `${pct}%`;
  progressBar.appendChild(progressFill);
  view.appendChild(progressBar);

  // Card container
  const cardContainer = el('div', 'triage-card-container');

  if (state.triageIndex >= state.triageQueue.length) {
    // All done
    const done = el('div', 'triage-done');
    done.textContent = 'All done';
    cardContainer.appendChild(done);
    view.appendChild(cardContainer);

    const viewSummaryBtn = el('button', 'triage-summary-btn');
    viewSummaryBtn.textContent = 'View Summary';
    viewSummaryBtn.addEventListener('click', () => onStateChange({ viewMode: 'summary' }));
    view.appendChild(viewSummaryBtn);
    return view;
  }

  const currentId = state.triageQueue[state.triageIndex];
  const item = state.objects.find(i => i.id === currentId);
  if (!item) return view;

  const cardClasses = ['triage-card'];
  if (state.triageAnimation) cardClasses.push(state.triageAnimation);
  const card = el('div', cardClasses.join(' '));

  // Photo
  const photo = el('div', 'triage-card-photo');
  photo.style.setProperty('--room-color', ROOM_COLORS[item.tags.room] || '#888');
  const img = document.createElement('img');
  img.src = imageUrl(item.id);
  img.alt = item.name;
  img.className = 'triage-card-img';
  img.onerror = function () {
    this.style.display = 'none';
    const fallback = el('div', 'triage-card-fallback');
    fallback.textContent = item.icon;
    photo.appendChild(fallback);
  };
  photo.appendChild(img);
  card.appendChild(photo);

  // Info
  const info = el('div', 'triage-card-info');

  const nameEl = el('h2', 'triage-card-name');
  nameEl.textContent = item.name;
  info.appendChild(nameEl);

  if (item.description) {
    const desc = el('div', 'triage-card-desc');
    desc.textContent = item.description;
    info.appendChild(desc);
  }

  const metaTags = el('div', 'triage-card-meta');
  const tags = [
    formatLabel(item.tags.room),
    formatLabel(item.tags.category),
    `${item.size} — ${formatVolume(item.volume_liters)}`,
    formatLabel(item.usageFrequency),
    `${formatLabel(item.attachment)} attachment`,
  ];
  for (const t of tags) {
    const tag = el('span', 'meta-tag');
    tag.textContent = t;
    metaTags.appendChild(tag);
  }
  info.appendChild(metaTags);
  card.appendChild(info);

  cardContainer.appendChild(card);
  view.appendChild(cardContainer);

  // Action buttons
  const actions = el('div', 'triage-actions');

  const bkBtn = el('button', 'triage-action-btn back-btn');
  bkBtn.innerHTML = '<span class="action-key">B</span> ‹ Back';
  bkBtn.disabled = state.triageIndex === 0;
  bkBtn.addEventListener('click', () => {
    const ev = new KeyboardEvent('keydown', { key: 'b' });
    document.dispatchEvent(ev);
  });
  actions.appendChild(bkBtn);

  const donateBtn = el('button', 'triage-action-btn donate');
  donateBtn.innerHTML = '<span class="action-key">1</span> Donate';
  donateBtn.addEventListener('click', () => {
    const ev = new KeyboardEvent('keydown', { key: '1' });
    document.dispatchEvent(ev);
  });
  actions.appendChild(donateBtn);

  const trashBtn = el('button', 'triage-action-btn trash');
  trashBtn.innerHTML = '<span class="action-key">2</span> Trash';
  trashBtn.addEventListener('click', () => {
    const ev = new KeyboardEvent('keydown', { key: '2' });
    document.dispatchEvent(ev);
  });
  actions.appendChild(trashBtn);

  const storeBtn = el('button', 'triage-action-btn store');
  storeBtn.innerHTML = '<span class="action-key">3</span> Store';
  storeBtn.addEventListener('click', () => {
    const ev = new KeyboardEvent('keydown', { key: '3' });
    document.dispatchEvent(ev);
  });
  actions.appendChild(storeBtn);

  const skipBtn = el('button', 'triage-action-btn skip');
  skipBtn.innerHTML = '<span class="action-key">S</span> Skip ›';
  skipBtn.addEventListener('click', () => {
    const ev = new KeyboardEvent('keydown', { key: 's' });
    document.dispatchEvent(ev);
  });
  actions.appendChild(skipBtn);

  view.appendChild(actions);
  return view;
}

// ─── Summary View ───

function renderSummaryView(state, onStateChange) {
  const view = el('div', 'summary-view');

  // Header
  const header = el('div', 'summary-header');
  const backBtn = el('button', 'summary-back');
  backBtn.textContent = '← Back to Gallery';
  backBtn.addEventListener('click', () => onStateChange({ viewMode: 'gallery' }));
  header.appendChild(backBtn);

  const title = el('h1', 'summary-title');
  title.textContent = 'Triage Summary';
  header.appendChild(title);
  view.appendChild(header);

  // Stats
  const stats = el('div', 'summary-stats');
  const donateItems = state.objects.filter(i => state.decisions[i.id] === 'donate');
  const trashItems = state.objects.filter(i => state.decisions[i.id] === 'trash');
  const storeItems = state.objects.filter(i => state.decisions[i.id] === 'store');
  const remaining = state.objects.length - donateItems.length - trashItems.length - storeItems.length;

  stats.appendChild(renderStatCard('Donate', donateItems.length, totalVolume(donateItems), 'stat-donate'));
  stats.appendChild(renderStatCard('Trash', trashItems.length, totalVolume(trashItems), 'stat-trash'));
  stats.appendChild(renderStatCard('Store', storeItems.length, totalVolume(storeItems), 'stat-store'));

  const remCard = el('div', 'stat-card stat-remaining');
  const remNum = el('div', 'stat-number');
  remNum.textContent = remaining;
  remCard.appendChild(remNum);
  const remLabel = el('div', 'stat-label');
  remLabel.textContent = 'Remaining';
  remCard.appendChild(remLabel);
  stats.appendChild(remCard);

  view.appendChild(stats);

  // Sections
  const sections = [
    ['donate', 'Donate', donateItems, 'donate-color'],
    ['trash', 'Trash', trashItems, 'trash-color'],
    ['store', 'Store', storeItems, 'store-color'],
  ];

  for (const [action, label, items, colorClass] of sections) {
    if (items.length === 0) continue;

    const section = el('div', 'summary-section');
    const sectionTitle = el('h2', `summary-section-title ${colorClass}`);
    sectionTitle.textContent = `${label} (${items.length})`;
    section.appendChild(sectionTitle);

    const grid = el('div', 'summary-grid');
    for (const item of items) {
      const card = el('div', 'summary-item');

      const photo = el('div', 'summary-item-photo');
      const img = document.createElement('img');
      img.src = imageUrl(item.id, true);
      img.alt = item.name;
      img.className = 'summary-item-img';
      img.loading = 'lazy';
      img.onerror = function () {
        this.style.display = 'none';
        const fallback = el('div', 'summary-item-fallback');
        fallback.textContent = item.icon;
        photo.appendChild(fallback);
      };
      photo.appendChild(img);
      card.appendChild(photo);

      const name = el('div', 'summary-item-name');
      name.textContent = item.name;
      card.appendChild(name);

      const changeBtn = el('button', `summary-item-change decision-${action}`);
      changeBtn.textContent = label;
      changeBtn.addEventListener('click', () => {
        const cycle = ['donate', 'trash', 'store'];
        const idx = cycle.indexOf(state.decisions[item.id]);
        const next = cycle[(idx + 1) % cycle.length];
        const newDecisions = { ...state.decisions, [item.id]: next };
        onStateChange({ decisions: newDecisions });
      });
      card.appendChild(changeBtn);

      grid.appendChild(card);
    }
    section.appendChild(grid);
    view.appendChild(section);
  }

  if (donateItems.length === 0 && trashItems.length === 0 && storeItems.length === 0) {
    const empty = el('div', 'summary-empty');
    empty.textContent = 'No decisions yet. Use the gallery or triage mode to categorize items.';
    view.appendChild(empty);
  }

  return view;
}

function renderStatCard(label, count, volume, className) {
  const card = el('div', `stat-card ${className}`);
  const num = el('div', 'stat-number');
  num.textContent = count;
  card.appendChild(num);
  const lbl = el('div', 'stat-label');
  lbl.textContent = label;
  card.appendChild(lbl);
  const vol = el('div', 'stat-volume');
  vol.textContent = formatVolume(volume);
  card.appendChild(vol);
  return card;
}

// ─── Helpers ───

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function addProp(container, label, value) {
  const row = el('div', 'prop-row');
  const l = el('span', 'prop-label');
  l.textContent = label;
  const v = el('span', 'prop-value');
  v.textContent = value;
  row.appendChild(l);
  row.appendChild(v);
  container.appendChild(row);
}

function preloadAdjacent(item, state) {
  const items = getVisibleItems(state);
  const idx = items.findIndex(i => i.id === item.id);
  if (idx === -1) return;
  [-1, 1].forEach(offset => {
    const adj = items[idx + offset];
    if (adj) {
      const img = new Image();
      img.src = imageUrl(adj.id);
    }
  });
}
