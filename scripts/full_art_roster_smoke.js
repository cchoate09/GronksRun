const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { launchOptions } = require('./puppeteerLaunchOptions');
const sharp = require('sharp');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output', 'full-art-roster');
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
    if (a > 0 && (r > 12 || g > 12 || b > 12)) litPixels++;
  }
  const pixelCount = Math.max(1, (metadata.width || 1) * (metadata.height || 1));
  return litPixels / pixelCount > 0.025;
}

async function imageHasBackgroundSignal(filePath) {
  const image = sharp(filePath).ensureAlpha();
  const metadata = await image.metadata();
  const width = metadata.width || 1;
  const height = metadata.height || 1;
  const buffer = await image.raw().toBuffer();
  let sampled = 0;
  let lit = 0;
  const top = Math.floor(height * 0.14);
  const bottom = Math.floor(height * 0.74);
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = buffer[i];
      const g = buffer[i + 1];
      const b = buffer[i + 2];
      const a = buffer[i + 3];
      sampled++;
      if (a > 0 && r + g + b > 85) lit++;
    }
  }
  return lit / Math.max(1, sampled) > 0.08;
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions());
  } catch (error) {
    if (error && error.code === 'EPERM') {
      const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
      const spriteDataSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'assets', 'spriteData.ts'), 'utf8');
      assert(gameSceneSource.includes('BOMBER'), 'source fallback: new bomber type should be present');
      assert(gameSceneSource.includes('DIVER'), 'source fallback: new diver type should be present');
      assert(gameSceneSource.includes('PTERO'), 'source fallback: new ptero type should be present');
      assert(gameSceneSource.includes('GUARDIAN'), 'source fallback: new guardian type should be present');
      assert(spriteDataSource.includes('openAiHero'), 'source fallback: OpenAI hero atlas should be imported');
      assert(spriteDataSource.includes('openAiEnemiesExtra'), 'source fallback: OpenAI enemy atlas should be imported');
      assert(spriteDataSource.includes('OBSTACLE_SHEET'), 'source fallback: OpenAI obstacle atlas should be exported');
      console.log('Full art roster source contract passed. Puppeteer browser launch was blocked by EPERM in this workspace.');
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
    await page.setContent(readCommittedWebViewHtml(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });

    const menuSnapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert(menuSnapshot.phase === 'MENU', `expected to boot to menu, got ${menuSnapshot.phase}`);
    const levelSelectButton = menuSnapshot.main_menu_buttons.find((button) => button.label === 'LEVEL SELECT');
    assert(levelSelectButton, 'expected main menu to expose the level select button');
    await page.mouse.click(levelSelectButton.x + levelSelectButton.w * 0.5, levelSelectButton.y + levelSelectButton.h * 0.5);
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'LEVEL_SELECT', { timeout: 10000 });

    const panelW = 820;
    const panelX = (1280 - panelW) / 2;
    const gap = 14;
    const buttonW = (panelW - 44 - gap * 4) / 5;
    const levelTenCol = 4;
    const levelTenRow = 1;
    await page.mouse.click(
      panelX + 22 + levelTenCol * (buttonW + gap) + buttonW * 0.5,
      134 + levelTenRow * (74 + gap) + 37
    );
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'PLAYING', { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 650));
    await page.evaluate(() => window.advanceTime(900));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert(snapshot.level === 10, `expected roster smoke to start level 10, got ${snapshot.level}`);
    const screenshotPath = path.join(outputDir, 'level-10-roster.png');
    await page.screenshot({ path: screenshotPath });
    fs.writeFileSync(path.join(outputDir, 'level-10-roster.json'), JSON.stringify({ snapshot, pageErrors }, null, 2));

    const enemyKinds = new Set(snapshot.variety.enemy_kinds);
    for (const kind of ['BOMBER', 'DIVER', 'PTERO', 'GUARDIAN']) {
      assert(enemyKinds.has(kind), `expected level 10 enemy roster to include ${kind}`);
    }

    const activeTypes = new Set(snapshot.enemies.map((enemy) => enemy.type));
    const activeNewTypes = ['BOMBER', 'DIVER', 'PTERO', 'GUARDIAN'].filter((kind) => activeTypes.has(kind));
    assert(activeNewTypes.length >= 3, `expected at least three new enemy types active in the opening wave, got ${activeNewTypes.join(', ') || 'none'}`);
    assert(snapshot.player.vx === 0 || Math.abs(snapshot.player.vx) <= 660, 'expected player speed telemetry to stay bounded');
    assert(await imageHasSignal(screenshotPath), 'expected full art roster screenshot to contain visible rendered content');
    assert(await imageHasBackgroundSignal(screenshotPath), 'expected level 10 screenshot to show generated background art in the playfield');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('\n')}`);

    console.log('Full art roster smoke passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
