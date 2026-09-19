import { ui } from './ui/interface-text.js';
import { view, render, replaceView } from './ui/templates.js';
import { bindPairDrag } from './pair-drag.js';

// Keeps weapon DOM, labels and player placement alive between target arrivals.
export function mountBattle({
  clock,
  speak,
  screen,
  getState,
  word,
  textCard,
  label,
  dictionary,
  answer,
  skip,
  onRoute,
  refresh,
}) {
  const { setTimeout, clearTimeout } = clock;
  const initial = getState(),
    phase = initial.difficulty,
    set = initial.setIndex;
  render(screen, view('tpl-mountBattle-36', [dictionary(), phase]));
  const arena = screen.querySelector('.battle-arena'),
    status = arena.querySelector('.battle-status');
  const abort = new AbortController(),
    weapons = new Map(),
    targets = new Map();
  let locked = false,
    disposed = false,
    idleTimer;
  const expired = new Set();
  const timers = new Set();
  const later = (fn, delay) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) fn();
    }, delay);
    timers.add(timer);
  };
  const width = arena.clientWidth,
    height = arena.clientHeight;
  const page = screen.querySelector('.dictionary-columns'),
    rect = arena.getBoundingClientRect();
  const bottom = page
    ? ((page.getBoundingClientRect().bottom - rect.top) * height) / rect.height
    : 0;
  const laneTop = Math.max(12, Math.min(bottom + 18, height - 332));
  const laneHeight = phase === 4 ? 168 : 95;
  const rack = arena.querySelector('.battle-weapons');
  arena.querySelector('.battle-paths').style.cssText =
    'top:' + laneTop + 'px;height:' + laneHeight + 'px';
  function sync() {
    const s = getState();
    if (s.stage !== 'tap' || s.difficulty !== phase || s.setIndex !== set) {
      dispose();
      onRoute();
      return;
    }
    const ids = s.current.options;
    // Replace only the equipment whose word has been completed.
    for (const [id, card] of weapons)
      if (!ids.includes(id)) {
        card.remove();
        weapons.delete(id);
      }
    ids.forEach((id, i) => {
      let card = weapons.get(id);
      if (!card) {
        card = document.createElement('button');
        card.className = 'battle-weapon';
        card.dataset.weapon = id;
        render(card, view('tpl-battle-arena-37', [label(word(id))]));
        rack.append(card);
        weapons.set(id, card);
        bindPairDrag(card, {
          signal: abort.signal,
          enabled: () => !locked && !disposed,
          getTargets: () =>
            [...targets.values()]
              .filter((t) => !t.motion || Number(t.motion.currentTime) >= t.delay + 20)
              .map((t) => t.el),
          onDrop: (target) => fire(id, null, target.dataset.target),
        });
        card.addEventListener('click', () => fire(id));
      }
      card.style.gridColumn = String(i + 1);
      card.disabled = (s.correct[id] || 0) >= 2;
    });
    const active = s.current.targets || [s.current.id];
    for (const [id, target] of targets)
      if (!active.includes(id)) {
        target.motion?.cancel();
        target.el.remove();
        targets.delete(id);
        expired.delete(id);
      }
    active.forEach((id) => {
      if (targets.has(id)) return;
      const leader = [...targets.values()][0];
      const lane = leader?.lane === 0 ? 1 : 0;
      const el = document.createElement('div');
      el.className = 'battle-target';
      el.dataset.target = id;
      render(el, view('tpl-battle-arena-38', [textCard(word(id))]));
      el.style.top = laneTop + lane * 96 + 'px';
      const target = {
        el,
        lane,
        motion: null,
        delay: 0,
        reverse: leader ? leader.reverse : Math.random() < 0.5,
      };
      el.style.left = (phase === 2 ? (width - 90) / 2 : 0) + 'px';
      arena.append(el);
      targets.set(id, target);
      if (phase >= 3) {
        const reverse = target.reverse,
          from = reverse ? width - 90 : 0,
          to = reverse ? 0 : width - 90;
        const duration = phase === 3 ? 8500 : 6500;
        // Followers travel in the same direction, at least a card-width behind.
        const headStart = (duration * 110) / Math.max(1, width - 90);
        target.delay = leader
          ? Math.max(0, headStart - ((leader.motion?.currentTime || 0) - leader.delay))
          : 0;
        // Transform animation runs on the compositor, without layout writes each frame.
        target.motion = el.animate(
          [
            {
              transform: 'translate3d(' + from + 'px,0,0)',
              opacity: 0,
              offset: 0,
            },
            {
              transform: 'translate3d(' + (from + (to - from) * 0.015) + 'px,0,0)',
              opacity: 1,
              offset: 0.015,
            },
            {
              transform: 'translate3d(' + to + 'px,0,0)',
              opacity: 1,
            },
          ],
          {
            duration,
            delay: target.delay,
            easing: 'linear',
            fill: 'both',
          },
        );
        target.motion.onfinish = () => {
          expired.add(id);
          drainEscapes();
        };
      }
      const announce = () => {
        if (!el.isConnected) return;
        if (
          document.hidden ||
          (target.motion && Number(target.motion.currentTime) < target.delay + 100)
        ) {
          later(announce, 150);
          return;
        }
        speak(word(id).traditional, {
          valid: () => el.isConnected,
          element: () => (el.isConnected ? el : null),
        });
      };
      later(announce, target.delay + 120);
    });
  }
  async function fire(choice, escapedId, droppedId) {
    if (locked || disposed || document.hidden || clock.paused) return;
    const visible = [...targets]
      .filter(([, t]) => !t.motion || Number(t.motion.currentTime) >= t.delay + 20)
      .map(([id]) => id);
    if (droppedId && !visible.includes(droppedId)) return;
    const targetId = escapedId || droppedId || (visible.includes(choice) ? choice : visible[0]);
    if (!targetId) return;
    locked = true;
    clearTimeout(idleTimer);
    const target = targets.get(targetId),
      weapon = weapons.get(choice);
    target.motion?.pause();
    const result = escapedId ? await skip(targetId) : await answer(choice, targetId);
    if (disposed) return;
    if (!result) {
      locked = false;
      target.motion?.play();
      sync();
      activity();
      drainEscapes();
      return;
    }
    if (!escapedId) {
      replaceView(screen.querySelector('.dictionary'), dictionary(result));
      refresh();
      render(status, result.correct ? '+' + result.points : ui('Miss'));
      weapon?.classList.add(result.correct ? 'fired' : 'misfire');
      if (weapon) {
        const x = rack.offsetLeft + weapon.offsetLeft + weapon.offsetWidth / 2,
          y = rack.offsetTop + weapon.offsetTop + weapon.offsetHeight / 2;
        const targetRect = target.el.getBoundingClientRect(),
          arenaRect = arena.getBoundingClientRect();
        const targetX =
          ((targetRect.left + targetRect.width / 2 - arenaRect.left) * width) / arenaRect.width;
        const targetY =
          ((targetRect.top + targetRect.height / 2 - arenaRect.top) * height) / arenaRect.height;
        const shot = document.createElement('span');
        shot.className = 'arena-shot';
        shot.style.cssText =
          'left:' +
          x +
          'px;top:' +
          y +
          'px;--dx:' +
          (targetX - x) +
          'px;--dy:' +
          (targetY - y) +
          'px';
        arena.append(shot);
        later(() => shot.remove(), 250);
      }
    }
    target.el.classList.add(escapedId ? 'departing' : result.correct ? 'destroyed' : 'deflected');
    later(
      () => {
        weapon?.classList.remove('fired', 'misfire');
        target.el.classList.remove('deflected');
        render(status, '');
        locked = false;
        if (escapedId || result.correct) {
          target.motion?.cancel();
          target.el.remove();
          targets.delete(targetId);
          expired.delete(targetId);
        } else if (!document.hidden) target.motion?.play();
        sync();
        activity();
        drainEscapes();
      },
      escapedId ? 220 : result.correct ? 300 : 220,
    );
  }
  function activity() {
    if (clock.paused) return;
    clearTimeout(idleTimer);
    if (phase === 2 && !disposed && !locked && !document.hidden)
      idleTimer = setTimeout(() => fire(null, targets.keys().next().value), 4000);
  }
  function drainEscapes() {
    if (disposed || locked || document.hidden || clock.paused) return;
    for (const id of expired) {
      expired.delete(id);
      if (targets.has(id)) {
        fire(null, id);
        break;
      }
    }
  }
  for (const name of ['pointermove', 'pointerdown', 'click'])
    document.addEventListener(name, activity, {
      passive: true,
      signal: abort.signal,
    });
  function dispose() {
    disposed = true;
    abort.abort();
    clearTimeout(idleTimer);
    timers.forEach(clearTimeout);
    for (const target of targets.values()) {
      if (target.motion) target.motion.onfinish = null;
      target.motion?.cancel();
      target.el.remove();
    }
    for (const weapon of weapons.values()) weapon.remove();
    targets.clear();
    weapons.clear();
    expired.clear();
  }
  sync();
  activity();
  return {
    dispose,
    debug: () => {
      const entry = [...targets].find(
        ([, t]) => !t.motion || Number(t.motion.currentTime) >= t.delay + 20,
      );
      if (entry) fire(entry[0]);
    },
  };
}
