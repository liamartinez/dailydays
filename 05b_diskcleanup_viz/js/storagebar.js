// storagebar.js — macOS/Windows-style horizontal storage bar
// Pure DOM, no D3 needed.

import { volumeByTag, totalVolume, statusSummary, potentialSpaceSaved, formatVolume, countByTag } from './store.js?v=4';
import { ROOM_COLORS, formatLabel } from './colors.js?v=4';

export function renderStorageBar(container, objects, { onSegmentClick, drillPath }) {
  container.innerHTML = '';

  const volumes = volumeByTag(objects, 'room');
  const counts = countByTag(objects, 'room');
  const total = totalVolume(objects);
  const summary = statusSummary(objects);
  const saved = potentialSpaceSaved(objects);
  const activeRoom = drillPath.length > 0 ? drillPath[0] : null;

  // Bar
  const bar = document.createElement('div');
  bar.className = 'storage-bar';

  const sortedRooms = Object.entries(volumes).sort((a, b) => b[1] - a[1]);

  for (let idx = 0; idx < sortedRooms.length; idx++) {
    const [room, vol] = sortedRooms[idx];
    const pct = (vol / total) * 100;
    const seg = document.createElement('div');
    seg.className = 'storage-segment';
    if (activeRoom && activeRoom !== room) seg.classList.add('dimmed');
    seg.style.flex = `${vol} 0 0%`;
    seg.style.background = ROOM_COLORS[room] || '#8E8E93';
    // Add separator between segments
    if (idx > 0) seg.style.borderLeft = '1px solid rgba(0,0,0,0.3)';
    seg.title = `${formatLabel(room)}: ${formatVolume(vol)} (${counts[room] || 0} items)`;

    // Show percentage + room name on segments large enough
    seg.style.position = 'relative';
    seg.style.overflow = 'hidden';
    if (pct > 5) {
      const label = document.createElement('span');
      label.className = 'segment-label';
      label.textContent = `${pct.toFixed(0)}%  ${formatLabel(room).toUpperCase()}`;
      seg.appendChild(label);
    }

    seg.addEventListener('click', () => onSegmentClick(room));
    bar.appendChild(seg);
  }

  container.appendChild(bar);

  // Stats row
  const stats = document.createElement('div');
  stats.className = 'storage-stats';

  const totalStat = document.createElement('span');
  totalStat.innerHTML = `<span class="stat-value">${formatVolume(total)}</span> total`;
  stats.appendChild(totalStat);

  if (summary.considering > 0) {
    const consid = document.createElement('span');
    consid.innerHTML = `<span class="stat-value">${summary.considering}</span> considering (${formatVolume(saved)})`;
    stats.appendChild(consid);
  }

  if (summary.removed > 0) {
    const removed = document.createElement('span');
    removed.innerHTML = `<span class="stat-value">${summary.removed}</span> removed`;
    stats.appendChild(removed);
  }

  const countStat = document.createElement('span');
  countStat.innerHTML = `<span class="stat-value">${objects.length}</span> items`;
  stats.appendChild(countStat);

  container.appendChild(stats);
}
