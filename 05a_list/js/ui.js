// ui.js — Minimal list renderer to prove the data layer works.
// This is a test harness, not the final visualization.

import {
  filterMultiple, sortBy, totalVolume, statusSummary,
  potentialSpaceSaved, formatVolume, uniqueTagValues,
  staleness, countByTag, volumeByTag,
} from '../../shared/js/store.js';
import { TAG_DEFINITIONS } from '../../shared/js/data.js';
import { formatLabel, pluralize } from '../../shared/js/colors.js';
import { imageUrl } from '../../shared/js/images.js';

// ─── Render the full UI ───

export function renderUI(container, state, onStateChange) {
  container.innerHTML = '';
  container.appendChild(renderSummaryBar(state));
  container.appendChild(renderFilters(state, onStateChange));
  container.appendChild(renderObjectList(state, onStateChange));
}

// ─── Summary Bar ───

function renderSummaryBar(state) {
  const all = state.objects;
  const filtered = getFiltered(state);
  const summary = statusSummary(all);
  const spaceSaved = potentialSpaceSaved(all);
  const filteredVolume = totalVolume(filtered);

  const bar = el('div', 'summary-bar');

  const stats = [
    `${filtered.length} of ${all.length} items`,
    formatVolume(filteredVolume) + ' shown',
  ];

  if (summary.considering > 0) {
    stats.push(`${summary.considering} considering removal (${formatVolume(spaceSaved)})`);
  }
  if (summary.removed > 0) {
    stats.push(`${summary.removed} removed`);
  }

  bar.textContent = stats.join('  ·  ');
  return bar;
}

// ─── Filters ───

function renderFilters(state, onStateChange) {
  const wrap = el('div', 'filters');

  const filterDefs = [
    { key: 'room', label: 'Room', options: TAG_DEFINITIONS.room },
    { key: 'category', label: 'Category', options: TAG_DEFINITIONS.category },
    { key: 'size', label: 'Size', options: TAG_DEFINITIONS.size },
    { key: 'usageFrequency', label: 'Usage', options: TAG_DEFINITIONS.usageFrequency },
    { key: 'attachment', label: 'Attachment', options: TAG_DEFINITIONS.attachment },
    { key: 'status', label: 'Status', options: TAG_DEFINITIONS.status },
  ];

  for (const def of filterDefs) {
    const select = el('select', 'filter-select');
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

    wrap.appendChild(select);
  }

  // Sort control
  const sortWrap = el('div', 'sort-controls');
  const sortLabel = el('span', 'sort-label');
  sortLabel.textContent = 'Sort:';
  sortWrap.appendChild(sortLabel);

  const sortFields = [
    { value: 'name', label: 'Name' },
    { value: 'volume_liters', label: 'Size' },
    { value: 'dateObtained', label: 'Obtained' },
    { value: 'lastUsed', label: 'Last Used' },
    { value: 'attachment', label: 'Attachment' },
    { value: 'usageFrequency', label: 'Usage' },
  ];

  for (const sf of sortFields) {
    const btn = el('button', 'sort-btn');
    btn.textContent = sf.label;
    if (state.sortField === sf.value) {
      btn.classList.add('active');
      btn.textContent += state.sortDirection === 'asc' ? ' ↑' : ' ↓';
    }
    btn.addEventListener('click', () => {
      if (state.sortField === sf.value) {
        onStateChange({ sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc' });
      } else {
        onStateChange({ sortField: sf.value, sortDirection: 'asc' });
      }
    });
    sortWrap.appendChild(btn);
  }

  wrap.appendChild(sortWrap);
  return wrap;
}

// ─── Object List ───

function renderObjectList(state, onStateChange) {
  const filtered = getFiltered(state);
  const sorted = sortBy(filtered, state.sortField, state.sortDirection);

  const list = el('div', 'object-list');

  if (sorted.length === 0) {
    const empty = el('div', 'empty-state');
    empty.textContent = 'No objects match the current filters.';
    list.appendChild(empty);
    return list;
  }

  for (const obj of sorted) {
    list.appendChild(renderObjectRow(obj, state, onStateChange));
  }

  return list;
}

function renderObjectRow(obj, state, onStateChange) {
  const row = el('div', `object-row status-${obj.status}`);

  // Icon / Thumbnail
  const iconWrap = el('div', 'obj-icon-wrap');
  const img = document.createElement('img');
  img.src = imageUrl(obj.id, true);
  img.alt = obj.name;
  img.className = 'obj-thumb';
  img.loading = 'lazy';
  img.onerror = function () {
    this.style.display = 'none';
    const emoji = el('span', 'obj-icon-fallback');
    emoji.textContent = obj.icon;
    iconWrap.appendChild(emoji);
  };
  iconWrap.appendChild(img);
  row.appendChild(iconWrap);

  // Info
  const info = el('div', 'obj-info');

  const nameRow = el('div', 'obj-name');
  nameRow.textContent = obj.name;
  info.appendChild(nameRow);

  const meta = el('div', 'obj-meta');
  const parts = [
    formatLabel(obj.tags.room),
    formatLabel(obj.tags.category),
    obj.size,
    formatVolume(obj.volume_liters),
  ];
  meta.textContent = parts.join('  ·  ');
  info.appendChild(meta);

  const detail = el('div', 'obj-detail');
  const detailParts = [];
  if (obj.dateObtained) detailParts.push(`Got: ${formatDate(obj.dateObtained)}`);
  if (obj.lastUsed) {
    const days = staleness(obj);
    detailParts.push(`Last used: ${formatDate(obj.lastUsed)} (${formatStaleness(days)})`);
  } else {
    detailParts.push('Never used');
  }
  if (obj.attachment !== 'none') detailParts.push(`Attachment: ${obj.attachment}`);
  detail.textContent = detailParts.join('  ·  ');
  info.appendChild(detail);

  if (obj.description) {
    const desc = el('div', 'obj-desc');
    desc.textContent = obj.description;
    info.appendChild(desc);
  }

  if (obj.detail) {
    const detailDiv = el('div', 'obj-product-detail');
    detailDiv.innerHTML = formatDetail(obj.detail);
    info.appendChild(detailDiv);
  }

  row.appendChild(info);

  // Status toggle
  const statusBtn = el('button', `status-toggle status-${obj.status}`);
  statusBtn.textContent = statusLabel(obj.status);
  statusBtn.title = 'Click to change status';
  statusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = nextStatus(obj.status);
    obj.status = next;
    onStateChange({});
  });
  row.appendChild(statusBtn);

  return row;
}

// ─── Helpers ───

function getFiltered(state) {
  return filterMultiple(state.objects, state.filters);
}

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
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

  // Brand + model line
  if (det.brand) {
    let bm = `<span class="det-brand">${esc(det.brand)}</span>`;
    if (det.model) bm += ` <span class="det-model">${esc(det.model)}</span>`;
    parts.push(bm);
  }

  // Material + color
  const matCol = [];
  if (det.material) matCol.push(esc(det.material));
  if (det.color) matCol.push(esc(det.color));
  if (matCol.length) parts.push(matCol.join(' · '));

  // Titles (books, media, games)
  if (det.titles && Array.isArray(det.titles)) {
    const titleStrs = det.titles.map(t =>
      typeof t === 'string' ? esc(t) : `<em>${esc(t.title)}</em> — ${esc(t.author)}`
    );
    parts.push(titleStrs.join(', '));
  }

  // Contents (catch-all)
  if (det.contents) parts.push(esc(det.contents));

  // Scent
  if (det.scent) parts.push(`Scent: ${esc(det.scent)}`);

  return parts.join('<br>');
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
