// ui.js — Photo gallery with room-grouped grid and lightbox detail view
// Displays AI-generated "phone photos" of household items.

import { filterMultiple, sortBy, formatVolume, totalVolume, groupByTag, staleness } from '../../shared/js/store.js';
import { ROOM_COLORS, formatLabel } from '../../shared/js/colors.js';
import { imageUrl } from '../../shared/js/images.js';

// ─── Main Render ───

export function renderApp(container, state, onStateChange) {
  container.innerHTML = '';

  container.appendChild(renderHeader(state, onStateChange));
  container.appendChild(renderGallery(state, onStateChange));

  if (state.selectedItemId) {
    const item = state.objects.find(i => i.id === state.selectedItemId);
    if (item) {
      container.appendChild(renderLightbox(item, state, onStateChange));
    }
  }
}

// ─── Header ───

function renderHeader(state, onStateChange) {
  const header = el('div', 'gallery-header');

  const title = el('h1', 'gallery-title');
  title.textContent = 'Declutter Gallery';
  header.appendChild(title);

  const subtitle = el('div', 'gallery-subtitle');
  const filtered = getFiltered(state);
  subtitle.textContent = `${filtered.length} items — ${formatVolume(totalVolume(filtered))}`;
  header.appendChild(subtitle);

  // Room filter tabs
  const tabs = el('div', 'room-tabs');

  const allTab = el('button', `room-tab ${state.roomFilter === null ? 'active' : ''}`);
  allTab.textContent = 'All';
  allTab.addEventListener('click', () => onStateChange({ roomFilter: null }));
  tabs.appendChild(allTab);

  // Get rooms that have items
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
  const filtered = getFiltered(state);
  const sorted = sortBy(filtered, state.sortField, state.sortDirection);

  // Filter by room if set
  const items = state.roomFilter
    ? sorted.filter(i => i.tags.room === state.roomFilter)
    : sorted;

  if (state.roomFilter) {
    // Single room — just render a flat grid
    const grid = renderGrid(items, state, onStateChange);
    wrapper.appendChild(grid);
  } else {
    // All rooms — group by room with section headers
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

      const grid = renderGrid(groups[room], state, onStateChange);
      section.appendChild(grid);
      wrapper.appendChild(section);
    }
  }

  return wrapper;
}

function renderGrid(items, state, onStateChange) {
  const grid = el('div', 'gallery-grid');

  for (const item of items) {
    const card = el('div', 'gallery-card');
    card.addEventListener('click', () => onStateChange({ selectedItemId: item.id }));

    // Photo area
    const photoArea = el('div', 'card-photo');
    photoArea.style.setProperty('--room-color', ROOM_COLORS[item.tags.room] || '#888');

    const img = document.createElement('img');
    img.src = imageUrl(item.id, true); // thumbnail
    img.alt = item.name;
    img.loading = 'lazy';
    img.className = 'card-img';
    img.onerror = function () {
      this.style.display = 'none';
      // Show emoji fallback
      const fallback = el('div', 'card-fallback');
      fallback.textContent = item.icon;
      photoArea.appendChild(fallback);
    };
    photoArea.appendChild(img);

    // Status indicator
    if (item.status !== 'keeping') {
      const badge = el('div', `card-badge status-${item.status}`);
      badge.textContent = item.status === 'considering' ? '?' : '✕';
      photoArea.appendChild(badge);
    }

    card.appendChild(photoArea);

    // Name
    const name = el('div', 'card-name');
    name.textContent = item.name;
    card.appendChild(name);

    // Meta
    const meta = el('div', 'card-meta');
    meta.textContent = formatLabel(item.tags.category);
    card.appendChild(meta);

    grid.appendChild(card);
  }

  return grid;
}

// ─── Lightbox ───

function renderLightbox(item, state, onStateChange) {
  const overlay = el('div', 'lightbox-overlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onStateChange({ selectedItemId: null });
  });

  const modal = el('div', 'lightbox-modal');

  // Close button
  const close = el('button', 'lightbox-close');
  close.textContent = '✕';
  close.addEventListener('click', () => onStateChange({ selectedItemId: null }));
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
  fullImg.src = imageUrl(item.id); // full-size
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

  // Header
  const header = el('div', 'lightbox-header');
  const icon = el('span', 'lightbox-icon');
  icon.textContent = item.icon;
  header.appendChild(icon);
  const name = el('h2', 'lightbox-name');
  name.textContent = item.name;
  header.appendChild(name);
  info.appendChild(header);

  // Path
  const path = el('div', 'lightbox-path');
  const roomDot = el('span', 'room-dot');
  roomDot.style.background = ROOM_COLORS[item.tags.room] || '#888';
  path.appendChild(roomDot);
  const pathText = document.createTextNode(
    ` ${formatLabel(item.tags.room)} › ${formatLabel(item.tags.category)}`
  );
  path.appendChild(pathText);
  info.appendChild(path);

  // Description
  if (item.description) {
    const desc = el('div', 'lightbox-desc');
    desc.textContent = item.description;
    info.appendChild(desc);
  }

  // Properties
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

  // Detail fields
  if (item.detail) {
    const det = item.detail;
    const detailSection = el('div', 'lightbox-detail');
    if (det.brand) addProp(detailSection, 'Brand', det.brand);
    if (det.model) addProp(detailSection, 'Model', det.model);
    if (det.color) addProp(detailSection, 'Color', det.color);
    if (det.material) addProp(detailSection, 'Material', det.material);
    if (det.contents) addProp(detailSection, 'Contents', det.contents);
    if (det.titles && Array.isArray(det.titles)) {
      const titles = det.titles.map(t =>
        typeof t === 'string' ? t : `${t.title} — ${t.author}`
      ).join(', ');
      addProp(detailSection, 'Titles', titles);
    }
    info.appendChild(detailSection);
  }

  // Status toggle
  const statusBtn = el('button', `lightbox-status status-${item.status}`);
  statusBtn.textContent = item.status === 'keeping' ? 'Keeping' : item.status === 'considering' ? 'Maybe' : 'Remove';
  statusBtn.addEventListener('click', () => {
    const order = ['keeping', 'considering', 'removed'];
    const idx = order.indexOf(item.status);
    item.status = order[(idx + 1) % order.length];
    onStateChange({});
  });
  info.appendChild(statusBtn);

  modal.appendChild(info);
  overlay.appendChild(modal);

  // Preload adjacent images
  preloadAdjacent(item, state);

  return overlay;
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

function getFiltered(state) {
  return filterMultiple(state.objects, state.filters);
}

function preloadAdjacent(item, state) {
  const filtered = getFiltered(state);
  const sorted = sortBy(filtered, state.sortField, state.sortDirection);
  const items = state.roomFilter
    ? sorted.filter(i => i.tags.room === state.roomFilter)
    : sorted;

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
