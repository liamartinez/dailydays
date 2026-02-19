// app.js — Data wiring and auto-play timeline for "Already Got It" demo
// 5 themed cart cycles that rotate automatically

import { OBJECTS } from '../../shared/js/data.js';
import { renderApp } from './ui.js';

// ── Helper: look up DB item by obj ID ───────────────────────────────
const byId = id => OBJECTS.find(o => o.id === id);

// ── 5 Themed cart cycles ────────────────────────────────────────────
const CYCLES = [
  {
    label: 'Kitchen & Pantry',
    items: [
      { dbId: 'obj-305', cartName: 'Counter Culture Coffee, Hologram Blend 12oz', cartCategory: 'Coffee & Tea', price: 16.99, qty: 1, matched: true, confidence: 'exact' },
      { dbId: 'obj-282', cartName: 'Dawn Dish Soap, Original Blue 24oz', cartCategory: 'Cleaning', price: 3.49, qty: 2, matched: true, confidence: 'exact' },
      { dbId: null, cartName: 'Barilla Penne Rigate Pasta 16oz', cartCategory: 'Pantry', price: 1.79, qty: 3, matched: false, icon: '🍝' },
      { dbId: 'obj-283', cartName: 'Scotch-Brite Non-Scratch Sponges 6-Pack', cartCategory: 'Cleaning', price: 4.29, qty: 1, matched: true, confidence: 'exact' },
      { dbId: 'obj-302', cartName: 'Harney & Sons Paris Tea, 20ct Tin', cartCategory: 'Coffee & Tea', price: 9.49, qty: 1, matched: true, confidence: 'similar' },
      { dbId: null, cartName: 'Method All-Purpose Cleaner, Pink Grapefruit', cartCategory: 'Cleaning', price: 4.99, qty: 1, matched: false, icon: '🧴' },
    ],
  },
  {
    label: 'Clothing & Accessories',
    items: [
      { dbId: 'obj-105', cartName: 'Bombas Ankle Socks 3-Pack, Black', cartCategory: 'Socks', price: 38.00, qty: 1, matched: true, confidence: 'exact' },
      { dbId: null, cartName: 'Everlane ReNew Long Puffer, Bone', cartCategory: 'Outerwear', price: 178.00, qty: 1, matched: false, icon: '🧥' },
      { dbId: 'obj-097', cartName: 'J.Crew Wool Crewneck Sweater, Heather Gray', cartCategory: 'Tops', price: 89.50, qty: 1, matched: true, confidence: 'exact' },
      { dbId: 'obj-111', cartName: 'Common Projects Achilles Low, White', cartCategory: 'Footwear', price: 411.00, qty: 1, matched: true, confidence: 'exact' },
      { dbId: 'obj-113', cartName: 'Acne Studios Canada Wool Scarf, Black', cartCategory: 'Accessories', price: 180.00, qty: 1, matched: true, confidence: 'similar' },
      { dbId: null, cartName: 'Allbirds Tree Runners, Natural White', cartCategory: 'Footwear', price: 98.00, qty: 1, matched: false, icon: '👟' },
    ],
  },
  {
    label: 'Gifts & Home Decor',
    items: [
      { dbId: 'obj-068', cartName: 'Diptyque Baies Candle, 6.5oz', cartCategory: 'Candles', price: 72.00, qty: 1, matched: true, confidence: 'exact' },
      { dbId: 'obj-070', cartName: 'CB2 Gallery Frame, Brass 8\u00d710', cartCategory: 'Frames', price: 24.95, qty: 2, matched: true, confidence: 'similar' },
      { dbId: null, cartName: 'Anthropologie Monogram Mug, Gold Rim', cartCategory: 'Drinkware', price: 14.00, qty: 1, matched: false, icon: '☕' },
      { dbId: 'obj-087', cartName: 'Stackers Classic Jewelry Box, Walnut', cartCategory: 'Storage', price: 64.00, qty: 1, matched: true, confidence: 'similar' },
      { dbId: 'obj-217', cartName: 'Simon Pearce Barre Vase, Medium', cartCategory: 'Vases', price: 135.00, qty: 1, matched: true, confidence: 'exact' },
      { dbId: null, cartName: 'Rifle Paper Co. Notebook Set, Floral', cartCategory: 'Stationery', price: 18.00, qty: 1, matched: false, icon: '📓' },
    ],
  },
  {
    label: 'Bath & Body',
    items: [
      { dbId: 'obj-136', cartName: 'Olaplex No.4 Bond Maintenance Shampoo 8.5oz', cartCategory: 'Hair Care', price: 28.00, qty: 1, matched: true, confidence: 'exact' },
      { dbId: null, cartName: 'Drunk Elephant Protini Polypeptide Cream', cartCategory: 'Skincare', price: 68.00, qty: 1, matched: false, icon: '✨' },
      { dbId: 'obj-135', cartName: 'CeraVe Moisturizing Cream 16oz', cartCategory: 'Skincare', price: 16.99, qty: 1, matched: true, confidence: 'exact' },
      { dbId: 'obj-335', cartName: 'Aesop Rind Concentrate Body Balm 100mL', cartCategory: 'Body Care', price: 39.00, qty: 1, matched: true, confidence: 'similar' },
      { dbId: 'obj-338', cartName: 'Native Deodorant, Coconut & Vanilla', cartCategory: 'Personal Care', price: 13.49, qty: 1, matched: true, confidence: 'exact' },
      { dbId: null, cartName: 'Moroccanoil Treatment 3.4oz', cartCategory: 'Hair Care', price: 48.00, qty: 1, matched: false, icon: '💆' },
    ],
  },
  {
    label: 'Electronics & Office',
    items: [
      { dbId: 'obj-076', cartName: 'Anker USB-C to USB-C Cable 3-Pack 6ft', cartCategory: 'Cables', price: 15.99, qty: 1, matched: true, confidence: 'exact' },
      { dbId: 'obj-167', cartName: 'Pilot G-2 Gel Pens 4-Pack, Black 0.7mm', cartCategory: 'Writing', price: 6.49, qty: 1, matched: true, confidence: 'exact' },
      { dbId: null, cartName: 'Logitech MX Master 3S Wireless Mouse', cartCategory: 'Peripherals', price: 99.99, qty: 1, matched: false, icon: '🖱️' },
      { dbId: 'obj-166', cartName: 'Moleskine Classic Notebook, Large Ruled', cartCategory: 'Stationery', price: 22.95, qty: 1, matched: true, confidence: 'exact' },
      { dbId: 'obj-162', cartName: 'BenQ ScreenBar Monitor Light', cartCategory: 'Lighting', price: 109.00, qty: 1, matched: true, confidence: 'similar' },
      { dbId: null, cartName: 'Apple AirPods Pro 2 Case', cartCategory: 'Audio', price: 29.00, qty: 1, matched: false, icon: '🎧' },
    ],
  },
];

// ── Resolve DB items ────────────────────────────────────────────────
for (const cycle of CYCLES) {
  for (const item of cycle.items) {
    item.dbItem = item.dbId ? byId(item.dbId) : null;
  }
}

// ── Cycle state ─────────────────────────────────────────────────────
let currentCycle = 0;
const container = document.getElementById('app');

// ── Auto-play timeline ──────────────────────────────────────────────
// Each cycle: empty cart → items appear → panel slides in → scanning →
// matches revealed (with cart highlights) → savings → pause → reset

function startTimeline() {
  const cycle = CYCLES[currentCycle];
  const matchedItems = cycle.items.filter(c => c.matched);
  const savings = matchedItems.reduce((sum, c) => sum + c.price * c.qty, 0);
  const stats = {
    savings,
    matchCount: matchedItems.length,
    totalCount: cycle.items.length,
    label: cycle.label,
  };

  // Render page with empty cart
  renderApp(container, cycle.items, stats);

  const cartRows = document.querySelectorAll('.cart-item');
  const cartTitle = document.querySelector('.cart-title');
  const orderSummary = document.querySelector('.order-summary');
  const backdrop = document.querySelector('.overlay-backdrop');
  const panel = document.querySelector('.extension-panel');
  const scanBar = document.querySelector('.scan-bar');
  const scanText = document.querySelector('.scan-text');
  const matchRows = document.querySelectorAll('.match-row');
  const panelSummary = document.querySelector('.panel-summary');

  // Order summary starts hidden
  orderSummary.classList.add('summary--hidden');

  // ── Phase 1 (0–2.2s): Cart items appear one by one ────────────
  const ITEM_STAGGER = 280; // ms between each item
  cartRows.forEach((row, i) => {
    setTimeout(() => {
      row.classList.add('revealed');
      // Update cart title count
      cartTitle.textContent = `Your Cart (${i + 1} item${i + 1 > 1 ? 's' : ''})`;
    }, 300 + i * ITEM_STAGGER);
  });

  // Show order summary after all items are in
  const allItemsIn = 300 + cartRows.length * ITEM_STAGGER + 200;
  setTimeout(() => {
    cartTitle.textContent = `Your Cart (${cycle.items.length} items)`;
    orderSummary.classList.remove('summary--hidden');
  }, allItemsIn);

  // ── Phase 2 (3s): Panel slides in with "scanning" state ───────
  const panelIn = allItemsIn + 600;
  setTimeout(() => {
    backdrop.classList.add('active');
    panel.classList.add('visible');
    // Panel starts in scanning state (set via CSS class on scan-bar)
    scanBar.classList.add('scanning');
    scanText.textContent = 'Scanning your cart...';
  }, panelIn);

  // ── Phase 3 (4s): Scan complete, matches stagger in ───────────
  const scanDone = panelIn + 1000;
  setTimeout(() => {
    scanBar.classList.remove('scanning');
    scanText.textContent = `${stats.matchCount} of ${stats.totalCount} cart items matched to your home inventory`;
    matchRows.forEach(row => row.classList.add('revealed'));
  }, scanDone);

  // Highlight matched cart rows as their match-row appears
  // Match rows have staggered CSS delays: 0, 0.35, 0.7, 1.05s
  matchedItems.forEach((item, i) => {
    const cartIndex = cycle.items.indexOf(item);
    const delay = i * 350; // matches CSS stagger
    setTimeout(() => {
      if (cartRows[cartIndex]) {
        cartRows[cartIndex].classList.add('cart-item--flagged');
      }
    }, scanDone + delay + 100);
  });

  // ── Phase 4 (7.5s): Summary fades in ──────────────────────────
  const summaryIn = scanDone + 2800;
  setTimeout(() => {
    panelSummary.classList.add('revealed');
  }, summaryIn);

  // ── Phase 5 (11s): Fade out everything, advance cycle ─────────
  const fadeOut = summaryIn + 2500;
  setTimeout(() => {
    // Fade the whole page out
    container.classList.add('cycle-fade-out');
  }, fadeOut);

  // After fade completes, reset and start next cycle
  setTimeout(() => {
    container.classList.remove('cycle-fade-out');
    currentCycle = (currentCycle + 1) % CYCLES.length;
    startTimeline();
  }, fadeOut + 600);
}

startTimeline();
