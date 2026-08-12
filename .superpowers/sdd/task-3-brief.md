### Task 3: Settings UI for closeAction

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/app.js`
- Modify: `renderer/styles.css`锛堣嫢鐜版湁 `field-label` / `check-label` 宸插鐢ㄥ彲鏋佸皬鏀瑰姩锛?

**Interfaces:**
- Consumes: `biliApi.getSettings` / `saveSettings`锛堝凡鍚?`closeAction`锛?
- Produces: 璁剧疆椤靛彲璇诲啓 `closeAction`

- [ ] **Step 1: 鍦ㄨ缃〉澧炲姞鎺т欢**

鍦?`renderer/index.html`銆屽姩鎬佹彁閱掋€嶅尯鍧楀悗澧炲姞锛?

```html
<div class="settings-section">
  <h3 class="section-title">绐楀彛鍏抽棴</h3>
  <label class="field-label" for="close-action">鍏抽棴绐楀彛鏃?/label>
  <select id="close-action">
    <option value="ask">姣忔璇㈤棶</option>
    <option value="tray">鏈€灏忓寲鍒版墭鐩?/option>
    <option value="quit">閫€鍑哄簲鐢?/option>
  </select>
</div>
```

- [ ] **Step 2: load/save 缁戝畾**

鍦?`loadSettings`锛堟垨绛変环璇诲彇璁剧疆澶勶級锛?

```js
$('close-action').value = s.closeAction || 'ask';
```

鍦?`saveSettings` payload 涓鍔狅細

```js
closeAction: $('close-action').value,
```

- [ ] **Step 3: 鎵嬪姩鍐掔儫**

1. 璁剧疆鏀逛负銆岄€€鍑哄簲鐢ㄣ€嶅苟淇濆瓨 鈫?鐐?脳 鐩存帴閫€鍑? 
2. 鏀瑰洖銆屾瘡娆¤闂€嶁啋 鐐?脳 鍐嶅嚭鐜板璇濇  
3. `_` 鏈€灏忓寲浠嶈繘浠诲姟鏍? 

- [ ] **Step 4: 璺戝叏閲忔祴璇?*

Run: `npm test`  
Expected: 鍏ㄩ儴 PASS  

- [ ] **Step 5: 鏆傚瓨璇存槑**

```
feat: add close-action setting UI
```

---

