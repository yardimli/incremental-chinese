import { showEnglish } from '../systems/translations.mjs';

let catalogue = {},
  getState = () => ({ settings: {} });
export function configureInterfaceText(messages, state) {
  catalogue = messages;
  getState = state;
}
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
function interpolate(pattern, args, language) {
  return pattern.split(/(\{\d+\})/).map((part) => {
    const match = part.match(/^\{(\d+)\}$/);
    if (!match) return part;
    const value = args[Number(match[1])] ?? '';
    // Nested interface terms use the same language as the surrounding sentence.
    return value?.template === 'tpl-interface-text' ? value.values[language] : value;
  });
}
export function ui(key, ...args) {
  key = normalize(key);
  const entry = catalogue[key];
  if (!entry) throw new Error('Missing interface translation: ' + key);
  const state = getState() || { settings: {} },
    settings = state.settings;
  return {
    template: 'tpl-interface-text',
    values: [
      settings.display === 'pinyin'
        ? ''
        : interpolate(
            entry[settings.script === 'simplified' ? 'simplified' : 'traditional'],
            args,
            0,
          ),
      settings.display === 'characters' ? '' : interpolate(entry.pinyin, args, 1),
      showEnglish(state) ? interpolate(entry.english || key, args, 2) : '',
    ],
  };
}
function plain(value) {
  if (Array.isArray(value)) return value.map(plain).join('');
  return value?.template ? value.values.map(plain).join(' ') : String(value ?? '');
}
export function uiText(key, ...args) {
  return ui(key, ...args)
    .values.map(plain)
    .filter(Boolean)
    .join(' · ');
}
export function uiPattern(pattern, values, attribute = false) {
  const args = [];
  const key = normalize(pattern).replace(/\{\{(\d+)\}\}/g, (_, index) => {
    args.push(values[Number(index)]);
    return '{' + (args.length - 1) + '}';
  });
  return attribute ? uiText(key, ...args) : ui(key, ...args);
}
