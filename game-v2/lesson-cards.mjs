// Sentence cards share the same rendering, matching and speech paths as words.
export function prepareLessonCards(lessons) {
  const words = Object.fromEntries(lessons.flatMap((s) => s.pairs || []).map((w) => [w.id, w]));
  for (const set of lessons) {
    for (const q of set.sentences || []) {
      const tokens = q.tokens.map((id) => words[id]);
      q.traditional = tokens.map((w) => w.traditional).join('');
      q.simplified = tokens.map((w) => w.simplified).join('');
      q.pinyin = tokens.map((w) => w.pinyin).join(' ');
    }
    if (set.type === 'sentences') set.pairs = set.sentences.slice(0, set.countPerRun);
  }
  return lessons;
}
