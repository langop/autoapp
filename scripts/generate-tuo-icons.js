const path = require('path');
const { writeTrayAndWindowIcons } = require('./process-tuo-icon');

async function main() {
  const root = path.join(__dirname, '..');
  const result = await writeTrayAndWindowIcons({
    sourcePath: path.join(root, 'tuo.png'),
    windowOutPath: path.join(root, 'electron', 'icons', 'window.png'),
    trayPngOutPath: path.join(root, 'electron', 'icons', 'tray.png'),
    trayIcoOutPath: path.join(root, 'electron', 'icons', 'tray.ico'),
  });
  console.log('wrote', result.windowOutPath);
  console.log('wrote', result.trayPngOutPath);
  console.log('wrote', result.trayIcoOutPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
