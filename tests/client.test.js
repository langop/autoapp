const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mapBiliError } = require('../electron/bilibili/client');

describe('mapBiliError', () => {
  it('maps risk-control codes', () => {
    for (const code of [-352, -412]) {
      const err = mapBiliError(code);
      assert.equal(err.message, '公开接口受限，可稍后重试或配置 Cookie');
      assert.equal(err.retryable, true);
      assert.equal(err.code, code);
    }
  });

  it('maps not-found style codes', () => {
    const err = mapBiliError(-404, '啥都木有');
    assert.match(err.message, /不存在|木有|找不到|用户/);
    assert.equal(err.retryable, false);
  });
});
