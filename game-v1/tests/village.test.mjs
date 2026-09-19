import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as E from '../engine.mjs';
import * as V from '../systems/village.mjs';
import * as T from '../systems/technology.mjs';
import * as M from '../modes/memory-state.mjs';
const json = async (path) =>
  JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const config = Object.fromEntries(
  await Promise.all(
    ['resources', 'progression', 'buildings', 'research'].map(async (k) => [
      k,
      await json('data/' + k + '.json'),
    ]),
  ),
);
V.configureVillage(config);
const manifest = await json('lessons/index.json');
const lessons = await Promise.all(manifest.sets.map((f) => json('lessons/' + f)));
const fresh = () => E.freshState(lessons, 0, 42);

test('buildings have no land cap and owned copies remain counted', () => {
  const s = fresh();
  s.completed = ['L01'];
  s.coins = 1e12;
  s.village.buildings = { I01: 20, I02: 20, I03: 20 };
  s.village.research = ['R01A'];
  s.village.resources.timber = 100;
  s.village.resources.stone = 100;
  assert.equal(V.buildingCount(s), 60);
  assert.ok(V.buyBuilding(s, 'P01A'));
  assert.equal(V.buildingCount(s), 61);
  assert.ok(V.buyBuilding(s, 'I03'));
  assert.equal(V.buildingCount(s), 62);
  assert.equal(V.gateStatus(s, 1)[0].have, 62);
  s.village.buildings.P01A = 8;
  assert.equal(V.gateStatus(s, 1)[0].have, 69, 'Every purchased copy counts');
  s.village.buildings.P01B = 5;
  assert.equal(V.gateStatus(s, 1)[0].have, 74, 'Counts include supply and researched buildings');
});

test('journeys require buildings, research and simultaneous stockpiles without spending them', () => {
  const s = fresh();
  s.completed = ['L01', 'V01'];
  s.setIndex = lessons.findIndex((l) => l.id === 'V01');
  s.stage = 'gate';
  const gate = config.progression.gates[0];
  s.village.buildings.I03 = gate.buildings;
  s.village.research = ['R01A'];
  Object.assign(s.village.resources, gate.resources);
  s.village.resources.timber--;
  assert.equal(E.advance(s, lessons), false);
  s.village.resources.timber++;
  const before = structuredClone(s.village);
  assert.equal(E.advance(s, lessons), true);
  assert.deepEqual(s.village, before, 'Advancement consumes no buildings, research or stockpiles');
});

test('all level resource targets are unlocked and fit achievable warehouse capacity', () => {
  for (const gate of config.progression.gates) {
    for (const [id, need] of Object.entries(gate.resources)) {
      const resource = config.resources.find((r) => r.id === id);
      assert.ok(resource.level <= gate.level, id + ' unlock');
      assert.ok(need <= resource.cap * (gate.level >= 2 ? 2 : 1), id + ' capacity');
    }
    assert.ok(config.research.filter((r) => r.level <= gate.level).length >= gate.research);
  }
});

test('accuracy counts submitted answers and excludes skipped targets', () => {
  const s = fresh();
  s.difficulty = 2;
  E.newPrompt(s, lessons);
  const target = s.current.id,
    wrong = s.current.options.find((id) => id !== target);
  E.answerTap(s, lessons, wrong, target);
  E.answerTap(s, lessons, target, target);
  if (s.stage === 'cardReward') E.continueCardReward(s);
  E.skipTap(s, lessons, s.current.id);
  assert.equal(E.levelAccuracy(s).correct, 1);
  assert.equal(E.levelAccuracy(s).total, 2);
  assert.equal(E.levelAccuracy(s).percent, 50);
  E.answerTap(s, lessons, target, 'stale');
  assert.equal(E.levelAccuracy(s).total, 2);
  s.stage = 'match';
  s.matchOrder = lessons[0].pairs.map((w) => w.id);
  s.matchFound = [];
  const [a, b] = s.matchOrder;
  E.matchPair(s, lessons, a, b);
  E.matchPair(s, lessons, a, a);
  assert.equal(E.levelAccuracy(s).percent, 50);
  E.matchPair(s, lessons, a, a);
  assert.equal(E.levelAccuracy(s).total, 4);
});
test('below 50 percent repeats the same set without a completion award; exactly 50 passes', () => {
  const s = fresh();
  s.stage = 'setReward';
  s.accuracy = { 0: { correct: 1, total: 3, attempt: 1 } };
  s.cards.L01 = [lessons[0].pairs[0].id];
  s.coins = 123;
  assert.ok(E.claimSet(s, lessons));
  assert.equal(s.setIndex, 0);
  assert.equal(s.stage, 'tap');
  assert.equal(s.coins, 123);
  assert.equal(s.cards.L01.length, 1);
  assert.deepEqual(s.completed, []);
  assert.equal(E.levelAccuracy(s).total, 0);
  assert.equal(E.levelAccuracy(s).attempt, 2);
  const saved = JSON.parse(JSON.stringify(s));
  assert.equal(E.levelAccuracy(saved).attempt, 2);
  s.stage = 'setReward';
  s.accuracy[0] = { correct: 1, total: 2, attempt: 2 };
  E.claimSet(s, lessons);
  assert.ok(s.completed.includes('L01'));
  assert.equal(s.coins, 473);
  assert.equal(E.levelAccuracy(s).total, 0);
});
test('sentence submissions count toward accuracy and failed sentence sets restart', () => {
  const s = fresh();
  s.setIndex = lessons.findIndex((l) => l.type === 'sentences');
  const set = lessons[s.setIndex],
    q = set.sentences[0];
  s.stage = 'order';
  s.sentenceDeck = set.sentences.slice(0, 10).map((q) => q.id);
  E.answerSentence(s, lessons, [], q.id);
  E.answerSentence(s, lessons, [], q.id);
  E.answerSentence(s, lessons, q.tokens, q.id);
  assert.equal(E.levelAccuracy(s).total, 3);
  assert.equal(E.levelAccuracy(s).correct, 1);
  s.stage = 'setReward';
  E.claimSet(s, lessons);
  assert.equal(s.stage, 'order');
  assert.equal(s.sentenceIndex, 0);
  assert.equal(s.sentenceDeck.length, 10);
  assert.equal(E.levelAccuracy(s).total, 0);
});
test('localhost set completion awards once, collects cards and respects normal gates', () => {
  const s = fresh();
  assert.equal(E.debugCompleteSet(s, lessons, 0, 'example.com'), null);
  assert.equal(s.coins, 0);
  const result = E.debugCompleteSet(s, lessons, 0, 'localhost');
  assert.equal(result.points, 1050);
  assert.equal(s.coins, 1050);
  assert.equal(s.cards.L01.length, lessons[0].pairs.length);
  assert.ok(s.completed.includes('L01'));
  assert.equal(s.pendingReward, null);
  assert.deepEqual(E.debugCompleteSet(s, lessons, 0, '127.0.0.1'), { completed: false, points: 0 });
  assert.equal(s.coins, 1050);
  const current = s.setIndex,
    prompt = structuredClone(s.current);
  const future = lessons.findIndex((x) => x.id === 'L06'),
    expected = E.payout(s, 'set', 10, 6) * 3;
  assert.equal(E.debugCompleteSet(s, lessons, future, '127.0.0.1').points, expected);
  assert.equal(s.setIndex, current);
  assert.deepEqual(s.current, prompt);
  const sentences = lessons.findIndex((x) => x.type === 'sentences');
  E.debugCompleteSet(s, lessons, sentences, '[::1]');
  assert.equal(s.cards[lessons[sentences].id].length, 10);
  assert.deepEqual(s.cards[lessons[sentences].id], s.previousSentences[lessons[sentences].id]);
  // A pre-completed next stage becomes a gate rather than an unclaimable reward.
  const skip = fresh();
  skip.completed = ['L01', 'V01', 'L02'];
  skip.setIndex = 1;
  skip.stage = 'gate';
  skip.level = 1;
  skip.village.buildings.P01A = 1;
  skip.village.buildings.I03 = 2;
  skip.village.research = ['R01A'];
  Object.assign(skip.village.resources, config.progression.gates[1].resources);
  assert.equal(E.advance(skip, lessons), true);
  assert.equal(lessons[skip.setIndex].id, 'L03');
  assert.equal(skip.stage, 'tap');
});
test('25 word levels and eight varied sentence stages, <=20 new cards per level', () => {
  E.validateLessons(lessons);
  assert.equal(lessons.filter((s) => s.type === 'pairs' && !s.auxiliary).length, 25);
  assert.equal(lessons.filter((s) => s.type === 'sentences').length, 8);
  const learned = new Set();
  for (const set of lessons) {
    if (set.pairs) set.pairs.forEach((w) => learned.add(w.id));
    else
      for (const q of set.sentences)
        assert.ok(
          q.tokens.every((id) => learned.has(id)),
          q.id,
        );
  }
});
test('every main mode reaches rewards and village gates through the whole campaign', () => {
  const s = fresh();
  let steps = 0;
  while (s.stage !== 'finished') {
    assert.ok(steps++ < 10000);
    if (s.stage === 'tap') E.answerTap(s, lessons, s.current.id, s.current.id);
    else if (s.stage === 'match') {
      const id = E.matchBoard(s).find((id) => !s.matchFound.includes(id));
      E.matchPair(s, lessons, id, id);
    } else if (s.stage === 'cardReward') {
      assert.ok(s.pendingReward.ids.length);
      E.continueCardReward(s);
    } else if (s.stage === 'setReward') {
      assert.equal(E.claimSet(s, lessons), true);
      assert.equal(E.claimSet(s, lessons), false);
    } else if (s.stage === 'order') {
      const q = E.sentencePrompt(s, lessons);
      E.answerSentence(s, lessons, q.tokens, q.id);
    } else if (s.stage === 'gate') {
      assert.equal(E.advance(s, lessons), false);
      for (const b of config.buildings.filter((b) => b.research && b.level <= s.level))
        s.village.buildings[b.id] = 1;
      s.village.research = config.research.filter((r) => r.level <= s.level).map((r) => r.id);
      const gate = config.progression.gates.find((g) => g.level === s.level);
      s.village.buildings.I03 = gate.buildings;
      Object.assign(s.village.resources, gate.resources);
      assert.equal(E.advance(s, lessons), true);
    } else assert.fail(s.stage);
  }
  assert.equal(s.completed.length, 35);
  assert.ok(s.coins > 0);
});
test('bootstrap, production-only technology, exchange restrictions and repeat prices', () => {
  const s = fresh();
  s.completed = ['L01'];
  s.coins = 250;
  assert.ok(V.buyBuilding(s, 'I03'));
  assert.equal(s.coins, 150);
  assert.equal(T.research(s, 'R01A'), false);
  V.accrueVillage(s, 40000);
  assert.ok(Math.abs(s.village.resources.knowledge - 2) < 1e-8);
  assert.ok(T.research(s, 'R01A'));
  assert.equal(T.research(s, 'R01A'), false);
  assert.equal(V.exchange(s, 'knowledge', 1), false);
  assert.equal(V.exchange(s, 'insight', 1), false);
  assert.equal(V.exchange(s, 'bricks', 1), false);
  s.coins = 10000;
  assert.ok(V.exchange(s, 'timber', 16));
  assert.ok(V.exchange(s, 'stone', 8));
  assert.ok(V.buyBuilding(s, 'P01A'));
  const b = config.buildings.find((b) => b.id === 'P01A');
  assert.equal(V.buildingCost(s, b).coins, 708);
  assert.ok(V.multiplier(s, 'W') > 1);
  assert.equal(V.buyBuilding(s, 'P08A'), false);
});
test('exchange buys and sells exact amounts, explains capacity, and cannot mint coins', () => {
  const s = fresh();
  s.completed = ['L01'];
  s.coins = 300;
  assert.ok(V.exchange(s, 'timber', 10));
  assert.equal(s.coins, 0);
  assert.equal(s.village.resources.timber, 10);
  assert.ok(V.exchange(s, 'timber', 10, 'sell'));
  assert.equal(s.coins, 150);
  assert.equal(s.village.resources.timber, 0);
  assert.equal(s.village.active.length, 0, 'Sales do not inflate active-play allowance');
  assert.equal(V.exchange(s, 'timber', 1, 'sell'), false);
  s.coins = 10000;
  s.village.resources.timber = 200;
  assert.equal(V.exchangeQuote(s, 'timber', 1).reason, 'Storage full');
  assert.equal(V.exchange(s, 'timber', 1), false);
  assert.ok(V.exchange(s, 'timber', 1, 'sell'));
  assert.ok(V.exchange(s, 'timber', 1));
  for (const q of [0, -1, 1.5, NaN, Infinity])
    assert.equal(V.exchange(s, 'timber', q, 'sell'), false);
  assert.equal(V.exchange(s, 'knowledge', 1, 'sell'), false);
  assert.equal(V.exchange(s, 'bricks', 1, 'sell'), false);
  assert.equal(V.exchange(s, 'timber', 1, 'invalid'), false);
});
test('offline accrual caps storage, kiln consumes actual inputs and duplicate accrual pays nothing', () => {
  const s = fresh();
  s.completed = Array.from({ length: 8 }, (_, i) => 'L' + String(i + 1).padStart(2, '0'));
  s.village.buildings = { I01: 1, I02: 1, I03: 1, I05: 1, I06: 1 };
  V.accrueVillage(s, 86400000);
  assert.equal(s.village.resources.bricks, 100);
  assert.equal(s.village.resources.knowledge, 100);
  assert.equal(s.village.resources.insight, 50);
  const before = JSON.stringify(s.village.resources);
  V.accrueVillage(s, 86400000);
  assert.equal(JSON.stringify(s.village.resources), before);
  s.village.buildings = { I05: 1 };
  s.village.resources.bricks = 0;
  s.village.resources.timber = 3;
  s.village.resources.stone = 4;
  V.accrueVillage(s, 86460000);
  assert.equal(s.village.resources.bricks, 1.5);
  assert.equal(s.village.resources.timber, 0);
  assert.equal(s.village.resources.stone, 1);
});
test('memory boards paginate, mismatches lock two faces and pairs cannot pay twice', () => {
  const s = fresh();
  M.startMemory(s, lessons[0], 6);
  assert.equal(s.memory.deck.length, 12);
  const id = s.memory.deck[0].id,
    wrong = s.memory.deck.findIndex((c) => c.id !== id),
    pair = s.memory.deck.findIndex((c, i) => i && c.id === id);
  M.flip(s, 0);
  assert.equal(M.flip(s, wrong).correct, false);
  assert.equal(M.flip(s, pair), null);
  M.closeMismatch(s);
  M.flip(s, 0);
  assert.equal(M.flip(s, pair).correct, true);
  assert.equal(M.flip(s, 0), null);
  while (!s.memory.complete) {
    assert.equal(s.memory.deck.length, 12);
    for (const c of s.memory.deck) {
      if (s.memory.found.includes(c.id)) continue;
      const slots = s.memory.deck.flatMap((x, i) => (x.id === c.id ? [i] : []));
      M.flip(s, slots[0]);
      M.flip(s, slots[1]);
    }
    assert.ok(M.nextBoard(s));
  }
  assert.equal(s.memory.boards, Math.ceil(lessons[0].pairs.length / 6));
  assert.equal(s.memory.order.length, lessons[0].pairs.length);
});
test('short sets and saved partial boards expand to six distinct pairs without losing matches', () => {
  const s = fresh(),
    pool = lessons[0].pairs;
  M.startMemory(s, { ...lessons[0], pairs: pool.slice(0, 2) }, 6, pool);
  assert.equal(s.memory.deck.length, 12);
  assert.equal(new Set(s.memory.deck.map((c) => c.id)).size, 6);
  s.memory = {
    setId: 'L01',
    level: 1,
    order: pool.map((w) => w.id),
    offset: 0,
    size: 5,
    boards: 0,
    deck: pool.slice(0, 5).flatMap((w) => [
      { id: w.id, side: 'cn' },
      { id: w.id, side: 'en' },
    ]),
    found: [pool[0].id],
    open: [2],
    complete: false,
  };
  const original = structuredClone(s.memory.deck);
  M.ensureFullBoard(s, pool);
  assert.equal(s.memory.deck.length, 12);
  assert.deepEqual(s.memory.deck.slice(0, 10), original);
  assert.deepEqual(s.memory.open, [2]);
  assert.deepEqual(s.memory.found, [pool[0].id]);
  assert.ok(s.memory.deck.some((c) => c.id === pool[5].id));
});
test('prestige resets all village resources and memory but keeps preferences/history', () => {
  const s = fresh();
  s.completed = ['L01'];
  s.history = { L01: true };
  s.settings.muted = true;
  s.village.buildings.I03 = 2;
  s.village.resources.knowledge = 20;
  M.startMemory(s, lessons[0]);
  assert.ok(E.prestigeReset(s, lessons, 100));
  assert.deepEqual(s.village.buildings, {});
  assert.equal(s.village.resources.knowledge, 0);
  assert.equal(s.memory, undefined);
  assert.equal(s.settings.muted, true);
  assert.equal(s.history.L01, true);
  assert.equal(s.prestige, 1);
  assert.equal(E.idleRate(s), 0);
});
test('storage instalments complete without a storage deadlock', () => {
  const s = fresh();
  s.completed = ['L01', 'L02'];
  s.coins = 1000;
  s.village.resources.timber = 10;
  s.village.resources.stone = 5;
  assert.ok(V.fundStorage(s));
  assert.equal(V.buildingCount(s), 0);
  assert.ok(s.village.installment);
  s.village.resources.timber = 10;
  s.village.resources.stone = 5;
  V.fundStorage(s);
  assert.equal(s.village.installment, undefined);
  assert.equal(s.village.buildings.I04, 1);
  assert.equal(V.capacity(s, 'knowledge'), 200);
});
