# Gronk's Run Improvement TODO

Last updated: 2026-03-27

This backlog excludes the startup fixes and the `LEVEL_COMPLETE` crash that are already fixed. It focuses on the remaining improvements that will raise quality, stability, visual consistency, and launch readiness.

Audit basis:
- Fresh browser captures from the current build: menu, level intro, gameplay HUD, level map, and level complete.
- Code review of `game.js`, especially `drawBg`, `drawTerrain`, `drawChar`, `drawEnemies`, `drawHUD`, `drawMenu`, `drawLevelComplete`, and `drawLevelMap`.
- Asset review of `assets/spritesheets/` and `assets/spritesheets/enemies/`.
- Earlier launch and technical gap analysis from this repo's roadmap docs.

Priority legend:
- P0 = highest-value fix or launch-quality blocker
- P1 = strong polish win
- P2 = medium-term improvement
- P3 = post-launch or optional expansion

## Fresh Findings From The Current Build

- [ ] P0 Unify the visual style across characters, enemies, obstacles, and UI.
  Current assets mix at least three art directions: simple cartoon Gronk/Pip sprites, highly rendered semireal character sheets like Bruk, and much more primitive enemy/obstacle art. The game needs one clear style target and a replacement pass driven by that target.

- [ ] P0 Reduce the prototype feel of the HUD and screen overlays.
  The current HUD stacks large monospace labels, glows, outlines, banners, icons, and counters at once. Gameplay still works, but the presentation feels busy and inconsistent rather than premium.

- [ ] P0 Rebuild the level map header and top navigation layout.
  The current map screen crowds missions, login, event ribbon, shop, stats, title text, and score text into the same band. It reads as overlapping systems instead of one clear screen hierarchy.

- [ ] P0 Improve reward and transition screens.
  The level intro and level complete screens load correctly, but they still feel sparse and flat. The reward moments do not yet match the amount of effort the player just spent.

- [ ] P1 Strengthen biome identity with more than palette swaps.
  The worlds are atmospheric, but most of the distinction still comes from color and tinting. The silhouettes, prop language, and foreground framing should be more theme-specific.

- [ ] P1 Normalize sprite resolution, framing, and compression.
  Character sheets range from small optimized files to very large multi-megabyte sheets, and enemy art also varies heavily in rendering style and asset weight. This is both a graphics quality issue and a startup/performance issue.

## Graphics And Art Direction

- [ ] P0 Write a one-page visual style guide.
  Define target shape language, line weight, shading style, palette rules, outline rules, FX rules, and UI rules before doing more art passes.

- [ ] P0 Pick one character art direction and normalize all six playable characters to it.
  The cleanest direction is the readable, playful cartoon approach used by Gronk and Pip, then bring Bruk, Zara, Rex, and Mog into the same silhouette and rendering family.

- [ ] P0 Pick one enemy and obstacle art direction and normalize all hostile assets to it.
  The current set ranges from crude graphic shapes to painterly sheets. Enemies, hazards, and pickups should feel like they were built for the same game.

- [ ] P0 Standardize sprite sheet specs.
  Use one frame size policy, one anchor policy, one baseline policy, one naming scheme, and one export/compression path for all character and enemy sheets.

- [ ] P1 Rework player readability in motion.
  Improve contact shadow, silhouette separation from terrain, hit flash clarity, landing anticipation, and dash/slide readability so the player pops at speed.

- [ ] P1 Rework enemy telegraphs visually.
  Each enemy should have a distinct anticipation pose, stronger attack silhouette, and clearer projectile read before it becomes dangerous.

- [ ] P1 Rework obstacles and hazards for instant readability.
  Logs, spikes, fire geysers, and boss hazards should read as threats at a glance, including on smaller Android devices.

- [ ] P1 Add stronger depth separation to every biome.
  Push foreground, gameplay plane, midground, and far background into cleaner value bands so the player and threats are never visually lost against scenery.

- [ ] P1 Increase biome-specific prop language.
  Jungle should feel overgrown, Volcano should feel sharp and unstable, Glacier should feel crystalline, Swamp should feel damp and organic, and Sky should feel airy and elevated.

- [ ] P1 Give each biome a signature atmospheric effect that is not just a tint overlay.
  Examples: drifting leaves or hanging vines for Jungle, ash columns or heat shimmer for Volcano, ice shards and wind streaks for Glacier, spores or swamp haze for Swamp, layered cloud wisps and light shafts for Sky.

- [ ] P1 Improve terrain material rendering.
  The current terrain gradients are serviceable, but the ground still feels generic. Each biome should have a distinct top edge, fill texture, and embedded detail treatment.

- [ ] P1 Add a focused boss presentation pass.
  Bosses need stronger entrance framing, clearer phase shifts, more distinctive attack effects, and better differentiation from normal encounters.

- [ ] P2 Upgrade gem, pickup, and reward VFX.
  Collectibles should feel more satisfying through motion arcs, bloom discipline, better sparkle timing, and clearer rarity/value treatment.

- [ ] P2 Add a palette and contrast pass for low-end and bright-screen Android conditions.
  Some current color/value combinations risk washing out on mobile displays or in bright environments.

## UI, HUD, And Screen Presentation

- [ ] P0 Replace the single-font look with a deliberate UI typography system.
  The game leans on monospace almost everywhere, which makes the whole experience feel like a debug prototype. Use a stylized display treatment for titles and a cleaner readable face for numbers and labels.

- [ ] P0 Simplify the gameplay HUD.
  Keep timer, health, gems, pause, and combo readable, but reduce redundant shadows, large opaque panels, and oversized central callouts that compete with gameplay.

- [ ] P0 Move reward announcements away from the playfield center or shrink them materially.
  The current announce banner is visually loud and covers important action space during play.

- [ ] P0 Redesign the level map top area.
  Split title, progression summary, event banner, and feature buttons into a more intentional layout. The current arrangement is crowded and visually inconsistent.

- [ ] P0 Establish one button system.
  Buttons across the map, shop, settings, and overlays should share shape language, border treatment, fill logic, hover/press states, and disabled states.

- [ ] P1 Improve the main menu composition.
  The glowing title works, but the screen needs a stronger focal structure, clearer CTA contrast, and more personality than a single centered title over a scrolling background.

- [ ] P1 Improve the level intro screen.
  Add stronger entrance animation, better world-specific framing, and a more polished objective presentation so the run feels like it is really beginning.

- [ ] P1 Improve the level complete screen.
  Make stars larger and more celebratory, improve score/time hierarchy, and add a more premium next-step CTA treatment.

- [ ] P1 Revisit the character select screen layout.
  Character cards should better showcase art, stats, unlock logic, and skins without feeling like placeholder panels.

- [ ] P1 Revisit pause, settings, missions, and stats screens for coherence.
  These systems likely work functionally, but they should all feel like parts of the same product rather than separate prototype surfaces.

- [ ] P2 Consider moving text-heavy menus to DOM-based UI inside the WebView shell.
  Canvas is fine for gameplay HUD, but menu-heavy surfaces can become easier to style, iterate, and localize if they are rendered as DOM overlays.

## Asset Pipeline And Graphics Production

- [ ] P0 Create a repeatable sprite pipeline for characters and enemies.
  Every sheet should go through the same process: source frames, normalization, anchor check, compression, preview, and in-game validation.

- [ ] P0 Compress oversized sprite sheets.
  Several current sheets are multi-megabyte files and will hurt startup time and memory. Trim transparency, normalize dimensions, and optimize exports.

- [ ] P0 Remove debug sprite artifacts from shipping paths.
  The repo includes many debug and verification sprite outputs. Keep them for production workflow if useful, but separate them from shipping asset paths and build inputs.

- [ ] P1 Create an art QA checklist.
  Verify silhouette readability, baseline alignment, animation loop quality, hitbox fit, contrast, idle readability, and consistency against the style guide before new assets ship.

- [ ] P1 Add preview/contact-sheet generation for art review.
  A single generated sheet or HTML review page for each character/enemy batch would make visual QA much easier.

- [ ] P2 Decide whether some props and hazards should stay procedural or be replaced by curated assets.
  Hybrid rendering is fine, but it should be a deliberate choice rather than a byproduct of mixed implementation history.

## Gameplay Feel And UX

- [ ] P0 Add a stronger first-run onboarding flow.
  The game should teach jump, dash, slide, pound, combo, and hazard reads through interaction, not mostly through timed text and implicit discovery.

- [ ] P0 Clarify level progression and feature unlock flow.
  The amount of content is good, but players need clearer guidance on what matters next and why they should care.

- [ ] P1 Tighten run-to-run feedback.
  Improve transitions for start, hit, combo, pickup, boss phase change, death, and completion so the game feels more responsive and authored.

- [ ] P1 Improve retry and next-level CTA clarity.
  Core actions after death or completion should always dominate the screen visually.

- [ ] P1 Review balance and pacing for early levels.
  The first 5-10 levels should be used to smooth onboarding, establish biome contrast, and show progression hooks faster.

- [ ] P1 Improve boss encounter readability and pacing.
  Phase transitions, safe windows, and attack telegraphs should be easier to parse on first contact.

- [ ] P2 Add clearer skin and character differentiation UX.
  Character identity, stat tradeoffs, and skin value should be easier to understand in selection and shop screens.

## Technical Architecture, Stability, And Performance

- [ ] P0 Stop relying on one giant inline WebView payload as the long-term architecture.
  The current self-contained HTML string works now, but it is fragile and heavy. Move toward bundled local files with a stable base URL and a smaller bootstrap path.

- [ ] P0 Make `game.js` the clear source of truth and keep generated outputs fully generated.
  Avoid hand-editing generated HTML/JS outputs. Regeneration should be deterministic and documented.

- [ ] P0 Stage asset loading more intelligently.
  Load only what is needed for boot, then stream or lazily initialize secondary characters, secondary screens, and optional audio.

- [ ] P0 Reduce startup memory and decode pressure.
  Large sprite sheets, base64 embedding, and eager audio work together to make Android startup heavier than it needs to be.

- [ ] P1 Add a proper low-end Android device profiling pass.
  Validate frame pacing, memory use, load times, and thermals on weaker phones rather than relying on desktop/browser confidence.

- [ ] P1 Add automated smoke coverage for key phases.
  Boot, menu, level intro, gameplay, level complete, death, level map, missions, skins, and settings should all have at least one repeatable smoke path.

- [ ] P1 Harden error reporting.
  Keep the in-game error overlay, but also capture phase, selected character, level id, theme, asset state, and recent transition path in a native crash/analytics backend.

- [ ] P1 Clean up build hygiene.
  Align Expo/React Native package versions, resolve dependency doctor warnings, and fix the missing iOS app id configuration.

- [ ] P2 Revisit web preview support.
  Add missing web dependencies or formalize that the supported runtime is Android only.

## Audio And Feel

- [ ] P1 Replace or augment procedural audio with more authored content.
  The current system is functional, but music and SFX still lag behind the visual ambition of the game.

- [ ] P1 Add stronger reward audio and boss audio identity.
  Completion, star awards, phase shifts, and pickups should have clearer audio signatures.

- [ ] P2 Revisit haptic design once native testing is in place.
  Differentiate taps, pickups, hits, landings, and boss beats without turning vibration into noise.

## Analytics, Product, And Live Ops

- [ ] P0 Expand analytics coverage around the main funnel.
  Track menu -> map -> character select -> level intro -> level complete/death -> reward flow -> retry/next-level choices.

- [ ] P0 Add crash reporting and stability dashboards before wider testing.
  A sidescroller on Android needs crash visibility early or bugs will hide in the long tail of devices.

- [ ] P1 Add tuning telemetry for ads, progression, missions, economy, and early drop-off.
  The game already has depth; telemetry will show where that depth is helping versus confusing players.

- [ ] P2 Plan post-launch content cadence.
  Seasonal events, new characters, new worlds, and challenge modes should follow a clear roadmap instead of ad hoc additions.

## Native Android, Monetization, And Launch Readiness

- [ ] P0 Finish Play Console readiness work.
  Complete Data Safety, IARC/content rating, listing assets, testing-track requirements, and privacy-policy hosting.

- [ ] P0 Verify ad integration end to end.
  Reward and interstitial hooks should be real, resilient, offline-aware, and balanced to avoid bad review pressure.

- [ ] P1 Consider a remove-ads purchase.
  If ads remain part of the design, this is one of the cleanest quality-of-life monetization options.

- [ ] P1 Add Google Play Games integration if leaderboards and achievements remain part of the product vision.
  This helps retention and makes the game feel more complete on Android.

- [ ] P1 Validate safe-area and navigation behavior on a wider Android device matrix.
  The game has safe-area handling, but it should be tested specifically against Samsung/Pixel button and gesture layouts.

- [ ] P2 Add cloud save, notifications, and broader retention systems only after core visual quality and stability are stronger.

## Suggested Execution Order

1. P0 visual direction and UI cleanup
2. P0 sprite normalization and compression
3. P0 startup/performance architecture improvements
4. P0 analytics/crash instrumentation and Android QA
5. P1 biome pass, reward screen pass, boss pass
6. P1 monetization polish, Play Games, audio upgrades
7. P2+ expansion work after the core game feels visually and technically cohesive
