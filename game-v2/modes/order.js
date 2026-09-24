import { primaryPairs } from '../vocabulary.mjs';
import { ui } from '../ui/interface-text.js';
import { view, render, joinParts } from '../ui/templates.js';
import {
  state,
  lessons,
  screen,
  word,
  textCard,
  transact,
  go,
  gameClock,
  esc,
  $,
  setDebugAction,
} from '../shared.js';
import * as E from '../engine.mjs';
import { bindPairDrag } from '../pair-drag.js';
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
let lastQuestion;
export function drawOrder() {
  pairActivity?.abort();
  pairActivity = new AbortController();
  const q = E.sentencePrompt(state, lessons);
  if (lastQuestion !== q.id) {
    lastQuestion = q.id;
    placed = Array(q.tokens.length).fill(undefined);
    busy = false;
  }
  const pool = lessons
    .slice(0, state.setIndex + 1)
    .filter((s) => s.type === 'pairs')
    .flatMap((s) => primaryPairs(s.pairs).map((w) => w.id))
    .filter((id) => !q.tokens.includes(id));
  const rng = {
    rng: state.prestige * 8123 + q.id.length * 71,
  };
  const bank = E.shuffle(rng, [
    ...q.tokens,
    ...E.shuffle(rng, pool).slice(0, 10 - q.tokens.length),
  ]);
  render(
    screen,
    view('tpl-drawOrder-51', [
      esc(q.english),
      q.tokens.length,
      joinParts(
        q.tokens.map((_, i) =>
          view('tpl-order-49', [
            placed[i] !== undefined ? 'filled' : '',
            i,
            placed[i] !== undefined,
            i + 1,
            '',
            placed[i] !== undefined
              ? textCard(word(bank[placed[i]]))
              : view('tpl-order-48', [i + 1, '']),
          ]),
        ),
        '',
      ),
      joinParts(
        bank.map((id, i) =>
          view('tpl-order-50', [i, placed.includes(i) ? 'disabled' : '', textCard(word(id))]),
        ),
        '',
      ),
      placed.every((value) => value !== undefined) ? '' : 'disabled',
    ]),
  );
  $('.choices').onclick = (e) => {
    const b = e.target.closest('[data-choice]');
    if (b && !busy && placed.includes(undefined)) {
      placed[placed.indexOf(undefined)] = Number(b.dataset.choice);
      drawOrder();
    }
  };
  $('.target').onclick = (e) => {
    const b = e.target.closest('[data-slot]');
    if (b && !busy) {
      placed[Number(b.dataset.slot)] = undefined;
      drawOrder();
    }
  };
  const target = $('.target');
  target.ondragstart = (e) => {
    dragIndex = Number(e.target.closest('[data-slot]').dataset.slot);
  };
  target.ondragover = (e) => e.preventDefault();
  target.ondrop = (e) => {
    e.preventDefault();
    const b = e.target.closest('[data-slot]');
    if (b && dragIndex !== null && !busy) {
      const destination = Number(b.dataset.slot);
      [placed[dragIndex], placed[destination]] = [placed[destination], placed[dragIndex]];
      dragIndex = null;
      drawOrder();
    }
  };
  screen.querySelectorAll('[data-choice]').forEach((card) =>
    bindPairDrag(card, {
      signal: pairActivity.signal,
      enabled: () => !busy && placed.includes(undefined),
      getTargets: () => [...screen.querySelectorAll('[data-slot]')],
      onDrop: (slot) => {
        placed[Number(slot.dataset.slot)] = Number(card.dataset.choice);
        drawOrder();
      },
    }),
  );
  screen.querySelectorAll('[data-slot].filled').forEach((card) =>
    bindPairDrag(card, {
      signal: pairActivity.signal,
      enabled: () => !busy,
      getTargets: () => [...screen.querySelectorAll('[data-slot]')],
      onDrop: (slot) => {
        const source = Number(card.dataset.slot),
          destination = Number(slot.dataset.slot);
        [placed[source], placed[destination]] = [placed[destination], placed[source]];
        drawOrder();
      },
    }),
  );
  setDebugAction(() => {
    const used = new Set();
    placed = q.tokens.map((id) => {
      const i = bank.findIndex((v, i) => v === id && !used.has(i));
      used.add(i);
      return i;
    });
    drawOrder();
    $('#check').click();
  });
  $('#check').onclick = async () => {
    if (busy || placed.includes(undefined)) return;
    busy = true;
    const { result } = await transact((s) =>
      E.answerSentence(
        s,
        lessons,
        placed.map((i) => bank[i]),
        q.id,
      ),
    );
    if (!result) {
      go();
      return;
    }
    render($('.status'), result.correct ? '+' + result.points : ui('Try a different order.'));
    if (result.correct) feedbackTimer = setTimeout(go, 600);
    else busy = false;
  };
}
export function dispose() {
  lastQuestion = null;
  placed = [];
  pairActivity?.abort();
  battle?.dispose();
  arenaActivity?.abort();
  clearTimeout(feedbackTimer);
  clearTimeout(arenaTimer);
}
