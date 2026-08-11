const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCommentsResponse } = require('../electron/bilibili/comments');

describe('normalizeCommentsResponse', () => {
  it('maps replies and hasMore', () => {
    const out = normalizeCommentsResponse(
      {
        code: 0,
        data: {
          cursor: { all_count: 21 },
          replies: [
            {
              rpid: 1,
              like: 4,
              ctime: 1700000001,
              member: { uname: 'U', avatar: 'http://a' },
              content: { message: '评论1' },
              replies: [
                {
                  rpid: 2,
                  like: 0,
                  ctime: 1700000002,
                  member: { uname: 'V', avatar: 'http://b' },
                  content: { message: '回复1' },
                },
              ],
            },
          ],
        },
      },
      1,
      20,
    );
    assert.equal(out.page, 1);
    assert.equal(out.hasMore, true);
    assert.equal(out.items[0].content, '评论1');
    assert.equal(out.items[0].replies[0].content, '回复1');
  });
});
