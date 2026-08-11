# Bilibili UP 动态与评论桌面查看器 — 设计文档

**日期：** 2026-08-11  
**状态：** 已实现（见 docs/superpowers/plans/2026-08-11-bili-up-viewer.md）  
**技术选型：** Electron + Node.js（主进程）+ 原生 JS（渲染进程）

## 目标

做一个本地桌面应用：输入 B 站 UP 主 UID，先查看资料并可选本地收藏，再按需加载该 UP 的动态列表与某条动态的评论（分页）。

非目标：不做成浏览器网页、不做定时监控、不批量全量抓取、不登录发帖/点赞等写操作。

## 约束与决策

| 项 | 决策 |
|---|---|
| 形态 | Electron 桌面窗口 |
| 请求位置 | 主进程直连 B 站，渲染进程经 IPC |
| 登录 | 默认不登录（公开接口）；预留 Cookie 配置位，受限时再启用 |
| 加载方式 | 按需：资料 → 动态列表 → 点开评论分页 |
| 收藏 | 仅本机 JSON，不绑定 B 站账号 |

## 架构

```
Renderer (UI)
    │ ipc via preload
Main (Node)
    ├── bilibili client (user / dynamics / comments)
    └── local favorites store
    │ HTTPS
Bilibili public APIs
```

- **Renderer**：输入、列表、详情、收藏交互；不直接访问 B 站。
- **Preload**：暴露白名单 API，关闭 Node 集成给页面。
- **Main**：封装请求头（UA、Referer）、超时、重试、错误归一；可选读取 Cookie。
- **Store**：`data/favorites.json` 持久化收藏的 UP（实现使用 `app.getPath('userData')/favorites.json`）。

## 用户流程

1. 首页输入 UID → 查询 → 展示 UP 资料卡（昵称、头像、粉丝、签名、等级）。
2. 用户可「收藏 / 取消收藏」；首页展示已收藏列表，可一键再次进入。
3. 资料卡点「查看动态」→ 动态列表（支持加载更多）。
4. 点某条动态 → 加载评论第一页；「加载更多」拉下一页。

## 目录结构

```
bili-up-viewer/
  package.json
  electron/
    main.js
    preload.js
    bilibili/
      client.js      # fetch 封装、headers、可选 cookie
      user.js
      dynamics.js
      comments.js
    store/
      favorites.js
  renderer/
    index.html
    styles.css
    app.js
  data/
    favorites.json   # 运行时生成
  docs/superpowers/specs/
    2026-08-11-bili-up-viewer-design.md
```

应用代码放在工作区根目录 `autoapp/`（与本设计文档同仓），不另建子项目文件夹。

## IPC API

| 通道 / 方法 | 入参 | 出参（概念） |
|---|---|---|
| `getUserInfo` | `uid: string` | `{ uid, name, avatar, sign, fans, level }` |
| `listFavorites` | — | `Favorite[]`（含 uid、name、avatar 等缓存展示字段） |
| `addFavorite` | `user: Favorite` | `{ ok: true }` |
| `removeFavorite` | `uid: string` | `{ ok: true }` |
| `getDynamics` | `{ uid, offset? }` | `{ items: DynamicItem[], nextOffset?, hasMore }` |
| `getComments` | `{ type, oid, page }` | `{ items: CommentItem[], page, hasMore }` |

错误统一为可序列化对象：`{ code, message, retryable }`，前端据此提示。

## 数据模型

### Favorite
- `uid`, `name`, `avatar`, `savedAt`

### DynamicItem
- `id`（动态 id）
- `type`, `oid`（评论接口所需）
- `text`, `pics[]`, `publishTime`
- `stat`（可选：转发/评论/点赞）

### CommentItem
- `rpid`, `uname`, `avatar`, `content`, `like`, `ctime`
- `replies[]`（一级下少量子评，简单展示即可）

## B 站接口策略（实现阶段细化）

- 用户信息：空间/账号信息类公开接口（以实现时可用接口为准）。
- 动态：UP 空间动态列表，用 `offset`/`hasMore` 续拉。
- 评论：按动态类型解析出评论区 `type` + `oid`，再分页拉取。
- Headers：合理 UA 与 `Referer: https://www.bilibili.com/`。
- Cookie：环境变量或本地配置文件读取；默认空。
- 限流：主进程串行关键请求，必要时短延迟；避免并发轰炸。

风控码（如 `-352`、`-412`）映射为明确中文提示：「公开接口受限，可稍后重试或配置 Cookie」。

## UI

单窗口三态，轻量工具风格（非仪表盘）：

1. **首页**：UID 输入 + 查询；已收藏列表。
2. **资料卡**：信息展示 + 收藏切换 + 进入动态。
3. **动态页**：动态列表（加载更多）+ 选中项评论区（分页）。

空状态、加载中、错误可重试均有对应文案。

## 错误与边界

- 网络超时/失败：可重试。
- UID 无效或用户不存在：资料卡空/错误态。
- 无动态 / 无评论：空列表文案。
- 动态类型无法映射评论区：该条提示「暂不支持评论加载」，不阻断其它条目。
- 收藏文件损坏：重建为空列表并提示。

## 测试要点（实现后自测）

- 合法 UID：资料 → 收藏 → 动态 → 评论分页。
- 非法 UID / 网络断开：错误提示正确。
- 收藏持久化：重启应用后列表仍在。
- 不配置 Cookie 下主路径是否可用；若不可用，提示路径清晰。

## 后续可选（不做进首版）

- Cookie 图形化配置页
- 监控新动态
- 导出 JSON/CSV
- 子评论完整楼中楼展开
