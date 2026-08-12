const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');

describe('electron-builder files whitelist', () => {
  it('only ships app code and brand icon.png', () => {
    const files = pkg.build.files;
    assert.ok(Array.isArray(files));
    assert.deepEqual(
      [...files].sort(),
      ['electron/**/*', 'icon.png', 'package.json', 'renderer/**/*'].sort(),
    );
    const joined = files.join('\n');
    assert.equal(joined.includes('favorites.json'), false);
    assert.equal(joined.includes('.env'), false);
    assert.equal(joined.includes('data/'), false);
  });

  it('uses expected product identity', () => {
    assert.equal(pkg.build.appId, 'com.bili.up.viewer');
    assert.equal(pkg.build.productName, 'Bili UP Viewer');
  });
});
