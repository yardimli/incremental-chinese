import { ui } from './ui/interface-text.js';
import { render } from './ui/templates.js';
export function mountPause({ clock, onPause, onResume }) {
  const abort = new AbortController(),
    animations = new Set();
  let previousFocus;
  const overlay = document.querySelector('.pause-overlay');
  function freezeAnimations() {
    if (!clock.paused) return;
    for (const animation of document.getAnimations())
      if (animation.playState === 'running') {
        animations.add(animation);
        animation.pause();
      }
  }
  function pause(reason) {
    if (clock.paused) return;
    clock.pause();
    onPause();
    previousFocus = document.activeElement;
    document.querySelectorAll('#screen,.header,.footer').forEach((el) => (el.inert = true));
    render(overlay.querySelector('[data-reason]'), ui(reason));
    overlay.hidden = false;
    freezeAnimations();
    overlay.querySelector('button').focus({
      preventScroll: true,
    });
  }
  function resume() {
    overlay.hidden = true;
    document.querySelectorAll('#screen,.header,.footer').forEach((el) => (el.inert = false));
    for (const animation of animations) if (animation.playState === 'paused') animation.play();
    animations.clear();
    clock.resume();
    previousFocus?.focus?.({
      preventScroll: true,
    });
    onResume();
  }
  overlay.querySelector('button').onclick = resume;
  const observer = new MutationObserver(freezeAnimations);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  return {
    pause: () => pause('Take a break'),
    dispose() {
      abort.abort();
      observer.disconnect();
      overlay.remove();
    },
  };
}
