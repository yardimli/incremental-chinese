import { helpText, helpWord, closeHelpLabel } from './help-text.js';
import { ui } from './interface-text.js';
import { view, render, appendView } from './templates.js';
import { catalogue } from '../systems/village.mjs';

const flatten = (value) =>
  Array.isArray(value) ? value.map(flatten).join('') : String(value ?? '');
export function compactLabel(key, ...args) {
  const lines = ui(key, ...args)
    .values.map(flatten)
    .filter(Boolean);
  return view('tpl-compact-label', [
    lines[0],
    lines.length > 1 ? view('tpl-compact-gloss', [lines.slice(1).join(' - ')]) : '',
  ]);
}
export function productionRate(icon, amount) {
  return view('tpl-production-rate', [icon, amount, compactLabel('minute')]);
}
export function bindShopHelp(root) {
  if (!root.querySelector('.shop-help-dialog')) appendView(root, view('tpl-shop-help-dialog'));
  const dialog = root.querySelector('.shop-help-dialog');
  root.querySelectorAll('[data-shop-help]').forEach((button) => {
    const isResearch = button.dataset.helpKind === 'research';
    const item = catalogue()[isResearch ? 'research' : 'buildings'].find(
      (entry) => entry.id === button.dataset.shopHelp,
    );
    button.setAttribute('aria-label', 'About ' + item.english);
    button.onclick = () => {
      const research = isResearch ? item : catalogue().research.find((r) => r.id === item.research);
      const previous = catalogue().research.find((r) => r.id === research?.previous);
      const building = isResearch
        ? catalogue().buildings.find((b) => b.id === item.building)
        : item;
      const explanations = [];
      if (isResearch) {
        explanations.push(
          helpText(
            'Research this blueprint once to unlock its building. Purchase construction separately in Village.',
          ),
        );
        if (previous) explanations.push(['Research first: ', helpWord(previous)]);
      } else {
        explanations.push(
          helpText(
            'Each purchase adds one building toward your next journey’s building-count goal. Later copies cost more.',
          ),
        );
        if (research) explanations.push(['Research first: ', helpWord(research)]);
      }
      if (building.storage)
        explanations.push(helpText('This building increases storage capacity for resources.'));
      const output = Object.entries(building.output).filter(([, n]) => n > 0);
      if (output.length)
        explanations.push(
          helpText(
            'Each copy produces ' +
              output.map(([id, n]) => n + ' ' + id).join(', ') +
              ' per minute.',
          ),
        );
      if (building.id === 'I05')
        explanations.push(
          helpText('The kiln consumes 4 timber and 4 stone per minute at full production.'),
        );
      if (building.scope)
        explanations.push(
          helpText(
            'This building improves ' +
              { W: 'hit', M: 'matching', S: 'sentence' }[building.scope] +
              ' rewards. Every copy also counts toward the buildings-owned requirement for the next journey.',
          ),
        );
      render(
        dialog.querySelector('.shop-help-content'),
        view('tpl-shop-help-content', [
          helpWord(item),
          explanations.map((text) => view('tpl-help-paragraph', [text])),
          [previous?.id, research?.id, building.id].filter(Boolean).join(' → '),
        ]),
      );
      dialog.showModal();
    };
  });
  render(dialog.querySelector('button'), closeHelpLabel());
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.onclick = (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  };
}
