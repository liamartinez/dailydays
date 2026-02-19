// ui-landing.js — Editorial landing page with horizontal scroll categories
// Room-based browsing + curated tag exploration, Monte Cafe-inspired.

import { imageUrl } from '../../shared/js/images.js';
import { ROOM_COLORS, formatLabel } from '../../shared/js/colors.js';
import { getTagDef, tagCounts } from './tags.js';
import { getStackItems } from './app.js';
import { el } from './ui-helpers.js';

// Curated tags for the landing page (order matters)
const FEATURED_TAGS = [
  'loyal-companion',
  'ghost',
  'pandemic-purchase',
  'aspirational-self',
  'dust-collector',
  'guilt-trip',
  'decade-club',
];

// Persistent DOM
let landingEl = null;

export function renderLandingView(container, state, onStateChange) {
  if (!landingEl) {
    landingEl = el('div', 'landing-page');
    container.appendChild(landingEl);
  }

  landingEl.style.display = '';
  landingEl.innerHTML = '';

  // Header: title only
  const header = el('div', 'landing-header');
  const title = el('h1', 'landing-title');
  title.textContent = 'Taking Stock';
  header.appendChild(title);
  landingEl.appendChild(header);

  // ─── Rooms Section ───
  buildSection(landingEl, 'Rooms', state, onStateChange, buildRoomCards);

  // ─── Transitional Divider ───
  const divider = el('div', 'landing-section-divider');
  divider.textContent = 'Now, what they say about you';
  landingEl.appendChild(divider);

  // ─── Explore Section ───
  buildSection(landingEl, 'Explore', state, onStateChange, buildTagCards);
}

export function hideLanding() {
  if (landingEl) landingEl.style.display = 'none';
}

// ─── Section Builder (label + scroll row + arrows) ───

function buildSection(parent, label, state, onStateChange, buildCardsFn) {
  const sectionLabel = el('div', 'landing-section-label');
  sectionLabel.textContent = label;
  parent.appendChild(sectionLabel);

  const scrollWrap = el('div', 'landing-scroll-wrap');
  const grid = el('div', 'landing-grid');

  buildCardsFn(grid, state, onStateChange);

  scrollWrap.appendChild(grid);
  parent.appendChild(scrollWrap);

  // Scroll navigation arrows
  const scrollNav = el('div', 'landing-scroll-nav');

  const leftArrow = el('button', 'landing-arrow');
  leftArrow.textContent = '\u2190';
  leftArrow.title = 'Scroll left';
  leftArrow.addEventListener('click', () => {
    grid.scrollBy({ left: -260, behavior: 'smooth' });
  });

  const rightArrow = el('button', 'landing-arrow');
  rightArrow.textContent = '\u2192';
  rightArrow.title = 'Scroll right';
  rightArrow.addEventListener('click', () => {
    grid.scrollBy({ left: 260, behavior: 'smooth' });
  });

  scrollNav.appendChild(leftArrow);
  scrollNav.appendChild(rightArrow);
  parent.appendChild(scrollNav);
}

// ─── Room Cards ───

function buildRoomCards(grid, state, onStateChange) {
  const rooms = Object.keys(ROOM_COLORS);
  const usedHeroIds = new Set();

  for (let i = 0; i < rooms.length; i++) {
    const roomKey = rooms[i];
    const roomItems = state.objects.filter(o => o.tags.room === roomKey);
    if (roomItems.length === 0) continue;

    // Pick a hero from middle of list for variety
    const offset = Math.floor(roomItems.length * (i + 1) / (rooms.length + 1));
    let heroItem = null;
    for (let j = 0; j < roomItems.length; j++) {
      const candidate = roomItems[(offset + j) % roomItems.length];
      if (!usedHeroIds.has(candidate.id)) {
        heroItem = candidate;
        break;
      }
    }
    if (!heroItem) heroItem = roomItems[0];
    usedHeroIds.add(heroItem.id);

    const card = el('div', 'landing-card landing-card-sm');
    card.addEventListener('click', () => {
      onStateChange({ view: 'gallery', activeRoom: roomKey, activeTag: null });
    });

    // Hero image
    const heroWrap = el('div', 'landing-hero');
    const img = document.createElement('img');
    img.src = imageUrl(heroItem.id);
    img.alt = formatLabel(roomKey);
    img.className = 'landing-hero-img';
    img.loading = 'lazy';
    img.onerror = function () {
      this.style.display = 'none';
      heroWrap.classList.add('landing-hero-fallback');
      const fb = el('div', 'landing-hero-icon');
      fb.textContent = heroItem.icon;
      heroWrap.appendChild(fb);
    };
    heroWrap.appendChild(img);
    card.appendChild(heroWrap);

    // Info
    const info = el('div', 'landing-card-info');

    const label = el('h2', 'landing-card-label');
    label.textContent = formatLabel(roomKey);
    info.appendChild(label);

    const countEl = el('span', 'landing-card-count');
    countEl.textContent = `${roomItems.length} items`;
    info.appendChild(countEl);

    card.appendChild(info);
    grid.appendChild(card);
  }
}

// ─── Tag Cards ───

function buildTagCards(grid, state, onStateChange) {
  const counts = tagCounts(state.objects);
  const usedHeroIds = new Set();

  for (let tagIdx = 0; tagIdx < FEATURED_TAGS.length; tagIdx++) {
    const tagId = FEATURED_TAGS[tagIdx];
    const def = getTagDef(tagId);
    if (!def) continue;
    const count = counts[tagId] || 0;
    if (count === 0) continue;

    const items = getStackItems(tagId);
    // Pick a hero that hasn't been used yet
    const offset = Math.floor(items.length * (tagIdx + 1) / (FEATURED_TAGS.length + 1));
    let heroItem = null;
    for (let i = 0; i < items.length; i++) {
      const candidate = items[(offset + i) % items.length];
      if (!usedHeroIds.has(candidate.id)) {
        heroItem = candidate;
        break;
      }
    }
    if (!heroItem) heroItem = items[0];
    usedHeroIds.add(heroItem.id);

    const card = el('div', 'landing-card');
    card.addEventListener('click', () => {
      onStateChange({ view: 'stack', stackTag: tagId, stackIndex: 0 });
    });

    // Hero image
    const heroWrap = el('div', 'landing-hero');
    if (heroItem) {
      const img = document.createElement('img');
      img.src = imageUrl(heroItem.id);
      img.alt = def.label;
      img.className = 'landing-hero-img';
      img.loading = 'lazy';
      img.onerror = function () {
        this.style.display = 'none';
        heroWrap.classList.add('landing-hero-fallback');
        const fb = el('div', 'landing-hero-icon');
        fb.textContent = heroItem.icon;
        heroWrap.appendChild(fb);
      };
      heroWrap.appendChild(img);
    }
    card.appendChild(heroWrap);

    // Info below image
    const info = el('div', 'landing-card-info');

    const label = el('h2', 'landing-card-label');
    label.textContent = def.label;
    info.appendChild(label);

    const sub = el('p', 'landing-card-subtitle');
    sub.textContent = def.subtitle;
    info.appendChild(sub);

    const countEl = el('span', 'landing-card-count');
    countEl.textContent = `${count} items`;
    info.appendChild(countEl);

    card.appendChild(info);
    grid.appendChild(card);
  }

  // "Everything" card — mosaic of 4 thumbnails
  const evCard = el('div', 'landing-card landing-card-everything');
  evCard.addEventListener('click', () => {
    onStateChange({ view: 'gallery', activeTag: null, activeRoom: null });
  });

  const mosaic = el('div', 'landing-mosaic');
  const seen = new Set();
  const mosaicItems = [];
  for (const item of state.objects) {
    if (!seen.has(item.tags.room) && mosaicItems.length < 4) {
      seen.add(item.tags.room);
      mosaicItems.push(item);
    }
  }
  for (const item of state.objects) {
    if (mosaicItems.length >= 4) break;
    if (!mosaicItems.includes(item)) mosaicItems.push(item);
  }

  for (const item of mosaicItems.slice(0, 4)) {
    const thumb = document.createElement('img');
    thumb.src = imageUrl(item.id, true);
    thumb.alt = item.name;
    thumb.className = 'landing-mosaic-img';
    thumb.loading = 'lazy';
    thumb.onerror = function () {
      this.style.display = 'none';
    };
    mosaic.appendChild(thumb);
  }
  evCard.appendChild(mosaic);

  const evInfo = el('div', 'landing-card-info');
  const evLabel = el('h2', 'landing-card-label');
  evLabel.textContent = 'Everything';
  evInfo.appendChild(evLabel);

  const evSub = el('p', 'landing-card-subtitle');
  evSub.textContent = 'Browse the full collection';
  evInfo.appendChild(evSub);

  const evCount = el('span', 'landing-card-count');
  evCount.textContent = `${state.objects.length} items`;
  evInfo.appendChild(evCount);

  evCard.appendChild(evInfo);
  grid.appendChild(evCard);
}
