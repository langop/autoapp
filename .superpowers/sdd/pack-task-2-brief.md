### Task 2: Shared app icon for window + tray

**Files:**
- Create: `electron/appIcon.js`
- Create: `tests/appIcon.test.js`
- Modify: `electron/main.js`锛坄BrowserWindow` `icon`锛?
- Modify: `electron/tray/appTray.js`
- Modify: `package.json` test 鑴氭湰

**Interfaces:**
- Produces: `resolveAppIconPath({ appRoot, isPackaged, resourcesPath, execPath }) -> string`
- Produces: `loadAppIconImage(nativeImage, opts) -> NativeImage`锛堝彲閫夛紱鎴?main/tray 鍚勮嚜 `createFromPath`锛?

- [ ] **Step 1: 鍐欏け璐ュ崟娴?*

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveAppIconPath } = require('../electron/appIcon');

describe('resolveAppIconPath', () => {
  it('returns icon.png under appRoot when not packaged', () => {
    assert.equal(
      resolveAppIconPath({
        appRoot: 'D:\\\\app',
        isPackaged: false,
        resourcesPath: '',
        execPath: 'C:\\\\electron.exe',
      }),
      path.join('D:\\\\app', 'icon.png'),
    );
  });

  it('prefers resources icon.png when packaged', () => {
    assert.equal(
      resolveAppIconPath({
        appRoot: 'D:\\\\app',
        isPackaged: true,
        resourcesPath: 'D:\\\\app\\\\resources',
        execPath: 'D:\\\\app\\\\Bili UP Viewer.exe',
      }),
      path.join('D:\\\\app\\\\resources', 'icon.png'),
    );
  });
});
```

- [ ] **Step 2: 瀹炵幇骞舵帴鍏?*

`electron/appIcon.js`锛?

```js
const path = require('path');

function resolveAppIconPath({
  appRoot,
  isPackaged,
  resourcesPath,
  execPath,
}) {
  if (isPackaged && resourcesPath) {
    return path.join(resourcesPath, 'icon.png');
  }
  if (appRoot) return path.join(appRoot, 'icon.png');
  return execPath || '';
}

function getDefaultAppRoot() {
  return path.join(__dirname, '..');
}

module.exports = { resolveAppIconPath, getDefaultAppRoot };
```

娉ㄦ剰锛歟lectron-builder 榛樿鎶?`files` 鎵撹繘 `app.asar`锛宍icon.png` 鍦?asar 鍐呮椂 `nativeImage.createFromPath` 閫氬父浠嶅彲璇?asar 璺緞銆傝嫢鎵樼洏鍦ㄦ煇浜涚幆澧冧笅澶辫触锛屾敼涓?`extraResources: [{ from: 'icon.png', to: 'icon.png' }]` 骞惰 packaged 璺緞鐢?`process.resourcesPath`锛堟湰浠诲姟鎸?resources 浼樺厛锛涘悓鏃舵妸 `icon.png` 鐣欏湪 `files` 閲屼害鍙€傚疄鐜版椂锛歱ackaged 鍏堣瘯 `path.join(process.resourcesPath, 'app.asar', 'icon.png')` 鎴?`app.getAppPath()` + `icon.png`锛夈€?

**绠€鍖栬惤鍦帮紙鎸夋瀹炵幇锛夛細**

```js
function resolveAppIconPath({ appPath, isPackaged, resourcesPath }) {
  // appPath = app.getAppPath()  锛堝紑鍙?椤圭洰鏍癸紝鎵撳寘=app.asar 璺緞锛?
  return path.join(appPath, 'icon.png');
}
```

鍗曟祴鏀逛负鏂█ `path.join(appPath, 'icon.png')`銆傜獥鍙ｄ笌鎵樼洏锛?

```js
const iconPath = resolveAppIconPath({ appPath: app.getAppPath() });
// BrowserWindow({ icon: iconPath, ... })
// tray: nativeImage.createFromPath(iconPath)
```

鏇存柊 `appTray.js` 鍒犻櫎鏈湴 `buv.png`/`icon.png` 纭紪鐮?join锛屾敼涓烘帴鏀?`iconPath` 鎴栬皟鐢?`resolveAppIconPath`銆?

- [ ] **Step 3: 璺戞祴璇?*

Run: `npm test`  
Expected: PASS

- [ ] **Step 4: 鏆傚瓨璇存槑**

```
feat: use icon.png for window and tray
```

---

