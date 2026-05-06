# Golem Store Art Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the clipped golem animation, refresh Play Store art around the current generated fantasy arcade direction, and ship a new verified Android App Bundle.

**Architecture:** Keep the runtime atlas contract stable by preserving `HEAVY` frame IDs 8-11 in `assets/spritesheets/openai/enemies-core.png`. Add focused Node/sharp tooling for padding validation and asset composition, then run the existing WebView and Android release pipeline.

**Tech Stack:** TypeScript, Pixi.js, Expo React Native, Node.js, sharp, Gradle, Android App Bundle signing.

---

## File Structure

- Modify `assets/spritesheets/openai/enemies-core.png`: replace only the `HEAVY` row with padded golem frames.
- Modify `src/game/assets/spriteData.ts`: update `HEAVY.frameOffsets` after packing.
- Create `scripts/golem_padding_contract_check.js`: validates used `HEAVY` frames have edge padding and stable rendered baselines.
- Modify `scripts/run_contracts.js`: include the new golem padding contract.
- Create `scripts/refresh_store_assets.js`: rebuilds Play-facing screenshots/icon/feature graphic from current generated-art outputs.
- Modify `store_assets/*.png`: refreshed Play listing image assets.
- Modify launcher art under `assets/`: align icon/splash/favicon/adaptive icon assets with the refreshed icon.
- Modify version metadata in `package.json`, `package-lock.json`, `app.json`, and `android/app/build.gradle`.

## Task 1: Add Golem Padding Regression Coverage

**Files:**
- Create: `scripts/golem_padding_contract_check.js`
- Modify: `scripts/run_contracts.js`

- [x] **Step 1: Write the failing contract**

Create `scripts/golem_padding_contract_check.js` with a sharp-based check that reads `ENEMY_SHEETS.HEAVY`, inspects frames 8-11, and fails if any visible alpha touches the frame boundary or if rendered foot baselines/centers jitter beyond current limits.

- [x] **Step 2: Run the contract red**

Run: `node scripts/golem_padding_contract_check.js`

Expected before the asset fix: failure naming at least one `HEAVY` frame with insufficient padding.

- [x] **Step 3: Wire the contract into the suite**

Add `scripts/golem_padding_contract_check.js` to the `contracts` list in `scripts/run_contracts.js` so `npm run check:gameplay-contracts` runs it.

## Task 2: Replace And Stabilize The Golem Row

**Files:**
- Modify: `assets/spritesheets/openai/enemies-core.png`
- Modify: `src/game/assets/spriteData.ts`

- [x] **Step 1: Generate or derive padded golem frames**

Create a fresh padded lava-stone golem row in the current fantasy arcade style, then pack it into row 3 of `assets/spritesheets/openai/enemies-core.png` while preserving the atlas dimensions `1536x1024`, grid `4x4`, and frame IDs `8`, `9`, `10`, `11`.

- [x] **Step 2: Recalculate frame offsets**

Measure alpha bounds for frames 8-11 and update `ENEMY_SHEETS.HEAVY.frameOffsets` so rendered foot baselines are stable across `IDLE`, `RUN`, `ATTACK`, and `HIT`.

- [x] **Step 3: Run golem and sprite checks green**

Run:

```powershell
node scripts/golem_padding_contract_check.js
node scripts/sprite_animation_quality_contract_check.js
```

Expected after the asset fix: both commands exit 0.

## Task 3: Refresh Store Assets

**Files:**
- Create: `scripts/refresh_store_assets.js`
- Modify: `store_assets/app-icon-512.png`
- Modify: `store_assets/feature-graphic-1024x500.png`
- Modify: `store_assets/screenshot-1-gameplay.png`
- Modify: `store_assets/screenshot-2-characters.png`
- Modify: `store_assets/screenshot-3-levelmap.png`
- Modify: `store_assets/screenshot-4-bossfight.png`
- Modify: `assets/icon.png`
- Modify: `assets/splash-icon.png`
- Modify: `assets/favicon.png`
- Modify: `assets/android-icon-foreground.png`
- Modify: `assets/android-icon-background.png`
- Modify: `assets/android-icon-monochrome.png`

- [x] **Step 1: Build a deterministic store-asset script**

Create `scripts/refresh_store_assets.js` using `sharp`. It should copy current verified gameplay/menu screenshots into `store_assets`, compose a `1024x500` feature graphic from `assets/backgrounds/main-menu-hero.png`, and create icon/adaptive-icon assets that match the current generated fantasy arcade identity.

- [x] **Step 2: Run the asset script**

Run: `node scripts/refresh_store_assets.js`

Expected: refreshed PNGs are written to `store_assets/` and launcher icon paths referenced by `app.json`.

- [x] **Step 3: Inspect output dimensions**

Run:

```powershell
node -e "const sharp=require('sharp'); const files=['store_assets/app-icon-512.png','store_assets/feature-graphic-1024x500.png','store_assets/screenshot-1-gameplay.png','assets/icon.png','assets/android-icon-foreground.png']; (async()=>{for(const f of files){const m=await sharp(f).metadata(); console.log(f,m.width,m.height)}})().catch(e=>{console.error(e);process.exit(1)})"
```

Expected: icon `512x512`, feature graphic `1024x500`, screenshots valid Play Store portrait/landscape PNGs, launcher assets valid PNGs.

## Task 4: Bump Version And Build Release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Modify: `android/app/build.gradle`
- Modify: WebView generated payload files from `npm run build:webview`

- [x] **Step 1: Increment release metadata**

Run: `npm run version:bump`

Expected: version advances from `1.8.22` to the next patch and Android `versionCode` advances from `64`.

- [x] **Step 2: Run WebView and gameplay verification**

Run:

```powershell
npx tsc --noEmit
npm run build:webview
npm run verify:webview-bundle
npm run check:gameplay-contracts
npm run qa:visual
npm run qa:full-art-roster
npm run qa:arcade-gauntlet
npm run qa:sprite-animation
npm run smoke:mobile-webview
```

Expected: every command exits 0.

- [x] **Step 3: Build the Android App Bundle**

Use a verified short junction path if Windows path limits hit Gradle/CMake:

```powershell
$repo = 'C:\Users\cchoa\Claude_Sandbox\gronk-run-app'
New-Item -ItemType Junction -Path C:\gronkj -Target $repo
Set-Location C:\gronkj\android
$env:JAVA_HOME='C:\Users\cchoa\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2'
.\gradlew.bat :app:bundleRelease --no-daemon --stacktrace
Set-Location $repo
[System.IO.Directory]::Delete('C:\gronkj')
```

Expected: `android/app/build/outputs/bundle/release/app-release.aab` exists and Gradle exits 0.

- [x] **Step 4: Verify signing and metadata**

Run:

```powershell
jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab
Get-FileHash android/app/build/outputs/bundle/release/app-release.aab -Algorithm SHA256
```

Expected: `jarsigner` exits 0 and SHA-256 prints for the bundle.

## Task 5: Commit And Push

**Files:**
- Stage only files modified for this release.

- [x] **Step 1: Review diff and whitespace**

Run:

```powershell
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. `git status --short` may include unrelated untracked files; do not stage those.

- [ ] **Step 2: Commit scoped release work**

Run:

```powershell
git add docs/superpowers/specs/2026-05-06-golem-store-art-release-design.md docs/superpowers/plans/2026-05-06-golem-store-art-release.md scripts/golem_padding_contract_check.js scripts/run_contracts.js scripts/refresh_store_assets.js src/game/assets/spriteData.ts assets/spritesheets/openai/enemies-core.png store_assets/app-icon-512.png store_assets/feature-graphic-1024x500.png store_assets/screenshot-1-gameplay.png store_assets/screenshot-2-characters.png store_assets/screenshot-3-levelmap.png store_assets/screenshot-4-bossfight.png assets/icon.png assets/splash-icon.png assets/favicon.png assets/android-icon-foreground.png assets/android-icon-background.png assets/android-icon-monochrome.png package.json package-lock.json app.json android/app/build.gradle assets/gameHtml.js
git status --short
git commit -m "Polish golem art and refresh Play assets"
```

Expected: only scoped release files are staged and commit succeeds.

- [ ] **Step 3: Push to GitHub**

Run: `git push origin main`

Expected: push exits 0.
