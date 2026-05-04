const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output');
const screenshotPath = path.join(outputDir, 'batch1-mobile-smoke.png');
const reportPath = path.join(outputDir, 'batch1-mobile-smoke.json');
const htmlModulePath = path.join(projectRoot, 'assets', 'gameHtml.js');
const viewportCases = [
  { label: 'standard_landscape', width: 1280, height: 720 },
  { label: 'compact_phone_landscape', width: 844, height: 390 },
  { label: 'portrait_to_compact_landscape', width: 390, height: 844, resizeTo: { width: 844, height: 390 } },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readCommittedWebViewHtml() {
  const moduleSource = fs.readFileSync(htmlModulePath, 'utf8');
  const match = moduleSource.match(/^const html = (.*);\r?\n\r?\nexport default html;\r?\n?$/s);
  if (!match) throw new Error('Could not parse assets/gameHtml.js.');
  return JSON.parse(match[1]);
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
  const reports = [];

  try {
    for (const viewport of viewportCases) {
      const page = await browser.newPage();
      const consoleMessages = [];
      const pageErrors = [];
      const nativeMessages = [];

      page.on('console', (message) => {
        consoleMessages.push({ type: message.type(), text: message.text() });
      });
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      await page.setViewport({ width: viewport.width, height: viewport.height, isMobile: true, hasTouch: true });
      await page.evaluate(() => {
        window.__rnMessages = [];
        window.ReactNativeWebView = {
          postMessage(payload) {
            try {
              window.__rnMessages.push(JSON.parse(payload));
            } catch (error) {
              window.__rnMessages.push({ type: 'invalid_payload', payload: String(payload) });
            }
          },
        };
      });

      await page.setContent(readCommittedWebViewHtml(), { waitUntil: 'load', timeout: 15000 });
      await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });
      const menu = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      assert(menu.phase === 'MENU', `${viewport.label}: expected game to boot into MENU`);
      assert(Array.isArray(menu.levels) && menu.levels.length >= 10, `${viewport.label}: expected at least 10 selectable levels`);
      await page.keyboard.press('Enter');
      await page.evaluate(() => window.advanceTime(100));
      await page.waitForFunction(() => {
        try {
          return JSON.parse(window.render_game_to_text()).phase === 'PLAYING';
        } catch (error) {
          return false;
        }
      }, { timeout: 10000 });

      if (viewport.resizeTo) {
        await page.setViewport({ width: viewport.resizeTo.width, height: viewport.resizeTo.height, isMobile: true, hasTouch: true });
        await page.evaluate(() => {
          window.dispatchEvent(new Event('resize'));
          window.advanceTime(100);
        });
      }

      const boot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      await page.evaluate(async () => {
        window.postMessage(JSON.stringify({ type: 'joystickMove', x: 1, y: 0 }), '*');
        await new Promise((resolve) => setTimeout(resolve, 0));
        window.advanceTime(250);
        window.postMessage(JSON.stringify({ type: 'action', name: 'attack' }), '*');
        await new Promise((resolve) => setTimeout(resolve, 0));
        window.advanceTime(250);
      });
      const afterInput = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      await page.evaluate(async () => {
        window.postMessage(JSON.stringify({ type: 'joystickMove', x: 0, y: -1 }), '*');
        await new Promise((resolve) => setTimeout(resolve, 0));
        window.advanceTime(120);
        window.postMessage(JSON.stringify({ type: 'joystickMove', x: 0, y: 0 }), '*');
      });
      const afterJoystickJump = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      await page.evaluate(async () => {
        window.postMessage(JSON.stringify({ type: 'joystickMove', x: 0, y: 1 }), '*');
        await new Promise((resolve) => setTimeout(resolve, 0));
        window.advanceTime(80);
        window.postMessage(JSON.stringify({ type: 'joystickMove', x: 0, y: 0 }), '*');
      });
      const afterJoystickDown = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      await page.evaluate(() => window.advanceTime(1500));
      const settled = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      nativeMessages.push(...await page.evaluate(() => window.__rnMessages || []));

      const screenshot = viewport.label === 'standard_landscape'
        ? screenshotPath
        : path.join(outputDir, `batch1-mobile-smoke-${viewport.label}.png`);
      await page.screenshot({ path: screenshot });

      assert(boot.phase === 'PLAYING', `${viewport.label}: expected game to boot into PLAYING`);
      assert(boot.player, `${viewport.label}: expected player snapshot`);
      assert(Array.isArray(boot.enemies), `${viewport.label}: expected enemy snapshot`);
      assert(afterInput.player.x > boot.player.x, `${viewport.label}: expected joystick input to move player right`);
      assert(afterInput.player.attackId > boot.player.attackId, `${viewport.label}: expected attack action to increment attack id`);
      assert(afterJoystickJump.player.vy < 0 || afterJoystickJump.player.y < afterInput.player.y, `${viewport.label}: expected joystick up to jump`);
      assert(afterJoystickDown.player.pounding === true, `${viewport.label}: expected joystick down while airborne to start pound`);
      assert(afterInput.player.dashing === false && afterJoystickJump.player.dashing === false, `${viewport.label}: expected dash to be removed from mobile controls`);
      assert(settled.player.onGround === true, `${viewport.label}: expected player to land on ground`);
      const visibleHeight = viewport.resizeTo ? viewport.resizeTo.height : viewport.height;
      assert(settled.player.y + 80 <= visibleHeight, `${viewport.label}: expected player to stay visible after landing`);
      assert(nativeMessages.some((message) => message.type === 'gameReady'), `${viewport.label}: expected gameReady native bridge message`);
      assert(!pageErrors.length, `${viewport.label}: page errors: ${pageErrors.join('\n')}`);

      reports.push({ viewport, menu, boot, afterInput, settled, nativeMessages, consoleMessages, pageErrors, screenshot });
      await page.close();
    }

    fs.writeFileSync(reportPath, JSON.stringify({ reports }, null, 2));
    console.log(`Mobile WebView smoke passed. Screenshot: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
})();
