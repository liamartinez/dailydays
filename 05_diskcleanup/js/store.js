// store.js — Pure-function query engine for object inventory
// No side effects, no DOM. Takes arrays, returns arrays/objects.

// ─── Size derivation ───

const SIZE_THRESHOLDS = [
  { max: 1, label: 'XS' },
  { max: 5, label: 'S' },
  { max: 25, label: 'M' },
  { max: 100, label: 'L' },
  { max: Infinity, label: 'XL' },
];

export function deriveSize(volumeLiters) {
  for (const t of SIZE_THRESHOLDS) {
    if (volumeLiters < t.max) return t.label;
  }
  return 'XL';
}

export function getSizeRange(sizeLabel) {
  const ranges = { XS: [0, 1], S: [1, 5], M: [5, 25], L: [25, 100], XL: [100, Infinity] };
  return ranges[sizeLabel] || [0, Infinity];
}

// ─── Filtering ───

export function filterByTag(objects, tagName, tagValue) {
  return objects.filter(o => o.tags[tagName] === tagValue);
}

export function filterByStatus(objects, status) {
  return objects.filter(o => o.status === status);
}

export function filterByAttachment(objects, level) {
  return objects.filter(o => o.attachment === level);
}

export function filterByUsageFrequency(objects, freq) {
  return objects.filter(o => o.usageFrequency === freq);
}

export function filterByDateRange(objects, field, start, end) {
  const startTime = start ? new Date(start).getTime() : -Infinity;
  const endTime = end ? new Date(end).getTime() : Infinity;
  return objects.filter(o => {
    const val = o[field];
    if (!val) return false;
    const t = new Date(val).getTime();
    return t >= startTime && t <= endTime;
  });
}

export function filterBySizeCategory(objects, size) {
  return objects.filter(o => o.size === size);
}

/**
 * Apply multiple filters at once.
 * filters is an object like:
 *   { room: "kitchen", size: "L", status: "keeping", attachment: "high", usageFrequency: "never" }
 * Tag-based keys (room, category, subcategory) use filterByTag.
 * Special keys (status, attachment, usageFrequency, size) use their dedicated filters.
 */
export function filterMultiple(objects, filters) {
  let result = objects;
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '' || value === 'all') continue;
    switch (key) {
      case 'status':
        result = filterByStatus(result, value);
        break;
      case 'attachment':
        result = filterByAttachment(result, value);
        break;
      case 'usageFrequency':
        result = filterByUsageFrequency(result, value);
        break;
      case 'size':
        result = filterBySizeCategory(result, value);
        break;
      default:
        // Treat as a tag filter (room, category, subcategory, etc.)
        result = filterByTag(result, key, value);
        break;
    }
  }
  return result;
}

// ─── Sorting ───

const ATTACHMENT_ORDER = { none: 0, low: 1, medium: 2, high: 3 };
const USAGE_ORDER = { never: 0, rarely: 1, monthly: 2, weekly: 3, daily: 4 };

export function sortBy(objects, field, direction = 'asc') {
  const dir = direction === 'desc' ? -1 : 1;
  return [...objects].sort((a, b) => {
    let va = resolveField(a, field);
    let vb = resolveField(b, field);

    // Handle nulls
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;

    // Ordinal fields
    if (field === 'attachment') {
      va = ATTACHMENT_ORDER[va] ?? -1;
      vb = ATTACHMENT_ORDER[vb] ?? -1;
    } else if (field === 'usageFrequency') {
      va = USAGE_ORDER[va] ?? -1;
      vb = USAGE_ORDER[vb] ?? -1;
    }

    // Compare
    if (typeof va === 'string' && typeof vb === 'string') {
      return dir * va.localeCompare(vb);
    }
    return dir * (va < vb ? -1 : va > vb ? 1 : 0);
  });
}

function resolveField(obj, field) {
  // Check top-level fields first
  if (field in obj) return obj[field];
  // Check inside tags
  if (obj.tags && field in obj.tags) return obj.tags[field];
  return undefined;
}

// ─── Grouping ───

export function groupByTag(objects, tagName) {
  const groups = {};
  for (const obj of objects) {
    const key = obj.tags[tagName] || 'uncategorized';
    if (!groups[key]) groups[key] = [];
    groups[key].push(obj);
  }
  return groups;
}

export function groupBySize(objects) {
  return groupByField(objects, 'size');
}

export function groupByAttachment(objects) {
  return groupByField(objects, 'attachment');
}

export function groupByUsageFrequency(objects) {
  return groupByField(objects, 'usageFrequency');
}

export function groupByStatus(objects) {
  return groupByField(objects, 'status');
}

function groupByField(objects, field) {
  const groups = {};
  for (const obj of objects) {
    const key = obj[field] || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(obj);
  }
  return groups;
}

// ─── Aggregation ───

export function totalVolume(objects) {
  return objects.reduce((sum, o) => sum + (o.volume_liters || 0), 0);
}

export function countByTag(objects, tagName) {
  const counts = {};
  for (const obj of objects) {
    const key = obj.tags[tagName] || 'uncategorized';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function volumeByTag(objects, tagName) {
  const volumes = {};
  for (const obj of objects) {
    const key = obj.tags[tagName] || 'uncategorized';
    volumes[key] = (volumes[key] || 0) + (obj.volume_liters || 0);
  }
  return volumes;
}

export function countBySize(objects) {
  return countByField(objects, 'size');
}

export function countByField(objects, field) {
  const counts = {};
  for (const obj of objects) {
    const key = obj[field] || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function statusSummary(objects) {
  return {
    keeping: objects.filter(o => o.status === 'keeping').length,
    considering: objects.filter(o => o.status === 'considering').length,
    removed: objects.filter(o => o.status === 'removed').length,
  };
}

export function potentialSpaceSaved(objects) {
  return objects
    .filter(o => o.status === 'considering')
    .reduce((sum, o) => sum + (o.volume_liters || 0), 0);
}

// ─── Staleness ───

export function staleness(object) {
  if (!object.lastUsed) return Infinity;
  const now = Date.now();
  const last = new Date(object.lastUsed).getTime();
  return Math.floor((now - last) / (1000 * 60 * 60 * 24));
}

export function staleObjects(objects, daysThreshold = 365) {
  return objects.filter(o => staleness(o) >= daysThreshold);
}

// ─── Utility ───

export function formatVolume(liters) {
  if (liters >= 1000) return `${(liters / 1000).toFixed(1)} m³`;
  return `${Math.round(liters)} L`;
}

export function uniqueTagValues(objects, tagName) {
  const set = new Set();
  for (const obj of objects) {
    if (obj.tags[tagName]) set.add(obj.tags[tagName]);
  }
  return [...set].sort();
}
