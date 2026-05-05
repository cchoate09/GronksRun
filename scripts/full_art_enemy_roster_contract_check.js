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
      ENEMY_SHEETS: {
        CHASER: {},
        RANGED: {},
        HEAVY: {},
        SERPENT: {},
        BOMBER: {},
        DIVER: {},
        PTERO: {},
        GUARDIAN: {},
      },
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
const gameSceneSource = read('src/game/scenes/GameScene.ts');
const spriteDataSource = read('src/game/assets/spriteData.ts');

const openAiAssets = [
  'assets/spritesheets/openai/hero-arcade.png',
  'assets/spritesheets/openai/enemies-core.png',
  'assets/spritesheets/openai/enemies-extra.png',
  'assets/spritesheets/openai/obstacles.png',
];

for (const asset of openAiAssets) {
  assert(fs.existsSync(path.join(projectRoot, asset)), `art replacement: expected generated asset ${asset}`);
}

assert(spriteDataSource.includes('openai/hero-arcade.png'), 'art replacement: hero should use OpenAI-generated atlas');
assert(spriteDataSource.includes('openai/enemies-core.png'), 'art replacement: core enemies should use OpenAI-generated atlas');
assert(spriteDataSource.includes('openai/enemies-extra.png'), 'art replacement: extra enemies should use OpenAI-generated atlas');
assert(spriteDataSource.includes('openai/obstacles.png'), 'art replacement: obstacles should use OpenAI-generated atlas');
assert(spriteDataSource.includes('OBSTACLE_SHEET'), 'art replacement: obstacle atlas should be exported for scene rendering');

for (const kind of ['BOMBER', 'DIVER', 'PTERO', 'GUARDIAN']) {
  assert(gameSceneSource.includes(kind), `enemy roster: GameScene should include ${kind}`);
  assert(spriteDataSource.includes(`${kind}:`), `enemy roster: spriteData should define ${kind}`);
  assert(enemySource.includes(kind), `enemy roster: Enemy.ts should include ${kind}`);
}

for (const className of ['BomberEnemy', 'DiverEnemy', 'PteroEnemy', 'GuardianEnemy']) {
  assert(enemySource.includes(`class ${className}`) || enemySource.includes(`export class ${className}`), `enemy behavior: ${className} should exist`);
}

assert(enemySource.includes('pendingBomb'), 'enemy behavior: bomber should queue lobbed bomb attacks');
assert(enemySource.includes('diveAttack'), 'enemy behavior: aerial enemies should have dive behavior');
assert(enemySource.includes('shielded_guardian'), 'enemy behavior: guardian should expose shielded mechanic');
assert(gameSceneSource.includes('renderObstacleSprites'), 'obstacle art: scene should render generated obstacle sprites');
assert(gameSceneSource.includes('startingEnemyCount'), 'enemy roster: spawn waves should preserve pattern order while adding enemies');

const levelKinds = new Set([...gameSceneSource.matchAll(/enemyKinds:\s*\[([^\]]+)\]/g)]
  .flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((kindMatch) => kindMatch[1])));
for (const kind of ['BOMBER', 'DIVER', 'PTERO', 'GUARDIAN']) {
  assert(levelKinds.has(kind), `enemy roster: campaign levels should include ${kind}`);
}

const mechanics = new Set([...gameSceneSource.matchAll(/mechanic:\s*enemy\.mechanic/g)].map((match) => match[0]));
assert(mechanics.size >= 1, 'snapshot: enemy mechanic telemetry should remain exposed');

const { Player } = loadTs('src/game/entities/Player.ts');
const { BomberEnemy, DiverEnemy, PteroEnemy, GuardianEnemy } = loadTs('src/game/entities/Enemy.ts');

const grounded = new Player();
grounded.body.onGround = true;
for (let i = 0; i < 100; i++) {
  grounded.update(1 / 60, new MockInput({ down: ['ArrowRight'] }));
}

const airborne = new Player();
airborne.body.onGround = false;
for (let i = 0; i < 220; i++) {
  airborne.update(1 / 60, new MockInput({ down: ['ArrowRight'] }));
}

assert(grounded.body.vx >= 640, `speed contrast: grounded speed should be at least 640, got ${grounded.body.vx}`);
assert(airborne.body.vx <= grounded.body.vx * 0.72, `speed contrast: airborne speed should be much lower, got air=${airborne.body.vx} ground=${grounded.body.vx}`);
assert(airborne.body.vx >= grounded.body.vx * 0.55, `speed contrast: airborne control should remain playable, got air=${airborne.body.vx} ground=${grounded.body.vx}`);

const target = { x: 100, y: 300, vx: 260, vy: 0, onGround: true, width: 40, height: 80 };

const bomber = new BomberEnemy(420, 300);
for (let i = 0; i < 150; i++) bomber.update(1 / 60, target);
assert(bomber.pendingBomb === true, 'enemy behavior: bomber should queue a bomb after holding range');

const diver = new DiverEnemy(450, 190);
for (let i = 0; i < 70; i++) {
  diver.update(1 / 60, { ...target, x: 160, y: 330, vx: -220 });
}
assert(diver.body.vy > 0 || diver.isAttacking, 'enemy behavior: diver should descend or attack toward the player lane');

const ptero = new PteroEnemy(500, 170);
ptero.update(1 / 60, { ...target, y: 320, vx: -200 });
assert(Math.abs(ptero.body.vx) > 190, 'enemy behavior: ptero should make fast horizontal swoops');

const guardian = new GuardianEnemy(160, 280);
guardian.update(1 / 60, target);
assert(guardian.mechanic === 'shielded_guardian', 'enemy behavior: guardian should expose shielded mechanic');

console.log('Full art/enemy roster contract passed.');
