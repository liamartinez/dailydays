// tags.js — Derived exploration tags for household inventory
// Pure functions. Each tag has a match function that tests an item.

import { staleness } from '../../shared/js/store.js';

const USAGE_RANK = { never: 0, rarely: 1, monthly: 2, weekly: 3, daily: 4 };
const ATTACH_RANK = { none: 0, low: 1, medium: 2, high: 3 };

function age(item) {
  if (!item.dateObtained) return 0;
  return (Date.now() - new Date(item.dateObtained).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

function descMatch(item, patterns) {
  const text = (item.description || '').toLowerCase();
  return patterns.some(p => text.includes(p));
}

export const TAG_DEFS = [
  // ─── Honesty Tags ───
  {
    id: 'dust-collector',
    label: 'Dust Collectors',
    subtitle: 'You know what you did',
    match: item => item.usageFrequency === 'never',
  },
  {
    id: 'guilt-trip',
    label: 'Guilt Trips',
    subtitle: 'Love it, never touch it',
    match: item => ATTACH_RANK[item.attachment] >= 3 && USAGE_RANK[item.usageFrequency] <= 1,
  },
  {
    id: 'daily-workhorse',
    label: 'Daily Workhorses',
    subtitle: 'They never get thanked',
    match: item => item.usageFrequency === 'daily' && ATTACH_RANK[item.attachment] <= 1,
  },
  {
    id: 'aspirational-self',
    label: 'Aspirational Selves',
    subtitle: 'The person you wish you were',
    match: item =>
      ['sports', 'books'].includes(item.tags.category) &&
      USAGE_RANK[item.usageFrequency] <= 1,
  },
  {
    id: 'just-in-case',
    label: 'Just In Cases',
    subtitle: 'Someday never comes',
    match: item => item.usageFrequency === 'never' && staleness(item) > 365,
  },
  {
    id: 'the-backup',
    label: 'The Backups',
    subtitle: 'Just in case the first one breaks',
    match: item => descMatch(item, ['backup', 'extra', 'spare', 'duplicate', 'old ', 'replaced']),
  },

  // ─── Object Personality ───
  {
    id: 'loyal-companion',
    label: 'Loyal Companions',
    subtitle: 'Your actual favorites',
    match: item =>
      item.usageFrequency === 'daily' &&
      ATTACH_RANK[item.attachment] >= 2 &&
      age(item) > 3,
  },
  {
    id: 'forgotten-friend',
    label: 'Forgotten Friends',
    subtitle: 'You love it in theory',
    match: item =>
      ATTACH_RANK[item.attachment] >= 3 &&
      USAGE_RANK[item.usageFrequency] <= 1 &&
      age(item) > 5,
  },
  {
    id: 'new-flame',
    label: 'New Flames',
    subtitle: 'Give it six months',
    match: item => age(item) < 0.5 && USAGE_RANK[item.usageFrequency] >= 3,
  },
  {
    id: 'quiet-workhorse',
    label: 'Quiet Workhorses',
    subtitle: 'You\'d only notice if they vanished',
    match: item =>
      item.usageFrequency === 'daily' &&
      item.attachment === 'none' &&
      age(item) > 2,
  },
  {
    id: 'identity-prop',
    label: 'Identity Props',
    subtitle: 'More about you than you think',
    match: item =>
      ['clothing', 'books', 'media', 'decor'].includes(item.tags.category) &&
      USAGE_RANK[item.usageFrequency] <= 1 &&
      ATTACH_RANK[item.attachment] >= 2,
  },
  {
    id: 'ghost',
    label: 'Ghosts',
    subtitle: 'Why is this still here?',
    match: item =>
      item.usageFrequency === 'never' &&
      ATTACH_RANK[item.attachment] <= 1 &&
      staleness(item) > 365,
  },

  // ─── Life Archaeology ───
  {
    id: 'pandemic-purchase',
    label: 'Pandemic Purchases',
    subtitle: 'Who you thought you\'d become',
    match: item => {
      if (!item.dateObtained) return false;
      const d = new Date(item.dateObtained);
      return d >= new Date('2020-03-01') && d <= new Date('2021-06-30');
    },
  },
  {
    id: 'inherited',
    label: 'Inherited',
    subtitle: 'Given, not chosen',
    match: item => descMatch(item, ['grandma', 'inherited', 'family', 'heirloom', 'passed down', 'from mom', 'from dad', 'grandmother']),
  },
  {
    id: 'decade-club',
    label: 'Decade Club',
    subtitle: 'Still here. Still yours.',
    match: item => age(item) > 10,
  },
];

/** Compute all matching tag IDs for an item */
export function computeTags(item) {
  return TAG_DEFS.filter(t => t.match(item)).map(t => t.id);
}

/** Get tag metadata by ID */
export function getTagDef(id) {
  return TAG_DEFS.find(t => t.id === id);
}

/** Compute tag → count mapping for a set of items */
export function tagCounts(items) {
  const counts = {};
  for (const def of TAG_DEFS) {
    counts[def.id] = 0;
  }
  for (const item of items) {
    for (const def of TAG_DEFS) {
      if (def.match(item)) counts[def.id]++;
    }
  }
  return counts;
}
