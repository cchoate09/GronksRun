# Batch 1 Foundation

This pass turns the existing analytics and crash bridge into a real launch foundation for Android. The app now supports:

- Sentry crash reporting in the native shell and React Native layer
- PostHog event forwarding for WebView game analytics
- A repeatable mobile WebView smoke test with screenshot and JSON output
- Machine-readable game state output for QA automation
- richer funnel analytics context:
  biome, character, phase, run score, run gems, endless/daily flags, and native device metadata

## Environment variables

Copy `.env.example` to `.env` for local Expo usage, or define the same values in your CI / EAS / local shell before release builds.

- `EXPO_PUBLIC_TELEMETRY_ENABLED`
- `EXPO_PUBLIC_ANALYTICS_ENABLED`
- `EXPO_PUBLIC_CRASH_REPORTING_ENABLED`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_SENTRY_ENVIRONMENT`
- `EXPO_PUBLIC_POSTHOG_API_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`

## Sentry release uploads

For symbolicated release crashes, define these build-time environment variables before Android release builds:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Those values should stay out of committed app config. The public DSN is safe to ship in the client; the auth token is not.

## Smoke test

Run:

```bash
npm run smoke:mobile-webview
```

Artifacts are written to:

- `output/batch1-mobile-smoke.png`
- `output/batch1-mobile-smoke.json`

The smoke test validates:

- the game boots in a mobile landscape viewport
- `window.render_game_to_text()` is available
- `window.advanceTime()` is available
- the WebView bridge emits the Batch 1 gameplay funnel events:
  `session_start`, `menu_view`, `map_view`, `char_select_view`, `tutorial_step`, `tutorial_complete`, `level_start`, `continue_offer`, `level_complete`, `death`, `retry`, `next_level`, `ad_show`
- forced smoke states render without triggering the in-game error overlay:
  boot, menu, map, char select, tutorial, playing, continue prompt, level complete, dead
- no page errors or console errors occur during the smoke run
