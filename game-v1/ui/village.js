import { compactLabel, productionRate, bindShopHelp } from './shop-details.js';
import { ui, reasonLabel, reasonText } from './interface-text.js';
import { view, render, joinParts } from '../ui/templates.js';
import { state, screen, textCard, transact, esc } from '../shared.js';
import * as V from '../systems/village.mjs';
import { buttonLabel, actionLabel, refreshButtonLabels } from './button-labels.js';
export const sprite = (id) => view('tpl-village-60', [id]);
export function price(cost) {
  return joinParts(
    Object.entries(cost)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => view('tpl-village-61', [sprite(id), Math.ceil(n).toLocaleString()])),
    '',
  );
}
export function resourceBar() {
  return view('tpl-resourceBar-63', [
    joinParts(
      V.catalogue().resources.map((r) =>
        view('tpl-village-62', [esc(r.pinyin), sprite(r.id), textCard(r), r.id, r.id]),
      ),
      '',
    ),
  ]);
}
let tabView = 'build',
  filter = 'Infrastructure',
  pending = false;
export function refreshEconomyUI() {
  if (!state) return;
  const v = V.ensureVillage(state),
    rates = V.rates(state);
  document
    .querySelectorAll('[data-resource]')
    .forEach(
      (n) =>
        (n.textContent =
          Math.floor(v.resources[n.dataset.resource]).toLocaleString() +
          ' / ' +
          V.capacity(state, n.dataset.resource)),
    );
  document
    .querySelectorAll('[data-production]')
    .forEach((n) =>
      render(n, ui('{0}+{1}/min', '', (rates[n.dataset.production] || 0).toFixed(2))),
    );
  document.querySelectorAll('[data-building]').forEach((n) => {
    const b = V.catalogue().buildings.find((b) => b.id === n.dataset.building),
      reason = V.buildingLock(state, b);
    n.disabled = !!reason;
    render(n, actionLabel('build', reason, state));
    n.title = reasonText(reason);
  });
  document.querySelectorAll('[data-exchange]').forEach((n) => {
    const quote = V.exchangeQuote(
      state,
      n.dataset.exchange,
      Number(n.dataset.quantity),
      n.dataset.direction,
    );
    n.disabled = !!quote.reason;
    n.title = reasonText(quote.reason);
  });
  document.querySelectorAll('[data-trade-help]').forEach((n) => {
    const id = n.dataset.tradeHelp,
      room = Math.max(0, Math.floor(V.capacity(state, id) - v.resources[id]));
    render(
      n,
      room < 1
        ? ui('Storage full — sell materials or expand storage before buying.')
        : ui('{0} storage spaces available', room),
    );
  });
}
export function drawVillage() {
  const v = V.ensureVillage(state),
    catalogue = V.catalogue(),
    active = new Set(V.activeBuildings(state).map((b) => b.id));
  render(
    screen,
    view('tpl-drawVillage-64', [
      null,
      V.buildingCount(state),
      V.multiplier(state, 'W').toFixed(2),
      resourceBar(),
      tabView === 'build',
      tabView === 'exchange',
    ]),
  );
  const list = screen.querySelector('#village-list');
  if (tabView === 'exchange')
    render(
      list,
      view('tpl-drawVillage-67', [
        joinParts(
          catalogue.resources
            .filter((r) => r.exchange && r.level <= V.frontier(state))
            .map((r) =>
              view('tpl-village-66', [
                sprite(r.id),
                textCard(r),
                joinParts(
                  ['buy', 'sell'].flatMap((direction) =>
                    [1, 10].map((q) => {
                      const quote = V.exchangeQuote(state, r.id, q, direction);
                      return view('tpl-village-65', [
                        r.id,
                        direction,
                        q,
                        buttonLabel(direction, state, q),
                        '',
                        quote.coins.toLocaleString(),
                      ]);
                    }),
                  ),
                  '',
                ),
                r.id,
              ]),
            ),
          '',
        ),
      ]),
    );
  else {
    render(
      list,
      view('tpl-drawVillage-77', [
        joinParts(
          ['Infrastructure', 'Trade', 'Community', 'Study'].map((p) =>
            view('tpl-village-68', [p, p === filter, buttonLabel(p, state)]),
          ),
          '',
        ),
        joinParts(
          catalogue.buildings
            .filter((b) => b.level <= V.frontier(state) && b.path === filter)
            .sort(
              (a, b) =>
                Number(!!b.research && v.research.includes(b.research)) -
                Number(!!a.research && v.research.includes(a.research)),
            )
            .map((b) => {
              const count = v.buildings[b.id] || 0,
                rate = joinParts(
                  Object.entries(b.output)
                    .filter(([, n]) => n > 0)
                    .map(([id, n]) => productionRate(sprite(id), n)),
                  ' ',
                );
              return view('tpl-village-73', [
                count && !active.has(b.id) ? 'dormant' : '',
                sprite(
                  b.path === 'Infrastructure'
                    ? b.storage
                      ? 'storage'
                      : Object.keys(b.output)[0]
                    : 'village',
                ),
                textCard(b),
                count,
                compactLabel('L{0} · {1}{2}', b.level, ui(b.path), ''),
                null,
                b.scope
                  ? [
                      ' · +',
                      b.contribution,
                      '× ',
                      ui({ W: 'hits', M: 'pairs', S: 'sentences' }[b.scope]),
                    ]
                  : '',
                [
                  rate,
                  b.scope
                    ? compactLabel(
                        'Reward multiplier: +{0}× {1}',
                        b.contribution,
                        ui({ W: 'hits', M: 'pairs', S: 'sentences' }[b.scope]),
                      )
                    : '',
                ],
                b.id === 'I05' ? ui('Kiln input: −4 timber −4 stone/min') : '',
                view('tpl-village-70', []),
                price(V.buildingCost(state, b)),
                count && !active.has(b.id) ? view('tpl-village-72', [ui(b.path)]) : '',
                b.id,
              ]);
            }),
          '',
        ),
        V.frontier(state) >= 2
          ? view('tpl-drawVillage-76', [
              v.installment ? view('tpl-drawVillage-74', [price(v.installment.remaining)]) : '',
              V.frontier(state) < 2 ? 'disabled' : '',
              v.installment ? view('tpl-drawVillage-75', []) : '',
            ])
          : '',
      ]),
    );
  }
  screen.querySelectorAll('[data-view]').forEach(
    (b) =>
      (b.onclick = () => {
        tabView = b.dataset.view;
        drawVillage();
      }),
  );
  screen.querySelectorAll('[data-filter]').forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        drawVillage();
      }),
  );
  async function action(fn) {
    if (pending) return;
    pending = true;
    try {
      const { result } = await transact(fn);
      const top = list.scrollTop;
      drawVillage();
      screen.querySelector('#village-list').scrollTop = top;
      return result;
    } finally {
      pending = false;
    }
  }
  screen
    .querySelectorAll('[data-building]')
    .forEach((b) => (b.onclick = () => action((s) => V.buyBuilding(s, b.dataset.building))));
  screen.querySelectorAll('[data-exchange]').forEach(
    (b) =>
      (b.onclick = async () => {
        const { exchange: id, direction, quantity } = b.dataset,
          q = Number(quantity);
        const result = await action((s) => {
          const quote = V.exchangeQuote(s, id, q, direction);
          return {
            ...quote,
            done: V.exchange(s, id, q, direction),
          };
        });
        const status = screen.querySelector('.trade-status');
        if (status && result)
          render(
            status,
            result.done
              ? ui(
                  direction === 'buy' ? 'Bought {0} · −{1} coins' : 'Sold {0} · +{1} coins',
                  q,
                  result.coins.toLocaleString(),
                )
              : reasonLabel(result.reason),
          );
      }),
  );
  screen.querySelector('#fund-storage')?.addEventListener('click', () => action(V.fundStorage));
  screen
    .querySelector('#cancel-storage')
    ?.addEventListener('click', () => action((s) => delete s.village.installment));
  bindShopHelp(screen);
  refreshButtonLabels(screen, state);
  refreshEconomyUI();
}
