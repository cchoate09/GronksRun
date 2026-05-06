const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const sharp = require('sharp');

const projectRoot = process.cwd();
const MIN_EDGE_PADDING_PX = 8;
const MAX_FOOT_SPREAD_PX = 1.25;
const MAX_CENTER_SPREAD_PX = 10;

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

async function readFrameBounds(sheet, frame) {
  const { data, info } = await sharp(sheet.image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frameW = info.width / sheet.cols;
  const frameH = info.height / sheet.rows;
  assert(Number.isInteger(frameW) && Number.isInteger(frameH), 'HEAVY atlas grid should divide image dimensions');

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

  assert(pixels > 0, `HEAVY frame ${frame} should have visible alpha pixels`);
  return {
    frame,
    frameW,
    frameH,
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    footY: maxY,
    margins: {
      left: minX,
      top: minY,
      right: frameW - 1 - maxX,
      bottom: frameH - 1 - maxY,
    },
  };
}

function spread(values) {
  return Math.max(...values) - Math.min(...values);
}

function renderedPoint(bounds, offset, scale) {
  return {
    x: bounds.centerX * scale + (offset?.x ?? 0),
    y: bounds.footY * scale + (offset?.y ?? 0),
  };
}

(async () => {
  const { ENEMY_SHEETS } = loadSpriteData();
  const heavy = ENEMY_SHEETS.HEAVY;
  assert(heavy, 'HEAVY sprite sheet should be defined');
  assert(fs.existsSync(heavy.image), `HEAVY image should exist: ${heavy.image}`);
  assert(heavy.frameOffsets, 'HEAVY should define frameOffsets');

  const frames = Array.from(new Set(Object.values(heavy.animations).flat()));
  const boundsByFrame = new Map();
  for (const frame of frames) {
    const bounds = await readFrameBounds(heavy, frame);
    boundsByFrame.set(frame, bounds);
    for (const [edge, value] of Object.entries(bounds.margins)) {
      assert(
        value >= MIN_EDGE_PADDING_PX,
        `HEAVY frame ${frame} ${edge} padding should be >= ${MIN_EDGE_PADDING_PX}px, got ${value}px`
      );
    }
    assert(heavy.frameOffsets[frame], `HEAVY frame ${frame} should have a stabilization offset`);
  }

  for (const [state, stateFrames] of Object.entries(heavy.animations)) {
    if (!stateFrames || stateFrames.length < 2) continue;
    const rendered = stateFrames.map((frame) => renderedPoint(boundsByFrame.get(frame), heavy.frameOffsets[frame], heavy.scale));
    const footSpread = spread(rendered.map((point) => point.y));
    const centerSpread = spread(rendered.map((point) => point.x));
    assert(footSpread <= MAX_FOOT_SPREAD_PX, `HEAVY ${state}: foot baseline spread ${footSpread.toFixed(2)}px exceeds ${MAX_FOOT_SPREAD_PX}px`);
    assert(centerSpread <= MAX_CENTER_SPREAD_PX, `HEAVY ${state}: center spread ${centerSpread.toFixed(2)}px exceeds ${MAX_CENTER_SPREAD_PX}px`);
  }

  console.log('Golem padding contract passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
