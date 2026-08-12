const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  resolveUserDataDir,
  maybeMigrateLegacyUserData,
  resolveInitialCookie,
} = require('../electron/paths/userData');

describe('resolveUserDataDir', () => {
  it('uses bili-up-viewer-dev when not packaged', () => {
    assert.equal(
      resolveUserDataDir({ isPackaged: false, appData: 'C:\\Users\\x\\AppData\\Roaming' }),
      path.join('C:\\Users\\x\\AppData\\Roaming', 'bili-up-viewer-dev'),
    );
  });

  it('uses Bili UP Viewer when packaged', () => {
    assert.equal(
      resolveUserDataDir({ isPackaged: true, appData: 'C:\\Users\\x\\AppData\\Roaming' }),
      path.join('C:\\Users\\x\\AppData\\Roaming', 'Bili UP Viewer'),
    );
  });
});

describe('maybeMigrateLegacyUserData', () => {
  it('copies when legacy exists and dest missing', () => {
    const calls = [];
    const result = maybeMigrateLegacyUserData({
      legacyDir: 'L',
      destDir: 'D',
      exists: (p) => p === 'L',
      copyFn: (from, to) => calls.push([from, to]),
    });
    assert.equal(result.migrated, true);
    assert.deepEqual(calls, [['L', 'D']]);
  });

  it('skips when dest already exists', () => {
    const result = maybeMigrateLegacyUserData({
      legacyDir: 'L',
      destDir: 'D',
      exists: () => true,
      copyFn: () => {
        throw new Error('should not copy');
      },
    });
    assert.equal(result.migrated, false);
  });
});

describe('resolveInitialCookie', () => {
  it('allows env cookie only when not packaged', () => {
    assert.equal(
      resolveInitialCookie({
        settingsCookie: '',
        envCookie: 'SESSDATA=dev',
        isPackaged: false,
      }),
      'SESSDATA=dev',
    );
    assert.equal(
      resolveInitialCookie({
        settingsCookie: '',
        envCookie: 'SESSDATA=dev',
        isPackaged: true,
      }),
      '',
    );
  });

  it('prefers settings cookie always', () => {
    assert.equal(
      resolveInitialCookie({
        settingsCookie: 'from-file',
        envCookie: 'from-env',
        isPackaged: false,
      }),
      'from-file',
    );
  });
});
