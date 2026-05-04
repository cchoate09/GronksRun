const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
const appSource = fs.readFileSync(path.join(projectRoot, 'App.js'), 'utf8');

assert(gameSceneSource.includes("'PAUSED'"), 'pause contract: GameScene should have a PAUSED state');
assert(gameSceneSource.includes('showPause'), 'pause contract: GameScene should draw a pause overlay');
assert(gameSceneSource.includes('resumeGame'), 'pause contract: GameScene should resume from pause');
assert(gameSceneSource.includes('drawPauseOverlay'), 'pause contract: pause overlay should be rendered by a dedicated method');
assert(gameSceneSource.includes("data.name === 'pause'"), 'pause contract: native pause action should be handled');
assert(gameSceneSource.includes("data.type === 'backButton'"), 'pause contract: Android back button should pause/resume instead of being ignored');
assert(gameSceneSource.includes("phase: this.state"), 'snapshot contract: pause phase should be visible to automation');
assert(appSource.includes("handleAction('pause')"), 'native contract: overlay should expose a pause button');

console.log('Pause UI contract passed.');
