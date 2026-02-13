// ui.js — Main rendering: main view, drill view, detail modal

import * as store from '../../shared/js/store.js';
import { ROOM_COLORS, formatLabel } from '../../shared/js/colors.js';
import { imageUrl } from '../../shared/js/images.js';
import { calculateStorageBar, getColor, formatRelativeTime } from './storage.js';

// ─── Main export ───

export function renderApp(container, state, onStateChange) {
  const { viewMode, detailItem } = state;

  if (viewMode === 'drill') {
    renderDrillView(container, state, onStateChange);
  } else {
    renderMainView(container, state, onStateChange);
  }

  // Detail modal overlays on top of either view
  if (detailItem) {
    renderDetailModal(container, state, onStateChange);
  }
}

// ─── Main View ───

function renderMainView(container, state, onStateChange) {
  const { objects, groupBy, triageDecisions, totalCapacity, recommendations } = state;
  const bar = calculateStorageBar(objects, triageDecisions, groupBy, totalCapacity);

  // Active objects (not triaged away)
  const active = objects.filter(obj => {
    const d = triageDecisions[obj.id];
    return !d || d === 'keep';
  });

  // Build grouped list
  const field = groupBy === 'room' ? 'room' : 'category';
  const volumeMap = store.volumeByTag(active, field);
  const countMap = store.countByTag(active, field);
  const groups = Object.entries(volumeMap)
    .map(([key, vol]) => ({
      key,
      volume: vol,
      count: countMap[key] || 0,
      color: getColor(groupBy, key),
      label: formatLabel(key),
    }))
    .sort((a, b) => b.volume - a.volume);

  // Pick a representative emoji for each group
  const emojiMap = {};
  const grouped = store.groupByTag(active, field);
  for (const [key, items] of Object.entries(grouped)) {
    // Use the largest item's icon
    const biggest = items.reduce((a, b) => a.volume_liters > b.volume_liters ? a : b);
    emojiMap[key] = biggest.icon;
  }

  // Triage summary
  const triaged = Object.values(triageDecisions);
  const donateCount = triaged.filter(d => d === 'donate').length;
  const tossCount = triaged.filter(d => d === 'toss').length;

  container.innerHTML = `
    <div class="ios-app">
      <header class="ios-header">
        <h1>Home Storage</h1>
      </header>

      <section class="storage-card">
        <div class="storage-title-row">
          <span class="storage-device">Home</span>
          <span class="storage-used">${store.formatVolume(bar.usedVolume)} of ${store.formatVolume(bar.totalCapacity)} Used</span>
        </div>
        <div class="storage-bar">
          ${bar.segments.map(s => `<div class="segment" style="width:${s.percentage}%;background:${s.color}" data-group="${s.group}"></div>`).join('')}
        </div>
        <div class="storage-legend">
          ${bar.segments.slice(0, 6).map(s => `
            <span class="legend-item">
              <span class="legend-dot" style="background:${s.color}"></span>
              <span class="legend-label">${s.label}</span>
            </span>
          `).join('')}
        </div>
      </section>

      ${triaged.length > 0 ? `
        <section class="triage-summary-card">
          <div class="triage-summary">
            ${donateCount > 0 ? `<span class="triage-badge donate">🤝 ${donateCount} to donate</span>` : ''}
            ${tossCount > 0 ? `<span class="triage-badge toss">🗑 ${tossCount} to toss</span>` : ''}
          </div>
        </section>
      ` : ''}

      <section class="recs-section">
        <div class="recs-header">
          <h2>Recommendations</h2>
        </div>
        ${recommendations.map(rec => `
          <div class="rec-card" data-rec="${rec.id}">
            <div class="rec-icon">${rec.icon}</div>
            <div class="rec-body">
              <div class="rec-title">${rec.title}</div>
              <div class="rec-desc">${rec.description}</div>
            </div>
            <div class="rec-right">
              ${rec.savings ? `<div class="rec-savings">${rec.savings}</div>` : ''}
              <button class="rec-action" data-rec="${rec.id}">${rec.action}</button>
            </div>
          </div>
        `).join('')}
      </section>

      <section class="group-list-section">
        <div class="group-toggle">
          <button class="toggle-btn ${groupBy === 'room' ? 'active' : ''}" data-group="room">By Room</button>
          <button class="toggle-btn ${groupBy === 'category' ? 'active' : ''}" data-group="category">By Category</button>
        </div>
        <div class="group-list">
          ${groups.map(g => `
            <div class="group-row" data-key="${g.key}">
              <div class="group-icon" style="background:${g.color}">${emojiMap[g.key] || '📁'}</div>
              <div class="group-info">
                <div class="group-name">${g.label}</div>
                <div class="group-meta">${g.count} items</div>
              </div>
              <div class="group-size">${store.formatVolume(g.volume)}</div>
              <div class="chevron">\u203A</div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;

  // Event listeners
  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onStateChange({ groupBy: btn.dataset.group });
    });
  });

  container.querySelectorAll('.group-row').forEach(row => {
    row.addEventListener('click', () => {
      const key = row.dataset.key;
      const g = groups.find(g => g.key === key);
      onStateChange({
        viewMode: 'drill',
        drillTarget: { type: groupBy, value: key, label: g.label, color: g.color },
      });
    });
  });

  container.querySelectorAll('.rec-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const recId = btn.dataset.rec;
      const rec = recommendations.find(r => r.id === recId);
      if (!rec) return;

      if (rec.wrapped) {
        // Show wrapped as a drill-down with all items
        onStateChange({
          viewMode: 'drill',
          drillTarget: { type: 'wrapped', label: 'Your Home: Wrapped', wrapped: rec.wrapped },
        });
      } else if (rec.ids) {
        onStateChange({
          viewMode: 'drill',
          drillTarget: { type: 'filter', ids: rec.ids, label: rec.title, color: '#007AFF' },
        });
      }
    });
  });

  container.querySelectorAll('.rec-card').forEach(card => {
    card.addEventListener('click', () => {
      const btn = card.querySelector('.rec-action');
      if (btn) btn.click();
    });
  });
}

// ─── Drill View ───

function renderDrillView(container, state, onStateChange) {
  const { objects, drillTarget, triageDecisions, totalCapacity, sortField, sortDirection } = state;

  // Get items for this drill target
  let items;
  if (drillTarget.type === 'filter') {
    const idSet = new Set(drillTarget.ids);
    items = objects.filter(obj => idSet.has(obj.id));
  } else if (drillTarget.type === 'wrapped') {
    // Show wrapped stats view
    renderWrappedView(container, state, onStateChange);
    return;
  } else {
    const field = drillTarget.type === 'room' ? 'room' : 'category';
    items = objects.filter(obj => obj.tags[field] === drillTarget.value);
  }

  // Annotate with triage status
  items = items.map(obj => ({
    ...obj,
    _triage: triageDecisions[obj.id] || null,
  }));

  const sorted = store.sortBy(items, sortField, sortDirection);
  const totalVol = store.totalVolume(items);
  const activeItems = items.filter(o => !o._triage || o._triage === 'keep');
  const activeVol = store.totalVolume(activeItems);
  const pct = ((activeVol / totalCapacity) * 100).toFixed(1);

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn">\u2039 Storage</button>
        <h1>${drillTarget.label}</h1>
      </header>

      <section class="drill-stats-card">
        <div class="drill-stats">
          <div class="stat">
            <div class="stat-value">${items.length}</div>
            <div class="stat-label">Items</div>
          </div>
          <div class="stat">
            <div class="stat-value">${store.formatVolume(totalVol)}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat">
            <div class="stat-value">${pct}%</div>
            <div class="stat-label">of Home</div>
          </div>
        </div>
      </section>

      <section class="items-section">
        <div class="items-header">
          <span>${items.length} Items</span>
          <button class="sort-btn" data-field="volume_liters">By Size ${sortDirection === 'desc' ? '\u25BC' : '\u25B2'}</button>
        </div>
        <div class="items-list">
          ${sorted.map(obj => `
            <div class="item-row ${obj._triage && obj._triage !== 'keep' ? 'triaged' : ''}" data-id="${obj.id}">
              <div class="item-thumb-wrap">
                <img class="item-thumb" src="${imageUrl(obj.id, true)}" alt="${obj.name}" loading="lazy"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                <div class="item-emoji-fallback">${obj.icon}</div>
              </div>
              <div class="item-info">
                <div class="item-name">${obj.name}</div>
                <div class="item-meta">Last used: ${formatRelativeTime(obj.lastUsed)}</div>
              </div>
              ${obj._triage && obj._triage !== 'keep' ? `<div class="item-triage-badge ${obj._triage}">${obj._triage === 'donate' ? '🤝' : '🗑'}</div>` : ''}
              <div class="item-size">${store.formatVolume(obj.volume_liters)}</div>
              <div class="chevron">\u203A</div>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;

  // Event listeners
  container.querySelector('.back-btn').addEventListener('click', () => {
    onStateChange({ viewMode: 'main', drillTarget: null });
  });

  container.querySelector('.sort-btn')?.addEventListener('click', () => {
    onStateChange({
      sortDirection: sortDirection === 'desc' ? 'asc' : 'desc',
    });
  });

  container.querySelectorAll('.item-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      const item = objects.find(o => o.id === id);
      if (item) onStateChange({ detailItem: item });
    });
  });
}

// ─── Wrapped Stats View ───

function renderWrappedView(container, state, onStateChange) {
  const { drillTarget } = state;
  const w = drillTarget.wrapped;

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn">\u2039 Storage</button>
        <h1>Your Home: Wrapped</h1>
      </header>

      <section class="wrapped-section">
        <div class="wrapped-card hero">
          <div class="wrapped-big-number">${w.totalItems}</div>
          <div class="wrapped-label">things you own</div>
        </div>

        <div class="wrapped-card">
          <div class="wrapped-stat-icon">📏</div>
          <div class="wrapped-stat-text">
            <div class="wrapped-stat-value">${store.formatVolume(w.totalVolume)}</div>
            <div class="wrapped-stat-label">total volume of your belongings</div>
          </div>
        </div>

        ${w.mostClutteredRoom ? `
          <div class="wrapped-card">
            <div class="wrapped-stat-icon">🏠</div>
            <div class="wrapped-stat-text">
              <div class="wrapped-stat-value">${formatLabel(w.mostClutteredRoom.name)}</div>
              <div class="wrapped-stat-label">is your most cluttered room (${store.formatVolume(w.mostClutteredRoom.volume)})</div>
            </div>
          </div>
        ` : ''}

        ${w.oldestItem ? `
          <div class="wrapped-card">
            <div class="wrapped-stat-icon">📅</div>
            <div class="wrapped-stat-text">
              <div class="wrapped-stat-value">${w.oldestItem.name}</div>
              <div class="wrapped-stat-label">is your oldest item (since ${new Date(w.oldestItem.dateObtained).getFullYear()})</div>
            </div>
          </div>
        ` : ''}

        <div class="wrapped-card">
          <div class="wrapped-stat-icon">💤</div>
          <div class="wrapped-stat-text">
            <div class="wrapped-stat-value">${w.pctRarelyUsed}%</div>
            <div class="wrapped-stat-label">of your things are rarely or never used (${w.neverUsedCount} items)</div>
          </div>
        </div>
      </section>
    </div>
  `;

  container.querySelector('.back-btn').addEventListener('click', () => {
    onStateChange({ viewMode: 'main', drillTarget: null });
  });
}

// ─── Detail Modal ───

function renderDetailModal(container, state, onStateChange) {
  const { detailItem, triageDecisions, drillTarget } = state;
  const item = detailItem;
  const currentTriage = triageDecisions[item.id] || null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <button class="modal-close">\u00D7</button>

      <div class="modal-photo">
        <img src="${imageUrl(item.id)}" alt="${item.name}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="modal-emoji-fallback">${item.icon}</div>
      </div>

      <div class="modal-content">
        <h2 class="modal-name">${item.name}</h2>
        <p class="modal-desc">${item.description || ''}</p>

        <div class="detail-grid">
          <div class="detail-cell">
            <div class="detail-cell-label">Volume</div>
            <div class="detail-cell-value">${store.formatVolume(item.volume_liters)}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-cell-label">Last Used</div>
            <div class="detail-cell-value">${formatRelativeTime(item.lastUsed)}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-cell-label">Room</div>
            <div class="detail-cell-value">${formatLabel(item.tags.room)}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-cell-label">Category</div>
            <div class="detail-cell-value">${formatLabel(item.tags.category)}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-cell-label">Attachment</div>
            <div class="detail-cell-value">${formatLabel(item.attachment)}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-cell-label">Usage</div>
            <div class="detail-cell-value">${formatLabel(item.usageFrequency)}</div>
          </div>
        </div>

        ${item.detail ? `
          <div class="detail-meta">
            ${Object.entries(item.detail).map(([k, v]) => {
              if (Array.isArray(v)) v = v.join(', ');
              return `<div class="meta-row"><span class="meta-key">${formatLabel(k)}</span><span class="meta-val">${v}</span></div>`;
            }).join('')}
          </div>
        ` : ''}

        <div class="triage-actions">
          <button class="triage-btn keep ${currentTriage === 'keep' ? 'active' : ''}" data-action="keep">
            <span class="triage-icon">\u2713</span>
            <span>Keep</span>
          </button>
          <button class="triage-btn donate ${currentTriage === 'donate' ? 'active' : ''}" data-action="donate">
            <span class="triage-icon">🤝</span>
            <span>Donate</span>
          </button>
          <button class="triage-btn toss ${currentTriage === 'toss' ? 'active' : ''}" data-action="toss">
            <span class="triage-icon">🗑</span>
            <span>Toss</span>
          </button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(overlay);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      onStateChange({ detailItem: null });
    }
  });

  overlay.querySelector('.modal-close').addEventListener('click', () => {
    onStateChange({ detailItem: null });
  });

  overlay.querySelectorAll('.triage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const newDecisions = { ...triageDecisions, [item.id]: action };
      onStateChange({ triageDecisions: newDecisions, detailItem: null });
    });
  });
}
