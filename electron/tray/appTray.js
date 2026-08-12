const path = require('path');
const { Tray, Menu, nativeImage } = require('electron');

function loadTrayIcon() {
  const iconPath = path.join(__dirname, '..', '..', 'icon.png');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    // 1x1 fallback so Tray construction does not throw in odd environments
    image = nativeImage.createEmpty();
  }
  return image;
}

function showMainWindow(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function buildTray(image, onOpen, onQuit) {
  const tray = new Tray(image);
  tray.setToolTip('Bili UP Viewer');
  const menu = Menu.buildFromTemplate([
    { label: '打开', click: () => onOpen() },
    { type: 'separator' },
    { label: '退出', click: () => onQuit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => onOpen());
  return {
    destroy() {
      tray.destroy();
    },
  };
}

function createAppTray({ onOpen, onQuit }) {
  let image = loadTrayIcon();
  try {
    return buildTray(image, onOpen, onQuit);
  } catch (e) {
    image = nativeImage.createFromPath(process.execPath);
    if (image.isEmpty()) {
      console.error('[tray] failed to load tray icon');
      return null;
    }
    try {
      return buildTray(image, onOpen, onQuit);
    } catch (err) {
      console.error('[tray] failed to create tray', err);
      return null;
    }
  }
}

module.exports = { createAppTray, showMainWindow, loadTrayIcon };
