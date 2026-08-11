const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSettingsStore } = require('../electron/store/settings');

describe('settings store', () => {
  let dir;
  let file;
  let store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-settings-'));
    file = path.join(dir, 'settings.json');
    store = createSettingsStore(file);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty cookie by default', () => {
    assert.deepEqual(store.get(), {
      cookie: '',
      notifyEnabled: true,
      notifyIntervalMin: 15,
    });
  });

  it('saves and loads cookie', () => {
    store.save({ cookie: 'SESSDATA=abc; bili_jct=xyz' });
    assert.equal(store.get().cookie, 'SESSDATA=abc; bili_jct=xyz');
  });

  it('returns defaults when file is corrupt', () => {
    fs.writeFileSync(file, '{not-json', 'utf8');
    assert.deepEqual(store.get(), {
      cookie: '',
      notifyEnabled: true,
      notifyIntervalMin: 15,
    });
  });

  it('saves notify settings and merges partial updates', () => {
    store.save({ cookie: 'a=1', notifyEnabled: false, notifyIntervalMin: 30 });
    store.save({ cookie: 'b=2' });
    assert.deepEqual(store.get(), {
      cookie: 'b=2',
      notifyEnabled: false,
      notifyIntervalMin: 30,
    });
  });

  it('clamps notifyIntervalMin to 5-60', () => {
    assert.equal(store.save({ notifyIntervalMin: 3 }).notifyIntervalMin, 5);
    assert.equal(store.save({ notifyIntervalMin: 99 }).notifyIntervalMin, 60);
    assert.equal(store.save({ notifyIntervalMin: 20 }).notifyIntervalMin, 20);
  });
});
