### Task 2: Tray module + main-process close / quit wiring

**Files:**
- Create: `electron/tray/appTray.js`
- Modify: `electron/main.js`

**Interfaces:**
- Consumes: `resolveCloseDecision`锛沗settings.get/save`锛沗buv.png` 鍥炬爣
- Produces:
  - `createAppTray({ onOpen, onQuit }) -> { destroy }`
  - `showMainWindow(win)`锛歳estore + show + focus
  - main: `isQuitting` 鏍囧織锛沜lose 鎷︽埅锛沘sk 瀵硅瘽妗嗭紱`window-all-closed` 浠呭湪 `isQuitting` 鏃?quit
  - 閫氱煡鐐瑰嚮璺緞锛氳嫢绐楀彛 hidden锛屽厛 `showMainWindow`

- [ ] **Step 1: 瀹炵幇 `electron/tray/appTray.js`**

```js
const path = require('path');
const { Tray, Menu, nativeImage } = require('electron');

function loadTrayIcon() {
  const iconPath = path.join(__dirname, '..', '..', 'buv.png');
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

function createAppTray({ onOpen, onQuit }) {
  const tray = new Tray(loadTrayIcon());
  tray.setToolTip('Bili UP Viewer');
  const menu = Menu.buildFromTemplate([
    { label: '鎵撳紑', click: () => onOpen() },
    { type: 'separator' },
    { label: '閫€鍑?, click: () => onQuit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => onOpen());
  return {
    destroy() {
      tray.destroy();
    },
  };
}

module.exports = { createAppTray, showMainWindow, loadTrayIcon };
```

鑻?`nativeImage.createEmpty()` 鍦ㄧ洰鏍?Electron 涓婁笉鑳界敤浜?Tray锛屾敼涓轰粠 `process.execPath` 鍙栧浘鏍囷細`nativeImage.createFromPath(process.execPath)`锛屼粛澶辫触鍒?`console.error` 骞惰 `createAppTray` 杩斿洖 `null`锛坢ain 渚ф棤鎵樼洏鏃?close 鍐崇瓥 `hide`/`ask鈫抰ray` 鏀逛负鐩存帴 quit锛岄伩鍏嶆棤娉曢€€鍑猴級銆?

- [ ] **Step 2: 鍦?`main.js` 寮曞叆渚濊禆涓庣姸鎬?*

```js
const { app, BrowserWindow, ipcMain, Menu, session, protocol, net, shell, Notification, dialog, Tray } = require('electron');
// Tray 浠呭湪 appTray 鍐呬娇鐢ㄥ垯鍙幓鎺夎繖閲岀殑 Tray
const { resolveCloseDecision } = require('./tray/closeDecision');
const { createAppTray, showMainWindow } = require('./tray/appTray');

let mainWindow = null;
let appTray = null;
let isQuitting = false;
let closeDialogOpen = false;
```

- [ ] **Step 3: `createWindow` 缁戝畾 close 鎷︽埅**

鍦?`loadFile` 涔嬪悗銆乣closed` 涔嬪墠锛?

```js
mainWindow.on('close', async (event) => {
  const decision = resolveCloseDecision({
    closeAction: settings.get().closeAction,
    isQuitting,
  });
  if (decision === 'allow-quit') return;
  event.preventDefault();
  if (decision === 'hide') {
    mainWindow.hide();
    return;
  }
  // ask
  if (closeDialogOpen) return;
  closeDialogOpen = true;
  try {
    const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: '鍏抽棴绐楀彛',
      message: '鍏抽棴绐楀彛鍚庢槸鍚︾户缁湪鍚庡彴鎺ユ敹鍔ㄦ€佹彁閱掞紵',
      checkboxLabel: '璁颁綇鎴戠殑閫夋嫨',
      checkboxChecked: false,
      buttons: ['鏈€灏忓寲鍒版墭鐩?, '閫€鍑哄簲鐢?, '鍙栨秷'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (response === 2) return; // 鍙栨秷
    if (response === 0) {
      if (checkboxChecked) settings.save({ closeAction: 'tray' });
      mainWindow.hide();
      return;
    }
    if (response === 1) {
      if (checkboxChecked) settings.save({ closeAction: 'quit' });
      isQuitting = true;
      app.quit();
    }
  } finally {
    closeDialogOpen = false;
  }
});
```

娉ㄦ剰锛歚close` 鐩戝惉閲岀敤 `async` 鏃讹紝`preventDefault` 蹇呴』鍚屾璋冪敤锛堝凡婊¤冻锛夈€?

- [ ] **Step 4: 鍒涘缓鎵樼洏涓庨€€鍑鸿矾寰?*

鍦?`app.whenReady` 涓?`createWindow()` 鍓嶅悗锛?

```js
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

appTray = createAppTray({
  onOpen: openFromTray,
  onQuit: quitApp,
});
```

鏀?`window-all-closed`锛?

```js
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  if (isQuitting) app.quit();
  // 闅愯棌鍒版墭鐩樻椂涓?quit
});
```

`before-quit` 淇濇寔 `scheduler.stop()`锛涘彲鍦ㄥ叾涓 `isQuitting = true` 浠ラ槻婕忔爣銆?

- [ ] **Step 5: 閫氱煡鐐瑰嚮鏃?show 闅愯棌绐楀彛**

鍦ㄧ幇鏈?`showDesktopNotify` 鐨?`click` 閲岋紝鎶?focus 閫昏緫鎹㈡垚 `showMainWindow(mainWindow)`锛屽啀 `send('open-favorite-dynamics', 鈥?`銆?

- [ ] **Step 6: 鎵嬪姩鍐掔儫**

Run: `npm start`  
Expected:
1. 鐐?脳 鈫?璇㈤棶妗? 
2. 閫夈€屾渶灏忓寲鍒版墭鐩樸€嶁啋 绐楀彛娑堝け锛屾墭鐩樺浘鏍囧湪锛涙彁閱掗棿闅斿埌浠嶅彲妫€鏌? 
3. 鎵樼洏銆屾墦寮€銆嶆仮澶嶏紱銆岄€€鍑恒€嶈繘绋嬬粨鏉? 
4. 鍕鹃€夎浣?+ 鎵樼洏 鈫?鍐嶇偣 脳 涓嶅啀璇㈤棶  

- [ ] **Step 7: 鏆傚瓨璇存槑**

```
feat: wire system tray and close-window ask/hide/quit flow
```

---

