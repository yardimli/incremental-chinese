// Convert committed rewards into a persistent, non-blocking presentation queue.
export function queueCardRewards(state, lessons) {
  if (state.stage !== 'cardReward' || !state.pendingReward) return;
  const reward = state.pendingReward;
  state.cardToasts ||= [];
  for (let i = reward.revealIndex || 0; i < reward.ids.length; i++) {
    state.cardToastSequence = (state.cardToastSequence || 0) + 1;
    state.cardToasts.push({
      key: `${state.resetToken || 'run'}:${state.prestige}:${state.cardToastSequence}`,
      cardId: reward.ids[i],
      setId: reward.setId || lessons[state.setIndex].id,
      after: reward.before + i + 1,
      total: reward.total,
    });
  }
  state.stage = reward.resume || (reward.allDone ? 'setReward' : 'match');
  state.pendingReward = null;
}
export function dismissCardToast(state, key) {
  if (state.cardToasts?.[0]?.key !== key) return false;
  state.cardToasts.shift();
  return true;
}
