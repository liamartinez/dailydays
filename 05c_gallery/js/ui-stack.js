// ui-stack.js — Card stack view with side-by-side layout
// Photo left, details right. Tap to advance through items.

import { imageUrl } from '../../shared/js/images.js';
import { formatLabel } from '../../shared/js/colors.js';
import { formatVolume, staleness } from '../../shared/js/store.js';
import { getTagDef } from './tags.js';
import { getStackItems, getItemTags } from './app.js';
import { el, addProp } from './ui-helpers.js';

// Persistent DOM
let stackEl = null;
let prevIndex = -1;
let animDirection = 'none'; // 'next' | 'prev' | 'none'

export function renderStackView(container, state, onStateChange) {
  const tagDef = getTagDef(state.stackTag);
  const items = getStackItems(state.stackTag);
  const idx = Math.min(state.stackIndex, items.length - 1);
  const item = items[idx];

  if (!stackEl) {
    stackEl = el('div', 'stack-view');
    container.appendChild(stackEl);
  }

  stackEl.style.display = '';
  stackEl.innerHTML = '';

  // Determine animation direction
  if (prevIndex >= 0 && prevIndex !== idx) {
    animDirection = idx > prevIndex ? 'next' : 'prev';
  } else {
    animDirection = 'none';
  }
  prevIndex = idx;

  // --- Header ---
  const header = el('div', 'stack-header');

  const backBtn = el('button', 'stack-back');
  backBtn.textContent = '\u2190';
  backBtn.title = 'Back to categories';
  backBtn.addEventListener('click', () => {
    prevIndex = -1;
    onStateChange({ view: 'landing', stackTag: null, stackIndex: 0 });
  });
  header.appendChild(backBtn);

  const titleWrap = el('div', 'stack-title-wrap');
  const titleEl = el('h2', 'stack-title');
  titleEl.textContent = tagDef ? tagDef.label : 'All Items';
  titleWrap.appendChild(titleEl);

  if (tagDef) {
    const subEl = el('span', 'stack-subtitle');
    subEl.textContent = tagDef.subtitle;
    titleWrap.appendChild(subEl);
  }
  header.appendChild(titleWrap);

  const counter = el('span', 'stack-counter');
  counter.textContent = `${idx + 1} / ${items.length}`;
  header.appendChild(counter);

  stackEl.appendChild(header);

  // --- Card area ---
  if (!item) {
    const empty = el('div', 'stack-empty');
    empty.textContent = 'No items in this category.';
    stackEl.appendChild(empty);
    return;
  }

  const cardArea = el('div', 'stack-card-area');

  // Stacked shadow cards (behind the main card)
  for (let i = 2; i >= 1; i--) {
    const shadow = el('div', `stack-shadow stack-shadow-${i}`);
    cardArea.appendChild(shadow);
  }

  // Main card — horizontal flex: photo + details
  const card = el('div', 'stack-card');
  if (animDirection === 'next') {
    card.classList.add('stack-card-enter-right');
  } else if (animDirection === 'prev') {
    card.classList.add('stack-card-enter-left');
  }

  // Click to advance (on the photo area)
  card.addEventListener('click', (e) => {
    const rect = card.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const third = rect.width / 3;

    if (clickX < third && idx > 0) {
      onStateChange({ stackIndex: idx - 1 });
    } else if (idx < items.length - 1) {
      onStateChange({ stackIndex: idx + 1 });
    }
  });

  // Photo (left side)
  const photoWrap = el('div', 'stack-photo');
  const img = document.createElement('img');
  img.src = imageUrl(item.id);
  img.alt = item.name;
  img.className = 'stack-img';
  img.onerror = function () {
    this.style.display = 'none';
    const fb = el('div', 'stack-fallback');
    fb.textContent = item.icon;
    photoWrap.appendChild(fb);
  };
  photoWrap.appendChild(img);
  card.appendChild(photoWrap);

  // Details (right side, inside card)
  const details = el('div', 'stack-details');

  const name = el('h3', 'stack-item-name');
  name.textContent = item.name;
  details.appendChild(name);

  const meta = el('div', 'stack-item-meta');
  meta.textContent = `${formatLabel(item.tags.room)} / ${formatLabel(item.tags.category)}`;
  details.appendChild(meta);

  if (item.description) {
    const desc = el('p', 'stack-item-desc');
    desc.textContent = item.description;
    details.appendChild(desc);
  }

  // Detail properties
  const props = el('div', 'stack-props');
  addProp(props, 'How often', formatLabel(item.usageFrequency));
  if (item.size) addProp(props, 'Size', item.size);
  if (item.dateObtained) {
    const d = new Date(item.dateObtained);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    addProp(props, 'Arrived', `${monthNames[d.getMonth()]} ${d.getFullYear()}`);
  }
  if (item.lastUsed) {
    const days = staleness(item);
    addProp(props, 'Last picked up', `${item.lastUsed} (${days}d ago)`);
  }
  if (item.detail) {
    if (item.detail.brand) addProp(props, 'Brand', item.detail.brand);
    if (item.detail.color) addProp(props, 'Color', item.detail.color);
    if (item.detail.material) addProp(props, 'Material', item.detail.material);
  }
  if (props.children.length > 0) details.appendChild(props);

  // Tags on this item
  const itemTagIds = getItemTags(item.id);
  if (itemTagIds.length > 0) {
    const tagsRow = el('div', 'stack-tags');
    for (const tagId of itemTagIds) {
      const def = getTagDef(tagId);
      if (!def) continue;
      const pill = el('span', 'stack-tag-pill');
      pill.textContent = def.label;
      tagsRow.appendChild(pill);
    }
    details.appendChild(tagsRow);
  }

  // Navigation buttons (inside details)
  const nav = el('div', 'stack-nav');

  if (idx > 0) {
    const prevBtn = el('button', 'stack-nav-btn stack-nav-prev');
    prevBtn.textContent = '\u2190 Prev';
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onStateChange({ stackIndex: idx - 1 });
    });
    nav.appendChild(prevBtn);
  } else {
    nav.appendChild(el('span', ''));
  }

  if (idx < items.length - 1) {
    const nextBtn = el('button', 'stack-nav-btn stack-nav-next');
    nextBtn.textContent = 'Next \u2192';
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onStateChange({ stackIndex: idx + 1 });
    });
    nav.appendChild(nextBtn);
  } else {
    const endBtn = el('button', 'stack-nav-btn stack-nav-end');
    endBtn.textContent = '\u2190 Back to categories';
    endBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      prevIndex = -1;
      onStateChange({ view: 'landing', stackTag: null, stackIndex: 0 });
    });
    nav.appendChild(endBtn);
  }

  details.appendChild(nav);
  card.appendChild(details);

  cardArea.appendChild(card);
  stackEl.appendChild(cardArea);

  // Progress bar (outside card)
  const progress = el('div', 'stack-progress');
  const progressFill = el('div', 'stack-progress-fill');
  progressFill.style.width = `${((idx + 1) / items.length) * 100}%`;
  progress.appendChild(progressFill);
  stackEl.appendChild(progress);

  // Trigger animation on next frame
  if (animDirection !== 'none') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.classList.remove('stack-card-enter-right', 'stack-card-enter-left');
      });
    });
  }
}

export function hideStack() {
  if (stackEl) stackEl.style.display = 'none';
}
