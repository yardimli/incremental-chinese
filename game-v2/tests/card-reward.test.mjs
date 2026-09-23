import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCardReward } from '../engine.mjs';

test('batched cards reveal individually, persist their position and resume only after the last card', () => {
  let state = {
    stage: 'cardReward',
    coins: 123,
    cards: { L01: ['a', 'b', 'c'] },
    pendingReward: { ids: ['a', 'b', 'c'], before: 5, after: 8, total: 13, resume: 'self-test' },
  };
  for (const index of [1, 2]) {
    assert.equal(continueCardReward(state), true);
    assert.equal(state.stage, 'cardReward');
    assert.equal(state.pendingReward.revealIndex, index);
    state = JSON.parse(JSON.stringify(state));
  }
  assert.equal(continueCardReward(state), true);
  assert.equal(state.stage, 'self-test');
  assert.equal(state.pendingReward, null);
  assert.equal(state.coins, 123);
  assert.deepEqual(state.cards.L01, ['a', 'b', 'c']);
  assert.equal(continueCardReward(state), false);
});

test('single and final-set rewards retain their normal next screen', () => {
  for (const [allDone, next] of [
    [false, 'match'],
    [true, 'setReward'],
  ]) {
    const state = { stage: 'cardReward', pendingReward: { ids: ['a'], allDone } };
    continueCardReward(state);
    assert.equal(state.stage, next);
  }
});
