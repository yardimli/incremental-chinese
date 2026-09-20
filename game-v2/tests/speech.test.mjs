import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createSpeech } from '../speech.js';

test('returning from Alt+Tab and shooting cannot release a stale target announcement', async () => {
  let player;
  const listeners = {},
    windowListeners = {};
  const previousWindow = globalThis.window;
  globalThis.window = {
    addEventListener(type, fn) {
      windowListeners[type] = fn;
    },
  };
  globalThis.Audio = class {
    constructor() {
      player = this;
      this.sources = [];
    }
    play() {
      this.sources.push(this.src);
      return Promise.resolve();
    }
    pause() {}
  };
  globalThis.document = {
    hidden: false,
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
  };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  const target = {
    isConnected: true,
    matches: (selector) => selector === '.target-piece,.battle-target',
    classList: { add() {}, remove() {} },
  };
  const speech = createSpeech({
    settings: () => ({ voice: 'male' }),
    root: {},
    catalog: { clips: { 一: { male: 'one.mp3' } } },
  });
  try {
    speech.speak('一', { element: () => target });
    await Promise.resolve();
    listeners.keydown();
    windowListeners.blur();
    document.hidden = true;
    listeners.visibilitychange();
    document.hidden = false;
    listeners.visibilitychange();
    listeners.pointerdown({ clientX: 0, clientY: 0 });
    listeners.pointerup();
    listeners.click({ target: { closest: () => null } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(player.sources.length, 1, 'Focus return and shooting must stay silent');
    // A delayed announcement queued during a held key must also be discarded by shooting.
    listeners.keydown();
    speech.speak('一', { element: () => target });
    assert.equal(player.sources.length, 1);
    listeners.click({ target: { closest: () => null } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(player.sources.length, 1);
    speech.speak('一', { element: () => target });
    await Promise.resolve();
    assert.equal(player.sources.length, 2, 'A genuinely new target still speaks');
  } finally {
    speech.dispose();
    globalThis.window = previousWindow;
  }
});

test('shooting during target speech never replays it, even while play is pending', async () => {
  for (const settled of [false, true]) {
    let player, resolvePlay;
    const listeners = {};
    globalThis.Audio = class {
      constructor() {
        player = this;
        this.sources = [];
      }
      play() {
        this.sources.push(this.src);
        return new Promise((resolve) => {
          resolvePlay = resolve;
        });
      }
      pause() {}
    };
    globalThis.document = {
      hidden: false,
      addEventListener(type, fn) {
        listeners[type] = fn;
      },
    };
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
    };
    const target = {
      isConnected: true,
      matches: (selector) => selector === '.target-piece,.battle-target',
      classList: { add() {}, remove() {} },
    };
    const speech = createSpeech({
      settings: () => ({ voice: 'male' }),
      root: {},
      catalog: { clips: { 一: { male: 'one.mp3' } } },
    });
    speech.speak('一', { element: () => target });
    if (settled) {
      resolvePlay();
      await Promise.resolve();
    }
    listeners.pointerdown({ clientX: 0, clientY: 0 });
    if (!settled) {
      resolvePlay();
      await Promise.resolve();
    }
    listeners.pointerup();
    listeners.click({ target: { closest: () => null } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(player.sources.length, 1, 'English shot must not replay the outgoing target');
    // A newly arriving target can announce the same word again.
    speech.speak('一', { element: () => target });
    assert.equal(player.sources.length, 2);
    resolvePlay();
    await Promise.resolve();
    const node = { dataset: { speech: '一' } };
    listeners.click({
      target: { closest: (selector) => (selector === '[data-speech]' ? node : target) },
    });
    assert.equal(player.sources.length, 3, 'Explicit Chinese-card replay remains available');
    speech.dispose();
  }
});

test('automatic match speech skips completed cards, including queued cards after a redraw', async () => {
  let player, scan;
  globalThis.Audio = class {
    constructor() {
      player = this;
      this.sources = [];
    }
    play() {
      this.sources.push(this.src);
      return Promise.resolve();
    }
    pause() {}
  };
  globalThis.document = { hidden: false, addEventListener() {} };
  globalThis.MutationObserver = class {
    constructor(fn) {
      scan = fn;
    }
    observe() {}
    disconnect() {}
  };
  const makeNode = (text, matched = false) => {
    const card = {
      isConnected: true,
      matched,
      classList: { add() {}, remove() {} },
      matches(selector) {
        return selector === '.match-tile.matched' && this.matched;
      },
    };
    return {
      card,
      dataset: { speech: text },
      closest(selector) {
        return selector === '.battle-target' ? null : card;
      },
    };
  };
  let nodes = [makeNode('一', true), makeNode('二'), makeNode('三'), makeNode('四')];
  const speech = createSpeech({
    settings: () => ({ voice: 'male' }),
    root: { querySelectorAll: () => nodes },
    catalog: {
      clips: Object.fromEntries(
        ['一', '二', '三', '四'].map((text, i) => [text, { male: `${i + 1}.mp3` }]),
      ),
    },
  });
  scan();
  await Promise.resolve();
  assert.equal(player.sources.length, 1);
  assert.ok(player.sources[0].endsWith('/2.mp3'));
  // The third word was queued, but the user matched it before its turn to speak.
  nodes.forEach((n) => (n.card.isConnected = false));
  nodes = [makeNode('一', true), makeNode('二'), makeNode('三', true), makeNode('四')];
  scan();
  player.onended();
  await Promise.resolve();
  assert.equal(player.sources.length, 2);
  assert.ok(player.sources[1].endsWith('/4.mp3'));
  player.onended();
  assert.equal(player.sources.length, 2);
  speech.dispose();
});

test('bundled male and female clips exist for every catalog entry', () => {
  const root = new URL('../', import.meta.url);
  const catalog = JSON.parse(readFileSync(new URL('audio/catalog.json', root)));
  for (const clips of Object.values(catalog.clips))
    for (const voice of ['male', 'female']) {
      assert.ok(clips[voice].endsWith('.mp3'));
      assert.ok(statSync(new URL(clips[voice], root)).size > 1000);
    }
});

test('speech queues clips, uses selected voice, interrupts on replay, and respects mute', async () => {
  let player;
  globalThis.Audio = class {
    constructor() {
      player = this;
      this.sources = [];
    }
    play() {
      this.sources.push(this.src);
      return Promise.resolve();
    }
    pause() {}
  };
  globalThis.document = { hidden: false, addEventListener() {} };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  const settings = { voice: 'male', muted: false };
  const speech = createSpeech({
    settings: () => settings,
    root: {},
    catalog: {
      clips: {
        一: { male: 'audio/male/one.mp3', female: 'audio/female/one.mp3' },
        二: { male: 'audio/male/two.mp3' },
      },
    },
  });
  speech.speak('一');
  await Promise.resolve();
  speech.speak('二');
  assert.equal(player.sources.length, 1);
  player.onended();
  await Promise.resolve();
  assert.equal(player.sources.length, 2);
  settings.voice = 'female';
  speech.speak('一', { interrupt: true });
  await Promise.resolve();
  assert.ok(player.sources.at(-1).endsWith('/female/one.mp3'));
  settings.muted = true;
  speech.stop();
  speech.speak('一');
  assert.equal(player.sources.length, 3);
  speech.dispose();
});

test('only the speaking card glows for queued speech and click replay; blocked playback stays unlit', async () => {
  let player;
  const listeners = {};
  globalThis.Audio = class {
    constructor() {
      player = this;
    }
    play() {
      return this.blocked ? Promise.reject({ name: 'NotAllowedError' }) : Promise.resolve();
    }
    pause() {}
  };
  globalThis.document = {
    hidden: false,
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
  };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  const makeCard = () => ({
    isConnected: true,
    classList: {
      values: new Set(),
      add(x) {
        this.values.add(x);
      },
      remove(x) {
        this.values.delete(x);
      },
    },
  });
  const first = makeCard(),
    second = makeCard();
  const lit = (card) => card.classList.values.has('speech-playing');
  const speech = createSpeech({
    settings: () => ({ voice: 'male' }),
    root: {},
    catalog: { clips: { 一: { male: 'one.mp3' }, 二: { male: 'two.mp3' } } },
  });
  speech.speak('一', { element: () => first });
  speech.speak('二', { element: () => second });
  assert.equal(lit(first), false);
  await Promise.resolve();
  assert.equal(lit(first), true);
  assert.equal(lit(second), false);
  player.onended();
  await Promise.resolve();
  assert.equal(lit(first), false);
  assert.equal(lit(second), true);
  // The delegated click handler must highlight the clicked card, not a queued card.
  const node = { dataset: { speech: '一' } };
  listeners.click({
    target: {
      closest(selector) {
        return selector === '[data-speech]' ? node : first;
      },
    },
  });
  assert.equal(lit(second), false);
  await Promise.resolve();
  assert.equal(lit(first), true);
  player.onended();
  assert.equal(lit(first), false);
  player.blocked = true;
  speech.speak('二', { interrupt: true, element: () => second });
  await Promise.resolve();
  assert.equal(lit(second), false);
  player.blocked = false;
  speech.speak('二', { interrupt: true, element: () => second });
  await Promise.resolve();
  assert.equal(lit(second), true);
  speech.stop();
  assert.equal(lit(second), false);
  speech.dispose();
});

test('interaction pauses speech until release, then resumes valid cards and new prompts', async () => {
  let player, resolvePlay;
  const listeners = {};
  globalThis.Audio = class {
    constructor() {
      player = this;
      this.sources = [];
      this.pauses = 0;
    }
    play() {
      this.sources.push(this.src);
      return new Promise((resolve) => {
        resolvePlay = resolve;
      });
    }
    pause() {
      this.pauses++;
    }
  };
  globalThis.document = {
    hidden: false,
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
  };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  const card = {
    isConnected: true,
    classList: {
      values: new Set(),
      add(x) {
        this.values.add(x);
      },
      remove(x) {
        this.values.delete(x);
      },
    },
  };
  const speech = createSpeech({
    settings: () => ({ voice: 'male' }),
    root: {},
    catalog: {
      clips: { 一: { male: 'one.mp3' }, 二: { male: 'two.mp3' }, 三: { male: 'three.mp3' } },
    },
  });
  let unmatched = true;
  speech.speak('一', { element: () => card, valid: () => unmatched });
  speech.speak('二');
  listeners.pointerdown({ clientX: 0, clientY: 0 });
  assert.equal(player.pauses, 1);
  resolvePlay();
  await Promise.resolve();
  assert.equal(card.classList.values.size, 0);
  speech.speak('三');
  assert.equal(player.sources.length, 1);
  // The dropped card is now matched; resume skips it and reads the next card.
  unmatched = false;
  listeners.pointerup();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(player.sources.length, 2);
  assert.ok(player.sources.at(-1).endsWith('/two.mp3'));
  resolvePlay();
  await Promise.resolve();
  listeners.keydown();
  assert.equal(player.pauses, 2);
  listeners.keyup();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(player.sources.length, 3);
  assert.ok(player.sources.at(-1).endsWith('/two.mp3'));
  resolvePlay();
  await Promise.resolve();
  player.onended();
  assert.ok(player.sources.at(-1).endsWith('/three.mp3'));
  resolvePlay();
  await Promise.resolve();
  player.onended();
  speech.speak('一');
  assert.ok(player.sources.at(-1).endsWith('/one.mp3'));
  speech.dispose();
});
