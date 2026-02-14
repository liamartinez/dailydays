// recommendations.js — Data-driven recommendation generators

import * as store from '../../shared/js/store.js';
import { formatLabel } from '../../shared/js/colors.js';

// ─── Donation Needs (Seattle area) ───

const DONATION_NEEDS = [
  { id: 'winter-clothing', label: 'Winter Clothing', org: "DESC / Mary's Place", icon: '🧥',
    match: (item) => item.tags.category === 'clothing' && ['outerwear','accessories','shoes'].includes(item.tags.subcategory) },
  { id: 'general-clothing', label: 'Clothing', org: 'Goodwill / Value Village', icon: '👕',
    match: (item) => item.tags.category === 'clothing' && !['outerwear','accessories','shoes'].includes(item.tags.subcategory) },
  { id: 'kitchenware', label: 'Kitchen Items', org: 'Goodwill / Habitat ReStore', icon: '🍽️',
    match: (item) => item.tags.category === 'kitchenware' },
  { id: 'furniture', label: 'Furniture', org: 'Habitat for Humanity ReStore', icon: '🪑',
    match: (item) => item.tags.category === 'furniture' },
  { id: 'bedding-linens', label: 'Bedding & Linens', org: 'DESC / Union Gospel Mission', icon: '🛏️',
    match: (item) => item.tags.category === 'linens' },
  { id: 'baby-toys', label: 'Toys & Baby Items', org: 'Treehouse / WestSide Baby', icon: '🧸',
    match: (item) => item.tags.category === 'toys' },
  { id: 'electronics', label: 'Electronics', org: 'Interconnection / FreeGeek', icon: '💻',
    match: (item) => item.tags.category === 'electronics' },
  { id: 'books', label: 'Books', org: 'Friends of SPL / Little Free Library', icon: '📚',
    match: (item) => item.tags.category === 'books' },
  { id: 'sports', label: 'Sports Equipment', org: 'Outdoors for All', icon: '⚽',
    match: (item) => item.tags.category === 'sports' },
  { id: 'appliances', label: 'Small Appliances', org: 'Habitat ReStore / Goodwill', icon: '🔌',
    match: (item) => item.tags.category === 'appliances' && item.tags.subcategory !== 'major' },
  { id: 'decor', label: 'Home Decor', org: 'Goodwill / Habitat ReStore', icon: '🖼️',
    match: (item) => item.tags.category === 'decor' },
];

// ─── Donation Reason ───

export function getDonationReason(item, subcatCounts) {
  const reasons = [];
  if (item.usageFrequency === 'never') reasons.push('Never used');
  else if (item.usageFrequency === 'rarely') reasons.push('Rarely used');
  if (item.attachment === 'none') reasons.push('No attachment');
  else if (item.attachment === 'low') reasons.push('Low attachment');
  if (item.lastUsed && store.staleness(item) > 365) reasons.push('Unused 1yr+');
  const sub = item.tags.subcategory;
  if (sub && subcatCounts[sub] && subcatCounts[sub] >= 4) reasons.push(`${subcatCounts[sub]} similar items`);
  return reasons.slice(0, 3).join(' · ') || 'Low priority item';
}

// ─── Wrapped toggle ───
const SHOW_WRAPPED = false;

export function generateRecommendations(objects, triageDecisions) {
  const active = objects.filter(obj => {
    const d = triageDecisions[obj.id];
    return !d || d === 'keep';
  });

  const recs = [];

  // Subcategory counts (used by multiple recs)
  const subcatCounts = {};
  active.forEach(obj => {
    const sub = obj.tags.subcategory;
    if (!sub) return;
    if (!subcatCounts[sub]) subcatCounts[sub] = 0;
    subcatCounts[sub]++;
  });

  // 1. Review Unused Belongings
  const unused = active.filter(obj =>
    obj.usageFrequency === 'never' ||
    obj.usageFrequency === 'rarely' ||
    (obj.lastUsed && store.staleness(obj) > 365)
  );
  if (unused.length > 0) {
    const vol = store.totalVolume(unused);

    // Staleness-based sub-grouping
    const STALENESS_BUCKETS = [
      { id: '3plus', label: 'Untouched 3+ Years', icon: '🕸️', minDays: 1095 },
      { id: '1to3', label: 'Untouched 1-3 Years', icon: '📦', minDays: 365, maxDays: 1095 },
      { id: 'under1', label: 'Untouched Under 1 Year', icon: '🕐', minDays: 0, maxDays: 365 },
      { id: 'rarely', label: 'Rarely Used', icon: '💤' },
    ];

    const assignedIds = new Set();
    const unusedGroups = [];

    for (const bucket of STALENESS_BUCKETS) {
      const matches = unused.filter(item => {
        if (assignedIds.has(item.id)) return false;
        if (bucket.id === 'rarely') {
          return item.usageFrequency === 'rarely';
        }
        if (item.usageFrequency !== 'never' && !(item.lastUsed && store.staleness(item) > 365)) return false;
        const days = item.lastUsed ? store.staleness(item) : 9999;
        if (bucket.maxDays !== undefined) {
          return days >= bucket.minDays && days < bucket.maxDays;
        }
        return days >= bucket.minDays;
      });

      if (matches.length > 0) {
        matches.forEach(m => assignedIds.add(m.id));
        unusedGroups.push({
          id: bucket.id,
          label: bucket.label,
          icon: bucket.icon,
          items: matches,
          count: matches.length,
          volume: store.totalVolume(matches),
          ids: matches.map(o => o.id),
        });
      }
    }

    recs.push({
      id: 'unused',
      icon: '📦',
      title: 'Review Unused Belongings',
      description: `${unused.length} items rarely or never used`,
      savings: `${store.formatVolume(vol)}`,
      action: 'Review',
      ids: unused.map(o => o.id),
      unusedGroups,
    });
  }

  // 2. Donate to Community (smart matching)
  const donationGroups = [];
  const donatedItemIds = new Set();

  for (const need of DONATION_NEEDS) {
    const matches = active.filter(item => {
      if (donatedItemIds.has(item.id)) return false;
      if (!need.match(item)) return false;
      // Must meet at least one "should donate" criterion
      const isLowAttachment = item.attachment === 'none' || item.attachment === 'low';
      const isRarelyUsed = item.usageFrequency === 'rarely' || item.usageFrequency === 'never';
      const isStale = item.lastUsed && store.staleness(item) > 365;
      const isRedundant = item.tags.subcategory && subcatCounts[item.tags.subcategory] >= 4;
      return isLowAttachment || isRarelyUsed || isStale || isRedundant;
    });

    if (matches.length > 0) {
      matches.forEach(m => donatedItemIds.add(m.id));
      donationGroups.push({
        id: need.id,
        label: need.label,
        org: need.org,
        icon: need.icon,
        items: matches,
        count: matches.length,
        volume: store.totalVolume(matches),
      });
    }
  }

  if (donatedItemIds.size >= 3) {
    const allDonationItems = donationGroups.flatMap(g => g.items);
    const vol = store.totalVolume(allDonationItems);
    recs.push({
      id: 'donate',
      icon: '🤝',
      title: 'Donate to Community',
      description: `${donatedItemIds.size} items across ${donationGroups.length} categories`,
      savings: `${store.formatVolume(vol)}`,
      action: 'Review',
      ids: [...donatedItemIds],
      donationGroups,
    });
  }

  // 3. Your Home: Wrapped (archived)
  if (SHOW_WRAPPED) {
    const oldest = active.reduce((best, obj) => {
      if (!obj.dateObtained) return best;
      if (!best || new Date(obj.dateObtained) < new Date(best.dateObtained)) return obj;
      return best;
    }, null);

    const roomVolumes = store.volumeByTag(active, 'room');
    const topRoom = Object.entries(roomVolumes).sort((a, b) => b[1] - a[1])[0];
    const neverUsed = active.filter(o => o.usageFrequency === 'never' || o.usageFrequency === 'rarely');
    const pctRarely = Math.round((neverUsed.length / active.length) * 100);

    recs.push({
      id: 'wrapped',
      icon: '✨',
      title: 'Your Home: Wrapped',
      description: `${active.length} items \u2022 Since ${oldest ? new Date(oldest.dateObtained).getFullYear() : '?'} \u2022 ${pctRarely}% rarely used`,
      savings: null,
      action: 'View',
      wrapped: {
        totalItems: active.length,
        totalVolume: store.totalVolume(active),
        oldestItem: oldest,
        mostClutteredRoom: topRoom ? { name: topRoom[0], volume: topRoom[1] } : null,
        pctRarelyUsed: pctRarely,
        neverUsedCount: neverUsed.length,
      },
    });
  }

  // 4. Spot Redundancies (grouped)
  const subcatItems = {};
  active.forEach(obj => {
    const sub = obj.tags.subcategory;
    if (!sub) return;
    if (!subcatItems[sub]) subcatItems[sub] = [];
    subcatItems[sub].push(obj);
  });
  const redundant = Object.entries(subcatItems)
    .filter(([, items]) => items.length >= 4)
    .sort((a, b) => b[1].length - a[1].length);

  if (redundant.length > 0) {
    const totalRedundant = redundant.reduce((sum, [, items]) => sum + items.length, 0);
    const topSubcat = redundant[0];

    const redundancyGroups = redundant.map(([subcategory, items]) => ({
      subcategory,
      label: formatLabel(subcategory),
      count: items.length,
      volume: store.totalVolume(items),
      ids: items.map(o => o.id),
    }));

    recs.push({
      id: 'redundancies',
      icon: '🔍',
      title: 'Spot Redundancies',
      description: `${totalRedundant} items across ${redundant.length} crowded subcategories \u2022 Top: ${formatLabel(topSubcat[0])} (${topSubcat[1].length})`,
      savings: null,
      action: 'Review',
      ids: redundant.flatMap(([, items]) => items.map(o => o.id)),
      redundancyGroups,
    });
  }

  return recs.slice(0, 4);
}
