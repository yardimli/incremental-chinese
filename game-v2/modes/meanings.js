import { view, render, joinParts } from '../ui/templates.js';
import { ui } from '../ui/interface-text.js';
import { state, lessons, screen, word, textCard, transact, go, setDebugAction } from '../shared.js';
import { answerMeaning } from './meanings-state.mjs';
let busy = false;
export function drawMeanings() {
  busy = false;
  const set = lessons[state.setIndex],
    run = state.meanings;
  const target = set.pairs.find((w) => w.meaningGroup === run.deck[run.index]);
  render(
    screen,
    view('tpl-meanings', [
      textCard(target),
      joinParts(
        run.options.map((id) =>
          view('tpl-meaning-option', [
            id,
            word(id).english,
            run.found.includes(id) ? 'matched' : run.rejected.includes(id) ? 'incorrect' : '',
            run.found.includes(id) || run.rejected.includes(id) ? 'disabled' : '',
          ]),
        ),
      ),
      run.index,
      run.deck.length,
    ]),
  );
  screen.querySelectorAll('[data-meaning]').forEach((button) => {
    button.onclick = async () => {
      if (busy) return;
      busy = true;
      const { result } = await transact((s) => answerMeaning(s, set, button.dataset.meaning));
      go();
      if (state.stage === 'meanings' && result)
        render(
          screen.querySelector('.status'),
          result.correct ? '+' + result.points : ui('Try again'),
        );
    };
  });
  setDebugAction(() => {
    const id = run.options.find(
      (id) => word(id).meaningGroup === target.meaningGroup && !run.found.includes(id),
    );
    screen.querySelector('[data-meaning="' + id + '"]')?.click();
  });
}
