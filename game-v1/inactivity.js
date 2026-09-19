// Wall-clock inactivity continues while the browser is in the background.
export function mountInactivity({ interactive, onIdle, isPaused, timeout = 30000 }) {
  const abort = new AbortController();
  let timer,
    lastActivity = Date.now(),
    done = false;
  let host = window;
  try {
    if (window.top.location.origin === location.origin) host = window.top;
  } catch {}
  function check() {
    clearTimeout(timer);
    if (done) return;
    if (isPaused()) {
      lastActivity = Date.now();
      timer = setTimeout(check, timeout);
      return;
    }
    const remaining = timeout - (Date.now() - lastActivity);
    if (remaining <= 0 && interactive()) {
      done = true;
      onIdle();
      return;
    }
    timer = setTimeout(check, Math.max(100, remaining > 0 ? remaining : timeout));
  }
  function activity() {
    // A delayed background timer must still return an abandoned game home.
    if (Date.now() - lastActivity >= timeout) check();
    if (done) return;
    lastActivity = Date.now();
    check();
  }
  for (const target of new Set([document, host.document]))
    for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'click'])
      target.addEventListener(type, activity, {
        signal: abort.signal,
        capture: true,
        passive: true,
      });
  document.addEventListener('visibilitychange', check, { signal: abort.signal });
  check();
  return {
    reset() {
      done = false;
      lastActivity = Date.now();
      check();
    },
    dispose() {
      done = true;
      clearTimeout(timer);
      abort.abort();
    },
  };
}
