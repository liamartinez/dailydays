// treemap.js — D3.js treemap visualization (WinDirStat-style)
// Edge-to-edge cells with cushion shading, room watermark labels, rich tooltip.

import { formatVolume, staleness } from './store.js?v=4';
import { ROOM_COLORS, formatLabel } from './colors.js?v=4';

const d3 = window.d3;

// Build d3.hierarchy from flat objects array
export function buildHierarchy(objects) {
  const grouped = {};
  for (const obj of objects) {
    const room = obj.tags.room || 'uncategorized';
    const cat = obj.tags.category || 'uncategorized';
    if (!grouped[room]) grouped[room] = {};
    if (!grouped[room][cat]) grouped[room][cat] = [];
    grouped[room][cat].push(obj);
  }

  const children = Object.entries(grouped).map(([room, cats]) => ({
    name: room,
    nodeType: 'room',
    children: Object.entries(cats).map(([cat, items]) => ({
      name: cat,
      nodeType: 'category',
      room: room,
      children: items.map(item => ({
        name: item.name,
        nodeType: 'item',
        room: room,
        value: item.volume_liters,
        data: item,
      }))
    }))
  }));

  return d3.hierarchy({ name: 'home', nodeType: 'root', children })
    .sum(d => d.value || 0)
    .sort((a, b) => b.value - a.value);
}

// Get the subtree for a given drill path
function getSubtree(root, drillPath) {
  let node = root;
  for (const segment of drillPath) {
    const child = node.children?.find(c => c.data.name === segment);
    if (!child) break;
    node = child;
  }
  return node;
}

// Render treemap into container
export function renderTreemap(container, objects, { drillPath, onDrill, onItemSelect, onHover, selectedItemId }) {
  container.innerHTML = '';

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  const root = buildHierarchy(objects);
  const subtree = getSubtree(root, drillPath);

  // D3 treemap can't layout a subtree node from a parent hierarchy.
  // If drilled, create a fresh hierarchy from the subtree's data.
  let displayRoot;
  if (subtree === root) {
    displayRoot = root;
  } else {
    displayRoot = d3.hierarchy(subtree.data)
      .sum(d => d.value || 0)
      .sort((a, b) => b.value - a.value);
  }

  // Edge-to-edge treemap — no padding, WinDirStat style
  const treemap = d3.treemap()
    .size([width, height])
    .paddingOuter(0)
    .paddingInner(0)
    .paddingTop(0)
    .tile(d3.treemapSquarify.ratio(1.2))
    .round(true);

  treemap(displayRoot);

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Defs for cushion gradients
  const defs = svg.append('defs');

  // Create tooltip
  let tooltip = container.querySelector('.viz-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'viz-tooltip';
    container.appendChild(tooltip);
  }

  // Get all leaf nodes
  const leaves = displayRoot.leaves();

  // Create cushion gradients for each leaf
  leaves.forEach((d, i) => {
    const room = d.data.room || d.parent?.data?.room || d.parent?.parent?.data?.name || '';
    const baseColor = ROOM_COLORS[room] || '#8E8E93';
    const color = d3.color(baseColor);
    if (!color) return;

    const grad = defs.append('linearGradient')
      .attr('id', `cushion-${i}`)
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '100%');

    grad.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', d3.color(baseColor).brighter(0.5).formatRgb());
    grad.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', baseColor);
    grad.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', d3.color(baseColor).darker(0.7).formatRgb());
  });

  // Render cells
  const cells = svg.selectAll('.treemap-cell')
    .data(leaves)
    .join('g')
    .attr('class', 'treemap-cell')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  // Rectangles with cushion shading
  cells.append('rect')
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('fill', (d, i) => `url(#cushion-${i})`)
    .attr('opacity', d => {
      const item = d.data.data;
      if (!item) return 0.85;
      if (item.status === 'removed') return 0.2;
      if (item.status === 'considering') return 0.6;
      return 1;
    })
    .attr('stroke', d => {
      const item = d.data.data;
      if (item && selectedItemId === item.id) return '#fff';
      return 'rgba(0,0,0,0.6)';
    })
    .attr('stroke-width', d => {
      const item = d.data.data;
      if (item && selectedItemId === item.id) return 2;
      return 0.5;
    });

  // Per-item labels — small text on cells large enough
  cells.each(function(d) {
    const w = d.x1 - d.x0;
    const h = d.y1 - d.y0;
    const g = d3.select(this);

    if (w > 60 && h > 16) {
      const name = d.data.name;
      const maxChars = Math.floor(w / 5.5);
      const label = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;

      g.append('text')
        .attr('class', 'cell-label')
        .attr('x', 3)
        .attr('y', 11)
        .text(label);
    }
  });

  // ─── Room group watermark labels ───
  // Compute bounding box per room from leaf positions
  const roomBounds = {};
  leaves.forEach(d => {
    const room = d.data.room || d.parent?.data?.room || d.parent?.parent?.data?.name || '';
    if (!roomBounds[room]) {
      roomBounds[room] = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    }
    const b = roomBounds[room];
    b.x0 = Math.min(b.x0, d.x0);
    b.y0 = Math.min(b.y0, d.y0);
    b.x1 = Math.max(b.x1, d.x1);
    b.y1 = Math.max(b.y1, d.y1);
  });

  for (const [room, b] of Object.entries(roomBounds)) {
    const rw = b.x1 - b.x0;
    const rh = b.y1 - b.y0;
    // Only show label if room region is large enough
    if (rw < 80 || rh < 40) continue;

    const fontSize = Math.min(80, Math.max(14, Math.min(rw, rh) * 0.3));
    const cx = b.x0 + rw / 2;
    const cy = b.y0 + rh / 2;

    svg.append('text')
      .attr('class', 'room-label')
      .attr('x', cx)
      .attr('y', cy)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', `${fontSize}px`)
      .text(formatLabel(room));
  }

  // Click handler — select item for detail panel
  cells.on('click', (event, d) => {
    const item = d.data.data;
    if (item && onItemSelect) {
      onItemSelect(item);
    }
  });

  // ─── Enhanced hover tooltip ───
  cells.on('mouseenter', (event, d) => {
    const item = d.data.data;
    if (!item) return;

    let html = '';

    // Path
    html += `<div class="tooltip-path">${esc(formatLabel(item.tags.room))} &gt; ${esc(formatLabel(item.tags.category))}</div>`;

    // Name
    html += `<div class="tooltip-name">${item.icon} ${esc(item.name)}</div>`;

    // Description
    if (item.description) {
      html += `<div class="tooltip-desc">${esc(item.description)}</div>`;
    }

    // Volume
    html += `<div class="tooltip-volume">${formatVolume(item.volume_liters)} (${item.size})</div>`;

    // HISTORY section
    html += `<div class="tooltip-section">HISTORY</div>`;
    html += `<div class="tooltip-table">`;

    if (item.lastUsed) {
      const days = staleness(item);
      html += tooltipRow('Last used', `${formatDate(item.lastUsed)} (${formatStaleness(days)})`);
    } else {
      html += tooltipRow('Last used', 'Never');
    }
    if (item.dateObtained) {
      html += tooltipRow('Obtained', formatDate(item.dateObtained));
    }
    html += tooltipRow('Usage', formatLabel(item.usageFrequency || '—'));
    html += tooltipRow('Attachment', formatLabel(item.attachment || '—'));
    html += `</div>`;

    // DETAILS section (only if item has detail data)
    const det = item.detail;
    if (det) {
      const detRows = [];
      if (det.brand) detRows.push(tooltipRow('Brand', det.brand));
      if (det.model) detRows.push(tooltipRow('Model', det.model));
      if (det.color) detRows.push(tooltipRow('Color', det.color));
      if (det.material) detRows.push(tooltipRow('Material', det.material));
      if (det.scent) detRows.push(tooltipRow('Scent', det.scent));
      if (det.contents) detRows.push(tooltipRow('Contents', det.contents));

      if (detRows.length > 0) {
        html += `<div class="tooltip-section">DETAILS</div>`;
        html += `<div class="tooltip-table">${detRows.join('')}</div>`;
      }
    }

    tooltip.innerHTML = html;
    tooltip.classList.add('visible');
    if (onHover) onHover(item.id);
  })
  .on('mousemove', (event) => {
    const rect = container.getBoundingClientRect();
    let left = event.clientX - rect.left + 12;
    let top = event.clientY - rect.top - 10;

    // Keep tooltip on screen
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (left + tw > width) left = left - tw - 24;
    if (top + th > height) top = top - th - 20;
    if (left < 0) left = 4;
    if (top < 0) top = 4;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  })
  .on('mouseleave', () => {
    tooltip.classList.remove('visible');
    if (onHover) onHover(null);
  });
}

function tooltipRow(label, value) {
  return `<div class="tooltip-row"><span class="tooltip-label">${esc(label)}</span><span class="tooltip-value">${esc(value)}</span></div>`;
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
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
