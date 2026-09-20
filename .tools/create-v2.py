from pathlib import Path
import shutil, json, re

root = Path(__file__).resolve().parents[1]
src, dst = root/'game-v1', root/'game-v2'
assert not dst.exists(), 'Do not overwrite an existing version'
shutil.copytree(src, dst, ignore=shutil.ignore_patterns('node_modules', 'artifacts', '*.log'))
def read(name): return (dst/name).read_text(encoding='utf-8')
def write(name, text): (dst/name).write_text(text, encoding='utf-8')
def data(name): return json.loads(read(name))
def save(name, value): write(name, json.dumps(value, ensure_ascii=False, indent=2)+'\n')
def remove(name):
    path = (dst/name).resolve()
    assert path.is_relative_to(dst.resolve())
    if path.exists(): path.unlink()

progression = {k:v for k,v in data('data/progression.json').items() if k in ['baseCoins','growth','maxLevel','memoryPairs','memoryPairWeight','memoryBoardWeight','prestigeGain']}
progression.update(version=4, requiredAccuracy=80)
save('data/progression.json', progression)
write('systems/economy.mjs', '''// Coin rewards are independent of any building or resource economy.
let progression = {baseCoins: 10, growth: 1.6, prestigeGain: 0.5,
  memoryPairs: 6, memoryPairWeight: 2, memoryBoardWeight: 5, requiredAccuracy: 80};
export function configureEconomy(config) { progression = config; }
export const rules = () => progression;
export const base = (level) => Math.round(progression.baseCoins * progression.growth ** Math.max(0, level - 1));
export function recordActive(state, amount) { state.coins += amount; }
''')
s = read('engine.mjs').replace("import * as V from './systems/village.mjs';", "import * as C from './systems/economy.mjs';")
s = s.replace("'chinese-village-v1'", "'chinese-game-v2'").replace('  V.ensureVillage(s);\n','')
s = s.replace('passed: !a.total || a.correct * 2 >= a.total,', 'passed: a.total > 0 && a.correct * 100 >= a.total * C.rules().requiredAccuracy,')
s = s.replace('V.catalogue().progression.prestigeGain', 'C.rules().prestigeGain')
s = s.replace("export const idleRate = (s) => (V.rates(s).coins || 0) / 60;", 'export const idleRate = () => 0;')
s = s.replace('V.base(level) * weight * permanent(s) * V.multiplier(s, scope)', 'C.base(level) * weight * permanent(s)')
s = s.replace('V.recordActive', 'C.recordActive')
s = s.replace('  const result = V.accrueVillage(s, now);\n', '').replace('  return result.coins;', '  return 0;')
s = re.sub(r"  if \(\n    next\?\.type.*?    return false;\n", "  if (!s.completed.includes(lessons[s.setIndex].id)) return false;\n", s, flags=re.S)
s = re.sub(r"  if \(set.id === 'L01'\) \{.*?\n  }\n", '', s, flags=re.S)
write('engine.mjs', s)
s = read('shared.js')
s = re.sub(r"import \* as V from .*?;\nimport \{ drawVillage.*?;\nimport \{ drawTechnology.*?;\n", "import * as C from './systems/economy.mjs';\n", s)
s = re.sub(r'const config = await Promise.all\(.*?const manifest =', "C.configureEconomy(await fetch('./data/progression.json').then((r) => r.json()));\nconst manifest =", s, flags=re.S)
s = s.replace('village-score-display', 'game-v2-score-display')
s = re.sub(r"^    '(village|boosts|tech)',\n", '', s, flags=re.M)
s = re.sub(r"^  (village|tech|boosts):.*\n", '', s, flags=re.M)
s = re.sub(r"^  (Village|Tech):.*\n", '', s, flags=re.M)
s = s.replace("home: 'Play'", "home: 'Home'")
s = s.replace("  if (next === 'boosts') next = 'village';", "  if (['boosts', 'village', 'tech'].includes(next)) next = 'home';")
s = s.replace("!['sets', 'village', 'tech', 'memory'].includes(page)", "!['sets', 'memory'].includes(page)")
s = s.replace("'village-gate'", "'journey-home'")
s = s.replace('  refreshEconomyUI();\n  refreshTechUI();\n  refreshGate();\n','')
s = s.replace("    if (state.stage === 'gate') drawGate();\n    else drawTap();", "    if (state.stage === 'finished') drawPlayHome();\n    else drawTap();")
s = re.sub(r"^  if \(page === 'boosts'.*\n", '', s, flags=re.M)
s = re.sub(r"^  if \(page === 'tech'.*\n", '', s, flags=re.M)
s = s.replace("E.payout(state, 'set', 10) + (set.id === 'L01' ? V.catalogue().progression.settlementGrant : 0)", "E.payout(state, 'set', 10)")
s = s.replace('V.catalogue().progression.prestigeGain', 'C.rules().prestigeGain')
s = re.sub(r'  const villageChanged =.*?  const cardsChanged =', '  const cardsChanged =', s, flags=re.S)
s = s.replace(' || villageChanged', '')
s = re.sub(r'function refreshGate\(\).*?function drawPlayHome\(\) \{', 'function drawPlayHome() {', s, flags=re.S)
s = s.replace("  if (state.stage === 'gate') {\n    drawGate();\n    return;\n  }\n", '')
s = s.replace("  render(screen, view('tpl-drawPlayHome-35', [route(state), E.permanent(state)]));", "  render(screen, view('tpl-drawPlayHome-35', [route(state), E.permanent(state)]));\n  if (state.stage === 'finished') {\n    render(screen.querySelector('.gate-banner h2'), ui('Journey complete'));\n    screen.querySelector('#resume-journey').hidden = true;\n  }")
write('shared.js', s)
s = read('modes/memory.js').replace("import { catalogue } from '../systems/village.mjs';", "import { rules } from '../systems/economy.mjs';").replace('catalogue().progression.', 'rules().')
write('modes/memory.js', s)
write('modes/bonus.js', read('modes/bonus.js').replace("../systems/village.mjs", "../systems/economy.mjs"))

# Remove only vocabulary added for the removed side game, preserving normal HSK words.
manifest = data('lessons/index.json')
manifest['sets'] = [f for f in manifest['sets'] if 'resources-' not in f]
save('lessons/index.json', manifest)
# Keep useful menu vocabulary, moved into the initial numbers set (16 cards total).
extras = [w for w in data('lessons/levels/resources-01.json')['pairs'] if w['simplified'] in ['再来','完成','繁体','简体','关闭']]
d = data('lessons/levels/level-01.json')
for i,w in enumerate(extras):
    w['id'] = f'L01-menu-{i+1}'
    d['pairs'].append(w)
save('lessons/levels/level-01.json', d)
titles = data('data/set-titles.json')
for key in ['V01','V08']: titles.pop(key, None)
titles['L11']['english'] = 'A day in life'
titles['L20']['english'] = 'Celebrations'
titles['L12'].update(traditional='學堂', simplified='学堂', pinyin='xué táng', english='School')
for file in manifest['sets']:
    d = data('lessons/'+file)
    if d['id'] in ['L11','L12','L20']:
        d.update({k:v for k,v in titles[d['id']].items() if k in ['traditional','simplified','pinyin','english']})
        if d['id']=='L12':
            d['audio'] = next(w['audio'] for w in d['pairs'] if w['simplified']=='学堂')
        save('lessons/'+file,d)
save('data/set-titles.json', titles)
vocab = data('data/ui-vocabulary.json')
vocab.pop('V01',None); vocab.pop('V08',None)
vocab.setdefault('L01',[]).extend([{k:v for k,v in w.items() if k!='audio'} for w in extras])
save('data/ui-vocabulary.json',vocab)

s = read('index.html').replace('village.css','modes.css')
s = re.sub(r'\s*<main[^>]*data-screen="(?:village|tech|boosts)"[^>]*></main>', '',s)
guide = '''<main class="game-screen app guide-screen" data-screen="guide" hidden>
<h1>A journey through Chinese</h1>
<p>Match Chinese and English, earn coins and collect your cards. Home resumes your current game; Sets shows your collection. Settings controls script, pinyin, English assistance and sound.</p>
<h2>Advancement</h2>
<p>Complete the current word or sentence set with at least 80% correct answers to advance. Exactly 80% passes. Below 80%, the same set starts again with a fresh accuracy count. Coins already earned stay yours. Skipped targets do not count as wrong answers.</p>
<p>The thin bar above the footer shows your correct-answer ratio. Only answers in the current main set affect it; bonus and memory games earn coins without changing it.</p>
<h2>The journey</h2>
<p>25 word levels begin with numbers, followed by everyday HSK vocabulary. Eight sentence stages each use ten prompts drawn from a pool of at least thirty. Every word set has at most twenty cards.</p>
<p>Battle progresses through one to four choices. Matching is a slower break with five pairs per board. Tap two matching cards or drag one onto its partner. Card rewards arrive during play, followed by a set reward.</p>
<h2>Extra games and coins</h2>
<p>Memory has twelve cards: six Chinese–English pairs. Bonus puzzles increase their reward as you play. You can stop either game at any time. Coins come from playing and completing sets; there is no passive production or spending system in this version.</p>
<h2>Prestige</h2>
<p>After collecting a set, prestige starts the journey again. It resets coins and current progress, keeps settings and collection history, and adds 0.5 to the coin multiplier. Sentence selections vary on each journey.</p>
<h2>Debug</h2>
<p>Space performs a correct move or continues a reward. On localhost, double-click a set to complete it with three times its normal reward. Reset clears only game-v2 progress; game-v1 is separate.</p>
<button id="reset-progress">Reset progress</button><p id="reset-status" role="status"></p>
</main>'''
s = re.sub(r'<main[^>]*data-screen="guide".*?</main>',guide,s,flags=re.S)
s = re.sub(r'<a href="(?:village|tech)\.html" data-nav="(?:village|tech)".*?</a\s*>','',s,flags=re.S)
s = re.sub(r'\s*<template id="(?:tpl-(?:village|technology|drawVillage|drawTechnology|drawGate|shared-32|shop-help)[^"]*)">.*?</template>', '', s, flags=re.S)
s = re.sub(r'<a class="secondary" href="village.html">.*?</a\s*>','',s,flags=re.S)
s = s.replace('sprite-village','sprite-play')
s = s.replace('Reach 50% accuracy to complete this set.','Reach 80% accuracy to complete this set.')
s = s.replace('New village plans available','Ready for your next journey')
s = s.replace('Coins &amp; resources','Coins')
s = re.sub(r'<br\s*/><span data-ui="Village &amp; research"></span>','',s)
write('index.html',s)
s = read('ui/button-labels.js')
s = re.sub(r'const labels = \{.*?\n};', "const labels = {\n  home: ['主頁', '主页', 'zhǔ yè', 'Home'],\n  sets: ['卡冊', '卡册', 'kǎ cè', 'Sets'],\n};", s,flags=re.S)
s = s[:s.index('export function actionLabel')]
write('ui/button-labels.js',s)
write('ui/help-text.js', re.sub(r'  const terms = \[.*?\];',"  const terms = ['close', 'complete', 'study'];",read('ui/help-text.js'),flags=re.S))
ui = data('data/ui-text.json')
old='Reach 50% accuracy to complete this set.'
ui['Reach 80% accuracy to complete this set.']={k:v.replace('50','80') for k,v in ui.pop(old).items()}
ui.update({
 'Home': {'traditional':'主頁','simplified':'主页','pinyin':'zhǔ yè'},
 'Coins': {'traditional':'金幣','simplified':'金币','pinyin':'jīn bì'},
 'Ready for your next journey': {'traditional':'繼續旅程','simplified':'继续旅程','pinyin':'jì xù lǚ chéng'},
 'Journey complete': {'traditional':'旅程完成','simplified':'旅程完成','pinyin':'lǚ chéng wán chéng'},
})
save('data/ui-text.json',ui)
write('modes.css',read('village.css').replace('.village-gate','.journey-home'))
write('app.css',read('app.css').replace('.village-gate','.journey-home')+'\n.footer { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n')
write('scripts/generate-speech.py',re.sub(r" for name in \['resources','buildings','research'\]:\n.*?\n sem=", ' sem=',read('scripts/generate-speech.py')))
for name in ['systems/village.mjs','systems/technology.mjs','ui/village.js','ui/technology.js','ui/shop-details.js','data/resources.json','data/buildings.json','data/research.json','lessons/levels/resources-01.json','lessons/levels/resources-08.json','village.css','scripts/build-content.py','tests/village.test.mjs','tests/ui-vocabulary.test.mjs','screens/village.html','screens/tech.html','screens/boosts.html']:
    remove(name)
# Version-local copies of compatible tests, and no stale links into the first game.
for p in (dst/'tests').glob('*.cjs'):
    p.write_text(p.read_text('utf-8').replace('game-v1','game-v2').replace('chinese-village-v1','chinese-game-v2'),encoding='utf-8')
write('README.md','''# Chinese game v2

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
''')
write('PROGRESSION.md','''# Progression in game-v2

The manifest in `lessons/index.json` defines the ordered journey: 25 word levels with eight sentence stages between them. Each stage must be completed with at least 80% correct answers. The required percentage is configured in `data/progression.json`.

Accuracy includes submitted battle, matching and sentence answers in the current set. Skipped targets, bonus puzzles and memory do not change it. An attempt below 80% repeats the same set with a fresh counter; earned coins and revealed cards remain. A successful attempt collects the set reward once and immediately starts the next set. No purchases or waiting are required.

Coins use the existing level-scaled rewards and prestige multiplier. Nothing produces coins passively. Prestige resets coins and current lessons but retains preferences, historical collections and a higher coin multiplier. The localhost completion shortcut intentionally bypasses accuracy for debugging.
''')
print('Created',dst)
