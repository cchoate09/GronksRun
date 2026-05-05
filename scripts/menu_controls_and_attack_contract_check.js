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
const menuSource = read('src/game/scenes/MenuScene.ts');
const gameSceneSource = read('src/game/scenes/GameScene.ts');
const playerSource = read('src/game/entities/Player.ts');
const skeletalSource = read('src/game/entities/SkeletalSprite.ts');

assert(appSource.includes('showGameControls'), 'native controls: App.js should track whether gameplay controls are currently visible');
assert(appSource.includes("msg.type === 'gameUiState'"), 'native controls: WebView should be able to publish scene UI state to native');
assert(appSource.includes('setShowGameControls(msg.controlsVisible === true)'), 'native controls: native overlay should follow gameUiState.controlsVisible');
assert(appSource.includes('webViewLoaded && showGameControls'), 'native controls: joystick/combat overlay should only render during active gameplay');

assert(menuSource.includes('publishNativeUiState(false'), 'menu controls: every menu/submenu should explicitly hide native gameplay controls');
assert(gameSceneSource.includes('publishNativeUiState(this.state === \'PLAYING\')'), 'game controls: level scenes should publish controls only for PLAYING state');
assert(gameSceneSource.includes('this.publishNativeUiState();'), 'game controls: gameplay state transitions should refresh native controls visibility');

assert(playerSource.includes('runningAttackBlend = moving && (this.isAttacking || rangedPoseVisible)'), 'moving attack: player should keep exposing blended running attack state');
assert(playerSource.includes("this.animationState = 'RUN'"), 'moving attack: active movement should keep the run animation layer');
assert(!playerSource.includes('this.sprite.setMeleeAttackCue(this.isAttacking'), 'melee attack: player should not render a second skeletal melee slash on top of the gameplay slash');
assert(playerSource.includes('this.slash.visible = this.attackPhase === \'ACTIVE\''), 'melee attack: the gameplay slash should remain the single visible melee arc');
assert(playerSource.includes('this.sprite.setRangedAttackCue(rangedPoseVisible'), 'moving attack: ranged should render an attack cue over the running body');

assert(!skeletalSource.includes('setMeleeAttackCue'), 'melee attack: skeletal renderer should not expose a duplicate melee attack overlay cue');
assert(!skeletalSource.includes('drawMeleeAttackCue'), 'melee attack: skeletal renderer should not draw a duplicate melee slash');
assert(!/this\.drawRunStrideCues\(true,/.test(skeletalSource), 'sprite cleanup: sheet-backed run should not draw synthetic shadow-leg stride cues');

console.log('Menu controls and moving attack contract passed.');
