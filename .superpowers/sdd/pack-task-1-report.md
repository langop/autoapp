# Task 1 Report: Isolated userData + prod cookie policy

## Status: DONE

## Summary

Isolated dev vs prod Electron `userData` directories (`bili-up-viewer-dev` / `Bili UP Viewer`), added one-time legacy migration from `bili-up-viewer` in dev, and blocked `BILI_COOKIE` env fallback in packaged builds via `resolveInitialCookie`.

## Files Changed

| File | Action |
|------|--------|
| `electron/paths/userData.js` | Created — `resolveUserDataDir`, `maybeMigrateLegacyUserData`, `configureIsolatedUserData`, `resolveInitialCookie` |
| `tests/userData.test.js` | Created — 6 tests across 3 suites |
| `electron/main.js` | Modified — `configureIsolatedUserData(app)` before store paths; cookie resolution via `resolveInitialCookie` |
| `package.json` | Modified — added `tests/userData.test.js` to `test` script |

## TDD Evidence

### RED — userData tests (Step 2)

```bash
node --test tests/userData.test.js
```

```
Error: Cannot find module '../electron/paths/userData'
# fail 1
# pass 0
```

Failure reason: module not yet created. ✓ Expected.

### GREEN — focused tests (Step 5)

```bash
node --test tests/userData.test.js
```

```
# tests 6
# suites 3
# pass 6
# fail 0
```

### Full suite

```bash
npm test
```

```
# tests 78
# suites 22
# pass 78
# fail 0
```

## Implementation Notes

### `electron/paths/userData.js`

- **Dev dir**: `%APPDATA%/bili-up-viewer-dev`
- **Prod dir**: `%APPDATA%/Bili UP Viewer`
- **Legacy dir**: `%APPDATA%/bili-up-viewer` — migrated to dev dir on first launch when dest missing; errors logged, non-fatal
- **`resolveInitialCookie`**: settings cookie wins; env cookie allowed only when `!isPackaged`

### `electron/main.js` load order

1. Electron `app` import
2. Other requires (including `./paths/userData`)
3. `protocol.registerSchemesAsPrivileged` (unchanged position)
4. **`configureIsolatedUserData(app)`** — before any `app.getPath('userData')`
5. Store path construction and client init
6. `saveSettings` IPC uses same `resolveInitialCookie` for `client.setCookie`

## Self-Review

- **Scope**: Only files listed in brief; no unrelated changes.
- **API**: Matches brief exactly — constants, function signatures, and logic verbatim.
- **Load order**: `configureIsolatedUserData` runs at line 48, before first `app.getPath('userData')` at line 50.
- **No regressions**: All 78 tests pass (72 existing + 6 new).

## Commits

None (per task instructions).

Suggested commit message:

```
feat: isolate dev/prod userData and block prod env cookie
```

## Concerns

- Legacy migration is dev-only and best-effort; no rollback if copy partially fails mid-flight (same as brief).
- `configureIsolatedUserData` is not unit-tested directly (requires Electron `app` mock); behavior covered indirectly via pure helpers.
