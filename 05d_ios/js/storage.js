// storage.js — Storage bar calculation and category color mapping

import { ROOM_COLORS, formatLabel } from '../../shared/js/colors.js';
import * as store from '../../shared/js/store.js';

export const CATEGORY_COLORS = {
  appliances:  '#FF9F0A',
  clothing:    '#FF2D55',
  furniture:   '#007AFF',
  electronics: '#5856D6',
  kitchenware: '#FF9500',
  books:       '#BF5AF2',
  decor:       '#AF52DE',
  tools:       '#FFD60A',
  food:        '#30D158',
  toiletries:  '#5AC8FA',
  linens:      '#64D2FF',
  toys:        '#FF6482',
  sports:      '#34C759',
  media:       '#FF375F',
  gifts:       '#AC8E68',
  supplies:    '#8E8E93',
  seasonal:    '#FF453A',
};

export function getColor(groupBy, key) {
  if (groupBy === 'room') return ROOM_COLORS[key] || '#8E8E93';
  return CATEGORY_COLORS[key] || '#8E8E93';
}

// ─── Per-room capacity estimates (liters) ───
// Realistic storage capacities for each room in a typical Seattle home.
// A room's capacity = total shelf/floor/cabinet space that could hold items.
export const ROOM_CAPACITIES = {
  living_room:  2500,   // large room: shelves, TV stand, under sofa
  kitchen:      2200,   // cabinets, pantry, counters, fridge space
  bedroom:      1800,   // closet, dresser, under bed, nightstands
  storage:      1000,   // dedicated storage room / large closets
  dining_room:  1000,   // hutch, sideboard, under table
  laundry:       800,   // shelves, cabinets above washer/dryer
  garage:       3000,   // largest raw space: shelves, floor, overhead
  office:        800,   // desk, bookshelves, file cabinet
  closet:        500,   // hall/coat closet — compact
  bathroom:      200,   // medicine cabinet, under-sink, shelves
  entryway:      200,   // shoe rack, coat hooks, small bench
};

export function getRoomCapacity(room) {
  return ROOM_CAPACITIES[room] || 1000;
}

export function calculateStorageBar(objects, triageDecisions, groupBy, totalCapacity) {
  const active = objects.filter(obj => {
    const d = triageDecisions[obj.id];
    return !d || d === 'keep';
  });

  const field = groupBy === 'room' ? 'room' : 'category';
  const volumeMap = store.volumeByTag(active, field);
  const usedVolume = store.totalVolume(active);

  const segments = Object.entries(volumeMap)
    .map(([group, volume]) => ({
      group,
      volume,
      percentage: (volume / totalCapacity) * 100,
      color: getColor(groupBy, group),
      label: formatLabel(group),
    }))
    .sort((a, b) => b.volume - a.volume);

  return { segments, usedVolume, totalCapacity };
}

export function calculateDrillStorageBar(objects, triageDecisions, drillTarget, totalCapacity) {
  // Filter to active items (not donated/tossed)
  const active = objects.filter(obj => {
    const d = triageDecisions[obj.id];
    return !d || d === 'keep';
  });

  // Filter to items matching drillTarget's room or category
  const field = drillTarget.type === 'room' ? 'room' : 'category';
  const groupItems = active.filter(obj => obj.tags[field] === drillTarget.value);
  const groupVolume = store.totalVolume(groupItems);

  // Use per-room capacity when drilling into a room, otherwise use total
  const barCapacity = drillTarget.type === 'room'
    ? getRoomCapacity(drillTarget.value)
    : totalCapacity;

  // Sub-segment by the opposite axis
  const subField = drillTarget.type === 'room' ? 'category' : 'room';
  const volumeMap = store.volumeByTag(groupItems, subField);

  const segments = Object.entries(volumeMap)
    .map(([group, volume]) => ({
      group,
      volume,
      percentage: (volume / barCapacity) * 100,
      color: getColor(subField === 'room' ? 'room' : 'category', group),
      label: formatLabel(group),
    }))
    .sort((a, b) => b.volume - a.volume);

  // Gray remainder
  const remainingPercentage = ((barCapacity - groupVolume) / barCapacity) * 100;

  return {
    segments,
    groupVolume,
    totalCapacity: barCapacity,
    groupLabel: drillTarget.label,
    remainingPercentage: Math.max(0, remainingPercentage),
    subField,
  };
}

// ─── Subcategory color generator ───

function hexToHSL(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * color).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function subcatColor(baseHex, index, total) {
  const [h, s, l] = hexToHSL(baseHex);
  if (total <= 1) return baseHex;
  // Spread lightness from 35% to 70%, keeping hue and saturation
  const step = 35 / (total - 1);
  const newL = 35 + index * step;
  return hslToHex(h, Math.min(s, 85), newL);
}

// ─── Intersection Storage Bar (room + category → subcategory) ───

export function calculateIntersectionStorageBar(objects, triageDecisions, drillTarget, totalCapacity) {
  const active = objects.filter(obj => {
    const d = triageDecisions[obj.id];
    return !d || d === 'keep';
  });

  const items = active.filter(obj =>
    obj.tags.room === drillTarget.room && obj.tags.category === drillTarget.category
  );
  const groupVolume = store.totalVolume(items);
  const volumeMap = store.volumeByTag(items, 'subcategory');

  // Use room capacity as the denominator so intersections look proportional
  const barCapacity = getRoomCapacity(drillTarget.room);

  const subcatKeys = Object.keys(volumeMap).sort((a, b) => volumeMap[b] - volumeMap[a]);
  const segments = subcatKeys.map((group, i) => ({
    group,
    volume: volumeMap[group],
    percentage: (volumeMap[group] / barCapacity) * 100,
    color: subcatColor(drillTarget.color || '#8E8E93', i, subcatKeys.length),
    label: formatLabel(group),
  }));

  const remainingPercentage = ((barCapacity - groupVolume) / barCapacity) * 100;

  return {
    segments,
    groupVolume,
    totalCapacity: barCapacity,
    groupLabel: drillTarget.label,
    remainingPercentage: Math.max(0, remainingPercentage),
    subField: 'subcategory',
  };
}

export function formatRelativeTime(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Recently';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
