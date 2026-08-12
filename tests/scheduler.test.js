const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler } = require('../electron/notify/scheduler');

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('createScheduler', () => {
  it('runs onTick immediately on start, then again after interval', async () => {
    const ticks = [];
    const scheduler = createScheduler({
      getIntervalMs: () => 40,
      onTick: async () => {
        ticks.push(Date.now());
      },
    });
    try {
      scheduler.start();
      await wait(10);
      assert.equal(ticks.length, 1, 'should tick once immediately');
      await wait(50);
      assert.ok(ticks.length >= 2, 'should tick again after interval');
    } finally {
      scheduler.stop();
    }
  });

  it('restart runs onTick immediately again', async () => {
    let count = 0;
    const scheduler = createScheduler({
      getIntervalMs: () => 200,
      onTick: async () => {
        count += 1;
      },
    });
    try {
      scheduler.start();
      await wait(10);
      assert.equal(count, 1);
      scheduler.restart();
      await wait(10);
      assert.equal(count, 2);
    } finally {
      scheduler.stop();
    }
  });

  it('stop prevents further ticks', async () => {
    let count = 0;
    const scheduler = createScheduler({
      getIntervalMs: () => 30,
      onTick: async () => {
        count += 1;
      },
    });
    try {
      scheduler.start();
      await wait(10);
      scheduler.stop();
      const afterStop = count;
      await wait(50);
      assert.equal(count, afterStop);
    } finally {
      scheduler.stop();
    }
  });
});