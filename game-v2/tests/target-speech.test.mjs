import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeech } from '../speech.js';

test('shooting the speaking target preserves the second target waiting for speech', async () => {
  const listeners = {};
  let audio;
  globalThis.Audio = class {
    constructor() {
      audio = this;
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
  const card = () => ({
    isConnected: true,
    matches: () => true,
    classList: { add() {}, remove() {} },
  });
  const first = card(),
    second = card();
  const speech = createSpeech({
    catalog: { clips: { 一: { female: 'one.mp3' }, 二: { female: 'two.mp3' } } },
    settings: () => ({}),
    root: {},
  });
  try {
    speech.speak('一', { element: () => first });
    await Promise.resolve();
    speech.speak('二', { element: () => second });
    assert.equal(audio.sources.length, 1);
    listeners.pointerdown({ clientX: 0, clientY: 0 });
    first.isConnected = false;
    listeners.pointerup();
    listeners.click({ target: { closest: () => null } });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(audio.sources.length, 2);
    assert.ok(audio.sources[1].endsWith('two.mp3'));
  } finally {
    speech.dispose();
  }
});
