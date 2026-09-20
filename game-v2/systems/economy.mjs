// Coin rewards are independent of any building or resource economy.
let progression = {
  baseCoins: 10,
  growth: 1.6,
  prestigeGain: 0.5,
  memoryPairs: 6,
  memoryPairWeight: 2,
  memoryBoardWeight: 5,
  requiredAccuracy: 80,
};
export function configureEconomy(config) {
  progression = config;
}
export const rules = () => progression;
export const base = (level) =>
  Math.round(progression.baseCoins * progression.growth ** Math.max(0, level - 1));
export function recordActive(state, amount) {
  state.coins += amount;
}
