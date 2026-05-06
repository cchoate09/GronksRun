const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = process.cwd();
const SPIKE_FRAMES = [0, 1, 2, 3];
const MIN_EDGE_PADDING_PX = 8;
const MIN_VISIBLE_PIXELS = 6000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function frameBounds(image, cols, rows, frame) {
  const metadata = await sharp(image).metadata();
  const frameW = metadata.width / cols;
  const frameH = metadata.height / rows;
  assert(Number.isInteger(frameW) && Number.isInteger(frameH), 'obstacle atlas grid should divide image dimensions');

  const col = frame % cols;
  const row = Math.floor(frame / cols);
  const { data } = await sharp(image)
    .extract({ left: col * frameW, top: row * frameH, width: frameW, height: frameH })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = frameW;
  let minY = frameH;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;

  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      const idx = (y * frameW + x) * 4;
      if (data[idx + 3] <= 10) continue;
      pixels++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  assert(pixels >= MIN_VISIBLE_PIXELS, `spike frame ${frame} should contain visible spike art, got ${pixels} pixels`);
  return {
    frame,
    margins: {
      left: minX,
      top: minY,
      right: frameW - 1 - maxX,
      bottom: frameH - 1 - maxY,
    },
  };
}

(async () => {
  const image = path.join(projectRoot, 'assets', 'spritesheets', 'openai', 'obstacles.png');
  assert(fs.existsSync(image), `obstacle atlas should exist: ${image}`);

  for (const frame of SPIKE_FRAMES) {
    const bounds = await frameBounds(image, 4, 3, frame);
    for (const [edge, value] of Object.entries(bounds.margins)) {
      assert(
        value >= MIN_EDGE_PADDING_PX,
        `spike frame ${frame} ${edge} padding should be >= ${MIN_EDGE_PADDING_PX}px, got ${value}px`
      );
    }
  }

  console.log('Obstacle spike frame contract passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
