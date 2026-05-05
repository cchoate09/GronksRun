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
    this.rotation = 0;
    this.visible = true;
  }

  addChild(...children) {
    this.children.push(...children);
    return children[0];
  }
}

class Graphics extends Container {
  clear() { return this; }
  rect() { return this; }
  circle() { return this; }
  ellipse() { return this; }
  moveTo() { return this; }
  lineTo() { return this; }
  quadraticCurveTo() { return this; }
  fill() { return this; }
  stroke() { return this; }
}

class Rectangle {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

class Texture {
  constructor({ source, frame } = {}) {
    this.source = source || {};
    this.frame = frame || null;
  }

  static from(image) {
    return new Texture({ source: { image } });
  }
}

class Sprite extends Container {
  constructor(texture) {
    super();
    this.texture = texture;
    this.anchor = makePoint();
    this.tint = 0xffffff;
  }
}

function loadSkeletalSprite() {
  const fullPath = path.join(projectRoot, 'src', 'game', 'entities', 'SkeletalSprite.ts');
  const source = fs.readFileSync(fullPath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === 'pixi.js') return { Container, Graphics, Rectangle, Sprite, Texture };
    if (request === '../assets/spriteData') return {};
    throw new Error(`Unexpected require from SkeletalSprite.ts: ${request}`);
  };
  new Function('require', 'exports', 'module', '__filename', '__dirname', js)(
    localRequire,
    module.exports,
    module,
    fullPath,
    path.dirname(fullPath)
  );
  return module.exports.SkeletalSprite;
}

const spriteDataSource = fs.readFileSync(path.join(projectRoot, 'src', 'game', 'assets', 'spriteData.ts'), 'utf8');
assert(spriteDataSource.includes('facesRight?: boolean'), 'sprite data should declare source-facing metadata');
assert(/gronk:[\s\S]*facesRight:\s*true/.test(spriteDataSource), 'hero sheet should be marked as right-facing source art');
for (const kind of ['CHASER', 'RANGED', 'HEAVY', 'SERPENT', 'BOMBER', 'DIVER', 'PTERO', 'GUARDIAN']) {
  assert(new RegExp(`${kind}:[\\s\\S]*?facesRight:\\s*false`).test(spriteDataSource), `${kind} sheet should be marked as left-facing source art`);
}

const SkeletalSprite = loadSkeletalSprite();
const leftFacingSheet = {
  image: 'dummy.png',
  cols: 2,
  rows: 2,
  width: 200,
  height: 200,
  fps: 8,
  scale: 1,
  facesRight: false,
  spriteOffsetX: 20,
  spriteOffsetY: 80,
  animations: {
    IDLE: [0],
    RUN: [1, 2],
    ATTACK: [3],
    HIT: [0],
  },
};

const sprite = new SkeletalSprite(0xffffff, leftFacingSheet);
assert(typeof sprite.setFacingRight === 'function', 'SkeletalSprite should expose setFacingRight()');

sprite.setFacingRight(false, 50);
assert(sprite.scale.x === 1, `left-facing source art should not flip when facing left, got scale.x=${sprite.scale.x}`);
assert(sprite.x === 0, `left-facing source art should stay at x=0 when facing left, got x=${sprite.x}`);

sprite.setFacingRight(true, 50);
assert(sprite.scale.x === -1, `left-facing source art should flip when facing right, got scale.x=${sprite.scale.x}`);
assert(sprite.x === 50, `flipped sprite should be offset by body width, got x=${sprite.x}`);

sprite.setState('RUN');
sprite.update(0.12, 2);
const runY = sprite.sheetSprite.position.y;
const runRotation = sprite.sheetSprite.rotation;
sprite.setState('IDLE');
sprite.update(0.12, 1);
assert(runY !== leftFacingSheet.spriteOffsetY || runRotation !== 0, 'sheet-backed RUN state should add visible pose motion beyond frame changes');

console.log('Sprite motion/orientation contract passed.');
