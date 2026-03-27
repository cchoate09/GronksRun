// diagnose_grids.js — Try multiple grid sizes on ORIGINAL images to find correct alignment
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const OUT = './assets/spritesheets/enemies/debug';

const SHEETS = [
  { id: 'troll',       file: 'trollspritesheet.png',       tryGrids: [[8,2],[7,2],[6,2],[9,2],[8,3]] },
  { id: 'witch',       file: 'witchspritesheet.png',       tryGrids: [[8,2],[7,2],[6,2],[9,2]] },
  { id: 'bomber',      file: 'bomberspritesheet.png',      tryGrids: [[8,2],[8,3],[7,2]] },
  { id: 'golem',       file: 'golemspritesheet.png',       tryGrids: [[4,3],[5,3],[6,3],[4,4],[3,3]] },
  { id: 'serpent',     file: 'serpentspritesheet.png',     tryGrids: [[4,3],[5,3],[3,3],[5,2]] },
  { id: 'fire_geyser', file: 'firegeyserspritesheet.png', tryGrids: [[8,3],[7,3],[6,3],[8,4]] },
  { id: 'diver',       file: 'diverspritesheet.png',       tryGrids: [[8,4],[7,4],[6,4],[8,3]] },
  { id: 'ptero',       file: 'pterospritesheet.png',       tryGrids: [[8,4],[7,4],[6,4],[8,3]] },
  { id: 'log',         file: 'logspritesheet.png',         tryGrids: [[8,4],[6,4],[7,4]] },
  { id: 'spikes',      file: 'spikesspritesheet.png',     tryGrids: [[4,3],[5,3],[3,3],[4,2]] },
];

async function main() {
  for (const sheet of SHEETS) {
    const fp = path.join('./assets/spritesheets/enemies', sheet.file);
    const buf = fs.readFileSync(fp);
    const meta = await sharp(buf).metadata();

    console.log(`\n=== ${sheet.id} (${meta.width}x${meta.height}) ===`);

    for (const [cols, rows] of sheet.tryGrids) {
      const fw = Math.floor(meta.width / cols);
      const fh = Math.floor(meta.height / rows);
      const remainder_w = meta.width - (fw * cols);
      const remainder_h = meta.height - (fh * rows);

      // Extract frame 0 (top-left) at original resolution, then resize to 128x128 for viewing
      const frame0 = await sharp(buf)
        .extract({ left: 0, top: 0, width: fw, height: fh })
        .resize(128, 128, { fit: 'fill' })
        .png().toBuffer();

      // Extract frame 1
      const frame1 = await sharp(buf)
        .extract({ left: fw, top: 0, width: fw, height: fh })
        .resize(128, 128, { fit: 'fill' })
        .png().toBuffer();

      // Extract last frame of row 0
      const frameLast = await sharp(buf)
        .extract({ left: fw * (cols-1), top: 0, width: fw, height: fh })
        .resize(128, 128, { fit: 'fill' })
        .png().toBuffer();

      const tag = `${cols}x${rows}`;
      fs.writeFileSync(path.join(OUT, `${sheet.id}_grid${tag}_f0.png`), frame0);
      fs.writeFileSync(path.join(OUT, `${sheet.id}_grid${tag}_f1.png`), frame1);
      fs.writeFileSync(path.join(OUT, `${sheet.id}_grid${tag}_flast.png`), frameLast);

      console.log(`  ${tag}: ${fw}x${fh}/frame, remainder=${remainder_w}x${remainder_h}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
