import test from 'node:test';
import assert from 'node:assert/strict';
import { bonusReward } from '../modes/bonus-rewards.mjs';
test('bonus gains increase by two through ten, then by one through twenty', () => {
  assert.deepEqual(
    Array.from({ length: 17 }, (_, i) => bonusReward(i + 1)),
    [2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 20],
  );
  assert.equal(bonusReward(1000), 20);
});
