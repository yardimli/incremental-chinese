// One-based correct-answer count within the current Bonus visit.
export function bonusReward(correctAnswer) {
  return Math.min(20, correctAnswer <= 5 ? correctAnswer * 2 : correctAnswer + 5);
}
