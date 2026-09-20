# Progression in game-v2

The manifest in `lessons/index.json` defines the ordered journey: 25 word levels with eight sentence stages between them. Each stage must be completed with at least 80% correct answers. The required percentage is configured in `data/progression.json`.

Accuracy includes submitted battle, matching and sentence answers in the current set. Skipped targets, bonus puzzles and memory do not change it. An attempt below 80% repeats the same set with a fresh counter; earned coins and revealed cards remain. A successful attempt collects the set reward once and immediately starts the next set. No purchases or waiting are required.

Coins use the existing level-scaled rewards and prestige multiplier. Nothing produces coins passively. Prestige resets coins and current lessons but retains preferences, historical collections and a higher coin multiplier. The localhost completion shortcut intentionally bypasses accuracy for debugging.
