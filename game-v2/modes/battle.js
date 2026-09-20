import { ui } from '../ui/interface-text.js';
import { view, render, replaceView, joinParts } from '../ui/templates.js';
import {
  state,
  lessons,
  screen,
  word,
  textCard,
  wrapNumberLabel,
  dictionary,
  transact,
  go,
  refreshNumbers,
  speech,
  gameClock,
  $,
  setDebugAction,
} from '../shared.js';
import * as E from '../engine.mjs';
import { mountBattle } from '../battle-arena.js';
import { scatterCards } from '../arena-layout.mjs';
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
export function drawTap() {
  busy = false;
  battle?.dispose();
  battle = null;
  if (state.stage === 'tap' && state.difficulty >= 2) {
    arenaActivity?.abort();
    clearTimeout(arenaTimer);
    battle = mountBattle({
      clock: gameClock,
      speak: speech.speak,
      screen,
      getState: () => state,
      word,
      textCard,
      label: (w) => wrapNumberLabel(englishCardLabel(w)),
      dictionary,
      answer: async (choice, id) =>
        (await transact((s) => E.answerTap(s, lessons, choice, id))).result,
      skip: async (id) => (await transact((s) => E.skipTap(s, lessons, id))).result,
      onRoute: go,
      refresh: refreshNumbers,
    });
    setDebugAction(() => battle?.debug());
    return;
  }
  clearTimeout(arenaTimer);
  arenaActivity?.abort();
  if (state.stage === 'finished') {
    render(screen, view('tpl-drawTap-40', [E.idleRate(state).toFixed(2)]));
    return;
  }
  const q = state.current;
  if (!q) return;
  render(
    screen,
    view('tpl-drawTap-42', [
      dictionary(),
      textCard(word(q.id)),
      joinParts(
        q.options.map((id, i) =>
          view('tpl-battle-41', [
            id,
            180 + i * 65,
            '',
            wrapNumberLabel(englishCardLabel(word(id))),
          ]),
        ),
        '',
      ),
    ]),
  );
  const arena = $('.card-arena');
  arena.classList.remove('hit', 'miss', 'escaped');
  render($('.arena-status'), '');
  let topLayer = 2;
  const pieces = [...arena.querySelectorAll('.arena-piece')];
  const dictionaryPage = $('.dictionary-columns');
  const bounds = arena.getBoundingClientRect();
  const dictionaryBottom = dictionaryPage
    ? ((dictionaryPage.getBoundingClientRect().bottom - bounds.top) * arena.clientHeight) /
      bounds.height
    : 0;
  const positions = scatterCards(
    arena.clientWidth,
    arena.clientHeight,
    pieces.length,
    pieces[0].offsetWidth,
    pieces[0].offsetHeight,
    dictionaryBottom,
  );
  pieces.forEach((card, i) => {
    card.style.left = positions[i].x + 'px';
    card.style.top = positions[i].y + 'px';
  });
  setDebugAction(() => resolve(q.id));
  const arm = () => {
    if (gameClock.paused) return;
    clearTimeout(arenaTimer);
    if (!busy && document.visibilityState === 'visible')
      arenaTimer = setTimeout(() => resolve(null), 4000);
  };
  // Any activity within the game keeps the current target alive, including
  // movement over the dictionary or clicks outside the cards.
  arenaActivity = new AbortController();
  for (const event of ['pointermove', 'pointerdown', 'click'])
    document.addEventListener(event, arm, {
      capture: true,
      passive: true,
      signal: arenaActivity.signal,
    });
  async function resolve(choice) {
    if (busy) return;
    busy = true;
    clearTimeout(arenaTimer);
    const { result } = await transact((s) =>
      choice === null ? E.skipTap(s, lessons, q.id) : E.answerTap(s, lessons, choice, q.id),
    );
    if (!result) {
      go();
      return;
    }
    arena.classList.add(result.unanswered ? 'escaped' : result.correct ? 'hit' : 'miss');
    render(
      $('.arena-status'),
      result.unanswered ? '' : result.correct ? '+' + result.points : ui('Miss'),
    );
    if (!result.unanswered) {
      replaceView($('.dictionary'), dictionary(result));
      const target = arena.querySelector('.target-piece');
      const weapon = arena.querySelector('[data-answer="' + choice + '"]');
      const x = weapon.offsetLeft + weapon.offsetWidth / 2,
        y = weapon.offsetTop + weapon.offsetHeight / 2;
      const dx = target.offsetLeft + target.offsetWidth / 2 - x,
        dy = target.offsetTop + target.offsetHeight / 2 - y;
      const shot = document.createElement('span');
      shot.className = 'arena-shot';
      shot.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--dx:' + dx + 'px;--dy:' + dy + 'px';
      arena.append(shot);
    }
    feedbackTimer = setTimeout(go, result.unanswered ? 450 : 800);
  }
  arena.querySelectorAll('.arena-piece').forEach((card) => {
    let drag = null,
      suppressClick = false;
    card.addEventListener(
      'pointerdown',
      (e) => {
        if (busy || e.button !== 0) return;
        clearTimeout(arenaTimer);
        suppressClick = false;
        card.style.zIndex = ++topLayer;
        const rect = arena.getBoundingClientRect();
        drag = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          left: card.offsetLeft,
          top: card.offsetTop,
          sx: arena.clientWidth / rect.width,
          sy: arena.clientHeight / rect.height,
          moved: false,
        };
        card.setPointerCapture(e.pointerId);
      },
      {
        signal: arenaActivity.signal,
      },
    );
    card.addEventListener(
      'pointermove',
      (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        const dx = (e.clientX - drag.x) * drag.sx,
          dy = (e.clientY - drag.y) * drag.sy;
        if (Math.hypot(dx, dy) > 5) drag.moved = true;
        if (!drag.moved) return;
        card.classList.add('dragging');
        card.style.left =
          Math.max(0, Math.min(arena.clientWidth - card.offsetWidth, drag.left + dx)) + 'px';
        card.style.top =
          Math.max(0, Math.min(arena.clientHeight - card.offsetHeight, drag.top + dy)) + 'px';
      },
      {
        signal: arenaActivity.signal,
      },
    );
    const release = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const moved = drag.moved;
      suppressClick = moved || e.type === 'pointercancel';
      drag = null;
      card.classList.remove('dragging');
      arm();
      if (moved && e.type === 'pointerup') {
        const candidates = card.dataset.answer
          ? [arena.querySelector('.target-piece')]
          : [...arena.querySelectorAll('[data-answer]')];
        const other = candidates.find((el) => {
          const r = el.getBoundingClientRect();
          return (
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom
          );
        });
        if (other) resolve(card.dataset.answer || other.dataset.answer);
      }
    };
    card.addEventListener('pointerup', release, {
      signal: arenaActivity.signal,
    });
    card.addEventListener('pointercancel', release, {
      signal: arenaActivity.signal,
    });
    card.addEventListener(
      'click',
      () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        if (card.dataset.answer) resolve(card.dataset.answer);
        else arm();
      },
      {
        signal: arenaActivity.signal,
      },
    );
    card.addEventListener(
      'keydown',
      (e) => {
        const steps = {
          ArrowLeft: [-10, 0],
          ArrowRight: [10, 0],
          ArrowUp: [0, -10],
          ArrowDown: [0, 10],
        };
        if (!steps[e.key] || busy) return;
        e.preventDefault();
        card.style.zIndex = ++topLayer;
        card.style.left =
          Math.max(
            0,
            Math.min(arena.clientWidth - card.offsetWidth, card.offsetLeft + steps[e.key][0]),
          ) + 'px';
        card.style.top =
          Math.max(
            0,
            Math.min(arena.clientHeight - card.offsetHeight, card.offsetTop + steps[e.key][1]),
          ) + 'px';
        arm();
      },
      {
        signal: arenaActivity.signal,
      },
    );
  });
  arm();
}
export function dispose() {
  pairActivity?.abort();
  battle?.dispose();
  arenaActivity?.abort();
  clearTimeout(feedbackTimer);
  clearTimeout(arenaTimer);
}
