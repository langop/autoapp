# 应用图标 + 开发/生产打包 — 设计文档

**日期：** 2026-08-12  
**状态：** 已确认  
**关联：** Bili UP Viewer（Electron）；Windows 桌面通知 AUMID / 托盘图标

## 目标

1. 全应用统一使用仓库根目录 `icon.png` 作为品牌图标（窗口、任务栏、托盘、安装包/快捷方式）。
2. 用 **electron-builder** 区分开发与生产：开发 `npm start`；生产打出 Windows **NSIS** 安装包。
3. 打包后应用显示名为 **Bili UP Viewer**，`appId` 为 `com.bili.up.viewer`。
4. **生产安装包与首次运行只带初始化配置**，不携带、不共用开发环境的 Cookie / 收藏 / 游标等用户数据。

## 非目标

- macOS / Linux 打包
- 自动更新（electron-updater）
- 代码签名 / 公证
- 改动动态提醒业务逻辑（仅适配打包路径、图标与 userData 隔离）
- 把开发机上的真实 Cookie 或收藏「预置」进安装包

## 已确认决策

| 项 | 决策 |
|---|---|
| 打包工具 | electron-builder |
| 安装形态 | Windows NSIS 安装包 |
| 产品名 | Bili UP Viewer |
| 图标源 | 根目录 `icon.png` |
| 开发入口 | `npm start` → `electron .` |
| 生产构建 | `npm run dist` → `dist/` 下 NSIS |
| 用户数据 | 开发 / 生产 **隔离**；生产首次运行为空默认配置 |

## 图标

### 源与衍生

| 文件 | 用途 |
|---|---|
| `icon.png`（仓库根） | 源文件；开发态窗口 / 托盘优先加载 |
| `build/icon.ico` | Windows 打包与原生窗口图标（由 `icon.png` 生成） |

- 增加脚本或 `predist` / 文档步骤：从 `icon.png` 生成 `build/icon.ico`（可用 `png-to-ico` 或等价工具）。
- `build/icon.ico` 可提交到仓库（避免无 Node 图像工具时构建失败），或构建时生成；**推荐构建时生成并 gitignore `build/*.ico`，同时提供 `npm run icons` 本地生成**——若团队更想零依赖开箱即用，则提交生成好的 `build/icon.ico`。本设计采用：**提交 `build/icon.ico`（由脚本生成一次）+ `npm run icons` 可再生成**，避免 CI/同事缺依赖。

### 运行时使用

- `BrowserWindow` 构造传入 `icon: resolveAppIcon()`。
- 托盘 `loadTrayIcon()` 与窗口共用同一解析函数（优先 `icon.png`；打包后可用 `process.resourcesPath` / 应用目录下 builder 嵌入的图标）。
- 解析规则（示意）：
  - 开发：`path.join(appRoot, 'icon.png')`
  - 生产：优先应用资源内图标；失败再回退 `icon.png` 旁路或 `execPath`

## 开发 / 生产环境

| | 开发 | 生产（已安装） |
|---|---|---|
| 启动 | `npm start` | 安装后的 `Bili UP Viewer.exe` |
| `app.isPackaged` | `false` | `true` |
| AUMID | 现有逻辑：`process.defaultApp` 时用 `execPath` + 自建 Start Menu 快捷方式 | `com.bili.up.viewer`（与 builder `appId` 一致；NSIS 写入开始菜单） |
| 通知快捷方式 | 继续 `ensureWindowsNotifyShortcut`（仅开发需要） | 安装程序快捷方式即可；packaged 下跳过自建快捷方式 |
| 用户数据目录 | `%APPDATA%/bili-up-viewer-dev` | `%APPDATA%/Bili UP Viewer` |
| 首次配置 | 开发目录自用（可含 Cookie/收藏） | **仅 store 默认值**：空 Cookie、空收藏、空 watch、`notifyEnabled: true`、`closeAction: 'ask'` 等 |

统一用 `app.isPackaged`（或现有 `process.defaultApp`）分支，避免魔法环境变量。`NODE_ENV` 不作为运行时行为开关。

### 用户数据隔离（关键）

当前开发与未打包运行都写 `%APPDATA%/bili-up-viewer`。若安装版沿用同一目录，会直接带上开发 Cookie/收藏，不符合「生产用初始化配置」。

**策略（在 `app.ready` 之前调用 `app.setPath`）：**

1. **开发**（`!app.isPackaged`）：`userData` → `…/bili-up-viewer-dev`  
   - 可选一次性迁移：若旧目录 `bili-up-viewer` 存在且 `-dev` 不存在，复制到 `-dev`（保留本机开发数据）；不把旧目录打进安装包。
2. **生产**（`app.isPackaged`）：`userData` → `…/Bili UP Viewer`（与 productName 对齐）  
   - 与开发目录分离；首次安装无 `settings.json` / `favorites.json` / `watch.json`，store 按默认初始化。
3. **安装包内容**：`files` 白名单仅代码与 `icon.png`；**禁止**打包  
   - `settings.json` / `favorites.json` / `watch.json`  
   - `.env`、`.env.*`  
   - `data/`、仓库内任何用户数据副本  
   - `dist/`、`.superpowers/`  
4. 生产运行时**不要**默认读取 `process.env.BILI_COOKIE` 作为隐式预填（可选：仅开发 `!isPackaged` 时保留 env 回退，避免安装版从构建机环境变量带入 Cookie）。

## electron-builder 配置

放在 `package.json` 的 `"build"` 字段（或 `electron-builder.yml`；本设计用 `package.json` 集中）：

```json
{
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
    "extraResources": [],
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

### npm scripts

- `start`：保持 `electron .`
- `icons`：从 `icon.png` 生成 `build/icon.ico`
- `pack`：`electron-builder --dir`（未封装安装包，便于冒烟）
- `dist`：先确保图标存在，再 `electron-builder --win nsis`

### 依赖

- `devDependencies`：`electron-builder`、生成 ico 的小工具（如 `png-to-ico`）

### Git

- `.gitignore` 增加 `dist/`
- `build/icon.ico`：生成后提交（见上）

## 主进程改动要点

1. **最先**（`ready` 前）：按 `app.isPackaged` 设置隔离的 `userData`；开发可做旧目录 → `-dev` 迁移。
2. 新增 `electron/appIcon.js`（或等价）：`resolveAppIconPath()` / `resolveAppIcon()`。
3. `createWindow` 设置 `icon`。
4. `appTray.js` 改为调用共享解析。
5. `windowsNotify.ensureWindowsNotifyShortcut`：packaged 时 skip。
6. `resolveAppUserModelId`：packaged 时固定 `com.bili.up.viewer`。
7. Cookie 回退：`process.env.BILI_COOKIE` **仅开发**使用；生产只读 `settings.json`（默认空）。

## 测试要点

- 纯函数：图标路径；`resolveUserDataDir({ isPackaged, appData })` 开发/生产路径不同。
- 打包白名单：构建配置不含用户数据路径；可对 `files` 配置做静态断言或文档验收。
- 现有 store / notify / tray 单测不回归。
- 手动：安装版首次打开无开发收藏与 Cookie；设置页 Cookie 为空，收藏列表为空。

## 验收

1. 开发启动时，窗口/任务栏/托盘显示 `icon.png`（非 Electron 默认）。
2. `npm run dist` 产出 NSIS 安装包于 `dist/`；安装包内无 Cookie/favorites/watch 文件。
3. 安装后桌面/开始菜单快捷方式名为 **Bili UP Viewer**，图标正确。
4. **安装版首次运行**：空收藏、空 Cookie（初始化默认设置），与开发目录数据互不影响。
5. 安装版动态提醒仍可用（用户自行配置 Cookie 并开启提醒之后）。
6. 关闭到托盘行为在安装版与开发版一致。
