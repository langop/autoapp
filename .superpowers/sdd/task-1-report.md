# Task 1 Report: Settings `closeAction` + close decision pure function

## Status: DONE

## Summary

Added `closeAction` setting (`'ask' | 'tray' | 'quit'`, default `'ask'`) to the settings store with validation via `normalizeCloseAction`, and a pure `resolveCloseDecision` helper that maps `{ closeAction, isQuitting }` to `'allow-quit' | 'hide' | 'ask'`.

## Files Changed

| File | Action |
|------|--------|
| `electron/store/settings.js` | Modified — `closeAction` field, `normalizeCloseAction`, read/save merge |
| `tests/settings.test.js` | Modified — new closeAction tests; updated existing `deepEqual` assertions |
| `electron/tray/closeDecision.js` | Created — `resolveCloseDecision` pure function |
| `tests/closeDecision.test.js` | Created — 5 decision-matrix tests |
| `package.json` | Modified — added `tests/closeDecision.test.js` to `test` script |

## TDD Evidence

### RED — settings tests (Step 2)

```bash
node --test tests/settings.test.js
```

```
# fail 5
# pass 3

not ok 1 - returns empty cookie by default
  error: Expected values to be strictly deep-equal:
  + actual - expected
    {
  -   closeAction: 'ask',
      cookie: '',
      ...
    }

not ok 6 - defaults closeAction to ask
  error: Expected values to be strictly equal:
  + undefined
  - 'ask'
```

Failure reason: `closeAction` not yet implemented in settings store. ✓ Expected.

### GREEN — settings (Step 3)

Implemented `CLOSE_ACTIONS`, `normalizeCloseAction`, `DEFAULTS.closeAction`, and merge logic in `read()` / `save()`.

### RED — closeDecision tests (Step 4, before implementation)

```bash
node --test tests/closeDecision.test.js
```

```
Error: Cannot find module '../electron/tray/closeDecision'
# fail 1
# pass 0
```

Failure reason: module not yet created. ✓ Expected.

### GREEN — focused tests (Step 5)

```bash
node --test tests/settings.test.js tests/closeDecision.test.js
```

```
# tests 13
# pass 13
# fail 0
```

### Full suite

```bash
npm test
```

```
# tests 72
# pass 72
# fail 0
```

## Implementation Notes

### `electron/store/settings.js`

- `normalizeCloseAction` rejects unknown values → `'ask'`
- `read()` normalizes persisted `closeAction` on load
- `save()` merges `closeAction` with same partial-update pattern as other fields

### `electron/tray/closeDecision.js`

Decision priority:
1. `isQuitting === true` → `'allow-quit'` (always, regardless of `closeAction`)
2. `closeAction === 'tray'` → `'hide'`
3. `closeAction === 'quit'` → `'allow-quit'`
4. otherwise (including unknown) → `'ask'`

### Test adjustment beyond brief

Updated the existing `saves notify settings and merges partial updates` `deepEqual` to include `closeAction: 'ask'`. Required because `store.get()` now always returns `closeAction`; the brief's instruction to update `deepEqual` default assertions implied this, though that specific test wasn't listed verbatim.

## Self-Review

- **Scope**: Only touched files listed in the task brief. No unrelated WIP files modified.
- **API**: Matches brief exactly; `normalizeCloseAction` is internal (not exported) — sufficient for Task 1; export can be added later if IPC/UI needs it.
- **Edge cases covered**: invalid `closeAction` on save/load, partial merge preserving `closeAction`, `isQuitting` override, unknown `closeAction` in decision helper.
- **No regressions**: All 72 existing + new tests pass.

## Commits

None (per project policy — commits only when user explicitly asks).

Suggested commit message:

```
feat: add closeAction setting and close decision helper
```

## Concerns

None.
