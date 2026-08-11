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

可选：在环境中设置 Cookie（公开接口被风控时，例如动态返回 412）

```bash
# PowerShell
$env:BILI_COOKIE="SESSDATA=...; bili_jct=..."
npm start
```

若动态加载遇到风控或 412，请设置 `BILI_COOKIE` 后重试。

## 测试

```bash
npm test
```

## 说明

- 收藏保存在 Electron `userData/favorites.json`（不是仓库内 `data/`）。
- 默认不登录；仅读取公开接口。
