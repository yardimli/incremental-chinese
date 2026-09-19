import { configureInterfaceText, ui, uiText, uiPattern } from './ui/interface-text.js';
import { view, render, appendView, joinParts } from './ui/templates.js';
import { configureHelpText, helpText, closeHelpLabel } from './ui/help-text.js';
import { refreshButtonLabels } from './ui/button-labels.js';
import { ensureFullBoard, memorySets } from './modes/memory-state.mjs';
import { showEnglish } from './systems/translations.mjs';
import * as V from './systems/village.mjs';
import { drawVillage, refreshEconomyUI } from './ui/village.js';
import { drawTechnology, refreshTechUI } from './ui/technology.js';
import { drawMemory, dispose as disposeMemory } from './modes/memory.js';
import { drawBonus, dispose as disposedrawBonus } from './modes/bonus.js';
import { drawOrder, dispose as disposedrawOrder } from './modes/order.js';
import { drawMatch, dispose as disposedrawMatch } from './modes/matching.js';
import { drawTap, dispose as disposedrawTap } from './modes/battle.js';
import { createGameClock } from './game-clock.mjs';
import { mountPause } from './pause-game.js';
import { mountInactivity } from './inactivity.js';
const gameClock = createGameClock();
const { setTimeout, clearTimeout } = gameClock;
import { createSpeech } from './speech.js';
import * as E from './engine.mjs';
import { createScoreCounter } from './score-counter.mjs';
let screen, speech, inactivityControl;
const frame = document.querySelector('#game-frame');
const $ = (selector) => screen?.querySelector(selector) || frame.querySelector(selector);
const esc = (value) => String(value ?? '');
function wrapNumberLabel(label) {
  if (!/^\d{1,3}(,\d{3})+$/.test(label)) return esc(label);
  const groups = label.split(',');
  return view('tpl-wrapNumberLabel-3', [
    joinParts(
      groups.map((group, i) => view('tpl-shared-1', [group, i < groups.length - 1 ? ',' : ''])),
      view('tpl-wrapNumberLabel-2', []),
    ),
  ]);
}
let page = 'home';
let idleHome = false;
let lessons,
  state,
  busy = false,
  selected = null,
  placed = [],
  dragIndex = null,
  feedbackTimer,
  arenaTimer,
  arenaActivity,
  debugAction,
  battle,
  pairActivity;
const config = await Promise.all(
  ['progression', 'resources', 'buildings', 'research'].map((name) =>
    fetch('./data/' + name + '.json').then((r) => {
      if (!r.ok) throw Error(name);
      return r.json();
    }),
  ),
);
V.configureVillage(
  Object.fromEntries(
    ['progression', 'resources', 'buildings', 'research'].map((k, i) => [k, config[i]]),
  ),
);
const manifest = await fetch('./lessons/index.json').then((r) => {
  if (!r.ok) throw Error('Cannot load lessons');
  return r.json();
});
lessons = await Promise.all(
  manifest.sets.map((file) =>
    fetch('./lessons/' + file).then((r) => {
      if (!r.ok) throw Error(file);
      return r.json();
    }),
  ),
);
E.validateLessons(lessons);
configureHelpText(lessons, () => state.settings);
const tokens = Object.fromEntries(
  lessons
    .filter((x) => x.type === 'pairs')
    .flatMap((x) => x.pairs)
    .map((x) => [x.id, x]),
);
const read = () => {
  try {
    const s = JSON.parse(localStorage.getItem(E.SAVE_KEY));
    if (s?.version === 2) {
      s.settings = {
        voice: 'female',
        muted: false,
        englishTranslations: 'until10',
        ...s.settings,
      };
      s.settings.soundMode ||= s.settings.muted ? 'none' : 'all';
      E.reconcileLessons(s, lessons);
      ensureFullBoard(
        s,
        memorySets(s, lessons).flatMap((set) => set.pairs),
      );
      if (s.stage === 'tap' && s.difficulty >= 2 && !s.current?.targets) E.newPrompt(s, lessons);
      return s;
    }
  } catch {}
  return E.freshState(lessons, Date.now(), Math.floor(Math.random() * 4294967295));
};
let chain = Promise.resolve();
let scoreCounter;
const balanceBeforeAccrual = read().coins;
function transact(fn = () => null) {
  const work = async () => {
    const run = () => {
      state = read();
      const earned = E.accrue(state);
      const result = fn(state);
      state.revision++;
      localStorage.setItem(E.SAVE_KEY, JSON.stringify(state));
      refreshNumbers();
      return {
        result,
        earned,
      };
    };
    return navigator.locks ? navigator.locks.request(E.SAVE_KEY, run) : run();
  };
  chain = chain.then(work, work);
  return chain;
}
configureInterfaceText(await fetch('./data/ui-text.json').then((r) => r.json()), () => state);
const initial = await transact();
let startingScore = balanceBeforeAccrual;
try {
  const saved = JSON.parse(sessionStorage.getItem('village-score-display'));
  if (saved && saved.prestige === state.prestige && saved.resetToken === (state.resetToken || null))
    startingScore = Math.min(saved.value, state.coins);
} catch {}
scoreCounter = createScoreCounter(startingScore, (value) => {
  document.querySelectorAll('[data-coins]').forEach((n) => {
    const text = value.toLocaleString();
    if (n.textContent !== text) n.textContent = text;
  });
});
const word = (id) => tokens[id];
const hanzi = (w) =>
  esc(state.settings.script === 'simplified' ? w.simplified || w.traditional : w.traditional);
function textCard(w) {
  return view('tpl-textCard-6', [
    state.settings.display !== 'pinyin'
      ? view('tpl-textCard-4', [
          esc(w.traditional),
          Math.max(
            1,
            Array.from(
              state.settings.script === 'simplified'
                ? w.simplified || w.traditional
                : w.traditional,
            ).length,
          ),
          hanzi(w),
        ])
      : '',
    state.settings.display !== 'characters'
      ? view('tpl-textCard-5', [esc(w.traditional), esc(w.pinyin)])
      : '',
    englishTranslation(w),
  ]);
}
function englishTranslation(w) {
  return [
    'sets',
    'village',
    'boosts',
    'tech',
    'card-reward',
    'set-reward',
    'sentence-reward',
  ].includes(page) &&
    showEnglish(state) &&
    w.english
    ? view('tpl-englishTranslation-7', [esc(w.english)])
    : '';
}
const route = (s) =>
  s.stage === 'match'
    ? 'match'
    : s.stage === 'cardReward'
      ? 'card-reward'
      : s.stage === 'setReward'
        ? lessons[s.setIndex].type === 'sentences'
          ? 'sentence-reward'
          : 'set-reward'
        : s.stage === 'order'
          ? 'order'
          : 'home';
const icons = {
  Play: 'M8 4l12 8-12 8z',
  Sets: 'M4 4h12v16H4z M19 7h2v13',
  Village: 'M4 20V12h3v8 M11 20V7h3v13 M18 20V3h3v17',
  Tech: 'M4 11a8 8 0 1 1 2 7 M4 4v7h7',
};
const labels = {
  home: 'Play',
  match: 'Match',
  order: 'Card order',
  sets: 'Sets',
  village: 'Village',
  tech: 'Tech',
  memory: 'Memory',
  boosts: 'Village',
  restart: 'Prestige',
  settings: 'Settings',
  bonus: 'Bonus',
  guide: 'Game guide',
};
const gamePages = ['home', 'match', 'order', 'card-reward', 'set-reward', 'sentence-reward'];
function mountShell() {
  refreshButtonLabels(frame.querySelector('.footer'), state);
  const reward = page.includes('reward');
  frame.dataset.page = page;
  frame.classList.toggle('reward', reward);
  frame.querySelector('.header').hidden = reward;
  frame.querySelector('.footer').hidden = reward;
  if (page === 'guide') render(frame.querySelector('.header h1'), 'Game guide');
  else render(frame.querySelector('.header h1'), ui(labels[page] || 'Play'));
  document.title = page === 'guide' ? 'Game guide' : uiText(labels[page] || 'Play');
  frame
    .querySelectorAll(
      '.header [data-ui-aria-label],.footer[data-ui-aria-label],.accuracy-track[data-ui-aria-label]',
    )
    .forEach((n) => n.setAttribute('aria-label', uiPattern(n.dataset.uiAriaLabel, [], true)));
  frame
    .querySelectorAll('.pause-overlay [data-ui]')
    .forEach((n) => render(n, uiPattern(n.dataset.ui, [])));
  refreshSoundButton();
  frame.querySelector('.accuracy-strip').hidden =
    idleHome || !['home', 'match', 'order'].includes(page);
  frame.querySelectorAll('[data-nav]').forEach((link) => {
    const selected =
      link.dataset.nav === page ||
      (link.dataset.nav === 'home' &&
        ['match', 'order', 'bonus', 'memory', 'restart'].includes(page));
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const tabIcon = frame.querySelector('.footer a.active .sprite');
  const headerIcon = frame.querySelector('.header-tab-icon');
  headerIcon.hidden = !tabIcon;
  if (tabIcon) headerIcon.className = 'header-tab-icon ' + tabIcon.className;
}
const soundModes = ['all', 'lessons', 'none'];
const soundLabels = ['All sounds', 'Lesson sounds only', 'No sound'];
function soundMode() {
  return state.settings.muted ? 'none' : state.settings.soundMode || 'all';
}
function refreshSoundButton() {
  const button = frame.querySelector('.sound-button');
  const mode = soundMode();
  const index = soundModes.indexOf(mode);
  button.dataset.soundMode = mode;
  button.title =
    uiText(soundLabels[index]) + ' · ' + uiText('Click for {0}', ui(soundLabels[(index + 1) % 3]));
  button.setAttribute('aria-label', button.title);
  button.querySelectorAll('[data-sound-icon]').forEach((icon) => {
    icon.hidden = icon.dataset.soundIcon !== mode;
  });
}
async function setSoundMode(mode) {
  speech?.stop();
  await transact((s) => {
    s.settings.soundMode = mode;
    s.settings.muted = mode === 'none';
  });
  refreshSoundButton();
}
function lessonScreen() {
  return (
    !idleHome &&
    (['match', 'order', 'bonus', 'memory'].includes(page) ||
      (page === 'home' && state.stage === 'tap'))
  );
}
function refreshNumbers() {
  if (!state) return;
  refreshEconomyUI();
  refreshTechUI();
  refreshGate();
  const accuracy = E.levelAccuracy(state),
    meter = document.querySelector('.accuracy-track');
  if (meter) {
    const percent = Math.floor(accuracy.percent);
    meter.setAttribute('aria-valuenow', percent);
    meter.setAttribute(
      'aria-valuetext',
      accuracy.total ? uiText('{0}% correct', percent) : uiText('No answers yet'),
    );
    meter.querySelector('i').style.width = accuracy.percent + '%';
    meter.classList.toggle('below-target', accuracy.total > 0 && !accuracy.passed);
  }
  if (document.querySelector('[data-coins]')) scoreCounter?.update(state.coins);
  document.querySelectorAll('[data-rate]').forEach((n) => {
    const text = E.idleRate(state).toFixed(2);
    if (n.textContent !== text) n.textContent = text;
  });
}
const speechCatalog = await fetch('./audio/catalog.json').then((r) => r.json());
let navigationVersion = 0;
function stopMode() {
  disposedrawTap();
  disposedrawMatch();
  disposedrawOrder();
  disposedrawBonus();
  disposeMemory();
  clearTimeout(collectionOpenTimer);
  speech?.dispose();
  screen?.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
}
async function navigate(destination, { historyMode = 'push', animate = true } = {}) {
  const url = new URL(destination, location.href);
  let next = url.hash.slice(1) || url.pathname.split('/').pop().replace('.html', '');
  if (next === 'index' || !next) next = 'home';
  if (next === 'boosts') next = 'village';
  const nextIdle = next === 'home' && url.searchParams.has('idle');
  if (gamePages.includes(next) && !nextIdle) next = route(state);
  if (!frame.querySelector('[data-screen="' + next + '"]')) return;
  const version = ++navigationVersion;
  const previous = screen;
  stopMode();
  debugAction = null;
  busy = false;
  if (previous && animate) {
    previous.classList.add('fading');
    previous.inert = true;
    await new Promise((resolve) => window.setTimeout(resolve, 90));
  }
  if (version !== navigationVersion) return;
  if (previous) {
    previous.hidden = true;
    previous.removeAttribute('id');
    previous.classList.remove('fading');
    previous.inert = false;
  }
  page = next;
  idleHome = nextIdle;
  screen = frame.querySelector('[data-screen="' + page + '"]');
  screen.id = 'screen';
  screen.hidden = false;
  const search = url.search;
  if (historyMode !== 'none')
    history[historyMode === 'replace' ? 'replaceState' : 'pushState'](
      null,
      '',
      'index.html' + search + '#' + page,
    );
  if (page === 'sets') readCollectionRoute();
  mountShell();
  speech = createSpeech({
    catalog: speechCatalog,
    settings: () => ({
      ...state.settings,
      muted:
        soundMode() === 'none' ||
        (soundMode() === 'lessons' && !lessonScreen()) ||
        gameClock.paused,
    }),
    root: screen,
    autoplay: !idleHome && !['sets', 'village', 'tech', 'memory'].includes(page),
    canReplay: (node) => {
      const tile = node.closest('[data-set]');
      return !(page === 'sets' && tile && canOpenSet(Number(tile.dataset.set)));
    },
  });
  if (animate) screen.classList.add('fading');
  draw();
  requestAnimationFrame(() => {
    if (version === navigationVersion) screen.classList.remove('fading');
  });
  inactivityControl?.reset();
}
function go() {
  busy = false;
  selected = null;
  placed = [];
  const dest = route(state);
  if (!idleHome && gamePages.includes(page) && page !== dest) {
    navigate(dest + '.html', {
      historyMode: 'replace',
    });
    return;
  }
  draw();
}
function draw() {
  screen.classList.remove('village-gate');
  debugAction = null;
  if (idleHome) {
    drawPlayHome();
    refreshNumbers();
    return;
  }
  if (gamePages.includes(page) && page !== route(state)) {
    go();
    return;
  }
  if (page === 'home') {
    if (state.stage === 'gate') drawGate();
    else drawTap();
  }
  if (page === 'match') drawMatch();
  if (page === 'card-reward') drawCardReward();
  if (page === 'set-reward' || page === 'sentence-reward') drawSetReward();
  if (page === 'order') drawOrder();
  if (page === 'sets') drawSets();
  if (page === 'boosts' || page === 'village') drawVillage();
  if (page === 'tech') drawTechnology();
  if (page === 'memory') drawMemory();
  if (page === 'restart') drawRestart();
  if (page === 'settings') drawSettings();
  if (page === 'bonus') drawBonus();
  if (page === 'guide') bindGuide();
  speech?.refresh();
  refreshNumbers();
}
function dictionary(flash) {
  const pairs = state.seen.map((id) => word(id)).filter(Boolean);
  return view('tpl-dictionary-16', [
    pairs.length
      ? view('tpl-dictionary-15', [
          joinParts(
            pairs.map((w) =>
              view('tpl-shared-14', [
                joinParts(
                  [
                    flash?.id === w.id ? 'lit' : '',
                    (state.correct[w.id] || 0) >= 2 ? 'mastered' : '',
                  ],
                  ' ',
                ),
                w.id,
                state.settings.display !== 'pinyin' ? view('tpl-shared-12', [hanzi(w)]) : '',
                state.settings.display !== 'characters'
                  ? view('tpl-shared-13', [esc(w.pinyin)])
                  : '',
                wrapNumberLabel(w.number >= 10 ? w.number.toLocaleString('en-US') : w.english),
              ]),
            ),
            '',
          ),
        ])
      : '',
  ]);
}
function drawCardReward() {
  const r = state.pendingReward,
    set = lessons[state.setIndex],
    w = word(r.ids[r.ids.length - 1]);
  render(
    screen,
    view('tpl-drawCardReward-19', [
      ui(r.ids.length === 1 ? '+{0} card' : '+{0} cards', r.ids.length),
      '',
      textCard(w),
      r.ids.length > 1
        ? view('tpl-drawCardReward-18', [
            joinParts(
              r.ids
                .slice(0, -1)
                .map((id) =>
                  view('tpl-shared-17', [hanzi(word(id)), englishTranslation(word(id))]),
                ),
              ' · ',
            ),
          ])
        : '',
      textCard(set),
      r.before,
      r.after,
      r.total,
      r.after,
      r.total,
      ui(r.allDone ? 'All cards collected' : 'Your set is growing'),
    ]),
  );
  $('#continue').onclick = async () => {
    if (busy) return;
    busy = true;
    await transact(E.continueCardReward);
    go();
  };
}
function drawSetReward() {
  const set = lessons[state.setIndex],
    sentences = set.type === 'sentences';
  const accuracy = E.levelAccuracy(state);
  if (!accuracy.passed) {
    render(
      screen,
      view('tpl-drawSetReward-20', [
        textCard(set),
        Math.floor(accuracy.percent),
        accuracy.correct,
        accuracy.total,
      ]),
    );
    $('#claim').onclick = async () => {
      if (busy) return;
      busy = true;
      await transact((s) => E.claimSet(s, lessons));
      go();
    };
    return;
  }
  const amount =
    E.payout(state, 'set', 10) + (set.id === 'L01' ? V.catalogue().progression.settlementGrant : 0);
  render(
    screen,
    view('tpl-drawSetReward-21', [
      ui(sentences ? 'Sentence set complete' : 'Set complete'),
      textCard(set),
      amount,
      sentences ? '10 / 10' : set.pairs.length + ' / ' + set.pairs.length,
    ]),
  );
  $('#claim').onclick = async () => {
    if (busy) return;
    busy = true;
    await transact((s) => E.claimSet(s, lessons));
    go();
  };
}
let collectionIndex = state.setIndex,
  collectionDetail = false,
  collectionOpenTimer;
function canOpenSet(index) {
  const set = lessons[index];
  return !!set && (index <= state.setIndex || !!state.history?.[set.id]);
}
function readCollectionRoute() {
  const id = new URLSearchParams(location.search).get('set'),
    index = lessons.findIndex((s) => s.id === id);
  collectionDetail = index >= 0 && canOpenSet(index);
  if (collectionDetail) collectionIndex = index;
}
function drawSets() {
  clearTimeout(collectionOpenTimer);
  const set = lessons[collectionIndex],
    owned = state.cards[set.id] || [];
  if (!canOpenSet(collectionIndex)) collectionDetail = false;
  screen.classList.toggle('sets-detail', collectionDetail);
  if (!collectionDetail) {
    render(
      screen,
      view('tpl-drawSets-23', [
        joinParts(
          lessons.map((s, i) =>
            view('tpl-shared-22', [
              i,
              esc(s.traditional),
              collectionIndex === i,
              textCard(s),
              s.id,
              state.history?.[s.id] ? ' ✓' : '',
            ]),
          ),
          '',
        ),
      ]),
    );
    screen.querySelectorAll('[data-set]').forEach((b) => {
      b.onclick = () => {
        clearTimeout(collectionOpenTimer);
        collectionIndex = Number(b.dataset.set);
        screen
          .querySelectorAll('[data-set]')
          .forEach((tile) => tile.setAttribute('aria-pressed', String(tile === b)));
        if (!canOpenSet(collectionIndex)) return;
        const index = collectionIndex;
        const open = async () => {
          await navigate('sets.html?set=' + encodeURIComponent(lessons[index].id));
          if (page !== 'sets' || !collectionDetail || collectionIndex !== index) return;
          speech.speak(lessons[index].traditional, {
            interrupt: true,
            element: () => screen.querySelector('.collection-heading'),
          });
        };
        if (E.isLocalDebugHost(location.hostname)) collectionOpenTimer = setTimeout(open, 450);
        else open();
      };
      if (E.isLocalDebugHost(location.hostname)) {
        b.title = uiText('Debug: double-click to complete this set for 3× its set reward');
        b.ondblclick = async () => {
          clearTimeout(collectionOpenTimer);
          if (busy) return;
          busy = true;
          try {
            const { result } = await transact((s) =>
              E.debugCompleteSet(s, lessons, Number(b.dataset.set), location.hostname),
            );
            drawSets();
            refreshNumbers();
            const message = document.createElement('div');
            message.className = 'offline-toast';
            message.setAttribute('role', 'status');
            render(
              message,
              result?.completed
                ? ui('Set complete · +{0} coins', result.points.toLocaleString())
                : ui('Set already completed'),
            );
            frame.append(message);
            setTimeout(() => message.remove(), 2400);
          } finally {
            busy = false;
          }
        };
      }
    });
    return;
  }
  const deck =
    state.previousSentences?.[set.id] ||
    (collectionIndex === state.setIndex ? state.sentenceDeck : []);
  const items =
    set.type === 'sentences'
      ? deck.length
        ? deck.map((id) => set.sentences.find((q) => q.id === id))
        : set.sentences.slice(0, set.countPerRun)
      : set.pairs;
  const historical = !!state.history?.[set.id];
  render(
    screen,
    view('tpl-drawSets-26', [
      textCard(set),
      owned.length,
      items.length,
      ui(historical ? 'Collected before · rebuild this journey' : 'Collected this journey'),
      owned.length,
      items.length,
      joinParts(
        items.map((w) =>
          view('tpl-shared-25', [
            owned.includes(w.id) ? '' : historical ? 'previously-collected' : 'empty',
            owned.includes(w.id) || historical
              ? set.type === 'sentences'
                ? view('tpl-shared-24', [
                    esc(
                      joinParts(
                        w.tokens.map((id) => word(id).traditional),
                        '',
                      ),
                    ),
                    joinParts(
                      w.tokens.map((id) => hanzi(word(id))),
                      '',
                    ),
                    englishTranslation(w),
                  ])
                : textCard(w)
              : '—',
          ]),
        ),
        '',
      ),
    ]),
  );
  screen.querySelector('.collection-back').onclick = (event) => {
    event.preventDefault();
    navigate('sets.html');
  };
}
function drawRestart() {
  render(
    screen,
    view('tpl-drawRestart-28', [
      E.permanent(state),
      E.permanent(state) + V.catalogue().progression.prestigeGain,
      '',
      state.completed.length ? '' : 'disabled',
      !state.completed.length ? view('tpl-drawRestart-27', []) : '',
    ]),
  );
  $('#restart').onclick = async () => {
    if (busy) return;
    busy = true;
    await transact((s) => E.prestigeReset(s, lessons));
    navigate('home.html', {
      historyMode: 'replace',
    });
  };
}
function drawSettings() {
  const groups = [
    [
      'englishTranslations',
      'English translations · Tabs, buttons, Sets, Village, Tech & rewards',
      [
        ['always', 'Always show'],
        ['until10', 'Until level 10'],
        ['never', 'Never show'],
      ],
    ],
    [
      'script',
      'Script',
      [
        ['traditional', '繁體'],
        ['simplified', '简体'],
      ],
    ],
    [
      'display',
      'Display',
      [
        ['both', 'Characters + pinyin'],
        ['characters', 'Characters only'],
        ['pinyin', 'Pinyin only'],
      ],
    ],
    [
      'voice',
      'Voice',
      [
        ['female', 'Female'],
        ['male', 'Male'],
      ],
    ],
    [
      'soundMode',
      'Sound',
      [
        ['all', 'All sounds'],
        ['lessons', 'Lesson sounds only'],
        ['none', 'No sound'],
      ],
    ],
  ];
  render(
    screen,
    view('tpl-drawSettings-31', [
      joinParts(
        groups.map(([key, title, options]) =>
          view('tpl-shared-30', [
            ui(title),
            key === 'display' || key === 'englishTranslations' || key === 'soundMode'
              ? 'stack'
              : '',
            joinParts(
              options.map(([value, label]) =>
                view('tpl-shared-29', [
                  key,
                  value,
                  String(key === 'soundMode' ? soundMode() : state.settings[key]) === value,
                  key === 'script'
                    ? ui(value === 'traditional' ? 'Traditional' : 'Simplified')
                    : ui(label),
                ]),
              ),
              '',
            ),
          ]),
        ),
        '',
      ),
    ]),
  );
  screen.querySelectorAll('[data-setting]').forEach(
    (b) =>
      (b.onclick = async () => {
        const { setting, value } = b.dataset;
        if (setting === 'soundMode') await setSoundMode(value);
        else await transact((s) => (s.settings[setting] = value));
        speech.stop();
        if (setting === 'voice')
          speech.speak('一', {
            interrupt: true,
          });
        drawSettings();
        mountShell();
        screen.querySelector('[data-setting="' + setting + '"][data-value="' + value + '"]').focus({
          preventScroll: true,
        });
      }),
  );
}
let bonusQ = null;
async function debugStep() {
  if (busy || gameClock.paused) return;
  if ($('#resume-journey')) {
    $('#resume-journey').click();
    return;
  }
  if (debugAction) {
    debugAction();
    return;
  }
  if ($('#continue')) {
    $('#continue').click();
    return;
  }
  if ($('#claim')) {
    $('#claim').click();
    return;
  }

  // From utility pages, advance the underlying game by one correct interaction.
  busy = true;
  await transact((s) => {
    if (s.stage === 'tap') return E.answerTap(s, lessons, s.current.id, s.current.id);
    if (s.stage === 'match') {
      const id = E.matchBoard(s).find((id) => !s.matchFound.includes(id));
      return E.matchPair(s, lessons, id, id);
    }
    if (s.stage === 'order') {
      const q = E.sentencePrompt(s, lessons);
      return E.answerSentence(s, lessons, q.tokens, q.id);
    }
    if (s.stage === 'cardReward') return E.continueCardReward(s);
    if (s.stage === 'setReward') return E.claimSet(s, lessons);
    if (s.stage === 'gate') return E.advance(s, lessons);
  });
  busy = false;
  draw();
}
document.addEventListener('keydown', (e) => {
  if (gameClock.paused) return;
  if (e.code === 'Space' && !e.target.matches('input,textarea,[contenteditable="true"]')) {
    e.preventDefault();
    if (!e.repeat) debugStep();
  }
});
window.addEventListener('message', (e) => {
  if (e.source === parent && e.origin === location.origin && e.data === 'debug-space') debugStep();
});
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey) return;
  const url = new URL(link.getAttribute('href'), location.href);
  const name = url.pathname.split('/').pop().replace('.html', '');
  if (url.origin !== location.origin || (!labels[name] && !gamePages.includes(name))) return;
  event.preventDefault();
  navigate(link.getAttribute('href'));
});
window.addEventListener('popstate', () =>
  navigate(location.href, {
    historyMode: 'none',
  }),
);
await navigate(location.href, {
  historyMode: 'replace',
  animate: false,
});
const pauseControl = mountPause({
  clock: gameClock,
  onPause: () => {
    speech?.stop();
    scoreCounter.stop();
  },
  onResume: () => transact(),
});
document.querySelector('.sound-button')?.addEventListener('click', async () => {
  await setSoundMode(soundModes[(soundModes.indexOf(soundMode()) + 1) % soundModes.length]);
  if (page === 'settings') drawSettings();
});
inactivityControl = mountInactivity({
  interactive: () =>
    !idleHome &&
    ((['home', 'match', 'order'].includes(page) &&
      ['tap', 'match', 'order'].includes(state.stage)) ||
      page === 'bonus' ||
      (page === 'memory' && state.memory && !state.memory.complete)),
  isPaused: () => gameClock.paused,
  onIdle: () => {
    speech.stop();
    disposedrawTap();
    disposedrawMatch();
    disposedrawOrder();
    disposedrawBonus();
    navigate('home.html?idle=1', {
      historyMode: 'replace',
    });
  },
});
if (initial.earned >= 1) {
  const n = document.createElement('div');
  n.className = 'offline-toast';
  n.setAttribute('role', 'status');
  render(n, ui('While away: +{0}', Math.floor(initial.earned).toLocaleString()));
  frame.append(n);
  setTimeout(() => n.remove(), 5000);
}
window.addEventListener('storage', (e) => {
  if (e.key !== E.SAVE_KEY) return;
  const previous = state;
  state = read();
  refreshNumbers();
  if (previous.resetToken !== state.resetToken) {
    clearTimeout(feedbackTimer);
    clearTimeout(arenaTimer);
    arenaActivity?.abort();
    collectionIndex = state.setIndex;
    bonusQ = null;
    go();
    return;
  }
  const stageChanged = previous.stage !== state.stage || previous.setIndex !== state.setIndex;
  const preferencesChanged = JSON.stringify(previous.settings) !== JSON.stringify(state.settings);
  const villageChanged =
    ['village', 'tech', 'boosts'].includes(page) &&
    JSON.stringify(previous.village) !== JSON.stringify(state.village);
  const cardsChanged =
    page === 'sets' && JSON.stringify(previous.cards) !== JSON.stringify(state.cards);
  if (preferencesChanged) speech.stop();
  if (!busy && (stageChanged || preferencesChanged || villageChanged || cardsChanged)) go();
});
const timer = setInterval(() => {
  if (document.visibilityState === 'visible' && !gameClock.paused) transact();
}, 1000);
window.addEventListener('pagehide', () => {
  disposedrawTap();
  disposedrawMatch();
  disposedrawOrder();
  disposedrawBonus();
  inactivityControl.dispose();
  pauseControl.dispose();
  gameClock.dispose();
  speech.dispose();
  pairActivity?.abort();
  battle?.dispose();
  clearInterval(timer);
  clearTimeout(feedbackTimer);
  clearTimeout(arenaTimer);
  arenaActivity?.abort();
  scoreCounter.stop();
  try {
    sessionStorage.setItem(
      'village-score-display',
      JSON.stringify({
        value: scoreCounter.value(),
        prestige: state.prestige,
        resetToken: state.resetToken || null,
      }),
    );
  } catch {}
});
export {
  state,
  lessons,
  tokens,
  screen,
  word,
  hanzi,
  textCard,
  wrapNumberLabel,
  dictionary,
  transact,
  go,
  refreshNumbers,
  speech,
  gameClock,
  esc,
  $,
  setDebugAction,
};
function setDebugAction(fn) {
  debugAction = fn;
}
function refreshGate() {
  const rows = screen?.querySelectorAll('.gate-checks .row') || [];
  if (!rows.length || state.stage !== 'gate') return;
  const checks = V.gateStatus(state, state.level || 1);
  rows.forEach((row, i) => {
    const g = checks[i];
    row.querySelector('b').textContent = g.have >= g.need ? '✓' : g.have + ' / ' + g.need;
  });
  const next = screen?.querySelector('#advance');
  if (next) next.disabled = !checks.every((g) => g.have >= g.need);
  const dialog = screen?.querySelector('.goal-dialog');
  if (dialog?.open) updateGoalHelp(dialog, Number(dialog.dataset.goal));
}
function goalLabel(goal) {
  return goal.kind === 'resource' ? ui('Stockpile: {0}', ui(goal.label)) : ui(goal.label);
}
function updateGoalHelp(dialog, index) {
  const goal = V.gateStatus(state, state.level || 1)[index];
  render(
    dialog.querySelector('h2'),
    helpText(goal.kind === 'resource' ? 'Stockpile: ' + goal.label : goal.label),
  );
  render(
    dialog.querySelector('.goal-help-status'),
    helpText(
      (goal.have >= goal.need ? 'Complete' : 'Still needed') +
        ' · ' +
        goal.have +
        ' / ' +
        goal.need,
    ),
  );
  render(
    dialog.querySelector('.goal-help-copy'),
    view('tpl-help-paragraph', [helpText(goal.help)]),
  );
  render(dialog.querySelector('button'), closeHelpLabel());
}
function drawGate() {
  const checks = V.gateStatus(state, state.level || 1),
    ready = checks.every((g) => g.have >= g.need);
  screen.classList.add('village-gate');
  render(
    screen,
    view('tpl-drawGate-33', [
      joinParts(
        checks.map((g, i) =>
          view('tpl-shared-32', [
            goalLabel(g),
            i,
            goalLabel(g),
            g.have >= g.need ? '✓' : g.have + ' / ' + g.need,
          ]),
        ),
        '',
      ),
      ready ? '' : 'disabled',
      E.permanent(state),
    ]),
  );
  if (!screen.querySelector('.goal-dialog')) appendView(screen, view('tpl-drawGate-34', []));
  const dialog = screen.querySelector('.goal-dialog');
  screen.querySelectorAll('[data-goal-help]').forEach(
    (button) =>
      (button.onclick = () => {
        dialog.dataset.goal = button.dataset.goalHelp;
        updateGoalHelp(dialog, Number(button.dataset.goalHelp));
        dialog.showModal();
      }),
  );
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  });
  $('#advance').onclick = async () => {
    await transact((s) => E.advance(s, lessons));
    go();
  };
}
function drawPlayHome() {
  if (state.stage === 'gate') {
    drawGate();
    return;
  }
  screen.classList.add('village-gate');
  render(screen, view('tpl-drawPlayHome-35', [route(state), E.permanent(state)]));
}
function bindGuide() {
  const button = screen.querySelector('#reset-progress');
  button.onclick = async () => {
    button.disabled = true;
    await transact((s) => {
      const fresh = E.freshState(
        lessons,
        Date.now(),
        crypto.getRandomValues(new Uint32Array(1))[0],
      );
      for (const key of Object.keys(s)) delete s[key];
      Object.assign(s, fresh, {
        resetToken: crypto.randomUUID(),
      });
    });
    collectionIndex = 0;
    collectionDetail = false;
    await navigate('home.html', {
      historyMode: 'replace',
    });
    button.disabled = false;
  };
}
