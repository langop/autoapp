const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCommentsResponse } = require('../electron/bilibili/comments');

describe('normalizeCommentsResponse', () => {
  it('maps replies and hasMore by page.count', () => {
    const out = normalizeCommentsResponse(
      {
        code: 0,
        data: {
          page: { num: 1, size: 20, count: 21 },
          replies: [
            {
              rpid: 1,
              like: 4,
              ctime: 1700000001,
              member: { mid: 1001, uname: 'U', avatar: 'http://a' },
              content: { message: '评论1' },
              replies: [
                {
                  rpid: 2,
                  like: 0,
                  ctime: 1700000002,
                  member: { mid: 2002, uname: 'V', avatar: 'http://b' },
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
    assert.equal(out.items[0].mid, '1001');
    assert.equal(out.items[0].replies[0].content, '回复1');
    assert.equal(out.items[0].replies[0].mid, '2002');
  });

  it('uses cursor.is_end when available', () => {
    const ended = normalizeCommentsResponse(
      {
        code: 0,
        data: {
          cursor: { is_end: true, all_count: 100 },
          replies: [{ rpid: 1, member: { uname: 'A' }, content: { message: 'x' }, like: 0, ctime: 1 }],
        },
      },
      1,
      20,
    );
    assert.equal(ended.hasMore, false);

    const more = normalizeCommentsResponse(
      {
        code: 0,
        data: {
          cursor: { is_end: false, all_count: 100 },
          replies: [{ rpid: 1, member: { uname: 'A' }, content: { message: 'x' }, like: 0, ctime: 1 }],
        },
      },
      1,
      20,
    );
    assert.equal(more.hasMore, true);
  });

  it('maps comment pictures and emotes', () => {
    const out = normalizeCommentsResponse(
      {
        code: 0,
        data: {
          page: { num: 1, size: 20, count: 1 },
          replies: [
            {
              rpid: 9,
              like: 1,
              ctime: 1,
              member: { uname: 'P', avatar: '//i0.hdslb.com/a.png' },
              content: {
                message: '看图[doge]',
                pictures: [{ img_src: 'http://i0.hdslb.com/bfs/x.jpg' }],
                emote: {
                  '[doge]': {
                    text: '[doge]',
                    url: '//i0.hdslb.com/bfs/emote/doge.png',
                  },
                },
              },
            },
          ],
        },
      },
      1,
      20,
    );
    assert.deepEqual(out.items[0].pics, ['https://i0.hdslb.com/bfs/x.jpg']);
    assert.equal(out.items[0].avatar, 'https://i0.hdslb.com/a.png');
    assert.deepEqual(out.items[0].emotes, [
      { text: '[doge]', url: 'https://i0.hdslb.com/bfs/emote/doge.png' },
    ]);
  });

  it('falls back to page size when metadata missing', () => {
    const full = normalizeCommentsResponse(
      {
        code: 0,
        data: {
          replies: Array.from({ length: 20 }, (_, i) => ({
            rpid: i + 1,
            member: { uname: 'U' },
            content: { message: String(i) },
            like: 0,
            ctime: 1,
          })),
        },
      },
      1,
      20,
    );
    assert.equal(full.hasMore, true);

    const short = normalizeCommentsResponse(
      {
        code: 0,
        data: {
          replies: [{ rpid: 1, member: { uname: 'U' }, content: { message: 'a' }, like: 0, ctime: 1 }],
        },
      },
      1,
      20,
    );
    assert.equal(short.hasMore, false);
  });
});
