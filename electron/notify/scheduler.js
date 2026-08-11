function createScheduler({ getIntervalMs, onTick, onRestart }) {
  let timer = null;
  let active = false;

  function scheduleNext() {
    if (!active) return;
    timer = setTimeout(async () => {
      if (!active) return;
      try {
        await onTick();
      } catch {
        // skip tick errors
      }
      scheduleNext();
    }, getIntervalMs());
  }

  function start() {
    if (active) return;
    active = true;
    scheduleNext();
  }

  function stop() {
    active = false;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function restart() {
    stop();
    if (typeof onRestart === 'function') onRestart();
    start();
  }

  return { start, stop, restart };
}

module.exports = { createScheduler };
