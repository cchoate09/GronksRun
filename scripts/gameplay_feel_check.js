const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output', 'gameplay-feel');
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

async function post(page, payload, ms = 100) {
  await page.evaluate((message) => window.postMessage(JSON.stringify(message), '*'), payload);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await page.evaluate((duration) => window.advanceTime(duration), ms);
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];

  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.setViewport({ width: 1280, height: 720, isMobile: true, hasTouch: true });
    await page.setContent(readCommittedWebViewHtml(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'PLAYING', { timeout: 10000 });
    await page.evaluate(() => window.advanceTime(100));

    const boot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.keyboard.down('ArrowRight');
    await page.evaluate(() => window.advanceTime(100));
    const earlyMove = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.evaluate(() => window.advanceTime(500));
    const sustainedMove = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.keyboard.up('ArrowRight');
    await page.evaluate(() => window.advanceTime(250));
    const decelerated = await page.evaluate(() => JSON.parse(window.render_game_to_text()));

    const beforeAttack = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await post(page, { type: 'action', name: 'attack' }, 35);
    const windup = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.evaluate(() => window.advanceTime(90));
    const active = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.evaluate(() => window.advanceTime(360));
    const recovered = await page.evaluate(() => JSON.parse(window.render_game_to_text()));

    await page.screenshot({ path: path.join(outputDir, 'gameplay-feel.png') });

    const report = { boot, earlyMove, sustainedMove, decelerated, beforeAttack, windup, active, recovered, errors };
    fs.writeFileSync(path.join(outputDir, 'gameplay-feel.json'), JSON.stringify(report, null, 2));

    assert(boot.enemies[0].x - boot.player.x >= 620, 'first enemy should start after a real run-up segment');
    assert(earlyMove.player.vx > 0 && earlyMove.player.vx < sustainedMove.player.vx, 'horizontal movement should accelerate instead of snapping to top speed');
    assert(Math.abs(decelerated.player.vx) < Math.abs(sustainedMove.player.vx), 'horizontal movement should decelerate after release');
    assert(windup.player.attackPhase === 'WINDUP', 'attack should expose a wind-up phase');
    assert(windup.enemies[0].hp === beforeAttack.enemies[0].hp, 'attack should not damage during wind-up');
    assert(active.player.attackPhase === 'ACTIVE', 'attack should expose an active strike phase');
    assert(active.player.slashVisible === true, 'active strike should show a slash indicator');
    assert(recovered.player.attackPhase === 'NONE', 'attack should return to neutral after recovery');
    assert(!errors.length, `page errors: ${errors.join('\n')}`);

    console.log('Gameplay feel check passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
