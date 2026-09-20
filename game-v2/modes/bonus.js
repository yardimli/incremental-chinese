import { ui } from '../ui/interface-text.js';
import { view, render, joinParts } from '../ui/templates.js';
import {
  state,
  lessons,
  screen,
  word,
  textCard,
  wrapNumberLabel,
  transact,
  gameClock,
  $,
  setDebugAction,
} from '../shared.js';
import * as E from '../engine.mjs';
import { recordActive } from '../systems/economy.mjs';
import { bonusReward } from './bonus-rewards.mjs';
import { bindPairDrag } from '../pair-drag.js';
import { englishCardLabel } from '../card-labels.mjs';
const setTimeout = (...args) => gameClock.setTimeout(...args),
  clearTimeout = (...args) => gameClock.clearTimeout(...args);
let busy = false,
  selected = null,
  placed = [],
  dragIndex = null,
  feedbackTimer,
  arenaTimer,
  arenaActivity,
  battle,
  pairActivity,
  bonusQ = null;
let correctAnswers = 0;
export function drawBonus() {
  pairActivity?.abort();
  pairActivity = new AbortController();
  const unlocked = lessons
    .slice(0, state.setIndex + 1)
    .filter((x) => x.type === 'pairs')
    .flatMap((x) => x.pairs)
    .filter(
      (w) =>
        state.seen.includes(w.id) || Object.values(state.cards).some((ids) => ids.includes(w.id)),
    );
  if (!unlocked.length) {
    render(screen, view('tpl-drawBonus-43', []));
    return;
  }
  if (!bonusQ) {
    const rng = {
        rng: Date.now() >>> 0,
      },
      w = E.shuffle(rng, unlocked)[0];
    bonusQ = {
      id: w.id,
      options: E.shuffle(rng, [
        w,
        ...E.shuffle(
          rng,
          unlocked.filter(
            (p) => p.id !== w.id && (w.number === undefined || p.number !== w.number),
          ),
        ).slice(0, 3),
      ]),
    };
  }
  render(
    screen,
    view('tpl-drawBonus-45', [
      textCard(word(bonusQ.id)),
      joinParts(
        bonusQ.options.map((w) =>
          view('tpl-bonus-44', [w.id, wrapNumberLabel(englishCardLabel(w))]),
        ),
        '',
      ),
    ]),
  );
  screen.querySelectorAll('[data-bonus]').forEach(
    (b) =>
      (b.onclick = async () => {
        if (busy) return;
        const right = b.dataset.bonus === bonusQ.id;
        if (!right) {
          render($('.status'), ui('Try again'));
          return;
        }
        busy = true;
        const points = bonusReward(correctAnswers + 1);
        await transact((s) => recordActive(s, points));
        correctAnswers++;
        render($('.status'), '+' + points);
        feedbackTimer = setTimeout(() => {
          busy = false;
          bonusQ = null;
          drawBonus();
        }, 700);
      }),
  );
  setDebugAction(() => screen.querySelector('[data-bonus="' + bonusQ.id + '"]').click());
  const target = screen.querySelector('.bonus-target');
  const answers = [...screen.querySelectorAll('[data-bonus]')];
  answers.forEach((card) =>
    bindPairDrag(card, {
      signal: pairActivity.signal,
      enabled: () => !busy,
      getTargets: () => [target],
      onDrop: () => card.click(),
    }),
  );
  if (target)
    bindPairDrag(target, {
      signal: pairActivity.signal,
      enabled: () => !busy,
      getTargets: () => answers,
      onDrop: (card) => card.click(),
    });
}
export function dispose() {
  correctAnswers = 0;
  bonusQ = null;
  busy = false;
  pairActivity?.abort();
  battle?.dispose();
  arenaActivity?.abort();
  clearTimeout(feedbackTimer);
  clearTimeout(arenaTimer);
}
