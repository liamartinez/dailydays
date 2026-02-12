// ui.js — Orchestrates rendering across all views
// Dispatches to treemap, sunburst, list, storage bar, sidebar tree, and detail panel.

import {
  filterMultiple, sortBy, totalVolume, statusSummary,
  potentialSpaceSaved, formatVolume, uniqueTagValues,
  staleness, countByTag, volumeByTag, groupByTag,
} from './store.js?v=4';
import { TAG_DEFINITIONS } from './data.js?v=4';
import { renderStorageBar } from './storagebar.js?v=4';
import { renderTreemap } from './treemap.js?v=4';
import { renderSunburst } from './sunburst.js?v=4';
import { ROOM_COLORS, formatLabel, pluralize } from './colors.js?v=4';

export { ROOM_COLORS, formatLabel, pluralize };

// Track collapsed state for sidebar tree (persists across renders)
const collapsedNodes = new Set();

// ─── Main render entry point ───

export function renderApp(state, onStateChange) {
  const filtered = getFiltered(state);

  // View toggle buttons
  setupViewToggle(state, onStateChange);

  // Storage bar
  const barContainer = document.getElementById('storage-bar');
  if (barContainer) {
    renderStorageBar(barContainer, filtered, {
      drillPath: state.drillPath,
      onSegmentClick: (room) => {
        onStateChange({ drillPath: [room] });
      },
    });
  }

  // Sidebar — either detail panel or tree view
  renderSidebar(state, filtered, onStateChange);

  // Main visualization area
  const vizArea = document.getElementById('viz-area');
  if (!vizArea) return;

  const handlers = {
    drillPath: state.drillPath,
    selectedItemId: state.selectedItemId,
    onDrill: (path) => onStateChange({ drillPath: path }),
    onItemSelect: (item) => {
      // Toggle: click same item again deselects
      const newId = state.selectedItemId === item.id ? null : item.id;
      onStateChange({ selectedItemId: newId });
    },
    onHover: (id) => {
      state.hoveredItemId = id;
    },
  };

  switch (state.view) {
    case 'treemap':
      renderTreemap(vizArea, filtered, handlers);
      break;
    case 'sunburst':
      renderSunburst(vizArea, filtered, handlers);
      break;
    case 'list':
      renderListView(vizArea, state, filtered, onStateChange);
      break;
  }
}

// ─── View Toggle ───

function setupViewToggle(state, onStateChange) {
  const toggle = document.getElementById('view-toggle');
  if (!toggle) return;

  const buttons = toggle.querySelectorAll('.view-btn');
  buttons.forEach(btn => {
    const view = btn.dataset.view;
    btn.classList.toggle('active', view === state.view);

    // Remove old listeners by cloning
    const newBtn = btn.cloneNode(true);
    newBtn.classList.toggle('active', view === state.view);
    newBtn.addEventListener('click', () => {
      if (state.view !== view) {
        onStateChange({ view });
      }
    });
    btn.parentNode.replaceChild(newBtn, btn);
  });
}

// ─── Sidebar ───

function renderSidebar(state, filtered, onStateChange) {
  renderBreadcrumb(state, onStateChange);

  // If an item is selected, show detail panel; otherwise show tree + table
  const selectedItem = state.selectedItemId
    ? state.objects.find(o => o.id === state.selectedItemId)
    : null;

  const detailPanel = document.getElementById('detail-panel');
  const sidebarFilters = document.getElementById('sidebar-filters');
  const sidebarList = document.getElementById('sidebar-list');
  const extensionTable = document.getElementById('extension-table');

  if (selectedItem && detailPanel) {
    // Show detail panel, hide tree
    detailPanel.style.display = 'flex';
    if (sidebarFilters) sidebarFilters.style.display = 'none';
    if (sidebarList) sidebarList.style.display = 'none';
    if (extensionTable) extensionTable.style.display = 'none';
    renderDetailPanel(detailPanel, selectedItem, state, onStateChange);
  } else {
    // Show tree + table, hide detail
    if (detailPanel) detailPanel.style.display = 'none';
    if (sidebarFilters) sidebarFilters.style.display = 'flex';
    if (sidebarList) sidebarList.style.display = 'block';
    if (extensionTable) extensionTable.style.display = 'block';
    renderSidebarFilters(state, onStateChange);
    renderSidebarTree(state, filtered, onStateChange);
    renderExtensionTable(filtered);
  }
}

function renderBreadcrumb(state, onStateChange) {
  const nav = document.getElementById('breadcrumb');
  if (!nav) return;
  nav.innerHTML = '';

  // "All" link
  const allLink = document.createElement('a');
  allLink.textContent = 'All';
  allLink.addEventListener('click', () => onStateChange({ drillPath: [] }));
  nav.appendChild(allLink);

  for (let i = 0; i < state.drillPath.length; i++) {
    const sep = document.createElement('span');
    sep.className = 'separator';
    sep.textContent = '›';
    nav.appendChild(sep);

    const isLast = i === state.drillPath.length - 1;
    if (isLast) {
      const span = document.createElement('span');
      span.className = 'current';
      span.textContent = formatLabel(state.drillPath[i]);
      nav.appendChild(span);
    } else {
      const link = document.createElement('a');
      link.textContent = formatLabel(state.drillPath[i]);
      const pathUpTo = state.drillPath.slice(0, i + 1);
      link.addEventListener('click', () => onStateChange({ drillPath: pathUpTo }));
      nav.appendChild(link);
    }
  }
}

function renderSidebarFilters(state, onStateChange) {
  const container = document.getElementById('sidebar-filters');
  if (!container) return;
  container.innerHTML = '';

  const filterDefs = [
    { key: 'room', label: 'Room', options: TAG_DEFINITIONS.room },
    { key: 'category', label: 'Category', options: TAG_DEFINITIONS.category },
    { key: 'size', label: 'Size', options: TAG_DEFINITIONS.size },
    { key: 'usageFrequency', label: 'Usage', options: TAG_DEFINITIONS.usageFrequency },
    { key: 'attachment', label: 'Attachment', options: TAG_DEFINITIONS.attachment },
    { key: 'status', label: 'Status', options: TAG_DEFINITIONS.status },
  ];

  for (const def of filterDefs) {
    const select = document.createElement('select');
    select.className = 'filter-select';

    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = `All ${pluralize(def.label)}`;
    select.appendChild(allOpt);

    for (const opt of def.options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = formatLabel(opt);
      if (state.filters[def.key] === opt) o.selected = true;
      select.appendChild(o);
    }

    select.addEventListener('change', () => {
      const val = select.value;
      onStateChange({
        filters: {
          ...state.filters,
          [def.key]: val === 'all' ? null : val,
        },
      });
    });

    container.appendChild(select);
  }
}

// ─── Detail Panel (WinDirStat-style item properties) ───

function renderDetailPanel(container, item, state, onStateChange) {
  container.innerHTML = '';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'detail-back';
  backBtn.textContent = '\u2190 Back';
  backBtn.addEventListener('click', () => {
    onStateChange({ selectedItemId: null });
  });
  container.appendChild(backBtn);

  // Icon + Name
  const header = document.createElement('div');
  header.className = 'detail-header';
  const icon = document.createElement('span');
  icon.className = 'detail-icon';
  icon.textContent = item.icon;
  header.appendChild(icon);
  const name = document.createElement('span');
  name.className = 'detail-name';
  name.textContent = item.name;
  header.appendChild(name);
  container.appendChild(header);

  // Path (room > category)
  const path = document.createElement('div');
  path.className = 'detail-path';
  path.textContent = `${formatLabel(item.tags.room)} \u203A ${formatLabel(item.tags.category)}`;
  container.appendChild(path);

  // Status toggle button
  const statusBtn = document.createElement('button');
  statusBtn.className = `detail-status-btn status-${item.status}`;
  statusBtn.textContent = statusLabel(item.status);
  statusBtn.addEventListener('click', () => {
    item.status = nextStatus(item.status);
    onStateChange({});
  });
  container.appendChild(statusBtn);

  // Divider
  container.appendChild(createDivider());

  // Properties table
  const props = document.createElement('div');
  props.className = 'detail-props';

  addProp(props, 'Volume', `${formatVolume(item.volume_liters)} (${item.size})`);
  if (item.dateObtained) addProp(props, 'Obtained', formatDate(item.dateObtained));
  if (item.lastUsed) {
    const days = staleness(item);
    addProp(props, 'Last Used', `${formatDate(item.lastUsed)} (${formatStaleness(days)})`);
  } else {
    addProp(props, 'Last Used', 'Never');
  }
  addProp(props, 'Usage', formatLabel(item.tags.usageFrequency || item.usageFrequency || '—'));
  addProp(props, 'Attachment', formatLabel(item.attachment || '—'));

  container.appendChild(props);

  // Description
  if (item.description) {
    container.appendChild(createDivider());
    const desc = document.createElement('div');
    desc.className = 'detail-desc';
    desc.textContent = item.description;
    container.appendChild(desc);
  }

  // Detail fields (brand, model, color, material, titles, etc.)
  if (item.detail) {
    container.appendChild(createDivider());
    const detailSection = document.createElement('div');
    detailSection.className = 'detail-extra';
    const det = item.detail;

    if (det.brand) addProp(detailSection, 'Brand', det.brand);
    if (det.model) addProp(detailSection, 'Model', det.model);
    if (det.color) addProp(detailSection, 'Color', det.color);
    if (det.material) addProp(detailSection, 'Material', det.material);
    if (det.scent) addProp(detailSection, 'Scent', det.scent);
    if (det.contents) addProp(detailSection, 'Contents', det.contents);

    if (det.titles && Array.isArray(det.titles)) {
      const titlesDiv = document.createElement('div');
      titlesDiv.className = 'detail-titles';
      const titleLabel = document.createElement('div');
      titleLabel.className = 'detail-titles-label';
      titleLabel.textContent = 'Titles';
      titlesDiv.appendChild(titleLabel);
      for (const t of det.titles) {
        const titleRow = document.createElement('div');
        titleRow.className = 'detail-title-row';
        if (typeof t === 'string') {
          titleRow.textContent = t;
        } else {
          titleRow.innerHTML = `<em>${esc(t.title)}</em> — ${esc(t.author)}`;
        }
        titlesDiv.appendChild(titleRow);
      }
      detailSection.appendChild(titlesDiv);
    }

    container.appendChild(detailSection);
  }
}

function createDivider() {
  const div = document.createElement('div');
  div.className = 'detail-divider';
  return div;
}

function addProp(container, label, value) {
  const row = document.createElement('div');
  row.className = 'detail-prop-row';
  const l = document.createElement('span');
  l.className = 'detail-prop-label';
  l.textContent = label;
  row.appendChild(l);
  const v = document.createElement('span');
  v.className = 'detail-prop-value';
  v.textContent = value;
  row.appendChild(v);
  container.appendChild(row);
}

// ─── Sidebar Tree (WinDirStat-style collapsible directory tree) ───

function renderSidebarTree(state, filtered, onStateChange) {
  const container = document.getElementById('sidebar-list');
  if (!container) return;
  container.innerHTML = '';

  const total = totalVolume(filtered);

  // Group by room, then by category
  const roomGroups = groupByTag(filtered, 'room');
  const sortedRooms = Object.entries(roomGroups)
    .map(([room, items]) => ({ room, items, vol: totalVolume(items) }))
    .sort((a, b) => b.vol - a.vol);

  for (const { room, items, vol } of sortedRooms) {
    const roomKey = `room:${room}`;
    const isCollapsed = collapsedNodes.has(roomKey);
    const pct = total > 0 ? ((vol / total) * 100).toFixed(1) : '0.0';

    // Room row
    const roomRow = document.createElement('div');
    roomRow.className = 'tree-node tree-room';
    roomRow.innerHTML = `
      <span class="tree-toggle">${isCollapsed ? '\u25B6' : '\u25BC'}</span>
      <span class="tree-color" style="background:${ROOM_COLORS[room] || '#8E8E93'}"></span>
      <span class="tree-name">${esc(formatLabel(room))}</span>
      <span class="tree-vol">${formatVolume(vol)}</span>
      <span class="tree-pct">${pct}%</span>
    `;
    roomRow.addEventListener('click', () => {
      if (isCollapsed) collapsedNodes.delete(roomKey);
      else collapsedNodes.add(roomKey);
      onStateChange({});
    });
    container.appendChild(roomRow);

    if (isCollapsed) continue;

    // Group by category within room
    const catGroups = groupByTag(items, 'category');
    const sortedCats = Object.entries(catGroups)
      .map(([cat, catItems]) => ({ cat, items: catItems, vol: totalVolume(catItems) }))
      .sort((a, b) => b.vol - a.vol);

    for (const { cat, items: catItems, vol: catVol } of sortedCats) {
      const catKey = `cat:${room}:${cat}`;
      const catCollapsed = collapsedNodes.has(catKey);
      const catPct = total > 0 ? ((catVol / total) * 100).toFixed(1) : '0.0';

      const catRow = document.createElement('div');
      catRow.className = 'tree-node tree-category';
      catRow.innerHTML = `
        <span class="tree-toggle">${catCollapsed ? '\u25B6' : '\u25BC'}</span>
        <span class="tree-name">${esc(formatLabel(cat))}</span>
        <span class="tree-vol">${formatVolume(catVol)}</span>
        <span class="tree-pct">${catPct}%</span>
      `;
      catRow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (catCollapsed) collapsedNodes.delete(catKey);
        else collapsedNodes.add(catKey);
        onStateChange({});
      });
      container.appendChild(catRow);

      if (catCollapsed) continue;

      // Items sorted by volume
      const sortedItems = sortBy(catItems, 'volume_liters', 'desc');
      for (const obj of sortedItems) {
        const itemRow = document.createElement('div');
        itemRow.className = 'tree-node tree-item';
        if (obj.id === state.selectedItemId) itemRow.classList.add('selected');
        if (obj.id === state.hoveredItemId) itemRow.classList.add('active');

        const itemPct = total > 0 ? ((obj.volume_liters / total) * 100).toFixed(1) : '0.0';
        itemRow.innerHTML = `
          <span class="tree-item-icon">${obj.icon}</span>
          <span class="tree-name">${esc(obj.name)}</span>
          <span class="tree-vol">${formatVolume(obj.volume_liters)}</span>
          <span class="tree-pct">${itemPct}%</span>
        `;
        itemRow.addEventListener('click', (e) => {
          e.stopPropagation();
          const newId = state.selectedItemId === obj.id ? null : obj.id;
          onStateChange({ selectedItemId: newId });
        });
        container.appendChild(itemRow);
      }
    }
  }
}

// ─── Extension Table (WinDirStat-style stats by room) ───

function renderExtensionTable(filtered) {
  const container = document.getElementById('extension-table');
  if (!container) return;
  container.innerHTML = '';

  const volumes = volumeByTag(filtered, 'room');
  const counts = countByTag(filtered, 'room');
  const total = totalVolume(filtered);

  const sortedRooms = Object.entries(volumes).sort((a, b) => b[1] - a[1]);

  // Table header
  const thead = document.createElement('div');
  thead.className = 'ext-table-header';
  thead.innerHTML = `
    <span class="ext-color"></span>
    <span class="ext-name">Room</span>
    <span class="ext-count">Items</span>
    <span class="ext-size">Size</span>
    <span class="ext-pct">%</span>
  `;
  container.appendChild(thead);

  for (const [room, vol] of sortedRooms) {
    const row = document.createElement('div');
    row.className = 'ext-table-row';
    const pct = total > 0 ? ((vol / total) * 100).toFixed(1) : '0.0';
    row.innerHTML = `
      <span class="ext-color"><span class="ext-swatch" style="background:${ROOM_COLORS[room] || '#8E8E93'}"></span></span>
      <span class="ext-name">${esc(formatLabel(room))}</span>
      <span class="ext-count">${counts[room] || 0}</span>
      <span class="ext-size">${formatVolume(vol)}</span>
      <span class="ext-pct">${pct}</span>
    `;
    container.appendChild(row);
  }
}

// ─── List View (preserved from original) ───

function renderListView(container, state, filtered, onStateChange) {
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'list-view-container';

  // Summary bar
  wrap.appendChild(renderSummaryBar(state, filtered));

  // Sort controls
  wrap.appendChild(renderSortControls(state, onStateChange));

  // Object list
  const sorted = sortBy(filtered, state.sortField, state.sortDirection);
  const list = document.createElement('div');
  list.className = 'object-list';

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No objects match the current filters.';
    list.appendChild(empty);
  } else {
    for (const obj of sorted) {
      list.appendChild(renderObjectRow(obj, onStateChange));
    }
  }

  wrap.appendChild(list);
  container.appendChild(wrap);
}

function renderSummaryBar(state, filtered) {
  const all = state.objects;
  const summary = statusSummary(all);
  const spaceSaved = potentialSpaceSaved(all);
  const filteredVolume = totalVolume(filtered);

  const bar = document.createElement('div');
  bar.className = 'summary-bar';

  const stats = [
    `${filtered.length} of ${all.length} items`,
    formatVolume(filteredVolume) + ' shown',
  ];

  if (summary.considering > 0) {
    stats.push(`${summary.considering} considering (${formatVolume(spaceSaved)})`);
  }
  if (summary.removed > 0) {
    stats.push(`${summary.removed} removed`);
  }

  bar.textContent = stats.join('  \u00B7  ');
  return bar;
}

function renderSortControls(state, onStateChange) {
  const wrap = document.createElement('div');
  wrap.className = 'sort-controls';

  const label = document.createElement('span');
  label.className = 'sort-label';
  label.textContent = 'Sort:';
  wrap.appendChild(label);

  const sortFields = [
    { value: 'name', label: 'Name' },
    { value: 'volume_liters', label: 'Size' },
    { value: 'dateObtained', label: 'Obtained' },
    { value: 'lastUsed', label: 'Last Used' },
    { value: 'attachment', label: 'Attachment' },
    { value: 'usageFrequency', label: 'Usage' },
  ];

  for (const sf of sortFields) {
    const btn = document.createElement('button');
    btn.className = 'sort-btn';
    btn.textContent = sf.label;
    if (state.sortField === sf.value) {
      btn.classList.add('active');
      btn.textContent += state.sortDirection === 'asc' ? ' \u2191' : ' \u2193';
    }
    btn.addEventListener('click', () => {
      if (state.sortField === sf.value) {
        onStateChange({ sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' });
      } else {
        onStateChange({ sortField: sf.value, sortDirection: 'asc' });
      }
    });
    wrap.appendChild(btn);
  }

  return wrap;
}

function renderObjectRow(obj, onStateChange) {
  const row = document.createElement('div');
  row.className = `object-row status-${obj.status}`;

  // Icon
  const icon = document.createElement('span');
  icon.className = 'obj-icon';
  icon.textContent = obj.icon;
  row.appendChild(icon);

  // Info
  const info = document.createElement('div');
  info.className = 'obj-info';

  const nameRow = document.createElement('div');
  nameRow.className = 'obj-name';
  nameRow.textContent = obj.name;
  info.appendChild(nameRow);

  const meta = document.createElement('div');
  meta.className = 'obj-meta';
  meta.textContent = [
    formatLabel(obj.tags.room),
    formatLabel(obj.tags.category),
    obj.size,
    formatVolume(obj.volume_liters),
  ].join('  \u00B7  ');
  info.appendChild(meta);

  const detail = document.createElement('div');
  detail.className = 'obj-detail';
  const detailParts = [];
  if (obj.dateObtained) detailParts.push(`Got: ${formatDate(obj.dateObtained)}`);
  if (obj.lastUsed) {
    const days = staleness(obj);
    detailParts.push(`Last used: ${formatDate(obj.lastUsed)} (${formatStaleness(days)})`);
  } else {
    detailParts.push('Never used');
  }
  if (obj.attachment !== 'none') detailParts.push(`Attachment: ${obj.attachment}`);
  detail.textContent = detailParts.join('  \u00B7  ');
  info.appendChild(detail);

  if (obj.description) {
    const desc = document.createElement('div');
    desc.className = 'obj-desc';
    desc.textContent = obj.description;
    info.appendChild(desc);
  }

  if (obj.detail) {
    const detailDiv = document.createElement('div');
    detailDiv.className = 'obj-product-detail';
    detailDiv.innerHTML = formatDetail(obj.detail);
    info.appendChild(detailDiv);
  }

  row.appendChild(info);

  // Status toggle
  const statusBtn = document.createElement('button');
  statusBtn.className = `status-toggle status-${obj.status}`;
  statusBtn.textContent = statusLabel(obj.status);
  statusBtn.title = 'Click to change status';
  statusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    obj.status = nextStatus(obj.status);
    onStateChange({});
  });
  row.appendChild(statusBtn);

  return row;
}

// ─── Helpers ───

function getFiltered(state) {
  return filterMultiple(state.objects, state.filters);
}

function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatStaleness(days) {
  if (days === Infinity) return 'never';
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatDetail(det) {
  if (!det) return '';
  const parts = [];

  if (det.brand) {
    let bm = `<span class="det-brand">${esc(det.brand)}</span>`;
    if (det.model) bm += ` <span class="det-model">${esc(det.model)}</span>`;
    parts.push(bm);
  }

  const matCol = [];
  if (det.material) matCol.push(esc(det.material));
  if (det.color) matCol.push(esc(det.color));
  if (matCol.length) parts.push(matCol.join(' \u00B7 '));

  if (det.titles && Array.isArray(det.titles)) {
    const titleStrs = det.titles.map(t =>
      typeof t === 'string' ? esc(t) : `<em>${esc(t.title)}</em> \u2014 ${esc(t.author)}`
    );
    parts.push(titleStrs.join(', '));
  }

  if (det.contents) parts.push(esc(det.contents));
  if (det.scent) parts.push(`Scent: ${esc(det.scent)}`);

  return parts.join('<br>');
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function statusLabel(status) {
  switch (status) {
    case 'keeping': return 'Keep';
    case 'considering': return 'Maybe';
    case 'removed': return 'Remove';
    default: return status;
  }
}

function nextStatus(current) {
  switch (current) {
    case 'keeping': return 'considering';
    case 'considering': return 'removed';
    case 'removed': return 'keeping';
    default: return 'keeping';
  }
}
