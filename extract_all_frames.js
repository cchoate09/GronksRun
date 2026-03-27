const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const OUT = './assets/spritesheets/enemies/debug';

// Only extract for sheets with promising grids
const SHEETS = [
  { id: 'bomber',      file: 'bomberspritesheet.png',      cols:8, rows:2 },
  { id: 'charger',     file: 'chargerspritesheet.png',     cols:4, rows:4 },
  { id: 'fire_geyser', file: 'firegeyserspritesheet.png', cols:8, rows:3 },
  { id: 'serpent',     file: 'serpentspritesheet.png',     cols:4, rows:3 },
  { id: 'golem',       file: 'golemspritesheet.png',       cols:4, rows:3 },
  { id: 'diver',       file: 'diverspritesheet.png',       cols:8, rows:3 },
  { id: 'log',         file: 'logspritesheet.png',         cols:8, rows:4 },
];

async function main() {
  for (const sheet of SHEETS) {
    const fp = path.join('./assets/spritesheets/enemies', sheet.file);
    const buf = fs.readFileSync(fp);
    const meta = await sharp(buf).metadata();
    const fw = Math.floor(meta.width / sheet.cols);
    const fh = Math.floor(meta.height / sheet.rows);

    for (let r = 0; r < sheet.rows; r++) {
      for (let c = 0; c < sheet.cols; c++) {
        const idx = r * sheet.cols + c;
        const frame = await sharp(buf)
          .extract({ left: c*fw, top: r*fh, width: fw, height: fh })
          .resize(128, 128, { fit: 'fill' })
          .png().toBuffer();
        fs.writeFileSync(path.join(OUT, `${sheet.id}_orig_f${String(idx).padStart(2,'0')}.png`), frame);
      }
    }
    console.log(`${sheet.id}: ${sheet.cols*sheet.rows} frames at ${fw}x${fh}`);
  }
}
main().catch(err => { console.error(err); process.exit(1); });
