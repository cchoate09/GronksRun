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
