import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../engine.mjs';
import { prepareLessonCards } from '../lesson-cards.mjs';
import { meaningGroups, meaningKey, primaryPairs } from '../vocabulary.mjs';
import { answerMeaning } from '../modes/meanings-state.mjs';
const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const lessons = prepareLessonCards(
  read('lessons/index.json').sets.map((file) => read('lessons/' + file)),
);
test('separate senses have unique stable IDs, a single gloss, and shared Chinese/audio', () => {
  for (const set of lessons.filter((s) => s.type === 'pairs')) {
    assert.ok(primaryPairs(set.pairs).length <= 20);
    for (const w of set.pairs) assert.ok(!w.english.includes('/'), w.id);
    for (const group of meaningGroups(set))
      for (const w of group) {
        assert.equal(w.hasMultipleMeanings, true);
        assert.equal(w.traditional, group[0].traditional);
        assert.equal(w.pinyin, group[0].pinyin);
        assert.deepEqual(w.audio, group[0].audio);
      }
  }
});
test('meaning quiz scores once, persists partial selections, rewards all senses, and completes', () => {
  for (let index = 0; index < lessons.length; index++) {
    const set = lessons[index];
    if (!meaningGroups(set).length) continue;
    let s = E.freshState(lessons);
    assert.equal(E.startSetGame(s, lessons, index, 'meanings'), true);
    let steps = 0;
    while (s.stage !== 'setReward' && steps++ < 150) {
      if (s.stage === 'cardReward') {
        E.continueCardReward(s);
        continue;
      }
      const id = s.meanings.options.find(
        (id) =>
          set.pairs.find((w) => w.id === id).meaningGroup === s.meanings.deck[s.meanings.index] &&
          !s.meanings.found.includes(id),
      );
      assert.ok(answerMeaning(s, set, id).correct);
      const coins = s.coins;
      assert.equal(answerMeaning(s, set, id), null);
      assert.equal(s.coins, coins);
      s = JSON.parse(JSON.stringify(s));
    }
    assert.equal(s.stage, 'setReward', set.id);
    E.claimSet(s, lessons);
    assert.equal(s.gameCompleted[set.id].meanings, true);
  }
});
test('wrong meanings do not score and low accuracy repeats a fresh meaning run', () => {
  const i = lessons.findIndex((s) => s.id === 'L05'),
    set = lessons[i],
    s = E.freshState(lessons);
  E.startSetGame(s, lessons, i, 'meanings');
  const wrong = s.meanings.options.find(
    (id) => set.pairs.find((w) => w.id === id).meaningGroup !== s.meanings.deck[0],
  );
  assert.equal(answerMeaning(s, set, wrong).correct, false);
  assert.equal(s.coins, 0);
  assert.equal(answerMeaning(s, set, wrong), null);
  s.stage = 'setReward';
  E.claimSet(s, lessons);
  assert.equal(s.stage, 'meanings');
  assert.equal(s.meanings.index, 0);
  assert.deepEqual(s.meanings.rejected, []);
});
test('battle teaches each sense with no simultaneous ambiguous weapons', () => {
  const i = lessons.findIndex((s) => s.id === 'L05'),
    set = lessons[i],
    s = E.freshState(lessons);
  E.startSetGame(s, lessons, i, 'battle');
  let steps = 0;
  const seen = new Set();
  while (s.stage !== 'setReward' && steps++ < 1000) {
    if (s.stage === 'cardReward') {
      E.continueCardReward(s);
      continue;
    }
    const options = s.current.options.map((id) => set.pairs.find((w) => w.id === id));
    assert.equal(new Set(options.map(meaningKey)).size, options.length);
    assert.equal(new Set(options.map((w) => w.english)).size, options.length);
    const id = s.current.id;
    seen.add(id);
    E.answerTap(s, lessons, id, id);
  }
  assert.equal(s.stage, 'setReward');
  assert.equal(seen.size, set.pairs.length);
});
import { flip } from '../modes/memory-state.mjs';
test('identical English meanings remain interchangeable in match and memory', () => {
  const index = lessons.findIndex((s) => s.id === 'L20'),
    set = lessons[index],
    s = E.freshState(lessons);
  const happy = set.pairs.filter((w) => !w.meaningIndex && w.english === 'happy').map((w) => w.id);
  assert.equal(happy.length, 2);
  E.startSetGame(s, lessons, index, 'match');
  s.matchOrder = [...happy];
  assert.ok(E.matchPair(s, lessons, happy[0], happy[1]).correct);
  assert.ok(E.matchPair(s, lessons, happy[1], happy[0]).correct);
  const m = E.freshState(lessons);
  m.memory = {
    deck: happy.flatMap((id) => [
      { id, side: 'cn' },
      { id, side: 'en' },
    ]),
    found: [],
    open: [],
  };
  const lookup = (id) => set.pairs.find((w) => w.id === id);
  flip(m, 0, lookup);
  assert.ok(flip(m, 3, lookup).correct);
  flip(m, 2, lookup);
  assert.ok(flip(m, 1, lookup).correct);
  assert.equal(m.memory.found.length, 2);
});
