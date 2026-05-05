const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const sharp = require('sharp');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadSpriteData() {
  const fullPath = path.join(projectRoot, 'src', 'game', 'assets', 'spriteData.ts');
  const source = fs.readFileSync(fullPath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === 'pixi.js') return { Assets: { load: async () => {} } };
    if (request.endsWith('.png')) return { default: path.resolve(path.dirname(fullPath), request) };
    throw new Error(`Unexpected require from spriteData.ts: ${request}`);
  };
  new Function('require', 'exports', 'module', '__filename', '__dirname', js)(
    localRequire,
    module.exports,
    module,
    fullPath,
    path.dirname(fullPath)
  );
  return module.exports;
}

async function readFrameStats(sheet) {
  const metadata = await sharp(sheet.image).metadata();
  assert(metadata.hasAlpha === true, `${sheet.image}: sprite sheet should preserve alpha transparency`);
  const { data, info } = await sharp(sheet.image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frameW = info.width / sheet.cols;
  const frameH = info.height / sheet.rows;
  assert(Number.isInteger(frameW) && Number.isInteger(frameH), `${sheet.image}: frame grid should divide image dimensions`);

  const stats = [];
  for (let frame = 0; frame < sheet.cols * sheet.rows; frame++) {
    const col = frame % sheet.cols;
    const row = Math.floor(frame / sheet.cols);
    let minX = frameW;
    let minY = frameH;
    let maxX = -1;
    let maxY = -1;
    let pixels = 0;
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const idx = ((row * frameH + y) * info.width + col * frameW + x) * 4;
        if (data[idx + 3] <= 10) continue;
        pixels++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    stats[frame] = pixels > 0
      ? { centerX: (minX + maxX) / 2, footY: maxY, width: maxX - minX + 1, height: maxY - minY + 1, pixels }
      : null;
  }
  return stats;
}

function spread(values) {
  return Math.max(...values) - Math.min(...values);
}

function renderedPoint(stat, offset, scale) {
  return {
    x: stat.centerX * scale + (offset?.x ?? 0),
    y: stat.footY * scale + (offset?.y ?? 0),
  };
}

async function verifySheet(name, sheet) {
  assert(sheet.frameOffsets, `${name}: should define per-frame stabilization offsets`);
  assert(String(fs.existsSync(sheet.image)) === 'true', `${name}: image file should exist`);
  const stats = await readFrameStats(sheet);
  const framesInUse = new Set(Object.values(sheet.animations).flat());

  for (const frame of framesInUse) {
    assert(stats[frame], `${name}: frame ${frame} should have visible alpha pixels`);
    assert(sheet.frameOffsets[frame], `${name}: frame ${frame} should have an explicit stabilization offset`);
  }

  for (const [state, frames] of Object.entries(sheet.animations)) {
    if (!frames || frames.length < 2) continue;
    const rendered = frames.map((frame) => renderedPoint(stats[frame], sheet.frameOffsets[frame], sheet.scale));
    const footSpread = spread(rendered.map((point) => point.y));
    const centerSpread = spread(rendered.map((point) => point.x));
    assert(footSpread <= 1.25, `${name} ${state}: rendered foot baseline should stay stable, spread=${footSpread.toFixed(2)}`);
    const allowedCenterSpread = state === 'ATTACK' || state === 'RANGED_ATTACK' ? 10 : 7;
    assert(centerSpread <= allowedCenterSpread, `${name} ${state}: rendered center should not visibly jitter, spread=${centerSpread.toFixed(2)}`);
  }
}

(async () => {
  const { HERO_SHEETS, ENEMY_SHEETS } = loadSpriteData();
  for (const [name, sheet] of Object.entries(HERO_SHEETS)) {
    await verifySheet(`hero:${name}`, sheet);
    assert(sheet.animations.JUMP && sheet.animations.FALL, `hero:${name}: should expose jump and fall animation maps`);
  }
  for (const [name, sheet] of Object.entries(ENEMY_SHEETS)) {
    await verifySheet(`enemy:${name}`, sheet);
  }

  const skeletalSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'entities', 'SkeletalSprite.ts'), 'utf8');
  const playerSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'entities', 'Player.ts'), 'utf8');
  const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
  assert(skeletalSource.includes('applyFrameOffset'), 'SkeletalSprite should apply per-frame stabilization offsets');
  assert(skeletalSource.includes('animationRateScale'), 'SkeletalSprite should use one bounded animation speed scale instead of double-scaling time and fps');
  assert(playerSource.includes("this.animationState = this.body.vy < 0 ? 'JUMP' : 'FALL'"), 'Player should expose distinct jump/fall animation states');
  assert(gameSceneSource.includes('animation_state: enemy.sprite.animationState'), 'Enemy snapshots should expose animation state for gameplay verification');
  assert(gameSceneSource.includes('animation_frame: enemy.sprite.animationFrame'), 'Enemy snapshots should expose animation frame for gameplay verification');

  console.log('Sprite animation quality contract passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
