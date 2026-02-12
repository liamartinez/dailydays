// colors.js — Shared room color palette and formatting helpers
// Extracted to avoid circular imports between ui.js ↔ storagebar.js/treemap.js/sunburst.js

export const ROOM_COLORS = {
  kitchen: '#FF9F0A',
  bedroom: '#AF52DE',
  bathroom: '#5AC8FA',
  living_room: '#007AFF',
  garage: '#FFD60A',
  closet: '#FF2D55',
  office: '#30D158',
  dining_room: '#FF453A',
  laundry: '#64D2FF',
  storage: '#8E8E93',
  entryway: '#AC8E68',
};

export function formatLabel(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function pluralize(word) {
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) return word + 'es';
  return word + 's';
}
