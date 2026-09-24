// Alternate senses remain real records; ordinary recall uses the primary sense.
export const primaryPairs = (pairs) => pairs.filter((w) => !w.meaningIndex);
export const meaningKey = (word) => word.meaningGroup || word.id;
export function meaningGroups(set) {
  const groups = new Map();
  for (const word of set.pairs || []) {
    if (!word.hasMultipleMeanings) continue;
    const key = meaningKey(word);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }
  return [...groups.values()].filter((words) => words.length > 1);
}

export function startMeaningRun(s, set, shuffle) {
  const groups = meaningGroups(set);
  if (!groups.length) return false;
  s.meanings = {
    deck: shuffle(
      s,
      groups.map((group) => group[0].meaningGroup),
    ),
    index: 0,
    found: [],
    rejected: [],
    options: [],
  };
  prepareMeaningPrompt(s, set, shuffle);
  return true;
}
export function prepareMeaningPrompt(s, set, shuffle) {
  const run = s.meanings;
  const words = set.pairs.filter((w) => w.meaningGroup === run.deck[run.index]);
  const meanings = new Set(words.map((w) => w.english));
  const distractors = shuffle(
    s,
    set.pairs.filter((w) => !meanings.has(w.english)),
  );
  const unique = [...new Map(distractors.map((w) => [w.english, w])).values()];
  run.options = shuffle(s, [...words, ...unique.slice(0, 3)]).map((w) => w.id);
  run.found = [];
  run.rejected = [];
}
