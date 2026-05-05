const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { launchOptions } = require('./puppeteerLaunchOptions');

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

async function postNativeMessage(page, message, ms = 0) {
  await page.evaluate((payload) => {
    const data = JSON.stringify(payload);
    window.dispatchEvent(new MessageEvent('message', { data }));
    document.dispatchEvent(new MessageEvent('message', { data }));
  }, message);
  if (ms > 0) await page.evaluate((duration) => window.advanceTime(duration), ms);
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch(launchOptions());
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
      await postNativeMessage(page, { type: 'joystickMove', x: 1, y: 0 }, 250);
      await postNativeMessage(page, { type: 'action', name: 'attack' }, 250);
      const afterInput = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      const visibleHeight = viewport.resizeTo ? viewport.resizeTo.height : viewport.height;
      const safeGroundY = Math.min(600, Math.max(220, visibleHeight - 90));
      await postNativeMessage(page, { type: 'joystickMove', x: 0, y: 0 }, 100);
      await postNativeMessage(page, {
        type: 'debugSetPlayer',
        x: 120,
        y: safeGroundY - 40,
        vx: 0,
        vy: 0,
        onGround: true,
      });
      const beforeJump = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      await postNativeMessage(page, { type: 'action', name: 'jump' });
      let afterJump = beforeJump;
      for (let i = 0; i < 12 && !(afterJump.player.vy < 0 || afterJump.player.y < beforeJump.player.y); i++) {
        await page.evaluate(() => window.advanceTime(25));
        afterJump = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      }
      await postNativeMessage(page, { type: 'joystickMove', x: 0, y: 0 }, 20);
      await postNativeMessage(page, {
        type: 'debugSetPlayer',
        x: afterJump.player.x,
        y: Math.max(80, beforeJump.player.y - 96),
        vx: 0,
        vy: -120,
        onGround: false,
      }, 20);
      const beforePound = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
      await postNativeMessage(page, { type: 'joystickMove', x: 0, y: 1 }, 80);
      await postNativeMessage(page, { type: 'joystickMove', x: 0, y: 0 });
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
      assert(beforeJump.player.onGround === true, `${viewport.label}: expected player to be grounded before jump action`);
      assert(afterJump.player.vy < 0 || afterJump.player.y < beforeJump.player.y, `${viewport.label}: expected jump action to launch player upward`);
      assert(
        afterJoystickDown.player.pounding === true || afterJoystickDown.player.vy > 760 || afterJoystickDown.player.y > beforePound.player.y + 8,
        `${viewport.label}: expected joystick down while airborne to start pound`
      );
      assert(afterInput.player.dashing === false && afterJump.player.dashing === false, `${viewport.label}: expected dash to be removed from mobile controls`);
      assert(settled.player.onGround === true, `${viewport.label}: expected player to land on ground`);
      assert(settled.player.y + 80 <= visibleHeight, `${viewport.label}: expected player to stay visible after landing`);
      assert(nativeMessages.some((message) => message.type === 'gameReady'), `${viewport.label}: expected gameReady native bridge message`);
      assert(!pageErrors.length, `${viewport.label}: page errors: ${pageErrors.join('\n')}`);

      reports.push({ viewport, menu, boot, afterInput, beforeJump, afterJump, beforePound, afterJoystickDown, settled, nativeMessages, consoleMessages, pageErrors, screenshot });
      await page.close();
    }

    fs.writeFileSync(reportPath, JSON.stringify({ reports }, null, 2));
    console.log(`Mobile WebView smoke passed. Screenshot: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
})();
