// images.js — Shared image URL helpers for AI-generated item photos
// Images are stored in shared/images/ as {id}.webp (512x512) and {id}-thumb.webp (128x128).
// If an image doesn't exist, graceful fallback via onerror.

// Derive base from this module's own URL so paths work on both
// localhost (root = repo) and GitHub Pages (root = /dailydays/).
const BASE = new URL('../images/', import.meta.url).href;

/**
 * Get the URL for an item's photo.
 * @param {string} id - Item ID (e.g. "obj-001")
 * @param {boolean} thumb - If true, returns the 128x128 thumbnail path
 * @returns {string} Relative URL to the image
 */
export function imageUrl(id, thumb = false) {
  return `${BASE}${id}${thumb ? '-thumb' : ''}.webp`;
}

/**
 * Create an <img> element for an item's photo with lazy loading and graceful fallback.
 * @param {object} item - Item object with .id and .name
 * @param {boolean} thumb - If true, loads the thumbnail version
 * @param {string} className - CSS class(es) for the img element
 * @returns {HTMLImageElement}
 */
export function createPhotoEl(item, thumb = false, className = '') {
  const img = document.createElement('img');
  img.src = imageUrl(item.id, thumb);
  img.alt = item.name;
  if (className) img.className = className;
  img.loading = 'lazy';
  img.onerror = function () { this.style.display = 'none'; };
  return img;
}
