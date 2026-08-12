# Task 2 Report: Shared app icon for window + tray

## Status: DONE

## Summary

Added `resolveAppIconPath({ appPath })` returning `path.join(appPath, 'icon.png')` (simplified approach per brief). Wired `BrowserWindow.icon` and tray `loadTrayIcon(iconPath)` to the same path from `app.getAppPath()` in `main.js`.

## Files Changed

| File | Action |
|------|--------|
| `electron/appIcon.js` | Created — `resolveAppIconPath` |
| `tests/appIcon.test.js` | Created — 2 tests |
| `electron/main.js` | Modified — `icon` on BrowserWindow; pass `iconPath` to tray |
| `electron/tray/appTray.js` | Modified — accept `iconPath`; removed hardcoded `__dirname` join |
| `package.json` | Modified — added `tests/appIcon.test.js` to `test` script |

## TDD Evidence

### RED — appIcon tests (Step 1)

```bash
node --test tests/appIcon.test.js
```

```
Error: Cannot find module '../electron/appIcon'
# fail 1, pass 0
```

### GREEN — full suite (Step 3)

```bash
npm test
```

```
# tests 80
# pass 80
# fail 0
```

## Design Notes

- Simplified resolver: always `app.getAppPath()` + `icon.png` (dev = project root; packaged = `app.asar` path).
- Tray still falls back to `process.execPath` if tray creation throws (unchanged behavior).
- No commit per task instructions.

## Concerns

- Packaged tray icon depends on `icon.png` inside `app.asar`; if `nativeImage.createFromPath` fails on some Windows setups, Task 3 packaging may need `extraResources` fallback (noted in design doc).
