# GronksRun Graphics Roadmap

## Goal
Improve GronksRun's visual quality in structured phases without destabilizing gameplay.

## Current Rendering Architecture
- Expo wrapper in `App.js`
- Main game rendered inside WebView via generated HTML/JS
- Primary game source currently lives in `gronk-run/index.html`
- Large canvas-driven procedural rendering pipeline
- Most gameplay visuals are code-drawn, not sprite-driven

---

# Phase 1 — Cheap Wins / High ROI Polish

## Objective
Make the game look noticeably better without rewriting the rendering architecture.

## Phase 1 Priorities
1. Improve gameplay readability
   - Stronger silhouette separation for player, enemies, hazards, projectiles
   - Make danger states easier to recognize at a glance

2. Improve biome identity
   - Push each biome beyond palette swaps
   - Add more distinct atmosphere, lighting, and decoration behavior

3. Improve lighting/depth
   - Better contact shadows
   - More consistent highlights/rim lighting
   - Subtle fog/atmospheric overlays by biome

4. Improve juice/animation polish
   - Stronger anticipation/impact on jumps, hits, dashes, pickups
   - Better telegraphs for enemies and bosses

5. Improve HUD/UI presentation
   - Reduce debug/prototype feel
   - Make menus and HUD feel more game-like and stylistically consistent

## Candidate Code Areas for Phase 1
- `drawChar(p, mini)`
  - Player silhouette, shading, impact readability, dash/slide visual upgrades
- `drawEnemies()`
  - Enemy silhouette clarity, better contrast, stronger telegraph readability
- `drawObs()`
  - Obstacle readability and biome-specific identity
- `drawBg(theme)` / `drawTerrain(theme)` / `drawDeco(type, x, y)`
  - Background depth, biome atmosphere, environmental identity
- `drawHUD(dt)`
  - Gameplay UI cleanup and polish
- `drawMenu()` / `drawCharSelect()` / `drawLevelMap()` / `drawLevelComplete()`
  - Menu/UI aesthetic polish
- Boss rendering / telegraphs
  - `drawBoss()` / `drawBossHPBar()` / related projectile rendering

## Proposed Phase 1 Task Order

### Task 1.1 — Visual Audit + Palette Rules
Status: IN PROGRESS
Priority: P0
Define a cleaner visual language for:
- player
- enemies
- hazards
- collectibles
- UI
- each biome

Deliverable:
- short art-direction section in this file or a dedicated style guide

### Task 1.2 — Player Readability Pass
Status: IN PROGRESS
Priority: P0
Focus areas:
- stronger silhouette
- better face readability at speed
- stronger contact shadow
- cleaner body lighting
- better dash/slide afterimage and impact frames

Primary code:
- `drawChar(p, mini)`

### Task 1.3 — Enemy Readability Pass
Status: PARTIAL DONE
Priority: P1
Focus areas:
- unique silhouettes per enemy archetype
- stronger attack telegraphs
- cleaner projectile styling
- less visual blending between enemy classes

Primary code:
- `drawEnemies()`
- enemy projectile rendering blocks

### Task 1.4 — Obstacle + Projectile Clarity Pass
Status: PARTIAL DONE
Priority: P1
Focus areas:
- hazards should read as hazards instantly
- more biome-specific hazard variants visually
- better ground contrast and collision readability

Primary code:
- `drawObs()`
- projectile rendering blocks in `drawEnemies()` and `drawBoss()`

### Task 1.5 — Biome Atmosphere Pass
Status: PARTIAL DONE
Priority: P1
Focus areas:
- better sky mood
- biome overlays/fog/haze
- more distinct ground deco language
- stronger foreground/background separation

Primary code:
- `drawBg(theme)`
- `drawTerrain(theme)`
- `drawDeco(type, x, y)`
- `drawAmbient(type)`

### Task 1.6 — HUD/Menu Polish Pass
Status: PARTIAL DONE
Priority: P2
Focus areas:
- cleaner HUD hierarchy
- more premium button treatment
- reduce prototype/debug visual feel

Primary code:
- `drawHUD(dt)`
- menu/map/tutorial/complete/death screen draw functions

### Task 1.7 — Boss Polish Pass
Status: TODO
Priority: P2
Focus areas:
- stronger boss readability
- phase escalation clearer visually
- better telegraphs and projectile punch

Primary code:
- `drawBoss()`
- `drawBossHPBar()`
- boss projectile render paths

## Phase 1 Visual Rules (Initial Pass)
- Favor strong silhouettes over extra tiny detail.
- Player should read instantly as the hero: brighter, cleaner outline, stronger face contrast.
- Hazards should bias toward high contrast and sharp shapes.
- Enemies should separate by shape language first, color second.
- Each biome should get one atmospheric signature beyond palette alone.
- FX should support readability first, spectacle second.
- UI should feel playful and game-like, not terminal-like.

---

# Phase 2 — Medium Lift / Curated Art Replacement

## Objective
Replace the most important procedural visuals with more intentional, curated art while keeping the existing gameplay structure.

## Phase 2 Priorities
1. Replace player art with curated assets or much more refined renderer
2. Replace enemy visuals with curated assets / stricter shape language
3. Replace major obstacle visuals
4. Upgrade boss presentation significantly
5. Introduce a more systematic visual asset pipeline for gameplay-critical elements

## Likely Deliverables
- New player art system
- New enemy presentation system
- Better obstacle set per biome
- Better icon set / pickups / UI symbols
- Optional hybrid approach: sprites for characters, code for terrain/effects

---

# Phase 3 — Premium Pass / Production Polish

## Objective
Push the game toward release-quality visual presentation.

## Phase 3 Priorities
1. Full art-direction consistency pass
2. Advanced biome composition and atmosphere
3. Better transitions and cinematic feedback
4. Full UI skin / typography / icon treatment
5. Optional architecture cleanup for maintainable rendering iteration

## Likely Deliverables
- Production-ready visual style guide
- Premium background composition
- Transition polish
- Unified UI/UX visual system
- Rendering code modularization for future scaling

---

# Working Rules
- Do Phase 1 first before committing to major asset pipeline changes
- Keep Phase 2 and 3 tracked here as future roadmap, not forgotten ideas
- Prefer changes that improve readability and perceived quality without harming performance
- Avoid large rendering rewrites until Phase 1 wins are validated

# Current Phase 1 Progress Notes
Completed / partially completed so far:
- Initial visual rules established
- Player readability pass started
- Enemy silhouette and telegraph readability pass started
- Hazard / projectile clarity improvements started
- Biome atmosphere overlays started
- HUD framing polish started

# Next Recommended Step
Continue Phase 1 with:
1. finish enemy-by-enemy readability polish
2. deepen hazard differentiation by biome
3. improve menus / title / buttons to reduce prototype feel
4. do a dedicated boss readability pass
