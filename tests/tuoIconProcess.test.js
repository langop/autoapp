const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isBackgroundPixel,
  floodClearBackground,
  contentBounds,
} = require('../scripts/process-tuo-icon');

describe('tuo icon processing', () => {
  it('detects near-white matte as background', () => {
    assert.equal(isBackgroundPixel(255, 255, 255), true);
    assert.equal(isBackgroundPixel(250, 248, 252), true);
    assert.equal(isBackgroundPixel(237, 240, 239), true);
    assert.equal(isBackgroundPixel(232, 255, 254), true);
    assert.equal(isBackgroundPixel(80, 160, 220), false);
  });

  it('clears edge-connected white matte via flood fill', () => {
    // 3x3: white border, blue center
    const w = 3;
    const h = 3;
    const data = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const p = i << 2;
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = 255;
    }
    const c = (1 * w + 1) << 2;
    data[c] = 40;
    data[c + 1] = 140;
    data[c + 2] = 220;
    data[c + 3] = 255;

    floodClearBackground(data, w, h);
    assert.equal(data[3], 0); // corner transparent
    assert.equal(data[c + 3], 255); // center kept
    const bounds = contentBounds(data, w, h);
    assert.deepEqual(bounds, { minX: 1, minY: 1, maxX: 1, maxY: 1 });
  });
});
