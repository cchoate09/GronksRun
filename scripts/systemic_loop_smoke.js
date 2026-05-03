const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output', 'systemic-loop');
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
    await page.keyboard.press('Enter');
    const result = await page.evaluate(() => {
      const snapshots = [];
      snapshots.push(JSON.parse(window.render_game_to_text()));
      return new Promise((resolve) => {
        setTimeout(() => {
          window.advanceTime(100);
          snapshots.push(JSON.parse(window.render_game_to_text()));
          window.advanceTime(1200);
          snapshots.push(JSON.parse(window.render_game_to_text()));
          window.postMessage(JSON.stringify({ type: 'joystickMove', x: 1, y: 0 }), '*');
          window.postMessage(JSON.stringify({ type: 'action', name: 'jump' }), '*');
          setTimeout(() => {
            window.advanceTime(350);
            snapshots.push(JSON.parse(window.render_game_to_text()));
            resolve(snapshots);
          }, 0);
        }, 0);
      });
    });

    await page.screenshot({ path: path.join(outputDir, 'systemic-loop-smoke.png') });

    const [boot, afterStart, stepped, afterInput] = result;
    const menu = menuSnapshot;
    assert(menu.phase === 'MENU', 'expected MENU phase at boot');
    assert(Array.isArray(menu.levels) && menu.levels.length >= 10, 'expected at least 10 selectable levels');
    assert(boot.phase === 'PLAYING', 'expected PLAYING phase after start action');
    assert(afterStart.player.y >= boot.player.y, 'expected gravity/physics to advance after stepping time');
    assert(stepped.player.onGround === true, 'expected player to be grounded before jump input');
    assert(afterInput.player.x > stepped.player.x, 'expected joystick movement after input');
    assert(afterInput.player.vy < 0 || afterInput.player.y < stepped.player.y, 'expected jump input to affect vertical motion');
    assert(!pageErrors.length, `page errors: ${pageErrors.join('\n')}`);

    fs.writeFileSync(path.join(outputDir, 'systemic-loop-smoke.json'), JSON.stringify({ menu, boot, afterStart, stepped, afterInput }, null, 2));
    console.log('Systemic loop smoke passed.');
  } finally {
    await browser.close();
  }
})();
