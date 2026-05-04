const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const menuSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'MenuScene.ts'), 'utf8');
const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');

assert(menuSource.includes("'SETTINGS'"), 'menu contract: settings screen should exist');
assert(menuSource.includes('drawSettings'), 'menu contract: settings drawing function should exist');
assert(menuSource.includes('ENDLESS RUN'), 'menu contract: endless mode should be reachable from main menu');
assert(menuSource.includes('gronk_difficulty'), 'menu contract: difficulty setting should persist');
assert(menuSource.includes('gronk_sound_enabled'), 'menu contract: sound setting should persist');
assert(gameSceneSource.includes('generateEndlessLevel'), 'level contract: endless levels should be generated');
assert(gameSceneSource.includes('selectedLevel: number = 0'), 'level contract: level 0 should represent endless mode');
assert(gameSceneSource.includes('gronk_endless_depth'), 'level contract: endless depth should persist for increasing difficulty');
assert(gameSceneSource.includes('difficultyMultiplier'), 'level contract: difficulty setting should affect generated challenge');
assert(gameSceneSource.includes('endless: this.isEndless'), 'snapshot contract: automation should see endless state');

console.log('Endless/settings contract passed.');
