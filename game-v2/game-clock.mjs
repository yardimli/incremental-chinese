// Gameplay timers retain their remaining duration while the game is paused.
export function createGameClock({
  now = () => performance.now(),
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
} = {}) {
  let paused = false,
    nextId = 0;
  const jobs = new Map();
  function arm(id, job) {
    job.started = now();
    job.native = schedule(() => {
      jobs.delete(id);
      job.fn();
    }, job.remaining);
  }
  return {
    get paused() {
      return paused;
    },
    setTimeout(fn, delay = 0) {
      const id = ++nextId,
        job = { fn, remaining: delay };
      jobs.set(id, job);
      if (!paused) arm(id, job);
      return id;
    },
    clearTimeout(id) {
      const job = jobs.get(id);
      if (job) cancel(job.native);
      jobs.delete(id);
    },
    pause() {
      if (paused) return;
      paused = true;
      for (const job of jobs.values()) {
        cancel(job.native);
        job.remaining = Math.max(0, job.remaining - (now() - job.started));
      }
    },
    resume() {
      if (!paused) return;
      paused = false;
      for (const [id, job] of jobs) arm(id, job);
    },
    dispose() {
      for (const job of jobs.values()) cancel(job.native);
      jobs.clear();
    },
  };
}
