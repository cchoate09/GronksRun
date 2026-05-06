# Golem Store Art Release Design

## Goal

Ship a new Google Play build that fixes the heavy golem animation clipping, refreshes Play Store art around the current generated fantasy arcade direction, increments release metadata, and publishes the result to GitHub.

## Approved Direction

Use the recommended approach from the visual companion: create a fresh padded golem row for the `HEAVY` enemy instead of trying to hide the clipping with renderer offsets alone. The refreshed store assets should use the newer generated backgrounds, atlas-backed gameplay, traps, gaps, and richer menu art rather than the older green procedural screenshots.

## Golem Animation

- Replace the `HEAVY` row in `assets/spritesheets/openai/enemies-core.png` with a padded lava-stone golem row.
- Keep the existing atlas layout and `HEAVY` frame IDs `8`, `9`, `10`, and `11` so gameplay code and animations remain stable.
- Recalculate `HEAVY.frameOffsets` in `src/game/assets/spriteData.ts` after the asset is packed.
- Add a contract check that fails when any used `HEAVY` frame touches a cell edge or has too little padding for animation.

## Store Assets

- Refresh `store_assets/screenshot-*.png` from current live/gameplay outputs where possible.
- Rebuild `store_assets/feature-graphic-1024x500.png` as a branded composition using the current menu/background/gameplay direction.
- Rebuild `store_assets/app-icon-512.png` and app launcher icons from the same current fantasy arcade identity.
- Avoid the old flat green/procedural character style in Play-facing assets.

## Build And Release

- Increment `package.json`, `package-lock.json`, `app.json`, and Android Gradle release metadata from `1.8.22` / `versionCode 64`.
- Rebuild the WebView payload before the Android bundle.
- Build a production Android App Bundle at `android/app/build/outputs/bundle/release/app-release.aab`.
- Verify the bundle with `jarsigner`.
- Commit only the files belonging to this work and push the branch to GitHub.

## Verification

Run focused verification before claiming completion:

- golem padding contract
- TypeScript compile
- WebView build and bundle verification
- gameplay contracts
- relevant browser QA smokes for sprite animation, visual state, full-art roster, arcade gameplay, and mobile WebView
- Android release bundle build
- `jarsigner -verify`
- `git diff --check`

## Scope Notes

This release does not redesign all enemies, replace the playable heroes, change gameplay balance, or rework monetization. Existing AdMob IDs and rewarded continue flow remain unchanged.
