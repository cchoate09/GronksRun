const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const soundPath = path.join(projectRoot, 'src', 'game', 'audio', 'SoundManager.ts');
assert(fs.existsSync(soundPath), 'sound contract: SoundManager should exist');

const soundSource = fs.readFileSync(soundPath, 'utf8');
const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
const menuSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'MenuScene.ts'), 'utf8');

assert(soundSource.includes('gronk_sound_enabled'), 'sound contract: sound manager should respect persisted sound setting');
assert(soundSource.includes('playCue'), 'sound contract: sound manager should expose playCue');
assert(soundSource.includes('AudioContext'), 'sound contract: sound manager should use browser audio when available');
assert(gameSceneSource.includes("SoundManager.playCue('melee')"), 'sound contract: melee should trigger sound');
assert(gameSceneSource.includes("SoundManager.playCue('ranged')"), 'sound contract: ranged should trigger sound');
assert(gameSceneSource.includes("SoundManager.playCue('hit')"), 'sound contract: hit feedback should trigger sound');
assert(gameSceneSource.includes("SoundManager.playCue('clear')"), 'sound contract: level clear should trigger sound');
assert(menuSource.includes("SoundManager.playCue('select')"), 'sound contract: menu/settings selection should trigger sound');

console.log('Sound contract passed.');
