# Android Test Build Checklist

Use this before uploading a monitored Android test build to Google Play internal, closed, or open testing.

## 1. Config and telemetry

- Confirm `.env` or CI environment includes:
  - `EXPO_PUBLIC_SENTRY_DSN`
  - `EXPO_PUBLIC_POSTHOG_API_KEY`
  - `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
  - `SENTRY_AUTH_TOKEN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
- Confirm telemetry is enabled:
  - `EXPO_PUBLIC_TELEMETRY_ENABLED=true`
  - `EXPO_PUBLIC_ANALYTICS_ENABLED=true`
  - `EXPO_PUBLIC_CRASH_REPORTING_ENABLED=true`
- Confirm the target environment name matches the build intent:
  - `development`
  - `staging`
  - `production`

## 2. Local verification

- Run `node gen-gamehtmljs.js`
- Run `node --check game.js`
- Run `node --check scripts/mobile_webview_smoke.js`
- Run `npm run smoke:mobile-webview`
- Run `npx expo export --platform android --output-dir .expo-export-check\\batch-check`

Expected result:

- the smoke script passes
- the Android bundle export completes
- no new runtime errors appear in the smoke output
- scripted midgame coverage still reports `level_plan=scripted` for authored levels
- boss smoke coverage shows a readable boss cue plus active telegraph state

## 3. Build metadata

- Increment `version` and `versionCode` before the release build
- Confirm [package.json](C:/Users/cchoa/Claude_Sandbox/gronk-run-app/package.json), [app.json](C:/Users/cchoa/Claude_Sandbox/gronk-run-app/app.json), and Android Gradle metadata agree
- Confirm the correct signing key is in use for Play upload

## 4. Monitored gameplay pass

Install the build and verify:

- boot to first actionable screen
- native `app_open` event
- menu -> map -> char select flow
- level start analytics event
- tutorial step analytics event
- level complete analytics event
- death analytics event
- continue-offer analytics event
- retry and next-level analytics events
- ad request and native `ad_reward` events
- at least one boss fight shows readable attack telegraphs and a readable cue card
- no red in-game error overlay
- no WebView crash / process-gone loop

## 5. Android behavior checks

- hardware back behavior
- pause / resume after backgrounding
- audio pause and resume behavior
- resume from background during a boss fight leaves the game paused instead of resuming mid-attack
- safe-area layout on gesture-nav devices
- ad unavailable / loaded / rewarded / closed flow
- offline launch behavior
- low-end device quality fallback reaches a stable performance tier instead of stuttering indefinitely

## 6. Release notes to record

For each uploaded test build, record:

- build date
- version name
- version code
- branch and commit
- telemetry environment
- known issues
- tester focus areas

## 7. Go / no-go gate

Do not upload broadly if any of these fail:

- smoke script fails
- telemetry credentials are missing
- crash reporting is not receiving events
- level-complete or death funnel events are missing
- rewarded ads break progression
- Android navigation or resume behavior is unstable
