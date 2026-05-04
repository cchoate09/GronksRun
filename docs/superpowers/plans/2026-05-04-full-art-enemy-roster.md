# Full Art And Enemy Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the runtime character/enemy/obstacle art with OpenAI-generated atlases, increase grounded speed relative to air movement, and add more enemy types with distinct behaviors.

**Architecture:** Keep the current Pixi fixed-grid sprite path, but swap runtime definitions to generated atlas files under `assets/spritesheets/openai/`. Extend `EnemyKind` and `Enemy` subclasses for new behaviors while keeping `GameScene` as the spawn/orchestration owner. Add source/runtime contracts and one browser smoke that proves the new roster, speed contrast, and art references are live.

**Tech Stack:** TypeScript, Pixi.js, Webpack, Sharp/PNG processing, Puppeteer smoke scripts, OpenAI image generation through the built-in imagegen tool.

---

### Task 1: Contract

**Files:**
- Create: `scripts/full_art_enemy_roster_contract_check.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing contract**

Create a Node script that asserts:
- `Player` grounded sustained speed is at least `640`.
- Airborne sustained speed is at most `72%` of grounded speed and at least `55%`.
- `spriteData.ts` imports OpenAI replacement atlas files from `assets/spritesheets/openai/`.
- `EnemyKind` includes `BOMBER`, `DIVER`, `PTERO`, and `GUARDIAN`.
- `Enemy.ts` exports concrete classes for the new enemies.
- `GameScene` creates and spawns the new enemy types.
- snapshots expose at least seven distinct enemy mechanics across campaign levels.

- [ ] **Step 2: Run the contract and verify red**

Run: `node scripts/full_art_enemy_roster_contract_check.js`
Expected: FAIL on missing OpenAI replacement atlas imports and/or missing new enemy types.

### Task 2: Generated Atlas Assets

**Files:**
- Create: `assets/spritesheets/openai/hero-arcade.png`
- Create: `assets/spritesheets/openai/enemies-core.png`
- Create: `assets/spritesheets/openai/enemies-extra.png`
- Create: `assets/spritesheets/openai/obstacles.png`

- [ ] **Step 1: Generate source atlases**

Use built-in `image_gen` for four flat chroma-key atlas prompts:
- Hero: 4 columns x 4 rows, full-body arcade runner frames.
- Core enemies: 4 columns x 4 rows, rows for chaser, ranged caster, armored brute, serpent.
- Extra enemies: 4 columns x 4 rows, rows for bomber, flying diver, ptero swooper, shield guardian.
- Obstacles: 4 columns x 3 rows, spikes, fire vent, bombs, log/barrier shapes.

- [ ] **Step 2: Normalize to project assets**

Copy generated files into `assets/spritesheets/openai/`, remove chroma key when practical, and ensure each final PNG has stable dimensions and readable cells.

### Task 3: Sprite Data Wiring

**Files:**
- Modify: `src/game/assets/spriteData.ts`
- Modify: `src/game/entities/SkeletalSprite.ts`

- [ ] **Step 1: Wire generated atlases**

Import the new OpenAI atlas PNGs and point `HERO_SHEETS.gronk` plus every live `ENEMY_SHEETS` entry at those atlases. Use absolute frame indices for enemy rows in shared atlases.

- [ ] **Step 2: Support per-sheet sprite offsets**

Add optional `anchorX`, `anchorY`, and `spriteOffsetY` fields to `SpriteSheetDefinition` so the new sheets can be aligned without changing physics hitboxes.

### Task 4: Movement Tuning

**Files:**
- Modify: `src/game/entities/Player.ts`

- [ ] **Step 1: Increase ground speed contrast**

Set grounded speed near `660`, airborne multiplier near `0.68`, stronger ground acceleration, and explicit airborne speed clamp so jumping no longer preserves a faster-feeling horizontal velocity.

### Task 5: Enemy Roster

**Files:**
- Modify: `src/game/entities/Enemy.ts`
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/assets/spriteData.ts`

- [ ] **Step 1: Add enemy types**

Add:
- `BomberEnemy`: keeps distance and lobs arcing bombs.
- `DiverEnemy`: flying enemy with hover and dive attack.
- `PteroEnemy`: fast aerial swooper that crosses the player lane.
- `GuardianEnemy`: shielded guard with reduced frontal damage and counter-charge.

- [ ] **Step 2: Spawn the new types**

Update campaign and endless pools/spawn patterns so new enemies appear from midgame onward, with a small chance in endless once depth unlocks them.

### Task 6: Obstacle Art

**Files:**
- Modify: `src/game/scenes/GameScene.ts`
- Modify: `src/game/assets/spriteData.ts`

- [ ] **Step 1: Render generated obstacle cells**

Use the obstacle atlas to add sprite overlays for spikes and fire vents while keeping the existing Graphics fallback for collision clarity.

### Task 7: Verification

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Run verification**

Run:
- `npx tsc --noEmit`
- `npm run check:gameplay-contracts`
- `npm run qa:visual`
- `npm run qa:arcade-gauntlet`

- [ ] **Step 2: Inspect screenshots**

Open:
- `output/web-game-current-objective/shot-0.png`
- `output/arcade-gauntlet/near-gap.png`
- a new roster/art smoke screenshot if added

Confirm generated sprites and obstacle overlays are visible, readable, and do not obscure UI.
