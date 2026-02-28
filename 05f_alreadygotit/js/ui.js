// ui.js — DOM construction for checkout page + extension panel overlay

import { imageUrl } from '../../shared/js/images.js';
import { formatLabel } from '../../shared/js/colors.js';
import { config } from './sandbox.js?v=6';

// ── Per-item location phrases (crafted for the 20 matched items) ────
const LOCATION_PHRASES = {
  'obj-305': 'in the kitchen pantry, top shelf',
  'obj-282': 'under the kitchen sink',
  'obj-283': 'under the kitchen sink, left side',
  'obj-302': 'in the kitchen pantry, tea shelf',
  'obj-105': 'in the bedroom closet, sock drawer',
  'obj-097': 'in the bedroom closet, middle shelf',
  'obj-111': 'in the hallway closet, shoe rack',
  'obj-113': 'in the bedroom closet, top shelf',
  'obj-068': 'on the living room mantle',
  'obj-070': 'in the living room, behind the bookcase',
  'obj-087': 'on the bedroom dresser',
  'obj-217': 'in the living room display cabinet',
  'obj-136': 'in the bathroom shower caddy',
  'obj-135': 'in the bathroom medicine cabinet',
  'obj-335': 'on the bedroom vanity shelf',
  'obj-338': 'in the bathroom cabinet, second shelf',
  'obj-076': 'in the office desk drawer, tangled',
  'obj-167': 'in the office desk, top drawer',
  'obj-166': 'on the office bookshelf, bottom',
  'obj-162': 'on the office desk, mounted',
};

// ── Helpers ─────────────────────────────────────────────────────────

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const then = new Date(dateStr + 'T00:00:00');
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'over a year ago' : `${years} years ago`;
}

// ── Reason generation ───────────────────────────────────────────────
// Analyzes a DB item and returns 2–3 persuasive reasons not to re-buy

const GENERIC_REASONS = [
  'Is this an impulse buy?',
  'Could you use what you have first?',
  'Will this end up in the same spot?',
  'Do you have room for this?',
];

function generateReasons(item, db) {
  const reasons = [];

  // Usage frequency
  if (db.usageFrequency === 'never') {
    reasons.push('Never been used');
  } else if (db.usageFrequency === 'rarely') {
    reasons.push('Rarely used');
  }

  // Attachment level
  if (db.attachment === 'none' || db.attachment === 'low') {
    reasons.push('Low attachment item');
  }

  // Last used recency — only flag if stale (6+ months)
  if (db.lastUsed) {
    const daysSince = (Date.now() - new Date(db.lastUsed + 'T00:00:00')) / 86400000;
    if (daysSince > 180) {
      reasons.push(`Unused for ${formatRelativeDate(db.lastUsed)}`);
    }
  } else if (db.usageFrequency && db.usageFrequency !== 'never') {
    reasons.push('No recent usage recorded');
  }

  // Recently purchased — don't need another
  if (db.dateObtained) {
    const daysSince = (Date.now() - new Date(db.dateObtained + 'T00:00:00')) / 86400000;
    if (daysSince < 90) {
      reasons.push(`Bought just ${formatRelativeDate(db.dateObtained)}`);
    }
  }

  // Quantity from name, e.g. "(3 bags)", "(6 bottles)", "(12)"
  const qtyMatch = db.name.match(/\((\d+)/);
  if (qtyMatch && Number(qtyMatch[1]) > 1) {
    reasons.push(`You already have ${qtyMatch[1]}`);
  }

  // Description keywords that hint at excess
  if (db.description) {
    if (/half-used|mostly.?empty|never worn|backup/i.test(db.description)) {
      // Use description directly but truncate
      const truncated = db.description.length > 45
        ? db.description.slice(0, 42) + '...'
        : db.description;
      reasons.push(truncated);
    }
  }

  // Pad with generics if we have fewer than 2 data-driven reasons
  let gi = item.cartName.length % GENERIC_REASONS.length;
  while (reasons.length < 2) {
    reasons.push(GENERIC_REASONS[gi % GENERIC_REASONS.length]);
    gi++;
  }

  return reasons.slice(0, 3);
}

const DETAIL_CLASSES = ['detail-compact', 'detail-persuade'];

// ── Main render ─────────────────────────────────────────────────────

export function renderApp(container, cartItems, stats, detailLevel = 1, store = null) {
  container.innerHTML = '';

  // ── Store branding ────────────────────────────────────────────────
  const storeName = store ? store.name : 'homegoods';
  const storeSuffix = store ? store.suffix : '.';
  const searchPlaceholder = store ? store.searchPlaceholder : 'Search products...';
  const navLinksHtml = store
    ? store.navLinks.map(l => `<span class="header-link">${l}</span>`).join('')
    : '<span class="header-link">Deals</span><span class="header-link">Categories</span>';

  // ── Checkout page ───────────────────────────────────────────────
  const checkout = el('div', 'checkout-page');

  const header = el('div', 'checkout-header');
  header.innerHTML = `
    <div class="header-inner">
      <span class="store-logo">${storeName}<span class="logo-dot">${storeSuffix}</span></span>
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span class="search-placeholder">${searchPlaceholder}</span>
      </div>
      <div class="header-actions">
        ${navLinksHtml}
        <div class="cart-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="cart-badge">${cartItems.length}</span>
        </div>
      </div>
    </div>
  `;
  checkout.appendChild(header);

  const cartArea = el('div', 'cart-area');

  // Cart main column
  const cartMain = el('div', 'cart-main');
  const cartTitle = el('h1', 'cart-title');
  cartTitle.textContent = `Your Cart (0 items)`;
  cartMain.appendChild(cartTitle);

  const itemsList = el('div', 'cart-items');
  cartItems.forEach(item => itemsList.appendChild(buildCartRow(item)));
  cartMain.appendChild(itemsList);
  cartArea.appendChild(cartMain);

  // Order summary sidebar
  const subtotal = cartItems.reduce((s, c) => s + c.price * c.qty, 0);
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;

  const summary = el('div', 'order-summary');
  summary.innerHTML = `
    <h2 class="summary-title">Order Summary</h2>
    <div class="summary-row">
      <span>Subtotal (${cartItems.length} items)</span>
      <span>$${subtotal.toFixed(2)}</span>
    </div>
    <div class="summary-row">
      <span>Shipping</span>
      <span class="free-shipping">FREE</span>
    </div>
    <div class="summary-row">
      <span>Est. Tax</span>
      <span>$${tax.toFixed(2)}</span>
    </div>
    <div class="summary-divider"></div>
    <div class="summary-row summary-total">
      <span>Total</span>
      <span>$${total.toFixed(2)}</span>
    </div>
    <button class="checkout-btn">${store ? store.checkoutText : 'Proceed to Checkout'}</button>
    <p class="checkout-note">Free returns within 30 days</p>
  `;
  cartArea.appendChild(summary);
  checkout.appendChild(cartArea);
  container.appendChild(checkout);

  // ── Overlay backdrop ────────────────────────────────────────────
  container.appendChild(el('div', 'overlay-backdrop'));

  // ── Extension panel ─────────────────────────────────────────────
  const detailClass = DETAIL_CLASSES[detailLevel] || 'detail-persuade';
  const panel = el('div', `extension-panel ${detailClass}`);

  // Header
  const panelHeader = el('div', 'panel-header');
  panelHeader.innerHTML = `
    <div class="panel-header-left">
      <div class="panel-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div>
        <span class="panel-name">Already Got It</span>
        <span class="panel-subtitle">Checkout scan complete</span>
      </div>
    </div>
    <button class="panel-dismiss" aria-label="Dismiss">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  panel.appendChild(panelHeader);

  // Scan bar
  const scanBar = el('div', 'scan-bar');
  scanBar.innerHTML = `
    <span class="scan-dot"></span>
    <span class="scan-text">${stats.matchCount} of ${stats.totalCount} cart items matched to your home inventory</span>
  `;
  panel.appendChild(scanBar);

  // Match rows
  const matchesWrap = el('div', 'panel-matches');
  cartItems.filter(c => c.matched).forEach(item => {
    matchesWrap.appendChild(buildMatchRow(item, detailLevel));
  });
  panel.appendChild(matchesWrap);

  // Summary card
  const panelSummary = el('div', 'panel-summary');
  panelSummary.innerHTML = `
    <div class="savings-amount">
      <span class="savings-label">Potential savings</span>
      <span class="savings-value">$${stats.savings.toFixed(2)}</span>
    </div>
    <p class="savings-hint">Consider removing matched items from your cart</p>
    <button class="review-btn">Review Cart</button>
  `;
  panel.appendChild(panelSummary);

  // Footer
  const panelFooter = el('div', 'panel-footer');
  panelFooter.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    <span>Powered by your home inventory</span>
  `;
  panel.appendChild(panelFooter);

  container.appendChild(panel);
}

// ── Cart row ────────────────────────────────────────────────────────
function buildCartRow(item) {
  const row = el('div', 'cart-item');

  const thumb = el('div', 'cart-thumb');
  if (item.dbItem) {
    const img = document.createElement('img');
    img.src = imageUrl(item.dbItem.id, true);
    img.alt = item.cartName;
    img.loading = 'eager';
    img.onerror = function () {
      this.style.display = 'none';
      thumb.textContent = item.dbItem.icon;
      thumb.classList.add('cart-thumb--emoji');
    };
    thumb.appendChild(img);
  } else {
    thumb.textContent = item.icon || '\u{1F4E6}';
    thumb.classList.add('cart-thumb--emoji');
  }
  row.appendChild(thumb);

  const details = el('div', 'cart-details');
  const name = el('div', 'cart-item-name');
  name.textContent = item.cartName;
  details.appendChild(name);

  const meta = el('div', 'cart-item-meta');
  meta.textContent = item.cartCategory;
  details.appendChild(meta);
  row.appendChild(details);

  const qty = el('div', 'cart-qty');
  qty.innerHTML = `
    <button class="qty-btn" tabindex="-1">\u2212</button>
    <span class="qty-val">${item.qty}</span>
    <button class="qty-btn" tabindex="-1">+</button>
  `;
  row.appendChild(qty);

  const price = el('div', 'cart-price');
  const lineTotal = item.price * item.qty;
  price.innerHTML = `
    <span class="price-line">$${lineTotal.toFixed(2)}</span>
    ${item.qty > 1 ? `<span class="price-unit">$${item.price.toFixed(2)} each</span>` : ''}
  `;
  row.appendChild(price);

  return row;
}

// ── Match row ───────────────────────────────────────────────────────
function buildMatchRow(item, detailLevel = 1) {
  const row = el('div', 'match-row');
  const db = item.dbItem;

  // Thumbnail
  const thumb = el('div', 'match-thumb');
  if (db) {
    const img = document.createElement('img');
    img.src = imageUrl(db.id, true);
    img.alt = db.name;
    img.loading = 'eager';
    img.onerror = function () {
      this.style.display = 'none';
      thumb.textContent = db.icon;
      thumb.classList.add('match-thumb--emoji');
    };
    thumb.appendChild(img);
  }
  row.appendChild(thumb);

  // Info block
  const info = el('div', 'match-info');

  // Top line: name + badge
  const topLine = el('div', 'match-top');
  const nameSpan = el('span', 'match-name');
  nameSpan.textContent = db.name;
  topLine.appendChild(nameSpan);

  const badge = el('span', `match-badge match-badge--${item.confidence}`);
  badge.textContent = item.confidence === 'exact' ? 'Exact match' : 'Similar item';
  topLine.appendChild(badge);
  info.appendChild(topLine);

  // Second line: date
  const bottomLine = el('div', 'match-bottom');

  if (db.dateObtained) {
    const dateSpan = el('span', 'match-date');
    dateSpan.textContent = `Added ${formatDate(db.dateObtained)}`;
    bottomLine.appendChild(dateSpan);
  }

  info.appendChild(bottomLine);

  // ── Persuade mode: reasons checklist ──────────────────────────
  if (detailLevel >= 1) {
    const reasons = generateReasons(item, db);
    if (reasons.length > 0) {
      const reasonsWrap = el('div', 'match-reasons');
      reasons.forEach(text => {
        const pill = el('span', 'reason-pill');
        pill.innerHTML = `<span class="reason-check">\u2713</span> ${text}`;
        reasonsWrap.appendChild(pill);
      });
      info.appendChild(reasonsWrap);
    }
  }

  // ── "Find it" location line (toggled by sandbox) ──────────────
  if (config.showLocation && db.tags && db.tags.room) {
    const locationPhrase = LOCATION_PHRASES[db.id] || `in the ${formatLabel(db.tags.room).toLowerCase()}`;
    const locationLine = el('div', 'match-location');
    locationLine.innerHTML = `<span class="location-pin">\uD83D\uDCCD</span> ${locationPhrase} <span class="location-link">\u00B7 Get directions</span>`;
    info.appendChild(locationLine);
  }

  row.appendChild(info);

  // Price
  const price = el('div', 'match-price');
  price.textContent = `$${(item.price * item.qty).toFixed(2)}`;
  row.appendChild(price);

  return row;
}
