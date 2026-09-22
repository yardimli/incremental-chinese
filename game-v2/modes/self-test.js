import { view, render } from '../ui/templates.js';
import { state, lessons, screen, textCard, word, transact, go, setDebugAction } from '../shared.js';
import * as E from '../engine.mjs';

export function drawSelfTest() {
  const run = state.selfTest;
  const card = word(run.deck[run.index]);
  render(
    screen,
    view('tpl-self-test', [
      textCard(card),
      card.english,
      run.revealed ? '' : 'hidden',
      run.index + 1,
      run.deck.length,
    ]),
  );
  let revealing = false;
  screen.onclick = async (event) => {
    if (event.target.closest('[data-grade], a')) return;
    if (state.stage !== 'self-test' || state.selfTest.revealed || revealing) return;
    revealing = true;
    await transact((s) => {
      if (s.stage === 'self-test' && s.selfTest.deck[s.selfTest.index] === card.id)
        s.selfTest.revealed = true;
    });
    if (state.stage === 'self-test') drawSelfTest();
  };
  screen.querySelectorAll('[data-grade]').forEach((button) => {
    button.onclick = async () => {
      await transact((s) => E.gradeSelfTest(s, lessons, button.dataset.grade === 'true', card.id));
      go();
    };
  });
  setDebugAction(async () => {
    await transact((s) => {
      s.selfTest.revealed = true;
      E.gradeSelfTest(s, lessons, true, card.id);
    });
    go();
  });
}
