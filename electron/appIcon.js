const path = require('path');

const ICONS_DIR = path.join(__dirname, 'icons');

/** Large brand / installer source (icon.png → build/icon.ico). */
function resolveAppIconPath({ appRoot } = {}) {
  return path.join(appRoot || path.join(__dirname, '..'), 'icon.png');
}

/** Window title bar — processed transparent PNG. */
function resolveWindowIconPath() {
  return path.join(ICONS_DIR, 'window.png');
}

/** System tray — 32px transparent PNG (reliable alpha on Windows). */
function resolveTrayIconPath() {
  return path.join(ICONS_DIR, 'tray.png');
}

module.exports = {
  resolveAppIconPath,
  resolveWindowIconPath,
  resolveTrayIconPath,
};
