# Chinese Village

## Game versions

- **[game-v2](game-v2/README.md)**: puzzle-focused version with Home and Sets, coin rewards, and an 80% accuracy requirement to advance. No village, research or resource economy. [Play v2 locally](http://127.0.0.1:8765/game-v2/index.html).
- **game-v1**: the original village-building version described below. Both versions keep separate browser saves.

A phone-sized incremental game where Chinese–English puzzles earn coins to grow a village. Start with numbers, build a vocabulary through short battles, matching, memory cards and sentence ordering, then invest your earnings in buildings and research.

Buildings produce resources and improve puzzle rewards. New journeys require buildings owned, completed research and resource stockpiles. Prestige resets the village and lesson progress for a stronger earnings multiplier and another round of familiar vocabulary.

The game includes traditional/simplified Chinese, configurable pinyin and English hints, recorded male/female speech, offline production and local browser saves. The playable campaign contains 25 core vocabulary levels, two resource-vocabulary stages and eight sentence stages.

## Screenshots

Current `game-v1` interface, captured with example progress at 393 × 852 pixels.

| Battle | Memory |
| --- | --- |
| <img src="docs/screenshots/play.jpg" alt="Chinese target and English answer cards above the game navigation" width="250"> | <img src="docs/screenshots/memory.jpg" alt="Twelve-card Chinese–English memory board" width="250"> |

| Village | Research |
| --- | --- |
| <img src="docs/screenshots/village.jpg" alt="Village resources, path filters and a repeatable building" width="250"> | <img src="docs/screenshots/tech.jpg" alt="Research plans with resource costs and help buttons" width="250"> |

## Run locally

From the project root:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Open [the game](http://127.0.0.1:8765/game-v1/index.html). No build step is required. Phones use the available screen; desktop browsers show a phone-sized canvas. Progress is stored in the browser's local storage.

## Folders

Top-level folders:

| Folder | Purpose |
| --- | --- |
| `game-v2/` | The latest puzzle-focused version: coins, collections and accuracy-based advancement. |
| `game-v1/` | The preserved village-building version. |
| `docs/` | Design and reference material. `hsk-mapping/` contains vocabulary/grammar mappings, economy proposals and their generation scripts; `screenshots/` holds the JPG images used above. Earlier proposals may differ from the current game. |
| `output/` | Earlier design iterations: `game-concepts/` and `game-concepts-v2/` contain initial concepts; `concept-v3/` and `concept-v4/` contain later prototypes. These are references, not the current game entry point. |
| `.tools/` | Local development helpers and dependencies: speech generation environment, content libraries, UI-refactoring scripts, temporary backups and caches. These are not needed to run the game and may not all be tracked in Git. |
| `.idea/` | Local JetBrains IDE project/workspace settings. Not part of the game. |

Inside the playable game:

| Folder | Contents |
| --- | --- |
| `game-v1/` | Current playable game; `index.html` contains the screens and reusable HTML templates. |
| `game-v1/modes/` | Battle, matching, memory, bonus and sentence-order interactions. |
| `game-v1/systems/` | Village economy, research and progression-related rules. |
| `game-v1/ui/` | Screen updates, shared labels and help rendering. |
| `game-v1/data/` | JSON definitions for buildings, research, resources, progression and UI vocabulary. |
| `game-v1/lessons/` | Campaign manifest and individual language-level JSON files. |
| `game-v1/assets/` / `game-v1/audio/` | Backgrounds, sprite sheets, icons and bundled speech. |
| `game-v1/scripts/` / `game-v1/tests/` | Content/asset generation and automated checks. |

See the [game development README](game-v1/README.md) for implementation details and [current level requirements](game-v1/PROGRESSION.md) for the advancement table. Earlier design documents may differ from the playable version.

## Checks

```sh
node --test game-v1/tests/*.test.mjs
```

Browser checks use Playwright with Microsoft Edge and the local server running. This is a browser prototype; the economy and campaign pacing are still being tuned.

