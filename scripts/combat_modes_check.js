const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { launchOptions } = require('./puppeteerLaunchOptions');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output', 'combat-modes');
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

async function postAndAdvance(page, payload, ms = 100) {
  return page.evaluate(({ message, duration }) => {
    const data = JSON.stringify(message);
    window.dispatchEvent(new MessageEvent('message', { data }));
    document.dispatchEvent(new MessageEvent('message', { data }));
    if (duration > 0) window.advanceTime(duration);
    return JSON.parse(window.render_game_to_text());
  }, { message: payload, duration: ms });
}

async function postManyAndAdvance(page, payloads, ms = 100) {
  return page.evaluate(({ messages, duration }) => {
    for (const message of messages) {
      const data = JSON.stringify(message);
      window.dispatchEvent(new MessageEvent('message', { data }));
      document.dispatchEvent(new MessageEvent('message', { data }));
    }
    if (duration > 0) window.advanceTime(duration);
    return JSON.parse(window.render_game_to_text());
  }, { messages: payloads, duration: ms });
}

async function advanceAndRead(page, ms) {
  return page.evaluate((duration) => {
    window.advanceTime(duration);
    return JSON.parse(window.render_game_to_text());
  }, ms);
}

async function advanceUntilMeleeActive(page) {
  return page.evaluate(() => {
    let state = JSON.parse(window.render_game_to_text());
    for (let elapsed = 0; elapsed <= 700; elapsed += 8) {
      if (state.player?.attackPhase === 'ACTIVE') return state;
      window.advanceTime(8);
      state = JSON.parse(window.render_game_to_text());
    }
    return state;
  });
}

async function advanceUntilProjectileVisible(page) {
  return page.evaluate(() => {
    let state = JSON.parse(window.render_game_to_text());
    for (let elapsed = 0; elapsed <= 260; elapsed += 20) {
      if ((state.player_projectiles || []).length > 0) return state;
      window.advanceTime(20);
      state = JSON.parse(window.render_game_to_text());
    }
    return state;
  });
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions());
  } catch (error) {
    if (error && error.code === 'EPERM') {
      runSourceContractCheck();
      return;
    }
    throw error;
  }
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
    await page.evaluate(() => window.advanceTime(150));

    const boot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));

    await page.keyboard.down('ArrowRight');
    const meleeWindup = await postAndAdvance(page, { type: 'action', name: 'attack' }, 40);
    const meleeActive = meleeWindup.player.attackPhase === 'ACTIVE' ? meleeWindup : await advanceUntilMeleeActive(page);
    await page.keyboard.up('ArrowRight');
    await advanceAndRead(page, 450);
    await postAndAdvance(page, { type: 'debugClearEnemies' }, 0);

    const comboStart = await postAndAdvance(page, {
      type: 'debugSetPlayer',
      x: 460,
      y: 520,
      vx: 0,
      vy: 0,
      onGround: true,
      clearHit: true,
    }, 0);
    const jumpAttackStart = await postManyAndAdvance(page, [
      { type: 'joystickMove', x: 1, y: 0 },
      { type: 'action', name: 'jump' },
      { type: 'action', name: 'attack' },
    ], 80);
    const jumpAttackActive = jumpAttackStart.player.attackPhase === 'ACTIVE' ? jumpAttackStart : await advanceUntilMeleeActive(page);
    await postAndAdvance(page, { type: 'joystickMove', x: 0, y: 0 }, 20);

    const beforeRanged = await advanceAndRead(page, 450);
    const rangedFired = await postAndAdvance(page, { type: 'action', name: 'ranged' }, 70);
    const rangedCooldown = await postAndAdvance(page, { type: 'action', name: 'ranged' }, 70);
    let rangedTravel = rangedFired;
    if (rangedTravel.player_projectiles.length === 0) {
      rangedTravel = await advanceUntilProjectileVisible(page);
    }

    await page.screenshot({ path: path.join(outputDir, 'combat-modes.png') });
    const report = { boot, meleeWindup, meleeActive, comboStart, jumpAttackStart, jumpAttackActive, beforeRanged, rangedFired, rangedCooldown, rangedTravel, errors };
    fs.writeFileSync(path.join(outputDir, 'combat-modes.json'), JSON.stringify(report, null, 2));

    assert(meleeWindup.player.attackMode === 'MELEE', 'melee action should mark attack mode as MELEE');
    assert(meleeWindup.player.vx > 0, 'melee wind-up should allow movement to continue');
    assert(meleeActive.player.attackPhase === 'ACTIVE', 'melee action should still expose active strike phase');
    assert(meleeActive.player.slashVisible === true, 'melee active phase should show slash feedback');
    assert(comboStart.player.onGround === true, 'jump/attack combo should begin from a grounded player');
    assert(comboStart.player.attacking === false, 'jump/attack combo should begin after prior melee recovery');
    assert(jumpAttackStart.player.vx > 0, `jump+attack combo should preserve rightward movement, got vx=${jumpAttackStart.player.vx}`);
    assert(jumpAttackStart.player.vy < 0 && jumpAttackStart.player.onGround === false, `jump+attack combo should launch the player, got vy=${jumpAttackStart.player.vy} onGround=${jumpAttackStart.player.onGround}`);
    assert(jumpAttackStart.player.attackMode === 'MELEE', 'jump+attack combo should start melee attack without canceling jump');
    assert(jumpAttackActive.player.attackPhase === 'ACTIVE', 'jump+attack combo should reach active melee phase while airborne/moving');
    assert(jumpAttackActive.player.vx > 0, `jump+attack active phase should keep rightward movement, got vx=${jumpAttackActive.player.vx}`);
    assert(beforeRanged.player.rangedCooldownReady === true, 'ranged attack should be ready before first shot');
    assert(rangedFired.player.attackMode === 'RANGED', 'ranged action should mark attack mode as RANGED');
    assert(rangedFired.player.rangedShotsFired > beforeRanged.player.rangedShotsFired, 'ranged action should fire a player projectile');
    assert(rangedFired.player.rangedCooldownReady === false, 'ranged action should start a cooldown');
    assert(rangedCooldown.player.rangedShotsFired === rangedFired.player.rangedShotsFired, 'ranged attack should not fire again during cooldown');
    assert(rangedTravel.player_projectiles.length > 0, 'player projectile should be visible in game state after firing');
    assert(rangedTravel.player_projectiles[0].x > rangedFired.player.x, 'player projectile should travel forward');
    assert(!errors.length, `page errors: ${errors.join('\n')}`);

    console.log('Combat modes check passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function runSourceContractCheck() {
  const playerSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'entities', 'Player.ts'), 'utf8');
  const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
  const appSource = fs.readFileSync(path.join(projectRoot, 'App.js'), 'utf8');

  assert(playerSource.includes('attackMode'), 'source contract: player snapshot should expose attackMode');
  assert(playerSource.includes('rangedShotsFired'), 'source contract: player should track rangedShotsFired');
  assert(playerSource.includes("actionJustPressed('ranged')"), 'source contract: player should consume ranged action');
  assert(playerSource.indexOf("actionJustPressed('jump')") < playerSource.indexOf("actionJustPressed('attack')"), 'source contract: jump input should be resolved independently before melee input');
  assert(gameSceneSource.includes('playerProjectiles'), 'source contract: scene should manage player ranged projectiles');
  assert(gameSceneSource.includes('player_projectiles'), 'source contract: snapshot should expose player_projectiles');
  assert(appSource.includes("handleAction('ranged')"), 'source contract: native overlay should send ranged action');
  console.log('Combat modes source contract passed. Puppeteer browser launch was blocked by EPERM in this workspace.');
}
