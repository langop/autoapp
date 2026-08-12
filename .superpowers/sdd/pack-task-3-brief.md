### Task 3: electron-builder, icons script, packaged notify skip

**Files:**
- Create: `scripts/generate-icons.js`
- Create: `tests/packageBuild.test.js`
- Modify: `package.json`锛坉eps銆乻cripts銆乣build`锛?
- Modify: `.gitignore`
- Modify: `electron/notify/windowsNotify.js`锛坧ackaged skip锛?
- Modify: `tests/windowsNotify.test.js`锛堣嫢闇€瑕嗙洊 skip锛?
- Create: `build/icon.ico`锛堣繍琛?icons 鍚庢彁浜わ級

**Interfaces:**
- `npm run icons` 鈫?鍐?`build/icon.ico`
- `npm run pack` / `npm run dist`
- `ensureWindowsNotifyShortcut` 鍦?`app.isPackaged` 鏃?`{ ok: true, skipped: true }`

- [ ] **Step 1: 瀹夎渚濊禆**

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
Expected: 鐢熸垚 `build/icon.ico`

- [ ] **Step 3: 鎵╁睍 `package.json`**

```json
{
  "scripts": {
    "start": "electron .",
    "icons": "node scripts/generate-icons.js",
    "pack": "npm run icons && electron-builder --dir",
    "dist": "npm run icons && electron-builder --win nsis",
    "test": "鈥xisting鈥?tests/userData.test.js tests/appIcon.test.js tests/packageBuild.test.js"
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

`.gitignore` 澧炲姞锛?

```
dist/
```

锛坄build/icon.ico` 鎻愪氦杩涘簱銆傦級

- [ ] **Step 4: `tests/packageBuild.test.js` 鐧藉悕鍗曟柇瑷€**

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

- [ ] **Step 5: packaged 璺宠繃閫氱煡蹇嵎鏂瑰紡**

鍦?`ensureWindowsNotifyShortcut` 寮€澶达細

```js
if (app.isPackaged) return { ok: true, skipped: true };
```

锛坄app` 宸茬敱璋冪敤鏂逛紶鍏ャ€傦級

- [ ] **Step 6: 璺?`npm test` 涓?`npm run pack`锛堢洰褰曚骇鐗╁啋鐑燂級**

Run: `npm test`  
Expected: PASS  

Run: `npm run pack`  
Expected: `dist/win-unpacked/Bili UP Viewer.exe` 瀛樺湪锛涜В鍘嬬洰褰曚腑鏃?`favorites.json` / 鐢ㄦ埛 `settings.json`銆?

锛堝畬鏁?`npm run dist` 鍙湪鏈満鎵嬪姩璺戯紱鑻?CI 鏃?Windows 绛惧悕鐜锛岃嚦灏?`pack` 鎴愬姛銆傦級

- [ ] **Step 7: 鏆傚瓨璇存槑**

```
feat: add electron-builder NSIS packaging and icon pipeline
```

---

