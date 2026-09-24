import test from 'node:test';
import assert from 'node:assert/strict';
import { queueCardRewards, dismissCardToast } from '../reward-toasts.mjs';
test('card rewards queue individually and resume play without waiting', () => {
  const s = {
    stage: 'cardReward',
    prestige: 0,
    setIndex: 0,
    coins: 100,
    cards: { L01: ['a', 'b', 'c'] },
    pendingReward: { ids: ['a', 'b', 'c'], before: 2, total: 10, resume: 'self-test' },
  };
  queueCardRewards(s, [{ id: 'L01' }]);
  assert.equal(s.stage, 'self-test');
  assert.equal(s.pendingReward, null);
  assert.deepEqual(
    s.cardToasts.map((t) => t.after),
    [3, 4, 5],
  );
  assert.equal(s.coins, 100);
  const first = s.cardToasts[0].key;
  assert.ok(dismissCardToast(s, first));
  assert.equal(dismissCardToast(s, first), false);
  assert.equal(s.cardToasts.length, 2);
  const copy = JSON.parse(JSON.stringify(s));
  assert.equal(copy.cardToasts[0].cardId, 'b');
});
test('old partially revealed rewards and new batches keep their order and set', () => {
  const s = {
    stage: 'cardReward',
    prestige: 1,
    setIndex: 0,
    pendingReward: { ids: ['a', 'b'], revealIndex: 1, before: 0, total: 2, allDone: true },
  };
  queueCardRewards(s, [{ id: 'L01' }]);
  assert.equal(s.stage, 'setReward');
  assert.deepEqual(
    s.cardToasts.map((t) => t.cardId),
    ['b'],
  );
  s.setIndex = 1;
  s.stage = 'cardReward';
  s.pendingReward = { ids: ['c'], before: 0, total: 3, resume: 'order' };
  queueCardRewards(s, [{ id: 'L01' }, { id: 'L02' }]);
  assert.deepEqual(
    s.cardToasts.map((t) => t.setId),
    ['L01', 'L02'],
  );
  assert.equal(new Set(s.cardToasts.map((t) => t.key)).size, 2);
  assert.equal(s.stage, 'order');
});
