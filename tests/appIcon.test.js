const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  resolveAppIconPath,
  resolveWindowTrayIconPath,
} = require('../electron/appIcon');

describe('resolveAppIconPath', () => {
  it('returns icon.png under appPath', () => {
    assert.equal(
      resolveAppIconPath({ appPath: 'D:\\app' }),
      path.join('D:\\app', 'icon.png'),
    );
  });
});

describe('resolveWindowTrayIconPath', () => {
  it('returns tuo.png under appPath', () => {
    assert.equal(
      resolveWindowTrayIconPath({ appPath: 'D:\\app' }),
      path.join('D:\\app', 'tuo.png'),
    );
  });

  it('works for packaged app.asar path', () => {
    assert.equal(
      resolveWindowTrayIconPath({
        appPath: 'D:\\install\\resources\\app.asar',
      }),
      path.join('D:\\install\\resources\\app.asar', 'tuo.png'),
    );
  });
});
