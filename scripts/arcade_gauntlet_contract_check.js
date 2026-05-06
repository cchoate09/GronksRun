const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function makePoint() {
  return {
    x: 0,
    y: 0,
    set(x = 0, y = x) {
      this.x = x;
      this.y = y;
    },
  };
}

class Container {
  constructor() {
    this.children = [];
    this.position = makePoint();
    this.pivot = makePoint();
    this.scale = makePoint();
    this.x = 0;
    this.y = 0;
    this.visible = true;
    this.tint = 0xffffff;
  }

  addChild(...children) {
    this.children.push(...children);
    return children[0];
  }
}

class Graphics extends Container {
  clear() { return this; }
  rect() { return this; }
  roundRect() { return this; }
  circle() { return this; }
  fill() { return this; }
  stroke() { return this; }
  moveTo() { return this; }
  quadraticCurveTo() { return this; }
}

class SkeletalSprite extends Container {
  constructor() {
    super();
    this.state = 'IDLE';
  }

  setState(state) {
    this.state = state;
  }

  setFacingRight() {}

  setRangedAttackCue() {}
  setMeleeAttackCue() {}

  update() {}
}

class Body {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;
    this.vx = 0;
    this.vy = 0;
    this.previousBottom = 0;
    this.isStatic = false;
    this.onGround = false;
    this.gravityScale = 1;
    this.friction = 0.8;
  }
}

class MockInput {
  constructor({ down = [] } = {}) {
    this.down = new Set(down);
  }

  isDown(code) {
    return this.down.has(code);
  }

  justPressed() {
    return false;
  }

  actionJustPressed() {
    return false;
  }
}

function loadTs(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === 'pixi.js') return { Container, Graphics };
    if (request.endsWith('/physics')) return { Body };
    if (request === './SkeletalSprite') return { SkeletalSprite };
    if (request === '../assets/spriteData') return {
      HERO_SHEETS: { gronk: {} },
      ENEMY_SHEETS: { CHASER: {}, RANGED: {}, HEAVY: {}, SERPENT: {} },
    };
    throw new Error(`Unexpected test require from ${relativePath}: ${request}`);
  };
  new Function('require', 'exports', 'module', '__filename', '__dirname', js)(
    localRequire,
    module.exports,
    module,
    fullPath,
    path.dirname(fullPath)
  );
  return module.exports;
}

global.window = { innerWidth: 1280, innerHeight: 720 };

const playerSource = read('src/game/entities/Player.ts');
const enemySource = read('src/game/entities/Enemy.ts');
const physicsSource = read('src/engine/physics.ts');
const gameSceneSource = read('src/game/scenes/GameScene.ts');

assert(enemySource.includes('EnemyTargetSnapshot'), 'enemy AI: enemies should consume a full target snapshot, not only target X');
assert(enemySource.includes('predictedX'), 'enemy AI: chasers should lead moving player targets');
assert(enemySource.includes('pendingShotLead'), 'enemy AI: ranged enemies should expose predictive shot lead data');
// The scene must pass the full player target snapshot to each enemy update.
// Accept either the original direct call form or the hoisted form (where
// the snapshot is computed once per frame and reused across the loop).
assert(
  gameSceneSource.includes('enemy.update(dt, this.getEnemyTargetSnapshot())')
    || /const\s+targetSnapshot\s*=\s*this\.getEnemyTargetSnapshot\(\)[\s\S]{0,400}enemy\.update\(dt,\s*targetSnapshot\)/.test(gameSceneSource),
  'scene AI: enemies should receive the full player target snapshot',
);

assert(physicsSource.includes('setGroundGaps'), 'gap terrain: physics should support registering ground gaps');
assert(physicsSource.includes('isOverGroundGap'), 'gap terrain: physics should skip ground collision over gaps');
assert(gameSceneSource.includes('terrainGaps'), 'gap terrain: scene should store terrain gap data');
assert(gameSceneSource.includes('buildTerrainGaps'), 'gap terrain: scene should build jump gaps per level');
assert(gameSceneSource.includes('hazards'), 'trap terrain: scene should store hazard data');
assert(gameSceneSource.includes('buildHazards'), 'trap terrain: scene should build traps per level');
assert(gameSceneSource.includes('checkHazards'), 'trap terrain: hazards should be able to damage the player');
assert(/checkPitFall\(\):\s*void\s*\{[\s\S]{0,360}this\.showDead\(\)/.test(gameSceneSource), 'pit terrain: falling below a terrain gap should end the run instead of resetting to safe ground');
assert(enemySource.includes('hasTakenDamage'), 'enemy pit cleanup: enemies should expose whether they took non-zero player damage');
assert(gameSceneSource.includes('requestObjectiveReplacementSpawn'), 'enemy pit cleanup: removing enemies in pits should force replacement spawning while objective kills remain');
assert(/resolveEnemyPitFall\([\s\S]*enemy\.hasTakenDamage\(\)[\s\S]*registerKill/.test(gameSceneSource), 'enemy pit cleanup: damaged enemies that fall into pits should count as kills');
assert(/resolveEnemyPitFall\([\s\S]*enemy\.isDead = true/.test(gameSceneSource), 'enemy pit cleanup: any grounded enemy that falls into a pit should be removed from active play');
assert(gameSceneSource.includes('gaps: this.terrainGaps'), 'snapshot: terrain gaps should be exposed for automation');
assert(gameSceneSource.includes('hazards: this.hazards'), 'snapshot: hazards should be exposed for automation');
assert(gameSceneSource.includes('OBSTACLE_FRAME_ANCHORS'), 'obstacle art: atlas frames should use per-frame content anchors');
assert(gameSceneSource.includes('getObstacleFrameIndex'), 'obstacle art: scene should choose animated atlas frames per hazard state');
assert(gameSceneSource.includes('getObstacleFrameAnchor'), 'obstacle art: scene should keep dormant/active obstacle frames position-stable');

const { Player } = loadTs('src/game/entities/Player.ts');
const { Enemy, RangedEnemy } = loadTs('src/game/entities/Enemy.ts');

const grounded = new Player();
grounded.body.onGround = true;
for (let i = 0; i < 90; i++) {
  grounded.update(1 / 60, new MockInput({ down: ['ArrowRight'] }));
}

const airborne = new Player();
airborne.body.onGround = false;
for (let i = 0; i < 180; i++) {
  airborne.update(1 / 60, new MockInput({ down: ['ArrowRight'] }));
}

assert(grounded.body.vx >= 520, `run tuning: grounded sustained speed should be arcade-fast, got ${grounded.body.vx}`);
assert(airborne.body.vx <= grounded.body.vx * 0.82, `run tuning: airborne speed should stay clearly below ground speed, got air=${airborne.body.vx} ground=${grounded.body.vx}`);
assert(airborne.body.vx >= grounded.body.vx * 0.65, `run tuning: airborne control should remain responsive, got air=${airborne.body.vx} ground=${grounded.body.vx}`);

const farChaser = new Enemy(0, 0, 'CHASER');
farChaser.body.onGround = true;
farChaser.update(1 / 60, { x: 620, y: 0, vx: 500, vy: 0, onGround: true, width: 40, height: 80 });
assert(farChaser.body.vx > 0, 'enemy AI: chaser should advance toward a player at encounter distance instead of idling');
assert(Math.abs(farChaser.body.vx) > 150, `enemy AI: chaser should apply pressure above old base speed, got ${farChaser.body.vx}`);

const antiAirChaser = new Enemy(190, 0, 'CHASER');
antiAirChaser.body.onGround = true;
antiAirChaser.update(1 / 60, { x: 100, y: -120, vx: -80, vy: -200, onGround: false, width: 40, height: 80 });
assert(antiAirChaser.body.vy < 0, 'enemy AI: close chaser should hop/lunge upward when the player is above');

const ranged = new RangedEnemy(420, 0);
for (let i = 0; i < 140; i++) {
  ranged.update(1 / 60, { x: 100, y: 0, vx: -360, vy: 0, onGround: true, width: 40, height: 80 });
}
assert(ranged.pendingShot === true, 'enemy AI: ranged enemy should queue a shot at ideal distance');
assert(Number.isFinite(ranged.pendingShotLead), 'enemy AI: ranged enemy should expose a predictive shot lead');
assert(typeof ranged.pendingShotHigh === 'boolean', 'enemy AI: ranged enemy should expose whether the queued shot is high');

const physicsFullPath = path.join(projectRoot, 'src/engine/physics.ts');
const physicsJs = ts.transpileModule(read('src/engine/physics.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const physicsModule = { exports: {} };
new Function('exports', 'module', '__filename', '__dirname', physicsJs)(
  physicsModule.exports,
  physicsModule,
  physicsFullPath,
  path.dirname(physicsFullPath)
);
const { PhysicsEngine, Body: PhysicsBody } = physicsModule.exports;

const physics = new PhysicsEngine();
physics.setGroundY(300);
physics.setGroundGaps([{ x: 80, w: 100 }]);

const gapBody = new PhysicsBody();
gapBody.x = 110;
gapBody.y = 270;
gapBody.w = 30;
gapBody.h = 30;
physics.addBody(gapBody);
physics.step(1 / 60);
assert(gapBody.onGround === false, 'gap terrain: body over a gap should fall instead of landing on invisible ground');

const solidBody = new PhysicsBody();
solidBody.x = 10;
solidBody.y = 270;
solidBody.w = 30;
solidBody.h = 30;
physics.addBody(solidBody);
physics.step(1 / 60);
assert(solidBody.onGround === true, 'gap terrain: body outside gaps should still land on ground');

console.log('Arcade gauntlet contract passed.');
