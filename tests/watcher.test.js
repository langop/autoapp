const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  pickLatestNonPinned,
  diffWatchUpdate,
  buildNotifyPayload,
  runWatchRound,
} = require('../electron/notify/watcher');

describe('pickLatestNonPinned', () => {
  it('returns first item when none are pinned', () => {
    const items = [
      { id: '1', isTop: false, title: 'a' },
      { id: '2', isTop: false, title: 'b' },
    ];
    assert.deepEqual(pickLatestNonPinned(items), items[0]);
  });

  it('skips pinned items', () => {
    const items = [
      { id: 'top', isTop: true, title: 'pinned' },
      { id: '2', isTop: false, title: 'latest' },
    ];
    assert.equal(pickLatestNonPinned(items).id, '2');
  });

  it('returns null when all items are pinned or list is empty', () => {
    assert.equal(pickLatestNonPinned([]), null);
    assert.equal(
      pickLatestNonPinned([{ id: '1', isTop: true }]),
      null,
    );
  });
});

describe('diffWatchUpdate', () => {
  it('returns init when prevId is empty', () => {
    assert.equal(diffWatchUpdate({ prevId: '', nextId: 'a' }), 'init');
    assert.equal(diffWatchUpdate({ prevId: undefined, nextId: 'a' }), 'init');
  });

  it('returns changed when ids differ', () => {
    assert.equal(diffWatchUpdate({ prevId: 'a', nextId: 'b' }), 'changed');
  });

  it('returns same when ids match', () => {
    assert.equal(diffWatchUpdate({ prevId: 'a', nextId: 'a' }), 'same');
  });

  it('returns skip when nextId is empty', () => {
    assert.equal(diffWatchUpdate({ prevId: 'a', nextId: '' }), 'skip');
    assert.equal(diffWatchUpdate({ prevId: '', nextId: '' }), 'skip');
  });
});

describe('buildNotifyPayload', () => {
  it('builds title with UP name and body from dynamic title', () => {
    const payload = buildNotifyPayload(
      { uid: '123', name: 'TestUP' },
      { id: 'd1', title: 'Hello world', text: '' },
    );
    assert.deepEqual(payload, {
      title: 'TestUP 更新了动态',
      body: 'Hello world',
      uid: '123',
    });
  });

  it('falls back to text when title is empty', () => {
    const payload = buildNotifyPayload(
      { uid: '1', name: 'A' },
      { id: 'd1', title: '', text: 'body text' },
    );
    assert.equal(payload.body, 'body text');
  });

  it('truncates long body', () => {
    const long = 'x'.repeat(200);
    const payload = buildNotifyPayload(
      { uid: '1', name: 'A' },
      { id: 'd1', title: long, text: '' },
    );
    assert.ok(payload.body.length <= 120);
    assert.ok(payload.body.endsWith('…'));
  });
});

describe('runWatchRound', () => {
  it('init: sets cursor without notifying on first check', async () => {
    const watch = {
      data: {},
      get(uid) {
        return this.data[uid];
      },
      set(uid, id) {
        this.data[uid] = { lastDynamicId: id };
      },
    };
    const notified = [];
    await runWatchRound({
      favorites: [{ uid: '1', name: 'A', notifyEnabled: true }],
      fetchDynamicsForUid: async () => ({
        items: [{ id: 'dyn-1', isTop: false, title: 't', text: '' }],
      }),
      watch,
      onNotify: (p) => notified.push(p),
    });
    assert.deepEqual(notified, []);
    assert.equal(watch.data['1'].lastDynamicId, 'dyn-1');
  });

  it('changed: notifies then updates cursor', async () => {
    const watch = {
      data: { '1': { lastDynamicId: 'old' } },
      get(uid) {
        return this.data[uid];
      },
      set(uid, id) {
        this.data[uid] = { lastDynamicId: id };
      },
    };
    const notified = [];
    await runWatchRound({
      favorites: [{ uid: '1', name: 'A', notifyEnabled: true }],
      fetchDynamicsForUid: async () => ({
        items: [{ id: 'new', isTop: false, title: 'fresh', text: '' }],
      }),
      watch,
      onNotify: (p) => notified.push(p),
    });
    assert.equal(notified.length, 1);
    assert.equal(notified[0].title, 'A 更新了动态');
    assert.equal(notified[0].body, 'fresh');
    assert.equal(watch.data['1'].lastDynamicId, 'new');
  });

  it('same: does not notify or update cursor', async () => {
    const watch = {
      data: { '1': { lastDynamicId: 'same-id' } },
      get(uid) {
        return this.data[uid];
      },
      set(uid, id) {
        this.data[uid] = { lastDynamicId: id, updatedAt: Date.now() };
      },
    };
    const notified = [];
    await runWatchRound({
      favorites: [{ uid: '1', name: 'A', notifyEnabled: true }],
      fetchDynamicsForUid: async () => ({
        items: [{ id: 'same-id', isTop: false, title: 't', text: '' }],
      }),
      watch,
      onNotify: (p) => notified.push(p),
    });
    assert.deepEqual(notified, []);
    assert.equal(watch.data['1'].lastDynamicId, 'same-id');
    assert.equal(watch.data['1'].updatedAt, undefined);
  });

  it('skips UP when only pinned dynamics exist', async () => {
    const watch = {
      data: {},
      get(uid) {
        return this.data[uid];
      },
      set(uid, id) {
        this.data[uid] = { lastDynamicId: id };
      },
    };
    const notified = [];
    await runWatchRound({
      favorites: [{ uid: '1', name: 'A', notifyEnabled: true }],
      fetchDynamicsForUid: async () => ({
        items: [{ id: 'top', isTop: true, title: 'pinned', text: '' }],
      }),
      watch,
      onNotify: (p) => notified.push(p),
    });
    assert.deepEqual(notified, []);
    assert.equal(watch.data['1'], undefined);
  });

  it('ignores favorites without notifyEnabled', async () => {
    let fetched = false;
    await runWatchRound({
      favorites: [{ uid: '1', name: 'A', notifyEnabled: false }],
      fetchDynamicsForUid: async () => {
        fetched = true;
        return { items: [] };
      },
      watch: { get: () => undefined, set: () => {} },
      onNotify: () => {},
    });
    assert.equal(fetched, false);
  });

  it('skips UP on fetch error without notifying', async () => {
    const watch = {
      data: { '1': { lastDynamicId: 'keep' } },
      get(uid) {
        return this.data[uid];
      },
      set(uid, id) {
        this.data[uid] = { lastDynamicId: id };
      },
    };
    const notified = [];
    await runWatchRound({
      favorites: [{ uid: '1', name: 'A', notifyEnabled: true }],
      fetchDynamicsForUid: async () => {
        throw new Error('network');
      },
      watch,
      onNotify: (p) => notified.push(p),
    });
    assert.deepEqual(notified, []);
    assert.equal(watch.data['1'].lastDynamicId, 'keep');
  });

  it('processes notifyEnabled favorites serially', async () => {
    const order = [];
    const watch = {
      data: {},
      get(uid) {
        return this.data[uid];
      },
      set(uid, id) {
        this.data[uid] = { lastDynamicId: id };
      },
    };
    await runWatchRound({
      favorites: [
        { uid: '1', name: 'A', notifyEnabled: true },
        { uid: '2', name: 'B', notifyEnabled: true },
      ],
      fetchDynamicsForUid: async (uid) => {
        order.push(`start-${uid}`);
        await new Promise((r) => setTimeout(r, 10));
        order.push(`end-${uid}`);
        return {
          items: [{ id: `dyn-${uid}`, isTop: false, title: 't', text: '' }],
        };
      },
      watch,
      onNotify: () => {},
    });
    assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2']);
  });
});
