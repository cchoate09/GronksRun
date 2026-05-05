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

const playerSource = read('src/game/entities/Player.ts');
const gameSceneSource = read('src/game/scenes/GameScene.ts');
const backgroundSource = read('src/game/levels/BackgroundManager.ts');

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
  setState() {}
  setFacingRight() {}
  setRangedAttackCue() {}
  setMeleeAttackCue() {}
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

function loadPlayer() {
  const fullPath = path.join(projectRoot, 'src/game/entities/Player.ts');
  const source = fs.readFileSync(fullPath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === 'pixi.js') return { Container, Graphics };
    if (request.endsWith('/physics')) return { Body };
    if (request === './SkeletalSprite') return { SkeletalSprite };
    if (request === '../assets/spriteData') return { HERO_SHEETS: { gronk: {} } };
    throw new Error(`Unexpected test require from Player.ts: ${request}`);
  };
  new Function('require', 'exports', 'module', '__filename', '__dirname', js)(
    localRequire,
    module.exports,
    module,
    fullPath,
    path.dirname(fullPath)
  );
  return module.exports.Player;
}

assert(playerSource.includes('airSpeedMultiplier'), 'jump tuning: Player should define an airborne speed multiplier');
assert(
  /const\s+targetSpeed\s*=\s*this\.body\.onGround\s*\?\s*this\.speed\s*:\s*this\.speed\s*\*\s*this\.airSpeedMultiplier/.test(playerSource),
  'jump tuning: airborne target speed should be lower than grounded speed'
);
assert(
  !gameSceneSource.includes('this.player.body.x >= this.level.levelLength'),
  'completion tuning: target kills should complete the level without endpoint distance'
);
assert(gameSceneSource.includes('levelModifiers'), 'level variety: level definitions should expose levelModifiers');
assert(gameSceneSource.includes('hazardDensity'), 'level variety: modifiers should include hazardDensity');
assert(gameSceneSource.includes('routeStyle'), 'level variety: modifiers should include routeStyle');
assert(backgroundSource.includes('biomePanorama'), 'art pass: BackgroundManager should import generated biome panorama art');
assert(backgroundSource.includes('Sprite'), 'art pass: BackgroundManager should render bitmap art with Pixi Sprite');

const sourceFile = ts.createSourceFile('GameScene.ts', gameSceneSource, ts.ScriptTarget.Latest, true);
let levelsDeclaration = null;
sourceFile.forEachChild((node) => {
  if (!ts.isVariableStatement(node)) return;
  for (const declaration of node.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && declaration.name.text === 'LEVELS') {
      levelsDeclaration = declaration;
    }
  }
});

assert(levelsDeclaration, 'level variety: LEVELS declaration should exist');
assert(ts.isArrayLiteralExpression(levelsDeclaration.initializer), 'level variety: LEVELS should remain a literal array');
const levelText = levelsDeclaration.initializer.getText(sourceFile);
assert((levelText.match(/levelModifiers:/g) || []).length >= 10, 'level variety: every campaign level should declare levelModifiers');
assert(
  new Set([...levelText.matchAll(/routeStyle:\s*'([^']+)'/g)].map((match) => match[1])).size >= 6,
  'level variety: route styles should vary across campaign'
);
assert(
  new Set([...levelText.matchAll(/hazardDensity:\s*([0-9.]+)/g)].map((match) => match[1])).size >= 5,
  'level variety: hazard density should vary across campaign'
);

global.window = { innerWidth: 1280, innerHeight: 720 };
const Player = loadPlayer();

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

assert(grounded.body.vx > 420, `jump tuning: grounded sustained speed should reach run speed, got ${grounded.body.vx}`);
assert(airborne.body.vx < grounded.body.vx * 0.9, `jump tuning: airborne sustained speed should stay below grounded speed, got air=${airborne.body.vx} ground=${grounded.body.vx}`);
assert(airborne.body.vx > grounded.body.vx * 0.6, `jump tuning: airborne control should remain responsive, got air=${airborne.body.vx} ground=${grounded.body.vx}`);

console.log('Current tuning contract passed.');
