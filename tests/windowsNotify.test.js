const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  PACKAGED_AUMID,
  resolveAppUserModelId,
  buildShortcutOptions,
} = require('../electron/notify/windowsNotify');

describe('resolveAppUserModelId', () => {
  it('uses electron execPath for unpackaged Windows apps', () => {
    assert.equal(
      resolveAppUserModelId({
        platform: 'win32',
        defaultApp: true,
        execPath: 'C:\\electron.exe',
      }),
      'C:\\electron.exe',
    );
  });

  it('uses packaged id when not defaultApp', () => {
    assert.equal(
      resolveAppUserModelId({
        platform: 'win32',
        defaultApp: false,
        execPath: 'C:\\app\\Bili.exe',
      }),
      PACKAGED_AUMID,
    );
  });
});

describe('buildShortcutOptions', () => {
  it('points unpackaged shortcut at electron with app root args', () => {
    const appRoot = 'D:\\workspace\\autoapp';
    const opts = buildShortcutOptions({
      execPath: 'C:\\electron.exe',
      defaultApp: true,
      appRoot,
    });
    assert.deepEqual(opts, {
      target: 'C:\\electron.exe',
      cwd: appRoot,
      args: `"${appRoot}"`,
      description: 'Bili UP Viewer',
      appUserModelId: 'C:\\electron.exe',
    });
  });

  it('points packaged shortcut at the app executable', () => {
    const execPath = 'C:\\app\\Bili UP Viewer.exe';
    const opts = buildShortcutOptions({
      execPath,
      defaultApp: false,
      appRoot: 'C:\\app\\resources\\app',
    });
    assert.equal(opts.target, execPath);
    assert.equal(opts.cwd, path.dirname(execPath));
    assert.equal(opts.args, '');
    assert.equal(opts.appUserModelId, PACKAGED_AUMID);
  });
});
