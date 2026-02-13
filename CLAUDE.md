# Dailydays — Repo Architecture

A collection of daily creative coding experiments, many built on the same household inventory dataset.

## Directory Structure

```
Dailydays/
  shared/           ← Single source of truth for data + query engine
    js/data.js       (470 items: RAW array, TAG_DEFINITIONS, OBJECTS expansion)
    js/store.js      (pure functions: filter, sort, group, aggregate, format)
    js/colors.js     (ROOM_COLORS palette, formatLabel, pluralize)
    js/images.js     (imageUrl helper, createPhotoEl for AI-generated photos)
    css/reset.css    (minimal CSS reset)
    css/tokens.css   (CSS custom properties: colors, fonts, radii)
    images/          (AI-generated item photos: {id}.webp + {id}-thumb.webp)
    CLAUDE.md        (data generation guide — RAW schema, personas, rules)

  scripts/           ← Photo generation tooling
    generate-photos.py  (DALL-E 3 batch generator)
    prompt_builder.py   (prompt construction from item metadata)

  _template/         ← Copy this to start a new experiment
    index.html, css/theme.css, js/app.js, js/ui.js

  05a_list/          ← List-based inventory view (with thumbnails)
  05b_viz/           ← WinDirStat treemap + sunburst visualization (with detail photos)
  05c_gallery/       ← Photo gallery with room-grouped grid + lightbox
  05d_*/             ← Next experiment...

  server.py          ← Threaded HTTP server (run from repo root)
  index.html         ← Landing page with links to all projects
```

## Conventions

### Imports
All projects import shared code via relative paths:
```js
import { OBJECTS, TAG_DEFINITIONS } from '../../shared/js/data.js';
import * as store from '../../shared/js/store.js';
import { ROOM_COLORS, formatLabel } from '../../shared/js/colors.js';
```

CSS tokens via `@import`:
```css
@import '../../shared/css/tokens.css';
```

### D3.js
Loaded via CDN `<script>` tag before the module script. Access as `window.d3`.

### Cache Busting
Append `?v=N` to import paths when iterating locally. Strip before committing.

### State Pattern
Every project uses the same app.js pattern:
```js
const state = { objects: OBJECTS, filters: {}, sortField: '...', sortDirection: 'desc' };
function init() {
  function render() {
    renderApp(container, state, (changes) => {
      Object.assign(state, changes);
      render();
    });
  }
  render();
}
init();
```

### Naming
- `05{letter}_{shortname}` — letter auto-increments, short descriptive name
- The `05` prefix anchors the declutter dataset family

### New Experiment
Copy `_template/` → `05{x}_{name}/`, replace `{{TITLE}}`, add to `index.html`, start coding `ui.js`.
Or use `/new-experiment {name}`.

## Local Dev
```bash
python3 server.py        # serves on http://localhost:8766
```

## Item Photos

AI-generated photos of each inventory item, stored in `shared/images/`.

### Image Paths
Image URL is deterministic from item ID — no mapping needed:
```js
import { imageUrl } from '../../shared/js/images.js';
imageUrl('obj-001')       // '../../shared/images/obj-001.webp'      (512×512)
imageUrl('obj-001', true) // '../../shared/images/obj-001-thumb.webp' (128×128)
```

### Generating Photos
```bash
cd scripts
pip3 install openai Pillow    # one-time setup
export OPENAI_API_KEY=sk-...

python3 generate-photos.py --dry-run          # preview prompts
python3 generate-photos.py --sample 25        # generate 25 diverse items (~$1)
python3 generate-photos.py --room kitchen     # generate for a room
python3 generate-photos.py --ids obj-001,obj-005  # specific items
python3 generate-photos.py                    # all remaining items (~$19)
```

### Graceful Degradation
All views use `img.onerror` to fall back to emoji icons when a photo hasn't been generated yet. The app works with 0, 25, or all 470 images.

## Data Generation
See `shared/CLAUDE.md` for the RAW schema and persona generation guide.
To generate a new dataset: "Generate a declutter database for: [persona description]"
