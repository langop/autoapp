const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createWatchStore } = require('../electron/store/watch');

describe('watch store', () => {
  let dir;
  let file;
  let store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-watch-'));
    file = path.join(dir, 'watch.json');
    store = createWatchStore(file);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns undefined for missing uid', () => {
    assert.equal(store.get('123'), undefined);
  });

  it('sets and gets lastDynamicId with updatedAt', () => {
    store.set('123', 'dyn-a');
    const entry = store.get('123');
    assert.equal(entry.lastDynamicId, 'dyn-a');
    assert.equal(typeof entry.updatedAt, 'number');
    assert.ok(entry.updatedAt > 0);
  });

  it('persists to disk in byUid format', () => {
    store.set('123', 'dyn-a');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(raw), ['byUid']);
    assert.equal(raw.byUid['123'].lastDynamicId, 'dyn-a');
  });

  it('updates existing entry on set', () => {
    store.set('123', 'dyn-a');
    store.set('123', 'dyn-b');
    assert.equal(store.get('123').lastDynamicId, 'dyn-b');
  });

  it('remove deletes uid entry', () => {
    store.set('123', 'dyn-a');
    store.remove('123');
    assert.equal(store.get('123'), undefined);
  });

  it('clearMissing removes uids not in the keep list', () => {
    store.set('1', 'a');
    store.set('2', 'b');
    store.set('3', 'c');
    store.clearMissing(['1', '3']);
    assert.equal(store.get('1').lastDynamicId, 'a');
    assert.equal(store.get('2'), undefined);
    assert.equal(store.get('3').lastDynamicId, 'c');
  });

  it('returns empty byUid when file is corrupt', () => {
    fs.writeFileSync(file, '{not-json', 'utf8');
    assert.equal(store.get('123'), undefined);
    store.set('123', 'x');
    assert.equal(store.get('123').lastDynamicId, 'x');
  });
});
