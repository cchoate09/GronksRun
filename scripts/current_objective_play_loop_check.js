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

function getProperty(objectLiteral, name) {
  return objectLiteral.properties.find((property) => {
    return ts.isPropertyAssignment(property)
      && ts.isIdentifier(property.name)
      && property.name.text === name;
  });
}

function literalValue(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  throw new Error(`Unsupported literal in level definition: ${node.getText()}`);
}

function parseLevels() {
  const sourceText = read('src/game/scenes/GameScene.ts');
  const sourceFile = ts.createSourceFile('GameScene.ts', sourceText, ts.ScriptTarget.Latest, true);
  let levelsDeclaration = null;

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'LEVELS') {
        levelsDeclaration = declaration;
      }
    }
  });

  assert(levelsDeclaration, 'play loop contract: LEVELS declaration should exist');
  assert(ts.isArrayLiteralExpression(levelsDeclaration.initializer), 'play loop contract: LEVELS should be a literal array');

  return levelsDeclaration.initializer.elements.map((element) => {
    assert(ts.isObjectLiteralExpression(element), 'play loop contract: each level should be an object literal');
    const level = {};
    for (const key of [
      'id',
      'name',
      'biome',
      'targetKills',
      'maxActive',
      'enemyKinds',
      'spawnGap',
      'runUpDistance',
      'encounterSpacing',
      'levelLength',
      'reward',
      'terrainProfile',
      'spawnPattern',
    ]) {
      const property = getProperty(element, key);
      assert(property, `play loop contract: level should define ${key}`);
      level[key] = literalValue(property.initializer);
    }
    return level;
  });
}

function loadMenuLayout() {
  const source = read('src/game/scenes/menuLayout.ts');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', js)(module.exports, module);
  return module.exports.getMainMenuLayout;
}

const levels = parseLevels();
const getMainMenuLayout = loadMenuLayout();

assert(levels.length === 40, `play loop contract: campaign should include exactly 40 authored levels, got ${levels.length}`);
assert(levels[0].id === 1 && levels[levels.length - 1].id === 40, 'play loop contract: authored level ids should span 1 through 40');

const terrainProfiles = new Set(levels.map((level) => level.terrainProfile));
const biomes = new Set(levels.map((level) => level.biome));
const spawnSignatures = new Set(levels.map((level) => level.spawnPattern.join(',')));
const enemyRoster = new Set(levels.flatMap((level) => level.enemyKinds));

assert(terrainProfiles.size >= 6, 'play loop contract: terrain profiles should vary across the campaign');
assert(biomes.size >= 6, 'play loop contract: biome presentation should vary across the campaign');
assert(spawnSignatures.size >= 6, 'play loop contract: spawn patterns should not repeat monotonously');
assert(enemyRoster.has('CHASER') && enemyRoster.has('RANGED') && enemyRoster.has('HEAVY') && enemyRoster.has('SERPENT'), 'play loop contract: campaign should use the full current enemy roster');

for (const level of levels) {
  const undeclaredPatternKinds = level.spawnPattern.filter((kind) => !level.enemyKinds.includes(kind));
  assert(undeclaredPatternKinds.length === 0, `play loop contract: ${level.name} spawnPattern should only use declared enemyKinds`);

  const estimatedSeconds = level.levelLength / 430;
  assert(estimatedSeconds >= 60 && estimatedSeconds <= 180, `play loop contract: ${level.name} should sit in a 1-3 minute run window`);

  const killsPerMinute = level.targetKills / (estimatedSeconds / 60);
  assert(killsPerMinute >= 14 && killsPerMinute <= 24, `play loop contract: ${level.name} should keep combat density in an engaging range`);

  assert(level.runUpDistance >= 700 && level.runUpDistance <= 1100, `play loop contract: ${level.name} should start with a readable run-up`);
  assert(level.encounterSpacing >= 450 && level.encounterSpacing <= 700, `play loop contract: ${level.name} encounter spacing should stay active without becoming a room-brawler`);
}

for (let i = 1; i < levels.length; i++) {
  assert(levels[i].levelLength >= levels[i - 1].levelLength, 'play loop contract: authored level length should ramp up over the campaign');
  assert(levels[i].targetKills >= levels[i - 1].targetKills, 'play loop contract: target kills should ramp up over the campaign');
}

assert(levels[0].enemyKinds.length === 1 && levels[0].enemyKinds[0] === 'CHASER', 'play loop contract: first level should remain readable with one enemy type');
assert(levels[levels.length - 1].enemyKinds.length >= 4, 'play loop contract: final level should combine enemy types for variety');
assert(Math.max(...levels.map((level) => level.maxActive)) >= 5, 'play loop contract: later levels should raise active enemy pressure');

for (const viewport of [
  { width: 844, height: 390 },
  { width: 640, height: 360 },
  { width: 1280, height: 720 },
]) {
  const layout = getMainMenuLayout(viewport.width, viewport.height);
  const levelSelectButton = layout.buttons.find((button) => button.label === 'LEVEL SELECT');
  assert(levelSelectButton, 'play loop contract: home menu should include the level-select button');
  assert(levelSelectButton.y + levelSelectButton.h <= viewport.height - 18, `play loop contract: third button should stay on-screen at ${viewport.width}x${viewport.height}`);
}

console.log('Current objective play-loop check passed.');
