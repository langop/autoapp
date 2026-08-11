# UP Dynamic Notify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 应用运行时，对勾选「提醒」的已收藏 UP 每约 15 分钟检查新动态，并通过 Windows 桌面通知提醒；点击通知打开该 UP 动态。

**Architecture:** 主进程定时器串行拉取已开启提醒的 UP 动态首页，用 `watch.json` 游标比较最新非置顶动态 id；有变化则用 Electron `Notification` 弹窗。渲染进程负责收藏卡片开关与设置项；点击通知经 IPC 通知渲染进程直达动态。

**Tech Stack:** Electron 33+、现有 `createClient` / `fetchDynamics`、Node `node:test`、本地 JSON store（`favorites.json` / `settings.json` / `watch.json`）。

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-up-dynamic-notify-design.md`
- 仅应用进程运行时检查；不做托盘/自启
- 默认间隔 15 分钟；总开关默认开；单 UP `notifyEnabled` 默认关
- 比较时忽略置顶动态（`isTop === true`）
- 首次写入游标不弹通知
- 错误本轮跳过，不弹错误通知
- 应用代码位于仓库根目录；提交仅在用户明确要求时进行（本计划中的 Commit 步骤可改为「暂存说明」，除非用户已授权提交）

## File Structure

| File | Responsibility |
|---|---|
| `electron/store/favorites.js` | 收藏读写；支持 `notifyEnabled` |
| `electron/store/settings.js` | Cookie + 通知总开关/间隔 |
| `electron/store/watch.js` | 每 UP `lastDynamicId` 游标 |
| `electron/notify/watcher.js` | 一轮检查 + 比较逻辑（可单测） |
| `electron/notify/scheduler.js` | 定时器启停 |
| `electron/main.js` | 组装 store/client、IPC、Notification、通知点击 |
| `electron/preload.js` | 暴露 `setFavoriteNotify`、`onOpenFavoriteDynamics` 等 |
| `renderer/index.html` / `app.js` / `styles.css` | 提醒开关、设置 UI、响应通知点击 |
| `tests/favorites.test.js` | `notifyEnabled` |
| `tests/settings.test.js` | 通知设置字段 |
| `tests/watch.test.js` | 游标 store |
| `tests/watcher.test.js` | 首次不弹 / id 变化弹 / 忽略置顶 |

---

### Task 1: Favorites `notifyEnabled` + Settings notify fields

**Files:**
- Modify: `electron/store/favorites.js`
- Modify: `electron/store/settings.js`
- Modify: `tests/favorites.test.js`
- Modify: `tests/settings.test.js`

**Interfaces:**
- Consumes: 现有 `createFavoritesStore` / `createSettingsStore` 模式
- Produces:
  - `favorites.add/list` 保留并读写 `notifyEnabled: boolean`（缺省 `false`）
  - `favorites.setNotify(uid, enabled) -> { ok: true }`
  - `settings.get/save` 增加 `notifyEnabled: boolean`（默认 `true`）、`notifyIntervalMin: number`（默认 `15`，clamp 5–60）

- [ ] **Step 1: 扩展 favorites 单测（先写失败用例）**

在 `tests/favorites.test.js` 增加：

```js
it('defaults notifyEnabled to false and can toggle', () => {
  const store = createFavoritesStore(tmp);
  store.add({ uid: '1', name: 'A', avatar: '', savedAt: 1 });
  assert.equal(store.list()[0].notifyEnabled, false);
  store.setNotify('1', true);
  assert.equal(store.list()[0].notifyEnabled, true);
});
```

- [ ] **Step 2: 实现 favorites 字段与 `setNotify`**

`add` 写入 `notifyEnabled: Boolean(user.notifyEnabled)`；`list` 规范化缺省 `false`；新增 `setNotify(uid, enabled)`。

- [ ] **Step 3: 扩展 settings 单测与实现**

`get/save` 返回/持久化：

```js
{
  cookie: string,
  notifyEnabled: boolean,      // default true
  notifyIntervalMin: number,   // default 15, clamp [5, 60]
}
```

注意：`save` 必须 merge 未传入字段，避免只改 cookie 时冲掉通知配置（或明确文档：设置页始终提交完整对象）。推荐 **merge 旧值**：

```js
save(partial) {
  const prev = read();
  const next = {
    cookie: typeof partial?.cookie === 'string' ? partial.cookie.trim() : prev.cookie,
    notifyEnabled:
      typeof partial?.notifyEnabled === 'boolean' ? partial.notifyEnabled : prev.notifyEnabled,
    notifyIntervalMin: clampInterval(
      partial?.notifyIntervalMin != null ? Number(partial.notifyIntervalMin) : prev.notifyIntervalMin,
    ),
  };
  write(next);
  return next;
}
```

- [ ] **Step 4: 跑测试**

Run: `npm test`  
Expected: favorites/settings 相关用例 PASS

---

### Task 2: Watch store + watcher compare logic

**Files:**
- Create: `electron/store/watch.js`
- Create: `electron/notify/watcher.js`
- Create: `tests/watch.test.js`
- Create: `tests/watcher.test.js`

**Interfaces:**
- Consumes: 动态项形状 `{ id, isTop, title, text }`
- Produces:
  - `createWatchStore(filePath)` → `{ get(uid), set(uid, lastDynamicId), remove(uid), clearMissing(uids) }`
  - `pickLatestNonPinned(items) -> item | null`
  - `diffWatchUpdate({ prevId, nextId }) -> 'init' | 'changed' | 'same' | 'skip'`
  - `buildNotifyPayload(up, item) -> { title, body, uid }`
  - `runWatchRound({ favorites, fetchDynamicsForUid, watch, onNotify })` 串行检查

- [ ] **Step 1: 写 `watch` store 测试并实现**

文件格式：

```json
{ "byUid": { "123": { "lastDynamicId": "x", "updatedAt": 1700000000000 } } }
```

- [ ] **Step 2: 写 watcher 纯函数测试**

用例：
1. `pickLatestNonPinned` 跳过 `isTop`
2. `prevId` 空 → `init`（应 set 不 notify）
3. `prevId !== nextId` → `changed`（notify + set）
4. 相同 → `same`
5. 无非置顶项 → `skip`

- [ ] **Step 3: 实现 `runWatchRound`**

伪代码：

```js
async function runWatchRound({ favorites, fetchDynamicsForUid, watch, onNotify }) {
  const targets = favorites.filter((f) => f.notifyEnabled);
  for (const up of targets) {
    try {
      const { items } = await fetchDynamicsForUid(up.uid);
      const latest = pickLatestNonPinned(items);
      if (!latest) continue;
      const prev = watch.get(up.uid)?.lastDynamicId || '';
      const kind = diffWatchUpdate({ prevId: prev, nextId: latest.id });
      if (kind === 'init' || kind === 'same') {
        if (kind === 'init') watch.set(up.uid, latest.id);
        continue;
      }
      if (kind === 'changed') {
        onNotify(buildNotifyPayload(up, latest));
        watch.set(up.uid, latest.id);
      }
    } catch {
      // skip this up
    }
  }
}
```

- [ ] **Step 4: 跑测试**

Run: `node --test tests/watch.test.js tests/watcher.test.js`  
Expected: PASS

---

### Task 3: Scheduler + main-process Notification + IPC

**Files:**
- Create: `electron/notify/scheduler.js`
- Modify: `electron/main.js`
- Modify: `electron/preload.js`

**Interfaces:**
- Consumes: Task 1–2 stores/watcher；`fetchDynamics(client, { uid, offset: '' })`
- Produces:
  - `createScheduler({ getIntervalMs, onTick, onRestart })` → `{ start(), stop(), restart() }`
  - IPC:
    - `setFavoriteNotify(uid, enabled)`
    - `getSettings` / `saveSettings` 已含新字段；`saveSettings` 后 `scheduler.restart()`
    - `removeFavorite` 时 `watch.remove(uid)`
    - 主→渲染：`open-favorite-dynamics`（payload `{ uid }`）
  - `Notification`：`new Notification({ title, body })`；`click` → show window + send IPC

- [ ] **Step 1: 实现 scheduler**

`setTimeout`/`setInterval` 均可；`restart` 先 `stop` 再 `start`。间隔 `notifyIntervalMin * 60 * 1000`。总开关关闭时 `onTick` 内直接 return。

- [ ] **Step 2: 在 `main.js` 组装**

```js
const watchPath = path.join(app.getPath('userData'), 'watch.json');
const watch = createWatchStore(watchPath);
// after createClient / favorites / settings
function showDesktopNotify(payload) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: payload.title, body: payload.body });
  n.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('open-favorite-dynamics', { uid: payload.uid });
    }
  });
}
```

从 `electron` 引入 `Notification`。

- [ ] **Step 3: IPC + preload**

```js
// preload
setFavoriteNotify: (uid, enabled) => ipcRenderer.invoke('setFavoriteNotify', { uid, enabled }),
onOpenFavoriteDynamics: (cb) => {
  const listener = (_e, payload) => cb(payload);
  ipcRenderer.on('open-favorite-dynamics', listener);
  return () => ipcRenderer.removeListener('open-favorite-dynamics', listener);
},
```

- [ ] **Step 4: `app.whenReady` 启动 scheduler**；`before-quit`/`window-all-closed` 前 `stop`

- [ ] **Step 5: 手动冒烟（可选）**  
临时把间隔改为 1 分钟验证定时器启动无报错（勿提交临时间隔）。

---

### Task 4: Renderer UI — 提醒开关、设置、通知跳转

**Files:**
- Modify: `renderer/index.html`（设置页增加总开关与间隔）
- Modify: `renderer/app.js`
- Modify: `renderer/styles.css`
- Modify: `README.md`（简短说明提醒功能）

**Interfaces:**
- Consumes: `biliApi.setFavoriteNotify`、`getSettings/saveSettings`、`onOpenFavoriteDynamics`
- Produces: 收藏卡「提醒」开关；设置页控件；通知点击 → `openFavoriteDynamics(uid)`

- [ ] **Step 1: 收藏卡片 UI**

在取消收藏旁增加提醒按钮/开关（勿冒泡到进动态）：

```html
<button class="fav-notify" type="button" data-on="0">提醒</button>
```

开启时加 `active` 样式。点击：

```js
await call(window.biliApi.setFavoriteNotify, fav.uid, next);
await refreshFavorites();
```

- [ ] **Step 2: 设置页**

增加：

```html
<label><input id="notify-enabled" type="checkbox" /> 开启动态提醒</label>
<label>检查间隔（分钟）
  <input id="notify-interval" type="number" min="5" max="60" step="1" />
</label>
```

`openSettings` / `saveSettings` 读写新字段。

- [ ] **Step 3: 通知点击**

```js
window.biliApi.onOpenFavoriteDynamics(({ uid }) => {
  if (uid) openFavoriteDynamics(uid);
});
```

- [ ] **Step 4: README 补两行使用说明**

- [ ] **Step 5: 全量测试**

Run: `npm test`  
Expected: 全部 PASS

- [ ] **Step 6: 手动验收清单**

1. 给某收藏打开「提醒」→ 不立即弹历史通知  
2. 临时缩短间隔或触发一轮检查（可在主进程加仅开发用 IPC `runWatchNow` 可选，非必须）  
3. 设置关闭总开关后不再检查  
4. 取消收藏后面板无报错、游标清除  

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-11-up-dynamic-notify.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每任务独立子代理，任务间复核  
2. **Inline Execution** — 本会话按任务连续实现  

你选哪个？
