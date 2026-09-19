import { ui, uiText } from '../ui/interface-text.js';
import { view, render, joinParts } from '../ui/templates.js';
import {
  state,
  lessons,
  screen,
  textCard,
  transact,
  gameClock,
  word,
  speech,
  setDebugAction,
  esc,
} from '../shared.js';
import * as M from './memory-state.mjs';
import * as E from '../engine.mjs';
import { catalogue } from '../systems/village.mjs';
let busy = false,
  timer,
  boardKey;
function available() {
  return M.memorySets(state, lessons);
}
export function drawMemory() {
  gameClock.clearTimeout(timer);
  busy = false;
  const m = state.memory;
  if (!m) {
    const sets = available();
    render(
      screen,
      view('tpl-drawMemory-54', [
        joinParts(
          sets.map((s) =>
            view('tpl-memory-52', [
              s.id,
              textCard(s),
              s.pairs.length,
              E.payout(state, 'M', 2, s.level),
            ]),
          ),
          '',
        ),
        !sets.length ? view('tpl-drawMemory-53', []) : '',
      ]),
    );
    screen.querySelectorAll('[data-memory-set]').forEach(
      (b) =>
        (b.onclick = async () => {
          await transact((s) =>
            M.startMemory(
              s,
              sets.find((x) => x.id === b.dataset.memorySet),
              catalogue().progression.memoryPairs,
              sets.flatMap((set) => set.pairs),
            ),
          );
          drawMemory();
        }),
    );
    return;
  }
  if (m.complete) {
    render(screen, view('tpl-drawMemory-55', [m.order.length]));
    screen.querySelector('#memory-again').onclick = async () => {
      await transact((s) => delete s.memory);
      drawMemory();
    };
    return;
  }
  const done = m.found.length === m.deck.length / 2;
  const key = JSON.stringify([
    m.setId,
    m.offset,
    m.deck,
    state.settings.script,
    state.settings.display,
  ]);
  // Keep each card mounted for the whole board. Updating one card must not
  // restart animations (or speech highlights) on its neighbours.
  if (boardKey !== key || !screen.querySelector('.memory-grid')) {
    boardKey = key;
    render(
      screen,
      view('tpl-drawMemory-58', [
        m.boards + 1,
        '',
        Math.ceil(m.order.length / m.size),
        m.order.length,
        joinParts(
          m.deck.map((c, i) => {
            const w = word(c.id),
              face = m.found.includes(c.id) || m.open.includes(i);
            return view('tpl-memory-57', [
              face ? 'face-up' : '',
              i,
              c.side === 'cn'
                ? textCard(w)
                : view('tpl-memory-56', [
                    esc(w.number >= 10 ? w.number.toLocaleString('en-US') : w.english),
                  ]),
            ]);
          }),
          '',
        ),
      ]),
    );
  }
  screen.querySelector('[data-memory-count]').textContent =
    m.found.length + ' / ' + m.deck.length / 2;
  screen.querySelector('progress').value =
    m.offset +
    m.found.filter((id) => m.order.slice(m.offset, m.offset + m.size).includes(id)).length;
  screen.querySelectorAll('[data-flip]').forEach((b) => {
    const i = Number(b.dataset.flip),
      c = m.deck[i],
      w = word(c.id),
      found = m.found.includes(c.id),
      face = found || m.open.includes(i);
    b.classList.toggle('face-up', face);
    b.classList.toggle('remembered', found);
    b.disabled = found;
    b.setAttribute(
      'aria-label',
      face ? (c.side === 'cn' ? w.pinyin : w.english) : uiText('Hidden card {0}', i + 1),
    );
    b.querySelector('.memory-front').setAttribute('aria-hidden', String(!face));
  });
  render(
    screen.querySelector('.memory-status'),
    ui(
      done
        ? 'Board cleared!'
        : m.open.length === 2
          ? 'Remember those places.'
          : 'Find the Chinese–English pairs.',
    ),
  );
  render(
    screen.querySelector('.memory-actions'),
    done
      ? view('tpl-drawMemory-59', [
          ui(m.offset + m.size >= m.order.length ? 'Finish set' : 'Next board'),
        ])
      : '',
  );
  screen.querySelector('#memory-back').onclick = async () => {
    await transact((s) => delete s.memory);
    drawMemory();
  };
  screen
    .querySelectorAll('[data-flip]')
    .forEach((b) => (b.onclick = () => turn(Number(b.dataset.flip))));
  const nextButton = screen.querySelector('#memory-next');
  if (nextButton)
    nextButton.onclick = async () => {
      await transact(M.nextBoard);
      drawMemory();
    };
  if (m.open.length === 2) {
    busy = true;
    timer = gameClock.setTimeout(async () => {
      await transact(M.closeMismatch);
      drawMemory();
      busy = true;
      // Keep input locked until both cards have turned back over.
      timer = gameClock.setTimeout(() => {
        busy = false;
      }, 280);
    }, 850);
  }
  setDebugAction(() => {
    if (done) {
      screen.querySelector('#memory-next').click();
      return;
    }
    const first = m.deck.findIndex((c) => !m.found.includes(c.id)),
      second = m.deck.findIndex((c, i) => i !== first && c.id === m.deck[first].id);
    turn(first).then(() => turn(second));
  });
}
async function turn(index) {
  if (busy || gameClock.paused) return;
  busy = true;
  const { result } = await transact((s) => {
    const r = M.flip(s, index);
    if (r?.correct) {
      r.points = E.award(s, 'M', catalogue().progression.memoryPairWeight, s.memory.level);
      if (r.boardBonus)
        r.points += E.award(s, 'M', catalogue().progression.memoryBoardWeight, s.memory.level);
    }
    return r;
  });
  busy = false;
  drawMemory();
  const card = state.memory.deck[index];
  if (result && card.side === 'cn') {
    const element = () => screen.querySelector('[data-flip="' + index + '"]');
    speech.speak(word(card.id).traditional, {
      interrupt: true,
      element,
    });
  }
  if (result?.correct)
    render(screen.querySelector('.memory-status'), ui('+{0} coins', result.points));
}
export function dispose() {
  gameClock.clearTimeout(timer);
  busy = false;
}
