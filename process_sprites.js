const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CHAR_SHEETS = [
  { id: 'bruk',  file: 'brukspritesheet.png' },
  { id: 'zara',  file: 'zaraspritesheet.png' },
  { id: 'rex',   file: 'rexspritesheet.png' },
  { id: 'mog',   file: 'MogSpriteSheet.png' },
];
const TARGET_W = 1024, TARGET_H = 256;

async function processImage(filePath, targetW, targetH) {
  const buf = fs.readFileSync(filePath);
  const finalBuf = await sharp(buf)
    .resize(targetW, targetH, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 }).toBuffer();
  return 'data:image/png;base64,' + finalBuf.toString('base64');
}

async function main() {
  const results = {};
  for (const ch of CHAR_SHEETS) {
    const fp = path.join('assets/spritesheets', ch.file);
    try {
      results[ch.id] = await processImage(fp, TARGET_W, TARGET_H);
      console.log(`${ch.id}: OK (${(results[ch.id].length/1024).toFixed(0)}KB)`);
    } catch (e) {
      console.error(`${ch.id}: ERROR - ${e.message}`);
    }
  }
  fs.writeFileSync('missing_sprites.json', JSON.stringify(results, null, 2));
  console.log('Results written to missing_sprites.json');
}

main();
