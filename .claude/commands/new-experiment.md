# /new-experiment — Scaffold a new daily experiment

When invoked with a name (e.g., `/new-experiment timeline`):

1. List existing `05*` directories to determine the next letter suffix (a, b, c, ...).
2. Copy `_template/` to `05{next_letter}_{name}/`.
3. In the new `index.html`, replace `{{TITLE}}` with a human-readable title derived from the name.
4. Add a new `<li>` entry to the repo-root `index.html` linking to the new project.
5. Report the new project path and confirm it's ready.

If no name argument is provided, ask the user what to call the experiment.
