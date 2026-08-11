const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFavoritesStore } = require('../electron/store/favorites');

describe('favorites store', () => {
  let dir;
  let file;
  let store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-fav-'));
    file = path.join(dir, 'favorites.json');
    store = createFavoritesStore(file);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds, lists, and removes favorites', () => {
    store.add({ uid: '1', name: 'A', avatar: 'http://a', savedAt: 1 });
    store.add({ uid: '2', name: 'B', avatar: 'http://b', savedAt: 2 });
    assert.equal(store.list().length, 2);
    store.remove('1');
    assert.deepEqual(store.list().map((x) => x.uid), ['2']);
  });

  it('dedupes by uid on add', () => {
    store.add({ uid: '1', name: 'A', avatar: 'http://a', savedAt: 1 });
    store.add({ uid: '1', name: 'A2', avatar: 'http://a2', savedAt: 3 });
    const list = store.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'A2');
  });

  it('returns empty list when file is corrupt', () => {
    fs.writeFileSync(file, '{not-json', 'utf8');
    assert.deepEqual(store.list(), []);
  });

  it('defaults notifyEnabled to false and can toggle', () => {
    store.add({ uid: '1', name: 'A', avatar: '', savedAt: 1 });
    assert.equal(store.list()[0].notifyEnabled, false);
    store.setNotify('1', true);
    assert.equal(store.list()[0].notifyEnabled, true);
  });

  it('normalizes missing notifyEnabled on list', () => {
    fs.writeFileSync(
      file,
      JSON.stringify([{ uid: '1', name: 'A', avatar: '', savedAt: 1 }]),
      'utf8',
    );
    assert.equal(store.list()[0].notifyEnabled, false);
  });

  it('reorders by uid list and persists', () => {
    store.add({ uid: '1', name: 'A', avatar: '', savedAt: 1 });
    store.add({ uid: '2', name: 'B', avatar: '', savedAt: 2 });
    store.add({ uid: '3', name: 'C', avatar: '', savedAt: 3 });
    // add unshifts → current order [3,2,1]
    store.reorder(['1', '3', '2']);
    assert.deepEqual(store.list().map((x) => x.uid), ['1', '3', '2']);
    const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(disk.map((x) => x.uid), ['1', '3', '2']);
  });

  it('ignores unknown uids and appends missing ones in original relative order', () => {
    store.add({ uid: '1', name: 'A', avatar: '', savedAt: 1 });
    store.add({ uid: '2', name: 'B', avatar: '', savedAt: 2 });
    store.add({ uid: '3', name: 'C', avatar: '', savedAt: 3 });
    // current [3,2,1]; request only 2 then unknown 9; missing 3 then 1 append
    store.reorder(['2', '9']);
    assert.deepEqual(store.list().map((x) => x.uid), ['2', '3', '1']);
  });
});
