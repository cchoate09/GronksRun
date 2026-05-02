const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output');
const screenshotPath = path.join(outputDir, 'batch1-mobile-smoke.png');
const reportPath = path.join(outputDir, 'batch1-mobile-smoke.json');
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

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
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

  await page.setViewport({ width: 1280, height: 720, isMobile: true, hasTouch: true });
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

  try {
    await page.setContent(readCommittedWebViewHtml(), { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });
    await page.waitForFunction(() => {
      try {
        return JSON.parse(window.render_game_to_text()).phase === 'PLAYING';
      } catch (error) {
        return false;
      }
    }, { timeout: 10000 });

    const boot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.evaluate(async () => {
      window.postMessage(JSON.stringify({ type: 'joystickMove', x: 1, y: 0 }), '*');
      window.postMessage(JSON.stringify({ type: 'action', name: 'attack' }), '*');
      await new Promise((resolve) => setTimeout(resolve, 0));
      window.advanceTime(250);
    });
    const afterInput = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    nativeMessages.push(...await page.evaluate(() => window.__rnMessages || []));

    await page.screenshot({ path: screenshotPath });

    assert(boot.phase === 'PLAYING', 'expected game to boot into PLAYING');
    assert(boot.player, 'expected player snapshot');
    assert(Array.isArray(boot.enemies), 'expected enemy snapshot');
    assert(afterInput.player.x > boot.player.x, 'expected joystick input to move player right');
    assert(afterInput.player.attacking === true, 'expected attack action to set attacking state');
    assert(nativeMessages.some((message) => message.type === 'gameReady'), 'expected gameReady native bridge message');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('\n')}`);

    const report = { boot, afterInput, nativeMessages, consoleMessages, pageErrors };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Mobile WebView smoke passed. Screenshot: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
})();
