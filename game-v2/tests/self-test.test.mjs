import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../engine.mjs';
import { prepareLessonCards } from '../lesson-cards.mjs';
const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const lessons = prepareLessonCards(
  read('lessons/index.json').sets.map((file) => read('lessons/' + file)),
);

test('all sentence prompts have bundled male and female audio', () => {
  const catalog = read('audio/catalog.json').clips;
  for (const set of lessons)
    for (const q of set.sentences) {
      assert.ok(q.audio?.female && q.audio?.male, q.id);
      assert.deepEqual(q.audio, catalog[q.traditional], q.id);
    }
});

test('every set has at least 30 varied prompts with valid previously taught words', () => {
  E.validateLessons(lessons);
  const allWords = lessons.filter((s) => s.type === 'pairs').flatMap((s) => s.pairs);
  for (const set of lessons) {
    assert.ok(set.sentences.length >= set.countPerRun * 3, set.id);
    assert.ok(new Set(set.sentences.map((q) => q.tokens.join('|'))).size >= 30, set.id);
    for (const q of set.sentences) {
      assert.ok(q.tokens.length >= 2 && q.tokens.length <= 4, q.id);
      for (const id of q.tokens)
        assert.ok(
          allWords.some((w) => w.id === id && Number(id.slice(1, 3)) <= set.level),
          q.id,
        );
    }
  }
});

test('all sets start every mode without completion prerequisites', () => {
  for (let index = 0; index < lessons.length; index++) {
    for (const mode of ['battle', 'match', 'order', 'self-test', 'memory', 'bonus']) {
      const s = E.freshState(lessons);
      assert.equal(E.startSetGame(s, lessons, index, mode), true);
      assert.equal(s.setIndex, index);
      assert.equal(s.completed.length, 0);
      if (mode === 'self-test') assert.ok(s.selfTest.deck.length >= 10);
      if (mode === 'order') assert.equal(s.sentenceDeck.length, 10);
    }
  }
});

test('self-test requires reveal, false earns nothing, correct grants coins and a card once', () => {
  const s = E.freshState(lessons);
  E.startSetGame(s, lessons, 0, 'self-test');
  const first = s.selfTest.deck[0];
  assert.equal(E.gradeSelfTest(s, lessons, true, first), null);
  s.selfTest.revealed = true;
  E.gradeSelfTest(s, lessons, false, first);
  assert.equal(s.coins, 0);
  assert.equal(s.cards.L01, undefined);
  const second = s.selfTest.deck[1];
  s.selfTest.revealed = true;
  E.gradeSelfTest(s, lessons, true, second);
  assert.equal(s.coins, 10);
  assert.ok(s.cards.L01.includes(second));
  assert.equal(s.stage, 'cardReward');
  assert.equal(E.gradeSelfTest(s, lessons, true, second), null);
  E.continueCardReward(s);
  assert.equal(s.stage, 'self-test');
  assert.equal(s.selfTest.revealed, false);
  assert.equal(E.levelAccuracy(s).percent, 50);
});

test('self-test completion earns its own checkmark and survives state serialization', () => {
  let s = E.freshState(lessons);
  E.startSetGame(s, lessons, 0, 'self-test');
  while (s.stage !== 'setReward') {
    if (s.stage === 'cardReward') E.continueCardReward(s);
    else {
      s.selfTest.revealed = true;
      E.gradeSelfTest(s, lessons, true, s.selfTest.deck[s.selfTest.index]);
    }
    s = JSON.parse(JSON.stringify(s));
  }
  E.claimSet(s, lessons);
  assert.equal(s.gameCompleted.L01['self-test'], true);
  assert.equal(s.gameCompleted.L01.match, undefined);
  assert.ok(s.coins > 0);
});
