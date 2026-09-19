import { compactLabel, bindShopHelp } from './shop-details.js';
import { ui, reasonText } from './interface-text.js';
import { view, render, joinParts } from '../ui/templates.js';
import { state, screen, textCard, transact } from '../shared.js';
import { catalogue, ensureVillage, frontier } from '../systems/village.mjs';
import { research, researchLock } from '../systems/technology.mjs';
import { resourceBar, price, sprite, refreshEconomyUI } from './village.js';
import { buttonLabel, actionLabel } from './button-labels.js';
let filter = 'Trade',
  pending = false;
export function refreshTechUI() {
  document.querySelectorAll('[data-tech]').forEach((b) => {
    const node = catalogue().research.find((r) => r.id === b.dataset.tech),
      lock = researchLock(state, node);
    b.disabled = !!lock;
    render(b, actionLabel('research', lock, state));
    b.title = reasonText(lock);
  });
}
export function drawTechnology() {
  const v = ensureVillage(state);
  render(
    screen,
    view('tpl-drawTechnology-80', [
      null,
      v.research.length,
      catalogue().research.filter((r) => r.level <= frontier(state)).length,
      resourceBar(),
      joinParts(
        ['Trade', 'Community', 'Study'].map((p) =>
          view('tpl-technology-78', [p, p === filter, buttonLabel(p, state)]),
        ),
        '',
      ),
      joinParts(
        catalogue()
          .research.filter((r) => r.level <= frontier(state) && r.path === filter)
          .map((r) =>
            view('tpl-technology-79', [
              v.research.includes(r.id) ? 'researched' : '',
              sprite('tech'),
              textCard(r),
              compactLabel('L{0} · {1}{2}', r.level, ui(r.path), ''),
              ui(r.path),
              r.id,
              price(r.cost),
              r.previous ? r.previous + ' → ' : '',
              r.id,
              r.building,
              r.id,
            ]),
          ),
        '',
      ),
    ]),
  );
  screen.querySelectorAll('[data-path]').forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.path;
        drawTechnology();
      }),
  );
  screen.querySelectorAll('[data-tech]').forEach(
    (b) =>
      (b.onclick = async () => {
        if (pending) return;
        pending = true;
        try {
          const top = screen.querySelector('#tech-list').scrollTop;
          await transact((s) => research(s, b.dataset.tech));
          drawTechnology();
          screen.querySelector('#tech-list').scrollTop = top;
        } finally {
          pending = false;
        }
      }),
  );
  bindShopHelp(screen);
  refreshEconomyUI();
  refreshTechUI();
}
