const fs = require('fs');
const path = require('path');

const DEV_DIR_NAME = 'bili-up-viewer-dev';
const PROD_DIR_NAME = 'Bili UP Viewer';
const LEGACY_DIR_NAME = 'bili-up-viewer';

function resolveUserDataDir({ isPackaged, appData }) {
  return path.join(appData, isPackaged ? PROD_DIR_NAME : DEV_DIR_NAME);
}

function maybeMigrateLegacyUserData({
  legacyDir,
  destDir,
  exists = fs.existsSync,
  copyFn = (from, to) => fs.cpSync(from, to, { recursive: true }),
}) {
  if (!exists(legacyDir) || exists(destDir)) return { migrated: false };
  copyFn(legacyDir, destDir);
  return { migrated: true };
}

function configureIsolatedUserData(app) {
  const appData = app.getPath('appData');
  const isPackaged = app.isPackaged;
  const dest = resolveUserDataDir({ isPackaged, appData });
  if (!isPackaged) {
    const legacyDir = path.join(appData, LEGACY_DIR_NAME);
    try {
      maybeMigrateLegacyUserData({ legacyDir, destDir: dest });
    } catch (e) {
      console.error('[userData] legacy migrate failed', e);
    }
  }
  app.setPath('userData', dest);
  return dest;
}

function resolveInitialCookie({ settingsCookie, envCookie, isPackaged }) {
  const fromSettings = String(settingsCookie || '').trim();
  if (fromSettings) return fromSettings;
  if (!isPackaged) return String(envCookie || '').trim();
  return '';
}

module.exports = {
  DEV_DIR_NAME,
  PROD_DIR_NAME,
  LEGACY_DIR_NAME,
  resolveUserDataDir,
  maybeMigrateLegacyUserData,
  configureIsolatedUserData,
  resolveInitialCookie,
};
