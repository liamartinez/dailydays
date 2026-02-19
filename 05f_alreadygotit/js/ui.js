// ui.js — DOM construction for checkout page + extension panel overlay

import { imageUrl } from '../../shared/js/images.js';
import { ROOM_COLORS, formatLabel } from '../../shared/js/colors.js';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function renderApp(container, cartItems, stats) {
  container.innerHTML = '';

  // ── Checkout page ───────────────────────────────────────────────
  const checkout = el('div', 'checkout-page');

  const header = el('div', 'checkout-header');
  header.innerHTML = `
    <div class="header-inner">
      <span class="store-logo">homegoods<span class="logo-dot">.</span></span>
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span class="search-placeholder">Search products...</span>
      </div>
      <div class="header-actions">
        <span class="header-link">Deals</span>
        <span class="header-link">Categories</span>
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
  cartTitle.textContent = `Your Cart (${cartItems.length} items)`;
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
    <button class="checkout-btn">Proceed to Checkout</button>
    <p class="checkout-note">Free returns within 30 days</p>
  `;
  cartArea.appendChild(summary);
  checkout.appendChild(cartArea);
  container.appendChild(checkout);

  // ── Overlay backdrop ────────────────────────────────────────────
  container.appendChild(el('div', 'overlay-backdrop'));

  // ── Extension panel ─────────────────────────────────────────────
  const panel = el('div', 'extension-panel');

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
    matchesWrap.appendChild(buildMatchRow(item));
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
    thumb.textContent = item.icon || '📦';
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
function buildMatchRow(item) {
  const row = el('div', 'match-row');
  const db = item.dbItem;

  // Thumbnail (from home inventory photos)
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

  const info = el('div', 'match-info');

  const topLine = el('div', 'match-top');
  const nameSpan = el('span', 'match-name');
  nameSpan.textContent = db.name;
  topLine.appendChild(nameSpan);

  const badge = el('span', `match-badge match-badge--${item.confidence}`);
  badge.textContent = item.confidence === 'exact' ? 'Exact match' : 'Similar item';
  topLine.appendChild(badge);
  info.appendChild(topLine);

  const bottomLine = el('div', 'match-bottom');

  const roomChip = el('span', 'room-chip');
  const room = db.tags.room;
  roomChip.style.setProperty('--room-color', ROOM_COLORS[room] || '#999');
  roomChip.textContent = formatLabel(room);
  bottomLine.appendChild(roomChip);

  if (db.dateObtained) {
    const dateSpan = el('span', 'match-date');
    dateSpan.textContent = `Added ${formatDate(db.dateObtained)}`;
    bottomLine.appendChild(dateSpan);
  }

  info.appendChild(bottomLine);
  row.appendChild(info);

  const price = el('div', 'match-price');
  price.textContent = `$${(item.price * item.qty).toFixed(2)}`;
  row.appendChild(price);

  return row;
}

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
