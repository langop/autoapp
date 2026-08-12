const path = require('path');

/** Large brand / installer source (icon.png → build/icon.ico). */
function resolveAppIconPath({ appPath }) {
  return path.join(appPath, 'icon.png');
}

/** Window title bar + system tray. */
function resolveWindowTrayIconPath({ appPath }) {
  return path.join(appPath, 'tuo.png');
}

module.exports = { resolveAppIconPath, resolveWindowTrayIconPath };
