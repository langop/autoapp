const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function isBackgroundPixel(r, g, b) {
  // tuo.png was exported with an opaque white/light-gray checkerboard matte
  // (not real alpha). Match light low-saturation pixels only.
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum >= 210 && sat <= 0.14;
}

function zeroFullyTransparent(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }
}

function scrubLowAlpha(data, threshold = 40) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < threshold) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }
}

function erodeBackgroundFringe(data, width, height, passes = 2) {
  for (let pass = 0; pass < passes; pass++) {
    const clear = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) << 2;
        if (data[i + 3] === 0) continue;
        if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2])) continue;
        let nearTransparent = false;
        for (let dy = -1; dy <= 1 && !nearTransparent; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (data[((ny * width + nx) << 2) + 3] === 0) {
              nearTransparent = true;
              break;
            }
          }
        }
        if (nearTransparent) clear.push(i);
      }
    }
    for (const i of clear) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }
}

function finalizeAlpha(data, width, height) {
  floodClearBackground(data, width, height);
  erodeBackgroundFringe(data, width, height, 3);
  scrubLowAlpha(data, 48);
  zeroFullyTransparent(data);
}

function floodClearBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    const i = idx << 2;
    if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2])) return;
    data[i + 3] = 0;
    queue.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

function contentBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[((y * width + x) << 2) + 3];
      if (a < 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  return { minX, minY, maxX, maxY };
}

function cropWithPadding(data, width, height, padRatio = 0.08) {
  const b = contentBounds(data, width, height);
  const bw = b.maxX - b.minX + 1;
  const bh = b.maxY - b.minY + 1;
  const pad = Math.round(Math.max(bw, bh) * padRatio);
  const x0 = Math.max(0, b.minX - pad);
  const y0 = Math.max(0, b.minY - pad);
  const x1 = Math.min(width - 1, b.maxX + pad);
  const y1 = Math.min(height - 1, b.maxY + pad);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const side = Math.max(cw, ch);
  const out = Buffer.alloc(side * side * 4);
  const ox = Math.floor((side - cw) / 2);
  const oy = Math.floor((side - ch) / 2);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * width + (x0 + x)) << 2;
      const di = ((oy + y) * side + (ox + x)) << 2;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return { data: out, width: side, height: side };
}

function resizeArea(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * sw + xx) << 2;
          const alpha = src[i + 3];
          r += src[i] * alpha;
          g += src[i + 1] * alpha;
          b += src[i + 2] * alpha;
          a += alpha;
          n += 1;
        }
      }
      const o = (y * dw + x) << 2;
      if (a === 0 || n === 0) {
        out[o + 3] = 0;
      } else {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round(a / n);
      }
    }
  }
  return out;
}

function encodePng(data, width, height) {
  const png = new PNG({ width, height });
  data.copy(png.data);
  return PNG.sync.write(png);
}

function processTuoSource(srcBuf) {
  const png = PNG.sync.read(srcBuf);
  const { width, height, data } = png;
  for (let i = 0; i < width * height; i++) {
    const p = i << 2;
    if (data[p + 3] === undefined) data[p + 3] = 255;
  }
  finalizeAlpha(data, width, height);
  const cropped = cropWithPadding(data, width, height);
  finalizeAlpha(cropped.data, cropped.width, cropped.height);
  return cropped;
}

async function writeTrayAndWindowIcons({
  sourcePath,
  windowOutPath,
  trayPngOutPath,
  trayIcoOutPath,
  windowSize = 256,
  traySizes = [16, 24, 32, 48],
}) {
  const pngToIco = (await import('png-to-ico')).default;
  const srcBuf = fs.readFileSync(sourcePath);
  const square = processTuoSource(srcBuf);

  const windowData = resizeArea(
    square.data,
    square.width,
    square.height,
    windowSize,
    windowSize,
  );
  finalizeAlpha(windowData, windowSize, windowSize);
  fs.mkdirSync(path.dirname(windowOutPath), { recursive: true });
  fs.writeFileSync(windowOutPath, encodePng(windowData, windowSize, windowSize));

  const trayPngs = traySizes.map((size) => {
    const resized = resizeArea(
      square.data,
      square.width,
      square.height,
      size,
      size,
    );
    finalizeAlpha(resized, size, size);
    return { size, buf: encodePng(resized, size, size), data: resized };
  });

  // Primary tray asset: 32 PNG with real alpha (most reliable in Electron).
  const tray32 = trayPngs.find((t) => t.size === 32) || trayPngs[trayPngs.length - 1];
  fs.mkdirSync(path.dirname(trayPngOutPath), { recursive: true });
  fs.writeFileSync(trayPngOutPath, tray32.buf);

  if (trayIcoOutPath) {
    fs.mkdirSync(path.dirname(trayIcoOutPath), { recursive: true });
    fs.writeFileSync(
      trayIcoOutPath,
      await pngToIco(trayPngs.map((t) => t.buf)),
    );
  }

  return {
    windowOutPath,
    trayPngOutPath,
    trayIcoOutPath,
    sourceSize: { width: square.width, height: square.height },
  };
}

module.exports = {
  isBackgroundPixel,
  floodClearBackground,
  zeroFullyTransparent,
  scrubLowAlpha,
  erodeBackgroundFringe,
  finalizeAlpha,
  contentBounds,
  cropWithPadding,
  resizeArea,
  processTuoSource,
  writeTrayAndWindowIcons,
};
