Original prompt: [@game-studio](plugin://game-studio@openai-curated) This app is in a broken state, and I need help to revive it. The app does not load and there is an issue with the sprite animations. Can you take a deep look at this app, get it to a working state so it loads? Then can you do a gap analysis of this app, which is a sidescroller for android, and see what kinds of improvements you would recommend. Take as much time as you need.

2026-03-27
- Initial triage found two hard boot blockers:
- `index.html` inline game script has a syntax error caused by literal `\n` escapes being converted into real newlines inside a JS string.
- `App.js` loads `gameHtml` as an HTML string in `WebView`, but that HTML depends on relative `assets.js` and `audio_assets.js` scripts, which is fragile or broken in string-backed WebViews.
- `game.js` parses correctly and appears to be the safer source of truth than the current generated `index.html`.
