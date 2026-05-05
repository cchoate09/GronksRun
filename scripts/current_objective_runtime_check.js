const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

  update() {}
}

class MockInput {
  constructor({ down = [], just = [], actions = [] } = {}) {
    this.down = new Set(down);
    this.just = new Set(just);
    this.actions = new Set(actions);
  }

  isDown(code) {
    return this.down.has(code);
  }

  justPressed(code) {
    return this.just.has(code);
  }

  actionJustPressed(name) {
    return this.actions.has(name);
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
    if (request === '../assets/spriteData') return { HERO_SHEETS: { gronk: {} }, ENEMY_SHEETS: { CHASER: {}, RANGED: {}, HEAVY: {}, SERPENT: {} } };
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

const { Player } = loadTs('src/game/entities/Player.ts');
const { Enemy } = loadTs('src/game/entities/Enemy.ts');

const movingAttacker = new Player();
movingAttacker.body.onGround = true;
movingAttacker.update(1 / 60, new MockInput({ down: ['ArrowRight'], just: ['Space'] }));
assert(movingAttacker.body.vx > 0, 'runtime: player should keep moving right on the same frame as melee attack');
assert(movingAttacker.isAttacking === true, 'runtime: melee action should start attack while moving');
assert(movingAttacker.attackMode === 'MELEE', 'runtime: melee action should set MELEE mode');

const vxDuringWindup = movingAttacker.body.vx;
movingAttacker.update(0.11, new MockInput({ down: ['ArrowRight'] }));
assert(movingAttacker.body.vx > vxDuringWindup, 'runtime: player should continue accelerating during attack wind-up/active frames');
assert(movingAttacker.attackPhase === 'ACTIVE', 'runtime: attack should reach an active strike phase while movement remains active');
assert(movingAttacker.isSlashVisible() === true, 'runtime: active melee should expose visible slash feedback');
assert(movingAttacker.runningAttackBlend === true, 'runtime: melee should expose running attack blend while movement is held');

const movingShooter = new Player();
movingShooter.body.onGround = true;
movingShooter.update(1 / 60, new MockInput({ down: ['ArrowRight'], actions: ['ranged'] }));
assert(movingShooter.body.vx > 0, 'runtime: ranged attack should allow movement on the same frame');
assert(movingShooter.attackMode === 'RANGED', 'runtime: ranged action should set RANGED mode');
assert(movingShooter.isRangedPoseVisible() === true, 'runtime: ranged action should show a ranged attack pose');
assert(movingShooter.runningAttackBlend === true, 'runtime: ranged action should expose running attack blend while movement is held');

const jumpPlayer = new Player();
jumpPlayer.body.onGround = true;
jumpPlayer.update(1 / 60, new MockInput({ actions: ['jump'] }));
assert(jumpPlayer.body.vy < 0, 'runtime: native jump action should launch player upward');
assert(jumpPlayer.body.onGround === false, 'runtime: native jump action should leave the ground');

const pressureEnemy = new Enemy(130, 0, 'CHASER');
pressureEnemy.update(1 / 60, 100);
assert(pressureEnemy.isAttacking === true, 'runtime: close chaser should enter attack/lunge state near the player');
assert(pressureEnemy.body.vx < 0, 'runtime: close chaser should keep moving into the player instead of stopping');
assert(pressureEnemy.canDealContactDamage() === true, 'runtime: close chaser should be eligible for contact pressure while lunging');

console.log('Current objective runtime check passed.');
