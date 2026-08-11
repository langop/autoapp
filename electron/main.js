const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createFavoritesStore } = require('./store/favorites');
const { createClient, BiliRequestError } = require('./bilibili/client');
const { fetchUserInfo } = require('./bilibili/user');
const { fetchDynamics } = require('./bilibili/dynamics');
const { fetchComments } = require('./bilibili/comments');

const favoritesPath = path.join(app.getPath('userData'), 'favorites.json');
const favorites = createFavoritesStore(favoritesPath);
const client = createClient({ cookie: process.env.BILI_COOKIE || '' });

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

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('getUserInfo', wrap(async (_e, uid) => fetchUserInfo(client, uid)));
  ipcMain.handle('listFavorites', wrap(async () => favorites.list()));
  ipcMain.handle(
    'addFavorite',
    wrap(async (_e, user) => favorites.add(user)),
  );
  ipcMain.handle(
    'removeFavorite',
    wrap(async (_e, uid) => favorites.remove(uid)),
  );
  ipcMain.handle(
    'getDynamics',
    wrap(async (_e, payload) => fetchDynamics(client, payload || {})),
  );
  ipcMain.handle(
    'getComments',
    wrap(async (_e, payload) => fetchComments(client, payload || {})),
  );
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
