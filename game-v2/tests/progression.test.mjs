import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as E from '../engine.mjs';
import { configureEconomy } from '../systems/economy.mjs';

const json = async (name) => JSON.parse(await readFile(new URL('../' + name, import.meta.url)));
configureEconomy(await json('data/progression.json'));
const manifest = await json('lessons/index.json');
const lessons = await Promise.all(manifest.sets.map((name) => json('lessons/' + name)));

test('v2 lessons keep valid sentence tokens and pools without side-game vocabulary', () => {
  E.validateLessons(lessons);
  assert.equal(lessons.filter((s) => s.type === 'pairs').length, 25);
  assert.equal(lessons.filter((s) => s.type === 'sentences').length, 8);
  const removed = new Set([
    '木材',
    '石料',
    '知识',
    '砖',
    '心得',
    '村',
    '村落',
    '建',
    '建筑',
    '材料',
    '资源',
    '储备',
    '研究',
  ]);
  for (const set of lessons) {
    assert.doesNotMatch(set.traditional, /村/);
    for (const word of set.pairs || []) assert.ok(!removed.has(word.simplified), word.simplified);
  }
});

test('accuracy requires answered questions and accepts exactly 80%, not 79%', () => {
  const s = E.freshState(lessons);
  assert.equal(E.levelAccuracy(s).passed, false);
  for (const [correct, total, passed] of [
    [79, 100, false],
    [4, 5, true],
    [81, 100, true],
  ]) {
    s.accuracy = { 0: { correct, total, attempt: 1 } };
    assert.equal(E.levelAccuracy(s).passed, passed);
  }
});

test('failed word and sentence sets repeat without losing coins or paying completion twice', () => {
  for (const index of [0, lessons.findIndex((s) => s.type === 'sentences')]) {
    const s = E.freshState(lessons);
    s.setIndex = index;
    s.stage = 'setReward';
    s.coins = 123;
    s.accuracy = { [index]: { correct: 79, total: 100, attempt: 1 } };
    assert.equal(E.claimSet(s, lessons), true);
    assert.equal(s.setIndex, index);
    assert.equal(s.stage, index ? 'order' : 'tap');
    assert.equal(s.coins, 123);
    assert.equal(s.accuracy[index].total, 0);
    assert.equal(s.accuracy[index].attempt, 2);
    assert.equal(s.completed.length, 0);
  }
});

test('80% advances immediately with coin reward and without an economy gate', () => {
  const s = E.freshState(lessons);
  s.stage = 'setReward';
  s.accuracy = { 0: { correct: 4, total: 5, attempt: 1 } };
  assert.equal(E.claimSet(s, lessons), true);
  assert.equal(s.setIndex, 1);
  assert.equal(lessons[s.setIndex].id, 'L02');
  assert.equal(s.stage, 'tap');
  assert.equal(s.coins, 100);
  assert.equal(E.claimSet(s, lessons), false);
  assert.equal(s.coins, 100);
  assert.equal('village' in s, false);
});

test('coins remain active rewards only, with separate version storage', () => {
  const s = E.freshState(lessons, 1000);
  assert.equal(E.SAVE_KEY, 'chinese-game-v2');
  assert.equal(E.award(s, 'W', 1), 10);
  assert.equal(E.accrue(s, 1000 + 86400000), 0);
  assert.equal(s.coins, 10);
  assert.equal(E.idleRate(s), 0);
});

test('the whole campaign reaches completion through gameplay without purchases', () => {
  const s = E.freshState(lessons);
  let moves = 0;
  while (s.stage !== 'finished') {
    assert.ok(++moves < 15000, 'Campaign must terminate');
    if (s.stage === 'tap') E.answerTap(s, lessons, s.current.id, s.current.id);
    else if (s.stage === 'cardReward') E.continueCardReward(s);
    else if (s.stage === 'match') {
      const id = E.matchBoard(s).find((id) => !s.matchFound.includes(id));
      E.matchPair(s, lessons, id, id);
    } else if (s.stage === 'order') {
      const q = E.sentencePrompt(s, lessons);
      E.answerSentence(s, lessons, q.tokens, q.id);
    } else if (s.stage === 'setReward') E.claimSet(s, lessons);
    else assert.fail('Unexpected stage: ' + s.stage);
  }
  assert.equal(s.completed.length, lessons.length);
  assert.ok(s.coins > 0);
  assert.equal(E.prestigeReset(s, lessons), true);
  assert.equal(s.setIndex, 0);
  assert.equal(s.coins, 0);
  assert.equal(s.prestige, 1);
  assert.equal('village' in s, false);
});
