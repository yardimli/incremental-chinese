// Roll independently for each rendered English card, without changing its ID.
export function englishCardLabel(word, random = Math.random) {
  if (!Number.isFinite(word.number)) return word.english;
  if (word.number >= 10 || random() < 0.6) return word.number.toLocaleString('en-US');
  return word.english;
}
