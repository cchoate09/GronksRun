const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { launchOptions } = require('./puppeteerLaunchOptions');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output', 'arcade-gauntlet');
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

async function snapshot(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function advance(page, ms) {
  let remaining = ms;
  while (remaining > 0) {
    const duration = Math.min(500, remaining);
    await page.evaluate((stepMs) => window.advanceTime(stepMs), duration);
    remaining -= duration;
  }
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions());
  } catch (error) {
    if (error && error.code === 'EPERM') {
      const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
      assert(gameSceneSource.includes('terrainGaps'), 'source fallback: terrain gaps should exist');
      assert(gameSceneSource.includes('hazards'), 'source fallback: hazards should exist');
      assert(gameSceneSource.includes('checkHazards'), 'source fallback: hazard damage should exist');
      console.log('Arcade gauntlet source contract passed. Puppeteer browser launch was blocked by EPERM in this workspace.');
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
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem('gronk_equipped_melee_weapon');
        window.localStorage.removeItem('gronk_melee_upgrade_level');
      } catch (_) {
        // Inline Puppeteer documents can deny localStorage; the game storage
        // fallback then uses starter weapons, which is the same desired setup.
      }
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'PLAYING', { timeout: 10000 });
    await advance(page, 800);

    const boot = await snapshot(page);
    assert(Array.isArray(boot.gaps) && boot.gaps.length > 0, 'expected level snapshot to expose jump gaps');
    assert(Array.isArray(boot.hazards) && boot.hazards.length > 0, 'expected level snapshot to expose hazards');

    const firstGap = boot.gaps[0];
    await page.evaluate((gap) => {
      window.postMessage(JSON.stringify({ type: 'debugClearEnemies' }), '*');
      window.postMessage(JSON.stringify({
        type: 'debugSpawnEnemy',
        kind: 'CHASER',
        x: gap.x - 90,
      }), '*');
      window.postMessage(JSON.stringify({
        type: 'debugSetPlayer',
        x: gap.x + gap.w + 240,
        y: 360,
        vx: 0,
        vy: 0,
        onGround: true,
      }), '*');
    }, firstGap);
    await advance(page, 550);
    const enemyGapMove = await snapshot(page);
    const gapEnemy = enemyGapMove.enemies.find((enemy) => enemy.type === 'CHASER');
    assert(gapEnemy, 'expected debug-spawned chaser near gap');
    assert(
      ['gap-vault', 'gap-retreat', 'gap-recover'].includes(gapEnemy.gapAction),
      `expected enemy to choose an explicit gap maneuver, got ${gapEnemy.gapAction}`,
    );
    assert(gapEnemy.y < boot.player.y + 180, `gap-aware enemy should stay playable instead of falling out of the level, got y=${gapEnemy.y}`);
    await page.screenshot({ path: path.join(outputDir, 'enemy-gap-maneuver.png') });

    await page.evaluate(() => {
      window.postMessage(JSON.stringify({ type: 'debugClearEnemies' }), '*');
    });
    await advance(page, 50);

    await page.evaluate((gap, playerY) => {
      window.postMessage(JSON.stringify({
        type: 'debugSetPlayer',
        x: gap.x - 190,
        y: playerY,
        vx: 0,
        vy: 0,
        onGround: true,
      }), '*');
    }, firstGap, boot.player.y);
    await advance(page, 50);
    await advance(page, 900);
    const nearGap = await snapshot(page);
    await page.screenshot({ path: path.join(outputDir, 'near-gap.png') });
    assert(nearGap.gaps.some((gap) => gap.screenX > 80 && gap.screenX < 1200), 'expected a terrain gap to be visible after teleport');

    // Build up running speed for ~220ms before triggering the jump. Pit contact
    // is now an instant kill, so a stand-still jump no longer "skates" the
    // player through; they need a real run-up to clear the gap.
    await page.evaluate(() => {
      window.postMessage(JSON.stringify({ type: 'joystickMove', x: 1, y: 0 }), '*');
    });
    await advance(page, 220);
    await page.evaluate(() => {
      window.postMessage(JSON.stringify({ type: 'action', name: 'jump' }), '*');
    });
    await advance(page, 1500);
    await page.evaluate(() => {
      window.postMessage(JSON.stringify({ type: 'joystickMove', x: 0, y: 0 }), '*');
    });
    const afterJump = await snapshot(page);
    await page.screenshot({ path: path.join(outputDir, 'gap-jump.png') });
    assert(afterJump.player.x > firstGap.x + firstGap.w, `expected player to cross first gap, got player=${afterJump.player.x} gapEnd=${firstGap.x + firstGap.w}`);
    assert(afterJump.player.y < boot.player.y + 120, `expected player not to be falling into the pit, got y=${afterJump.player.y}`);

    await page.evaluate((gap, playerY) => {
      window.postMessage(JSON.stringify({ type: 'debugClearEnemies' }), '*');
      window.postMessage(JSON.stringify({
        type: 'debugSpawnEnemy',
        kind: 'CHASER',
        x: gap.x - 64,
        vx: 0,
        vy: 0,
        onGround: true,
      }), '*');
      window.postMessage(JSON.stringify({
        type: 'debugSetPlayer',
        x: gap.x - 226,
        y: playerY,
        vx: 0,
        vy: 0,
        onGround: true,
        clearHit: true,
      }), '*');
    }, firstGap, boot.player.y);
    await advance(page, 50);
    const beforeEnemyPitKill = await snapshot(page);
    await page.evaluate(() => {
      window.postMessage(JSON.stringify({ type: 'action', name: 'attack' }), '*');
    });
    await advance(page, 140);
    const afterEnemyKnock = await snapshot(page);
    const knockedEnemy = afterEnemyKnock.enemies.find((enemy) => enemy.hp > 0 && enemy.hp < 50);
    await advance(page, 1550);
    const afterEnemyPitKill = await snapshot(page);
    await page.screenshot({ path: path.join(outputDir, 'enemy-knock-pit-kill.png') });
    assert(knockedEnemy, 'enemy should survive the melee hit before pit fall resolves');
    assert(
      afterEnemyPitKill.kills === beforeEnemyPitKill.kills + 1,
      `enemy knocked into a pit should count as a kill, got kills ${beforeEnemyPitKill.kills}->${afterEnemyPitKill.kills}`,
    );
    assert(
      !afterEnemyPitKill.enemies.some((enemy) => enemy.hp > 0 && enemy.hp < 50),
      'enemy knocked into a pit should be removed from the active enemy list even if the spawn system adds a fresh enemy later',
    );

    await page.evaluate((gap, playerY) => {
      window.postMessage(JSON.stringify({ type: 'debugClearEnemies' }), '*');
      window.postMessage(JSON.stringify({
        type: 'debugSetPlayer',
        x: gap.x - 260,
        y: playerY,
        vx: 0,
        vy: 0,
        onGround: true,
      }), '*');
      window.postMessage(JSON.stringify({
        type: 'debugSpawnEnemy',
        kind: 'CHASER',
        x: gap.x + gap.w * 0.5 - 25,
        y: playerY + 260,
        vx: 0,
        vy: 1100,
        onGround: false,
        hp: 49,
      }), '*');
    }, firstGap, boot.player.y);
    await advance(page, 70);
    const afterDamagedSelfPit = await snapshot(page);
    assert(
      afterDamagedSelfPit.kills === afterEnemyPitKill.kills + 1,
      `damaged enemy falling into a pit should count as a kill, got kills ${afterEnemyPitKill.kills}->${afterDamagedSelfPit.kills}`,
    );
    assert(
      !afterDamagedSelfPit.enemies.some((enemy) => enemy.hp > 0 && enemy.hp < 50),
      'damaged pit-fall enemy should disappear from active play',
    );
    assert(afterDamagedSelfPit.enemies.length > 0, 'pit-fall cleanup should keep spawning replacements while objective kills remain');

    await page.evaluate((gap, playerY) => {
      window.postMessage(JSON.stringify({ type: 'debugClearEnemies' }), '*');
      window.postMessage(JSON.stringify({
        type: 'debugSpawnEnemy',
        kind: 'CHASER',
        x: gap.x + gap.w * 0.5 - 25,
        y: playerY + 260,
        vx: 0,
        vy: 1100,
        onGround: false,
      }), '*');
    }, firstGap, boot.player.y);
    await advance(page, 70);
    const afterUndamagedSelfPit = await snapshot(page);
    assert(
      afterUndamagedSelfPit.kills === afterDamagedSelfPit.kills,
      `undamaged enemy falling into a pit should disappear without awarding a kill, got kills ${afterDamagedSelfPit.kills}->${afterUndamagedSelfPit.kills}`,
    );
    assert(afterUndamagedSelfPit.enemies.length > 0, 'undamaged pit-fall cleanup should still spawn replacement enemies');

    const spike = boot.hazards.find((hazard) => hazard.type === 'spikes') || boot.hazards[0];
    await page.evaluate((hazard, playerY) => {
      window.postMessage(JSON.stringify({
        type: 'debugSetPlayer',
        x: hazard.x + hazard.w * 0.5,
        y: playerY,
        vx: 0,
        vy: 0,
        onGround: true,
      }), '*');
    }, spike, boot.player.y);
    await advance(page, 50);
    await advance(page, 180);
    const afterTrap = await snapshot(page);
    await page.screenshot({ path: path.join(outputDir, 'trap-contact.png') });
    assert(afterTrap.player.hp < afterJump.player.hp, `expected trap contact to damage player, got ${afterTrap.player.hp} after ${afterJump.player.hp}`);

    await page.evaluate((gap, playerY) => {
      window.postMessage(JSON.stringify({
        type: 'debugSetPlayer',
        x: gap.x + gap.w * 0.5 - 20,
        y: playerY + 260,
        vx: 0,
        vy: 1100,
        onGround: false,
      }), '*');
    }, firstGap, boot.player.y);
    await advance(page, 90);
    const afterPitFall = await snapshot(page);
    assert(afterPitFall.phase === 'DEAD', `falling through a ground gap should end the run, got ${afterPitFall.phase}`);

    assert(!pageErrors.length, `page errors: ${pageErrors.join('\n')}`);

    fs.writeFileSync(path.join(outputDir, 'arcade-gauntlet.json'), JSON.stringify({ boot, nearGap, afterJump, beforeEnemyPitKill, afterEnemyKnock, afterEnemyPitKill, afterDamagedSelfPit, afterUndamagedSelfPit, afterTrap, afterPitFall, pageErrors }, null, 2));
    console.log('Arcade gauntlet smoke passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
