const fs = require('fs');
const path = require('path');
const { writeTrayAndWindowIcons } = require('./process-tuo-icon');

async function generateBrandIco() {
  const pngToIco = (await import('png-to-ico')).default;
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

async function generateTuoIcons() {
  const root = path.join(__dirname, '..');
  const sourcePath = path.join(root, 'tuo.png');
  if (!fs.existsSync(sourcePath)) throw new Error('missing tuo.png');
  const result = await writeTrayAndWindowIcons({
    sourcePath,
    windowOutPath: path.join(root, 'electron', 'icons', 'window.png'),
    trayPngOutPath: path.join(root, 'electron', 'icons', 'tray.png'),
    trayIcoOutPath: path.join(root, 'electron', 'icons', 'tray.ico'),
  });
  console.log('wrote', result.windowOutPath);
  console.log('wrote', result.trayPngOutPath);
  console.log('wrote', result.trayIcoOutPath);
}

async function main() {
  await generateBrandIco();
  await generateTuoIcons();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
