# Chinese game v2

An independent copy of game-v1 focused on battles, matching, sentence ordering, memory and bonus puzzles. Coins, animated rewards, audio, collections and prestige remain. Home and Sets are the only bottom tabs.

Open any set at any time. Its game buttons launch Battle, Match, Sentence quiz, Self test, Memory or Bonus. Word sets with alternate meanings also offer Multiple meanings. A checkmark records each completed mode. Earn **80% accuracy or higher** to complete a scored set attempt. Lower results replay that set with a fresh accuracy count. Skips are excluded. Bonus and memory do not affect campaign accuracy. Coin rewards remain; buildings, research, resources, exchange and passive income are removed.

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

## Alternate meanings

Word records have one English gloss. `hasMultipleMeanings` marks related senses, `meaningGroup` identifies the original word, and `meaningIndex` is zero for the primary sense. Original IDs remain unchanged so saved cards and sentence tokens still resolve; additional records use suffixes such as `L05-01-m2`. Related records share Chinese, pinyin, and male/female MP3 paths.

For example, `L05-01` means **live**, while `L05-01-m2` means **stay**. Battle introduces the primary sense before alternatives, with only one sense of a Chinese word equipped at once. Regular matching, memory, bonus and self-test use primary senses. Multiple meanings asks for every valid English meaning, awards coins and cards, saves partial selections, and has its own completion checkmark. A wrong option gives no coins; 80% accuracy is needed to complete the run.

Bonus answers use one row each; a correct answer stays alone for two seconds. Sentence cards remain silent on arrival and speak when tapped, subject to the sound setting.

## Card reward toasts

Card rewards no longer interrupt play. A compact toast (maximum 80px high) rises from below the footer and rests 10px above it before popping away. Tap it to dismiss early. Each toast shows one card, its pronunciation/English according to settings, the set name and collection progress. Batched rewards appear one at a time, and the pending toast queue survives reloads. Coins/cards are committed when earned, not when a toast is dismissed. Set-completion screens remain unchanged.
