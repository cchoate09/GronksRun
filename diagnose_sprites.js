// diagnose_sprites.js — Extract individual frames from each enemy sprite sheet
// to visually verify grid alignment and identify problems

const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const OUT_DIR = './assets/spritesheets/enemies/debug';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SHEETS = [
  { id: 'troll',       file: 'trollspritesheet.png',       cols:8, rows:2, tW:1024, tH:256 },
  { id: 'charger',     file: 'chargerspritesheet.png',     cols:4, rows:4, tW:512, tH:512 },
  { id: 'diver',       file: 'diverspritesheet.png',       cols:8, rows:4, tW:1024, tH:512 },
  { id: 'witch',       file: 'witchspritesheet.png',       cols:8, rows:2, tW:1024, tH:256 },
  { id: 'golem',       file: 'golemspritesheet.png',       cols:4, rows:3, tW:512, tH:384 },
  { id: 'bomber',      file: 'bomberspritesheet.png',      cols:8, rows:2, tW:1024, tH:256 },
  { id: 'serpent',     file: 'serpentspritesheet.png',     cols:4, rows:3, tW:512, tH:384 },
  { id: 'ptero',       file: 'pterospritesheet.png',       cols:8, rows:4, tW:1024, tH:512 },
  { id: 'fire_geyser', file: 'firegeyserspritesheet.png', cols:8, rows:3, tW:1024, tH:384 },
  { id: 'log',         file: 'logspritesheet.png',         cols:8, rows:4, tW:1024, tH:512 },
  { id: 'spikes',      file: 'spikesspritesheet.png',     cols:4, rows:3, tW:512, tH:384 },
];

async function main() {
  for (const sheet of SHEETS) {
    const fp = path.join('./assets/spritesheets/enemies', sheet.file);
    const buf = fs.readFileSync(fp);

    // Resize to target dimensions (same as what the game uses)
    const resized = await sharp(buf)
      .resize(sheet.tW, sheet.tH, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer();

    const fw = sheet.tW / sheet.cols;
    const fh = sheet.tH / sheet.rows;

    // Extract each frame
    for (let r = 0; r < sheet.rows; r++) {
      for (let c = 0; c < sheet.cols; c++) {
        const idx = r * sheet.cols + c;
        const frame = await sharp(resized)
          .extract({ left: c * fw, top: r * fh, width: fw, height: fh })
          .png()
          .toBuffer();

        const outPath = path.join(OUT_DIR, `${sheet.id}_f${String(idx).padStart(2,'0')}_r${r}c${c}.png`);
        fs.writeFileSync(outPath, frame);
      }
    }
    console.log(`${sheet.id}: extracted ${sheet.cols * sheet.rows} frames (${fw}x${fh} each)`);
  }
  console.log('\nAll frames saved to ' + OUT_DIR);
}

main().catch(err => { console.error(err); process.exit(1); });
