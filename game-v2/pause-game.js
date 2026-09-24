// Pausing leaves the interactive mode; the Sets screen remains usable.
export function mountPause({ clock, onPause, onResume }) {
  const overlay = document.querySelector('.pause-overlay');
  if (overlay) overlay.hidden = true;
  return {
    pause() {
      clock.pause();
      onPause();
      clock.resume();
      onResume();
    },
    dispose() {},
  };
}
