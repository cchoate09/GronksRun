const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname;
const GAME_PATH = path.join(ROOT, 'game.js');
const GENERATED_DIR = path.join(ROOT, 'assets', 'spritesheets', 'enemies', 'generated');
const MANIFEST_PATH = path.join(GENERATED_DIR, 'manifest.json');
const FRAME_SIZE = 128;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function buildEnemyAssets() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing enemy sprite manifest at ${MANIFEST_PATH}. Run node gen_sprite_sheets.js first.`);
  }

  const manifest = readJson(MANIFEST_PATH);
  const b64Map = {};
  const defs = {};

  for (const id of Object.keys(manifest)) {
    const meta = manifest[id];
    const pngPath = path.join(GENERATED_DIR, `${id}.png`);
    if (!fs.existsSync(pngPath)) {
      throw new Error(`Missing generated sprite sheet: ${pngPath}`);
    }
    if ((meta.width % meta.cols) !== 0 || (meta.height % meta.rows) !== 0) {
      throw new Error(`Sprite sheet ${id} has invalid grid ${meta.width}x${meta.height} for ${meta.cols}x${meta.rows}`);
    }

    const targetW = meta.cols * FRAME_SIZE;
    const targetH = meta.rows * FRAME_SIZE;
    const buffer = await sharp(pngPath)
      .resize(targetW, targetH, { fit: 'fill', kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toBuffer();

    b64Map[id] = `data:image/png;base64,${buffer.toString('base64')}`;
    defs[id] = {
      cols: meta.cols,
      rows: meta.rows,
      fps: meta.fps,
      anims: meta.anims
    };

    console.log(`${id}: ${meta.width}x${meta.height} -> ${targetW}x${targetH}`);
  }

  return { b64Map, defs };
}

function patchGameSource(source, b64Map, defs) {
  const enabledPattern = /const ENEMY_SPRITES_ENABLED = (true|false);/;
  if (!enabledPattern.test(source)) {
    throw new Error('Could not find ENEMY_SPRITES_ENABLED flag in game.js');
  }
  let next = source.replace(enabledPattern, 'const ENEMY_SPRITES_ENABLED = true;');

  const blockStart = next.indexOf('var ENEMY_SPRITE_B64 = {');
  const blockEnd = next.indexOf('var enemySprites = {};');
  if (blockStart === -1 || blockEnd === -1 || blockEnd <= blockStart) {
    throw new Error('Could not find enemy sprite asset block in game.js');
  }

  const replacement =
    `var ENEMY_SPRITE_B64 = ${JSON.stringify(b64Map, null, 2)};\n\n` +
    `var ENEMY_SPRITE_DEFS = ${JSON.stringify(defs, null, 2)};\n\n` +
    `var enemySprites = {};`;

  next = next.slice(0, blockStart) + replacement + next.slice(blockEnd + 'var enemySprites = {};'.length);
  return next;
}

async function main() {
  const { b64Map, defs } = await buildEnemyAssets();
  const source = fs.readFileSync(GAME_PATH, 'utf8');
  const patched = patchGameSource(source, b64Map, defs);
  fs.writeFileSync(GAME_PATH, patched);
  console.log(`Updated enemy sprite assets in ${GAME_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
