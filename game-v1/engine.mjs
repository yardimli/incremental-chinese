import * as V from './systems/village.mjs';
import { reachedLevel } from './systems/translations.mjs';
// Pure state transitions. Every award is committed before its reveal is shown.
export const SAVE_KEY = 'chinese-village-v1';
export function random(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function shuffle(s, items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function validateLessons(lessons) {
  const ids = new Set();
  for (const set of lessons.filter((x) => x.type === 'pairs')) {
    if (!set.pairs.length || set.pairs.length > 20) throw Error('Expected 1–20 cards: ' + set.id);
    for (const pair of set.pairs) {
      if (ids.has(pair.id)) throw Error('Duplicate card');
      ids.add(pair.id);
      for (const key of ['traditional', 'simplified', 'pinyin', 'english'])
        if (!pair[key]) throw Error('Missing ' + key);
    }
  }
  for (const set of lessons.filter((x) => x.type === 'sentences')) {
    if (set.sentences.length < set.countPerRun * 3) throw Error('Sentence pool too small');
    for (const q of set.sentences)
      if (q.tokens.some((id) => !ids.has(id))) throw Error('Unknown token');
  }
}
function prepareSentence(s, set) {
  s.sentencePool = shuffle(
    s,
    set.sentences.map((x) => x.id),
  );
  const prior = s.previousSentences?.[set.id] || [];
  s.sentenceDeck = [
    ...s.sentencePool.filter((id) => !prior.includes(id)),
    ...s.sentencePool.filter((id) => prior.includes(id)),
  ].slice(0, set.countPerRun);
  s.sentenceIndex = 0;
  s.sentenceSolved = [];
}
export function freshState(lessons, now = Date.now(), seed = 42) {
  const s = {
    version: 2,
    coins: 0,
    prestige: 0,
    rng: seed >>> 0,
    lastAccrual: now,
    completed: [],
    cards: {},
    highestLevel: 1,
    settings: {
      script: 'traditional',
      display: 'both',
      voice: 'female',
      muted: false,
      englishTranslations: 'until10',
    },
    setIndex: 0,
    stage: 'tap',
    difficulty: 1,
    correct: {},
    seen: [],
    current: null,
    matchOrder: [],
    matchFound: [],
    pageIndex: 0,
    pendingReward: null,
    sentenceIndex: 0,
    sentenceSolved: [],
    sentenceDeck: [],
    sentencePool: [],
    revision: 0,
  };
  s.previousSentences = {};
  s.history = {};
  V.ensureVillage(s);
  newPrompt(s, lessons);
  return s;
}
export function reconcileLessons(s, lessons) {
  V.ensureVillage(s);
  s.highestLevel = reachedLevel(s);
}
export function levelAccuracy(s) {
  const a = s.accuracy?.[s.setIndex] || { correct: 0, total: 0, attempt: 1 };
  return {
    ...a,
    percent: a.total ? (100 * a.correct) / a.total : 0,
    passed: !a.total || a.correct * 2 >= a.total,
  };
}
function recordAnswer(s, correct) {
  s.accuracy ??= {};
  const a = (s.accuracy[s.setIndex] ??= { correct: 0, total: 0, attempt: 1 });
  a.total++;
  if (correct) a.correct++;
}
function repeatLevel(s, lessons) {
  const previous = levelAccuracy(s);
  s.accuracy ??= {};
  s.accuracy[s.setIndex] = {
    correct: 0,
    total: 0,
    attempt: previous.attempt + 1,
    lastPercent: previous.percent,
  };
  s.seen = [];
  s.correct = {};
  s.difficulty = 1;
  s.current = null;
  s.weapons = [];
  s.arrivals = 0;
  s.matchOrder = [];
  s.matchFound = [];
  s.pageIndex = 0;
  s.pendingReward = null;
  const set = lessons[s.setIndex];
  s.stage = set.type === 'sentences' ? 'order' : 'tap';
  if (s.stage === 'order') prepareSentence(s, set);
  else newPrompt(s, lessons);
}
export const permanent = (s) => 1 + s.prestige * (V.catalogue().progression.prestigeGain ?? 0.5);
export const tapValue = (s) => payout(s, 'W', 1);
export const idleRate = (s) => (V.rates(s).coins || 0) / 60;
export function payout(s, scope, weight, level = s.level || 1) {
  return Math.floor(V.base(level) * weight * permanent(s) * V.multiplier(s, scope));
}
export function award(s, scope, weight, level) {
  const n = payout(s, scope, weight, level);
  V.recordActive(s, n);
  return n;
}
export function accrue(s, now = Date.now()) {
  const result = V.accrueVillage(s, now);
  s.lastAccrual = Math.max(s.lastAccrual, now);
  return result.coins;
}
export function advance(s, lessons) {
  if (s.stage !== 'gate') return false;
  const next = lessons[s.setIndex + 1];
  if (
    next?.type !== 'sentences' &&
    !next?.auxiliary &&
    V.gateStatus(s, s.level || 1).some((g) => g.have < g.need)
  )
    return false;
  if (!next) {
    s.stage = 'finished';
    return true;
  }
  s.setIndex++;
  s.level = next.level;
  s.seen = [];
  s.correct = {};
  s.difficulty = 1;
  s.current = null;
  s.weapons = [];
  s.arrivals = 0;
  s.matchOrder = [];
  s.matchFound = [];
  s.pageIndex = 0;
  s.highestLevel = reachedLevel(s);
  if (s.completed.includes(next.id)) {
    s.stage = 'gate';
    advance(s, lessons);
    return true;
  }
  s.stage = next.type === 'sentences' ? 'order' : 'tap';
  if (s.stage === 'order') prepareSentence(s, next);
  else newPrompt(s, lessons);
  return true;
}
export function newPrompt(s, lessons, resolvedId) {
  if (s.stage !== 'tap') return;
  const pairs = lessons[s.setIndex].pairs;
  let eligible = pairs.filter((x) => (s.correct[x.id] || 0) < 2);
  if (!eligible.length) {
    if (s.difficulty < 4) {
      s.difficulty++;
      s.correct = {};
      s.weapons = [];
      s.current = null;
      eligible = pairs;
    } else {
      s.stage = 'match';
      s.matchOrder = shuffle(
        s,
        pairs.map((x) => x.id),
      );
      s.matchFound = [];
      s.pageIndex = 0;
      s.current = null;
      return;
    }
  }
  if (s.difficulty >= 2) {
    const previous = s.current;
    const weapons = (s.weapons || []).filter((id) => pairs.some((w) => w.id === id));
    const candidates = shuffle(
      s,
      eligible.filter((w) => !weapons.includes(w.id)),
    ).map((w) => w.id);
    for (let i = 0; i < weapons.length; i++)
      if ((s.correct[weapons[i]] || 0) >= 2 && candidates.length) weapons[i] = candidates.pop();
    while (weapons.length < s.difficulty && candidates.length) weapons.push(candidates.pop());
    // Late in a pass, completed weapons remain as inactive equipment.
    for (const w of shuffle(s, pairs))
      if (weapons.length < s.difficulty && !weapons.includes(w.id)) weapons.push(w.id);
    s.weapons = weapons;
    const remaining = (previous?.targets || []).filter(
      (id) => id !== resolvedId && weapons.includes(id) && (s.correct[id] || 0) < 2,
    );
    const available = weapons.filter((id) => (s.correct[id] || 0) < 2 && !remaining.includes(id));
    const fresh = available.filter((id) => id !== previous?.id);
    if (!remaining.length) {
      const pool = fresh.length ? fresh : available;
      if (pool.length) remaining.push(pool[Math.floor(random(s) * pool.length)]);
    }
    s.arrivals = (s.arrivals || 0) + 1;
    if (s.difficulty === 4 && s.arrivals % 3 === 0 && remaining.length < 2) {
      const extra = weapons.filter((id) => (s.correct[id] || 0) < 2 && !remaining.includes(id));
      if (extra.length) remaining.push(extra[Math.floor(random(s) * extra.length)]);
    }
    s.current = { id: remaining[0], targets: remaining, options: [...weapons] };
    return;
  }
  const previous = s.current?.id;
  const alternatives = eligible.filter((x) => x.id !== previous);
  const pool = alternatives.length ? alternatives : eligible;
  const target = pool[Math.floor(random(s) * pool.length)];
  const wrong = shuffle(
    s,
    pairs.filter((x) => x.id !== target.id),
  ).slice(0, s.difficulty - 1);
  s.current = { id: target.id, options: shuffle(s, [target.id, ...wrong.map((x) => x.id)]) };
}
export function answerTap(s, lessons, choice, expectedId) {
  if (
    s.stage !== 'tap' ||
    !s.current ||
    !(s.current.targets || [s.current.id]).includes(expectedId) ||
    !s.current.options.includes(choice)
  )
    return null;
  const id = expectedId;
  const correct = choice === id;
  recordAnswer(s, correct);
  if (!s.seen.includes(id)) s.seen.push(id);
  if (correct) {
    s.correct[id] = (s.correct[id] || 0) + 1;
    award(s, 'W', 1);
  }
  const feedback = { id, correct, points: correct ? tapValue(s) : 0 };
  const set = lessons[s.setIndex];
  const progress =
    (s.difficulty - 1) * set.pairs.length * 2 + Object.values(s.correct).reduce((a, b) => a + b, 0);
  if (correct || s.difficulty === 1) newPrompt(s, lessons, id);
  const quota = Math.round(set.pairs.length * 0.4),
    owned = s.cards[set.id] || [];
  const earned = Math.floor((progress / (set.pairs.length * 8)) * quota);
  if (correct && owned.length < earned) {
    const next = set.pairs.find((w) => s.seen.includes(w.id) && !owned.includes(w.id));
    if (next) {
      const resume = s.stage;
      s.cards[set.id] = [...owned, next.id];
      s.pendingReward = {
        type: 'cards',
        setId: set.id,
        ids: [next.id],
        before: owned.length,
        after: owned.length + 1,
        total: set.pairs.length,
        allDone: false,
        resume,
      };
      s.stage = 'cardReward';
    }
  }
  return feedback;
}
export function skipTap(s, lessons, expectedId) {
  if (s.stage !== 'tap' || !(s.current?.targets || [s.current?.id]).includes(expectedId))
    return null;
  const id = expectedId;
  s.unanswered = (s.unanswered || 0) + 1;
  newPrompt(s, lessons, id);
  return { id, unanswered: true, correct: false, points: 0 };
}
export function matchBoard(s) {
  return s.matchOrder.slice(s.pageIndex * 5, s.pageIndex * 5 + 5);
}
export function matchPair(s, lessons, left, right) {
  if (
    s.stage !== 'match' ||
    !matchBoard(s).includes(left) ||
    !matchBoard(s).includes(right) ||
    s.matchFound.includes(left) ||
    s.matchFound.includes(right)
  )
    return null;
  recordAnswer(s, left === right);
  if (left !== right) return { correct: false, points: 0 };
  s.matchFound.push(left);
  let points = award(s, 'M', 2);
  const set = lessons[s.setIndex];
  const boardDone = matchBoard(s).every((id) => s.matchFound.includes(id));
  if (boardDone) points += award(s, 'M', 5);
  const allDone = s.matchFound.length === set.pairs.length;
  const owned = s.cards[set.id] || [];
  const waiting = s.matchFound
    .filter((id) => !owned.includes(id))
    .slice(0, allDone ? Infinity : Math.max(0, set.pairs.length - owned.length - 1));
  if (waiting.length && (waiting.length >= 2 || boardDone)) {
    s.cards[set.id] = [...owned, ...waiting];
    s.pendingReward = {
      type: 'cards',
      setId: set.id,
      ids: waiting,
      before: owned.length,
      after: owned.length + waiting.length,
      total: set.pairs.length,
      allDone,
    };
    s.stage = 'cardReward';
  }
  if (allDone && !waiting.length) s.stage = 'setReward';
  if (boardDone && !allDone) s.pageIndex++;
  return { correct: true, points };
}
export function continueCardReward(s) {
  if (s.stage !== 'cardReward') return false;
  s.stage = s.pendingReward.resume || (s.pendingReward.allDone ? 'setReward' : 'match');
  s.pendingReward = null;
  return true;
}
export function claimSet(s, lessons) {
  if (s.stage !== 'setReward') return false;
  const set = lessons[s.setIndex];
  if (s.completed.includes(set.id)) return false;
  if (!levelAccuracy(s).passed) {
    repeatLevel(s, lessons);
    return true;
  }
  s.level = set.level || 1;
  collectSetReward(s, set, s.sentenceDeck);
  s.stage = 'gate';
  advance(s, lessons);
  return true;
}
function collectSetReward(s, set, deck) {
  s.completed.push(set.id);
  s.history[set.id] = true;
  let points = award(s, 'set', 10, set.level || 1);
  if (set.id === 'L01') {
    const grant = V.catalogue().progression.settlementGrant;
    V.recordActive(s, grant);
    points += grant;
  }
  if (set.type === 'sentences') s.previousSentences[set.id] = [...deck];
  return points;
}
export const isLocalDebugHost = (hostname) =>
  ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
export function debugCompleteSet(s, lessons, index, hostname) {
  if (!isLocalDebugHost(hostname) || !Number.isInteger(index) || !lessons[index]) return null;
  const set = lessons[index];
  if (s.completed.includes(set.id)) return { completed: false, points: 0 };
  const current = index === s.setIndex;
  let ids;
  if (set.type === 'sentences') {
    if (current && s.sentenceDeck.length === set.countPerRun) ids = [...s.sentenceDeck];
    else {
      const selection = { ...s };
      prepareSentence(selection, set);
      s.rng = selection.rng;
      ids = selection.sentenceDeck;
    }
  } else ids = set.pairs.map((w) => w.id);
  s.cards[set.id] = [...ids];
  const basePoints = collectSetReward(s, set, ids);
  V.recordActive(s, basePoints * 2);
  const points = basePoints * 3;
  s.highestLevel = reachedLevel(s);
  if (current) {
    s.pendingReward = null;
    s.current = null;
    if (set.type === 'sentences') {
      s.sentenceDeck = [...ids];
      s.sentenceSolved = [...ids];
      s.sentenceIndex = ids.length;
    } else {
      s.seen = [...ids];
      s.correct = Object.fromEntries(ids.map((id) => [id, 2]));
      s.difficulty = 4;
      s.matchOrder = [...ids];
      s.matchFound = [...ids];
    }
    s.level = set.level || 1;
    s.stage = 'gate';
    advance(s, lessons);
  }
  return { completed: true, points };
}
export function sentencePrompt(s, lessons) {
  return lessons[s.setIndex].sentences.find((x) => x.id === s.sentenceDeck[s.sentenceIndex]);
}
export function answerSentence(s, lessons, tokens, expectedId) {
  if (s.stage !== 'order') return null;
  const q = sentencePrompt(s, lessons);
  if (q.id !== expectedId) return null;
  const correct = tokens.length === q.tokens.length && tokens.every((x, i) => x === q.tokens[i]);
  recordAnswer(s, correct);
  if (!correct) return { correct: false, points: 0 };
  const points = award(s, 'S', 4);
  s.sentenceSolved.push(q.id);
  const setId = lessons[s.setIndex].id;
  s.cards[setId] = [...new Set([...(s.cards[setId] || []), ...s.sentenceSolved])];
  s.sentenceIndex++;
  if (s.sentenceIndex === lessons[s.setIndex].countPerRun) s.stage = 'setReward';
  return { correct: true, points };
}
export function prestigeReset(s, lessons, now = Date.now()) {
  if (!s.completed.length) return false;
  const settings = { ...s.settings },
    prestige = s.prestige + 1,
    history = { ...s.history },
    previousSentences = { ...s.previousSentences },
    highestLevel = reachedLevel(s);
  const fresh = freshState(lessons, now, s.rng);
  for (const key of Object.keys(s)) delete s[key];
  Object.assign(s, fresh, {
    settings,
    prestige,
    history,
    previousSentences,
    highestLevel,
    resetToken: String(now),
  });
  return true;
}
