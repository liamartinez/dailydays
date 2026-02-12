# Dailydays — Repo Architecture

A collection of daily creative coding experiments, many built on the same household inventory dataset.

## Directory Structure

```
Dailydays/
  shared/           ← Single source of truth for data + query engine
    js/data.js       (470 items: RAW array, TAG_DEFINITIONS, OBJECTS expansion)
    js/store.js      (pure functions: filter, sort, group, aggregate, format)
    js/colors.js     (ROOM_COLORS palette, formatLabel, pluralize)
    css/reset.css    (minimal CSS reset)
    css/tokens.css   (CSS custom properties: colors, fonts, radii)
    CLAUDE.md        (data generation guide — RAW schema, personas, rules)

  _template/         ← Copy this to start a new experiment
    index.html, css/theme.css, js/app.js, js/ui.js

  05a_list/          ← List-based inventory view
  05b_viz/           ← WinDirStat treemap + sunburst visualization
  05c_*/             ← Next experiment...

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

## Data Generation
See `shared/CLAUDE.md` for the RAW schema and persona generation guide.
To generate a new dataset: "Generate a declutter database for: [persona description]"
