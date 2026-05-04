# Run Feel, Variety, And Biome Art Design

## Goal

Implement a stronger Option B pass: calibrate airborne movement so jumping does not make the player faster than grounded running, end levels when the target kill count is reached, add more readable level-to-level variation, and use OpenAI-generated bitmap art where it can improve the game without destabilizing character animation.

## Scope

This pass keeps the existing playable hero and enemy sprite sheets. It does not rebuild every animation. The art upgrade focuses on generated biome background plates and runtime background composition, which carries lower gameplay risk and is visible immediately.

## Gameplay Changes

- Airborne horizontal target speed should be lower than grounded speed, around 85% of ground speed, while retaining enough air control to feel responsive.
- Level completion should trigger as soon as `kills >= targetKills`; reaching the far endpoint should no longer be required.
- Levels should gain explicit modifiers that describe route style, hazard density, spawn pressure, and visual identity. These modifiers should be visible in `render_game_to_text()` so automated checks can validate them.
- Stronger variation should include route/hazard differences, not only palette changes: low lanes, high platforms, crossfire routes, guard waves, and elevated platform chains.

## Art Direction

Use OpenAI image generation for a six-biome background panorama strip covering:

- Ruined Coast
- Moonlit Road
- Temple Jungle
- Ash Ravine
- Glass City
- Sky Forge

The generated image should be integrated as a distant background layer behind existing Pixi procedural geometry. Runtime gameplay sprites stay in front of the generated layer. The layer should be subtle enough that HUD, enemies, platforms, and player silhouettes remain readable.

## Testing

Add a contract/runtime check before implementation that fails on the current code:

- Grounded top speed must be greater than airborne sustained speed.
- Level completion source must not require endpoint distance after target kills.
- All authored campaign levels must define modifiers.
- Level modifier diversity must exceed the previous terrain/spawn-only variety.
- Background manager must integrate generated bitmap art.

After implementation, rerun:

- `node scripts/current_tuning_contract_check.js`
- `npx tsc --noEmit`
- `npm run build:webview`
- `npm run verify:webview-bundle`
- `npm run check:gameplay-contracts`
- `npm run qa:visual`

## Approval

The user approved the visual companion Option B and requested stronger changes without a full Option C rebuild.
