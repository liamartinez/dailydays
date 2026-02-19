// ui-gallery.js — Gallery view with tag + room filtering
// FLIP-animated grid, overlay detail modal, hover overlays.

import { staleness } from '../../shared/js/store.js';
import { formatLabel } from '../../shared/js/colors.js';
import { imageUrl } from '../../shared/js/images.js';
import { getTagDef } from './tags.js';
import { getVisibleItems, getItemTags } from './app.js';
import { el, addProp } from './ui-helpers.js';

// Persistent DOM references (survive across renders)
let headerEl = null;
let gridEl = null;
let wrapperEl = null;
let modalEl = null;

// Card DOM cache: item.id -> DOM node
const cardCache = new Map();

// Size presets
const SIZES = [
  { label: 'S', value: 100 },
  { label: 'M', value: 160 },
  { label: 'L', value: 260 },
];

// --- Main Gallery Render ---

export function renderGalleryView(container, state, onStateChange) {
  // First render: build structure
  if (!headerEl) {
    headerEl = el('div', 'gallery-header');
    wrapperEl = el('div', 'gallery-wrapper');
    gridEl = el('div', 'gallery-grid');
    wrapperEl.appendChild(gridEl);
    container.appendChild(headerEl);
    container.appendChild(wrapperEl);

    // Modal (lives outside the grid, overlays everything)
    modalEl = el('div', 'detail-modal');
    modalEl.innerHTML = '<div class="detail-modal-backdrop"></div><div class="detail-modal-panel"></div>';
    container.appendChild(modalEl);

    // Backdrop click closes
    modalEl.querySelector('.detail-modal-backdrop').addEventListener('click', () => {
      onStateChange({ selectedItemId: null });
    });
  }

  // Show gallery DOM
  headerEl.style.display = '';
  wrapperEl.style.display = '';
  modalEl.style.display = '';

  // Header always rebuilds (small, no animation needed)
  headerEl.innerHTML = '';
  renderHeaderContent(headerEl, state, onStateChange);

  // Grid reconciles with FLIP
  reconcileGrid(gridEl, state, onStateChange);

  // Modal
  renderModal(state, onStateChange);
}

/** Hide gallery DOM when switching to another view */
export function hideGallery() {
  if (headerEl) headerEl.style.display = 'none';
  if (wrapperEl) wrapperEl.style.display = 'none';
  if (modalEl) {
    modalEl.classList.remove('open');
    modalEl.style.display = 'none';
  }
}

// --- Header ---

function renderHeaderContent(header, state, onStateChange) {
  const visible = getVisibleItems();

  // Title row: back button + title + count + size toggles
  const titleRow = el('div', 'header-title-row');

  // Back to landing
  const backBtn = el('button', 'gallery-back-btn');
  backBtn.textContent = '\u2190';
  backBtn.title = 'Back to categories';
  backBtn.addEventListener('click', () =>
    onStateChange({ view: 'landing', selectedItemId: null, activeRoom: null, activeTag: null })
  );
  titleRow.appendChild(backBtn);

  const title = el('h1', 'gallery-title');
  title.textContent = state.activeRoom ? formatLabel(state.activeRoom) : 'Taking Stock';
  titleRow.appendChild(title);

  const count = el('span', 'gallery-count');
  count.textContent = state.activeRoom
    ? `${visible.length} items`
    : `${visible.length} of ${state.objects.length}`;
  titleRow.appendChild(count);

  // Size toggles (S / M / L)
  const sizeToggles = el('div', 'size-toggles');
  for (const s of SIZES) {
    const btn = el('button', `size-btn ${state.gridSize === s.value ? 'active' : ''}`);
    btn.textContent = s.label;
    btn.addEventListener('click', () => {
      onStateChange({ gridSize: s.value, selectedItemId: null });
    });
    sizeToggles.appendChild(btn);
  }
  titleRow.appendChild(sizeToggles);

  header.appendChild(titleRow);

  // Subtitle
  const subtitle = el('div', 'gallery-subtitle');
  if (state.activeRoom) {
    subtitle.textContent = `${visible.length} things, catalogued`;
  } else {
    const activeDef = state.activeTag ? getTagDef(state.activeTag) : null;
    subtitle.textContent = activeDef ? activeDef.subtitle : `${visible.length} things, catalogued`;
  }
  header.appendChild(subtitle);
}

// --- Grid Reconciliation with FLIP ---

function reconcileGrid(grid, state, onStateChange) {
  const items = getVisibleItems();
  const newIds = new Set(items.map(i => i.id));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Apply grid size
  grid.style.setProperty('--card-min', state.gridSize + 'px');

  // -- FIRST: snapshot current card positions --
  const firstPositions = new Map();
  if (!reducedMotion) {
    for (const [id, card] of cardCache) {
      if (card.parentNode) {
        firstPositions.set(id, card.getBoundingClientRect());
      }
    }
  }

  // -- Identify which cards are currently in the grid --
  const currentIds = new Set();
  for (const child of Array.from(grid.children)) {
    const id = child.dataset.id;
    if (id) currentIds.add(id);
  }

  // -- Remove exiting cards immediately --
  for (const id of currentIds) {
    if (!newIds.has(id)) {
      const card = cardCache.get(id);
      if (card) {
        card.remove();
        cardCache.delete(id);
      }
    }
  }

  // -- Build/reorder cards --
  const entering = [];
  for (const item of items) {
    let card = cardCache.get(item.id);
    if (!card) {
      card = renderCard(item, state, onStateChange);
      card.dataset.id = item.id;
      cardCache.set(item.id, card);
      entering.push(item.id);
    }
    // Update selected state
    card.classList.toggle('selected', item.id === state.selectedItemId);
    // Append in sorted order (moves existing nodes or adds new)
    grid.appendChild(card);
  }

  // -- FLIP: animate position changes --
  if (reducedMotion || firstPositions.size === 0) return;

  const viewportH = window.innerHeight;

  for (const item of items) {
    const card = cardCache.get(item.id);
    if (!card) continue;

    const isEntering = entering.includes(item.id);
    const last = card.getBoundingClientRect();

    if (isEntering) {
      // Fade in new cards
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          card.style.opacity = '1';
          card.style.transform = '';
          card.addEventListener('transitionend', () => {
            card.style.transition = '';
            card.style.opacity = '';
            card.style.transform = '';
          }, { once: true });
        });
      });
      continue;
    }

    const first = firstPositions.get(item.id);
    if (!first) continue;

    // Skip off-screen cards
    if (last.top > viewportH + 300 && first.top > viewportH + 300) continue;

    const dx = first.left - last.left;
    const dy = first.top - last.top;

    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

    // INVERT: snap to old position
    card.style.transform = `translate(${dx}px, ${dy}px)`;
    card.style.transition = 'none';

    // PLAY: animate to new position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)';
        card.style.transform = '';
        card.addEventListener('transitionend', () => {
          card.style.transition = '';
          card.style.transform = '';
        }, { once: true });
      });
    });
  }
}

// --- Card Rendering ---

function renderCard(item, state, onStateChange) {
  const card = el('div', 'gallery-card');
  card.addEventListener('click', () => {
    onStateChange({
      selectedItemId: state.selectedItemId === item.id ? null : item.id,
    });
  });

  // Photo (cards are photo-only, text on hover)
  const photoArea = el('div', 'card-photo');
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

  // Hover overlay (name + room + description)
  const overlay = el('div', 'card-hover-overlay');

  const overlayName = el('div', 'overlay-name');
  overlayName.textContent = item.name;
  overlay.appendChild(overlayName);

  const overlayMeta = el('div', 'overlay-meta');
  overlayMeta.textContent = formatLabel(item.tags.room);
  overlay.appendChild(overlayMeta);

  if (item.description) {
    const overlayDesc = el('div', 'overlay-desc');
    overlayDesc.textContent = item.description;
    overlay.appendChild(overlayDesc);
  }

  photoArea.appendChild(overlay);
  card.appendChild(photoArea);

  return card;
}

// --- Modal Detail Panel ---

function renderModal(state, onStateChange) {
  if (!state.selectedItemId) {
    modalEl.classList.remove('open');
    return;
  }

  const item = state.objects.find(o => o.id === state.selectedItemId);
  if (!item) {
    modalEl.classList.remove('open');
    return;
  }

  const panel = modalEl.querySelector('.detail-modal-panel');
  panel.innerHTML = '';

  // Close button
  const closeBtn = el('button', 'modal-close');
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', () => onStateChange({ selectedItemId: null }));
  panel.appendChild(closeBtn);

  // Photo
  const photoWrap = el('div', 'modal-photo');
  const img = document.createElement('img');
  img.src = imageUrl(item.id);
  img.alt = item.name;
  img.className = 'modal-img';
  img.onerror = function () {
    this.style.display = 'none';
    const fb = el('div', 'modal-fallback');
    fb.textContent = item.icon;
    photoWrap.appendChild(fb);
  };
  photoWrap.appendChild(img);
  panel.appendChild(photoWrap);

  // Info
  const info = el('div', 'modal-info');

  const name = el('div', 'detail-name');
  name.textContent = item.name;
  info.appendChild(name);

  const path = el('div', 'detail-path');
  path.textContent = `${formatLabel(item.tags.room)} / ${formatLabel(item.tags.category)}`;
  info.appendChild(path);

  if (item.description) {
    const desc = el('div', 'detail-desc');
    desc.textContent = item.description;
    info.appendChild(desc);
  }

  // Properties (curated — keep it minimal)
  const props = el('div', 'detail-props');
  addProp(props, 'How often', formatLabel(item.usageFrequency));
  if (item.lastUsed) {
    const days = staleness(item);
    addProp(props, 'Last picked up', `${item.lastUsed} (${days}d ago)`);
  }
  if (item.detail && item.detail.brand) addProp(props, 'Brand', item.detail.brand);
  info.appendChild(props);

  // Tags
  const itemTagIds = getItemTags(item.id);
  if (itemTagIds.length > 0) {
    const tagsSection = el('div', 'detail-tags');
    const tagsLabel = el('div', 'tags-label');
    tagsLabel.textContent = 'Tags';
    tagsSection.appendChild(tagsLabel);

    const tagsList = el('div', 'tags-list');
    for (const tagId of itemTagIds) {
      const def = getTagDef(tagId);
      if (!def) continue;
      const pill = el('button', `tag-pill ${state.activeTag === tagId ? 'active' : ''}`);
      pill.textContent = def.label;
      pill.title = def.subtitle;
      pill.addEventListener('click', () => {
        onStateChange({ activeTag: tagId, selectedItemId: null });
      });
      tagsList.appendChild(pill);
    }
    tagsSection.appendChild(tagsList);
    info.appendChild(tagsSection);
  }

  panel.appendChild(info);

  // Show
  modalEl.classList.add('open');
}
