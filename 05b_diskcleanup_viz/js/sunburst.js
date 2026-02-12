// sunburst.js — DaisyDisk-style radial sunburst visualization
// Uses d3.partition for radial layout with d3.arc for rendering.

import { formatVolume } from './store.js?v=4';
import { ROOM_COLORS, formatLabel } from './colors.js?v=4';
import { buildHierarchy } from './treemap.js?v=4';

const d3 = window.d3;

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

export function renderSunburst(container, objects, { drillPath, onDrill, onItemSelect, onHover, selectedItemId }) {
  container.innerHTML = '';

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  const radius = Math.min(width, height) / 2;

  const root = buildHierarchy(objects);
  const displayRoot = getSubtree(root, drillPath);

  // Partition layout
  const partition = d3.partition()
    .size([2 * Math.PI, radius]);

  partition(displayRoot);

  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  // Arc generator
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => {
      if (d.depth === 0) return 0;
      const maxDepth = displayRoot.height;
      const innerFrac = d.depth / (maxDepth + 1);
      return radius * 0.15 + (radius * 0.85) * innerFrac * 0.85;
    })
    .outerRadius(d => {
      if (d.depth === 0) return radius * 0.15;
      const maxDepth = displayRoot.height;
      const outerFrac = (d.depth + 1) / (maxDepth + 1);
      return radius * 0.15 + (radius * 0.85) * outerFrac * 0.85;
    })
    .padAngle(0.005)
    .padRadius(radius / 2);

  // Create tooltip
  let tooltip = container.querySelector('.viz-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'viz-tooltip';
    container.appendChild(tooltip);
  }

  // Get color for a node
  function getColor(d) {
    if (d.depth === 0) return 'transparent';
    // Walk up to find room
    let node = d;
    while (node.depth > 1 && node.parent) node = node.parent;
    const room = node.data.name;
    const baseColor = ROOM_COLORS[room] || '#8E8E93';

    // Lighten for deeper levels
    if (d.depth > 1) {
      const color = d3.color(baseColor);
      if (color) {
        color.opacity = 0.5 + (0.5 / d.depth);
        return color.formatRgb();
      }
    }
    return baseColor;
  }

  // Flatten all descendant nodes (skip root if it's the display root)
  const nodes = displayRoot.descendants();

  // Render arcs
  const paths = svg.selectAll('.sunburst-arc')
    .data(nodes)
    .join('path')
    .attr('class', 'sunburst-arc')
    .attr('d', arc)
    .attr('fill', getColor)
    .attr('opacity', d => {
      if (d.depth === 0) return 0;
      const item = d.data.data;
      if (item && item.status === 'removed') return 0.2;
      if (item && item.status === 'considering') return 0.6;
      return 1;
    });

  // Center label
  const centerGroup = svg.append('g').attr('class', 'sunburst-center');

  const centerName = drillPath.length > 0
    ? formatLabel(drillPath[drillPath.length - 1])
    : 'Home';
  const centerVol = formatVolume(displayRoot.value);

  centerGroup.append('text')
    .attr('class', 'sunburst-center-label')
    .attr('y', -8)
    .attr('font-size', '14px')
    .attr('font-weight', '600')
    .text(centerName);

  centerGroup.append('text')
    .attr('class', 'sunburst-center-label')
    .attr('y', 12)
    .attr('font-size', '12px')
    .attr('opacity', 0.6)
    .text(centerVol);

  // Click: center goes up, arcs drill down or toggle status
  // Center click
  svg.append('circle')
    .attr('r', radius * 0.15)
    .attr('fill', 'transparent')
    .attr('cursor', drillPath.length > 0 ? 'pointer' : 'default')
    .on('click', () => {
      if (drillPath.length > 0 && onDrill) {
        onDrill(drillPath.slice(0, -1));
      }
    });

  // Arc clicks
  paths.on('click', (event, d) => {
    if (d.depth === 0) return;

    // If it's a leaf (item), select it for detail panel
    const item = d.data.data;
    if (item && onItemSelect) {
      onItemSelect(item);
      return;
    }

    // If it's a group, drill down
    if (d.children && onDrill) {
      onDrill([...drillPath, d.data.name]);
    }
  });

  // Hover
  paths.on('mouseenter', (event, d) => {
    if (d.depth === 0) return;
    const item = d.data.data;
    const name = item ? `${item.icon} ${item.name}` : formatLabel(d.data.name);
    const vol = formatVolume(d.value);
    const meta = item
      ? `${formatLabel(item.tags.room)} · ${formatLabel(item.tags.category)}`
      : `${d.children ? d.children.length + ' items' : ''}`;

    tooltip.innerHTML = `
      <div class="tooltip-name">${esc(name)}</div>
      <div class="tooltip-meta">${meta}</div>
      <div class="tooltip-volume">${vol}</div>
    `;
    tooltip.classList.add('visible');

    // Update center label on hover
    centerGroup.selectAll('text').remove();
    centerGroup.append('text')
      .attr('class', 'sunburst-center-label')
      .attr('y', -8)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(item ? item.name : formatLabel(d.data.name));
    centerGroup.append('text')
      .attr('class', 'sunburst-center-label')
      .attr('y', 12)
      .attr('font-size', '12px')
      .attr('opacity', 0.6)
      .text(vol);

    if (item && onHover) onHover(item.id);
  })
  .on('mousemove', (event) => {
    const rect = container.getBoundingClientRect();
    tooltip.style.left = (event.clientX - rect.left + 12) + 'px';
    tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
  })
  .on('mouseleave', () => {
    tooltip.classList.remove('visible');

    // Restore center label
    centerGroup.selectAll('text').remove();
    centerGroup.append('text')
      .attr('class', 'sunburst-center-label')
      .attr('y', -8)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .text(centerName);
    centerGroup.append('text')
      .attr('class', 'sunburst-center-label')
      .attr('y', 12)
      .attr('font-size', '12px')
      .attr('opacity', 0.6)
      .text(centerVol);

    if (onHover) onHover(null);
  });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
