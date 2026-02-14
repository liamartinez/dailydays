// ui.js — Main rendering: main view, drill view, donation view, redundancies view, detail modal

import * as store from '../../shared/js/store.js';
import { ROOM_COLORS, formatLabel } from '../../shared/js/colors.js';
import { imageUrl } from '../../shared/js/images.js';
import { calculateStorageBar, calculateDrillStorageBar, calculateIntersectionStorageBar, getColor, formatRelativeTime } from './storage.js';
import { getDonationReason, generateRecommendations } from './recommendations.js';

// ─── Sort config ───

const SORT_FIELDS = [
  { field: 'volume_liters', label: 'Size', defaultDir: 'desc' },
  { field: 'lastUsed', label: 'Last Used', defaultDir: 'desc' },
  { field: 'dateObtained', label: 'Date Obtained', defaultDir: 'desc' },
  { field: 'usageFrequency', label: 'Usage', defaultDir: 'desc' },
  { field: 'attachment', label: 'Attachment', defaultDir: 'desc' },
  { field: 'name', label: 'Name', defaultDir: 'asc' },
];

// ─── SVG Icons for layout toggle ───

const LIST_ICON = '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="0" y="1" width="16" height="3" rx="1" fill="currentColor"/><rect x="0" y="6.5" width="16" height="3" rx="1" fill="currentColor"/><rect x="0" y="12" width="16" height="3" rx="1" fill="currentColor"/></svg>';
const GRID_ICON = '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="0" y="0" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="9" y="0" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="0" y="9" width="7" height="7" rx="1.5" fill="currentColor"/><rect x="9" y="9" width="7" height="7" rx="1.5" fill="currentColor"/></svg>';

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
  const { objects, groupBy, triageDecisions, totalCapacity, recommendations, dismissedRecs } = state;
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
    const biggest = items.reduce((a, b) => a.volume_liters > b.volume_liters ? a : b);
    emojiMap[key] = biggest.icon;
  }

  // Triage summary
  const triaged = Object.values(triageDecisions);
  const donateCount = triaged.filter(d => d === 'donate').length;
  const tossCount = triaged.filter(d => d === 'toss').length;

  // Visible (non-dismissed) recommendations
  const visibleRecs = recommendations.filter(r => !(dismissedRecs || []).includes(r.id));

  container.innerHTML = `
    <div class="ios-app">
      <header class="ios-header">
        <h1>All the Stuff at Home</h1>
      </header>

      ${visibleRecs.length > 0 ? `
        <section class="recs-section${state._recsAnimating ? ' recs-animating' : ''}">
          <div class="recs-header">
            <h2>Recommendations</h2>
          </div>
          ${visibleRecs.map(rec => `
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
              <button class="rec-dismiss" data-rec="${rec.id}">\u00D7</button>
            </div>
          `).join('')}
        </section>
      ` : ''}

      <section class="storage-card">
        <div class="storage-title-row">
          <span class="storage-device">${groupBy === 'room' ? 'Rooms' : 'Categories'}</span>
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
            ${donateCount > 0 ? `<span class="triage-badge donate">\u{1F91D} ${donateCount} to donate</span>` : ''}
            ${tossCount > 0 ? `<span class="triage-badge toss">\u{1F5D1} ${tossCount} to toss</span>` : ''}
          </div>
        </section>
      ` : ''}

      <section class="group-list-section">
        <div class="group-toggle">
          <button class="toggle-btn ${groupBy === 'room' ? 'active' : ''}" data-group="room">By Room</button>
          <button class="toggle-btn ${groupBy === 'category' ? 'active' : ''}" data-group="category">By Category</button>
        </div>
        <div class="group-list">
          ${groups.map(g => `
            <div class="group-row" data-key="${g.key}">
              <div class="group-icon" style="background:${g.color}">${emojiMap[g.key] || '\u{1F4C1}'}</div>
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

      <button class="replay-btn">
        <svg class="replay-icon" width="14" height="14" viewBox="0 0 16 16">
          <path d="M2.5 1.5v5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3.1 10.5a6 6 0 1 0 .9-5L2.5 6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Replay Intro
      </button>
    </div>
  `;

  // Event listeners
  container.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onStateChange({ groupBy: btn.dataset.group });
    });
  });

  container.querySelectorAll('.storage-bar .segment').forEach(seg => {
    seg.addEventListener('click', () => {
      const key = seg.dataset.group;
      const g = groups.find(g => g.key === key);
      if (!g) return;
      onStateChange({
        viewMode: 'drill',
        drillTarget: { type: groupBy, value: key, label: g.label, color: g.color },
      });
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

  // Rec dismiss buttons
  container.querySelectorAll('.rec-dismiss').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onStateChange({ dismissedRecs: [...(state.dismissedRecs || []), btn.dataset.rec] });
    });
  });

  container.querySelectorAll('.rec-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const recId = btn.dataset.rec;
      const rec = recommendations.find(r => r.id === recId);
      if (!rec) return;

      if (rec.wrapped) {
        onStateChange({
          viewMode: 'drill',
          drillTarget: { type: 'wrapped', label: 'Your Home: Wrapped', wrapped: rec.wrapped },
        });
      } else if (rec.donationGroups) {
        onStateChange({
          viewMode: 'drill',
          drillTarget: { type: 'donation', ids: rec.ids, label: rec.title, donationGroups: rec.donationGroups },
        });
      } else if (rec.redundancyGroups) {
        onStateChange({
          viewMode: 'drill',
          drillTarget: { type: 'redundancies', ids: rec.ids, label: rec.title, redundancyGroups: rec.redundancyGroups },
        });
      } else if (rec.unusedGroups) {
        onStateChange({
          viewMode: 'drill',
          drillTarget: { type: 'unused', ids: rec.ids, label: rec.title, unusedGroups: rec.unusedGroups },
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

  // Replay intro animation button
  const replayBtn = container.querySelector('.replay-btn');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      // Scroll to top so user sees the animation
      container.scrollTo({ top: 0, behavior: 'smooth' });
      // Step 1: Hide recommendations
      onStateChange({ recommendations: [], dismissedRecs: [], _recsAnimating: false });
      // Step 2: After a short delay, bring them back with animation
      setTimeout(() => {
        const recs = generateRecommendations(state.objects, state.triageDecisions);
        onStateChange({ recommendations: recs, _recsAnimating: true });
        // Step 3: Clear animation flag after animations finish
        setTimeout(() => {
          onStateChange({ _recsAnimating: false });
        }, 800);
      }, 1200);
    });
  }

}

// ─── Shared Items Section Helper ───

function renderItemsSection(items, state, donationReasonFn) {
  const { sortField, sortDirection, itemsLayout } = state;
  const sorted = store.sortBy(items, sortField, sortDirection);
  const currentSort = SORT_FIELDS.find(f => f.field === sortField) || SORT_FIELDS[0];
  const dirArrow = sortDirection === 'desc' ? '\u25BC' : '\u25B2';

  return `
    <section class="items-section">
      <div class="items-header">
        <span>${items.length} Items</span>
        <div class="items-header-controls">
          <div class="layout-toggle">
            <button class="layout-btn ${itemsLayout === 'list' ? 'active' : ''}" data-layout="list">${LIST_ICON}</button>
            <button class="layout-btn ${itemsLayout === 'grid' ? 'active' : ''}" data-layout="grid">${GRID_ICON}</button>
          </div>
          <div class="sort-picker-wrap">
            <button class="sort-picker-btn">${currentSort.label} ${dirArrow}</button>
            <div class="sort-picker-dropdown">
              ${SORT_FIELDS.map(sf => `
                <button class="sort-option ${sf.field === sortField ? 'active' : ''}" data-field="${sf.field}" data-default-dir="${sf.defaultDir}">
                  <span>${sf.label}</span>
                  <span class="sort-dir">${sf.field === sortField ? dirArrow : ''}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      ${itemsLayout === 'grid' ? `
        <div class="items-grid">
          ${sorted.map(obj => renderItemCard(obj)).join('')}
        </div>
      ` : `
        <div class="items-list">
          ${sorted.map(obj => {
            if (donationReasonFn) {
              return renderItemRow(obj, donationReasonFn(obj));
            }
            return renderItemRow(obj);
          }).join('')}
        </div>
      `}
    </section>
  `;
}

function attachItemsSectionListeners(container, state, onStateChange) {
  // Layout toggle
  container.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onStateChange({ itemsLayout: btn.dataset.layout });
    });
  });

  // Sort picker
  const pickerBtn = container.querySelector('.sort-picker-btn');
  const dropdown = container.querySelector('.sort-picker-dropdown');
  if (pickerBtn && dropdown) {
    pickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
      if (dropdown.classList.contains('open')) {
        setTimeout(() => {
          document.addEventListener('click', () => {
            dropdown.classList.remove('open');
          }, { once: true });
        }, 0);
      }
    });

    dropdown.querySelectorAll('.sort-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const field = opt.dataset.field;
        const defaultDir = opt.dataset.defaultDir;
        if (field === state.sortField) {
          onStateChange({ sortDirection: state.sortDirection === 'desc' ? 'asc' : 'desc' });
        } else {
          onStateChange({ sortField: field, sortDirection: defaultDir });
        }
        dropdown.classList.remove('open');
      });
    });
  }

  // Item clicks (list rows AND grid cards)
  container.querySelectorAll('.item-row, .grid-card').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const item = state.objects.find(o => o.id === id);
      if (item) onStateChange({ detailItem: item });
    });
  });
}

// ─── Drill View ───

function renderDrillView(container, state, onStateChange) {
  const { objects, drillTarget, triageDecisions, totalCapacity } = state;

  // Route to specialized views
  if (drillTarget.type === 'wrapped') {
    renderWrappedView(container, state, onStateChange);
    return;
  }
  if (drillTarget.type === 'donation') {
    renderDonationCardsView(container, state, onStateChange);
    return;
  }
  if (drillTarget.type === 'donation-list') {
    renderDonationListView(container, state, onStateChange);
    return;
  }
  if (drillTarget.type === 'redundancies') {
    renderRedundancyCardsView(container, state, onStateChange);
    return;
  }
  if (drillTarget.type === 'redundancy-list') {
    renderRedundancyListView(container, state, onStateChange);
    return;
  }
  if (drillTarget.type === 'unused') {
    renderUnusedCardsView(container, state, onStateChange);
    return;
  }
  if (drillTarget.type === 'unused-list') {
    renderUnusedListView(container, state, onStateChange);
    return;
  }
  if (drillTarget.type === 'intersection') {
    renderIntersectionView(container, state, onStateChange);
    return;
  }
  if (drillTarget.type === 'subcategory-filter') {
    renderSubcategoryFilterView(container, state, onStateChange);
    return;
  }

  // Get items for this drill target
  let items;
  if (drillTarget.type === 'filter') {
    const idSet = new Set(drillTarget.ids);
    items = objects.filter(obj => idSet.has(obj.id));
  } else {
    const field = drillTarget.type === 'room' ? 'room' : 'category';
    items = objects.filter(obj => obj.tags[field] === drillTarget.value);
  }

  // Annotate with triage status
  items = items.map(obj => ({
    ...obj,
    _triage: triageDecisions[obj.id] || null,
  }));

  const totalVol = store.totalVolume(items);
  const activeItems = items.filter(o => !o._triage || o._triage === 'keep');
  const activeVol = store.totalVolume(activeItems);
  const pct = ((activeVol / totalCapacity) * 100).toFixed(1);

  // Drill storage bar (only for room/category drills)
  let drillBarHTML = '';
  let drillBar = null;
  if (drillTarget.type === 'room' || drillTarget.type === 'category') {
    drillBar = calculateDrillStorageBar(objects, triageDecisions, drillTarget, totalCapacity);
    drillBarHTML = `
      <section class="storage-card">
        <div class="storage-title-row">
          <span class="storage-device">${drillBar.groupLabel}</span>
          <span class="storage-used">${store.formatVolume(drillBar.groupVolume)} of ${store.formatVolume(drillBar.totalCapacity)}</span>
        </div>
        <div class="storage-bar">
          ${drillBar.segments.map(s => `<div class="segment" style="width:${s.percentage}%;background:${s.color}" data-group="${s.group}"></div>`).join('')}
          <div class="segment segment-remainder" style="width:${drillBar.remainingPercentage}%;background:rgba(0,0,0,0.06)"></div>
        </div>
        <div class="storage-legend">
          ${drillBar.segments.slice(0, 6).map(s => `
            <span class="legend-item">
              <span class="legend-dot" style="background:${s.color}"></span>
              <span class="legend-label">${s.label}</span>
            </span>
          `).join('')}
        </div>
      </section>
    `;
  }

  // Determine back label
  const backLabel = drillTarget.parentDrillTarget ? drillTarget.parentDrillTarget.label : 'Storage';

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn"><svg class="back-chevron" width="10" height="18" viewBox="0 0 10 18"><path d="M9 1L1 9l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${backLabel}</button>
        <h1>${drillTarget.label}</h1>
      </header>

      ${drillBarHTML}

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

      ${renderItemsSection(items, state)}
    </div>
  `;

  // Event listeners
  container.querySelector('.back-btn').addEventListener('click', () => {
    if (drillTarget.parentDrillTarget) {
      onStateChange({ viewMode: 'drill', drillTarget: drillTarget.parentDrillTarget });
    } else {
      onStateChange({ viewMode: 'main', drillTarget: null });
    }
  });

  // Clickable drill bar segments → intersection view
  if (drillBar && (drillTarget.type === 'room' || drillTarget.type === 'category')) {
    container.querySelectorAll('.storage-card .segment[data-group]').forEach(seg => {
      seg.addEventListener('click', () => {
        const key = seg.dataset.group;
        const segData = drillBar.segments.find(s => s.group === key);
        if (!segData) return;
        let room, category;
        if (drillTarget.type === 'room') {
          room = drillTarget.value;
          category = key;
        } else {
          room = key;
          category = drillTarget.value;
        }
        onStateChange({
          viewMode: 'drill',
          drillTarget: {
            type: 'intersection',
            room,
            category,
            label: `${formatLabel(room)} \u2014 ${formatLabel(category)}`,
            color: segData.color,
            parentDrillTarget: drillTarget,
          },
        });
      });
    });
  }

  attachItemsSectionListeners(container, state, onStateChange);
}

// ─── Intersection View (room + category) ───

function renderIntersectionView(container, state, onStateChange) {
  const { objects, drillTarget, triageDecisions, totalCapacity } = state;
  const { room, category, parentDrillTarget } = drillTarget;

  // Filter items to this intersection
  let items = objects.filter(obj =>
    obj.tags.room === room && obj.tags.category === category
  ).map(obj => ({
    ...obj,
    _triage: triageDecisions[obj.id] || null,
  }));

  const totalVol = store.totalVolume(items);
  const pct = ((totalVol / totalCapacity) * 100).toFixed(1);

  // Subcategory storage bar
  const intBar = calculateIntersectionStorageBar(objects, triageDecisions, drillTarget, totalCapacity);

  const backLabel = parentDrillTarget ? parentDrillTarget.label : 'Storage';

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn"><svg class="back-chevron" width="10" height="18" viewBox="0 0 10 18"><path d="M9 1L1 9l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${backLabel}</button>
        <h1>${drillTarget.label}</h1>
      </header>

      <section class="storage-card">
        <div class="storage-title-row">
          <span class="storage-device">${drillTarget.label}</span>
          <span class="storage-used">${store.formatVolume(intBar.groupVolume)} of ${store.formatVolume(intBar.totalCapacity)}</span>
        </div>
        <div class="storage-bar">
          ${intBar.segments.map(s => `<div class="segment" style="width:${s.percentage}%;background:${s.color}" data-group="${s.group}"></div>`).join('')}
          <div class="segment segment-remainder" style="width:${intBar.remainingPercentage}%;background:rgba(0,0,0,0.06)"></div>
        </div>
        <div class="storage-legend">
          ${intBar.segments.slice(0, 6).map(s => `
            <span class="legend-item">
              <span class="legend-dot" style="background:${s.color}"></span>
              <span class="legend-label">${s.label}</span>
            </span>
          `).join('')}
        </div>
      </section>

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

      ${renderItemsSection(items, state)}
    </div>
  `;

  container.querySelector('.back-btn').addEventListener('click', () => {
    if (parentDrillTarget) {
      onStateChange({ viewMode: 'drill', drillTarget: parentDrillTarget });
    } else {
      onStateChange({ viewMode: 'main', drillTarget: null });
    }
  });

  // Clickable subcategory segments → subcategory filter
  container.querySelectorAll('.storage-card .segment[data-group]').forEach(seg => {
    seg.addEventListener('click', () => {
      const key = seg.dataset.group;
      const segData = intBar.segments.find(s => s.group === key);
      if (!segData) return;
      onStateChange({
        viewMode: 'drill',
        drillTarget: {
          type: 'subcategory-filter',
          room,
          category,
          subcategory: key,
          label: `${formatLabel(key)}`,
          color: segData.color,
          parentDrillTarget: drillTarget,
        },
      });
    });
  });

  attachItemsSectionListeners(container, state, onStateChange);
}

// ─── Subcategory Filter View (leaf level) ───

function renderSubcategoryFilterView(container, state, onStateChange) {
  const { objects, drillTarget, triageDecisions, totalCapacity } = state;
  const { room, category, subcategory, parentDrillTarget } = drillTarget;

  let items = objects.filter(obj =>
    obj.tags.room === room && obj.tags.category === category && obj.tags.subcategory === subcategory
  ).map(obj => ({
    ...obj,
    _triage: triageDecisions[obj.id] || null,
  }));

  const totalVol = store.totalVolume(items);
  const pct = ((totalVol / totalCapacity) * 100).toFixed(1);
  const backLabel = parentDrillTarget ? parentDrillTarget.label : 'Storage';

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn"><svg class="back-chevron" width="10" height="18" viewBox="0 0 10 18"><path d="M9 1L1 9l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${backLabel}</button>
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

      ${renderItemsSection(items, state)}
    </div>
  `;

  container.querySelector('.back-btn').addEventListener('click', () => {
    if (parentDrillTarget) {
      onStateChange({ viewMode: 'drill', drillTarget: parentDrillTarget });
    } else {
      onStateChange({ viewMode: 'main', drillTarget: null });
    }
  });

  attachItemsSectionListeners(container, state, onStateChange);
}

// ─── Shared Helpers ───

function renderThumbnailCollage(items) {
  const thumbItems = items.slice(0, 3);
  return `
    <div class="thumb-collage">
      ${thumbItems.map((item, i) => `
        <div class="thumb-collage-item" style="left:${i * 8}px;z-index:${3 - i}">
          <img class="thumb-collage-img" src="${imageUrl(item.id, true)}" alt="${item.name}" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="thumb-collage-emoji">${item.icon}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCardsViewShell(container, { title, backLabel, backTarget, statsHTML, cardsHTML }, onStateChange) {
  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn"><svg class="back-chevron" width="10" height="18" viewBox="0 0 10 18"><path d="M9 1L1 9l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${backLabel}</button>
        <h1>${title}</h1>
      </header>

      <section class="drill-stats-card">
        <div class="drill-stats">
          ${statsHTML}
        </div>
      </section>

      <section class="cards-section">
        ${cardsHTML}
      </section>
    </div>
  `;

  container.querySelector('.back-btn').addEventListener('click', () => {
    if (backTarget) {
      onStateChange({ viewMode: 'drill', drillTarget: backTarget });
    } else {
      onStateChange({ viewMode: 'main', drillTarget: null });
    }
  });
}

// ─── Donation Cards View ───

function renderDonationCardsView(container, state, onStateChange) {
  const { drillTarget } = state;
  const { donationGroups } = drillTarget;

  const totalItems = donationGroups.reduce((sum, g) => sum + g.count, 0);
  const totalVol = donationGroups.reduce((sum, g) => sum + g.volume, 0);

  const statsHTML = `
    <div class="stat">
      <div class="stat-value">${totalItems}</div>
      <div class="stat-label">Items</div>
    </div>
    <div class="stat">
      <div class="stat-value">${donationGroups.length}</div>
      <div class="stat-label">Categories</div>
    </div>
    <div class="stat">
      <div class="stat-value">${store.formatVolume(totalVol)}</div>
      <div class="stat-label">Volume</div>
    </div>
  `;

  const cardsHTML = donationGroups.map(group => `
    <div class="drill-card" data-group-id="${group.id}">
      ${renderThumbnailCollage(group.items)}
      <div class="drill-card-body">
        <div class="drill-card-title">${group.icon} ${group.label}</div>
        <div class="drill-card-subtitle">Needed by ${group.org}</div>
        <div class="drill-card-meta">${group.count} items \u00B7 ${store.formatVolume(group.volume)}</div>
      </div>
      <button class="donate-all-btn" data-group-id="${group.id}">Donate All</button>
    </div>
  `).join('');

  renderCardsViewShell(container, {
    title: 'Donate to Community',
    backLabel: 'Storage',
    backTarget: null,
    statsHTML,
    cardsHTML,
  }, onStateChange);

  // Card click → drill into list
  container.querySelectorAll('.drill-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.donate-all-btn')) return;
      const groupId = card.dataset.groupId;
      const group = donationGroups.find(g => g.id === groupId);
      if (!group) return;
      onStateChange({
        viewMode: 'drill',
        drillTarget: {
          type: 'donation-list',
          group,
          label: group.label,
          parentDrillTarget: drillTarget,
        },
      });
    });
  });

  // Donate All buttons → inline confirmation
  container.querySelectorAll('.donate-all-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = btn.dataset.groupId;
      const group = donationGroups.find(g => g.id === groupId);
      if (!group) return;
      const card = btn.closest('.drill-card');
      showDonateConfirmation(card, group, state, onStateChange);
    });
  });
}

function showDonateConfirmation(card, group, state, onStateChange) {
  card.classList.add('confirming');
  card.innerHTML = `
    <div class="confirm-content">
      <div class="confirm-text">Donate ${group.count} ${group.label.toLowerCase()}?</div>
      <div class="confirm-actions">
        <button class="confirm-btn cancel">Cancel</button>
        <button class="confirm-btn confirm">Confirm</button>
      </div>
    </div>
  `;

  card.querySelector('.confirm-btn.cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    onStateChange({});
  });

  card.querySelector('.confirm-btn.confirm').addEventListener('click', (e) => {
    e.stopPropagation();
    const newDecisions = { ...state.triageDecisions };
    group.items.forEach(item => {
      newDecisions[item.id] = 'donate';
    });
    onStateChange({ triageDecisions: newDecisions, viewMode: 'main', drillTarget: null });
  });
}

// ─── Donation List View (single group) ───

function renderDonationListView(container, state, onStateChange) {
  const { objects, drillTarget, triageDecisions } = state;
  const { group, parentDrillTarget } = drillTarget;

  // Compute subcategory counts for donation reasons
  const active = objects.filter(obj => {
    const d = triageDecisions[obj.id];
    return !d || d === 'keep';
  });
  const subcatCounts = {};
  active.forEach(obj => {
    const sub = obj.tags.subcategory;
    if (!sub) return;
    if (!subcatCounts[sub]) subcatCounts[sub] = 0;
    subcatCounts[sub]++;
  });

  const itemsWithTriage = group.items.map(obj => ({
    ...obj,
    _triage: triageDecisions[obj.id] || null,
  }));

  const donationReasonFn = (obj) => getDonationReason(obj, subcatCounts);

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn"><svg class="back-chevron" width="10" height="18" viewBox="0 0 10 18"><path d="M9 1L1 9l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Donate</button>
        <h1>${group.icon} ${group.label}</h1>
      </header>

      <section class="drill-stats-card">
        <div class="drill-stats">
          <div class="stat">
            <div class="stat-value">${group.count}</div>
            <div class="stat-label">Items</div>
          </div>
          <div class="stat">
            <div class="stat-value">${store.formatVolume(group.volume)}</div>
            <div class="stat-label">Volume</div>
          </div>
        </div>
        <div class="donation-org-label">Needed by ${group.org}</div>
      </section>

      ${renderItemsSection(itemsWithTriage, state, donationReasonFn)}
    </div>
  `;

  container.querySelector('.back-btn').addEventListener('click', () => {
    if (parentDrillTarget) {
      onStateChange({ viewMode: 'drill', drillTarget: parentDrillTarget });
    } else {
      onStateChange({ viewMode: 'main', drillTarget: null });
    }
  });

  attachItemsSectionListeners(container, state, onStateChange);
}

// ─── Redundancy Cards View ───

function renderRedundancyCardsView(container, state, onStateChange) {
  const { drillTarget } = state;
  const { redundancyGroups } = drillTarget;

  const totalItems = redundancyGroups.reduce((sum, g) => sum + g.count, 0);
  const totalVol = redundancyGroups.reduce((sum, g) => sum + g.volume, 0);

  const statsHTML = `
    <div class="stat">
      <div class="stat-value">${totalItems}</div>
      <div class="stat-label">Items</div>
    </div>
    <div class="stat">
      <div class="stat-value">${redundancyGroups.length}</div>
      <div class="stat-label">Clusters</div>
    </div>
    <div class="stat">
      <div class="stat-value">${store.formatVolume(totalVol)}</div>
      <div class="stat-label">Volume</div>
    </div>
  `;

  const { objects } = state;
  const cardsHTML = redundancyGroups.map(group => {
    const groupItems = objects.filter(o => group.ids.includes(o.id));
    return `
      <div class="drill-card" data-group-subcat="${group.subcategory}">
        ${renderThumbnailCollage(groupItems)}
        <div class="drill-card-body">
          <div class="drill-card-title">\u{1F504} ${group.count} ${group.label}</div>
          <div class="drill-card-meta">${store.formatVolume(group.volume)}</div>
        </div>
        <div class="drill-card-action">Review</div>
      </div>
    `;
  }).join('');

  renderCardsViewShell(container, {
    title: 'Spot Redundancies',
    backLabel: 'Storage',
    backTarget: null,
    statsHTML,
    cardsHTML,
  }, onStateChange);

  container.querySelectorAll('.drill-card').forEach(card => {
    card.addEventListener('click', () => {
      const subcat = card.dataset.groupSubcat;
      const group = redundancyGroups.find(g => g.subcategory === subcat);
      if (!group) return;
      onStateChange({
        viewMode: 'drill',
        drillTarget: {
          type: 'redundancy-list',
          group,
          label: group.label,
          parentDrillTarget: drillTarget,
        },
      });
    });
  });
}

// ─── Redundancy List View (single group) ───

function renderRedundancyListView(container, state, onStateChange) {
  const { objects, drillTarget, triageDecisions } = state;
  const { group, parentDrillTarget } = drillTarget;

  const groupItems = objects.filter(o => group.ids.includes(o.id)).map(obj => ({
    ...obj,
    _triage: triageDecisions[obj.id] || null,
  }));

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn"><svg class="back-chevron" width="10" height="18" viewBox="0 0 10 18"><path d="M9 1L1 9l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Redundancies</button>
        <h1>\u{1F504} ${group.label}</h1>
      </header>

      <section class="drill-stats-card">
        <div class="drill-stats">
          <div class="stat">
            <div class="stat-value">${group.count}</div>
            <div class="stat-label">Items</div>
          </div>
          <div class="stat">
            <div class="stat-value">${store.formatVolume(group.volume)}</div>
            <div class="stat-label">Volume</div>
          </div>
        </div>
      </section>

      ${renderItemsSection(groupItems, state)}
    </div>
  `;

  container.querySelector('.back-btn').addEventListener('click', () => {
    if (parentDrillTarget) {
      onStateChange({ viewMode: 'drill', drillTarget: parentDrillTarget });
    } else {
      onStateChange({ viewMode: 'main', drillTarget: null });
    }
  });

  attachItemsSectionListeners(container, state, onStateChange);
}

// ─── Unused Cards View ───

function renderUnusedCardsView(container, state, onStateChange) {
  const { drillTarget } = state;
  const { unusedGroups } = drillTarget;

  const totalItems = unusedGroups.reduce((sum, g) => sum + g.count, 0);
  const totalVol = unusedGroups.reduce((sum, g) => sum + g.volume, 0);

  const statsHTML = `
    <div class="stat">
      <div class="stat-value">${totalItems}</div>
      <div class="stat-label">Items</div>
    </div>
    <div class="stat">
      <div class="stat-value">${unusedGroups.length}</div>
      <div class="stat-label">Groups</div>
    </div>
    <div class="stat">
      <div class="stat-value">${store.formatVolume(totalVol)}</div>
      <div class="stat-label">Volume</div>
    </div>
  `;

  const cardsHTML = unusedGroups.map(group => `
    <div class="drill-card" data-group-id="${group.id}">
      ${renderThumbnailCollage(group.items)}
      <div class="drill-card-body">
        <div class="drill-card-title">${group.icon} ${group.label}</div>
        <div class="drill-card-meta">${group.count} items \u00B7 ${store.formatVolume(group.volume)}</div>
      </div>
      <div class="drill-card-action">Review</div>
    </div>
  `).join('');

  renderCardsViewShell(container, {
    title: 'Review Unused',
    backLabel: 'Storage',
    backTarget: null,
    statsHTML,
    cardsHTML,
  }, onStateChange);

  container.querySelectorAll('.drill-card').forEach(card => {
    card.addEventListener('click', () => {
      const groupId = card.dataset.groupId;
      const group = unusedGroups.find(g => g.id === groupId);
      if (!group) return;
      onStateChange({
        viewMode: 'drill',
        drillTarget: {
          type: 'unused-list',
          group,
          label: group.label,
          parentDrillTarget: drillTarget,
        },
      });
    });
  });
}

// ─── Unused List View (single group) ───

function renderUnusedListView(container, state, onStateChange) {
  const { objects, drillTarget, triageDecisions } = state;
  const { group, parentDrillTarget } = drillTarget;

  const groupItems = group.items.map(obj => ({
    ...obj,
    _triage: triageDecisions[obj.id] || null,
  }));

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn"><svg class="back-chevron" width="10" height="18" viewBox="0 0 10 18"><path d="M9 1L1 9l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Unused</button>
        <h1>${group.icon} ${group.label}</h1>
      </header>

      <section class="drill-stats-card">
        <div class="drill-stats">
          <div class="stat">
            <div class="stat-value">${group.count}</div>
            <div class="stat-label">Items</div>
          </div>
          <div class="stat">
            <div class="stat-value">${store.formatVolume(group.volume)}</div>
            <div class="stat-label">Volume</div>
          </div>
        </div>
      </section>

      ${renderItemsSection(groupItems, state)}
    </div>
  `;

  container.querySelector('.back-btn').addEventListener('click', () => {
    if (parentDrillTarget) {
      onStateChange({ viewMode: 'drill', drillTarget: parentDrillTarget });
    } else {
      onStateChange({ viewMode: 'main', drillTarget: null });
    }
  });

  attachItemsSectionListeners(container, state, onStateChange);
}

// ─── Shared Item Row Renderer ───

function renderItemRow(obj, donationReason) {
  const metaText = donationReason
    ? `<div class="item-meta donation-reason">${donationReason}</div>`
    : `<div class="item-meta">Last used: ${formatRelativeTime(obj.lastUsed)}</div>`;

  return `
    <div class="item-row ${obj._triage && obj._triage !== 'keep' ? 'triaged' : ''}" data-id="${obj.id}">
      <div class="item-thumb-wrap">
        <img class="item-thumb" src="${imageUrl(obj.id, true)}" alt="${obj.name}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="item-emoji-fallback">${obj.icon}</div>
      </div>
      <div class="item-info">
        <div class="item-name">${obj.name}</div>
        ${metaText}
      </div>
      ${obj._triage && obj._triage !== 'keep' ? `<div class="item-triage-badge ${obj._triage}">${obj._triage === 'donate' ? '\u{1F91D}' : '\u{1F5D1}'}</div>` : ''}
      <div class="item-size">${store.formatVolume(obj.volume_liters)}</div>
      <div class="chevron">\u203A</div>
    </div>
  `;
}

// ─── Grid Card Renderer ───

function renderItemCard(obj) {
  const triageBadge = obj._triage && obj._triage !== 'keep'
    ? `<div class="grid-card-badge ${obj._triage}">${obj._triage === 'donate' ? '\u{1F91D}' : '\u{1F5D1}'}</div>`
    : '';

  return `
    <div class="grid-card ${obj._triage && obj._triage !== 'keep' ? 'triaged' : ''}" data-id="${obj.id}">
      <div class="grid-card-photo">
        <img class="grid-card-img" src="${imageUrl(obj.id)}" alt="${obj.name}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="grid-card-emoji">${obj.icon}</div>
        ${triageBadge}
      </div>
      <div class="grid-card-name">${obj.name}</div>
      <div class="grid-card-meta">${store.formatVolume(obj.volume_liters)}</div>
    </div>
  `;
}

// ─── Wrapped Stats View ───

function renderWrappedView(container, state, onStateChange) {
  const { drillTarget } = state;
  const w = drillTarget.wrapped;

  container.innerHTML = `
    <div class="ios-app">
      <header class="drill-header">
        <button class="back-btn"><svg class="back-chevron" width="10" height="18" viewBox="0 0 10 18"><path d="M9 1L1 9l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Storage</button>
        <h1>Your Home: Wrapped</h1>
      </header>

      <section class="wrapped-section">
        <div class="wrapped-card hero">
          <div class="wrapped-big-number">${w.totalItems}</div>
          <div class="wrapped-label">things you own</div>
        </div>

        <div class="wrapped-card">
          <div class="wrapped-stat-icon">\u{1F4CF}</div>
          <div class="wrapped-stat-text">
            <div class="wrapped-stat-value">${store.formatVolume(w.totalVolume)}</div>
            <div class="wrapped-stat-label">total volume of your belongings</div>
          </div>
        </div>

        ${w.mostClutteredRoom ? `
          <div class="wrapped-card">
            <div class="wrapped-stat-icon">\u{1F3E0}</div>
            <div class="wrapped-stat-text">
              <div class="wrapped-stat-value">${formatLabel(w.mostClutteredRoom.name)}</div>
              <div class="wrapped-stat-label">is your most cluttered room (${store.formatVolume(w.mostClutteredRoom.volume)})</div>
            </div>
          </div>
        ` : ''}

        ${w.oldestItem ? `
          <div class="wrapped-card">
            <div class="wrapped-stat-icon">\u{1F4C5}</div>
            <div class="wrapped-stat-text">
              <div class="wrapped-stat-value">${w.oldestItem.name}</div>
              <div class="wrapped-stat-label">is your oldest item (since ${new Date(w.oldestItem.dateObtained).getFullYear()})</div>
            </div>
          </div>
        ` : ''}

        <div class="wrapped-card">
          <div class="wrapped-stat-icon">\u{1F4A4}</div>
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
            <span class="triage-icon">\u{1F91D}</span>
            <span>Donate</span>
          </button>
          <button class="triage-btn toss ${currentTriage === 'toss' ? 'active' : ''}" data-action="toss">
            <span class="triage-icon">\u{1F5D1}</span>
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
