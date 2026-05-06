const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function loadMenuLayout() {
  const sourcePath = path.join(projectRoot, 'src', 'game', 'scenes', 'menuLayout.ts');
  assert(fs.existsSync(sourcePath), 'home menu contract: menu layout helper should exist');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', js)(module.exports, module);
  assert(typeof module.exports.getMainMenuLayout === 'function', 'home menu contract: getMainMenuLayout should be exported');
  return module.exports.getMainMenuLayout;
}

const appSource = read('App.js');
const playerSource = read('src/game/entities/Player.ts');
const menuSource = read('src/game/scenes/MenuScene.ts');
const gameSceneSource = read('src/game/scenes/GameScene.ts');
const enemySource = read('src/game/entities/Enemy.ts');
const backgroundSource = read('src/game/levels/BackgroundManager.ts');

assert(appSource.includes("{ name: 'jump'"), 'jump contract: native overlay hit map should send an explicit jump action');
assert(appSource.includes('handleControlsTouchStart'), 'jump contract: native overlay should route touch starts through the multi-touch control handler');
assert(appSource.includes('jumpButton'), 'jump contract: native overlay should style a dedicated jump button');
assert(appSource.includes('>JUMP<'), 'jump contract: native overlay should label the restored jump button');
assert(playerSource.includes("actionJustPressed('jump')"), 'jump contract: player should consume native jump actions');

const movementIndex = playerSource.indexOf('let targetVx = 0');
const meleeIndex = playerSource.indexOf("actionJustPressed('attack')");
assert(movementIndex !== -1 && meleeIndex !== -1 && movementIndex < meleeIndex, 'movement/attack contract: movement should be resolved independently before melee input');
assert(playerSource.includes("input.isDown('ArrowRight')"), 'movement/attack contract: player should keep right movement input active');
assert(playerSource.includes("input.justPressed('Space')"), 'movement/attack contract: keyboard melee should remain independent from movement keys');
assert(!/if\s*\(\s*!this\.isAttacking\s*\)[\s\S]{0,240}targetVx/.test(playerSource), 'movement/attack contract: attacking should not gate horizontal target velocity');

const getMainMenuLayout = loadMenuLayout();
for (const viewport of [
  { width: 844, height: 390 },
  { width: 640, height: 360 },
  { width: 1280, height: 720 },
]) {
  const layout = getMainMenuLayout(viewport.width, viewport.height);
  assert(Array.isArray(layout.buttons), 'home menu contract: layout should expose button rectangles');
  const labels = layout.buttons.map((button) => button.label);
  for (const label of ['CONTINUE', 'ENDLESS RUN', 'LEVEL SELECT', 'SETTINGS']) {
    assert(labels.includes(label), `home menu contract: ${label} should be present`);
  }
  for (const button of layout.buttons) {
    assert(button.x >= 12, `home menu contract: ${button.label} should not run off the left edge at ${viewport.width}x${viewport.height}`);
    assert(button.x + button.w <= viewport.width - 12, `home menu contract: ${button.label} should not run off the right edge at ${viewport.width}x${viewport.height}`);
    assert(button.y >= 12, `home menu contract: ${button.label} should not run off the top edge at ${viewport.width}x${viewport.height}`);
    assert(button.y + button.h <= viewport.height - 18, `home menu contract: ${button.label} should stay above the bottom edge at ${viewport.width}x${viewport.height}`);
  }
}
assert(menuSource.includes('getMainMenuLayout'), 'home menu contract: MenuScene should use the shared layout helper');
assert(menuSource.includes('main_menu_buttons'), 'home menu contract: snapshots should expose menu button bounds');

const terrainProfiles = [...gameSceneSource.matchAll(/terrainProfile:\s*'([^']+)'/g)].map((match) => match[1]);
const spawnPatterns = [...gameSceneSource.matchAll(/spawnPattern:\s*\[/g)];
assert(terrainProfiles.length === 40, `variety contract: each authored campaign level should declare a terrain profile, got ${terrainProfiles.length}`);
assert(new Set(terrainProfiles).size >= 6, 'variety contract: campaign should use at least six terrain profiles');
assert(spawnPatterns.length === 40, `variety contract: each authored campaign level should declare a spawn pattern, got ${spawnPatterns.length}`);
assert(gameSceneSource.includes('this.level.spawnPattern'), 'variety contract: spawning should use level-specific spawn patterns');
assert(gameSceneSource.includes('terrain_profile'), 'snapshot contract: level terrain profile should be visible to automation');
assert(backgroundSource.includes('biome'), 'variety contract: background rendering should be driven by biome');

assert(!enemySource.includes('this.speed * 0.35'), 'enemy pressure contract: close enemies should keep pressing instead of slowing to a crawl');
assert(enemySource.includes('canDealContactDamage()'), 'enemy pressure contract: collision damage gate should remain explicit');
assert(gameSceneSource.includes('enemy.canDealContactDamage()'), 'enemy pressure contract: scene should respect enemy contact pressure state');
assert(gameSceneSource.includes('enemyGapManeuvers'), 'enemy gap contract: scene should track per-enemy gap maneuvers instead of frame-by-frame edge stalling');
assert(gameSceneSource.includes('gapAction'), 'enemy gap contract: snapshots should expose the current gap action for QA');

console.log('Current objective contract passed.');
