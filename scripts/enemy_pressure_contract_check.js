const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const enemySource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'entities', 'Enemy.ts'), 'utf8');
const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');

assert(enemySource.includes('attackCooldownRemaining'), 'enemy contract: close enemies should have attack cooldown state');
assert(enemySource.includes('isAttacking'), 'enemy contract: enemies should expose active attack state');
assert(enemySource.includes('lungeSpeed'), 'enemy contract: melee enemies should lunge instead of stopping near the player');
assert(!enemySource.includes('this.body.vx = 0;\n            this.sprite.setState(\'IDLE\');\n        }\n    }\n\n    public takeDamage'), 'enemy contract: base close-range AI should not idle without attacking');
assert(gameSceneSource.includes('enemy.canDealContactDamage()'), 'scene contract: contact damage should respect enemy attack windows');
assert(gameSceneSource.includes('attacking: enemy.isAttacking'), 'snapshot contract: enemy attack state should be visible to automation');

console.log('Enemy pressure contract passed.');
