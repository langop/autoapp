const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  session,
  protocol,
  net,
  shell,
  Notification,
  dialog,
} = require('electron');
const path = require('path');
const { resolveCloseDecision } = require('./tray/closeDecision');
const { createAppTray, showMainWindow } = require('./tray/appTray');
const { createFavoritesStore } = require('./store/favorites');
const { createSettingsStore } = require('./store/settings');
const { createWatchStore } = require('./store/watch');
const { createClient, BiliRequestError } = require('./bilibili/client');
const { fetchUserInfo } = require('./bilibili/user');
const { fetchDynamics } = require('./bilibili/dynamics');
const { fetchComments } = require('./bilibili/comments');
const { createScheduler } = require('./notify/scheduler');
const { runWatchRound } = require('./notify/watcher');
const {
  resolveAppUserModelId,
  ensureWindowsNotifyShortcut,
} = require('./notify/windowsNotify');
const {
  configureIsolatedUserData,
  resolveInitialCookie,
} = require('./paths/userData');
const { resolveAppIconPath } = require('./appIcon');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'bili-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

configureIsolatedUserData(app);

const favoritesPath = path.join(app.getPath('userData'), 'favorites.json');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const watchPath = path.join(app.getPath('userData'), 'watch.json');
const favorites = createFavoritesStore(favoritesPath);
const settings = createSettingsStore(settingsPath);
const watch = createWatchStore(watchPath);

const savedCookie = settings.get().cookie || '';
const client = createClient({
  cookie: resolveInitialCookie({
    settingsCookie: savedCookie,
    envCookie: process.env.BILI_COOKIE || '',
    isPackaged: app.isPackaged,
  }),
});

let mainWindow = null;
let appTray = null;
let isQuitting = false;
let closeDialogOpen = false;
const activeNotifications = new Set();

function hideToTrayOrQuit() {
  if (!appTray) {
    isQuitting = true;
    app.quit();
    return;
  }
  mainWindow.hide();
}

function quitApp() {
  isQuitting = true;
  if (appTray) {
    appTray.destroy();
    appTray = null;
  }
  app.quit();
}

function openFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    showMainWindow(mainWindow);
  }
}

function showInAppNotify(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('favorite-dynamic-notify', payload);
}

function showDesktopNotify(payload) {
  // Always mirror in-app so a missed Windows toast is still visible.
  showInAppNotify(payload);
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: payload.title, body: payload.body });
  activeNotifications.add(n);
  const release = () => activeNotifications.delete(n);
  n.on('click', () => {
    release();
    if (mainWindow) {
      showMainWindow(mainWindow);
      mainWindow.webContents.send('open-favorite-dynamics', { uid: payload.uid });
    }
  });
  n.on('close', release);
  n.on('failed', (event, error) => {
    release();
    console.error('[notify] desktop notification failed', error || event);
  });
  n.show();
}

async function runNotifyWatchRound() {
  const cfg = settings.get();
  if (!cfg.notifyEnabled) return;
  await runWatchRound({
    favorites: favorites.list(),
    fetchDynamicsForUid: (uid) => fetchDynamics(client, { uid, offset: '' }),
    watch,
    onNotify: showDesktopNotify,
  });
}

const scheduler = createScheduler({
  getIntervalMs: () => settings.get().notifyIntervalMin * 60 * 1000,
  onTick: runNotifyWatchRound,
});

function wrap(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof BiliRequestError) return { error: e.toJSON() };
      return {
        error: {
          code: 'UNKNOWN',
          message: e?.message || '未知错误',
          retryable: true,
        },
      };
    }
  };
}

function setupMediaProtocol() {
  // Proxy Bilibili CDN images with a correct Referer.
  // Direct <img> from file:// often gets 403 from hdslb.com.
  protocol.handle('bili-media', async (request) => {
    try {
      const incoming = new URL(request.url);
      const target = new URL(`https://${incoming.host}${incoming.pathname}${incoming.search}`);
      const host = target.hostname;
      if (
        !host.endsWith('hdslb.com') &&
        !host.endsWith('bilibili.com') &&
        !host.endsWith('bilivideo.com')
      ) {
        return new Response('forbidden host', { status: 403 });
      }
      return net.fetch(target.toString(), {
        headers: {
          Referer: 'https://www.bilibili.com/',
          Origin: 'https://www.bilibili.com',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
    } catch (e) {
      return new Response(String(e?.message || e), { status: 500 });
    }
  });
}

function setupImageHeaders() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.hdslb.com/*',
        '*://*.bilibili.com/*',
        '*://*.bilivideo.com/*',
      ],
    },
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      headers.Referer = 'https://www.bilibili.com/';
      headers.Origin = 'https://www.bilibili.com';
      callback({ requestHeaders: headers });
    },
  );
}

function createWindow() {
  const iconPath = resolveAppIconPath({ appPath: app.getAppPath() });
  mainWindow = new BrowserWindow({
    width: 390,
    height: 633,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('close', async (event) => {
    const decision = resolveCloseDecision({
      closeAction: settings.get().closeAction,
      isQuitting,
    });
    if (decision === 'allow-quit') {
      if (isQuitting) return;
      event.preventDefault();
      quitApp();
      return;
    }
    event.preventDefault();
    if (decision === 'hide') {
      hideToTrayOrQuit();
      return;
    }
    // ask
    if (closeDialogOpen) return;
    closeDialogOpen = true;
    try {
      const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: '关闭窗口',
        message: '关闭窗口后是否继续在后台接收动态提醒？',
        checkboxLabel: '记住我的选择',
        checkboxChecked: false,
        buttons: ['最小化到托盘', '退出应用', '取消'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      });
      if (response === 2) return; // 取消
      if (response === 0) {
        if (checkboxChecked) settings.save({ closeAction: 'tray' });
        hideToTrayOrQuit();
        return;
      }
      if (response === 1) {
        if (checkboxChecked) settings.save({ closeAction: 'quit' });
        quitApp();
      }
    } finally {
      closeDialogOpen = false;
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) contents.loadURL(url);
      return { action: 'deny' };
    });
  }
});

if (process.platform === 'win32') {
  app.setAppUserModelId(resolveAppUserModelId());
}

app.whenReady().then(() => {
  setupMediaProtocol();
  setupImageHeaders();
  Menu.setApplicationMenu(null);
  const shortcut = ensureWindowsNotifyShortcut({ app, shell });
  if (!shortcut.ok) {
    console.error('[notify] start menu shortcut setup failed', shortcut.reason);
  }

  ipcMain.handle('getUserInfo', wrap(async (_e, uid) => fetchUserInfo(client, uid)));
  ipcMain.handle('listFavorites', wrap(async () => favorites.list()));
  ipcMain.handle(
    'addFavorite',
    wrap(async (_e, user) => favorites.add(user)),
  );
  ipcMain.handle(
    'removeFavorite',
    wrap(async (_e, uid) => {
      watch.remove(uid);
      return favorites.remove(uid);
    }),
  );
  ipcMain.handle(
    'setFavoriteNotify',
    wrap(async (_e, { uid, enabled }) => {
      const list = favorites.setNotify(uid, enabled);
      // Baseline immediately on enable so posts before the next interval
      // are not swallowed as a silent "init" cursor write.
      if (enabled) await runNotifyWatchRound();
      return list;
    }),
  );
  ipcMain.handle(
    'reorderFavorites',
    wrap(async (_e, uids) => favorites.reorder(uids)),
  );
  ipcMain.handle(
    'getDynamics',
    wrap(async (_e, payload) => fetchDynamics(client, payload || {})),
  );
  ipcMain.handle(
    'getComments',
    wrap(async (_e, payload) => fetchComments(client, payload || {})),
  );
  ipcMain.handle(
    'getSettings',
    wrap(async () => settings.get()),
  );
  ipcMain.handle(
    'saveSettings',
    wrap(async (_e, payload) => {
      const next = settings.save(payload || {});
      client.setCookie(
        resolveInitialCookie({
          settingsCookie: next.cookie || '',
          envCookie: process.env.BILI_COOKIE || '',
          isPackaged: app.isPackaged,
        }),
      );
      scheduler.restart();
      return { ok: true, settings: next };
    }),
  );
  ipcMain.handle(
    'openExternal',
    wrap(async (_e, rawUrl) => {
      const u = new URL(String(rawUrl || ''));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error('非法链接');
      }
      const host = u.hostname.toLowerCase();
      if (
        !host.endsWith('bilibili.com') &&
        host !== 'b23.tv' &&
        !host.endsWith('.b23.tv')
      ) {
        throw new Error('仅允许打开 B 站链接');
      }
      await shell.openExternal(u.toString());
      return { ok: true };
    }),
  );

  const iconPath = resolveAppIconPath({ appPath: app.getAppPath() });
  createWindow();
  appTray = createAppTray({
    onOpen: openFromTray,
    onQuit: quitApp,
    iconPath,
  });
  scheduler.start();
});

app.on('before-quit', () => {
  isQuitting = true;
  scheduler.stop();
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  if (isQuitting) app.quit();
  // 隐藏到托盘时不 quit
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
