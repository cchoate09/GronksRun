const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const physicsSource = fs.readFileSync(path.join(projectRoot, 'src', 'engine', 'physics.ts'), 'utf8');
const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');

assert(physicsSource.includes('addPlatform'), 'physics contract: platform collision support should exist');
assert(physicsSource.includes('clearPlatforms'), 'physics contract: scene should be able to reset platforms');
assert(gameSceneSource.includes('buildTerrainPlatforms'), 'terrain contract: levels should generate platform terrain');
assert(gameSceneSource.includes('terrainPlatforms'), 'terrain contract: scene should store terrain platform data');
assert(gameSceneSource.includes('this.engine.physics.addPlatform'), 'terrain contract: platforms should be registered with physics');
assert(gameSceneSource.includes('terrain: this.terrainPlatforms'), 'snapshot contract: terrain should be exposed for automation');

console.log('Terrain contract passed.');
