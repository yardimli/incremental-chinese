# Chinese game v2

An independent copy of game-v1 focused on battles, matching, sentence ordering, memory and bonus puzzles. Coins, animated rewards, audio, collections and prestige remain. Home and Sets are the only bottom tabs.

Open any set at any time. Its six game buttons launch Battle, Match, Sentence quiz, Self test, Memory or Bonus. A checkmark records each completed mode. Earn **80% accuracy or higher** to complete a scored set attempt. Lower results replay that set with a fresh accuracy count. Skips are excluded. Bonus and memory do not affect campaign accuracy. Coin rewards remain; buildings, research, resources, exchange and passive income are removed.

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

## Self test and sentence practice

Tap a Chinese word or sentence to reveal its English translation, then select Correct or False. Correct self-assessments earn coins and uncollected cards; false answers lower accuracy and move on. The reveal and position survive reload. Each self-test run combines the set’s words with ten sentence prompts. Sentence-only sets use ten prompts.

Every set contains at least thirty unique sentence combinations (early numbers use counting phrases). Sentence quizzes draw ten, avoiding duplicate combinations within a run. Matching and battle can also use sentence cards for sentence sets. New sentences have bundled male and female MP3s.

Memory completes after all boards for the set; Bonus earns its completion checkmark after ten correct answers for that set. Bonus and memory remain available for replay.

Settings offers Default, +25%, +50% and +75% text sizes. The choice is saved locally; larger layouts allow internal panel scrolling.
