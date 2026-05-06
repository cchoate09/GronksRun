const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');

const paths = {
  menuHero: path.join(projectRoot, 'assets', 'backgrounds', 'main-menu-hero.png'),
  heroAtlas: path.join(projectRoot, 'assets', 'spritesheets', 'openai', 'hero-arcade.png'),
  enemyCoreAtlas: path.join(projectRoot, 'assets', 'spritesheets', 'openai', 'enemies-core.png'),
  obstacleAtlas: path.join(projectRoot, 'assets', 'spritesheets', 'openai', 'obstacles.png'),
  storeDir: path.join(projectRoot, 'store_assets'),
};

const screenshotSources = {
  gameplay: [
    'output/polish-pass/polish-gameplay.png',
    'output/full-art-roster/level-10-roster.png',
    'output/web-game-current-objective/shot-0.png',
  ],
  characters: [
    'output/polish-pass/armory-upgrade.png',
    'output/sprite-animation/player-run-ranged.png',
    'output/polish-pass/main-menu-uplift.png',
  ],
  levelmap: [
    'output/polish-pass/main-menu-uplift.png',
    'output/forty-level-load/level-40.png',
    'output/ui-final/level-select.png',
  ],
  bossfight: [
    'output/arcade-gauntlet/near-gap.png',
    'output/full-art-roster/level-10-roster.png',
    'output/arcade-gauntlet/trap-contact.png',
  ],
};

function requireFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Required source image is missing: ${file}`);
  }
}

function firstExisting(candidates) {
  const found = candidates.map((candidate) => path.join(projectRoot, candidate)).find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`No screenshot source found. Checked: ${candidates.join(', ')}`);
  }
  return found;
}

function xml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svg(width, height, body) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
}

async function coverBuffer(input, width, height) {
  return sharp(input)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .png()
    .toBuffer();
}

async function alphaBounds(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let pixels = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      if (data[idx + 3] <= 10) continue;
      pixels++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!pixels) throw new Error('No visible alpha pixels found while trimming atlas frame.');
  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function atlasFrame(input, cols, rows, frame, maxWidth, maxHeight) {
  const metadata = await sharp(input).metadata();
  const frameW = metadata.width / cols;
  const frameH = metadata.height / rows;
  const col = frame % cols;
  const row = Math.floor(frame / cols);
  const extracted = await sharp(input)
    .extract({ left: col * frameW, top: row * frameH, width: frameW, height: frameH })
    .png()
    .toBuffer();
  const bounds = await alphaBounds(extracted);
  return sharp(extracted)
    .extract({ left: bounds.minX, top: bounds.minY, width: bounds.width, height: bounds.height })
    .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
}

async function framedShot(input, width, height) {
  const shot = await sharp(input)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 1.04, saturation: 1.1 })
    .png()
    .toBuffer();
  const border = svg(width + 24, height + 24, `
    <rect x="2" y="2" width="${width + 20}" height="${height + 20}" rx="34" fill="#07111f" opacity="0.88"/>
    <rect x="10" y="10" width="${width + 4}" height="${height + 4}" rx="28" fill="#38bdf8" opacity="0.35"/>
  `);
  return sharp(border)
    .composite([{ input: shot, left: 12, top: 12 }])
    .png()
    .toBuffer();
}

async function phoneScreenshot(output, title, subtitle, source, accent = '#67e8f9') {
  const width = 1080;
  const height = 1920;
  const bg = await coverBuffer(paths.menuHero, width, height);
  const shot = await framedShot(source, 960, 540);
  const hero = await atlasFrame(paths.heroAtlas, 4, 4, 5, 330, 330);
  const golem = await atlasFrame(paths.enemyCoreAtlas, 4, 4, 8, 350, 320);
  const rune = await atlasFrame(paths.obstacleAtlas, 4, 3, 10, 140, 140);
  const overlay = svg(width, height, `
    <rect width="1080" height="1920" fill="#030712" opacity="0.56"/>
    <rect x="0" y="0" width="1080" height="520" fill="#07111f" opacity="0.78"/>
    <rect x="46" y="90" width="988" height="304" rx="42" fill="#081827" opacity="0.78"/>
    <rect x="46" y="90" width="988" height="304" rx="42" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="4"/>
    <text x="540" y="204" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="58" fill="#ffffff" letter-spacing="0">${xml(title)}</text>
    <text x="540" y="284" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="38" fill="${accent}" letter-spacing="0">${xml(subtitle)}</text>
    <rect x="54" y="446" width="972" height="4" fill="${accent}" opacity="0.62"/>
    <rect x="70" y="1138" width="940" height="272" rx="38" fill="#07111f" opacity="0.78"/>
    <text x="540" y="1240" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="42" fill="#ffffff" letter-spacing="0">40 LEVELS OF RUNNING COMBAT</text>
    <text x="540" y="1305" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="32" fill="#fde68a" letter-spacing="0">Jump gaps, strike enemies, dodge rune traps</text>
  `);

  await sharp(bg)
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: shot, left: 48, top: 520 },
      { input: hero, left: 104, top: 1455 },
      { input: golem, left: 610, top: 1438 },
      { input: rune, left: 462, top: 1518 },
    ])
    .png()
    .toFile(output);
}

async function featureGraphic() {
  const width = 1024;
  const height = 500;
  const bg = await coverBuffer(paths.menuHero, width, height);
  const hero = await atlasFrame(paths.heroAtlas, 4, 4, 5, 260, 260);
  const golem = await atlasFrame(paths.enemyCoreAtlas, 4, 4, 8, 270, 250);
  const textLayer = svg(width, height, `
    <rect width="1024" height="500" fill="#020617" opacity="0.34"/>
    <rect x="0" y="0" width="1024" height="500" fill="url(#fade)" opacity="1"/>
    <defs>
      <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#020617" stop-opacity="0.85"/>
        <stop offset="0.55" stop-color="#020617" stop-opacity="0.28"/>
        <stop offset="1" stop-color="#020617" stop-opacity="0.68"/>
      </linearGradient>
    </defs>
    <text x="72" y="170" font-family="Arial, sans-serif" font-weight="900" font-size="76" fill="#ffffff" letter-spacing="0">GRONK'S RUN</text>
    <text x="78" y="232" font-family="Arial, sans-serif" font-weight="900" font-size="34" fill="#7dd3fc" letter-spacing="0">RUN. JUMP. STRIKE.</text>
    <rect x="78" y="260" width="470" height="5" fill="#fde68a"/>
    <text x="78" y="328" font-family="Arial, sans-serif" font-weight="800" font-size="24" fill="#ffffff" opacity="0.94" letter-spacing="0">Fantasy levels, traps, bosses, and upgrades</text>
  `);

  await sharp(bg)
    .composite([
      { input: textLayer, left: 0, top: 0 },
      { input: hero, left: 575, top: 206 },
      { input: golem, left: 774, top: 204 },
    ])
    .png()
    .toFile(path.join(paths.storeDir, 'feature-graphic-1024x500.png'));
}

async function iconSet() {
  const bg512 = await coverBuffer(paths.menuHero, 512, 512);
  const bg1024 = await coverBuffer(paths.menuHero, 1024, 1024);
  const hero512 = await atlasFrame(paths.heroAtlas, 4, 4, 5, 360, 360);
  const hero1024 = await atlasFrame(paths.heroAtlas, 4, 4, 5, 720, 720);
  const glow512 = svg(512, 512, `
    <rect width="512" height="512" rx="112" fill="#020617" opacity="0.18"/>
    <circle cx="262" cy="254" r="190" fill="#38bdf8" opacity="0.24"/>
    <circle cx="270" cy="274" r="138" fill="#fde68a" opacity="0.18"/>
  `);
  const icon512 = await sharp(bg512)
    .composite([
      { input: svg(512, 512, '<rect width="512" height="512" fill="#020617" opacity="0.42"/>'), left: 0, top: 0 },
      { input: glow512, left: 0, top: 0 },
      { input: hero512, left: 86, top: 104 },
    ])
    .png()
    .toBuffer();

  await sharp(icon512).toFile(path.join(paths.storeDir, 'app-icon-512.png'));
  await sharp(bg1024)
    .composite([
      { input: svg(1024, 1024, '<rect width="1024" height="1024" fill="#020617" opacity="0.42"/><circle cx="524" cy="512" r="380" fill="#38bdf8" opacity="0.24"/><circle cx="540" cy="548" r="276" fill="#fde68a" opacity="0.18"/>'), left: 0, top: 0 },
      { input: hero1024, left: 172, top: 208 },
    ])
    .flatten({ background: '#061426' })
    .png()
    .toFile(path.join(projectRoot, 'assets', 'icon.png'));

  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: hero1024, left: 152, top: 226 }])
    .png()
    .toFile(path.join(projectRoot, 'assets', 'splash-icon.png'));

  await sharp(icon512).resize(48, 48).png().toFile(path.join(projectRoot, 'assets', 'favicon.png'));
  await sharp(icon512).resize(512, 512).png().toFile(path.join(projectRoot, 'assets', 'android-icon-background.png'));
  await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: hero512, left: 74, top: 98 }])
    .png()
    .toFile(path.join(projectRoot, 'assets', 'android-icon-foreground.png'));
  const mono = await sharp(hero512)
    .ensureAlpha()
    .removeAlpha()
    .threshold(48)
    .negate()
    .resize(432, 432, { fit: 'inside' })
    .png()
    .toBuffer();
  await sharp({ create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mono, left: 1, top: 0 }])
    .png()
    .toFile(path.join(projectRoot, 'assets', 'android-icon-monochrome.png'));
}

(async () => {
  fs.mkdirSync(paths.storeDir, { recursive: true });
  for (const file of [paths.menuHero, paths.heroAtlas, paths.enemyCoreAtlas, paths.obstacleAtlas]) requireFile(file);

  await phoneScreenshot(
    path.join(paths.storeDir, 'screenshot-1-gameplay.png'),
    'ARCADE RUNNING COMBAT',
    'Dash through Sky Forge battles',
    firstExisting(screenshotSources.gameplay),
    '#67e8f9'
  );
  await phoneScreenshot(
    path.join(paths.storeDir, 'screenshot-2-characters.png'),
    'UPGRADE YOUR HERO',
    'Spend gems on melee and ranged power',
    firstExisting(screenshotSources.characters),
    '#fde68a'
  );
  await phoneScreenshot(
    path.join(paths.storeDir, 'screenshot-3-levelmap.png'),
    'CHOOSE YOUR CHALLENGE',
    'Campaign levels, endless runs, and armory upgrades',
    firstExisting(screenshotSources.levelmap),
    '#86efac'
  );
  await phoneScreenshot(
    path.join(paths.storeDir, 'screenshot-4-bossfight.png'),
    'BOSS TRAPS AND ENEMIES',
    'Gaps, rune traps, flyers, casters, and heavy golems',
    firstExisting(screenshotSources.bossfight),
    '#fca5a5'
  );
  await featureGraphic();
  await iconSet();

  const outputs = [
    'store_assets/app-icon-512.png',
    'store_assets/feature-graphic-1024x500.png',
    'store_assets/screenshot-1-gameplay.png',
    'store_assets/screenshot-2-characters.png',
    'store_assets/screenshot-3-levelmap.png',
    'store_assets/screenshot-4-bossfight.png',
    'assets/icon.png',
    'assets/splash-icon.png',
    'assets/favicon.png',
    'assets/android-icon-foreground.png',
    'assets/android-icon-background.png',
    'assets/android-icon-monochrome.png',
  ];
  for (const output of outputs) {
    const metadata = await sharp(path.join(projectRoot, output)).metadata();
    console.log(`${output}: ${metadata.width}x${metadata.height}`);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
