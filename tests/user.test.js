const { describe, it, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { fetchUserInfo } = require('../electron/bilibili/user');

describe('fetchUserInfo', () => {
  afterEach(() => {
    if (mock?.restoreAll) mock.restoreAll();
  });

  it('normalizes card payload', async () => {
    const client = {
      async getJson() {
        return {
          code: 0,
          data: {
            card: {
              mid: '123',
              name: '测试UP',
              face: 'https://example.com/a.jpg',
              sign: 'hello',
              level_info: { current_level: 5 },
            },
            follower: 99,
          },
        };
      },
    };
    const user = await fetchUserInfo(client, '123');
    assert.deepEqual(user, {
      uid: '123',
      name: '测试UP',
      avatar: 'https://example.com/a.jpg',
      sign: 'hello',
      fans: 99,
      level: 5,
    });
  });
});
