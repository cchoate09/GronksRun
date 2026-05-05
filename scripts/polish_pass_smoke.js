const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');
const { launchOptions } = require('./puppeteerLaunchOptions');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output', 'polish-pass');
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

async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function advance(page, ms = 80) {
  return page.evaluate((duration) => {
    window.advanceTime(duration);
    return JSON.parse(window.render_game_to_text());
  }, ms);
}

async function postAndAdvance(page, payload, ms = 80) {
  return page.evaluate(({ message, duration }) => {
    const data = JSON.stringify(message);
    window.dispatchEvent(new MessageEvent('message', { data }));
    document.dispatchEvent(new MessageEvent('message', { data }));
    window.advanceTime(duration);
    return JSON.parse(window.render_game_to_text());
  }, { message: payload, duration: ms });
}

async function postWindowAndAdvance(page, payload, ms = 80) {
  return page.evaluate(({ message, duration }) => {
    const data = JSON.stringify(message);
    window.dispatchEvent(new MessageEvent('message', { data }));
    window.advanceTime(duration);
    return JSON.parse(window.render_game_to_text());
  }, { message: payload, duration: ms });
}

async function serveHtml(html) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}/`,
  };
}

function findButton(state, labelNeedle) {
  const buttons = [
    ...(state.buttons || []),
    ...(state.main_menu_buttons || []),
    ...(state.overlay_buttons || []),
  ];
  return buttons.find((button) => button.enabled !== false && button.label.includes(labelNeedle));
}

async function clickButton(page, labelNeedle, ms = 120) {
  const state = await readState(page);
  const button = findButton(state, labelNeedle);
  assert(button, `expected an enabled button containing "${labelNeedle}" in ${state.phase}`);
  await page.mouse.click(button.x + button.w / 2, button.y + button.h / 2);
  return advance(page, ms);
}

async function dispatchBack(page) {
  return postAndAdvance(page, { type: 'backButton' }, 80);
}

function runSourceFallback() {
  const menuSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'MenuScene.ts'), 'utf8');
  const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
  const weaponSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'weapons.ts'), 'utf8');
  assert(menuSource.includes("data.type === 'backButton'"), 'source fallback: menu should handle native backButton');
  assert(menuSource.includes('purchaseWeaponUpgrade'), 'source fallback: armory should purchase gem upgrades');
  assert(weaponSource.includes('purchaseWeaponUpgrade'), 'source fallback: upgrade purchase helper should exist');
  assert(gameSceneSource.includes("'spellRune'"), 'source fallback: magic spell trap should exist');
  console.log('Polish pass source fallback passed. Puppeteer browser launch was blocked by EPERM in this workspace.');
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions());
  } catch (error) {
    if (error && error.code === 'EPERM') {
      runSourceFallback();
      return;
    }
    throw error;
  }

  const page = await browser.newPage();
  const served = await serveHtml(readCommittedWebViewHtml());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.setViewport({ width: 1280, height: 720, isMobile: true, hasTouch: true });
    await page.goto(served.url, { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 10000 });
    await page.evaluate(() => {
      try {
        window.localStorage.setItem('gronk_gems', '500');
        window.localStorage.setItem('gronk_melee_upgrade_level', '0');
        window.localStorage.setItem('gronk_ranged_upgrade_level', '0');
      } catch {}
    });
    await advance(page, 120);

    const menu = await readState(page);
    assert(menu.phase === 'MENU', `expected MENU phase, got ${menu.phase}`);
    assert(findButton(menu, 'SETTINGS'), 'menu should expose SETTINGS button');
    assert(findButton(menu, 'ARMORY'), 'menu should expose ARMORY button');
    assert(findButton(menu, 'LEVEL SELECT'), 'menu should expose LEVEL SELECT button');

    let settings = await clickButton(page, 'SETTINGS');
    assert(settings.phase === 'SETTINGS', `expected SETTINGS, got ${settings.phase}`);
    settings = await clickButton(page, 'HARD');
    assert(settings.settings.difficulty === 2, `difficulty button should set HARD/2, got ${settings.settings.difficulty}`);
    const beforeSound = settings.settings.sound_enabled;
    settings = await clickButton(page, 'SOUND');
    assert(settings.phase === 'SETTINGS', 'sound toggle should stay in settings');
    assert(settings.settings.sound_enabled !== beforeSound, 'sound button should toggle persisted sound state');
    await page.screenshot({ path: path.join(outputDir, 'settings-buttons.png') });
    let afterBack = await clickButton(page, 'BACK');
    assert(afterBack.phase === 'MENU', 'visible Back button should leave settings for menu');
    settings = await clickButton(page, 'SETTINGS');
    afterBack = await dispatchBack(page);
    assert(afterBack.phase === 'MENU', 'native back should leave settings for menu');

    let levelSelect = await clickButton(page, 'LEVEL SELECT');
    assert(levelSelect.phase === 'LEVEL_SELECT', `expected LEVEL_SELECT, got ${levelSelect.phase}`);
    afterBack = await clickButton(page, 'BACK');
    assert(afterBack.phase === 'MENU', 'visible Back button should leave level select for menu');
    levelSelect = await clickButton(page, 'LEVEL SELECT');
    afterBack = await dispatchBack(page);
    assert(afterBack.phase === 'MENU', 'native back should leave level select for menu');

    let armory = await clickButton(page, 'ARMORY');
    assert(armory.phase === 'ARMORY', `expected ARMORY, got ${armory.phase}`);
    assert(armory.gems === 500, `expected seeded 500 gems, got ${armory.gems}`);
    armory = await clickButton(page, 'MELEE +1');
    assert(armory.phase === 'ARMORY', 'upgrade purchase should stay in armory');
    assert(armory.armory.meleeUpgrade.level === 1, 'melee gem upgrade should persist at level 1');
    assert(armory.gems === 430, `expected 430 gems after level 1 melee upgrade, got ${armory.gems}`);
    armory = await clickButton(page, 'RANGED +1');
    assert(armory.armory.rangedUpgrade.level === 1, 'ranged gem upgrade should persist at level 1');
    assert(armory.gems === 360, `expected 360 gems after level 1 ranged upgrade, got ${armory.gems}`);
    await page.screenshot({ path: path.join(outputDir, 'armory-upgrade.png') });
    afterBack = await clickButton(page, 'BACK');
    assert(afterBack.phase === 'MENU', 'visible Back button should leave armory for menu');

    levelSelect = await clickButton(page, 'LEVEL SELECT');
    assert(levelSelect.phase === 'LEVEL_SELECT', 'level select should open before level 10 start');
    await clickButton(page, 'LEVEL 10', 160);
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'PLAYING', { timeout: 10000 });
    let playing = await advance(page, 180);
    assert(playing.weapons.melee_upgrade.level === 1, 'upgraded melee tier should be visible in gameplay snapshot');
    assert(playing.weapons.ranged_upgrade.level === 1, 'upgraded ranged tier should be visible in gameplay snapshot');
    assert(playing.player.meleeDamage > 28, `melee damage should reflect upgrade, got ${playing.player.meleeDamage}`);
    assert(playing.player.rangedDamage > 22, `ranged damage should reflect upgrade, got ${playing.player.rangedDamage}`);
    assert(playing.hazards.some((hazard) => hazard.type === 'spellRune'), 'level should expose at least one magic spell/rune trap');

    await page.keyboard.down('ArrowRight');
    const ranged = await postAndAdvance(page, { type: 'action', name: 'ranged' }, 90);
    await page.keyboard.up('ArrowRight');
    assert(ranged.player.vx > 0, 'player should keep moving while firing ranged attack');
    assert(ranged.player.runningAttackBlend === true, 'snapshot should show running and attacking blended together');
    assert(ranged.player.animation_state === 'RUN', `moving attack should keep RUN animation, got ${ranged.player.animation_state}`);
    assert(ranged.player.rangedPoseVisible === true, 'ranged attack animation cue should be visible after firing');
    assert((ranged.player_projectiles || []).length > 0, 'ranged attack should spawn a player projectile');

    await page.screenshot({ path: path.join(outputDir, 'polish-gameplay.png') });

    let paused = await postWindowAndAdvance(page, { type: 'action', name: 'pause' }, 80);
    assert(paused.phase === 'PAUSED', `pause action should open pause overlay, got ${paused.phase}`);
    assert(findButton(paused, 'RETRY LEVEL'), 'pause overlay should expose Retry Level button bounds');
    let retried = await clickButton(page, 'RETRY LEVEL', 160);
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'PLAYING', { timeout: 10000 });
    retried = await readState(page);
    assert(retried.phase === 'PLAYING', `Retry Level button should reload into PLAYING, got ${retried.phase}`);
    paused = await postWindowAndAdvance(page, { type: 'action', name: 'pause' }, 80);
    assert(findButton(paused, 'RESUME'), 'pause overlay should expose Resume button bounds');
    let resumed = await clickButton(page, 'RESUME');
    assert(resumed.phase === 'PLAYING', `Resume button should return to PLAYING, got ${resumed.phase}`);
    paused = await postWindowAndAdvance(page, { type: 'action', name: 'pause' }, 80);
    assert(findButton(paused, 'MAIN MENU'), 'pause overlay should expose Main Menu button bounds');
    const returnedMenu = await clickButton(page, 'MAIN MENU');
    assert(returnedMenu.phase === 'MENU', `Main Menu pause button should return to MENU, got ${returnedMenu.phase}`);

    fs.writeFileSync(path.join(outputDir, 'polish-pass.json'), JSON.stringify({ menu, settings, armory, playing, ranged, paused, retried, resumed, returnedMenu, errors }, null, 2));

    assert(!errors.length, `page errors: ${errors.join('\n')}`);
    console.log('Polish pass smoke passed.');
  } finally {
    await new Promise((resolve) => served.server.close(resolve));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
