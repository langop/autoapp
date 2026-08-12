const fs = require('fs');
const path = require('path');

async function main() {
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
