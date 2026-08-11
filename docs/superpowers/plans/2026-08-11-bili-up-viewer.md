# Bili UP Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Electron 桌面应用：输入 B 站 UID → 查看 UP 资料并本地收藏 → 按需加载动态与评论分页。

**Architecture:** 主进程用 Node 请求 B 站公开接口并读写本地收藏；渲染进程只做 UI；通过 `preload` 白名单 IPC 通信。默认不登录，可通过环境变量 `BILI_COOKIE` 注入 Cookie。

**Tech Stack:** Electron 33+、Node.js 20+（内置 `fetch`）、原生 HTML/CSS/JS、Node 内置测试 `node:test`。

## Global Constraints

- 应用代码位于工作区根目录 `autoapp/`，不另建子项目文件夹。
- 默认不登录；Cookie 仅从 `process.env.BILI_COOKIE` 读取（可空）。
- 渲染进程禁用 Node 集成；仅经 preload 暴露 API。
- 错误统一形状：`{ code: string|number, message: string, retryable: boolean }`。
- 风控码 `-352`、`-412` 文案必须为：`公开接口受限，可稍后重试或配置 Cookie`。
- 不做监控、批量全量抓取、写操作（点赞/评论/发动态）。
- 提交前先确认用户是否要求 commit；本计划中的 commit 步骤在用户明确允许前跳过。

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | 依赖、scripts（`start` / `test`） |
| `electron/main.js` | 创建窗口、注册 IPC、加载 renderer |
| `electron/preload.js` | `contextBridge` 暴露 `window.biliApi` |
| `electron/bilibili/client.js` | HTTP、headers、Cookie、错误归一、简易串行限流 |
| `electron/bilibili/user.js` | 拉取并规范化 UP 资料 |
| `electron/bilibili/dynamics.js` | 空间动态列表 + 评论 type/oid 映射 |
| `electron/bilibili/comments.js` | 评论分页 |
| `electron/store/favorites.js` | `data/favorites.json` 读写 |
| `renderer/index.html` | 三态 UI 骨架 |
| `renderer/styles.css` | 轻量桌面工具样式 |
| `renderer/app.js` | 页面状态与调用 `biliApi` |
| `tests/favorites.test.js` | 收藏持久化单测 |
| `tests/client.test.js` | 错误映射单测 |
| `tests/dynamics.test.js` | 动态解析 / type-oid 映射单测 |
| `tests/comments.test.js` | 评论解析单测 |
| `.gitignore` | `node_modules`、`data/favorites.json`、`.env` |
| `.env.example` | 可选 `BILI_COOKIE=` 示例 |

---

### Task 1: Electron 脚手架与空窗口

**Files:**
- Create: `package.json`
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Create: `renderer/index.html`
- Create: `renderer/styles.css`
- Create: `renderer/app.js`
- Create: `.gitignore`
- Create: `.env.example`

**Interfaces:**
- Produces: `npm start` 可打开窗口；preload 暴露空 `window.biliApi` 占位对象（后续任务填充实现）

- [ ] **Step 1: 写入 `package.json`**

```json
{
  "name": "bili-up-viewer",
  "version": "0.1.0",
  "private": true,
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "test": "node --test tests/**/*.test.js"
  },
  "devDependencies": {
    "electron": "^33.2.0"
  }
}
```

- [ ] **Step 2: 写入 `.gitignore` 与 `.env.example`**

`.gitignore`:
```
node_modules/
data/favorites.json
.env
*.log
```

`.env.example`:
```
BILI_COOKIE=
```

- [ ] **Step 3: 写入最小 Electron 主进程与 preload**

`electron/main.js`:
```js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

`electron/preload.js`:
```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('biliApi', {
  getUserInfo: (uid) => ipcRenderer.invoke('getUserInfo', uid),
  listFavorites: () => ipcRenderer.invoke('listFavorites'),
  addFavorite: (user) => ipcRenderer.invoke('addFavorite', user),
  removeFavorite: (uid) => ipcRenderer.invoke('removeFavorite', uid),
  getDynamics: (payload) => ipcRenderer.invoke('getDynamics', payload),
  getComments: (payload) => ipcRenderer.invoke('getComments', payload),
});
```

- [ ] **Step 4: 写入占位 renderer**

`renderer/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'" />
    <title>Bili UP Viewer</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="app">
      <header class="top">
        <h1>Bili UP Viewer</h1>
      </header>
      <main id="view-home" class="view"></main>
      <main id="view-profile" class="view hidden"></main>
      <main id="view-dynamics" class="view hidden"></main>
    </div>
    <script src="app.js"></script>
  </body>
</html>
```

`renderer/styles.css`:
```css
:root {
  --bg: #f3f0ea;
  --ink: #1c1a17;
  --accent: #00a1d6;
  --muted: #6b6560;
  --line: #d9d2c8;
  --card: #fffdf8;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(1200px 500px at 10% -10%, #d9f1fa 0%, transparent 55%),
    linear-gradient(180deg, #f7f4ef, var(--bg));
  min-height: 100vh;
}
.top { padding: 20px 24px 8px; }
.top h1 { margin: 0; font-size: 28px; letter-spacing: 0.02em; }
.view { padding: 16px 24px 32px; }
.hidden { display: none !important; }
.row { display: flex; gap: 8px; align-items: center; }
input[type="text"] {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
}
button {
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--ink);
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
}
button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
button:disabled { opacity: 0.55; cursor: not-allowed; }
.muted { color: var(--muted); }
.err { color: #b42318; margin-top: 8px; }
.list { display: grid; gap: 10px; margin-top: 16px; }
.item {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
}
.item.active { outline: 2px solid var(--accent); }
.profile {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 16px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
}
.profile img { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; }
.split {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 16px;
  min-height: 520px;
}
@media (max-width: 900px) {
  .split { grid-template-columns: 1fr; }
}
```

`renderer/app.js`:
```js
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('view-home').textContent = '应用已启动，等待功能接入…';
});
```

- [ ] **Step 5: 安装依赖并启动验证**

Run:
```bash
npm install
npm start
```
Expected: 打开桌面窗口，标题为 `Bili UP Viewer`，首页显示占位文案。关闭窗口后进程退出。

- [ ] **Step 6: Commit（仅当用户允许）**

```bash
git add package.json package-lock.json .gitignore .env.example electron renderer
git commit -m "$(cat <<'EOF'
chore: scaffold Electron app shell for bili-up-viewer

EOF
)"
```

---

### Task 2: 本地收藏 Store

**Files:**
- Create: `electron/store/favorites.js`
- Create: `tests/favorites.test.js`
- Create: `data/.gitkeep`

**Interfaces:**
- Produces:
  - `createFavoritesStore(filePath) -> { list(), add(user), remove(uid) }`
  - `Favorite = { uid: string, name: string, avatar: string, savedAt: number }`
  - 文件损坏时返回空数组（`list` 不抛），下次 `add` 会重写文件

- [ ] **Step 1: 写失败单测**

`tests/favorites.test.js`:
```js
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFavoritesStore } = require('../electron/store/favorites');

describe('favorites store', () => {
  let dir;
  let file;
  let store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bili-fav-'));
    file = path.join(dir, 'favorites.json');
    store = createFavoritesStore(file);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adds, lists, and removes favorites', () => {
    store.add({ uid: '1', name: 'A', avatar: 'http://a', savedAt: 1 });
    store.add({ uid: '2', name: 'B', avatar: 'http://b', savedAt: 2 });
    assert.equal(store.list().length, 2);
    store.remove('1');
    assert.deepEqual(store.list().map((x) => x.uid), ['2']);
  });

  it('dedupes by uid on add', () => {
    store.add({ uid: '1', name: 'A', avatar: 'http://a', savedAt: 1 });
    store.add({ uid: '1', name: 'A2', avatar: 'http://a2', savedAt: 3 });
    const list = store.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'A2');
  });

  it('returns empty list when file is corrupt', () => {
    fs.writeFileSync(file, '{not-json', 'utf8');
    assert.deepEqual(store.list(), []);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/favorites.test.js`  
Expected: FAIL（找不到模块或 `createFavoritesStore` 未定义）

- [ ] **Step 3: 实现 store**

`electron/store/favorites.js`:
```js
const fs = require('fs');
const path = require('path');

function createFavoritesStore(filePath) {
  function ensureDir() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function read() {
    try {
      if (!fs.existsSync(filePath)) return [];
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function write(list) {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf8');
  }

  return {
    list() {
      return read();
    },
    add(user) {
      const list = read().filter((x) => String(x.uid) !== String(user.uid));
      list.unshift({
        uid: String(user.uid),
        name: user.name || '',
        avatar: user.avatar || '',
        savedAt: user.savedAt || Date.now(),
      });
      write(list);
      return { ok: true };
    },
    remove(uid) {
      write(read().filter((x) => String(x.uid) !== String(uid)));
      return { ok: true };
    },
  };
}

module.exports = { createFavoritesStore };
```

`data/.gitkeep`: 空文件。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/favorites.test.js`  
Expected: PASS（3 tests）

- [ ] **Step 5: Commit（仅当用户允许）**

```bash
git add electron/store/favorites.js tests/favorites.test.js data/.gitkeep
git commit -m "$(cat <<'EOF'
feat: add local favorites JSON store

EOF
)"
```

---

### Task 3: Bilibili HTTP Client + UP 资料

**Files:**
- Create: `electron/bilibili/client.js`
- Create: `electron/bilibili/user.js`
- Create: `tests/client.test.js`
- Create: `tests/user.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `createClient({ cookie?, delayMs? }) -> { getJson(url, params?) }`
  - `mapBiliError(code, message?) -> { code, message, retryable }`
  - `BiliRequestError` 带上述字段
  - `fetchUserInfo(client, uid) -> { uid, name, avatar, sign, fans, level }`
  - 用户接口：`GET https://api.bilibili.com/x/web-interface/card?mid={uid}`
  - headers 至少包含 `User-Agent`（桌面 Chrome）与 `Referer: https://www.bilibili.com/`；若 cookie 非空则带 `Cookie`

- [ ] **Step 1: 写 client / user 单测（mock fetch）**

`tests/client.test.js`:
```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mapBiliError } = require('../electron/bilibili/client');

describe('mapBiliError', () => {
  it('maps risk-control codes', () => {
    for (const code of [-352, -412]) {
      const err = mapBiliError(code);
      assert.equal(err.message, '公开接口受限，可稍后重试或配置 Cookie');
      assert.equal(err.retryable, true);
      assert.equal(err.code, code);
    }
  });

  it('maps not-found style codes', () => {
    const err = mapBiliError(-404, '啥都木有');
    assert.match(err.message, /不存在|木有|找不到|用户/);
    assert.equal(err.retryable, false);
  });
});
```

`tests/user.test.js`:
```js
const { describe, it, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { fetchUserInfo } = require('../electron/bilibili/user');

describe('fetchUserInfo', () => {
  afterEach(() => mock.restoreAll());

  it('normalizes card payload', async () => {
    const client = {
      async getJson() {
        return {
          code: 0,
          data: {
            card: {
              mid: '123',
              name: '测试UP',
              face: 'https://example.com/a.jpg',
              sign: 'hello',
              level_info: { current_level: 5 },
            },
            follower: 99,
          },
        };
      },
    };
    const user = await fetchUserInfo(client, '123');
    assert.deepEqual(user, {
      uid: '123',
      name: '测试UP',
      avatar: 'https://example.com/a.jpg',
      sign: 'hello',
      fans: 99,
      level: 5,
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/client.test.js tests/user.test.js`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 client 与 user**

`electron/bilibili/client.js`:
```js
class BiliRequestError extends Error {
  constructor({ code, message, retryable }) {
    super(message);
    this.name = 'BiliRequestError';
    this.code = code;
    this.retryable = retryable;
  }

  toJSON() {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

function mapBiliError(code, message) {
  const c = Number(code);
  if (c === -352 || c === -412) {
    return {
      code: c,
      message: '公开接口受限，可稍后重试或配置 Cookie',
      retryable: true,
    };
  }
  if (c === -404 || c === -400) {
    return {
      code: c,
      message: message || '用户不存在或参数无效',
      retryable: false,
    };
  }
  return {
    code: Number.isFinite(c) ? c : code,
    message: message || `请求失败(${code})`,
    retryable: true,
  };
}

function createClient({ cookie = '', delayMs = 200 } = {}) {
  let chain = Promise.resolve();

  function enqueue(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => new Promise((r) => setTimeout(r, delayMs)),
      () => new Promise((r) => setTimeout(r, delayMs)),
    );
    return run;
  }

  async function getJson(url, params = {}) {
    return enqueue(async () => {
      const u = new URL(url);
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        u.searchParams.set(k, String(v));
      }
      const headers = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com',
      };
      if (cookie) headers.Cookie = cookie;

      let res;
      try {
        res = await fetch(u, { headers });
      } catch (e) {
        throw new BiliRequestError({
          code: 'NETWORK',
          message: `网络失败：${e.message}`,
          retryable: true,
        });
      }
      if (!res.ok) {
        throw new BiliRequestError({
          code: res.status,
          message: `HTTP ${res.status}`,
          retryable: true,
        });
      }
      const body = await res.json();
      if (body.code !== 0) {
        throw new BiliRequestError(mapBiliError(body.code, body.message));
      }
      return body;
    });
  }

  return { getJson };
}

module.exports = { createClient, mapBiliError, BiliRequestError };
```

`electron/bilibili/user.js`:
```js
async function fetchUserInfo(client, uid) {
  const mid = String(uid || '').trim();
  if (!/^\d+$/.test(mid)) {
    const { BiliRequestError } = require('./client');
    throw new BiliRequestError({
      code: 'INVALID_UID',
      message: 'UID 必须是数字',
      retryable: false,
    });
  }
  const body = await client.getJson(
    'https://api.bilibili.com/x/web-interface/card',
    { mid },
  );
  const card = body.data?.card || {};
  return {
    uid: String(card.mid || mid),
    name: card.name || '',
    avatar: card.face || '',
    sign: card.sign || '',
    fans: Number(body.data?.follower || 0),
    level: Number(card.level_info?.current_level || 0),
  };
}

module.exports = { fetchUserInfo };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/client.test.js tests/user.test.js`  
Expected: PASS

- [ ] **Step 5: Commit（仅当用户允许）**

```bash
git add electron/bilibili/client.js electron/bilibili/user.js tests/client.test.js tests/user.test.js
git commit -m "$(cat <<'EOF'
feat: add bilibili HTTP client and user info fetch

EOF
)"
```

---

### Task 4: 动态列表与评论分页

**Files:**
- Create: `electron/bilibili/dynamics.js`
- Create: `electron/bilibili/comments.js`
- Create: `tests/dynamics.test.js`
- Create: `tests/comments.test.js`

**Interfaces:**
- Consumes: `client.getJson`
- Produces:
  - `fetchDynamics(client, { uid, offset? }) -> { items: DynamicItem[], nextOffset: string|null, hasMore: boolean }`
  - `mapCommentTarget(rawItem) -> { type: number, oid: string } | null`
  - `fetchComments(client, { type, oid, page }) -> { items: CommentItem[], page: number, hasMore: boolean }`
  - 动态接口：`GET https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space`，参数 `host_mid`, `offset`, `timezone_offset=-480`
  - 评论接口：`GET https://api.bilibili.com/x/v2/reply`，参数 `type`, `oid`, `pn`(=page), `ps=20`, `sort=2`

`DynamicItem` 字段：`id, type, oid, text, pics, publishTime, stat, commentSupported`  
`commentSupported === false` 时 `type/oid` 可为 `null`。

评论 type/oid 映射（实现必须覆盖）：

| 动态 `type` | comment type | oid |
|---|---|---|
| `DYNAMIC_TYPE_AV` | `1` | `major.archive.aid` |
| `DYNAMIC_TYPE_DRAW` | `11` | `major.draw.id`（若无则用动态 id_str） |
| `DYNAMIC_TYPE_WORD` | `17` | 动态 `id_str` |
| `DYNAMIC_TYPE_ARTICLE` | `12` | `major.article.id` |
| 其它 / 缺字段 | — | 返回 `null`（`commentSupported=false`） |

- [ ] **Step 1: 写解析单测**

`tests/dynamics.test.js`:
```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  mapCommentTarget,
  normalizeDynamicItem,
  normalizeDynamicsResponse,
} = require('../electron/bilibili/dynamics');

describe('mapCommentTarget', () => {
  it('maps AV', () => {
    assert.deepEqual(
      mapCommentTarget({
        id_str: '9',
        type: 'DYNAMIC_TYPE_AV',
        modules: { module_dynamic: { major: { archive: { aid: '111' } } } },
      }),
      { type: 1, oid: '111' },
    );
  });

  it('maps WORD to type 17', () => {
    assert.deepEqual(
      mapCommentTarget({ id_str: '88', type: 'DYNAMIC_TYPE_WORD', modules: {} }),
      { type: 17, oid: '88' },
    );
  });

  it('returns null for unknown', () => {
    assert.equal(mapCommentTarget({ id_str: '1', type: 'DYNAMIC_TYPE_LIVE', modules: {} }), null);
  });
});

describe('normalizeDynamicsResponse', () => {
  it('builds items and page cursor', () => {
    const out = normalizeDynamicsResponse({
      code: 0,
      data: {
        has_more: true,
        offset: 'next-1',
        items: [
          {
            id_str: '100',
            type: 'DYNAMIC_TYPE_WORD',
            modules: {
              module_dynamic: { desc: { text: '你好' } },
              module_author: { pub_ts: 1700000000 },
              module_stat: { comment: { count: 2 }, like: { count: 3 }, forward: { count: 1 } },
            },
          },
        ],
      },
    });
    assert.equal(out.hasMore, true);
    assert.equal(out.nextOffset, 'next-1');
    assert.equal(out.items[0].text, '你好');
    assert.equal(out.items[0].commentSupported, true);
    assert.equal(out.items[0].type, 17);
    assert.equal(out.items[0].oid, '100');
  });
});
```

`tests/comments.test.js`:
```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCommentsResponse } = require('../electron/bilibili/comments');

describe('normalizeCommentsResponse', () => {
  it('maps replies and hasMore', () => {
    const out = normalizeCommentsResponse(
      {
        code: 0,
        data: {
          cursor: { all_count: 21 },
          replies: [
            {
              rpid: 1,
              like: 4,
              ctime: 1700000001,
              member: { uname: 'U', avatar: 'http://a' },
              content: { message: '评论1' },
              replies: [
                {
                  rpid: 2,
                  like: 0,
                  ctime: 1700000002,
                  member: { uname: 'V', avatar: 'http://b' },
                  content: { message: '回复1' },
                },
              ],
            },
          ],
        },
      },
      1,
      20,
    );
    assert.equal(out.page, 1);
    assert.equal(out.hasMore, true);
    assert.equal(out.items[0].content, '评论1');
    assert.equal(out.items[0].replies[0].content, '回复1');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/dynamics.test.js tests/comments.test.js`  
Expected: FAIL

- [ ] **Step 3: 实现 dynamics 与 comments**

`electron/bilibili/dynamics.js`:
```js
function majorOf(item) {
  return item?.modules?.module_dynamic?.major || {};
}

function mapCommentTarget(item) {
  const id = String(item.id_str || item.id || '');
  const major = majorOf(item);
  switch (item.type) {
    case 'DYNAMIC_TYPE_AV':
      if (!major.archive?.aid) return null;
      return { type: 1, oid: String(major.archive.aid) };
    case 'DYNAMIC_TYPE_DRAW':
      return { type: 11, oid: String(major.draw?.id || id) };
    case 'DYNAMIC_TYPE_WORD':
      return id ? { type: 17, oid: id } : null;
    case 'DYNAMIC_TYPE_ARTICLE':
      if (!major.article?.id) return null;
      return { type: 12, oid: String(major.article.id) };
    default:
      return null;
  }
}

function extractText(item) {
  const dyn = item?.modules?.module_dynamic || {};
  if (dyn.desc?.text) return dyn.desc.text;
  if (dyn.major?.archive?.title) return dyn.major.archive.title;
  if (dyn.major?.article?.title) return dyn.major.article.title;
  if (dyn.major?.opus?.summary?.text) return dyn.major.opus.summary.text;
  return '';
}

function extractPics(item) {
  const draw = majorOf(item).draw;
  if (!draw?.items) return [];
  return draw.items.map((x) => x.src).filter(Boolean);
}

function normalizeDynamicItem(item) {
  const target = mapCommentTarget(item);
  const stat = item?.modules?.module_stat || {};
  return {
    id: String(item.id_str || item.id || ''),
    type: target ? target.type : null,
    oid: target ? target.oid : null,
    commentSupported: Boolean(target),
    text: extractText(item),
    pics: extractPics(item),
    publishTime: Number(item?.modules?.module_author?.pub_ts || 0),
    stat: {
      comment: Number(stat.comment?.count || 0),
      like: Number(stat.like?.count || 0),
      forward: Number(stat.forward?.count || 0),
    },
  };
}

function normalizeDynamicsResponse(body) {
  const data = body.data || {};
  const items = Array.isArray(data.items) ? data.items.map(normalizeDynamicItem) : [];
  return {
    items,
    nextOffset: data.offset ? String(data.offset) : null,
    hasMore: Boolean(data.has_more),
  };
}

async function fetchDynamics(client, { uid, offset }) {
  const body = await client.getJson(
    'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space',
    {
      host_mid: String(uid),
      offset: offset || '',
      timezone_offset: -480,
    },
  );
  return normalizeDynamicsResponse(body);
}

module.exports = {
  mapCommentTarget,
  normalizeDynamicItem,
  normalizeDynamicsResponse,
  fetchDynamics,
};
```

`electron/bilibili/comments.js`:
```js
function mapReply(r) {
  return {
    rpid: String(r.rpid),
    uname: r.member?.uname || '',
    avatar: r.member?.avatar || '',
    content: r.content?.message || '',
    like: Number(r.like || 0),
    ctime: Number(r.ctime || 0),
    replies: Array.isArray(r.replies) ? r.replies.map(mapReply) : [],
  };
}

function normalizeCommentsResponse(body, page, pageSize) {
  const data = body.data || {};
  const items = Array.isArray(data.replies) ? data.replies.map(mapReply) : [];
  const all = Number(data.cursor?.all_count ?? data.page?.count ?? 0);
  const hasMore = page * pageSize < all || Boolean(data.cursor?.is_end === false && items.length >= pageSize);
  return { items, page, hasMore: items.length === 0 ? false : hasMore };
}

async function fetchComments(client, { type, oid, page }) {
  const pn = Number(page || 1);
  const ps = 20;
  const body = await client.getJson('https://api.bilibili.com/x/v2/reply', {
    type,
    oid,
    pn,
    ps,
    sort: 2,
  });
  return normalizeCommentsResponse(body, pn, ps);
}

module.exports = { mapReply, normalizeCommentsResponse, fetchComments };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/dynamics.test.js tests/comments.test.js`  
Expected: PASS

- [ ] **Step 5: Commit（仅当用户允许）**

```bash
git add electron/bilibili/dynamics.js electron/bilibili/comments.js tests/dynamics.test.js tests/comments.test.js
git commit -m "$(cat <<'EOF'
feat: parse bilibili dynamics and comments

EOF
)"
```

---

### Task 5: 接线 IPC（main ↔ preload）

**Files:**
- Modify: `electron/main.js`
- Modify: `electron/preload.js`（若需，保持 Task 1 签名不变）

**Interfaces:**
- Consumes: `createFavoritesStore`, `createClient`, `fetchUserInfo`, `fetchDynamics`, `fetchComments`
- Produces: IPC channels  
  `getUserInfo` / `listFavorites` / `addFavorite` / `removeFavorite` / `getDynamics` / `getComments`  
  成功直接返回数据；失败返回 `{ error: { code, message, retryable } }`（不抛到渲染层未捕获）

- [ ] **Step 1: 在 main 中组装依赖并注册 handler**

将 `electron/main.js` 替换为：

```js
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
```

说明：收藏文件改用 `app.getPath('userData')`，避免打包/权限问题；设计文档中的 `data/favorites.json` 仅作开发期语义参考，实现以 userData 为准（在 README 中写明路径）。

- [ ] **Step 2: 手动烟雾测试（DevTools）**

Run: `npm start`  
在应用内打开 DevTools Console，执行：
```js
await window.biliApi.getUserInfo('2')
await window.biliApi.listFavorites()
```
Expected: `getUserInfo` 返回用户对象或 `{ error: ... }`；`listFavorites` 返回数组。

- [ ] **Step 3: Commit（仅当用户允许）**

```bash
git add electron/main.js
git commit -m "$(cat <<'EOF'
feat: wire IPC handlers for user, favorites, dynamics, comments

EOF
)"
```

---

### Task 6: 渲染层完整 UI 流程

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/styles.css`（可小幅补充）
- Modify: `renderer/app.js`

**Interfaces:**
- Consumes: `window.biliApi.*`（与 preload 一致）
- Produces: 三态页面可用：首页查询/收藏列表 → 资料卡收藏 → 动态+评论分页

- [ ] **Step 1: 更新 `renderer/index.html` 结构**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'" />
    <title>Bili UP Viewer</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="app">
      <header class="top">
        <h1>Bili UP Viewer</h1>
        <p class="muted">输入 UID → 查看资料 → 收藏 → 动态与评论</p>
      </header>

      <main id="view-home" class="view">
        <div class="row">
          <input id="uid-input" type="text" placeholder="输入 UP 主 UID，例如 2" />
          <button id="btn-search" class="primary" type="button">查询</button>
        </div>
        <p id="home-error" class="err"></p>
        <h2>已收藏</h2>
        <div id="fav-list" class="list"></div>
      </main>

      <main id="view-profile" class="view hidden">
        <button id="btn-back-home" type="button">← 返回</button>
        <div id="profile-card" class="profile" style="margin-top:12px"></div>
        <p id="profile-error" class="err"></p>
        <div class="row" style="margin-top:12px">
          <button id="btn-toggle-fav" type="button">收藏</button>
          <button id="btn-open-dynamics" class="primary" type="button">查看动态</button>
        </div>
      </main>

      <main id="view-dynamics" class="view hidden">
        <button id="btn-back-profile" type="button">← 返回资料</button>
        <div class="split" style="margin-top:12px">
          <section>
            <h2>动态</h2>
            <div id="dyn-list" class="list"></div>
            <button id="btn-more-dyn" type="button" style="margin-top:10px">加载更多动态</button>
            <p id="dyn-error" class="err"></p>
          </section>
          <section>
            <h2>评论</h2>
            <p id="cmt-hint" class="muted">选择一条动态查看评论</p>
            <div id="cmt-list" class="list"></div>
            <button id="btn-more-cmt" type="button" class="hidden" style="margin-top:10px">加载更多评论</button>
            <p id="cmt-error" class="err"></p>
          </section>
        </div>
      </main>
    </div>
    <script src="app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: 实现 `renderer/app.js` 状态机**

```js
const state = {
  view: 'home',
  user: null,
  favorites: [],
  dynamics: [],
  dynOffset: null,
  dynHasMore: false,
  selectedDyn: null,
  comments: [],
  cmtPage: 1,
  cmtHasMore: false,
};

function $(id) {
  return document.getElementById(id);
}

function showView(name) {
  state.view = name;
  for (const id of ['view-home', 'view-profile', 'view-dynamics']) {
    $(id).classList.toggle('hidden', id !== `view-${name}`);
  }
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString();
}

async function call(fn, ...args) {
  const res = await fn(...args);
  if (res && res.error) throw res.error;
  return res;
}

async function refreshFavorites() {
  state.favorites = await call(window.biliApi.listFavorites);
  const box = $('fav-list');
  box.innerHTML = '';
  if (!state.favorites.length) {
    box.innerHTML = '<p class="muted">暂无收藏</p>';
    return;
  }
  for (const fav of state.favorites) {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<strong>${fav.name}</strong> <span class="muted">UID ${fav.uid}</span>`;
    el.onclick = () => openProfile(fav.uid);
    box.appendChild(el);
  }
}

function renderProfile() {
  const u = state.user;
  $('profile-card').innerHTML = `
    <img src="${u.avatar}" alt="" />
    <div>
      <h2 style="margin:0 0 6px">${u.name}</h2>
      <div class="muted">UID ${u.uid} · Lv.${u.level} · 粉丝 ${u.fans}</div>
      <p>${u.sign || '（无签名）'}</p>
    </div>
  `;
  const saved = state.favorites.some((x) => String(x.uid) === String(u.uid));
  $('btn-toggle-fav').textContent = saved ? '取消收藏' : '收藏';
}

async function openProfile(uid) {
  $('home-error').textContent = '';
  $('profile-error').textContent = '';
  try {
    state.user = await call(window.biliApi.getUserInfo, String(uid).trim());
    await refreshFavorites();
    renderProfile();
    showView('profile');
  } catch (e) {
    if (state.view === 'home') $('home-error').textContent = e.message;
    else $('profile-error').textContent = e.message;
  }
}

function renderDynamics() {
  const box = $('dyn-list');
  box.innerHTML = '';
  if (!state.dynamics.length) {
    box.innerHTML = '<p class="muted">暂无动态</p>';
  }
  for (const d of state.dynamics) {
    const el = document.createElement('div');
    el.className = 'item' + (state.selectedDyn?.id === d.id ? ' active' : '');
    el.innerHTML = `
      <div>${d.text || '（无文本）'}</div>
      <div class="muted">${fmtTime(d.publishTime)} · 评论 ${d.stat.comment} · 点赞 ${d.stat.like}</div>
    `;
    el.onclick = () => selectDynamic(d);
    box.appendChild(el);
  }
  $('btn-more-dyn').disabled = !state.dynHasMore;
}

function renderComments() {
  const box = $('cmt-list');
  box.innerHTML = '';
  for (const c of state.comments) {
    const el = document.createElement('div');
    el.className = 'item';
    const subs = (c.replies || [])
      .map((r) => `<div class="muted" style="margin-left:12px">└ ${r.uname}: ${r.content}</div>`)
      .join('');
    el.innerHTML = `<strong>${c.uname}</strong> · 赞 ${c.like}<div>${c.content}</div>${subs}`;
    box.appendChild(el);
  }
  $('btn-more-cmt').classList.toggle('hidden', !state.cmtHasMore);
}

async function loadDynamics(reset) {
  $('dyn-error').textContent = '';
  try {
    if (reset) {
      state.dynamics = [];
      state.dynOffset = null;
      state.selectedDyn = null;
      state.comments = [];
      state.cmtHasMore = false;
      $('cmt-hint').textContent = '选择一条动态查看评论';
    }
    const res = await call(window.biliApi.getDynamics, {
      uid: state.user.uid,
      offset: reset ? '' : state.dynOffset || '',
    });
    state.dynamics = reset ? res.items : state.dynamics.concat(res.items);
    state.dynOffset = res.nextOffset;
    state.dynHasMore = res.hasMore;
    renderDynamics();
    renderComments();
  } catch (e) {
    $('dyn-error').textContent = e.message;
  }
}

async function selectDynamic(d) {
  state.selectedDyn = d;
  renderDynamics();
  $('cmt-error').textContent = '';
  state.comments = [];
  state.cmtPage = 1;
  state.cmtHasMore = false;
  if (!d.commentSupported) {
    $('cmt-hint').textContent = '暂不支持评论加载';
    renderComments();
    return;
  }
  $('cmt-hint').textContent = `动态 ${d.id} 的评论`;
  await loadComments(true);
}

async function loadComments(reset) {
  const d = state.selectedDyn;
  if (!d?.commentSupported) return;
  try {
    const page = reset ? 1 : state.cmtPage + 1;
    const res = await call(window.biliApi.getComments, {
      type: d.type,
      oid: d.oid,
      page,
    });
    state.cmtPage = res.page;
    state.cmtHasMore = res.hasMore;
    state.comments = reset ? res.items : state.comments.concat(res.items);
    if (!state.comments.length) $('cmt-hint').textContent = '暂无评论';
    renderComments();
  } catch (e) {
    $('cmt-error').textContent = e.message;
  }
}

function bind() {
  $('btn-search').onclick = () => openProfile($('uid-input').value);
  $('uid-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openProfile($('uid-input').value);
  });
  $('btn-back-home').onclick = async () => {
    await refreshFavorites();
    showView('home');
  };
  $('btn-back-profile').onclick = () => showView('profile');
  $('btn-toggle-fav').onclick = async () => {
    const u = state.user;
    const saved = state.favorites.some((x) => String(x.uid) === String(u.uid));
    if (saved) await call(window.biliApi.removeFavorite, u.uid);
    else
      await call(window.biliApi.addFavorite, {
        uid: u.uid,
        name: u.name,
        avatar: u.avatar,
        savedAt: Date.now(),
      });
    await refreshFavorites();
    renderProfile();
  };
  $('btn-open-dynamics').onclick = async () => {
    showView('dynamics');
    await loadDynamics(true);
  };
  $('btn-more-dyn').onclick = () => loadDynamics(false);
  $('btn-more-cmt').onclick = () => loadComments(false);
}

document.addEventListener('DOMContentLoaded', async () => {
  bind();
  await refreshFavorites();
  showView('home');
});
```

- [ ] **Step 3: 手工验收主路径**

Run: `npm start`

验收清单：
1. 输入 UID `2` → 看到资料卡（昵称等）。
2. 点收藏 → 回首页可见收藏项；点收藏项可再次进入。
3. 查看动态 → 列表出现；点一条 → 评论区加载。
4. 动态/评论「加载更多」在有更多时可用。
5. 非法 UID（如 `abc`）→ 中文错误提示。
6. 若出现风控文案，与 Global Constraints 完全一致。

- [ ] **Step 4: 跑全量单测**

Run: `npm test`  
Expected: 全部 PASS

- [ ] **Step 5: Commit（仅当用户允许）**

```bash
git add renderer
git commit -m "$(cat <<'EOF'
feat: add desktop UI for profile, favorites, dynamics, comments

EOF
)"
```

---

### Task 7: README 与实现说明回写

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-08-11-bili-up-viewer-design.md`（状态改为已规划/实现中；注明 favorites 实际路径为 Electron `userData`）

**Interfaces:**
- Produces: 可复现的启动说明

- [ ] **Step 1: 写 README**

```markdown
# Bili UP Viewer

Electron 桌面工具：查询 B 站 UP 主资料、本地收藏，并按需加载动态与评论。

## 要求

- Node.js 20+
- Windows / macOS / Linux

## 使用

```bash
npm install
npm start
```

可选：在环境中设置 Cookie（公开接口被风控时）

```bash
# PowerShell
$env:BILI_COOKIE="SESSDATA=...; bili_jct=..."
npm start
```

## 测试

```bash
npm test
```

## 说明

- 收藏保存在 Electron `userData/favorites.json`（不是仓库内 `data/`）。
- 默认不登录；仅读取公开接口。
```

- [ ] **Step 2: 更新设计文档状态行**

将设计文档头部 `**状态：** 待实现` 改为 `**状态：** 实现计划已就绪（见 docs/superpowers/plans/2026-08-11-bili-up-viewer.md）`，并在「Store」处补一句：实现使用 `app.getPath('userData')/favorites.json`。

- [ ] **Step 3: Commit（仅当用户允许）**

```bash
git add README.md docs/superpowers/specs/2026-08-11-bili-up-viewer-design.md
git commit -m "$(cat <<'EOF'
docs: add README and sync favorites path note

EOF
)"
```

---

## Spec Coverage Self-Review

| Spec 要求 | Task |
|---|---|
| Electron 桌面 + 主进程请求 | 1, 3, 5 |
| 输入 UID → 先看资料 | 3, 6 |
| 本地收藏 / 取消 / 列表进入 | 2, 5, 6 |
| 按需动态 + 评论分页 | 4, 5, 6 |
| 不登录 + Cookie 预留 | 3, 5, 7 |
| 风控文案 | 3 |
| 不支持评论的动态提示 | 4, 6 |
| 错误可重试提示 | 3, 5, 6 |
| 单测 + 手工验收 | 2–6 |

**占位符扫描：** 无 TBD/TODO；关键步骤含完整代码与命令。  
**类型一致性：** `Favorite` / `DynamicItem` / `CommentItem` / IPC 名与设计文档及各 Task Interfaces 对齐；收藏落盘路径在 Task 5/7 明确为 `userData`。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-11-bili-up-viewer.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 Task 派生子代理，任务间复核，迭代更快  

**2. Inline Execution** — 本会话按 executing-plans 连续执行，设检查点  

Which approach?
