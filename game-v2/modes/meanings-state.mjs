import { shuffle, award, recordAnswer } from '../engine.mjs';
import { prepareMeaningPrompt } from '../vocabulary.mjs';
export function answerMeaning(s, set, id) {
  const run = s.meanings;
  if (
    s.stage !== 'meanings' ||
    !run?.options.includes(id) ||
    run.found.includes(id) ||
    run.rejected.includes(id)
  )
    return null;
  const words = set.pairs.filter((w) => w.meaningGroup === run.deck[run.index]);
  const correct = words.some((w) => w.id === id);
  recordAnswer(s, correct);
  if (!correct) {
    run.rejected.push(id);
    return { correct, points: 0 };
  }
  run.found.push(id);
  const points = award(s, 'M', 2);
  if (run.found.length === words.length) {
    const owned = s.cards[set.id] || [];
    const ids = words.map((w) => w.id).filter((id) => !owned.includes(id));
    run.index++;
    const resume = run.index === run.deck.length ? 'setReward' : 'meanings';
    if (resume === 'meanings') prepareMeaningPrompt(s, set, shuffle);
    s.stage = resume;
    if (ids.length) {
      s.cards[set.id] = [...owned, ...ids];
      s.pendingReward = {
        ids,
        before: owned.length,
        after: owned.length + ids.length,
        total: set.pairs.length,
        resume,
      };
      s.stage = 'cardReward';
    }
  }
  return { correct, points };
}
