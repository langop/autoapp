function createScheduler({ getIntervalMs, onTick, onRestart }) {
  let timer = null;
  let active = false;
  let tickGeneration = 0;

  function clearTimer() {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function runTick(generation) {
    if (!active || generation !== tickGeneration) return;
    try {
      await onTick();
    } catch {
      // skip tick errors
    }
    if (!active || generation !== tickGeneration) return;
    scheduleNext(generation);
  }

  function scheduleNext(generation) {
    if (!active || generation !== tickGeneration) return;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      runTick(generation);
    }, getIntervalMs());
  }

  function start() {
    if (active) return;
    active = true;
    const generation = ++tickGeneration;
    // First check immediately, then wait for the interval.
    runTick(generation);
  }

  function stop() {
    active = false;
    tickGeneration += 1;
    clearTimer();
  }

  function restart() {
    stop();
    if (typeof onRestart === 'function') onRestart();
    start();
  }

  return { start, stop, restart };
}

module.exports = { createScheduler };
