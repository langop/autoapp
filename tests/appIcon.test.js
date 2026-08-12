const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { PNG } = require('pngjs');
const {
  resolveWindowIconPath,
  resolveTrayIconPath,
} = require('../electron/appIcon');

describe('resolveWindowIconPath', () => {
  it('points at electron/icons/window.png', () => {
    const p = resolveWindowIconPath();
    assert.equal(path.basename(p), 'window.png');
    assert.ok(p.replace(/\\/g, '/').endsWith('electron/icons/window.png'));
  });
});

describe('resolveTrayIconPath', () => {
  it('points at electron/icons/tray.png', () => {
    const p = resolveTrayIconPath();
    assert.equal(path.basename(p), 'tray.png');
    assert.ok(p.replace(/\\/g, '/').endsWith('electron/icons/tray.png'));
  });
});

describe('generated tray icons', () => {
  it('window/tray assets exist with transparent corners', () => {
    const windowPath = resolveWindowIconPath();
    const trayPath = resolveTrayIconPath();
    assert.equal(fs.existsSync(windowPath), true);
    assert.equal(fs.existsSync(trayPath), true);

    const win = PNG.sync.read(fs.readFileSync(windowPath));
    assert.equal(win.data[3], 0);
    assert.equal(win.data[((win.width - 1) << 2) + 3], 0);

    const tray = PNG.sync.read(fs.readFileSync(trayPath));
    assert.equal(tray.width, 32);
    assert.equal(tray.height, 32);
    assert.equal(tray.data[3], 0);
  });
});
