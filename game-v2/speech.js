// One local MP3 at a time; pause automatic narration only during an interaction.
export function createSpeech({ catalog, settings, root, autoplay = true, canReplay = () => true }) {
  const audio = new Audio();
  audio.preload = 'auto';
  let queue = [],
    playing = false,
    generation = 0,
    seen = new Set(),
    activeItem = null,
    highlighted = null;
  let autoStopped = false,
    currentAutomatic = false;
  let resumeTimer,
    pointerStart = null,
    dragged = false;
  const abort = new AbortController();
  function highlight(item) {
    const card = item?.element?.();
    if (card === highlighted) return;
    highlighted?.classList.remove('speech-playing');
    highlighted = card || null;
    highlighted?.classList.add('speech-playing');
  }
  function stop() {
    generation++;
    audio.pause();
    playing = false;
    queue = [];
    activeItem = null;
    highlight(null);
  }
  async function next() {
    if (playing || document.hidden || settings().muted) return;
    while (queue.length && !queue[0].valid()) queue.shift();
    if (!queue.length) return;
    if (autoStopped && queue[0].automatic) return;
    const item = queue[0],
      path = catalog.clips[item.text]?.[settings().voice || 'female'];
    if (!path) {
      queue.shift();
      return next();
    }
    const version = ++generation;
    playing = true;
    currentAutomatic = item.automatic;
    audio.src = new URL(path, new URL('./', import.meta.url)).href;
    try {
      await audio.play();
      if (version === generation) {
        queue.shift();
        activeItem = item;
        highlight(item);
      }
    } catch (error) {
      if (version !== generation) return;
      playing = false;
      activeItem = null;
      highlight(null);
      if (error.name !== 'NotAllowedError') {
        queue.shift();
        next();
      }
    }
  }
  audio.onended = () => {
    playing = false;
    activeItem = null;
    highlight(null);
    next();
  };
  audio.onerror = () => {
    activeItem = null;
    highlight(null);
  };
  function speak(
    text,
    { interrupt = false, automatic = !interrupt, valid = () => true, element = () => null } = {},
  ) {
    if (settings().muted || !catalog.clips[text] || (automatic && !autoplay)) return;
    if (interrupt) {
      const remaining = queue.filter((item) => item.automatic && item.text !== text);
      stop();
      queue = remaining;
    }
    const item = { text, valid, element, automatic };
    if (interrupt) queue.unshift(item);
    else queue.push(item);
    next();
  }
  const cards = '.card,.target-piece,.match-tile,.selection-button,.reward-emblem,.bonus-target';
  const canAutoSpeak = (card) => !!card && !card.matches('.match-tile.matched');
  // Matching and ordering redraw their cards; follow the same word into the new DOM.
  const locate = (text, original) => () =>
    original?.isConnected
      ? original
      : [...root.querySelectorAll('[data-speech]')]
          .find((n) => n.dataset.speech === text)
          ?.closest(cards + ',.battle-target');
  let lastTarget = null;
  function scan() {
    const current = new Set();
    root.querySelectorAll('[data-speech]').forEach((node) => {
      if (node.closest('.battle-target')) return;
      const card = node.closest(cards);
      if (!canAutoSpeak(card)) return;
      const text = node.dataset.speech;
      current.add(text);
      const freshTarget = card.matches('.target-piece,.bonus-target') && card !== lastTarget;
      if (freshTarget) lastTarget = card;
      if (!seen.has(text) || freshTarget) {
        seen.add(text);
        const element = locate(text, card);
        speak(text, { valid: () => canAutoSpeak(element()), element });
      }
    });
    seen = current;
    highlight(activeItem);
  }
  const observer = new MutationObserver(scan);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-speech'],
  });
  function interact() {
    clearTimeout(resumeTimer);
    autoStopped = true;
    if (playing && currentAutomatic) {
      const interrupted = activeItem || queue[0];
      const isTarget = interrupted?.element()?.matches?.('.target-piece,.battle-target');
      // A shot must not restart the target's announcement during hit feedback.
      // Match-board narration still resumes its interrupted, unmatched card.
      if (isTarget) {
        queue = queue.filter((item) => item !== interrupted);
      } else if (activeItem) queue.unshift(activeItem);
      generation++;
      audio.pause();
      playing = false;
      activeItem = null;
      highlight(null);
    }
    // A focus change or blocked autoplay can leave a target queued but not playing.
    // Releasing a weapon must not unlock that old announcement either.
    queue = queue.filter(
      (item) => !item.automatic || !item.element()?.matches?.('.target-piece,.battle-target'),
    );
  }
  function resume() {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      autoStopped = false;
      next();
    }, 0);
  }
  const listen = (type, fn) =>
    document.addEventListener(type, fn, { signal: abort.signal, capture: true, passive: true });
  listen('pointerdown', (event) => {
    pointerStart = { x: event.clientX, y: event.clientY };
    dragged = false;
    interact();
  });
  listen('keydown', interact);
  listen('keyup', resume);
  listen('wheel', () => {
    interact();
    resumeTimer = setTimeout(resume, 150);
  });
  listen('pointermove', (event) => {
    if (event.buttons) {
      if (
        pointerStart &&
        Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5
      )
        dragged = true;
      interact();
    }
  });
  listen('pointerup', () => {
    pointerStart = null;
    resume();
  });
  listen('pointercancel', () => {
    pointerStart = null;
    dragged = true;
    resume();
  });
  listen('dragend', resume);
  document.addEventListener(
    'click',
    (event) => {
      interact();
      resume();
      if (dragged && event.detail !== 0) {
        dragged = false;
        return;
      }
      const card = event.target.closest(cards + ',.battle-target');
      const node = event.target.closest('[data-speech]') || card?.querySelector('[data-speech]');
      if (node && canReplay(node))
        speak(node.dataset.speech, {
          interrupt: true,
          element: locate(node.dataset.speech, card || node),
        });
    },
    { signal: abort.signal, capture: true },
  );
  function leavePage() {
    clearTimeout(resumeTimer);
    pointerStart = null;
    dragged = false;
    autoStopped = false;
    stop();
  }
  globalThis.window?.addEventListener('blur', leavePage, { signal: abort.signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) leavePage();
      else autoStopped = false;
    },
    { signal: abort.signal },
  );
  return {
    speak,
    stop,
    refresh: scan,
    dispose() {
      clearTimeout(resumeTimer);
      stop();
      observer.disconnect();
      abort.abort();
    },
  };
}
