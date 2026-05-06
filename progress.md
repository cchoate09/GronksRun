Original prompt: [@game-studio](plugin://game-studio@openai-curated) This app is in a broken state, and I need help to revive it. The app does not load and there is an issue with the sprite animations. Can you take a deep look at this app, get it to a working state so it loads? Then can you do a gap analysis of this app, which is a sidescroller for android, and see what kinds of improvements you would recommend. Take as much time as you need.

2026-05-05
- Started a bugfix pass for menu controls and moving attacks. Root cause found: native overlay controls in `App.js` render as soon as the WebView loads, so the joystick/buttons can sit over menu/submenu buttons; sprite "shadow legs" are caused by synthetic `drawRunStrideCues(true, ...)` strokes layered with the sheet-backed player sprite.
- Added a failing regression contract in `scripts/menu_controls_and_attack_contract_check.js` and wired it into `npm run check:gameplay-contracts`. Current red result is expected: `App.js` does not yet track `showGameControls`.
- Completed the fix: menu scenes now publish `gameUiState` with controls hidden, active gameplay publishes controls visible only while `PLAYING`, native controls render behind `webViewLoaded && showGameControls`, synthetic stride strokes were disabled, and melee/ranged attack cues now overlay the running body so movement and attacks can happen together.
- Verification passed: `npx tsc --noEmit`, `npm run build:webview`, `npm run check:gameplay-contracts`, `npm run verify:webview-bundle`, `npm run qa:polish-pass`, `npm run qa:sprite-animation`, `npm run smoke:mobile-webview`, `npm run qa:web-game-client`, and `git diff --check`.
- Follow-up obstacle/combat fix: removed the duplicate skeletal melee slash so only the gameplay slash renders, changed pit falls to end the run instead of resetting to safe ground, and switched obstacle rendering to content-anchored OpenAI atlas frames with active fire animation in place. Added regression coverage in `arcade_gauntlet_contract_check.js`, `arcade_gauntlet_smoke.js`, `menu_controls_and_attack_contract_check.js`, and `sprite_animation_smoke.js`.
- Verification passed after rebuild: `npx tsc --noEmit`, `npm run build:webview`, `npm run check:gameplay-contracts`, `npm run verify:webview-bundle`, `npm run qa:arcade-gauntlet`, `npm run qa:sprite-animation`, `npm run qa:polish-pass`, `npm run smoke:mobile-webview`, `npm run qa:web-game-client`, targeted fire obstacle capture at `output/obstacle-art-check/`, and `git diff --check`.

2026-03-27
- Initial triage found two hard boot blockers:
- `index.html` inline game script has a syntax error caused by literal `\n` escapes being converted into real newlines inside a JS string.
- `App.js` loads `gameHtml` as an HTML string in `WebView`, but that HTML depends on relative `assets.js` and `audio_assets.js` scripts, which is fragile or broken in string-backed WebViews.
- `game.js` parses correctly and appears to be the safer source of truth than the current generated `index.html`.
- Follow-up runtime fix: level completion was crashing because the loop called `sfxLevelComplete()` but only `sfxLevel()` existed in the audio wrapper layer. Added `sfxLevelComplete()` as an alias in `game.js`, regenerated `gameHtml.js`, and verified in a WebView-style Puppeteer run that the `LEVEL_COMPLETE` phase renders with no red error overlay.
2026-03-28
- Replaced the rough character-sheet resizer with a procedural sprite-sheet generator in `gen_char_assets.js` using `canvas` + `sharp`.
- Generated clean transparent 8x2 sheets for all six heroes and rewrote `assets.js` from those outputs.
- Tightened the live HUD for crowded mobile states: narrower top panel spacing, smaller combo/announce ribbons on compact screens, and wrapped powerup chips to avoid edge collisions.
- Simplified the level-map screen: removed the daily challenge/event-like card, replaced the oversized footer panel with compact action cards plus runner/progress chips, and updated hitboxes to match.
- Increased sprite presentation scale for in-run sprite rendering and character-select previews so the new sheets read clearly.
- Verification: `node --check game.js`, `node gen_char_assets.js`, `node gen-gamehtmljs.js`, Playwright client smoke run against `index.html`, and a targeted Puppeteer mobile-landscape pass covering character select, level map, gameplay, and level complete.
- Runtime QA result: all six `charSprites` report `ready=true`, `blocked=false`, `fw=128`, `fh=128`.
- Residual non-blocker during local web QA: `manifest.json` 404 from the lightweight local server; this did not affect game rendering or runtime logic.
- Additional mobile UI cleanup pass:
- Reworked the gameplay HUD to keep combo state inside the main top bar instead of spawning another floating box, turned saves into a compact inline chip, and slimmed/repositioned tooltip and announcement banners so they no longer stack directly under the HUD.
- Rebuilt the level-clear card around a single centered panel with cleaner spacing, a dedicated bonus-spin CTA, and no detached share button.
- Verification: `node --check game.js`, `node gen-gamehtmljs.js`, and a Puppeteer mobile-landscape screenshot pass against forced `PLAYING` and `LEVEL_COMPLETE` states using the same aspect ratio as playtest screenshots.
2026-03-29
- Batch 1 foundation implementation:
- Added `@sentry/react-native` to the Expo app and wrapped Metro with `getSentryExpoConfig` for release/source-map compatibility.
- Added `src/telemetry.js` to centralize native-shell crash reporting and analytics forwarding with safe defaults, persisted anonymous install IDs, Sentry bootstrapping, and direct PostHog capture support.
- Rewired `App.js` so the existing WebView bridge now reports real events and crashes instead of console-only stubs. Native shell events now also track ad lifecycle, WebView load/process failures, share sheet opens, and rate-app attempts.
- Strengthened game analytics in `game.js`: level completions, deaths, shop purchases, and skin purchases now emit events. Added machine-readable QA hooks via `window.render_game_to_text()` and `window.advanceTime()`.
- Added `scripts/mobile_webview_smoke.js`, `.env.example`, `manifest.json`, and `docs/BATCH1_FOUNDATION.md`.
- Verification: `node gen-gamehtmljs.js`, `node --check game.js`, `node --check scripts/mobile_webview_smoke.js`, `npm run smoke:mobile-webview`, and `npx expo export --platform android --output-dir .expo-export-check\\batch1`.
- Smoke result after the harness cleanup: mobile WebView booted cleanly, `render_game_to_text` and `advanceTime` were present, and the bridge emitted `session_start` and `level_start` analytics with no page errors.
- Remaining Batch 1 gaps after this pass: no telemetry credentials are configured yet, Sentry org/project/auth-token still need to be set in the build environment for symbolicated release uploads, and there is still no device matrix / automated Android runtime pass outside the WebView smoke coverage.
- Follow-up Batch 1 tranche:
- Expanded analytics semantics and context so events now carry biome, character, phase, run score, run gems, endless/daily flags, and native device metadata.
- Corrected an analytics bug where requesting an ad was previously logged as if the ad had already been watched; the game now emits `ad_show`, while the native shell emits `ad_reward` on actual reward completion.
- Added more funnel events and transitions: `app_open`, `menu_view`, `map_view`, `char_select_view`, `tutorial_step`, `tutorial_complete`, `continue_offer`, `retry`, and `next_level`.
- Added `docs/ANDROID_TEST_BUILD_CHECKLIST.md` to give monitored Android test builds a repeatable release gate.
- Tightened `scripts/mobile_webview_smoke.js` so it waits for an actionable phase instead of passing while still stuck in `LOADING`.
- Verification: regenerated bundle, reran `node --check game.js`, `node --check scripts/mobile_webview_smoke.js`, `npm run smoke:mobile-webview`, and `npx expo export --platform android --output-dir .expo-export-check\\batch-check`.
- Batch 1 closure pass:
- Fixed `level_start` ordering so level and biome context are populated before the event fires.
- Renamed the gameplay death event to the simpler launch-plan name `death`.
- Expanded the smoke suite to force and validate the key Batch 1 states and events:
  menu, map, char select, tutorial, playing, continue prompt, level complete, dead, plus analytics checks for `session_start`, `menu_view`, `map_view`, `char_select_view`, `tutorial_step`, `tutorial_complete`, `level_start`, `continue_offer`, `level_complete`, `death`, `retry`, `next_level`, and `ad_show`.
- Re-ran `npx expo export --platform android --output-dir .expo-export-check\\batch1-final` successfully after the instrumentation changes.
- Remaining after Batch 1 is no longer instrumentation plumbing: it is operational/device work for later batches, especially real telemetry credentials, real monitored device playtests, and broader Android device-matrix QA.
- Batch 2 first-session onboarding pass:
- Reframed levels 1-3 around guided lessons instead of timed tutorial banners alone.
- Level 1 now teaches jump + dash, Level 2 teaches slide + stomp, and Level 3 teaches dash combat via a tracked enemy-hit objective.
- Early progression tuning pass: shortened the first three target times, removed enemies from Levels 1-2, and delayed Level 3 combat to make the first session cleaner and more readable.
- Added a guided onboarding state machine to `game.js`, wired it into player actions, surfaced it in `render_game_to_text`, and kept the live HUD centered on a small lesson strip instead of large floating text boxes.
- Reworked the first-session framing on `drawLevelIntro`, `drawLevelComplete`, `drawLevelMap`, `drawCharSelect`, and `drawTutorial` so the next goal is explicit and the first run points the player toward the intended lesson.
- Updated `scripts/mobile_webview_smoke.js` so the smoke suite now validates guided onboarding presence and completion in Level 1 in addition to the existing analytics funnel checks.
- Verification for this pass: `node --check game.js`, `node gen-gamehtmljs.js`, `npm run smoke:mobile-webview`, and a Puppeteer screenshot QA pass for character select, level intro, playing HUD, map, and level-complete states.
- Remaining Batch 2 work after this tranche: tune the actual obstacle patterns and chunk pacing for Levels 1-3 using real playtest footage, improve the first death/continue teaching beat, and add a clearer first mission / reward moment after the player clears early levels.
2026-03-30
- Batch 2 closure pass:
- Added deterministic guided chunk pacing for Levels 1-3 so the onboarding lessons now run on authored safe terrain instead of falling back to the normal random chunk mix.
- Upgraded the continue prompt into a lesson-aware recovery screen with shared tap-target/layout helpers, preserved run context, and explicit copy for the remaining guided action when the player fails during the first lessons.
- Reframed the death screen around lesson recovery during early onboarding, including a checkpoint chip and retry copy that tells the player exactly what skill is still left to land.
- Added stronger early reward guidance after clears by surfacing ready mission rewards on the level-clear flow, the map header, the mission chip, and the lower progress rail.
- Expanded `render_game_to_text()` and `scripts/mobile_webview_smoke.js` so Batch 2 now validates guided chunk planning, a lesson-aware continue prompt, guided completion, and a reward-ready mission/map state in addition to the existing funnel analytics checks.
- Verification for this closure pass: `node --check game.js`, `node --check scripts/mobile_webview_smoke.js`, `node gen-gamehtmljs.js`, and `npm run smoke:mobile-webview`.
- Batch 2 is now complete from a code and harness standpoint; remaining onboarding work beyond this batch is tuning from real-device playtest footage rather than missing first-session UX systems.
2026-03-31
- High-impact polish pass:
- Rebuilt the remaining older meta surfaces around the shared card system: missions now split daily and weekly goals into cleaner columns with real claim buttons and readable progress bars, and daily reward now uses the same scaffold/footer flow as the rest of the polished UI.
- Added a new `spawnImpactBurst()` feedback helper and used it to strengthen enemy hits, shield breaks, player damage, dash starts, and ground-pound landings so core actions read more clearly and feel more responsive.
- Restyled floating announcements and combat text so they sit in cleaner panels, avoid the tutorial lane more gracefully, and stay legible during crowded gameplay moments.
- Expanded `scripts/mobile_webview_smoke.js` to force-render the missions, shop, stats, settings, and daily reward screens in addition to the existing onboarding/gameplay funnel states.
- Verification for this pass: `node --check game.js`, `node --check scripts/mobile_webview_smoke.js`, `node gen-gamehtmljs.js`, plus regenerated bundle-string checks against `gameHtml.js` and `index.html`.
- The browser smoke launch itself is currently blocked in this workspace by a local Windows `spawn EPERM` when Puppeteer tries to open Chrome, so the harness changes are in place but the full automated browser pass could not complete here.
- Art consistency batch:
- Added maintained procedural sheets for `charger`, `bomber`, and `fire_geyser` in `gen_sprite_sheets.js`, alongside a generated manifest at `assets/spritesheets/enemies/generated/manifest.json`.
- Added `gen_enemy_assets.js` so generated enemy sheets are normalized into the runtime `128x128` frame grid and patched directly into `game.js` instead of drifting out of sync by hand.
- Re-enabled the live enemy sprite path in `game.js` and rebuilt the runtime sprite asset block from generated sheets so the enemy cast now shares a single consistent pipeline with explicit animation metadata.
- Regenerated the shipped WebView bundle in `index.html`, `gameHtml.js`, and `assets/gameHtml.js`.
- Verification for this pass: `node --check game.js`, `node --check gen_enemy_assets.js`, `node gen_sprite_sheets.js`, `node gen_enemy_assets.js`, `node gen-gamehtmljs.js`, `npm run smoke:mobile-webview`, and a targeted browser check confirming all generated enemy/hazard sheets load successfully with valid `128x128` frames and animation lookups.
2026-04-04
- HUD and level-complete deep scrub:
- Added shared text fitting helpers in `game.js` so panel and chip text now shrinks to the available box instead of overflowing or relying on horizontal squish.
- Rebuilt the live gameplay HUD around three inner cards for level/HP, timer/progress, and score/resources, with wider compact detection for Android landscape aspect ratios and cleaner spacing between labels, values, and bars.
- Reworked the level-complete card so the title, biome name, stat cards, rating, new-best badge, guidance chip, and CTA all sit in fixed lanes with fitted typography instead of stacking into one another.
- Updated announcement text to use the same fit logic so transient banners no longer spill outside their panel on smaller devices.
- Regenerated the shipped WebView bundle in `index.html`, `gameHtml.js`, and `assets/gameHtml.js`.
- Verification for this pass: `node --check game.js`, `node gen-gamehtmljs.js`, `npm run smoke:mobile-webview`, and targeted Puppeteer screenshot QA for forced `PLAYING` and `LEVEL_COMPLETE` states using the user-provided bad states as reference.
- Follow-up readability sweep:
- Reduced the live timer and score typography again, gave the HUD cards more vertical breathing room, and lowered the timer baseline so value text no longer crowds the lane labels on wide Android landscape screens.
- Simplified the level-clear guidance and CTA copy, widened the result card slightly, and shrank the title/stat/badge fonts so the end-of-level card stays readable without text pressing against its panel edges.
- Verification for this follow-up: `node --check game.js`, `node gen-gamehtmljs.js`, `npm run smoke:mobile-webview`, plus forced screenshot QA at `1280x720` and `1920x720` for both `PLAYING` and `LEVEL_COMPLETE` with exaggerated timer/score values.
2026-04-06
- Steam load-path packaging fix:
- Found a packaging regression rather than a gameplay/runtime crash. The root `index.html` entrypoint had drifted into a giant fully bundled file, and `assets.js` had also been regenerated once into an abnormally huge payload by the local high-res asset script.
- Regenerated `assets.js` from the maintained character asset pipeline so it returned to normal size, then restored `index.html` to a lean external-script template for desktop/Steam instead of rewriting it into a multi-megabyte blob on every bundle pass.
- Updated `gen-gamehtmljs.js` so it now keeps `index.html` as the stable external-script entrypoint and only regenerates `gameHtml.js` / `assets/gameHtml.js` as the self-contained WebView payloads.
- Added a clean-checkout safety net to `gen-gamehtmljs.js`: if `enemy_assets.js` is missing, it now regenerates it automatically via `gen_enemy_assets.js` before bundling.
- Removed the manifest dependency from the root template, which also avoids `file://` manifest CORS noise in desktop-style local loads.
- Verification for this fix: direct Puppeteer load of `file:///.../index.html` reached `LEVEL_INTRO` with no page errors, `node --check game.js`, `node gen-gamehtmljs.js`, and `npm run smoke:mobile-webview` all passed.
- Also verified the clean-checkout fallback by temporarily moving `enemy_assets.js` aside, letting `node gen-gamehtmljs.js` regenerate it automatically, and confirming the bundle rebuilt successfully.
2026-04-07
- Deep reset tranche driven by the new product audit:
- Added shared text-fitting and stat-card helpers so the active UI surfaces now use one consistent layout language instead of one-off font sizing and overflow behavior.
- Rebuilt the live menu around a proper runner spotlight, progression summary, and one clear map/start CTA instead of a stack of disconnected boxes and labels.
- Simplified and tightened the gameplay HUD so level, time, score, gems, health, saves, combo, prompts, and announcements read in a cleaner hierarchy with less label noise.
- Rebuilt the level-clear card into a reward-first summary with three stat cards, cleaner star presentation, tighter guidance copy, and a single bonus-spin CTA lane.
- Refreshed the level map header around clearer progress framing and a cleaner current-goal hierarchy without changing the overall map interaction model.
- Rebuilt character select around a selected-runner spotlight panel plus smaller roster cards, then aligned the tap handling to the new on-screen layout via stored layout rects.
- Rebuilt the active death, pause, and tutorial screens around the same card/button grammar and updated their tap handling so the visual layout and touch targets finally match.
- Added scripted guided-level gem arcs to the onboarding chunk plans and support for scripted chunk gem placement, so the first three levels feel more intentionally staged instead of looking like generic safe chunks.
- Tightened early-level pacing in `LEVEL_DEFS` and added stronger gem pickup feedback with visible time-gain text and impact bursts to make the run feel more rewarding moment to moment.
- Verification for this tranche: `node --check game.js`, `node gen-gamehtmljs.js`, `npm run smoke:mobile-webview`, and a visual spot-check of the regenerated smoke screenshot after the reset pass.
- Follow-up product-reset pass:
- Removed the remaining legacy function-name collisions from `game.js` so the file now has one live owner for the menu, level map, level-complete, pause, tutorial, death, daily reward, and obstacle renderer paths. Also switched the in-run dead-state tap handler over to the current `handleDeadTap()` layout path.
- Added authored setpiece data for Levels 4-10 via `LEVEL_OVERRIDES` plus `SCRIPTED_LEVEL_CHUNK_PLANS`, including custom ptero placements, more intentional hazard/gem rhythms, and unique midgame level names/focus text instead of relying only on the old theme cycle.
- Tightened biome coherence by preventing random `FIRE_GEYSER` hazards from leaking into non-volcano stages, then added stronger per-biome art treatment: new foreground props in all themes, richer sky/backdrop signatures, theme-specific screen-space atmosphere, and a more coherent hazard pass for rocks, spikes, boulders, logs/temple beams, geysers, and pteros.
- Expanded `render_game_to_text()` with `level_plan` and `chunk_types` so authored-level verification is easier in future smoke runs.
- Verification for this pass: `node --check game.js`, `node gen-gamehtmljs.js`, `npm run smoke:mobile-webview`, a targeted browser verification that Levels 4-10 all boot with `level_plan: scripted`, and manual screenshot review of `output/scripted-level-7.png` and `output/scripted-level-10.png`.
- Next-pass campaign / boss / Android hardening tranche:
- Added authored level names, tuning, and scripted chunk plans for Levels 11-20 so the midgame now extends beyond the first reset loop with real setpieces instead of falling back to repeated procedural structure.
- Rebuilt the boss runtime around readable telegraphs, staged phase escalation, boss-specific body shapes, attack cue cards, stronger hit feedback, and richer defeat rewards/time payout so boss fights read more like authored encounters.
- Added native shell -> WebView app-state and viewport messaging so Android background/resume and resize behavior can pause the game more safely and re-sync layout/ad readiness on return.
2026-04-09
- Canvas radius crash hardening pass:
- Investigated the mobile gameplay `IndexSizeError` reported in playtest screenshots (`arcTo` radius `-0.02`) and traced it to shared panel/progress-bar helpers, not level logic. The helpers were subtracting fixed `4px/5px` insets from already-short HUD bars, which could make inner rect heights slightly negative on compact Android layouts.
- Added shared geometry guards in `game.js`: `normalizeRectMetrics`, `insetRectMetrics`, and `clampCornerRadius`.
- Hardened `rrPath`, `fillRR`, `ellipse`, `drawPanel`, and `drawProgressBar` so they now normalize negative/tiny dimensions, clamp corner radii safely, and skip fragile inner layers when a panel is too small for decorative insets.
- Regenerated `gameHtml.js` / `assets/gameHtml.js` via `node gen-gamehtmljs.js`.
- Verification for this fix: `node --check game.js`, `npm run smoke:mobile-webview`, and a targeted Puppeteer compact-viewport probe that directly exercised `drawPanel(…, h=3.96)`, `drawProgressBar(…, h=3.96)`, `rrPath` with negative height, and `ellipse` with negative radii. All completed with no page errors and no red runtime overlay.
- Broad follow-up error scan:
- Re-ran syntax checks for `game.js`, `App.js`, and `scripts/mobile_webview_smoke.js`.
- Ran the existing mobile WebView smoke suite plus a custom canvas probe across `1280x720`, `960x540`, and `1600x720` viewports, with runtime wrapping around `CanvasRenderingContext2D.arcTo`, `arc`, and `ellipse` to catch any negative-radius calls during menu, map, char select, gameplay, level-complete, and boss-fight flows.
- Result: no page errors, no console errors, no runtime error overlay, and no additional negative-radius canvas calls surfaced beyond the already-fixed panel/progress-bar path.
- Added adaptive performance stepping plus particle trimming so sustained low-FPS runs can fall back gracefully on weaker Android hardware instead of staying pinned to a too-expensive effects budget.
- Finished the boss-fight HUD pass by removing the overlapping standard gameplay HUD during boss encounters and replacing the cramped inline player readout with a dedicated compact stat row inside the boss panel.
- Upgraded the smoke harness and runtime text snapshot so coverage now asserts an authored scripted midgame level plus boss cue / telegraph state in addition to the earlier onboarding and meta-screen checks.
2026-04-21
- Gameplay engagement pass focused on the live run rather than more meta systems.
- Added a recurring `SURVIVAL SURGE` loop in `game.js` for levels 4+ and endless mode: short pressure spikes that boost pace, immediately inject extra enemy pressure, and award time/gems/score/signature charge if the player survives.
- Added flawless-surge detection by marking shield breaks and damage taken during surge windows, then paying a larger reward on a clean survive.
- Tightened enemy pacing so repeat spawns now respect authored `enemyDelay` level data instead of falling back to the old global `9 - progress * 3.4` timing. This makes midgame scripted levels feel less empty and lets the authored level overrides matter.
- Added a small in-run `SURGE` chip to the HUD and exposed `survival_surge` in `render_game_to_text()` for automated verification.
- Regenerated the shipped WebView bundle via `node gen-gamehtmljs.js`.
- Verification for this pass:
- `node --check game.js`
- `node gen-gamehtmljs.js`
- `npm run smoke:mobile-webview`
- Ran the `develop-web-game` Playwright client against a local static server (it only captured the loading screen in this repo's current boot timing).
- Ran a targeted Puppeteer gameplay capture forcing Level 11 into an early surge window, then reviewed `output/surge-check/surge-active.png` plus `output/surge-check/surge-active.json`. Result: surge UI visible, extra enemies present, and the lane read materially busier than the prior midgame screenshot.
2026-04-22
- Researched current survival / runner reference points before the gameplay pass, using Canabalt, Alto's Odyssey, Jetpack Joyride, Dan the Man, Dead Ahead, and Vector as the mechanic fit check for what this game could borrow without breaking its lane-runner identity.
- Added two new mid-run engagement hooks in `game.js`: timed `BOUNTY` enemies for higher-pressure elite kills, and `RELIC` pickups that sit on riskier lines and pay out extra gems, clock, score, and signature charge.
- Gave bounty enemies explicit presentation instead of hiding the mechanic in tuning alone: aura ring, bounty chip, and a dedicated health-bar treatment. Also exposed `bounty_hunt`, enemy `bounty` flags, and visible `relics` through `render_game_to_text()` for future automation.
- Tightened the menu and runner-select readability pass again after screenshot review: lowered and shrank the main title, moved the menu support copy into a chip, shortened runner-select copy, and replaced the long path descriptions with shorter pitches so text stays inside its panels.
- Bumped the release metadata to `1.5.5` / Android `versionCode 36`, regenerated `gameHtml.js` and `assets/gameHtml.js`, and produced a fresh local Play bundle at `dist/gronks-run-1.5.5-36-release.aab`.
- Verification for this pass:
- `node --check game.js`
- `node gen-gamehtmljs.js`
- `node --check scripts/mobile_webview_smoke.js`
- `npm run smoke:mobile-webview`
- `android\\gradlew.bat bundleRelease --no-daemon`
- Captured fresh UI review frames at `output/ui-check-2026-04-22/menu-after.png` and `output/ui-check-2026-04-22/char-select-after.png`, plus a targeted bounty / relic runtime capture at `output/engagement-check-2026-04-22/bounty-relic.png`.
2026-05-02
- Android load-path fix:
- Traced the current phone/GitHub build failure to `App.js` requiring `./dist/index.html` even though `dist/` is ignored by git. Local exports only worked when an ignored `dist/index.html` happened to exist.
- Switched the native WebView back to committed inline HTML via `assets/gameHtml.js`, added `scripts/sync_dist_html_asset.js`, and added `npm run build:webview` so the committed WebView payload is regenerated from the Pixi webpack bundle.
- Added `scripts/verify_webview_bundle.js` to prevent future regressions back to ignored `dist/` assets.
- Exposed `window.render_game_to_text()`, `window.advanceTime(ms)`, and a `gameReady` bridge message from the new Pixi runtime so automated WebView smoke tests can verify real boot and input behavior.
- Reworked the mobile WebView and systemic-loop smoke scripts to load the same committed inline HTML module used by Android, then validate boot, movement, attack/jump input, bridge readiness, and screenshots.
- Verification for this fix: `npm run build:webview`, `npm run verify:webview-bundle`, `npx tsc --noEmit`, syntax checks for app/scripts, `npm run smoke:mobile-webview`, `npm run smoke:systemic-loop`, `npx expo export --platform android --output-dir .expo-export-check\\phone-load-fix-final`, and `android\\gradlew.bat assembleDebug --no-daemon`.
- No Android device was attached in this workspace (`adb devices -l` returned an empty device list), so verification used automated Chromium WebView-style smoke tests plus Android export/debug build packaging checks.
- First-world phone viewport fix:
- Reproduced the reported fall-through symptom at compact landscape sizes: physics and the floor renderer were using a hardcoded `groundY=600`, which puts the landing plane below common phone landscape viewports such as `844x390`.
- Added compact and portrait-to-landscape resize cases to `scripts/mobile_webview_smoke.js` so the smoke test now fails if the player lands offscreen after boot or orientation resize.
- Made `GameScene` compute the visible floor from `window.innerHeight`, set the physics ground to match, redraw the floor on resize, and clamp existing actors back onto the visible floor after orientation changes.
- Regenerated `assets/gameHtml.js` via `npm run build:webview`.
- Verification for this fix: `npm run smoke:mobile-webview`, `npm run smoke:systemic-loop`, `npx tsc --noEmit`, `npm run verify:webview-bundle`, dedicated web-game Playwright client against `dist/`, visual review of standard/compact/orientation screenshots, and `android\\gradlew.bat assembleDebug --no-daemon`.

2026-05-03
- Gameplay revival pass for the current Pixi/TypeScript runtime:
- Fixed key edge detection in `InputManager` so keyboard `justPressed` state survives until scene logic consumes it, and added transient clearing so starting from the menu does not leak Enter/Space into gameplay as an attack.
- Reworked combat spacing: melee enemies now stop at a readable attack distance, player attacks reach farther, dash/attack hits resolve before contact damage, and basic attacks can reliably kill early chasers.
- Added a 10-level playable campaign through `LEVELS` in `GameScene`, with named levels, biomes, target kill counts, enemy mixes, rewards, level-complete flow, retry flow, and level progression/unlock persistence when storage is available.
- Rebuilt `MenuScene` into a real main menu plus level-select UI exposing all 10 levels, with keyboard/touch/native-action entry points.
- Switched player and enemy presentation from procedural rectangle skeletons to the available normalized hero and generated enemy spritesheets, inlined through webpack for the committed WebView bundle, with asset preloading before scene creation.
- Hardened storage access through `src/game/storage.ts` so browser/WebView smoke contexts with opaque origins still boot cleanly when `localStorage` is unavailable.
- Updated smoke scripts for the new menu-first flow and level list assertions.
- Verification: `npx tsc --noEmit`, `node --check scripts/mobile_webview_smoke.js`, `node --check scripts/systemic_loop_smoke.js`, `npm run build:webview`, `npm run smoke:mobile-webview`, `npm run smoke:systemic-loop`, targeted Puppeteer combat clear script through Level 1, and screenshot review of menu, level select, gameplay, and combat-clear output.
- Note: the `develop-web-game` Playwright client produced valid JSON state but black canvas screenshots in this WebGL/Pixi headless path; standard Puppeteer page screenshots rendered correctly and were used for visual inspection.
- Follow-up control/release pass:
- Fixed a keyboard regression where joystick sync overwrote physical `ArrowLeft` / `ArrowRight` state each frame, which made local preview horizontal keyboard controls fail while jump/attack still worked.
- Aligned local preview keyboard controls to `ArrowLeft` / `ArrowRight` for movement, `ArrowUp` / `W` for jump, `Space` / `F` / `J` / `Enter` for attack, and `Shift` / `E` for dash.
- Added a dash clamp path so dashing at screen edges cannot carry the player offscreen before normal movement clamping runs.
- Rebuilt the committed WebView bundle after the input fixes and bumped release metadata to `1.8.9` / Android `versionCode 51`.
- Verification for this pass: `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run smoke:mobile-webview`, `npm run smoke:systemic-loop`, an explicit Puppeteer control harness covering keyboard left/right/jump/space attack and mobile WebView joystick left/right plus JUMP/DASH/ATTACK messages, and `android\\gradlew.bat bundleRelease --no-daemon` from the `android/` directory.
- Release artifact copied to `dist/gronks-run-1.8.9-51-release.aab` for Play Console upload. No Android device was attached (`adb devices -l` returned empty), so device testing was not run in this workspace.
- Gameplay-feel pass:
- Added `scripts/gameplay_feel_check.js` as a regression harness for the issues reported in the local preview: real run-up spacing before the first enemy, smooth horizontal acceleration/deceleration, explicit attack wind-up / active / recovery state, and visible slash telemetry.
- Reworked player movement away from instant velocity snaps: horizontal input now accelerates toward target speed, decelerates after release, has lighter air control, a lower jump impulse, and a shorter/slower dash.
- Reworked attacks so they no longer instantly blast anything in front of the player. Attacks now have a readable wind-up, active strike window, recovery, visible slash arc, and reduced damage so early enemies take two hits instead of disappearing in one hit.
- Reworked encounter pacing from room-brawler behavior toward side-scroller behavior: Level 1 starts with a long run-up, all levels now carry `runUpDistance`, `encounterSpacing`, and `levelLength`, the camera scrolls through a wider world, and enemies hold position until the player enters their encounter range instead of walking across the whole level toward the player.
- Adjusted hero spritesheet attack frames to keep the hero visible during strikes while the slash arc communicates the attack.
- Verification for this pass: `npx tsc --noEmit`, `npm run build:webview`, `node scripts/gameplay_feel_check.js`, `npm run smoke:mobile-webview`, `npm run smoke:systemic-loop`, the develop-web-game Playwright client against `http://localhost:5173`, a targeted level-clear playability bot confirming camera scroll and Level 1 completion, and screenshot review of `output/gameplay-feel/active-slash.png` plus `output/playability-check/playability.png`.
- Mobile control/combat pass:
- Removed the separate native JUMP and DASH buttons so the mobile overlay now leaves joystick plus ATTACK only; joystick up jumps, joystick down pounds while airborne, and joystick down crouches on the ground.
- Disabled dash as a gameplay damage path, kept attacks available while moving, moved the attack button above the Android navigation region, and updated the menu tagline to `RUN  JUMP  POUND  STRIKE`.
- Tightened collision rules so level-1 enemy/projectile contact can damage the player even if an attack animation is in progress, while airborne pound can bounce off and damage enemies.
- Avoided the hero sheet frames that read as hit/death poses during normal running, and expanded smoke coverage for joystick-up jump, joystick-down pound, dash removal, moving attacks, and level-1 contact damage.
2026-05-04
- Gameplay systems continuation pass:
- Added a real melee/ranged attack split in the Pixi runtime. Melee keeps the existing wind-up/active/recovery slash path; ranged is fired through `KeyK`/`KeyL` or native `ranged` action, has cooldown telemetry, spawns forward player projectiles, damages enemies, and remains independent from movement.
- Updated the Android overlay from one `ATTACK` button to separate `RANGED` and `MELEE` buttons while preserving the joystick-up jump / joystick-down crouch-pound model.
- Added close-range enemy pressure state: melee enemies now lunge and expose attack windows instead of idling at close distance; contact damage now respects `enemy.canDealContactDamage()`, and enemy attack/vx state is exposed in `render_game_to_text()`.
- Added an endless mode and settings screen in `MenuScene`: main menu now exposes `ENDLESS RUN`, `LEVEL SELECT`, and `SETTINGS`; settings persist difficulty and sound toggles; endless levels are generated from persisted `gronk_endless_depth` with increasing enemy variety, target kills, active enemy counts, spacing, length, and reward.
- Added platform terrain support to the fixed-step physics engine and generated level platforms in `GameScene`; terrain is drawn into the world and exposed in snapshots so future automation can verify jump/platform routes.
- Added source-level contract harnesses for the new systems:
  `scripts/combat_modes_check.js`, `scripts/enemy_pressure_contract_check.js`, `scripts/endless_settings_contract_check.js`, and `scripts/terrain_contract_check.js`.
- Regenerated the committed Android WebView payload with `npm run build:webview`.
- Verification for this pass:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `node scripts/combat_modes_check.js`, `node scripts/enemy_pressure_contract_check.js`, `node scripts/endless_settings_contract_check.js`, and `node scripts/terrain_contract_check.js`.
- Browser/Puppeteer verification remains blocked in this workspace by local Chromium `spawn EPERM`; `npm run smoke:mobile-webview` and `npm run smoke:systemic-loop` fail before app launch for that reason. The new combat harness falls back to a source contract when this EPERM occurs.
- Remaining objective gaps before the game can honestly be called complete/competitive and released: visual QA of the rebuilt Pixi runtime on real browser/Android, stronger level authoring around the new platform system, richer enemy-specific attack patterns beyond the base lunge/ranged/heavy split, more polished full settings/audio implementation, version bump, release AAB build, commit, push/GitHub work, and Play Console artifact validation.
- Crouch / pound / enemy-variety follow-up:
- Crouch now changes the actual player collision height instead of only scaling the sprite, and high ranged projectiles are flagged so crouching can dodge them.
- Heavy enemies now have an armored damage path and a stronger dedicated pound-damage path, making airborne pound a better answer to armored targets.
- Added `SerpentEnemy` as a custom low-leap enemy instead of reusing the base chaser behavior for the `SERPENT` type.
- Enemy snapshots now expose mechanic labels such as `chase_lunge`, `highProjectile`, `armored_pound_break`, and `low_leap`.
- Added `scripts/crouch_pound_enemy_contract_check.js` and wired all gameplay contract checks into `npm run check:gameplay-contracts`.
- Level-duration follow-up:
- Authored Pixi campaign levels now use much longer distances (`26000` to `76000`) and larger target kill counts so runs are closer to the requested 1-3 minute range at current movement speed.
- Completion now requires both meeting the kill goal and reaching the level endpoint; target kills alone no longer instantly clear a level.
- Endless generated levels now start at `30000` distance and scale up toward `78000`.
- Added light post-objective enemy pressure so the level does not become empty after the kill goal is met but before the endpoint.
- Added `scripts/level_duration_contract_check.js`.
- Verification for this follow-up:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, and `npm run check:gameplay-contracts`.
- Attempted release AAB build:
  `android\\gradlew.bat bundleRelease --no-daemon` failed before Gradle execution because the wrapper tried to create/use Gradle lock files in unwritable locations. Retrying with `GRADLE_USER_HOME` set to the repo `.gradle` directory hit `Access is denied` on `.gradle\\wrapper\\dists\\gradle-9.0.0-bin\\...\\gradle-9.0.0-bin.zip.lck`; using `C:\\tmp` and `output\\gradle-home` also failed to create directories in this sandbox. Policy also rejected removing the stale generated zero-byte lock file directly. No fresh AAB was produced in this pass.
- Sound/settings follow-up:
- Added `src/game/audio/SoundManager.ts`, a safe WebAudio-backed cue manager that respects persisted `gronk_sound_enabled` and no-ops if browser/WebView audio is unavailable or blocked.
- Wired sound cues into menu selection, melee hit, ranged fire, enemy hit feedback, player damage, and level clear.
- Added `scripts/sound_contract_check.js` and included it in `npm run check:gameplay-contracts`.
- Verification for this follow-up:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, and `npm run check:gameplay-contracts`.
- Gradle packaging follow-up:
- Setting `GRADLE_USER_HOME` to `android\\.gradle` allowed the wrapper to download Gradle 9.0.0 and start a daemon, avoiding the repo-root `.gradle` lock-file issue. However, `bundleRelease`, `:app:bundleRelease`, `tasks --all`, and `help` still exit nonzero after only daemon startup/configuration-cache text. Daemon logs report `Runtime.exit(0)` / successful daemon shutdown without task output. The existing `android\\app\\build\\outputs\\bundle\\release\\app-release.aab` is still timestamped `2026-05-03 22:08:46`, so it is not evidence of a fresh build from the latest changes.
- Pause UI follow-up:
- Added in-run `PAUSED` state in `GameScene` with a proper overlay showing current level, kill progress, and distance progress.
- Pause overlay supports Resume, Retry Level, and Main Menu.
- Android back button and native `pause` action now toggle pause/resume instead of being ignored or immediately leaving the run.
- Added a compact pause button to the native overlay beside Ranged/Melee controls.
- Added `scripts/pause_ui_contract_check.js` and included it in `npm run check:gameplay-contracts`.
- Verification for this follow-up:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, and `npm run check:gameplay-contracts`.
- Current objective follow-up:
- Added `scripts/current_objective_contract_check.js` and wired it into `npm run check:gameplay-contracts`; the check first failed on the missing native jump action, then passed after the runtime fixes.
- Restored a dedicated native `JUMP` overlay button in `App.js` while keeping `RANGED`, `MELEE`, and pause controls.
- Reworked the Pixi home menu around `src/game/scenes/menuLayout.ts`, a pure responsive layout helper that keeps `CONTINUE`, `ENDLESS RUN`, `LEVEL SELECT`, and `SETTINGS` inside compact landscape viewports such as `844x390` and `640x360`; `MenuScene` snapshots now expose `main_menu_buttons`.
- Added authored `terrainProfile` and `spawnPattern` fields to all 10 campaign levels, used spawn patterns for enemy selection, generated profile-specific platform routes, and made biome backgrounds render with distinct palettes/shapes.
- Increased close-range melee enemy pressure by replacing the slow crawl between lunges with continued forward pressure, while preserving explicit `canDealContactDamage()` gating.
- Regenerated the committed WebView payload with `npm run build:webview`.
- Verification for this follow-up:
  `node scripts/current_objective_contract_check.js`, `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, and `npm run check:gameplay-contracts`.
- Browser/runtime visual QA remains blocked in this workspace by Chromium `spawn EPERM`: `npm run smoke:mobile-webview`, `npm run smoke:systemic-loop`, and the `develop-web-game` Playwright client all fail before app launch. No fresh screenshots could be captured from this environment.
- Runtime fallback hardening:
- Added `scripts/current_objective_runtime_check.js`, which executes the actual `Player` and `Enemy` TypeScript logic under minimal Pixi/browser stubs to verify moving while attacking, native jump action, and close enemy pressure behavior without launching Chromium.
- Included the runtime check in `npm run check:gameplay-contracts`.
- Confirmed a system Chrome executable exists, but direct Puppeteer launch with `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe` still fails with `spawn EPERM`, so the browser blocker is not limited to the bundled Chromium path.
- Android QA attempt:
- `adb devices -l` cannot run in this workspace because `adb.exe` tries to create `C:\\Users\\CodexSandboxOnline\\.android` and fails with permission denied, even when `ANDROID_USER_HOME`, `ANDROID_SDK_HOME`, `HOME`, and `USERPROFILE` are pointed into the repo.
- `emulator -list-avds` produced no available AVD names, so there is no emulator target to launch for visual gameplay verification from this session.
- Non-visual engagement fallback:
- Added `scripts/current_objective_play_loop_check.js`, which parses the authored `LEVELS` data and menu layout helper to verify campaign variety and pacing without launching the game. It checks terrain profile diversity, biome diversity, spawn-pattern diversity, enemy roster coverage, 1-3 minute estimated run lengths, combat density, encounter spacing, level/kill ramping, active enemy pressure, and compact-viewport bounds for the third home-menu button.
- Included the play-loop audit in `npm run check:gameplay-contracts`.
- QA environment preflight:
- Added `scripts/qa_environment_preflight.js` and `npm run qa:preflight` to capture whether browser or Android visual QA targets are launchable before running smoke tests.
- Latest preflight wrote `output/qa-environment-preflight.json` and reported `browserLaunchable=false`, `adbUsable=false`, and `avds=none`; Chrome, Edge, adb, and emulator launches all fail with `EPERM` in this workspace.
- Visual QA gate wrapper:
- Added `scripts/run_visual_qa_gate.js` and `npm run qa:visual`. The wrapper runs `qa:preflight`, then runs the browser smoke suites only if a browser target is launchable.
- In this workspace, `npm run qa:visual` fails fast with `Visual QA blocked: no browser target is launchable in this workspace`, pointing to `output/qa-environment-preflight.json`; this is expected and prevents a missing visual test from being mistaken for a game failure or a pass.
- Tightened `npm run qa:visual` so in a browser-capable environment it now runs `build:webview`, `verify:webview-bundle`, `smoke:mobile-webview`, `smoke:systemic-loop`, and the develop-web-game client choreography that captures `output/web-game-current-objective/shot-*.png` plus `state-*.json`.
- Visual QA handoff checklist:
- Added `docs/CURRENT_OBJECTIVE_VISUAL_QA_CHECKLIST.md`, mapping the remaining visual/gameplay gate to exact commands, screenshots, state files, and pass criteria for browser and Android environments.
- Visual QA unblocked:
- Fixed `scripts/run_web_game_client_with_server.js` so the local HTTP server stays responsive while the develop-web-game Playwright client runs; the previous synchronous child process blocked Node's HTTP event loop.
- Added deterministic Pixi render flushing in `GameEngine.step()` and browser-automation-only `preserveDrawingBuffer` so Playwright can capture nonblack WebGL canvas screenshots.
- `npm run qa:web-game-client` now passes and writes visible gameplay screenshots plus `state-*.json` under `output/web-game-current-objective`.
- Fresh completion verification passed:
  `npx tsc --noEmit`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, and `npm run qa:visual`.
- Inspected `output/web-game-current-objective/shot-0.png` and `output/batch1-mobile-smoke.png`; both show visible gameplay with HUD, player, enemies, and terrain.
- Run-feel / variety / art follow-up:
- User selected visual companion Option B, asking for stronger changes without a full animation rebuild.
- Added `docs/superpowers/specs/2026-05-04-run-feel-variety-art-design.md` and `docs/superpowers/plans/2026-05-04-run-feel-variety-art.md` to capture the approved direction and checklist.
- Used OpenAI image generation to create a six-biome side-scroller panorama and copied it into `assets/backgrounds/biome-panorama.png`.
- Integrated the generated panorama in `BackgroundManager` as a low-parallax Pixi Sprite layer behind existing procedural geometry, and preloaded it through `spriteData.ts`.
- Tuned airborne horizontal movement with an `airSpeedMultiplier` so sustained jump movement stays below grounded run speed while remaining responsive.
- Changed level completion so reaching `targetKills` immediately clears the level; endpoint distance no longer blocks completion.
- Added explicit `levelModifiers` to campaign and endless levels, including route style, hazard density, verticality, and pressure bias; snapshots now expose these modifiers.
- Added `scripts/current_tuning_contract_check.js` for air-speed, kill-completion, modifier, and generated-art source/runtime coverage.
- Added `scripts/target_kill_completion_smoke.js`, which verifies the WebView runtime transitions from `PLAYING` to `LEVEL_COMPLETE` at the target kill count.
- Final verification for this pass:
  `npx tsc --noEmit`, `npm run check:gameplay-contracts`, and `npm run qa:visual` all passed.
- Inspected `output/web-game-current-objective/shot-0.png`, `output/batch1-mobile-smoke.png`, and `output/target-kill-completion/target-kill-completion.png`; generated coast art is visible and gameplay/UI remain readable.
- Arcade Gauntlet follow-up:
- Increased grounded run speed substantially while keeping airborne horizontal speed clearly lower than grounded speed.
- Reworked enemy updates around a full player target snapshot so chasers can lead moving targets, keep pressure at encounter distance, hop/lunge at airborne players, and ranged enemies can queue predictive high/low shots.
- Added real ground gaps to the physics engine and generated jump gaps per level, with pit fall recovery to the last safe point.
- Added active terrain traps, currently spikes and cycling fire vents, with damage, screen rendering, and snapshot telemetry.
- Made enemy spawns avoid gaps and traps so encounters do not start in impossible positions.
- Tightened the generated-art background companion layer so procedural silhouettes stay subtle and Ruined Coast no longer gets floating window marks over the panorama.
- Added `scripts/arcade_gauntlet_contract_check.js` and wired it into `npm run check:gameplay-contracts`.
- Added `scripts/arcade_gauntlet_smoke.js` plus `npm run qa:arcade-gauntlet` to exercise gap visibility, a successful gap jump, and trap damage in the browser.
- Verification for this pass:
  `npx tsc --noEmit`, `npm run check:gameplay-contracts`, `npm run qa:visual`, and `npm run qa:arcade-gauntlet` all passed.
- Inspected `output/web-game-current-objective/shot-0.png`, `output/arcade-gauntlet/near-gap.png`, `output/arcade-gauntlet/gap-jump.png`, and `output/arcade-gauntlet/trap-contact.png`; the playfield is readable and the new gaps/traps are visible.
- Full art replacement / enemy roster follow-up:
- Used OpenAI image generation for a full replacement atlas pass and processed the results into `assets/spritesheets/openai/hero-arcade.png`, `assets/spritesheets/openai/enemies-core.png`, `assets/spritesheets/openai/enemies-extra.png`, and `assets/spritesheets/openai/obstacles.png`.
- Swapped the playable character, core enemies, added enemies, and trap overlays to the generated atlases through `src/game/assets/spriteData.ts`; obstacle sprites now render over the existing collision-safe hazard geometry.
- Added four enemy behaviors: bomber range control with lobbed bombs, aerial diver attacks, fast aerial swoops, and a shielded guardian pressure unit.
- Expanded campaign and endless rosters so later levels mix the full enemy set, and fixed spawn wave indexing so adding enemies during a wave no longer skips every other spawn-pattern entry.
- Increased grounded run speed again and capped airborne sustained speed lower than grounded speed, preserving responsive air control while making ground movement clearly faster.
- Reworked background panorama rendering to crop the selected biome panel explicitly, fixing the Sky Forge level-10 background so the generated art appears instead of a dark playfield.
- Added `scripts/full_art_enemy_roster_contract_check.js` to the contract suite and added `scripts/full_art_roster_smoke.js` plus `npm run qa:full-art-roster` for a browser-level level-10 roster/art screenshot gate.
- Final verification for this pass:
  `npx tsc --noEmit`, `npm run qa:visual`, `npm run check:gameplay-contracts`, `npm run qa:full-art-roster`, and `npm run qa:arcade-gauntlet` all passed.
- Inspected `output/full-art-roster/level-10-roster.png`, `output/web-game-current-objective/shot-0.png`, `output/arcade-gauntlet/near-gap.png`, and `output/arcade-gauntlet/gap-jump.png`; generated character/enemy art, Sky Forge background art, gaps, traps, and HUD remain visible.
- Sprite polish / release follow-up:
- Added explicit `facesRight` source-art metadata to sprite sheets and routed player/enemy facing through `SkeletalSprite.setFacingRight()`. Generated enemy sheets are now treated as left-facing source art, fixing the double-flip issue.
- Added sheet-backed run bob/stride motion so the player reads as actively running even when sprite frames are subtle.
- Added `scripts/sprite_motion_orientation_contract_check.js` and included it in `npm run check:gameplay-contracts`.
- Bumped app versions to `1.8.13` and Android `versionCode` to `55`.
- Rebuilt the WebView payload and Android release app bundle at `android/app/build/outputs/bundle/release/app-release.aab`; the AAB timestamp is `2026-05-04 16:21:32`, size `40,475,801` bytes, and release manifest intermediates show `versionCode=55`, `versionName=1.8.13`.
- Verification for this release follow-up:
  `node scripts/sprite_motion_orientation_contract_check.js`, `npx tsc --noEmit`, `npm run check:gameplay-contracts`, `npm run qa:visual`, `npm run qa:full-art-roster`, `npm run qa:arcade-gauntlet`, `android\\gradlew.bat :app:bundleRelease --no-daemon --stacktrace`, and `jarsigner -verify -verbose -certs android\\app\\build\\outputs\\bundle\\release\\app-release.aab` all exited 0.
- Inspected `output/sprite-motion/run-right.png`, `output/full-art-roster/level-10-roster.png`, and `output/web-game-current-objective/shot-0.png`; the player shows a run pose and enemies to the right face toward the player.
2026-05-05
- Play Console blank-screen / PR 2 CI fix:
- Reproduced the reported `scripts/combat_modes_check.js` timeout locally. The actual boot blocker was earlier than the `PLAYING` wait: `window.render_game_to_text` was never defined because bootstrap failed with `SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied for this document.`
- Root cause was `src/game/storage.ts` catching localStorage read/write failures but then touching `window.localStorage` again inside `logStorageError()`, rethrowing the same security exception and aborting WebView bootstrap.
- Fixed storage fallback logging so denied DOM storage returns defaults instead of crashing, and gave the native inline WebView a stable `baseUrl: 'https://gronks-run.local/'` origin to reduce DOM-storage denial risk in Android WebView release contexts.
- Updated WebView/source contract checks for the new source shape and made target-kill source checks CRLF/whitespace tolerant.
- Bumped release metadata to `1.8.15` and Android `versionCode` 57 in `package.json`, `package-lock.json`, `app.json`, and `android/app/build.gradle`.
- Rebuilt the WebView payload and Android release app bundle at `android/app/build/outputs/bundle/release/app-release.aab`; the AAB timestamp is `2026-05-04 23:39:50`, size `40,481,015` bytes, and release manifest intermediates show `versionCode=57`, `versionName=1.8.15`.
- Verification for this pass:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, `npm run qa:visual`, `npm run qa:full-art-roster`, `npm run qa:arcade-gauntlet`, `android\\gradlew.bat :app:bundleRelease --no-daemon --stacktrace` from `android` with `JAVA_HOME=C:\\Users\\cchoa\\.gradle\\jdks\\eclipse_adoptium-17-amd64-windows.2`, and `jarsigner -verify -verbose -certs android\\app\\build\\outputs\\bundle\\release\\app-release.aab` all exited 0.
- Inspected `output/batch1-mobile-smoke.png`, `output/web-game-current-objective/shot-1.png`, `output/target-kill-completion/target-kill-completion.png`, `output/full-art-roster/level-10-roster.png`, `output/arcade-gauntlet/near-gap.png`, and `output/arcade-gauntlet/trap-contact.png`; the browser/WebView QA screenshots show gameplay, HUD, enemies, terrain, and level-clear UI rather than a blank canvas.
- Android emulator note: generated and installed AAB-derived APKs with standalone bundletool, but the available `Medium_Phone_API_36.1` emulator runs an x86_64 process while the release app is intentionally ARM-only (`armeabi-v7a,arm64-v8a`), so launch crashed before React Native with `couldn't find DSO to load: libreactnative.so`. This emulator could not validate the Play-target ARM runtime; use a physical ARM Android device or an ARM-compatible release test track for the final native smoke.
2026-05-05
- Gameplay/animation/UI/economy/trap/background polish pass:
- Added a dedicated ranged attack animation state plus visible ranged cue rendering. Running attacks now keep the `RUN` animation active while attack overlays/cues render, and snapshots expose `animation_state`, `runningAttackBlend`, and `rangedPoseVisible`.
- Strengthened the player run read by adding sheet-backed stride/leg cues behind the OpenAI hero sprite during `RUN`.
- Added gem-funded melee/ranged attack upgrade tiers in `src/game/weapons.ts`, persisted with `gronk_melee_upgrade_level` and `gronk_ranged_upgrade_level`. GameScene now applies upgraded effective weapon stats at run start; Armory displays gem balance, upgrade costs, and purchase buttons.
- Restyled native mobile controls in `App.js` with layered shadow/core/glyph chrome, and restyled Pixi menu/pause/result buttons with shared chrome helpers.
- Added a menu button registry to snapshots and fixed native `backButton` handling from Settings, Level Select, and Armory back to the main menu.
- Added magic spell/rune traps alongside spikes and fire vents, rendered through the existing OpenAI obstacle atlas and exposed in hazard snapshots.
- Improved the level background behind platforms with generated-panorama-backed parallax terrain echo bands in `BackgroundManager`.
- Added `scripts/polish_pass_contract_check.js` to `npm run check:gameplay-contracts` and `scripts/polish_pass_smoke.js` as `npm run qa:polish-pass`. The smoke sweeps submenu buttons/back behavior, clicks difficulty and sound settings, exercises visible and native Back paths, buys melee and ranged upgrades with gems, starts level 10, verifies upgraded melee/ranged stats, verifies spell-rune traps, verifies running plus ranged attack at the same time, and clicks pause-overlay Retry/Resume/Main Menu buttons through exposed overlay bounds.
- Verification for this pass:
  `node scripts/polish_pass_contract_check.js`, `node scripts/current_objective_runtime_check.js`, `node scripts/current_tuning_contract_check.js`, `node scripts/sprite_motion_orientation_contract_check.js`, `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, `npm run qa:visual`, `npm run qa:polish-pass`, `npm run qa:arcade-gauntlet`, and `npm run qa:full-art-roster` all exited 0.
- Inspected `output/polish-pass/settings-buttons.png`, `output/polish-pass/armory-upgrade.png`, and `output/polish-pass/polish-gameplay.png`; settings/armory buttons show the new chrome, the Armory shows the gem upgrade purchase state, and the gameplay frame shows level-10 background art plus a moving ranged shot/cue.
2026-05-05
- Obstacle art replacement pass:
- Used OpenAI image generation for a new 4x3 transparent obstacle atlas covering red crystal spikes, cycling fire vents, and magic rune traps in the current stylized fantasy arcade look.
- Processed the generated atlas through chroma-key removal and packed it into `assets/spritesheets/openai/obstacles.png`; source/preview artifacts are under `output/generated-obstacles/`.
- Recalibrated per-frame obstacle anchors from alpha bounds so fire vent dormant/active frames stay grounded in the same position, and scaled the sprites up so static/dormant traps read clearly during gameplay.
- Updated `GameScene` so spell/rune traps now animate through their generated frame row instead of only showing the final burst frame.
- Rebuilt the WebView payload and restarted the local preview on `http://127.0.0.1:4174/`.
- Verification for this pass:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, `npm run qa:arcade-gauntlet`, `npm run smoke:mobile-webview`, and `npm run qa:web-game-client` all exited 0.
- Inspected `output/obstacle-art-check/spikes.png`, `output/obstacle-art-check/fire-dormant.png`, `output/obstacle-art-check/fire-active.png`, and `output/obstacle-art-check/spell-rune.png`; the new trap art is visible, active fire stays aligned with the dormant vent, and rune traps use the generated magic effect.
2026-05-05
- Release build 1.8.18:
- Bumped app release metadata to `1.8.18` and Android `versionCode` to `60` in `package.json`, `package-lock.json`, `app.json`, and `android/app/build.gradle`.
- Rebuilt the WebView payload and Android release app bundle at `android/app/build/outputs/bundle/release/app-release.aab`; the AAB timestamp is `2026-05-05 16:44:06`, size `40,416,214` bytes, and release manifest intermediates show `versionCode=60`, `versionName=1.8.18`.
- The first Gradle build attempt from the long workspace path failed in Ninja because a React Native prefab header path exceeded 260 characters; rebuilding from a temporary short `subst` drive path succeeded without code changes.
- Verification for this release:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, `npm run qa:arcade-gauntlet`, `npm run smoke:mobile-webview`, `npm run qa:web-game-client`, `gradlew.bat :app:bundleRelease --no-daemon --stacktrace` from a short mapped path, and `jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab` all exited 0.
2026-05-06
- Started the 40-level movement/gap AI release goal.
- Added red coverage requiring exactly 40 authored levels, explicit jump+attack+movement runtime validation, and enemy gap maneuver snapshot evidence. Confirmed the new checks fail on the old build: 10 levels and missing `gapAction`.
- Implemented the first pass: expanded `LEVELS` to 40 literal entries, added paginated level select, added debug enemy spawn/clear hooks, and replaced frame-by-frame edge nudging with per-enemy gap maneuvers (`gap-vault`, `gap-retreat`, `gap-recover`) exposed in snapshots.
- Verification passed for `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, `npm run qa:forty-level-load`, `npm run qa:arcade-gauntlet`, `npm run smoke:mobile-webview`, `npm run qa:web-game-client`, `npm run qa:full-art-roster`, `npm run qa:polish-pass`, `npm run qa:sprite-animation`, and `npm run qa:visual`.
- Bumped release metadata to `1.8.20` / Android `versionCode` 62. Built the release AAB from short path `C:\gronk` to avoid Windows CMake path limits, then copied it back to `android/app/build/outputs/bundle/release/app-release.aab`. Manifest intermediates show `versionCode=62`, `versionName=1.8.20`; `jarsigner -verify -verbose -certs` verified the bundle, with the expected self-signed certificate warning.
2026-05-06
- Fixed follow-up mobile combo input regression:
- Root cause: native controls still used one `PanResponder` for the joystick. React Native's JS responder is exclusive, so dragging the joystick could starve sibling attack/jump/ranged button touches even with `onShouldBlockNativeResponder: false`.
- Replaced the joystick PanResponder with explicit multi-touch handling on the controls overlay. One touch identifier owns joystick movement while other simultaneous touches are coordinate-hit-tested to pause/jump/ranged/melee actions.
- Added contracts that reject the single-PanResponder control path and require the multi-touch action hit map.
- Fixed enemy pit-kill credit:
- Player damage now gives enemies a short knockback-credit window. During that window, gap-avoidance steering is skipped so an attack can knock the enemy into a gap; if the enemy falls below the ground while over a gap, it dies, is removed, and counts as a kill. Normal AI movement still uses the existing gap-vault/retreat/recover behavior.
- Added browser smoke coverage for a melee hit that knocks a surviving enemy into the first gap and verifies the kill count increments.
- Verification for this pass:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, `npm run qa:arcade-gauntlet`, `npm run smoke:mobile-webview`, `npm run qa:web-game-client`, `npm run qa:polish-pass`, `npm run qa:visual`, and `git diff --check` all exited 0.
2026-05-06
- Release build 1.8.21 follow-up:
- Bumped app release metadata to `1.8.21` and Android `versionCode` to `63` in `package.json`, `package-lock.json`, `app.json`, and `android/app/build.gradle`.
- Rebuilt the WebView payload and Android release app bundle from short path `C:\gronk`, then copied the final AAB back to `android/app/build/outputs/bundle/release/app-release.aab`.
- The AAB timestamp is `2026-05-05 22:22:54`, size `40,421,965` bytes, SHA-256 `4816012AD3239011008FB27C1333C322464F8F88757B311AC4501D55CA2437D0`, and release manifest intermediates show `versionCode=63`, `versionName=1.8.21`.
- Verification for this release:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, `npm run qa:arcade-gauntlet`, `npm run qa:visual`, `gradlew.bat :app:bundleRelease --no-daemon --stacktrace` from `C:\gronk\android`, `jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab`, and `git diff --check` all exited 0.
2026-05-06
- AdMob working note:
- Playtest confirmed the rewarded continue entry point appears in the installed app (`WATCH AD: CONTINUE` on the death screen), and AdMob reported live request/earnings activity for the app. Treat the rewarded-ad integration as working production wiring, not placeholder UI.
- Do not remove or casually swap the production Android AdMob app id `ca-app-pub-8879184280264151~8722286751`, the rewarded interstitial unit `ca-app-pub-8879184280264151/6328191159`, or the `adReady` -> `showAd` -> `adRewarded` continue flow without an explicit monetization change request and fresh device/AdMob verification.
- Strengthened `scripts/android_competitiveness_contract_check.js` so contract tests fail if the production AdMob IDs, dev test-ad fallback, native manifest metadata, or rewarded-continue bridge are removed.
2026-05-06
- Closed-testing polish build 1.8.22:
- Added a generated sky-forge main-menu background at `assets/backgrounds/main-menu-hero.png`, wired it into Pixi asset preloading, and restyled the title plate/backdrop overlays so the main menu reads as a richer game screen while keeping menu buttons readable.
- Made Settings and Armory responsive for compact landscape screens. Their panels/buttons now expose surface bounds in snapshots and the polish smoke asserts the compact layouts stay inside a 720x360 viewport.
- Updated enemy pit cleanup so any non-flying enemy that falls below a gap disappears. If it had player knockback credit or non-zero damage, the fall counts as a kill; otherwise it is removed without kill credit. While objective kills remain, pit cleanup forces an immediate replacement spawn so levels still have enough enemies to complete.
- Added Android immersive sticky/fullscreen handling in `MainActivity` to hide status/navigation bars during app focus and allow transient swipe reveal.
- Rebuilt the WebView payload and Android release app bundle from short path `C:\gronk`, then copied the final AAB back to `android/app/build/outputs/bundle/release/app-release.aab`. The AAB timestamp is `2026-05-05 23:18:11`, size `43,087,122` bytes, SHA-256 `214DC40C9527D2583B2C1755EE84C99E9D820CF4628A87EE612D39187C5A4AA9`, and release manifest intermediates show `versionCode=64`, `versionName=1.8.22`.
- Verification for this release:
  `npx tsc --noEmit`, `npm run build:webview`, `npm run verify:webview-bundle`, `npm run check:gameplay-contracts`, `npm run qa:polish-pass`, `npm run qa:arcade-gauntlet`, `npm run qa:visual`, `npm run qa:forty-level-load`, `npm run qa:full-art-roster`, `npm run qa:sprite-animation`, `gradlew.bat :app:bundleRelease --no-daemon --stacktrace` from `C:\gronk\android`, and `jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab` all exited 0.
- Inspected `output/polish-pass/main-menu-uplift.png`, `output/polish-pass/settings-compact.png`, and `output/polish-pass/armory-compact.png`; the generated menu art is visible and the compact submenu layouts fit without running off-screen.
