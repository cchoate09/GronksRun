const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const appSource = read('App.js');
const playerSource = read('src/game/entities/Player.ts');
const skeletalSource = read('src/game/entities/SkeletalSprite.ts');
const spriteDataSource = read('src/game/assets/spriteData.ts');
const weaponSource = read('src/game/weapons.ts');
const gameSceneSource = read('src/game/scenes/GameScene.ts');
const menuSource = read('src/game/scenes/MenuScene.ts');
const backgroundSource = read('src/game/levels/BackgroundManager.ts');

assert(spriteDataSource.includes("'RANGED_ATTACK'"), 'animation: sprite states should include a dedicated ranged attack state');
assert(spriteDataSource.includes('RANGED_ATTACK:'), 'animation: hero sheet should map a ranged attack animation');
assert(!/this\.drawRunStrideCues\(true,/.test(skeletalSource), 'animation: sheet-backed player should not render synthetic shadow-leg stride cues');
assert(!skeletalSource.includes('drawMeleeAttackCue'), 'animation: player should avoid a doubled melee slash overlay');
assert(skeletalSource.includes('drawRangedAttackCue'), 'animation: sheet-backed player should render a ranged attack cue');
assert(playerSource.includes('rangedAttackTimer'), 'animation: player should hold a visible ranged attack animation timer');
assert(playerSource.includes('runningAttackBlend'), 'animation: player should expose when movement and attack are blended');
assert(gameSceneSource.includes('rangedPoseVisible'), 'snapshot: gameplay state should expose ranged attack animation visibility');
assert(gameSceneSource.includes('animation_state'), 'snapshot: gameplay state should expose current animation state');

assert(weaponSource.includes('purchaseWeaponUpgrade'), 'economy: gems should be spendable through a weapon upgrade purchase helper');
assert(weaponSource.includes('getEffectiveWeapon'), 'economy: equipped weapons should be converted into upgraded effective stats');
assert(weaponSource.includes('gronk_melee_upgrade_level'), 'economy: melee upgrade level should persist');
assert(weaponSource.includes('gronk_ranged_upgrade_level'), 'economy: ranged upgrade level should persist');
assert(menuSource.includes('purchaseWeaponUpgrade'), 'economy: armory should let the player buy attack upgrades with gems');
assert(menuSource.includes('upgradeCost'), 'economy: armory snapshot/UI should expose upgrade costs');
assert(gameSceneSource.includes('getEffectiveWeapon'), 'gameplay: player loadout should use upgraded weapon stats');

assert(menuSource.includes("data.type === 'backButton'"), 'menu buttons: native back button should be handled in menu scenes');
assert(menuSource.includes('buttonRegistry'), 'menu buttons: menu snapshots should expose current actionable buttons for sweeps');
assert(gameSceneSource.includes('overlayButtonRegistry'), 'game buttons: pause/result overlays should expose actionable button bounds for sweeps');
assert(menuSource.includes('drawButtonChrome'), 'menu UI: menu buttons should use shared stylized button chrome');
assert(gameSceneSource.includes('drawOverlayButtonChrome'), 'overlay UI: pause/result buttons should use shared stylized button chrome');
assert(appSource.includes('buttonShadow'), 'native UI: mobile overlay buttons should have layered artistic chrome');
assert(appSource.includes('buttonGlyph'), 'native UI: mobile overlay buttons should use stronger symbolic/glyph text styling');

assert(gameSceneSource.includes("'spellRune'"), 'traps: hazards should include a magic spell/rune trap type');
assert(gameSceneSource.includes('spellRune'), 'traps: scene should build, update, render, and snapshot magic traps');
assert(gameSceneSource.includes('OBSTACLE_SHEET'), 'traps: hazard rendering should use the OpenAI obstacle atlas');

assert(backgroundSource.includes('drawPlatformBackdropBands'), 'background: platform area should get explicit stylized backdrop bands');
assert(backgroundSource.includes('terrainEchoLayer'), 'background: level scenery should include a parallax terrain echo layer behind platforms');

console.log('Polish pass contract passed.');
