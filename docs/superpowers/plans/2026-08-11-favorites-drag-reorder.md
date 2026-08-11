# Favorites Drag Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收藏列表支持鼠标整卡拖拽排序，顺序写入 `favorites.json` 并在重启后保持；短点仍进动态。

**Architecture:** `favorites.json` 数组顺序即展示顺序。Store 新增 `reorder(uids)`；主进程 IPC `reorderFavorites`；渲染进程用 HTML5 DnD 重排 DOM 后提交 uid 列表。用指针位移阈值区分点击与拖拽。

**Tech Stack:** Electron 33+、现有 favorites JSON store、Node `node:test`、原生 HTML5 Drag and Drop（无新依赖）。

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-favorites-drag-reorder-design.md`
- 整卡可拖；「提醒」「取消收藏」不启动拖拽
- 短点进动态；位移阈值约 6–8px
- 新收藏仍 `unshift` 到最前
- `reorder`：按传入 uid 重排；忽略未知 uid；未出现在 `uids` 中的已有项按原相对顺序追加到末尾
- 失败时提示错误并 `listFavorites` 回刷
- 应用代码位于仓库根目录；**提交仅在用户明确要求时进行**（本计划 Commit 步骤改为「完成说明」，除非用户已授权提交）

## File Structure

| File | Responsibility |
|---|---|
| `electron/store/favorites.js` | 新增 `reorder(uids)` |
| `tests/favorites.test.js` | reorder 单测 |
| `electron/main.js` | IPC `reorderFavorites` |
| `electron/preload.js` | 暴露 `reorderFavorites` |
| `renderer/app.js` | 卡片 DnD、点击阈值、调用 reorder |
| `renderer/styles.css` | 拖拽中 / drop 目标样式 |

---

### Task 1: Favorites `reorder` + IPC

**Files:**
- Modify: `electron/store/favorites.js`
- Modify: `tests/favorites.test.js`
- Modify: `electron/main.js`
- Modify: `electron/preload.js`

**Interfaces:**
- Consumes: 现有 `createFavoritesStore`（`list` / `add` / `remove` / `setNotify` / `write`/`read` 内部模式）
- Produces:
  - `favorites.reorder(uids: string[]) -> { ok: true }`
  - IPC / preload: `reorderFavorites(uids: string[])`

- [ ] **Step 1: 扩展 favorites 单测（先写失败用例）**

在 `tests/favorites.test.js` 增加：

```js
it('reorders by uid list and persists', () => {
  store.add({ uid: '1', name: 'A', avatar: '', savedAt: 1 });
  store.add({ uid: '2', name: 'B', avatar: '', savedAt: 2 });
  store.add({ uid: '3', name: 'C', avatar: '', savedAt: 3 });
  // add unshifts → current order [3,2,1]
  store.reorder(['1', '3', '2']);
  assert.deepEqual(store.list().map((x) => x.uid), ['1', '3', '2']);
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(disk.map((x) => x.uid), ['1', '3', '2']);
});

it('ignores unknown uids and appends missing ones in original relative order', () => {
  store.add({ uid: '1', name: 'A', avatar: '', savedAt: 1 });
  store.add({ uid: '2', name: 'B', avatar: '', savedAt: 2 });
  store.add({ uid: '3', name: 'C', avatar: '', savedAt: 3 });
  // current [3,2,1]; request only 2 then unknown 9; missing 3 then 1 append
  store.reorder(['2', '9']);
  assert.deepEqual(store.list().map((x) => x.uid), ['2', '3', '1']);
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `node --test tests/favorites.test.js`

Expected: FAIL（`reorder` 未定义）

- [ ] **Step 3: 实现 `reorder`**

在 `electron/store/favorites.js` 的返回对象中增加：

```js
reorder(uids) {
  const list = read();
  const byUid = new Map(list.map((item) => [String(item.uid), item]));
  const seen = new Set();
  const next = [];
  for (const raw of uids || []) {
    const id = String(raw);
    if (seen.has(id)) continue;
    const item = byUid.get(id);
    if (!item) continue;
    next.push(item);
    seen.add(id);
  }
  for (const item of list) {
    const id = String(item.uid);
    if (seen.has(id)) continue;
    next.push(item);
    seen.add(id);
  }
  write(next);
  return { ok: true };
},
```

- [ ] **Step 4: 跑测确认通过**

Run: `node --test tests/favorites.test.js`

Expected: PASS（含原有 notify 用例）

- [ ] **Step 5: 接线 IPC + preload**

`electron/main.js`（与其它 favorites handler 并列）：

```js
ipcMain.handle(
  'reorderFavorites',
  wrap(async (_e, uids) => favorites.reorder(uids)),
);
```

`electron/preload.js`：

```js
reorderFavorites: (uids) => ipcRenderer.invoke('reorderFavorites', uids),
```

- [ ] **Step 6: 完成说明（勿擅自 commit）**

说明：`reorder` + 单测 + IPC/preload 已就绪。除非用户明确要求，否则不 `git commit`。

---

### Task 2: Renderer HTML5 拖拽排序

**Files:**
- Modify: `renderer/app.js`（`refreshFavorites` 及拖拽辅助）
- Modify: `renderer/styles.css`

**Interfaces:**
- Consumes: `window.biliApi.reorderFavorites(uids)`、现有 `refreshFavorites` / `openFavoriteDynamics` / `call`
- Produces: 整卡可拖排序；短点进动态；失败回刷

- [ ] **Step 1: 增加拖拽相关 CSS**

在 `renderer/styles.css` 的 `.fav-card` 样式附近追加：

```css
.fav-card.dragging {
  opacity: 0.55;
}
.fav-card.drag-over {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}
#fav-list.reordering {
  user-select: none;
}
```

- [ ] **Step 2: 在 `refreshFavorites` 中实现 DnD + 点击阈值**

在 `renderer/app.js` 顶部（或 `refreshFavorites` 旁）增加常量与辅助函数：

```js
const FAV_DRAG_THRESHOLD_PX = 8;

function clearFavDragStyles(root) {
  root.querySelectorAll('.fav-card.dragging, .fav-card.drag-over').forEach((el) => {
    el.classList.remove('dragging', 'drag-over');
  });
}

async function persistFavoriteOrder(box) {
  const uids = [...box.querySelectorAll('.fav-card')].map((el) => el.dataset.uid);
  try {
    await call(window.biliApi.reorderFavorites, uids);
    await refreshFavorites();
  } catch (e) {
    $('home-error').textContent = e.message || '排序保存失败';
    await refreshFavorites();
  }
}
```

改写 `refreshFavorites` 卡片创建逻辑要点（保持现有 markup / notify / unfav 行为）：

```js
el.dataset.uid = String(fav.uid);
el.draggable = true;

let pointerDown = null;
let suppressClick = false;

el.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.fav-actions')) return;
  pointerDown = { x: e.clientX, y: e.clientY };
  suppressClick = false;
});

el.addEventListener('dragstart', (e) => {
  if (e.target.closest?.('.fav-actions')) {
    e.preventDefault();
    return;
  }
  if (pointerDown) {
    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    // dragstart 坐标在部分环境不可靠；以「已进入 dragstart」为准，click 侧用 suppress
  }
  suppressClick = true;
  el.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(fav.uid));
  box.classList.add('reordering');
});

el.addEventListener('dragend', () => {
  clearFavDragStyles(box);
  box.classList.remove('reordering');
  pointerDown = null;
});

el.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const over = e.currentTarget;
  if (over.classList.contains('dragging')) return;
  box.querySelectorAll('.fav-card.drag-over').forEach((n) => {
    if (n !== over) n.classList.remove('drag-over');
  });
  over.classList.add('drag-over');
  const dragging = box.querySelector('.fav-card.dragging');
  if (!dragging || dragging === over) return;
  const cards = [...box.querySelectorAll('.fav-card')];
  const from = cards.indexOf(dragging);
  const to = cards.indexOf(over);
  if (from < 0 || to < 0 || from === to) return;
  if (from < to) over.after(dragging);
  else over.before(dragging);
});

el.addEventListener('dragleave', (e) => {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
});

el.addEventListener('drop', async (e) => {
  e.preventDefault();
  clearFavDragStyles(box);
  box.classList.remove('reordering');
  await persistFavoriteOrder(box);
});

el.onclick = (e) => {
  if (e.target.closest('.fav-actions')) return;
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (pointerDown) {
    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    if (Math.hypot(dx, dy) >= FAV_DRAG_THRESHOLD_PX) return;
  }
  openFavoriteDynamics(fav.uid);
};
```

对 `notifyBtn` / `unfavBtn`：在现有 `stopPropagation` 外，`mousedown`/`pointerdown` 上 `e.preventDefault()` 可选，用于减少从按钮拖出；至少保持点击不冒泡。

**注意：** `dragover` 中实时移动 DOM 时，`drop` 只需持久化当前顺序；若某环境 `drop` 未触发，可在 `dragend` 中比较顺序是否变化再 `persistFavoriteOrder`（推荐同时做）：

```js
el.addEventListener('dragend', async () => {
  const uids = [...box.querySelectorAll('.fav-card')].map((n) => n.dataset.uid);
  const before = state.favorites.map((f) => String(f.uid));
  clearFavDragStyles(box);
  box.classList.remove('reordering');
  pointerDown = null;
  if (uids.join(',') !== before.join(',')) {
    await persistFavoriteOrder(box);
  }
});
```

若采用 `dragend` 持久化，则 `drop` 里只 `preventDefault` + 清样式，避免双重保存；二选一即可，**优先 `dragend` 比较后保存**（Windows 上更稳）。

- [ ] **Step 3: 手动验收清单**

1. 拖动卡片改变顺序 → 刷新列表后顺序保持  
2. 重启应用后顺序保持  
3. 短点卡片进动态；拖拽松手不进动态  
4. 「提醒」「取消收藏」仍可用，不启动拖拽  
5. 新收藏仍在最前  

- [ ] **Step 4: 跑全量相关测试**

Run: `npm test`

Expected: 全部 PASS

- [ ] **Step 5: 完成说明（勿擅自 commit）**

说明：渲染拖拽已接好。除非用户明确要求，否则不 `git commit`。可按用户要求重启 Electron。

---

## Spec coverage (self-review)

| Spec 要求 | Task |
|---|---|
| `reorder(uids)` + 忽略未知 + 缺漏追加 | Task 1 |
| IPC `reorderFavorites` | Task 1 |
| 整卡 HTML5 DnD | Task 2 |
| 短点进动态 / 位移阈值 | Task 2 |
| 按钮不拖拽 | Task 2 |
| 失败回刷 | Task 2 `persistFavoriteOrder` |
| 新收藏仍最前 | 无需改 `add`（已有行为） |
| 轻量拖拽样式 | Task 2 CSS |
| 单测 reorder | Task 1 |
