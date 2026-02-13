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
