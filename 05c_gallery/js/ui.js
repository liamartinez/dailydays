// ui.js — View dispatcher
// Routes to landing, stack, or gallery view based on state.view

import { renderLandingView, hideLanding } from './ui-landing.js';
import { renderStackView, hideStack } from './ui-stack.js';
import { renderGalleryView, hideGallery } from './ui-gallery.js';

let currentView = null;

export function renderApp(container, state, onStateChange) {
  const view = state.view || 'landing';

  // Hide views that aren't active
  if (view !== 'gallery') hideGallery();
  if (view !== 'landing') hideLanding();
  if (view !== 'stack') hideStack();

  currentView = view;

  switch (view) {
    case 'landing':
      renderLandingView(container, state, onStateChange);
      break;
    case 'stack':
      renderStackView(container, state, onStateChange);
      break;
    case 'gallery':
      renderGalleryView(container, state, onStateChange);
      break;
  }
}
