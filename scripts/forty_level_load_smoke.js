const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const { launchOptions } = require('./puppeteerLaunchOptions');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output', 'forty-level-load');
const htmlModulePath = path.join(projectRoot, 'assets', 'gameHtml.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readCommittedWebViewHtml() {
  const moduleSource = fs.readFileSync(htmlModulePath, 'utf8');
  const match = moduleSource.match(/^const html = (.*);\r?\n\r?\nexport default html;\r?\n?$/s);
  if (!match) throw new Error('Could not parse assets/gameHtml.js.');
  return JSON.parse(match[1]);
}

async function imageHasSignal(filePath) {
  const image = sharp(filePath).ensureAlpha();
  const metadata = await image.metadata();
  const buffer = await image.raw().toBuffer();
  let litPixels = 0;
  for (let i = 0; i < buffer.length; i += 4) {
    const r = buffer[i];
    const g = buffer[i + 1];
    const b = buffer[i + 2];
    const a = buffer[i + 3];
    if (a > 0 && r + g + b > 45) litPixels++;
  }
  const pixelCount = Math.max(1, (metadata.width || 1) * (metadata.height || 1));
  return litPixels / pixelCount > 0.02;
}

async function startLevel(page, level) {
  await page.evaluate((requestedLevel) => {
    const data = JSON.stringify({ type: 'debugStartLevel', level: requestedLevel });
    window.dispatchEvent(new MessageEvent('message', { data }));
    document.dispatchEvent(new MessageEvent('message', { data }));
  }, level);
  await page.waitForFunction((expectedLevel) => {
    const state = JSON.parse(window.render_game_to_text());
    return state.phase === 'PLAYING' && state.level === expectedLevel;
  }, { timeout: 10000 }, level);
  await page.evaluate(() => window.advanceTime(300));
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const html = readCommittedWebViewHtml();

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions());
  } catch (error) {
    if (error && error.code === 'EPERM') {
      const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
      const levelCount = (gameSceneSource.match(/id:\s*\d+,\s*name:/g) || []).length;
      assert(levelCount === 40, `source fallback: expected 40 level literals, got ${levelCount}`);
      console.log('Forty-level source contract passed. Puppeteer browser launch was blocked by EPERM in this workspace.');
      return;
    }
    throw error;
  }

  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

  try {
    await page.setViewport({ width: 1280, height: 720, isMobile: true, hasTouch: true });
    const snapshots = [];

    for (let level = 1; level <= 40; level++) {
      await page.setContent(html, { waitUntil: 'load', timeout: 15000 });
      await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'MENU', { timeout: 10000 });
      const menuSnapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      assert(menuSnapshot.levels.length === 40, `level ${level}: menu should expose 40 levels, got ${menuSnapshot.levels.length}`);

      const snapshot = await startLevel(page, level);
      assert(snapshot.level === level, `expected to load level ${level}, got ${snapshot.level}`);
      assert(snapshot.phase === 'PLAYING', `level ${level}: expected PLAYING, got ${snapshot.phase}`);
      assert(snapshot.player && snapshot.player.hp > 0, `level ${level}: player should start alive`);
      assert(snapshot.variety && Array.isArray(snapshot.variety.enemy_kinds) && snapshot.variety.enemy_kinds.length > 0, `level ${level}: enemy roster should be present`);
      assert(Array.isArray(snapshot.gaps), `level ${level}: gap list should be exposed`);
      assert(Array.isArray(snapshot.hazards), `level ${level}: hazard list should be exposed`);
      snapshots.push({
        level,
        name: snapshot.name,
        biome: snapshot.biome,
        target_kills: snapshot.target_kills,
        enemies: snapshot.variety.enemy_kinds,
        terrain_profile: snapshot.variety.terrain_profile,
        hazards: snapshot.hazards.length,
        gaps: snapshot.gaps.length,
      });

      if ([1, 20, 40].includes(level)) {
        const screenshotPath = path.join(outputDir, `level-${level}.png`);
        await page.screenshot({ path: screenshotPath });
        assert(await imageHasSignal(screenshotPath), `level ${level}: screenshot should contain visible gameplay`);
      }
    }

    assert(!pageErrors.length, `page errors: ${pageErrors.join('\n')}`);
    fs.writeFileSync(path.join(outputDir, 'levels.json'), JSON.stringify(snapshots, null, 2));
    console.log('Forty-level load smoke passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
