# Game v1 — Chinese village

Run `python -m http.server 8765 --bind 127.0.0.1` from the repository, then open http://127.0.0.1:8765/game-v1/index.html.
Desktop keeps a 393 × 852 CSS-pixel canvas; phones fill the available viewport. Smaller viewports scale to fit.

## Playable systems

Journey gates use total buildings owned, completed research and simultaneous resource stockpiles. Every purchased copy counts, including supply buildings and warehouses. Advancing does not consume resources. See [PROGRESSION.md](PROGRESSION.md) for every level's requirements; the runtime source is `data/progression.json`.

- Battle targets, five-pair matching boards and sentence ordering retain the concept-v4 interactions.
- Memory has six bilingual pairs per board in a 3 × 4 grid, paginates larger sets, saves flipped/matched state, and awards coins once per pair and board. Replays are available from Play home and Sets.
- Four bottom tabs: Play, Sets, Village and Tech. Prestige lives on Play home.
- 25 core vocabulary files cover the mapped classic HSK 1/2 vocabulary; two resource stages introduce five game resources. Eight sentence stages select ten prompts from pools of at least thirty. The full 76-pattern grammar mapping remains a design reference; not all of its stages are implemented here.
- 56 repeatable buildings, 50 research nodes, three construction resources, two production-only research resources, material exchange, unlimited building counts, storage, dependencies, installments and village advancement gates.
- Prestige resets the village and active journey, preserves collection history/settings, and increases active earnings. Offline production settles once, capped at eight hours and storage. Passive coins are limited by recent active earnings.

## Structure

| Path | Responsibility |
| --- | --- |
| `lessons/index.json` | Ordered campaign manifest |
| `lessons/levels/*.json` | One language stage per file, with audio references |
| `data/set-titles.json` | Content-based Chinese set names, pinyin and English titles |
| `data/progression.json` | Reward curve, memory size, repeat costs, gate thresholds |
| `data/buildings.json` | Building recipes, production, effects and unlocks |
| `data/research.json` | Technology costs and prerequisite chains |
| `data/resources.json` | Resource identity, storage and exchange rules |
| `modes/battle.js`, `matching.js`, `order.js`, `bonus.js`, `memory.js` | Separate game-mode renderers and interactions |
| `modes/memory-state.mjs` | Pure saved-board transitions |
| `systems/village.mjs`, `technology.mjs` | Production, purchases, research and prerequisites |
| `ui/village.js`, `technology.js` | Village and tech screens |
| `engine.mjs` | Main campaign transitions and awards |
| `shared.js` | Shell, collection/reward/settings screens, routing and serialized saves |
| `index.html` | All screen containers, static layouts and reusable HTML templates |
| `ui/templates.js` | Persistent DOM bindings; clones templates once and updates only changed values |
| `viewport.js`, `app.css` | Phone sizing, visibility and fast screen fades |
| `screens/*.html`, `document.html` | Compatibility redirects for old bookmarked URLs |
| `assets/ui-sprites.svg`, `sprites.css` | Thirteen-cell vector sprite atlas for navigation, resources and card backs |
| `audio/`, `speech.js` | Bundled male/female MP3s, playback queue and highlighting |

Save key: `chinese-village-v1`, separate from concept-v4. The guide's Reset progress button clears it. Space is the correct-move debug shortcut. Browser tests use an isolated profile, not the user's save.

On localhost, 127.0.0.1 or IPv6 loopback, double-click a set tile to collect its cards and grant three times its normal set-completion reward (including the first-set settlement grant). Each set pays only once per prestige run. This shortcut does not pay skipped individual answers or bypass village gates and is disabled on other hosts.

Settings → English translations controls Chinese-label translations on Sets, Village, Tech and all reward screens: Always show, Until level 10 (default), or Never show. Automatic assistance ends on first reaching level 10 and remains off after prestige. Translation text lives in each language/catalogue JSON file; `scripts/add-translations.py` updates these fields without changing audio references.

## Development

Level accuracy is correct answers divided by accepted attempts across a set's battle and matching phases (sentence sets track submitted sentences). Only submitted wrong choices count as misses; skipped and expired targets do not affect accuracy; bonus and memory practice do not affect the campaign ratio. A thin meter above the play footer displays accuracy, not completion. Finishing below 50% requires repeating that set with fresh accuracy before its completion reward and advancement; already earned coins/cards stay. Exactly 50% passes. Saves retain accuracy across reloads; older saves begin tracking from their next attempt. The header pause button pauses manually. Inactivity for 30 seconds in an interactive game returns to the Play home screen with progress saved; losing focus does not auto-pause.

`data/ui-vocabulary.json` adds game vocabulary to the language lessons through `scripts/add-translations.py` (also run by the content compiler). V01 includes 村落 (village), 研究 (research), 再來 (start again), 完成 (complete), the script names and construction vocabulary. Remaining set-title terms are introduced in the relevant thematic lessons, including 請坐 (please sit down) in L13 for its building/research label. Existing card IDs are preserved and every word lesson stays at or below 20 cards. Set names can combine several taught words; they do not each require a duplicate phrase card. `tests/ui-vocabulary.test.mjs` checks coverage of catalogue labels, Chinese UI text and set-name vocabulary.

Run `node --test game-v1/tests/*.test.mjs` from the repository.

`tests/spa-browser.cjs` and the other `*-browser.cjs` checks use Playwright and installed Microsoft Edge. Run with the local server active and Playwright available on `NODE_PATH`. It checks taps, memory/reload, purchases, research, screen bounds and phone scaling. Screenshots go to `tests/artifacts/`.

`scripts/build-content.py` compiles the design mapping into runtime files (requires `opencc-python-reimplemented` and `pypinyin`). Rebuilding language files removes generated audio references: run `scripts/generate-speech.py` afterward (requires `edge-tts`, network access and the configured Mandarin voices). Existing MP3s are reused. `scripts/build-sprites.py` regenerates the vector atlas using the Python standard library.

Economy constants are an initial playable balance; the intended 2–4 month duration still needs playtesting. This is a local web game, not a packaged iOS release.

Exchange offers Buy/Sell 1 or 10 for unlocked timber, stone and bricks. Sales return half the current unit buy price (rounded down) and do not count as active-play earnings for the passive-income cap. Trade quotes share validation with transactions; full storage is explained on the exchange cards. Resource sprites use flat planks, stones, brickwork, an open book and a lantern.

## Editing screens

All game and guide layouts live in `index.html`, including repeated-card `<template>` elements. Template placeholders such as `{{0}}` are bound by the corresponding `view(templateId, values)` call. Values are assigned as text or attributes; JavaScript does not build HTML strings or replace whole screen trees. Repeated items clone HTML templates and retain existing elements while their values change.

Navigation uses `index.html#sets`, `#village`, etc. Only one screen is visible; the other screen containers remain mounted. Set details use `?set=L01#sets`. Internal links are handled in the app, with a 90ms fade out and fade in. Screen-specific timers, drag listeners and speech are disposed when leaving. Reduced-motion preferences disable the fade. Old screen URLs redirect into the same app and existing localStorage saves are preserved.

Install the development formatter with `npm install` inside `game-v1`, then use `npm run format` or `npm run format:check`. All JavaScript (including modules/tests), CSS and HTML use the checked-in Prettier configuration. The guide is edited directly in `index.html` alongside the other screens.
