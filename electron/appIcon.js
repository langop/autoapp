const path = require('path');

function resolveAppIconPath({ appPath }) {
  return path.join(appPath, 'icon.png');
}

module.exports = { resolveAppIconPath };
