const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveAppIconPath } = require('../electron/appIcon');

describe('resolveAppIconPath', () => {
  it('returns icon.png under appPath', () => {
    assert.equal(
      resolveAppIconPath({ appPath: 'D:\\app' }),
      path.join('D:\\app', 'icon.png'),
    );
  });

  it('works for packaged app.asar path', () => {
    assert.equal(
      resolveAppIconPath({ appPath: 'D:\\install\\resources\\app.asar' }),
      path.join('D:\\install\\resources\\app.asar', 'icon.png'),
    );
  });
});
