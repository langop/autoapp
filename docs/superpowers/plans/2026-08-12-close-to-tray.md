# Close to Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 关闭主窗口时可询问并选择「最小化到托盘」或「退出」；支持记住选择与设置页修改；托盘常驻时提醒定时器继续运行。

**Architecture:** `settings.closeAction` 驱动主窗口 `close` 拦截；`ask` 时用 `dialog.showMessageBox`（含 checkbox）；`tray` 时 `hide` 窗口并靠 `Tray` 恢复/退出；纯函数 `resolveCloseDecision` 可单测关闭分支。

**Tech Stack:** Electron 33+（`Tray` / `Menu` / `dialog` / `nativeImage`）、现有 `createSettingsStore`、Node `node:test`。

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-12-close-to-tray-design.md`
- `closeAction: 'ask' | 'tray' | 'quit'`，默认 `'ask'`，非法值回退 `'ask'`
- 最小化按钮 `_` 不进托盘；仅点 ×（或等价 close）走本逻辑
- 不改动态提醒轮询语义；不做开机自启
- 启动即创建托盘；真正退出时销毁
- 应用代码位于仓库根目录；提交仅在用户明确要求时进行（本计划中的 Commit 步骤改为「暂存说明」，除非用户已授权提交）

## File Structure

| File | Responsibility |
|---|---|
| `electron/store/settings.js` | 读写 `closeAction` |
| `electron/tray/closeDecision.js` | 纯函数：关闭决策 |
| `electron/tray/appTray.js` | 创建/销毁托盘、显示窗口、退出钩子 |
| `electron/main.js` | 拦截 close、询问对话框、window-all-closed、通知点击 show |
| `renderer/index.html` / `app.js` | 设置页「关闭窗口时」控件 |
| `tests/settings.test.js` | `closeAction` 默认/非法/merge |
| `tests/closeDecision.test.js` | 关闭决策纯函数 |
| `buv.png` | 托盘图标（已存在于仓库根） |

---

### Task 1: Settings `closeAction` + close decision pure function

**Files:**
- Modify: `electron/store/settings.js`
- Modify: `tests/settings.test.js`
- Create: `electron/tray/closeDecision.js`
- Create: `tests/closeDecision.test.js`
- Modify: `package.json`（`test` 脚本加入新测试文件）

**Interfaces:**
- Consumes: 现有 `createSettingsStore` merge 模式
- Produces:
  - `settings.get/save` 含 `closeAction: 'ask' | 'tray' | 'quit'`
  - `normalizeCloseAction(value) -> 'ask' | 'tray' | 'quit'`
  - `resolveCloseDecision({ closeAction, isQuitting }) -> 'allow-quit' | 'hide' | 'ask'`

- [ ] **Step 1: 写 settings 失败用例**

在 `tests/settings.test.js` 更新默认断言并新增：

```js
it('defaults closeAction to ask', () => {
  assert.equal(store.get().closeAction, 'ask');
});

it('saves closeAction and rejects invalid values', () => {
  assert.equal(store.save({ closeAction: 'tray' }).closeAction, 'tray');
  assert.equal(store.save({ closeAction: 'quit' }).closeAction, 'quit');
  assert.equal(store.save({ closeAction: 'nope' }).closeAction, 'ask');
});

it('merges closeAction on partial save', () => {
  store.save({ closeAction: 'tray' });
  store.save({ cookie: 'x=1' });
  assert.equal(store.get().closeAction, 'tray');
  assert.equal(store.get().cookie, 'x=1');
});
```

同步把现有 `deepEqual(store.get(), { cookie, notifyEnabled, notifyIntervalMin })` 断言补上 `closeAction: 'ask'`。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/settings.test.js`  
Expected: FAIL（缺 `closeAction`）

- [ ] **Step 3: 实现 settings 字段**

在 `electron/store/settings.js`：

```js
const CLOSE_ACTIONS = new Set(['ask', 'tray', 'quit']);

function normalizeCloseAction(value) {
  return CLOSE_ACTIONS.has(value) ? value : 'ask';
}

const DEFAULTS = {
  cookie: '',
  notifyEnabled: true,
  notifyIntervalMin: 15,
  closeAction: 'ask',
};
```

`read()` / `save()` 均经 `normalizeCloseAction`；`save` merge 时：

```js
closeAction: normalizeCloseAction(
  partial?.closeAction != null ? partial.closeAction : prev.closeAction,
),
```

- [ ] **Step 4: 写 closeDecision 测试并实现**

`tests/closeDecision.test.js`：

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveCloseDecision } = require('../electron/tray/closeDecision');

describe('resolveCloseDecision', () => {
  it('allows quit when isQuitting', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'tray', isQuitting: true }),
      'allow-quit',
    );
  });

  it('hides when closeAction is tray', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'tray', isQuitting: false }),
      'hide',
    );
  });

  it('allows quit when closeAction is quit', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'quit', isQuitting: false }),
      'allow-quit',
    );
  });

  it('asks when closeAction is ask', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'ask', isQuitting: false }),
      'ask',
    );
  });

  it('asks for unknown closeAction', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'weird', isQuitting: false }),
      'ask',
    );
  });
});
```

`electron/tray/closeDecision.js`：

```js
function resolveCloseDecision({ closeAction, isQuitting }) {
  if (isQuitting) return 'allow-quit';
  if (closeAction === 'tray') return 'hide';
  if (closeAction === 'quit') return 'allow-quit';
  return 'ask';
}

module.exports = { resolveCloseDecision };
```

- [ ] **Step 5: 跑测试通过并更新 package.json test 脚本**

Run: `node --test tests/settings.test.js tests/closeDecision.test.js`  
Expected: PASS  

在 `package.json` 的 `test` 脚本中加入 `tests/closeDecision.test.js`。

- [ ] **Step 6: 暂存说明（勿自动 commit，除非用户要求）**

```
feat: add closeAction setting and close decision helper
```

---

### Task 2: Tray module + main-process close / quit wiring

**Files:**
- Create: `electron/tray/appTray.js`
- Modify: `electron/main.js`

**Interfaces:**
- Consumes: `resolveCloseDecision`；`settings.get/save`；`buv.png` 图标
- Produces:
  - `createAppTray({ onOpen, onQuit }) -> { destroy }`
  - `showMainWindow(win)`：restore + show + focus
  - main: `isQuitting` 标志；close 拦截；ask 对话框；`window-all-closed` 仅在 `isQuitting` 时 quit
  - 通知点击路径：若窗口 hidden，先 `showMainWindow`

- [ ] **Step 1: 实现 `electron/tray/appTray.js`**

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

module.exports = { createAppTray, showMainWindow, loadTrayIcon };
```

若 `nativeImage.createEmpty()` 在目标 Electron 上不能用于 Tray，改为从 `process.execPath` 取图标：`nativeImage.createFromPath(process.execPath)`，仍失败则 `console.error` 并让 `createAppTray` 返回 `null`（main 侧无托盘时 close 决策 `hide`/`ask→tray` 改为直接 quit，避免无法退出）。

- [ ] **Step 2: 在 `main.js` 引入依赖与状态**

```js
const { app, BrowserWindow, ipcMain, Menu, session, protocol, net, shell, Notification, dialog, Tray } = require('electron');
// Tray 仅在 appTray 内使用则可去掉这里的 Tray
const { resolveCloseDecision } = require('./tray/closeDecision');
const { createAppTray, showMainWindow } = require('./tray/appTray');

let mainWindow = null;
let appTray = null;
let isQuitting = false;
let closeDialogOpen = false;
```

- [ ] **Step 3: `createWindow` 绑定 close 拦截**

在 `loadFile` 之后、`closed` 之前：

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

注意：`close` 监听里用 `async` 时，`preventDefault` 必须同步调用（已满足）。

- [ ] **Step 4: 创建托盘与退出路径**

在 `app.whenReady` 中 `createWindow()` 前后：

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

改 `window-all-closed`：

```js
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  if (isQuitting) app.quit();
  // 隐藏到托盘时不 quit
});
```

`before-quit` 保持 `scheduler.stop()`；可在其中设 `isQuitting = true` 以防漏标。

- [ ] **Step 5: 通知点击时 show 隐藏窗口**

在现有 `showDesktopNotify` 的 `click` 里，把 focus 逻辑换成 `showMainWindow(mainWindow)`，再 `send('open-favorite-dynamics', …)`。

- [ ] **Step 6: 手动冒烟**

Run: `npm start`  
Expected:
1. 点 × → 询问框  
2. 选「最小化到托盘」→ 窗口消失，托盘图标在；提醒间隔到仍可检查  
3. 托盘「打开」恢复；「退出」进程结束  
4. 勾选记住 + 托盘 → 再点 × 不再询问  

- [ ] **Step 7: 暂存说明**

```
feat: wire system tray and close-window ask/hide/quit flow
```

---

### Task 3: Settings UI for closeAction

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`
- Modify: `renderer/styles.css`（若现有 `field-label` / `check-label` 已够用可极小改动）

**Interfaces:**
- Consumes: `biliApi.getSettings` / `saveSettings`（已含 `closeAction`）
- Produces: 设置页可读写 `closeAction`

- [ ] **Step 1: 在设置页增加控件**

在 `renderer/index.html`「动态提醒」区块后增加：

```html
<div class="settings-section">
  <h3 class="section-title">窗口关闭</h3>
  <label class="field-label" for="close-action">关闭窗口时</label>
  <select id="close-action">
    <option value="ask">每次询问</option>
    <option value="tray">最小化到托盘</option>
    <option value="quit">退出应用</option>
  </select>
</div>
```

- [ ] **Step 2: load/save 绑定**

在 `loadSettings`（或等价读取设置处）：

```js
$('close-action').value = s.closeAction || 'ask';
```

在 `saveSettings` payload 中增加：

```js
closeAction: $('close-action').value,
```

- [ ] **Step 3: 手动冒烟**

1. 设置改为「退出应用」并保存 → 点 × 直接退出  
2. 改回「每次询问」→ 点 × 再出现对话框  
3. `_` 最小化仍进任务栏  

- [ ] **Step 4: 跑全量测试**

Run: `npm test`  
Expected: 全部 PASS  

- [ ] **Step 5: 暂存说明**

```
feat: add close-action setting UI
```

---

## Spec coverage checklist

| Spec 要求 | Task |
|---|---|
| `closeAction` 默认 ask / 非法回退 | Task 1 |
| 点 × 询问 + 记住 | Task 2 |
| 设置页三项可改 | Task 3 |
| `_` 不进托盘 | Task 2（不拦截 minimize） |
| 托盘打开/退出 | Task 2 |
| hide 后通知可聚焦 | Task 2 |
| `window-all-closed` 托盘不退出 | Task 2 |
| 不改提醒轮询 | 无改动 watcher/scheduler 语义 |

## Placeholder scan

无 TBD / “类似 Task N” / 空测试步骤。
