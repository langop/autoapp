# Icon + Dev/Prod Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一使用 `icon.png` 作为应用图标；用 electron-builder 打 Windows NSIS 安装包；开发/生产 userData 隔离，生产首次仅为空默认配置。

**Architecture:** `ready` 前按 `app.isPackaged` 设置隔离 `userData`；共享 `resolveAppIconPath` 供窗口/托盘；`package.json` `build` 白名单打包；开发保留 `BILI_COOKIE` 回退，生产禁用。

**Tech Stack:** Electron 33、electron-builder、png-to-ico、现有 settings/favorites/watch stores、Node `node:test`。

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-12-icon-and-packaging-design.md`
- `productName`: `Bili UP Viewer`；`appId`: `com.bili.up.viewer`
- 开发 userData：`%APPDATA%/bili-up-viewer-dev`；生产：`%APPDATA%/Bili UP Viewer`
- 安装包 `files` 仅 `electron/**`、`renderer/**`、`icon.png`、`package.json`；禁止用户数据 / `.env` / `data/` / `dist/`
- 生产不读 `process.env.BILI_COOKIE`；开发可读
- 不做自动更新、签名、mac/linux
- 提交仅在用户明确要求时进行（Commit 步骤改为暂存说明）

## File Structure

| File | Responsibility |
|---|---|
| `electron/paths/userData.js` | 解析/应用隔离 userData；可选旧目录迁移 |
| `electron/appIcon.js` | 解析 `icon.png` / packaged 图标路径 |
| `scripts/generate-icons.js` | `icon.png` → `build/icon.ico` |
| `electron/main.js` | 最早调用 userData 配置；窗口 icon；Cookie 仅开发 env |
| `electron/tray/appTray.js` | 使用共享图标解析 |
| `electron/notify/windowsNotify.js` | packaged 跳过自建快捷方式 |
| `package.json` | scripts + electron-builder `build` |
| `.gitignore` | `dist/` |
| `tests/userData.test.js` | 路径解析 / 迁移条件 |
| `tests/appIcon.test.js` | 图标路径 |
| `tests/packageBuild.test.js` | `files` 白名单不含敏感路径 |
| `build/icon.ico` | 生成后提交 |

---

### Task 1: Isolated userData + prod cookie policy

**Files:**
- Create: `electron/paths/userData.js`
- Create: `tests/userData.test.js`
- Modify: `electron/main.js`（顶部顺序：配置 userData → 再读 store；Cookie 回退）
- Modify: `package.json`（test 脚本加入新文件）

**Interfaces:**
- Consumes: `fs`、`path`、Electron `app`（仅在 apply 时）
- Produces:
  - `resolveUserDataDir({ isPackaged, appData }) -> string`
  - `maybeMigrateLegacyUserData({ legacyDir, destDir, copyFn }) -> { migrated: boolean }`
  - `configureIsolatedUserData(app)` — 在任何 `app.getPath('userData')` **之前**调用
  - `resolveInitialCookie({ settingsCookie, envCookie, isPackaged }) -> string`

- [ ] **Step 1: 写失败单测**

`tests/userData.test.js`：

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  resolveUserDataDir,
  maybeMigrateLegacyUserData,
  resolveInitialCookie,
} = require('../electron/paths/userData');

describe('resolveUserDataDir', () => {
  it('uses bili-up-viewer-dev when not packaged', () => {
    assert.equal(
      resolveUserDataDir({ isPackaged: false, appData: 'C:\\\\Users\\\\x\\\\AppData\\\\Roaming' }),
      path.join('C:\\\\Users\\\\x\\\\AppData\\\\Roaming', 'bili-up-viewer-dev'),
    );
  });

  it('uses Bili UP Viewer when packaged', () => {
    assert.equal(
      resolveUserDataDir({ isPackaged: true, appData: 'C:\\\\Users\\\\x\\\\AppData\\\\Roaming' }),
      path.join('C:\\\\Users\\\\x\\\\AppData\\\\Roaming', 'Bili UP Viewer'),
    );
  });
});

describe('maybeMigrateLegacyUserData', () => {
  it('copies when legacy exists and dest missing', () => {
    const calls = [];
    const result = maybeMigrateLegacyUserData({
      legacyDir: 'L',
      destDir: 'D',
      exists: (p) => p === 'L',
      copyFn: (from, to) => calls.push([from, to]),
    });
    assert.equal(result.migrated, true);
    assert.deepEqual(calls, [['L', 'D']]);
  });

  it('skips when dest already exists', () => {
    const result = maybeMigrateLegacyUserData({
      legacyDir: 'L',
      destDir: 'D',
      exists: () => true,
      copyFn: () => {
        throw new Error('should not copy');
      },
    });
    assert.equal(result.migrated, false);
  });
});

describe('resolveInitialCookie', () => {
  it('allows env cookie only when not packaged', () => {
    assert.equal(
      resolveInitialCookie({
        settingsCookie: '',
        envCookie: 'SESSDATA=dev',
        isPackaged: false,
      }),
      'SESSDATA=dev',
    );
    assert.equal(
      resolveInitialCookie({
        settingsCookie: '',
        envCookie: 'SESSDATA=dev',
        isPackaged: true,
      }),
      '',
    );
  });

  it('prefers settings cookie always', () => {
    assert.equal(
      resolveInitialCookie({
        settingsCookie: 'from-file',
        envCookie: 'from-env',
        isPackaged: false,
      }),
      'from-file',
    );
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `node --test tests/userData.test.js`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `electron/paths/userData.js`**

```js
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
```

- [ ] **Step 4: 改 `main.js` 加载顺序**

在文件最顶部（`protocol.registerSchemesAsPrivileged` 可保留在前，但 **必须在第一次 `app.getPath('userData')` 之前**）调用：

```js
const {
  configureIsolatedUserData,
  resolveInitialCookie,
} = require('./paths/userData');

// AFTER requiring electron app, BEFORE favoritesPath/settingsPath:
configureIsolatedUserData(app);

const favoritesPath = path.join(app.getPath('userData'), 'favorites.json');
// ...
const savedCookie = settings.get().cookie || '';
const client = createClient({
  cookie: resolveInitialCookie({
    settingsCookie: savedCookie,
    envCookie: process.env.BILI_COOKIE || '',
    isPackaged: app.isPackaged,
  }),
});
```

同步修改 `saveSettings` 里 `client.setCookie`：

```js
client.setCookie(
  resolveInitialCookie({
    settingsCookie: next.cookie || '',
    envCookie: process.env.BILI_COOKIE || '',
    isPackaged: app.isPackaged,
  }),
);
```

- [ ] **Step 5: 跑通测试并更新 package.json test 列表**

Run: `node --test tests/userData.test.js` 与 `npm test`  
Expected: PASS

- [ ] **Step 6: 暂存说明**

```
feat: isolate dev/prod userData and block prod env cookie
```

---

### Task 2: Shared app icon for window + tray

**Files:**
- Create: `electron/appIcon.js`
- Create: `tests/appIcon.test.js`
- Modify: `electron/main.js`（`BrowserWindow` `icon`）
- Modify: `electron/tray/appTray.js`
- Modify: `package.json` test 脚本

**Interfaces:**
- Produces: `resolveAppIconPath({ appRoot, isPackaged, resourcesPath, execPath }) -> string`
- Produces: `loadAppIconImage(nativeImage, opts) -> NativeImage`（可选；或 main/tray 各自 `createFromPath`）

- [ ] **Step 1: 写失败单测**

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

- [ ] **Step 2: 实现并接入**

`electron/appIcon.js`：

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

注意：electron-builder 默认把 `files` 打进 `app.asar`，`icon.png` 在 asar 内时 `nativeImage.createFromPath` 通常仍可读 asar 路径。若托盘在某些环境下失败，改为 `extraResources: [{ from: 'icon.png', to: 'icon.png' }]` 并让 packaged 路径用 `process.resourcesPath`（本任务按 resources 优先；同时把 `icon.png` 留在 `files` 里亦可。实现时：packaged 先试 `path.join(process.resourcesPath, 'app.asar', 'icon.png')` 或 `app.getAppPath()` + `icon.png`）。

**简化落地（按此实现）：**

```js
function resolveAppIconPath({ appPath, isPackaged, resourcesPath }) {
  // appPath = app.getAppPath()  （开发=项目根，打包=app.asar 路径）
  return path.join(appPath, 'icon.png');
}
```

单测改为断言 `path.join(appPath, 'icon.png')`。窗口与托盘：

```js
const iconPath = resolveAppIconPath({ appPath: app.getAppPath() });
// BrowserWindow({ icon: iconPath, ... })
// tray: nativeImage.createFromPath(iconPath)
```

更新 `appTray.js` 删除本地 `buv.png`/`icon.png` 硬编码 join，改为接收 `iconPath` 或调用 `resolveAppIconPath`。

- [ ] **Step 3: 跑测试**

Run: `npm test`  
Expected: PASS

- [ ] **Step 4: 暂存说明**

```
feat: use icon.png for window and tray
```

---

### Task 3: electron-builder, icons script, packaged notify skip

**Files:**
- Create: `scripts/generate-icons.js`
- Create: `tests/packageBuild.test.js`
- Modify: `package.json`（deps、scripts、`build`）
- Modify: `.gitignore`
- Modify: `electron/notify/windowsNotify.js`（packaged skip）
- Modify: `tests/windowsNotify.test.js`（若需覆盖 skip）
- Create: `build/icon.ico`（运行 icons 后提交）

**Interfaces:**
- `npm run icons` → 写 `build/icon.ico`
- `npm run pack` / `npm run dist`
- `ensureWindowsNotifyShortcut` 在 `app.isPackaged` 时 `{ ok: true, skipped: true }`

- [ ] **Step 1: 安装依赖**

Run:

```bash
npm install --save-dev electron-builder png-to-ico
```

- [ ] **Step 2: `scripts/generate-icons.js`**

```js
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

async function main() {
  const root = path.join(__dirname, '..');
  const src = path.join(root, 'icon.png');
  const outDir = path.join(root, 'build');
  const out = path.join(outDir, 'icon.ico');
  if (!fs.existsSync(src)) throw new Error('missing icon.png');
  fs.mkdirSync(outDir, { recursive: true });
  const buf = await pngToIco(src);
  fs.writeFileSync(out, buf);
  console.log('wrote', out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Run: `node scripts/generate-icons.js`  
Expected: 生成 `build/icon.ico`

- [ ] **Step 3: 扩展 `package.json`**

```json
{
  "scripts": {
    "start": "electron .",
    "icons": "node scripts/generate-icons.js",
    "pack": "npm run icons && electron-builder --dir",
    "dist": "npm run icons && electron-builder --win nsis",
    "test": "…existing… tests/userData.test.js tests/appIcon.test.js tests/packageBuild.test.js"
  },
  "build": {
    "appId": "com.bili.up.viewer",
    "productName": "Bili UP Viewer",
    "directories": { "output": "dist" },
    "files": [
      "electron/**/*",
      "renderer/**/*",
      "icon.png",
      "package.json"
    ],
    "asar": true,
    "win": {
      "icon": "build/icon.ico",
      "target": ["nsis"]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Bili UP Viewer"
    }
  }
}
```

`.gitignore` 增加：

```
dist/
```

（`build/icon.ico` 提交进库。）

- [ ] **Step 4: `tests/packageBuild.test.js` 白名单断言**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');

describe('electron-builder files whitelist', () => {
  it('only ships app code and icon.png', () => {
    const files = pkg.build.files;
    assert.ok(Array.isArray(files));
    assert.deepEqual(
      [...files].sort(),
      ['electron/**/*', 'icon.png', 'package.json', 'renderer/**/*'].sort(),
    );
    const joined = files.join('\n');
    assert.equal(joined.includes('favorites.json'), false);
    assert.equal(joined.includes('.env'), false);
    assert.equal(joined.includes('data/'), false);
  });

  it('uses expected product identity', () => {
    assert.equal(pkg.build.appId, 'com.bili.up.viewer');
    assert.equal(pkg.build.productName, 'Bili UP Viewer');
  });
});
```

- [ ] **Step 5: packaged 跳过通知快捷方式**

在 `ensureWindowsNotifyShortcut` 开头：

```js
if (app.isPackaged) return { ok: true, skipped: true };
```

（`app` 已由调用方传入。）

- [ ] **Step 6: 跑 `npm test` 与 `npm run pack`（目录产物冒烟）**

Run: `npm test`  
Expected: PASS  

Run: `npm run pack`  
Expected: `dist/win-unpacked/Bili UP Viewer.exe` 存在；解压目录中无 `favorites.json` / 用户 `settings.json`。

（完整 `npm run dist` 可在本机手动跑；若 CI 无 Windows 签名环境，至少 `pack` 成功。）

- [ ] **Step 7: 暂存说明**

```
feat: add electron-builder NSIS packaging and icon pipeline
```

---

## Spec coverage checklist

| Spec 要求 | Task |
|---|---|
| icon.png 窗口/托盘 | Task 2 |
| build/icon.ico + icons 脚本 | Task 3 |
| NSIS / productName / appId | Task 3 |
| userData 开发/生产隔离 + 迁移 | Task 1 |
| 包内无用户数据 | Task 3 `files` + 测试 |
| 生产不读 BILI_COOKIE | Task 1 |
| packaged 跳过自建通知快捷方式 | Task 3 |

## Placeholder scan

无 TBD；ico 生成与 pack 命令已写明。
