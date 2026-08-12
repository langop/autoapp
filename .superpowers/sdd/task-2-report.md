# Task 2 Report: Tray module + main-process close / quit wiring

**Date:** 2026-08-12  
**Status:** Complete

## Summary

Implemented system tray (`electron/tray/appTray.js`) and wired close-to-tray / ask / quit flow in `electron/main.js` per brief.

## Files Changed

| File | Action |
|------|--------|
| `electron/tray/appTray.js` | Created — `loadTrayIcon`, `showMainWindow`, `createAppTray` with execPath fallback + null on failure |
| `electron/main.js` | Modified — close intercept, ask dialog, tray lifecycle, `window-all-closed` guard, notification click uses `showMainWindow` |

## Implementation Notes

### `electron/tray/appTray.js`

- Verbatim structure from brief: `buv.png` → `createEmpty()` fallback → `buildTray`.
- On Tray construction failure: retry with `nativeImage.createFromPath(process.execPath)`; still fails → `console.error` + return `null`.
- Extracted `buildTray` helper to avoid duplicating menu/click setup in fallback path (behavior unchanged).

### `electron/main.js`

- State: `appTray`, `isQuitting`, `closeDialogOpen`.
- `hideToTrayOrQuit()`: when `appTray` is null, sets `isQuitting` and calls `app.quit()` (brief requirement for tray-less environments).
- Close handler: `resolveCloseDecision` → allow-quit / hide / ask dialog with checkbox persistence.
- `quitApp` / `openFromTray` wired to tray menu and click.
- `window-all-closed`: only quits when `isQuitting` (hidden-to-tray keeps process alive).
- `before-quit`: sets `isQuitting = true` + `scheduler.stop()`.
- Notification click: `showMainWindow(mainWindow)` before `open-favorite-dynamics` send.

## Verification

### Tests

```
npm test
# tests 72, pass 72, fail 0
```

No new unit tests in this task (per brief).

### Manual smoke

```
npm start
```

- App launched without crash (Electron process started cleanly in headless agent environment).
- Full GUI smoke (× dialog, tray menu, remember choice) not automated here; requires interactive Windows session.

## Self-Review

- **Scope**: Only `electron/tray/appTray.js` and `electron/main.js` modified; no unrelated WIP reverted.
- **Brief alignment**: Close dialog strings/buttons match design doc; checkbox API used; tray icon fallback + null tray → quit path implemented.
- **Edge cases**: `closeDialogOpen` prevents stacked dialogs; `isQuitting` set on `before-quit` and explicit quit paths; destroyed window guarded in `showMainWindow`.
- **Minor deviation**: `buildTray` helper extracted for DRY fallback path — same runtime behavior as duplicated brief snippet.

## Concerns

- Tray icon fallback to `createEmpty()` may render a blank tray icon in dev if `buv.png` missing; execPath fallback covers Tray construction throws.
- `hideToTrayOrQuit` quits when tray is null — correct per brief but user loses hide-without-quit if tray fails silently in production (logged to console).

## Commits

None (per task instructions).

## Final Review Fixes (2026-08-12)

### Bug fixes

1. **`closeAction: 'quit'` left process alive** — `allow-quit` previously returned without `preventDefault`, so the window closed but `isQuitting` stayed false and `window-all-closed` never called `app.quit()`. Now: when `allow-quit` and not yet quitting, `preventDefault()` + `quitApp()`; when `isQuitting` already true, allow close. Ask-dialog "退出应用" branch now calls `quitApp()` instead of bare `app.quit()`.

2. **Tray icon path** — `electron/tray/appTray.js` primary icon changed from `buv.png` to repo root `icon.png`; execPath fallback unchanged.

### Files changed

| File | Change |
|------|--------|
| `electron/main.js` | Quit path uses `quitApp()` for allow-quit and ask-dialog exit |
| `electron/tray/appTray.js` | Primary tray icon path → `icon.png` |

### Verification

```
npm test
# tests 72, pass 72, fail 0
```

No git commit (per instructions).

