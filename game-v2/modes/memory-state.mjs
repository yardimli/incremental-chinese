import { primaryPairs } from '../vocabulary.mjs';
import { shuffle } from '../engine.mjs';
// A saved board pays each pair once, including across navigation/reload.
export function memorySets(s, lessons) {
  return lessons.filter((set) => set.pairs?.length);
}
export function startMemory(s, set, size = 6, pool = set.pairs) {
  const candidates = [...new Set(primaryPairs([...set.pairs, ...pool]).map((w) => w.id))];
  if (candidates.length < 6) return false;
  const order = shuffle(
    s,
    primaryPairs(set.pairs).map((w) => w.id),
  );
  s.memory = {
    setId: set.id,
    level: set.level || 1,
    order,
    pool: candidates,
    offset: 0,
    size: 6,
    boards: 0,
    found: [],
    open: [],
    deck: [],
    complete: false,
  };
  nextBoard(s);
  return s.memory;
}
// Fill short boards with distinct review pairs; retain existing positions,
// flipped cards and matches when upgrading a saved board.
export function ensureFullBoard(s, pool = []) {
  const m = s.memory;
  if (!m || m.complete) return;
  m.pool = [...new Set([...(m.pool || m.order), ...primaryPairs(pool).map((w) => w.id)])];
  if (m.deck.length >= 12) return;
  if (m.deck.length && m.found.length === m.deck.length / 2) m.bonusPaid = true;
  m.size = 6;
  const present = new Set(m.deck.map((c) => c.id));
  const candidates = [
    ...new Set([...m.order.slice(m.offset, m.offset + 6), ...shuffle(s, m.pool)]),
  ].filter((id) => !present.has(id));
  const added = candidates.slice(0, 6 - present.size);
  m.deck.push(
    ...shuffle(
      s,
      added.flatMap((id) => [
        { id, side: 'cn' },
        { id, side: 'en' },
      ]),
    ),
  );
}
export function nextBoard(s) {
  const m = s.memory;
  if (!m || m.complete) return false;
  if (m.deck.length) {
    if (m.found.length !== m.deck.length / 2) return false;
    m.offset += m.size;
    m.boards++;
  }
  if (m.offset >= m.order.length) {
    m.complete = true;
    s.gameCompleted ??= {};
    s.gameCompleted[m.setId] ??= {};
    s.gameCompleted[m.setId].memory = true;
    return true;
  }
  const ids = m.order.slice(m.offset, m.offset + m.size);
  m.deck = shuffle(
    s,
    ids.flatMap((id) => [
      { id, side: 'cn' },
      { id, side: 'en' },
    ]),
  );
  m.found = [];
  m.open = [];
  m.bonusPaid = false;
  ensureFullBoard(s);
  m.deck = shuffle(s, m.deck);
  return true;
}
export function flip(s, index, word = () => null) {
  const m = s.memory,
    c = m?.deck[index];
  if (!c || m.complete || m.open.length >= 2 || m.open.includes(index) || m.found.includes(c.id))
    return null;
  m.open.push(index);
  if (m.open.length < 2) return { pair: false };
  const a = m.deck[m.open[0]],
    b = m.deck[m.open[1]],
    correct =
      a.side !== b.side &&
      (a.id === b.id || (word(a.id)?.english && word(a.id).english === word(b.id)?.english));
  if (correct && a.id !== b.id) {
    // Identical English faces are interchangeable; keep the remaining pair valid.
    const cn = a.side === 'cn' ? a : b,
      en = a.side === 'en' ? a : b;
    const other = m.deck.find((card) => card.side === 'en' && card.id === cn.id);
    other.id = en.id;
    en.id = cn.id;
  }
  if (correct) {
    m.found.push(c.id);
    m.open = [];
  }
  const done = m.found.length === m.deck.length / 2,
    boardBonus = done && !m.bonusPaid;
  if (boardBonus) m.bonusPaid = true;
  return { pair: true, correct, done, boardBonus };
}
export function closeMismatch(s) {
  if (s.memory?.open.length === 2) s.memory.open = [];
}
