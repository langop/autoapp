const fs = require('fs');
const path = require('path');

const PACKAGED_AUMID = 'com.bili.up.viewer';
const SHORTCUT_NAME = 'Bili UP Viewer.lnk';

function resolveAppUserModelId({
  platform = process.platform,
  defaultApp = Boolean(process.defaultApp),
  execPath = process.execPath,
} = {}) {
  if (platform !== 'win32') return PACKAGED_AUMID;
  // Unpackaged `electron .`: Windows toasts need AUMID to match a Start Menu
  // shortcut. Electron's recommended dev setup uses the electron.exe path.
  if (defaultApp) return execPath;
  return PACKAGED_AUMID;
}

function buildShortcutOptions({
  execPath,
  defaultApp,
  appRoot,
}) {
  const appUserModelId = resolveAppUserModelId({
    platform: 'win32',
    defaultApp,
    execPath,
  });
  return {
    target: execPath,
    cwd: defaultApp ? appRoot : path.dirname(execPath),
    args: defaultApp ? `"${appRoot}"` : '',
    description: 'Bili UP Viewer',
    appUserModelId,
  };
}

function ensureWindowsNotifyShortcut({ app, shell }) {
  if (process.platform !== 'win32') return { ok: false, reason: 'not-win32' };
  const shortcutPath = path.join(
    app.getPath('appData'),
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    SHORTCUT_NAME,
  );
  const appRoot = path.resolve(__dirname, '..', '..');
  const options = buildShortcutOptions({
    execPath: process.execPath,
    defaultApp: Boolean(process.defaultApp),
    appRoot,
  });

  try {
    if (fs.existsSync(shortcutPath)) {
      const cur = shell.readShortcutLink(shortcutPath);
      if (
        cur.target === options.target &&
        (cur.args || '') === (options.args || '') &&
        cur.appUserModelId === options.appUserModelId
      ) {
        return { ok: true, shortcutPath, updated: false };
      }
      shell.writeShortcutLink(shortcutPath, 'update', options);
      return { ok: true, shortcutPath, updated: true };
    }
    shell.writeShortcutLink(shortcutPath, 'create', options);
    return { ok: true, shortcutPath, updated: true };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e), shortcutPath };
  }
}

module.exports = {
  PACKAGED_AUMID,
  SHORTCUT_NAME,
  resolveAppUserModelId,
  buildShortcutOptions,
  ensureWindowsNotifyShortcut,
};
