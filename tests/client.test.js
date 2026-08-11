const { describe, it, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, mapBiliError, BiliRequestError } = require('../electron/bilibili/client');

const RISK_MESSAGE = '公开接口受限，可稍后重试或配置 Cookie';

describe('mapBiliError', () => {
  it('maps risk-control codes', () => {
    for (const code of [-352, -412]) {
      const err = mapBiliError(code);
      assert.equal(err.message, RISK_MESSAGE);
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

describe('createClient.getJson HTTP status mapping', () => {
  /** @type {import('node:test').Mock<(typeof fetch)> | undefined} */
  let fetchMock;

  afterEach(() => {
    fetchMock?.mock.restore();
    fetchMock = undefined;
  });

  for (const [httpStatus, expectedCode] of [
    [412, -412],
    [352, -352],
  ]) {
    it(`maps HTTP ${httpStatus} to risk-control error`, async () => {
      fetchMock = mock.method(globalThis, 'fetch', async () => ({
        ok: false,
        status: httpStatus,
        json: async () => ({}),
      }));

      const client = createClient({ delayMs: 0 });
      await assert.rejects(
        () => client.getJson('https://api.bilibili.com/x/space/acc/info'),
        (err) => {
          assert.ok(err instanceof BiliRequestError);
          assert.equal(err.code, expectedCode);
          assert.equal(err.message, RISK_MESSAGE);
          assert.equal(err.retryable, true);
          return true;
        },
      );
    });
  }
});
