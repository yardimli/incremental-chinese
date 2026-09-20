# Chinese game v2

An independent copy of game-v1 focused on battles, matching, sentence ordering, memory and bonus puzzles. Coins, animated rewards, audio, collections and prestige remain. Home and Sets are the only bottom tabs.

Complete each main set with **80% accuracy or higher** to advance. Lower results replay that set with a fresh accuracy count. Skips are excluded. Bonus and memory do not affect campaign accuracy. Coin rewards remain; buildings, research, resources, exchange and passive income are removed.

Serve the project root with `python -m http.server 8765`, then open http://127.0.0.1:8765/game-v2/index.html. Save key: `chinese-game-v2`; v1 progress is untouched.

## Folders

- `lessons/`: manifest and individual word/sentence JSON files.
- `data/`: progression, translations, set titles and supplementary vocabulary.
- `modes/`: separate game modes.
- `systems/`: coin economy and language preferences.
- `ui/`: persistent HTML bindings and translated labels.
- `audio/`, `assets/`: bundled voices and graphics.
- `screens/`: compatibility navigation entry points; screen markup lives in `index.html`.
- `scripts/`: voice generation tools. Lesson JSON is edited directly.
- `tests/`: engine and browser regression checks.

Run unit checks with `node --test game-v2/tests/*.test.mjs` from the project root.
