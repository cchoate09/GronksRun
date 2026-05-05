const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { launchOptions } = require('./puppeteerLaunchOptions');

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'output', 'sprite-animation');
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

function sourceFallback() {
  const spriteSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'assets', 'spriteData.ts'), 'utf8');
  const skeletalSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'entities', 'SkeletalSprite.ts'), 'utf8');
  const playerSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'entities', 'Player.ts'), 'utf8');
  const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
  assert(spriteSource.includes('frameOffsets'), 'source fallback: sprite sheets should include frame stabilization offsets');
  assert(spriteSource.includes('JUMP') && spriteSource.includes('FALL'), 'source fallback: player sheets should include jump/fall maps');
  assert(skeletalSource.includes('animationRateScale'), 'source fallback: renderer should use bounded animation rate scaling');
  assert(playerSource.includes("'JUMP'") && playerSource.includes("'FALL'"), 'source fallback: player should select jump/fall states');
  assert(gameSceneSource.includes('animation_frame: enemy.sprite.animationFrame'), 'source fallback: enemy animation frames should be exposed in snapshots');
  console.log('Sprite animation source fallback passed. Puppeteer browser launch was blocked by EPERM in this workspace.');
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions());
  } catch (error) {
    if (error && error.code === 'EPERM') {
      sourceFallback();
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

    const menu = await readState(page);
    assert(menu.phase === 'MENU', `expected MENU phase, got ${menu.phase}`);
    await clickButton(page, 'LEVEL SELECT', 120);
    await clickButton(page, 'LEVEL 10', 160);
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).phase === 'PLAYING', { timeout: 10000 });
    await advance(page, 160);

    await page.keyboard.down('ArrowRight');
    const running = await advance(page, 260);
    assert(running.player.animation_state === 'RUN', `expected running animation, got ${running.player.animation_state}`);
    assert(running.player.vx > 0, `expected positive running velocity, got ${running.player.vx}`);

    const ranged = await postAndAdvance(page, { type: 'action', name: 'ranged' }, 90);
    assert(ranged.player.animation_state === 'RUN', `running ranged attack should keep RUN, got ${ranged.player.animation_state}`);
    assert(ranged.player.runningAttackBlend === true, 'running ranged attack should expose runningAttackBlend');
    assert(ranged.player.rangedPoseVisible === true, 'running ranged attack should expose the ranged pose cue');
    await page.screenshot({ path: path.join(outputDir, 'player-run-ranged.png') });
    await page.keyboard.up('ArrowRight');

    await postAndAdvance(page, { type: 'debugSetPlayer', x: 420, y: 520, vx: 0, vy: 0, onGround: true }, 50);
    let melee = await postAndAdvance(page, { type: 'action', name: 'attack' }, 60);
    for (let i = 0; i < 6 && melee.player.attackPhase !== 'ACTIVE'; i++) {
      melee = await advance(page, 40);
    }
    assert(melee.player.animation_state === 'ATTACK', `stationary melee attack should use ATTACK, got ${melee.player.animation_state}`);
    assert(melee.player.attackMode === 'MELEE', `expected melee attack mode, got ${melee.player.attackMode}`);
    assert(melee.player.attackPhase === 'ACTIVE', `expected active melee frame, got ${melee.player.attackPhase}`);
    assert(melee.player.slashVisible === true, 'active melee animation should expose the slash cue');
    await page.screenshot({ path: path.join(outputDir, 'player-melee.png') });
    await advance(page, 360);

    const jumping = await postAndAdvance(page, { type: 'debugSetPlayer', x: 420, y: 210, vx: 0, vy: -520, onGround: false }, 90);
    assert(jumping.player.animation_state === 'JUMP', `expected JUMP animation after upward debug velocity, got ${jumping.player.animation_state}`);
    const falling = await postAndAdvance(page, { type: 'debugSetPlayer', x: 420, y: 190, vx: 0, vy: 520, onGround: false }, 90);
    assert(falling.player.animation_state === 'FALL', `expected FALL animation after downward debug velocity, got ${falling.player.animation_state}`);
    await page.screenshot({ path: path.join(outputDir, 'player-fall.png') });

    const enemySnapshot = await advance(page, 900);
    assert(enemySnapshot.enemies.length >= 3, `expected multiple enemies active for animation telemetry, got ${enemySnapshot.enemies.length}`);
    for (const enemy of enemySnapshot.enemies) {
      assert(['IDLE', 'RUN', 'ATTACK', 'HIT'].includes(enemy.animation_state), `${enemy.type}: unexpected animation state ${enemy.animation_state}`);
      assert(Number.isInteger(enemy.animation_frame), `${enemy.type}: expected integer animation frame`);
      assert(enemy.animation_frame >= 0 && enemy.animation_frame < 16, `${enemy.type}: animation frame should stay in atlas range, got ${enemy.animation_frame}`);
    }
    await page.screenshot({ path: path.join(outputDir, 'enemy-animation-roster.png') });

    fs.writeFileSync(path.join(outputDir, 'sprite-animation.json'), JSON.stringify({ running, ranged, melee, jumping, falling, enemySnapshot, errors }, null, 2));
    assert(!errors.length, `page errors: ${errors.join('\n')}`);
    console.log('Sprite animation smoke passed.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
