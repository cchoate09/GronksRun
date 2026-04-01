Original prompt: [@game-studio](plugin://game-studio@openai-curated) This app is in a broken state, and I need help to revive it. The app does not load and there is an issue with the sprite animations. Can you take a deep look at this app, get it to a working state so it loads? Then can you do a gap analysis of this app, which is a sidescroller for android, and see what kinds of improvements you would recommend. Take as much time as you need.

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
