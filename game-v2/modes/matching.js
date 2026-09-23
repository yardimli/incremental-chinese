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
  go,
  gameClock,
  $,
  setDebugAction,
} from '../shared.js';
import * as E from '../engine.mjs';
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
let boardKey,
  interacted = false,
  feedback = '';
export function drawMatch() {
  busy = false;
  selected = null;
  pairActivity?.abort();
  pairActivity = new AbortController();
  const ids = E.matchBoard(state);
  const key = JSON.stringify([
    state.setIndex,
    state.pageIndex,
    state.matchOrder,
    state.resetToken,
    E.levelAccuracy(state).attempt,
  ]);
  if (key !== boardKey) {
    boardKey = key;
    interacted = false;
    feedback = '';
  }
  setDebugAction(() => {
    const id = ids.find((id) => !state.matchFound.includes(id));
    if (!id) return;
    selected = null;
    screen.querySelector('[data-side="cn"][data-id="' + id + '"]').click();
    screen.querySelector('[data-side="en"][data-id="' + id + '"]').click();
  });
  // Stable order survives rewards and reloads, without modifying the save.
  const order = E.shuffle(
    {
      rng: state.prestige * 10007 + state.setIndex * 101 + state.pageIndex + 17,
    },
    ids,
  );
  render(
    screen,
    view('tpl-drawMatch-47', [
      joinParts(
        ids.map((id, i) =>
          view('tpl-matching-46', [
            state.matchFound.includes(id) ? 'matched' : '',
            id,
            state.matchFound.includes(id) ? 'disabled' : '',
            textCard(word(id)),
            state.matchFound.includes(order[i]) ? 'matched' : '',
            order[i],
            state.matchFound.includes(order[i]) ? 'disabled' : '',
            wrapNumberLabel(englishCardLabel(word(order[i]))),
          ]),
        ),
        '',
      ),
    ]),
  );
  function drawFeedback() {
    const status = $('.status');
    status.classList.toggle('match-help', !interacted);
    render(
      status,
      !interacted
        ? ui('Tap two cards or drag one onto its pair.')
        : feedback && !feedback.startsWith('+')
          ? ui(feedback)
          : feedback,
    );
  }
  function beginAction() {
    if (interacted) return;
    interacted = true;
    drawFeedback();
  }
  drawFeedback();
  $('.match-board').addEventListener(
    'pointerdown',
    (event) => {
      const card = event.target.closest('.match-tile');
      if (card && !card.disabled && !busy) beginAction();
    },
    { signal: pairActivity.signal },
  );
  $('.match-board').onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || busy) return;
    beginAction();
    if (!selected || selected.dataset.side === b.dataset.side) {
      selected?.classList.remove('selected');
      selected = b;
      b.classList.add('selected');
      return;
    }
    const a = selected;
    selected = null;
    submitPair(a, b);
  };
  async function submitPair(a, b) {
    if (busy || a.disabled || b.disabled) return;
    beginAction();
    busy = true;
    selected?.classList.remove('selected');
    selected = null;
    const { result } = await transact((s) => E.matchPair(s, lessons, a.dataset.id, b.dataset.id));
    if (!result) {
      go();
      return;
    }
    if (!result.correct) {
      [a, b].forEach((n) => {
        n.classList.remove('selected');
        n.classList.add('wrong');
      });
      feedback = 'Try another pair.';
      drawFeedback();
      feedbackTimer = setTimeout(() => {
        busy = false;
        drawMatch();
      }, 650);
    } else {
      [a, b].forEach((n) => {
        n.classList.remove('selected');
        n.classList.add('matched');
        // busy blocks input during feedback. Let the template own disabled so
        // recycled buttons are enabled correctly when the next board appears.
      });
      feedback = '+' + result.points;
      drawFeedback();
      feedbackTimer = setTimeout(go, 550);
    }
  }
  screen.querySelectorAll('.match-tile').forEach((card) =>
    bindPairDrag(card, {
      signal: pairActivity.signal,
      enabled: () => !busy,
      getTargets: () =>
        [...screen.querySelectorAll('.match-tile')].filter(
          (el) => el.dataset.side !== card.dataset.side,
        ),
      onDrop: (other) => submitPair(card, other),
    }),
  );
}
export function dispose() {
  pairActivity?.abort();
  battle?.dispose();
  arenaActivity?.abort();
  clearTimeout(feedbackTimer);
  clearTimeout(arenaTimer);
}
