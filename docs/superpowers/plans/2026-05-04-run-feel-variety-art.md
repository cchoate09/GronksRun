# Run Feel Variety Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tune jump movement, kill-count completion, level variety, and generated biome background art.

**Architecture:** Add a focused contract script first, then make narrowly scoped gameplay changes in `Player.ts`, `GameScene.ts`, and `BackgroundManager.ts`. Generated biome art is imported through Webpack like existing sprite-sheet assets and rendered behind procedural Pixi layers.

**Tech Stack:** TypeScript, Pixi.js, Webpack image imports, Node contract scripts, Sharp for any image normalization, develop-web-game Playwright QA.

---

### Task 1: Test Current Tuning Requirements

**Files:**
- Create: `scripts/current_tuning_contract_check.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing contract script**

Create `scripts/current_tuning_contract_check.js` with these checks:

```js
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

assert(playerSource.includes('airSpeedMultiplier'), 'jump tuning: Player should define an airborne speed multiplier');
assert(/const\s+targetSpeed\s*=\s*this\.body\.onGround\s*\?\s*this\.speed\s*:\s*this\.speed\s*\*\s*this\.airSpeedMultiplier/.test(playerSource), 'jump tuning: airborne target speed should be lower than grounded speed');
assert(!gameSceneSource.includes('this.player.body.x >= this.level.levelLength'), 'completion tuning: target kills should complete the level without endpoint distance');
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
    if (ts.isIdentifier(declaration.name) && declaration.name.text === 'LEVELS') levelsDeclaration = declaration;
  }
});
assert(levelsDeclaration && ts.isArrayLiteralExpression(levelsDeclaration.initializer), 'level variety: LEVELS should remain a literal array');
const levelText = levelsDeclaration.initializer.getText(sourceFile);
assert((levelText.match(/levelModifiers:/g) || []).length >= 10, 'level variety: every campaign level should declare levelModifiers');
assert(new Set([...levelText.matchAll(/routeStyle:\s*'([^']+)'/g)].map((match) => match[1])).size >= 6, 'level variety: route styles should vary across campaign');
assert(new Set([...levelText.matchAll(/hazardDensity:\s*([0-9.]+)/g)].map((match) => match[1])).size >= 5, 'level variety: hazard density should vary across campaign');

console.log('Current tuning contract passed.');
```

- [ ] **Step 2: Run the new script and verify it fails**

Run: `node scripts/current_tuning_contract_check.js`

Expected: FAIL on missing `airSpeedMultiplier`.

- [ ] **Step 3: Wire it into `package.json`**

Append `&& node scripts/current_tuning_contract_check.js` to the end of `check:gameplay-contracts`.

### Task 2: Implement Movement And Completion Tuning

**Files:**
- Modify: `src/game/entities/Player.ts`
- Modify: `src/game/scenes/GameScene.ts`

- [ ] **Step 1: Tune airborne target speed**

In `Player.ts`, add:

```ts
private airSpeedMultiplier: number = 0.85;
```

Replace the horizontal input target with:

```ts
const targetSpeed = this.body.onGround ? this.speed : this.speed * this.airSpeedMultiplier;
let targetVx = 0;
if (input.isDown('ArrowLeft') || input.isDown('KeyA')) {
    targetVx = -targetSpeed;
    this.facingRight = false;
} else if (input.isDown('ArrowRight') || input.isDown('KeyD')) {
    targetVx = targetSpeed;
    this.facingRight = true;
}
```

- [ ] **Step 2: Complete on kills**

Replace `checkLevelCompletion()` in `GameScene.ts` with:

```ts
private checkLevelCompletion(): void {
    if (this.hasMetLevelGoal()) {
        this.completeLevel();
    }
}
```

### Task 3: Add Stronger Level Modifiers

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `scripts/current_objective_play_loop_check.js`

- [ ] **Step 1: Add modifier types**

Add:

```ts
export type RouteStyle = 'flat-pressure' | 'broken-climb' | 'crossfire-steps' | 'low-serpent' | 'guard-bridges' | 'hazard-ridge' | 'heavy-bridge' | 'ambush-switchbacks' | 'rush-lanes' | 'sky-chains';

export interface LevelModifiers {
    routeStyle: RouteStyle;
    hazardDensity: number;
    verticality: number;
    pressureBias: 'steady' | 'ranged' | 'serpent' | 'heavy' | 'mixed';
}
```

Add `levelModifiers: LevelModifiers;` to `LevelDefinition`.

- [ ] **Step 2: Add modifiers to all campaign levels**

Each `LEVELS` entry should include a distinct `levelModifiers` object. Example for level 1:

```ts
levelModifiers: { routeStyle: 'flat-pressure', hazardDensity: 0.08, verticality: 0.15, pressureBias: 'steady' }
```

- [ ] **Step 3: Use modifiers in platform generation**

In `buildTerrainPlatforms()`, use `hazardDensity` and `verticality` to adjust count and height:

```ts
const modifiers = this.level.levelModifiers;
const count = Math.min(24, Math.max(2, Math.floor((this.level.levelLength - 1200) / (1700 - modifiers.hazardDensity * 460)) + Math.floor(depth / 5)));
```

Then add `modifiers.verticality * 40` to elevated platform formulas where appropriate.

- [ ] **Step 4: Expose modifiers in snapshots**

Add to `variety` snapshot:

```ts
level_modifiers: this.level.levelModifiers,
```

### Task 4: Integrate Generated Biome Art

**Files:**
- Create: `assets/backgrounds/biome-panorama.png`
- Modify: `src/game/levels/BackgroundManager.ts`

- [ ] **Step 1: Generate one six-biome panorama image**

Use OpenAI image generation for a six-panel 2D side-scroller background strip with no text, no characters, and clear biome separation.

- [ ] **Step 2: Normalize and save it**

Save the selected image to `assets/backgrounds/biome-panorama.png`.

- [ ] **Step 3: Render it in `BackgroundManager.ts`**

Import `Sprite` and the generated asset:

```ts
import { Container, Graphics, Sprite } from 'pixi.js';
import biomePanorama from '../../../assets/backgrounds/biome-panorama.png';
```

Create a low-alpha art layer before procedural layers. Scale it to six screen widths, shift by biome index, and set a slow parallax value.

### Task 5: Verify

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Run contracts**

Run:

```powershell
node scripts/current_tuning_contract_check.js
npm run check:gameplay-contracts
```

Expected: both pass.

- [ ] **Step 2: Build and visual QA**

Run:

```powershell
npx tsc --noEmit
npm run build:webview
npm run verify:webview-bundle
npm run qa:visual
```

Expected: exit 0; inspect the latest gameplay screenshot for visible generated biome art, readable player/enemy silhouettes, and level completion state behavior in JSON.
