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

### 设置 Cookie（推荐）

应用内：首页「已收藏」右侧 **设置**，粘贴浏览器 Cookie，保存后立即生效。

### 动态提醒

收藏卡片上的 **提醒** 开关可为单个 UP 开启桌面通知；设置页可配置总开关与检查间隔（默认约 15 分钟）。仅在应用运行期间轮询检查，退出后不再提醒。

也可通过环境变量（设置页为空时作为回退）：

```powershell
$env:BILI_COOKIE="SESSDATA=...; bili_jct=..."
npm start
```

## 测试

```bash
npm test
```

## 说明

- 收藏：`userData/favorites.json`
- 设置（含 Cookie）：`userData/settings.json`
- 默认不登录；公开接口受限时配置 Cookie。
