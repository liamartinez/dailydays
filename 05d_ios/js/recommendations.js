// recommendations.js — Data-driven recommendation generators

import * as store from '../../shared/js/store.js';
import { formatLabel } from '../../shared/js/colors.js';

export function generateRecommendations(objects, triageDecisions) {
  const active = objects.filter(obj => {
    const d = triageDecisions[obj.id];
    return !d || d === 'keep';
  });

  const recs = [];

  // 1. Review Unused Belongings
  const unused = active.filter(obj =>
    obj.usageFrequency === 'never' ||
    obj.usageFrequency === 'rarely' ||
    (obj.lastUsed && store.staleness(obj) > 365)
  );
  if (unused.length > 0) {
    const vol = store.totalVolume(unused);
    recs.push({
      id: 'unused',
      icon: '📦',
      title: 'Review Unused Belongings',
      description: `${unused.length} items rarely or never used`,
      savings: `${store.formatVolume(vol)}`,
      action: 'Review',
      ids: unused.map(o => o.id),
    });
  }

  // 2. Donate to Community
  const donatable = active.filter(obj =>
    obj.attachment === 'none' || obj.attachment === 'low'
  );
  if (donatable.length >= 5) {
    const vol = store.totalVolume(donatable);
    recs.push({
      id: 'donate',
      icon: '🤝',
      title: 'Donate to Community',
      description: `${donatable.length} items with low attachment`,
      savings: `${store.formatVolume(vol)}`,
      action: 'Review',
      ids: donatable.map(o => o.id),
    });
  }

  // 3. Your Home: Wrapped
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

  // 4. Spot Redundancies
  const subcatCounts = {};
  active.forEach(obj => {
    const sub = obj.tags.subcategory;
    if (!sub) return;
    if (!subcatCounts[sub]) subcatCounts[sub] = [];
    subcatCounts[sub].push(obj);
  });
  const redundant = Object.entries(subcatCounts)
    .filter(([, items]) => items.length >= 4)
    .sort((a, b) => b[1].length - a[1].length);

  if (redundant.length > 0) {
    const totalRedundant = redundant.reduce((sum, [, items]) => sum + items.length, 0);
    const topSubcat = redundant[0];
    recs.push({
      id: 'redundancies',
      icon: '🔍',
      title: 'Spot Redundancies',
      description: `${totalRedundant} items across ${redundant.length} crowded subcategories \u2022 Top: ${formatLabel(topSubcat[0])} (${topSubcat[1].length})`,
      savings: null,
      action: 'Review',
      ids: redundant.flatMap(([, items]) => items.map(o => o.id)),
    });
  }

  return recs.slice(0, 4);
}
