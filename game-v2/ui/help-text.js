import { view } from './templates.js';

let words = [],
  settings = () => ({});
export function configureHelpText(lessons, getSettings) {
  words = lessons.flatMap((lesson) => lesson.pairs || []);
  settings = getSettings;
}
export function helpWord(word, label = word.english) {
  return view('tpl-help-word', [
    label,
    settings().script === 'simplified' ? word.simplified : word.traditional,
    word.pinyin,
  ]);
}
export function helpText(text) {
  // Annotate useful game vocabulary only when that exact term is in a lesson.
  const terms = ['close', 'complete', 'study'];
  const vocabulary = new Map();
  for (const term of terms) {
    const word = words.find((w) => w.english.split(/[(/]/)[0].trim().toLowerCase() === term);
    if (word) vocabulary.set(term, word);
  }
  if (!vocabulary.size) return text;
  const pattern = new RegExp(
    '\\b(' + [...vocabulary.keys()].sort((a, b) => b.length - a.length).join('|') + ')\\b',
    'gi',
  );
  const parts = [];
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(
      text.slice(offset, match.index),
      helpWord(vocabulary.get(match[0].toLowerCase()), match[0]),
    );
    offset = match.index + match[0].length;
  }
  parts.push(text.slice(offset));
  return parts;
}
export function closeHelpLabel() {
  return helpText('Close');
}
