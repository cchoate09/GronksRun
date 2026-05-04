const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const playerSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'entities', 'Player.ts'), 'utf8');
const enemySource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'entities', 'Enemy.ts'), 'utf8');
const gameSceneSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts'), 'utf8');

assert(playerSource.includes('standingHeight'), 'player contract: player should track standing height');
assert(playerSource.includes('crouchHeight'), 'player contract: player should have a smaller crouch hitbox');
assert(playerSource.includes('applyCrouchHitbox'), 'player contract: crouch should update collision geometry');
assert(enemySource.includes('mechanic:'), 'enemy contract: enemies should expose a mechanic label');
assert(enemySource.includes('takePoundDamage'), 'enemy contract: pound damage should have a dedicated path');
assert(enemySource.includes('class SerpentEnemy'), 'enemy contract: serpent should have custom movement/attack behavior');
assert(enemySource.includes('highProjectile'), 'enemy contract: ranged enemies should be able to fire crouch-dodgeable high projectiles');
assert(gameSceneSource.includes('this.player.isCrouching && p.highProjectile'), 'scene contract: crouch should avoid high projectiles');
assert(gameSceneSource.includes('enemy.takePoundDamage'), 'scene contract: pound should use the dedicated enemy damage path');
assert(gameSceneSource.includes('mechanic: enemy.mechanic'), 'snapshot contract: enemy mechanics should be visible to automation');

console.log('Crouch/pound/enemy contract passed.');
