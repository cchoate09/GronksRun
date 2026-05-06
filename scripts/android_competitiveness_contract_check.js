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
const appConfigSource = read('app.json');
const packageSource = read('package.json');
const playerSource = read('src/game/entities/Player.ts');
const physicsSource = read('src/engine/physics.ts');
const gameSceneSource = read('src/game/scenes/GameScene.ts');
const menuSource = read('src/game/scenes/MenuScene.ts');
const androidBuildSource = read('android/app/build.gradle');
const androidManifestSource = read('android/app/src/main/AndroidManifest.xml');
const mainActivitySource = read('android/app/src/main/java/com/gronksrun/app/MainActivity.kt');
const preflightSource = read('scripts/qa_environment_preflight.js');
const puppeteerLaunchOptionsSource = read('scripts/puppeteerLaunchOptions.js');
const webGameClientRunnerSource = read('scripts/run_web_game_client_with_server.js');
const combatModesSource = read('scripts/combat_modes_check.js');

assert(appSource.includes('topControlsContainer'), 'mobile controls: pause button should live in a top controls container');
assert(/pauseButton:\s*\{[^}]*width:\s*4[0-9][^}]*height:\s*4[0-9]/s.test(appSource), 'mobile controls: pause button should be smaller than combat buttons');
assert(appSource.includes('combatButtonsRow'), 'mobile controls: melee/ranged buttons should be grouped below jump');
assert(appSource.indexOf("handleAction('jump')") < appSource.indexOf('combatButtonsRow'), 'mobile controls: jump should render above the melee/ranged row');
assert(appSource.includes("baseUrl: 'https://gronks-run.local/'"), 'android webview: inline game HTML should have a stable origin for DOM storage');

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
assert(appSource.includes('TestIds.REWARDED_INTERSTITIAL'), 'ads: development builds should keep Google test rewarded interstitials');
assert(appSource.includes('ca-app-pub-8879184280264151/6328191159'), 'ads: release builds should keep the production rewarded interstitial ad unit');
assert(appConfigSource.includes('ca-app-pub-8879184280264151~8722286751'), 'ads: Expo config should keep the production Android AdMob app id');
assert(androidManifestSource.includes('com.google.android.gms.ads.APPLICATION_ID'), 'ads: Android manifest should keep the AdMob application id metadata');
assert(androidManifestSource.includes('ca-app-pub-8879184280264151~8722286751'), 'ads: Android manifest should keep the production Android AdMob app id');

assert(mainActivitySource.includes('hideSystemBars'), 'android immersive: MainActivity should hide Android system bars while the game is open');
assert(mainActivitySource.includes('WindowInsets.Type.navigationBars'), 'android immersive: navigation bar should be hidden in landscape');
assert(mainActivitySource.includes('BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE'), 'android immersive: system bars should stay transient and swipe-revealable');

assert(androidBuildSource.includes('generateWebViewBundle'), 'android build: release builds should regenerate the WebView bundle from source');
assert(androidBuildSource.includes('npmExecutable, "run", "build:webview"'), 'android build: WebView bundle generation should call npm run build:webview');
assert(androidBuildSource.includes('createBundleReleaseJsAndAssets') || androidBuildSource.includes('bundleReleaseJsAndAssets'), 'android build: WebView bundle generation should run before React Native release JS assets');

assert(preflightSource.includes('puppeteer'), 'visual QA: preflight should detect Puppeteer browser availability for CI/local verification');
assert(preflightSource.includes('puppeteerLaunch'), 'visual QA: preflight should record a direct Puppeteer launch check');
assert(preflightSource.includes('launchOptions'), 'visual QA: preflight should share CI-safe Puppeteer launch options');
assert(puppeteerLaunchOptionsSource.includes('--no-sandbox'), 'visual QA: CI Puppeteer launch options should disable Chromium sandbox when needed');
assert(puppeteerLaunchOptionsSource.includes('process.env.CI'), 'visual QA: no-sandbox launch flags should be scoped to CI');
assert(fs.existsSync(path.join(projectRoot, '.github', 'workflows', 'android-competitiveness.yml')), 'visual QA: GitHub Actions workflow should run competitiveness verification on PRs');
const workflowSource = read('.github/workflows/android-competitiveness.yml');
assert(workflowSource.includes('npm run qa:visual'), 'visual QA: workflow should run the visual QA gate');
assert(workflowSource.includes('npx puppeteer browsers install'), 'visual QA: workflow should install a Puppeteer-managed browser');
assert(webGameClientRunnerSource.includes('runFallbackWebGameClient'), 'visual QA: web game client should have a repo-owned fallback for CI');
assert(!webGameClientRunnerSource.includes('throw new Error(`Missing develop-web-game client'), 'visual QA: missing agent-local web game client should not fail CI before repo-owned smokes run');
assert(webGameClientRunnerSource.includes('isBenignFallbackConsoleError'), 'visual QA: fallback client should filter benign browser resource-load console noise');
assert(combatModesSource.includes('postAndAdvance'), 'visual QA: combat smoke should dispatch one-frame actions and advance time atomically');
assert(combatModesSource.includes('advanceUntilMeleeActive'), 'visual QA: combat smoke should sample melee ACTIVE phase inside the page without Node await gaps');

console.log('Android competitiveness contract passed.');
