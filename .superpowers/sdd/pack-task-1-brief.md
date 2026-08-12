### Task 1: Isolated userData + prod cookie policy

**Files:**
- Create: `electron/paths/userData.js`
- Create: `tests/userData.test.js`
- Modify: `electron/main.js`锛堥《閮ㄩ『搴忥細閰嶇疆 userData 鈫?鍐嶈 store锛汣ookie 鍥為€€锛?
- Modify: `package.json`锛坱est 鑴氭湰鍔犲叆鏂版枃浠讹級

**Interfaces:**
- Consumes: `fs`銆乣path`銆丒lectron `app`锛堜粎鍦?apply 鏃讹級
- Produces:
  - `resolveUserDataDir({ isPackaged, appData }) -> string`
  - `maybeMigrateLegacyUserData({ legacyDir, destDir, copyFn }) -> { migrated: boolean }`
  - `configureIsolatedUserData(app)` 鈥?鍦ㄤ换浣?`app.getPath('userData')` **涔嬪墠**璋冪敤
  - `resolveInitialCookie({ settingsCookie, envCookie, isPackaged }) -> string`

- [ ] **Step 1: 鍐欏け璐ュ崟娴?*

`tests/userData.test.js`锛?

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  resolveUserDataDir,
  maybeMigrateLegacyUserData,
  resolveInitialCookie,
} = require('../electron/paths/userData');

describe('resolveUserDataDir', () => {
  it('uses bili-up-viewer-dev when not packaged', () => {
    assert.equal(
      resolveUserDataDir({ isPackaged: false, appData: 'C:\\\\Users\\\\x\\\\AppData\\\\Roaming' }),
      path.join('C:\\\\Users\\\\x\\\\AppData\\\\Roaming', 'bili-up-viewer-dev'),
    );
  });

  it('uses Bili UP Viewer when packaged', () => {
    assert.equal(
      resolveUserDataDir({ isPackaged: true, appData: 'C:\\\\Users\\\\x\\\\AppData\\\\Roaming' }),
      path.join('C:\\\\Users\\\\x\\\\AppData\\\\Roaming', 'Bili UP Viewer'),
    );
  });
});

describe('maybeMigrateLegacyUserData', () => {
  it('copies when legacy exists and dest missing', () => {
    const calls = [];
    const result = maybeMigrateLegacyUserData({
      legacyDir: 'L',
      destDir: 'D',
      exists: (p) => p === 'L',
      copyFn: (from, to) => calls.push([from, to]),
    });
    assert.equal(result.migrated, true);
    assert.deepEqual(calls, [['L', 'D']]);
  });

  it('skips when dest already exists', () => {
    const result = maybeMigrateLegacyUserData({
      legacyDir: 'L',
      destDir: 'D',
      exists: () => true,
      copyFn: () => {
        throw new Error('should not copy');
      },
    });
    assert.equal(result.migrated, false);
  });
});

describe('resolveInitialCookie', () => {
  it('allows env cookie only when not packaged', () => {
    assert.equal(
      resolveInitialCookie({
        settingsCookie: '',
        envCookie: 'SESSDATA=dev',
        isPackaged: false,
      }),
      'SESSDATA=dev',
    );
    assert.equal(
      resolveInitialCookie({
        settingsCookie: '',
        envCookie: 'SESSDATA=dev',
        isPackaged: true,
      }),
      '',
    );
  });

  it('prefers settings cookie always', () => {
    assert.equal(
      resolveInitialCookie({
        settingsCookie: 'from-file',
        envCookie: 'from-env',
        isPackaged: false,
      }),
      'from-file',
    );
  });
});
```

- [ ] **Step 2: 璺戞祴纭澶辫触**

Run: `node --test tests/userData.test.js`  
Expected: FAIL锛堟ā鍧椾笉瀛樺湪锛?

- [ ] **Step 3: 瀹炵幇 `electron/paths/userData.js`**

```js
const fs = require('fs');
const path = require('path');

const DEV_DIR_NAME = 'bili-up-viewer-dev';
const PROD_DIR_NAME = 'Bili UP Viewer';
const LEGACY_DIR_NAME = 'bili-up-viewer';

function resolveUserDataDir({ isPackaged, appData }) {
  return path.join(appData, isPackaged ? PROD_DIR_NAME : DEV_DIR_NAME);
}

function maybeMigrateLegacyUserData({
  legacyDir,
  destDir,
  exists = fs.existsSync,
  copyFn = (from, to) => fs.cpSync(from, to, { recursive: true }),
}) {
  if (!exists(legacyDir) || exists(destDir)) return { migrated: false };
  copyFn(legacyDir, destDir);
  return { migrated: true };
}

function configureIsolatedUserData(app) {
  const appData = app.getPath('appData');
  const isPackaged = app.isPackaged;
  const dest = resolveUserDataDir({ isPackaged, appData });
  if (!isPackaged) {
    const legacyDir = path.join(appData, LEGACY_DIR_NAME);
    try {
      maybeMigrateLegacyUserData({ legacyDir, destDir: dest });
    } catch (e) {
      console.error('[userData] legacy migrate failed', e);
    }
  }
  app.setPath('userData', dest);
  return dest;
}

function resolveInitialCookie({ settingsCookie, envCookie, isPackaged }) {
  const fromSettings = String(settingsCookie || '').trim();
  if (fromSettings) return fromSettings;
  if (!isPackaged) return String(envCookie || '').trim();
  return '';
}

module.exports = {
  DEV_DIR_NAME,
  PROD_DIR_NAME,
  LEGACY_DIR_NAME,
  resolveUserDataDir,
  maybeMigrateLegacyUserData,
  configureIsolatedUserData,
  resolveInitialCookie,
};
```

- [ ] **Step 4: 鏀?`main.js` 鍔犺浇椤哄簭**

鍦ㄦ枃浠舵渶椤堕儴锛坄protocol.registerSchemesAsPrivileged` 鍙繚鐣欏湪鍓嶏紝浣?**蹇呴』鍦ㄧ涓€娆?`app.getPath('userData')` 涔嬪墠**锛夎皟鐢細

```js
const {
  configureIsolatedUserData,
  resolveInitialCookie,
} = require('./paths/userData');

// AFTER requiring electron app, BEFORE favoritesPath/settingsPath:
configureIsolatedUserData(app);

const favoritesPath = path.join(app.getPath('userData'), 'favorites.json');
// ...
const savedCookie = settings.get().cookie || '';
const client = createClient({
  cookie: resolveInitialCookie({
    settingsCookie: savedCookie,
    envCookie: process.env.BILI_COOKIE || '',
    isPackaged: app.isPackaged,
  }),
});
```

鍚屾淇敼 `saveSettings` 閲?`client.setCookie`锛?

```js
client.setCookie(
  resolveInitialCookie({
    settingsCookie: next.cookie || '',
    envCookie: process.env.BILI_COOKIE || '',
    isPackaged: app.isPackaged,
  }),
);
```

- [ ] **Step 5: 璺戦€氭祴璇曞苟鏇存柊 package.json test 鍒楄〃**

Run: `node --test tests/userData.test.js` 涓?`npm test`  
Expected: PASS

- [ ] **Step 6: 鏆傚瓨璇存槑**

```
feat: isolate dev/prod userData and block prod env cookie
```

---

