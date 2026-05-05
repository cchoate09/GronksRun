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
const packageSource = read('package.json');
const playerSource = read('src/game/entities/Player.ts');
const physicsSource = read('src/engine/physics.ts');
const gameSceneSource = read('src/game/scenes/GameScene.ts');
const menuSource = read('src/game/scenes/MenuScene.ts');
const androidBuildSource = read('android/app/build.gradle');

assert(appSource.includes('topControlsContainer'), 'mobile controls: pause button should live in a top controls container');
assert(/pauseButton:\s*\{[^}]*width:\s*4[0-9][^}]*height:\s*4[0-9]/s.test(appSource), 'mobile controls: pause button should be smaller than combat buttons');
assert(appSource.includes('combatButtonsRow'), 'mobile controls: melee/ranged buttons should be grouped below jump');
assert(appSource.indexOf("handleAction('jump')") < appSource.indexOf('combatButtonsRow'), 'mobile controls: jump should render above the melee/ranged row');

assert(physicsSource.includes('groundedOn'), 'platform drop: physics bodies should expose whether they stand on ground or a platform');
assert(physicsSource.includes('dropThroughTimer'), 'platform drop: physics should support temporarily ignoring one-way platforms');
assert(playerSource.includes("groundedOn === 'platform'"), 'platform drop: pressing down on a platform should drop through instead of only crouching');
assert(playerSource.includes('dropThroughTimer'), 'platform drop: player should request platform drop-through');

assert(gameSceneSource.includes('avoidEnemyGroundGaps'), 'enemy gaps: scene should run enemy gap-avoidance steering');
assert(gameSceneSource.includes('findGroundGapAt'), 'enemy gaps: scene should identify upcoming/current ground gaps for enemies');
assert(gameSceneSource.includes('enemy_gap_aware'), 'enemy gaps: snapshots should expose gap-aware enemy behavior');

assert(gameSceneSource.includes('bombExplosions'), 'bomber AOE: scene should track bomb explosion areas');
assert(gameSceneSource.includes('explosionRadius'), 'bomber AOE: bomb projectiles should carry an explosion radius');
assert(gameSceneSource.includes('detonateBomb'), 'bomber AOE: bombs should detonate through a dedicated area-damage path');
assert(gameSceneSource.includes('bomb_explosions'), 'bomber AOE: snapshots should expose active bomb AOE zones');

assert(fs.existsSync(path.join(projectRoot, 'src', 'game', 'weapons.ts')), 'weapons: weapon definitions and inventory helpers should exist');
const weaponSource = read('src/game/weapons.ts');
assert(weaponSource.includes('MELEE_WEAPONS') && weaponSource.includes('RANGED_WEAPONS'), 'weapons: melee and ranged weapon rosters should be defined');
assert(weaponSource.includes('grantWeaponsForLevel'), 'weapons: level completion should be able to grant earned weapons');
assert(weaponSource.includes('equipWeapon'), 'weapons: inventory should expose an equip operation');
assert(playerSource.includes('applyWeaponLoadout'), 'weapons: player stats should be driven by equipped melee/ranged weapons');
assert(gameSceneSource.includes('grantWeaponsForLevel'), 'weapons: game scene should grant weapons as level rewards');
assert(menuSource.includes('drawArmory'), 'weapons: menu should provide an armory/equipment screen');
assert(menuSource.includes('ARMORY'), 'weapons: armory should be reachable from the menu');

assert(gameSceneSource.includes('requestRewardedContinue'), 'ads: death flow should request rewarded ads for continues');
assert(gameSceneSource.includes("rewardType: 'continue'"), 'ads: native showAd request should carry the continue reward type');
assert(gameSceneSource.includes('applyRewardedContinue'), 'ads: rewarded callback should revive the player into the run');
assert(gameSceneSource.includes('adRewarded'), 'ads: scene should handle native rewarded-ad callbacks');
assert(packageSource.includes('react-native-google-mobile-ads'), 'ads: native Google Mobile Ads dependency should remain installed');

assert(androidBuildSource.includes('generateWebViewBundle'), 'android build: release builds should regenerate the WebView bundle from source');
assert(androidBuildSource.includes('npmExecutable, "run", "build:webview"'), 'android build: WebView bundle generation should call npm run build:webview');
assert(androidBuildSource.includes('createBundleReleaseJsAndAssets') || androidBuildSource.includes('bundleReleaseJsAndAssets'), 'android build: WebView bundle generation should run before React Native release JS assets');

console.log('Android competitiveness contract passed.');
