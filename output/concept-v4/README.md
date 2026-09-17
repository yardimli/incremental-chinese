# Chinese incremental game

Open index.html through a local HTTP server. It starts directly in the tap game. document.html describes the progression and balancing rules.

Run from the repository: `python -m http.server 8765 --bind 127.0.0.1`

Play: http://127.0.0.1:8765/output/concept-v4/index.html

## Files

- engine.mjs: pure progression, rewards, income, upgrade and prestige transitions.
- shared.js: shared UI, browser save transactions and screen routing.
- lessons/*.json: six pair sets (10, 10, 10, 15, 15, 15 pairs), plus 30 sentences for a ten-sentence run.
- screens/*.html: standalone screen components; future stages route to current saved progress.
- shared.css, game-theme.css, gameplay.css: layout and jade/parchment game styling.
- assets/jade-valley.png: one shared generated background; cards have no custom illustrations.
- tests/engine.test.mjs: content and full-progression tests.

Run tests: `node --test output/concept-v4/tests/engine.test.mjs`

State is saved locally under chinese-game-v1. No old visual-demo state is imported. Automatic and offline production are zero until a set is claimed. Browser Web Locks serialize income and actions across same-origin tabs where supported. The local server must be running to load JSON and modules. This is a playable local prototype with initial, unbalanced economy values, not a deployed iOS build.
