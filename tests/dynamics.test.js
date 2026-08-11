const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  mapCommentTarget,
  normalizeDynamicItem,
  normalizeDynamicsResponse,
} = require('../electron/bilibili/dynamics');

describe('mapCommentTarget', () => {
  it('prefers basic.comment_type / comment_id_str', () => {
    assert.deepEqual(
      mapCommentTarget({
        id_str: '598505999099772730',
        type: 'DYNAMIC_TYPE_DRAW',
        basic: { comment_type: 11, comment_id_str: '175132990' },
        modules: { module_dynamic: { major: { opus: {} } } },
      }),
      { type: 11, oid: '175132990' },
    );
  });

  it('maps AV', () => {
    assert.deepEqual(
      mapCommentTarget({
        id_str: '9',
        type: 'DYNAMIC_TYPE_AV',
        modules: { module_dynamic: { major: { archive: { aid: '111' } } } },
      }),
      { type: 1, oid: '111' },
    );
  });

  it('maps DRAW album id as type 11', () => {
    assert.deepEqual(
      mapCommentTarget({
        id_str: '201',
        type: 'DYNAMIC_TYPE_DRAW',
        modules: { module_dynamic: { major: { draw: { id: '999' } } } },
      }),
      { type: 11, oid: '999' },
    );
  });

  it('maps WORD to type 17', () => {
    assert.deepEqual(
      mapCommentTarget({ id_str: '88', type: 'DYNAMIC_TYPE_WORD', modules: {} }),
      { type: 17, oid: '88' },
    );
  });

  it('maps FORWARD to type 17', () => {
    assert.deepEqual(
      mapCommentTarget({ id_str: '77', type: 'DYNAMIC_TYPE_FORWARD', modules: {} }),
      { type: 17, oid: '77' },
    );
  });

  it('returns null for unknown', () => {
    assert.equal(mapCommentTarget({ id_str: '1', type: 'DYNAMIC_TYPE_LIVE', modules: {} }), null);
  });
});

describe('normalizeDynamicItem', () => {
  it('normalizes video dynamics with title and cover', () => {
    const item = normalizeDynamicItem({
      id_str: '200',
      type: 'DYNAMIC_TYPE_AV',
      modules: {
        module_dynamic: {
          desc: { text: '推荐一下' },
          major: {
            archive: {
              aid: '333',
              bvid: 'BV1test',
              title: '测试视频',
              cover: 'https://example.com/cover.jpg',
            },
          },
        },
        module_author: { pub_ts: 1700000000 },
        module_stat: { comment: { count: 1 }, like: { count: 2 }, forward: { count: 0 } },
      },
    });
    assert.equal(item.label, '视频');
    assert.equal(item.title, '测试视频');
    assert.equal(item.cover, 'https://example.com/cover.jpg');
    assert.equal(item.text, '推荐一下');
    assert.equal(item.commentSupported, true);
    assert.equal(item.bvid, 'BV1test');
    assert.equal(item.jumpUrl, 'https://www.bilibili.com/video/BV1test');
    assert.equal(item.isTop, false);
  });

  it('marks pinned dynamics from module_tag', () => {
    const item = normalizeDynamicItem({
      id_str: '300',
      type: 'DYNAMIC_TYPE_WORD',
      modules: {
        module_tag: { text: '置顶' },
        module_dynamic: { desc: { text: '置顶内容' } },
        module_author: { pub_ts: 1700000100 },
        module_stat: { comment: { count: 0 }, like: { count: 0 }, forward: { count: 0 } },
      },
    });
    assert.equal(item.isTop, true);
  });

  it('normalizes draw dynamics with pics', () => {
    const item = normalizeDynamicItem({
      id_str: '201',
      type: 'DYNAMIC_TYPE_DRAW',
      modules: {
        module_dynamic: {
          major: {
            draw: {
              id: '999',
              items: [{ src: '//example.com/a.jpg' }, { url: 'http://example.com/b.jpg' }],
            },
          },
        },
        module_author: { pub_ts: 1700000001 },
        module_stat: { comment: { count: 0 }, like: { count: 0 }, forward: { count: 0 } },
      },
    });
    assert.equal(item.label, '图文');
    assert.deepEqual(item.pics, ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
    assert.equal(item.text, '');
  });

  it('reads opus pics for draw-like dynamics', () => {
    const item = normalizeDynamicItem({
      id_str: '202',
      type: 'DYNAMIC_TYPE_DRAW',
      modules: {
        module_dynamic: {
          major: {
            opus: {
              pics: [{ url: '//i0.hdslb.com/x.jpg' }],
            },
          },
        },
        module_author: { pub_ts: 1700000002 },
        module_stat: { comment: { count: 0 }, like: { count: 0 }, forward: { count: 0 } },
      },
    });
    assert.deepEqual(item.pics, ['https://i0.hdslb.com/x.jpg']);
  });
});

describe('normalizeDynamicsResponse', () => {
  it('builds items and page cursor', () => {
    const out = normalizeDynamicsResponse({
      code: 0,
      data: {
        has_more: true,
        offset: 'next-1',
        items: [
          {
            id_str: '100',
            type: 'DYNAMIC_TYPE_WORD',
            modules: {
              module_dynamic: { desc: { text: '你好' } },
              module_author: { pub_ts: 1700000000 },
              module_stat: { comment: { count: 2 }, like: { count: 3 }, forward: { count: 1 } },
            },
          },
        ],
      },
    });
    assert.equal(out.hasMore, true);
    assert.equal(out.nextOffset, 'next-1');
    assert.equal(out.items[0].text, '你好');
    assert.equal(out.items[0].label, '文字');
    assert.equal(out.items[0].commentSupported, true);
    assert.equal(out.items[0].type, 17);
    assert.equal(out.items[0].oid, '100');
  });
});
