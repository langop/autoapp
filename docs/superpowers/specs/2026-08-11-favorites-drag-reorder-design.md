# 收藏列表拖拽排序 — 设计文档

**日期：** 2026-08-11  
**状态：** 待实现  
**关联：** Bili UP Viewer（Electron）

## 目标

用户可在收藏列表中用鼠标拖拽整卡调整顺序；新顺序持久化到本地，重启后保持。

## 非目标

- 独立拖拽手柄
- 触控手势库 / 第三方排序库
- 跨窗口拖拽
- 复杂排序动画

## 已确认决策

| 项 | 决策 |
|---|---|
| 拖拽方式 | 整卡可拖（HTML5 drag and drop） |
| 点击进动态 | 短点进动态；位移超过约 6–8px 才算拖拽 |
| 新收藏位置 | 仍插入列表最前（`unshift`） |
| 顺序存储 | `favorites.json` 数组顺序，不新增字段 |
| 按钮 | 「提醒」「取消收藏」不启动拖拽 |

## 数据与主进程

### 顺序语义

`favorites.json` 顶层数组顺序即展示顺序。

### Store API

在现有 `createFavoritesStore` 上新增：

- `reorder(uids: string[]) -> { ok: true }`
  - 按 `uids` 顺序重排现有项
  - 忽略未知 uid
  - 未出现在 `uids` 中的已有项按原相对顺序追加到末尾（防止误传导致丢收藏）
  - 写回文件

`add` / `remove` / `setNotify` / `list` 行为不变；`add` 继续 `unshift`。

### IPC

- `reorderFavorites(uids: string[])`（main + preload）
- 渲染进程拖拽结束成功后调用，再刷新列表

提醒轮询仍 `favorites.list()`，与展示顺序无关。

## 界面与交互

1. 收藏卡设置 `draggable="true"`（或等效）
2. 「提醒」「取消收藏」继续 `stopPropagation`，且不触发卡片拖拽
3. 指针按下后记录起点；若移动距离未超过阈值，`click` 仍打开该 UP 动态
4. 拖到其他卡片上时用轻量指示（如目标卡边框高亮）
5. `drop` 后按 DOM/逻辑新顺序收集 uid，调用 `reorderFavorites`，再 `refreshFavorites`
6. 拖拽中卡片半透明即可

## 错误与边界

- `reorder` 失败：显示错误文案，并重新 `listFavorites`，避免界面与磁盘不一致
- 仅 0–1 条收藏时无需特殊 UI，拖拽无效果即可
- 拖到列表空白处：不改变顺序（或视为无效 drop）

## 测试要点

- `reorder` 按 uid 重排并持久化
- 忽略未知 uid
- 缺漏 uid 时不丢失收藏（剩余项追加）
- 现有 add/remove/notify 单测仍通过

## 验收

1. 拖动收藏卡可改变顺序，刷新/重启后顺序保持  
2. 短点卡片仍进入动态；点「提醒」「取消收藏」行为不变  
3. 新收藏仍出现在列表最前  
