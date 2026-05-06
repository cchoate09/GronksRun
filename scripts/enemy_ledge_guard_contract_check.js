const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const scenePath = path.join(projectRoot, 'src', 'game', 'scenes', 'GameScene.ts');
const source = fs.readFileSync(scenePath, 'utf8');

const avoidMethod = source.match(/private avoidEnemyGroundGaps\(enemy: Enemy, dt: number\): void \{[\s\S]*?\n    \}/);
assert(avoidMethod, 'GameScene should define avoidEnemyGroundGaps(enemy, dt)');

const body = avoidMethod[0];
assert(!body.includes("action: 'gap-vault'"), 'grounded enemies should not autonomously vault into gaps');
assert(!body.includes("enemy.body.vy = vaultLift"), 'grounded enemies should hold at ledges instead of jumping gaps on their own');
assert(body.includes("enemy.body.vx = 0"), 'enemy ledge guard should stop horizontal motion at unsafe ground gaps');
assert(body.includes("action: 'gap-retreat'"), 'enemy ledge guard should expose a gap-retreat snapshot state while parked at the edge');

assert(/if\s*\(!enemy\.hasPlayerKnockbackCredit\(\)\)\s*this\.avoidEnemyGroundGaps\(enemy,\s*dt\)/.test(source), 'enemy gap guard should be skipped while player knockback credit is active');
assert(/resolveEnemyPitFall\([\s\S]*enemy\.hasPlayerKnockbackCredit\(\)[\s\S]*registerKill/.test(source), 'player-forced enemy pit falls should still count as kills');

console.log('Enemy ledge guard contract passed.');
