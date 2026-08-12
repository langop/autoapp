### Task 1: Settings `closeAction` + close decision pure function

**Files:**
- Modify: `electron/store/settings.js`
- Modify: `tests/settings.test.js`
- Create: `electron/tray/closeDecision.js`
- Create: `tests/closeDecision.test.js`
- Modify: `package.json`锛坄test` 鑴氭湰鍔犲叆鏂版祴璇曟枃浠讹級

**Interfaces:**
- Consumes: 鐜版湁 `createSettingsStore` merge 妯″紡
- Produces:
  - `settings.get/save` 鍚?`closeAction: 'ask' | 'tray' | 'quit'`
  - `normalizeCloseAction(value) -> 'ask' | 'tray' | 'quit'`
  - `resolveCloseDecision({ closeAction, isQuitting }) -> 'allow-quit' | 'hide' | 'ask'`

- [ ] **Step 1: 鍐?settings 澶辫触鐢ㄤ緥**

鍦?`tests/settings.test.js` 鏇存柊榛樿鏂█骞舵柊澧烇細

```js
it('defaults closeAction to ask', () => {
  assert.equal(store.get().closeAction, 'ask');
});

it('saves closeAction and rejects invalid values', () => {
  assert.equal(store.save({ closeAction: 'tray' }).closeAction, 'tray');
  assert.equal(store.save({ closeAction: 'quit' }).closeAction, 'quit');
  assert.equal(store.save({ closeAction: 'nope' }).closeAction, 'ask');
});

it('merges closeAction on partial save', () => {
  store.save({ closeAction: 'tray' });
  store.save({ cookie: 'x=1' });
  assert.equal(store.get().closeAction, 'tray');
  assert.equal(store.get().cookie, 'x=1');
});
```

鍚屾鎶婄幇鏈?`deepEqual(store.get(), { cookie, notifyEnabled, notifyIntervalMin })` 鏂█琛ヤ笂 `closeAction: 'ask'`銆?

- [ ] **Step 2: 璺戞祴璇曠‘璁ゅけ璐?*

Run: `node --test tests/settings.test.js`  
Expected: FAIL锛堢己 `closeAction`锛?

- [ ] **Step 3: 瀹炵幇 settings 瀛楁**

鍦?`electron/store/settings.js`锛?

```js
const CLOSE_ACTIONS = new Set(['ask', 'tray', 'quit']);

function normalizeCloseAction(value) {
  return CLOSE_ACTIONS.has(value) ? value : 'ask';
}

const DEFAULTS = {
  cookie: '',
  notifyEnabled: true,
  notifyIntervalMin: 15,
  closeAction: 'ask',
};
```

`read()` / `save()` 鍧囩粡 `normalizeCloseAction`锛沗save` merge 鏃讹細

```js
closeAction: normalizeCloseAction(
  partial?.closeAction != null ? partial.closeAction : prev.closeAction,
),
```

- [ ] **Step 4: 鍐?closeDecision 娴嬭瘯骞跺疄鐜?*

`tests/closeDecision.test.js`锛?

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveCloseDecision } = require('../electron/tray/closeDecision');

describe('resolveCloseDecision', () => {
  it('allows quit when isQuitting', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'tray', isQuitting: true }),
      'allow-quit',
    );
  });

  it('hides when closeAction is tray', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'tray', isQuitting: false }),
      'hide',
    );
  });

  it('allows quit when closeAction is quit', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'quit', isQuitting: false }),
      'allow-quit',
    );
  });

  it('asks when closeAction is ask', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'ask', isQuitting: false }),
      'ask',
    );
  });

  it('asks for unknown closeAction', () => {
    assert.equal(
      resolveCloseDecision({ closeAction: 'weird', isQuitting: false }),
      'ask',
    );
  });
});
```

`electron/tray/closeDecision.js`锛?

```js
function resolveCloseDecision({ closeAction, isQuitting }) {
  if (isQuitting) return 'allow-quit';
  if (closeAction === 'tray') return 'hide';
  if (closeAction === 'quit') return 'allow-quit';
  return 'ask';
}

module.exports = { resolveCloseDecision };
```

- [ ] **Step 5: 璺戞祴璇曢€氳繃骞舵洿鏂?package.json test 鑴氭湰**

Run: `node --test tests/settings.test.js tests/closeDecision.test.js`  
Expected: PASS  

鍦?`package.json` 鐨?`test` 鑴氭湰涓姞鍏?`tests/closeDecision.test.js`銆?

- [ ] **Step 6: 鏆傚瓨璇存槑锛堝嬁鑷姩 commit锛岄櫎闈炵敤鎴疯姹傦級**

```
feat: add closeAction setting and close decision helper
```

---

