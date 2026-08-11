const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  mapCommentTarget,
  normalizeDynamicItem,
  normalizeDynamicsResponse,
} = require('../electron/bilibili/dynamics');

describe('mapCommentTarget', () => {
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

  it('maps WORD to type 17', () => {
    assert.deepEqual(
      mapCommentTarget({ id_str: '88', type: 'DYNAMIC_TYPE_WORD', modules: {} }),
      { type: 17, oid: '88' },
    );
  });

  it('returns null for unknown', () => {
    assert.equal(mapCommentTarget({ id_str: '1', type: 'DYNAMIC_TYPE_LIVE', modules: {} }), null);
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
    assert.equal(out.items[0].commentSupported, true);
    assert.equal(out.items[0].type, 17);
    assert.equal(out.items[0].oid, '100');
  });
});
