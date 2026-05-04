const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');
const lengthMatches = [...gameSceneSource.matchAll(/levelLength:\s*(\d+)/g)].map((match) => Number(match[1]));

assert(lengthMatches.length >= 10, 'duration contract: authored campaign should define at least 10 level lengths');
assert(Math.min(...lengthMatches.slice(0, 10)) >= 26000, 'duration contract: authored levels should last roughly 1+ minute at current run speed');
assert(Math.max(...lengthMatches.slice(0, 10)) <= 78000, 'duration contract: authored levels should stay under roughly 3 minutes at current run speed');
assert(gameSceneSource.includes('checkLevelCompletion'), 'duration contract: scene should centralize completion checks');
assert(gameSceneSource.includes('hasMetLevelGoal'), 'duration contract: completion should require objective progress');
assert(gameSceneSource.includes('if (this.hasMetLevelGoal()) {\n            this.completeLevel();'), 'duration contract: target kills should now complete the level without endpoint distance');
assert(!gameSceneSource.includes('this.player.body.x >= this.level.levelLength'), 'duration contract: endpoint distance should not block target-kill completion');
assert(gameSceneSource.includes('progress: {'), 'snapshot contract: automation should see level progress');

console.log('Level duration contract passed.');
