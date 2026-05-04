# Current Objective Visual QA Checklist

This checklist closes the remaining visual/gameplay gate for the current objective:

1. The player can move and attack at the same time.
2. The native jump button is restored and works.
3. Close enemies keep pressure and collide/attack instead of stopping short.
4. Levels feel less monotonous.
5. The home menu's third button stays on-screen.
6. The game has been loop-tested for fun and engagement.

## Prerequisites

Run these first:

```powershell
npm run build:webview
npm run verify:webview-bundle
npm run check:gameplay-contracts
npm run qa:preflight
```

If `qa:preflight` reports `browserLaunchable=false`, `adbUsable=false`, and `avds=none`, stop. The workspace cannot perform visual QA. Attach a runnable Chrome/WebView target or Android device/emulator, then rerun this checklist.

Latest local preflight reported `browserLaunchable=true`, `adbUsable=true`, and no configured AVDs, so browser visual QA is available while emulator QA still requires an AVD or connected device.

## Browser Visual Gate

Run:

```powershell
npm run qa:visual
```

Expected result in a browser-capable environment:

- `npm run build:webview` passes.
- `npm run verify:webview-bundle` passes.
- `npm run smoke:mobile-webview` passes.
- `npm run smoke:systemic-loop` passes.
- The develop-web-game client pass writes `output/web-game-current-objective/shot-*.png` and `state-*.json`.
- Screenshots are written under `output/`.
- JSON state reports show `phase: "PLAYING"` after start.
- No `errors-*.json`, page errors, or console error entries are produced.

Inspect the screenshots, not only the command exit code. Confirm:

- Main menu shows `CONTINUE`, `ENDLESS RUN`, `LEVEL SELECT`, and `SETTINGS` fully on-screen at compact landscape sizes.
- Gameplay canvas is nonblank and the player, enemies, terrain, HUD, and controls are visible.
- Jump/attack feedback is readable.
- Enemies visually close distance and make contact/attack rather than idling before the player.

## Web Game Client Pass

`npm run qa:visual` already runs this pass. To rerun only the develop-web-game client from a browser-capable environment:

```powershell
npm run qa:web-game-client
```

Inspect:

- `output/web-game-current-objective/shot-*.png`
- `output/web-game-current-objective/state-*.json`

Pass criteria:

- `state-*.json` shows player `x` increasing during attack input.
- `attackMode` or `attackPhase` reflects the attack while player velocity remains active.
- Jump input produces upward motion.
- Screenshots show visible movement, attack feedback, and readable gameplay.

## Android Device/Emulator Pass

If a device or emulator is available:

```powershell
adb devices -l
android\gradlew.bat :app:installDebug --no-daemon
adb -s <serial> shell cmd package resolve-activity --brief com.gronksrun.game
adb -s <serial> shell am start -n <package>/<activity>
```

Capture screenshots after each step:

```powershell
adb -s <serial> exec-out screencap -p > output/android-current-objective-menu.png
adb -s <serial> exec-out screencap -p > output/android-current-objective-gameplay.png
```

Use taps/swipes to verify:

- `JUMP`, `RANGED`, `MELEE`, and pause buttons are visible above Android navigation.
- Pressing `JUMP` makes the player jump.
- Holding joystick right while tapping `MELEE` keeps the player moving and attacking.
- Enemies approach and damage/attack on contact.
- Compact menu layout keeps the third button fully visible.

## Final Completion Evidence

Only mark the objective complete when all of these artifacts exist and pass inspection:

- `npm run check:gameplay-contracts` output showing all current objective checks passed.
- `npm run qa:visual` passing in a browser-capable environment.
- Fresh screenshots from either browser or Android gameplay, reviewed visually.
- Fresh `render_game_to_text` state confirming movement+attack, jump, enemy pressure, and varied level metadata.
- No new page errors, console errors, runtime overlays, or Android crash logs.
