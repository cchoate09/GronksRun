# Gronk's Run — Game Design Document

**Version:** 1.2.0 (Build 3)
**Platform:** Android (Google Play — Internal Testing)
**Tech Stack:** HTML5 Canvas in Expo/React Native WebView
**Last Updated:** 2026-03-24

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [Current Feature Status](#2-current-feature-status)
3. [Characters](#3-characters)
4. [Enemies & Obstacles](#4-enemies--obstacles)
5. [Worlds & Levels](#5-worlds--levels)
6. [Boss Fights](#6-boss-fights)
7. [Power-ups & Shop](#7-power-ups--shop)
8. [Progression Systems](#8-progression-systems)
9. [UI Screens & Flow](#9-ui-screens--flow)
10. [Audio](#10-audio)
11. [Visual Effects](#11-visual-effects)
12. [Performance & Technical](#12-performance--technical)
13. [Remaining Work for Release](#13-remaining-work-for-release)
14. [Known Issues](#14-known-issues)
15. [Improvement Roadmap](#15-improvement-roadmap)

---

## 1. Game Overview

**Genre:** Side-scrolling auto-runner
**Target Audience:** Casual mobile gamers (ages 8+)
**Core Loop:** Run → Dodge/Fight → Collect Gems → Upgrade → Repeat
**Monetization Model:** Free with ads (rewarded video for continues & spin wheel)

**Elevator Pitch:**
Gronk's Run is a fast-paced runner where 6 unique characters dash, slide, and ground-pound through 40+ levels across 5 themed worlds, fighting 7 enemy types and epic multi-phase bosses. Deep progression with daily rewards, missions, achievements, skins, and an endless mode keeps players coming back.

---

## 2. Current Feature Status

### Fully Implemented
- 6 playable characters with unique stats and unlock conditions
- 7 enemy types with distinct AI, attacks, and projectile patterns
- 5 world themes (Jungle, Volcano, Glacier, Swamp, Sky) cycling across 40+ levels
- 5 multi-phase boss fights (3 phases each)
- Full movement system: jump, double-jump, slide, dash, ground pound, parry
- 4 action chains (Launcher, Momentum Slide, Meteor, Quake Rush)
- Combo system with escalating multipliers (up to 8x at 50+ combo)
- Power-up system from 3 sources (gem milestones, spin wheel, shop)
- Shop with per-run consumables and permanent upgrades
- Skin/cosmetics system per character
- 31 achievements with permanent stat bonuses
- Daily login calendar (7-day cycle with escalating rewards)
- Daily challenge mode (seed-based, fixed character rotation)
- Endless mode with smooth difficulty scaling and timed bosses
- Mission system (3 daily + 4 weekly missions with gem rewards)
- Notification dots / red badges on menu items with unclaimed rewards
- Procedural music per theme (pentatonic scales, tempo variation)
- Synthesized SFX via Web Audio API (11 sound effects)
- Parallax backgrounds (5 layers per theme)
- Particle system with object pooling
- Screen shake, slow-motion, speed lines, floating damage numbers
- Death tumble animation
- Combo escalation visuals (glow at 10x, fire at 20x, rainbow at 50x)
- Near-miss slow-motion (0.15s time dilation)
- Power-up announcement banners
- Tutorial/onboarding with animated arrow indicators
- Adaptive performance detection (LOW/MED/HIGH tiers)
- Save/load via localStorage
- Continue system with ad-gated revives
- Settings (music/SFX volume, screen shake toggle)
- Debug mode (triple-tap title)
- Privacy policy page (GitHub Pages ready)

### Partially Implemented / Needs Polish
- Enemy physics (recently improved — ground-tracking, bouncing projectiles)
- Background graphics (recently enhanced — removed ugly grass, richer themes)
- Ad integration (UI buttons exist, but actual ad SDK not wired up)
- Haptic feedback (bridge calls exist, need native module)

### Not Yet Implemented
- Real ad SDK integration (AdMob/Unity Ads)
- Analytics / crash reporting (bridge stubs exist, no native SDK)
- Push notifications
- Cloud save / cross-device sync
- Leaderboards (Google Play Games Services)
- Social sharing (share button UI exists, native share not wired)
- Rate-me prompt (logic exists, Play Store link needed)
- Localization / multi-language support
- Accessibility features (colorblind mode, larger text options)
- Sound asset files (currently all synthesized — no music tracks or recorded SFX)

---

## 3. Characters

| # | Name | Role | HP | Speed | Jump | Hitbox | Unlock Condition |
|---|------|------|-----|-------|------|--------|------------------|
| 0 | **Gronk** | Balanced | 100 | 1.0x | -800 | 1.0x | Always unlocked |
| 1 | **Pip** | Agile | 70 | 1.05x | -960 | 0.72x | Reach Level 5 |
| 2 | **Bruk** | Tank | 150 | 0.93x | -720 | 1.25x | Reach Level 10 |
| 3 | **Zara** | Collector | 80 | 1.12x | -770 | 0.88x | Collect 200 gems |
| 4 | **Rex** | Speed | 60 | 1.2x | -850 | 0.65x | Reach Level 20 |
| 5 | **Mog** | Mystic | 90 | 0.97x | -780 | 1.0x | Beat all 40 levels |

**Character Specials:**
- **Bruk** starts with Shield
- **Zara** starts with +5 gems
- **Mog** starts with permanent Gem Magnet

Each character has a 6-frame sprite sheet (4 idle + run/action frames) with skin variants purchasable from the shop.

---

## 4. Enemies & Obstacles

### Enemy Types

| Enemy | HP | Behavior | Projectile | Spawn Pattern |
|-------|-----|----------|------------|---------------|
| **Troll** | 40 | Ground walker | Thrown rocks (gravity arc) | Ground level, moves with world |
| **Charger** | 30 | 1.2s warning → fast dash | Rolling debris particles | Ground charge from right |
| **Diver** | 20 | Flying, sinusoidal bobbing | Aimed feather darts | Top of screen |
| **Witch** | 25 | Ground caster, hovers | Homing skull projectiles | Ground level, ranged |
| **Golem** | 60 | Heavy ground tank | Shockwave + arcing boulders | Ground level, boss-like |
| **Bomber** | 15 | Mid-height flyer | Gravity bombs dropped down | Mid-air, flies across |
| **Serpent** | 35 | Ground snake, sinuous | Venom arc projectiles | Ground level |

### Projectile Physics (Recently Improved)
- All projectiles now bounce off terrain surfaces
- Boulders and rocks follow parabolic arcs with gravity
- Ground-based enemies track terrain height (no more floating)
- Spawn cooldown: 6 seconds base, scales with difficulty

### Static Obstacles
- **Log** — ground obstacle, must jump over
- **Spikes** — ground hazard, must jump or dash through
- **Fire Geyser** — periodic eruption, timed avoidance

---

## 5. Worlds & Levels

### Theme Rotation (5 themes, cycling every 5 levels)

| Theme | Color Palette | Ambient Effect | Music Feel |
|-------|--------------|----------------|------------|
| **Jungle** | Blues, greens | Leaf particles | Tropical, upbeat |
| **Volcano** | Reds, oranges | Ember particles | Low, ominous |
| **Glacier** | Cyans, whites | Snow drift | Bright, ethereal |
| **Swamp** | Dark greens, browns | Fireflies | Minor, mysterious |
| **Sky** | Light blues, golds | Cloud wisps | High, airy |

### Level Structure
- **40 base levels** (8 cycles of 5 themes)
- Each cycle increases difficulty by 20% and target time by 30%
- Boss fight every 5 levels (levels 5, 10, 15, 20, 25, 30, 35, 40)
- Star rating per level (1-3 stars based on time, gems, HP remaining)
- Level map UI shows node-based progression with boss markers

### Game Modes
| Mode | Description |
|------|-------------|
| **Story Mode** | Progress through 40 levels with increasing difficulty |
| **Endless Mode** | No level cap, themes rotate every 90s, boss every 3 min |
| **Daily Challenge** | Seed-based daily run, fixed character, no continues |

---

## 6. Boss Fights

| Boss | Theme | HP | Phase 1 Attacks | Phase 2+ | Phase 3 Special |
|------|-------|----|-----------------|----------|-----------------|
| **Troll King** | Jungle | 100 | Rock clusters, ground pound | All attacks faster | Vine eruption |
| **Volcano Golem** | Volcano | 150 | Boulder rain, fire beam | +1.25x speed | Magma pools |
| **Ice Dragon** | Glacier | 120 | Ice shards, ice pillars | Cycling all attacks | Frost cone |
| **Witch Queen** | Swamp | 100 | Homing skulls, poison cloud | +1.25x speed | Shadow burst |
| **Sky Phoenix** | Sky | 130 | Swoop, feather storm | Cycling all attacks | Dive bomb |

**Phase Mechanics:**
- Phase 1: 100-66% HP — base attack pattern
- Phase 2: 66-33% HP — "BOSS ENRAGED!" — faster attacks, more patterns
- Phase 3: 33-0% HP — "BOSS FURY!" — 1.5x speed, screen-wide shockwaves every 4s

---

## 7. Power-ups & Shop

### In-Level Gem Milestones
| Gems | Power-up | Repeats Every |
|------|----------|---------------|
| 5 | Shield | 25 gems |
| 15 | Gem Magnet | One-time |
| 30 | Extra Life | 35 gems |
| 50 | Star Power (12s invincibility) | 50 gems |

### Spin Wheel (8 Segments, between levels)
Shield, Speed Boost (+30%), Magnet, Extra Life, Star Power (12s), +10s Time, Double Score (2x), Tiny Hitbox (60% size, 30s)

### Shop — Per-Run Consumables
| Item | Cost | Effect |
|------|------|--------|
| Shield | 10 gems | Start next level with shield |
| Magnet | 15 gems | Start with gem magnet |
| Extra Life | 25 gems | Bonus continue |
| +10s Time | 20 gems | Extra time on next level |

### Shop — Permanent Upgrades
| Item | Cost | Effect |
|------|------|--------|
| +10 Max HP | 50 gems | All characters gain +10 HP |
| Dash Cooldown | 75 gems | Reduce dash CD by 0.2s |
| +1 Continue | 100 gems | Extra revive per run |
| Pound Range | 60 gems | +10% ground pound radius |

---

## 8. Progression Systems

### Save Data (localStorage key: 'gronk2')
Persistent across sessions: selected character, highest level, best scores, total gems, unlocked characters, level stars, achievements, shop upgrades, mission progress, daily streak, owned skins, volume settings, achievement stat bonuses.

### Achievements (31 total)
Categories: Milestone (level progression), Gems (collection tiers), Score (point thresholds), Combat (action counts), Persistence (run counts), Streaks (login chains).

Selected achievements grant permanent bonuses:
- **Dasher** (100 dashes): Reduced dash cooldown
- **Smasher** (50 obstacles): Increased pound radius
- **Gem Master** (500 gems): Increased magnet range

### Daily Login Rewards
- 7-day visual calendar with escalating rewards
- Day 7 = exclusive skin unlock
- Streak bonus: +10% reward per consecutive day (max 2x at day 30)
- Missed day resets streak to day 1

### Missions
- **3 Daily Missions** — refresh every 24 hours, 10-40 gem rewards
- **4 Weekly Missions** — 7-day window, 40-120 gem rewards
- Visual progress bars with claim animations
- Mission refresh timer displayed in UI
- Bonus reward for completing all daily missions

---

## 9. UI Screens & Flow

### Screen Flow
```
LOADING → MENU
              ├→ DAILY_REWARD (auto on login)
              ├→ LEVEL_MAP → CHAR_SELECT → LEVEL_INTRO → PLAYING
              │                                            ├→ PAUSED → (Resume / Map / Settings)
              │                                            ├→ BOSS_FIGHT
              │                                            ├→ LEVEL_COMPLETE → SPIN_WHEEL → next level
              │                                            └→ DEAD → CONTINUE_PROMPT → (Ad revive / Game Over)
              ├→ SKINS
              ├→ SETTINGS
              ├→ STATS / ACHIEVEMENTS
              ├→ MISSIONS
              ├→ ENDLESS MODE
              └→ DAILY CHALLENGE
```

### Key UI Elements
- **Notification Dots** — Red badges on menu items with unclaimed rewards
- **Level Map** — Scrollable node path with star ratings, boss markers, auto-focus on current level
- **HUD** — HP bar, gem counter, combo multiplier, timer, action buttons (jump/slide/dash/pound)
- **Boss HUD** — Boss HP bar with phase indicator

---

## 10. Audio

### SFX (Web Audio API — Synthesized)
11 sound effects: jump, land, gem collect, hit, death, dash, slide, shield break, level complete fanfare, wheel tick, UI tap.

### Music (Procedural)
- Theme-specific pentatonic scales with tempo variation
- Harmonic oscillators with biquad low-pass filter
- Fade in/out on level transitions
- Volume: Music default 35%, SFX default 70%

### Haptics
- Light: gem collection, UI taps
- Medium: enemy hits, combo milestones
- Heavy: boss phase transitions, death

---

## 11. Visual Effects

| Effect | Description | Performance Tier |
|--------|-------------|------------------|
| Parallax backgrounds | 5 depth layers per theme | All |
| Particle system | Gems, dust, explosions, ambient (pooled) | 60/120/200 max |
| Screen shake | Intensity-based, directional support | All |
| Slow-motion | 0.15s at 30% speed on near-miss | All |
| Speed lines | Radial lines during dash | MED+ |
| Floating text | Damage numbers, "+1" gems, combo text | All |
| Combo glow | Visual escalation at 10x/20x/50x combo | All |
| Death tumble | 24-frame ragdoll with particle burst | All |
| Squash/stretch | Character deformation per action state | All |
| Vignette | Screen edge darkening | MED+ |
| Theme atmospherics | Fog, glow overlays per world | MED+ |
| Enemy telegraph | 0.5s wind-up warning before attacks | All |

---

## 12. Performance & Technical

### Architecture
- Single `index.html` file (~6.85 MB) containing all Base64 sprites + game logic
- Rendered in a WebView within Expo/React Native shell
- `gen-gamehtmljs.js` script packages index.html into a JS module for the WebView

### Adaptive Quality
| Tier | FPS Threshold | Max Particles | Decorations | Effects |
|------|---------------|---------------|-------------|---------|
| LOW | < 25 FPS | 60 | None | Minimal |
| MED | 25-45 FPS | 120 | Base layer | Most |
| HIGH | > 45 FPS | 200 | Full 4-layer | All |

### Build Pipeline
- **APK** (testing): `./gradlew assembleRelease`
- **AAB** (Play Store): `./gradlew bundleRelease`
- Release keystore: PKCS12, backed up at `C:\Users\cchoa\Documents\gronksrun-keystore\`
- Current version: versionCode 3, versionName 1.2.0

---

## 13. Remaining Work for Release

### Critical (Must-Have for Public Release)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | **Ad SDK Integration** | Medium | Wire up AdMob or Unity Ads to existing ad button UI. Currently ad buttons exist but call stub functions. Need: rewarded video for continues, interstitials between levels, optional banner. |
| 2 | **Crash Reporting** | Low | Integrate Firebase Crashlytics or Sentry. Bridge stubs already exist in code. |
| 3 | **Analytics** | Low | Integrate Firebase Analytics. Track level completions, gem economy, retention. Bridge stubs exist. |
| 4 | **Store Listing Assets** | Low | Feature graphic (1024x500), screenshots (phone + tablet), short video trailer. |
| 5 | **Play Store Rating** | Low | Content rating questionnaire in Play Console. |
| 6 | **Final QA Pass** | Medium | Test all 40 levels, all 5 bosses, all 6 characters, edge cases. |
| 7 | **Privacy Policy Live URL** | Low | Deploy privacy policy to GitHub Pages and add URL to Play Console. |

### High Priority (Should-Have)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 8 | **Real Music Tracks** | High | Replace procedural music with composed tracks per theme. Current synth music is functional but lacks polish. |
| 9 | **Recorded SFX** | Medium | Replace synthesized SFX with recorded/designed sound effects for more satisfying feedback. |
| 10 | **Improved Sprite Art** | High | Current sprites are a mix of AI-generated and procedural. Several enemy sprites could be more polished. |
| 11 | **Tablet Layout** | Medium | Test and optimize layout for tablet screen ratios. |
| 12 | **Google Play Games Services** | Medium | Leaderboards and cloud save via GPGS. |
| 13 | **Push Notifications** | Medium | Daily reminder, mission refresh, streak-at-risk alerts. |
| 14 | **Social Sharing** | Low | Wire up native share intent for score screenshots. |
| 15 | **Rate-Me Prompt** | Low | Add Play Store deep link to existing rate prompt logic. |

### Nice-to-Have (Post-Launch)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 16 | **Localization** | High | Multi-language support (at minimum: EN, ES, PT, FR, DE, JA, KO). |
| 17 | **Accessibility** | Medium | Colorblind mode, adjustable text size, screen reader hints. |
| 18 | **Seasonal Events** | Medium | Holiday-themed levels, limited-time skins, event missions. |
| 19 | **New Characters** | Medium | Additional unlockable characters with unique abilities. |
| 20 | **New Worlds** | High | Additional theme packs (Desert, Ocean, Space, etc.). |
| 21 | **Challenge Modes** | Medium | Speed run, no-hit, boss rush modes. |
| 22 | **Friend System** | High | Compare scores, send gifts, challenge friends. |
| 23 | **iOS Port** | Medium | Build and publish to App Store (Expo supports iOS). |
| 24 | **Cloud Save** | Medium | Cross-device progress sync (independent of GPGS). |

---

## 14. Known Issues

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 1 | Synthesized audio can sound harsh on some devices | Low | Web Audio API frequency sweeps vary by device speaker |
| 2 | Large index.html (~6.85 MB) | Low | All sprites are Base64 embedded. Could extract to separate asset loading but increases complexity. |
| 3 | CRLF line endings in index.html | Low | Windows environment causes issues with patch scripts. Must use `\r\n` in all string replacements. |
| 4 | Ad buttons are non-functional | Medium | UI exists but no ad SDK is integrated. Players see "Watch Ad" but nothing happens. |
| 5 | No offline indicator | Low | Game works offline (all assets embedded) but no explicit offline mode messaging. |
| 6 | WebView performance ceiling | Medium | Canvas in WebView is inherently slower than native. Adaptive quality helps but complex scenes can still drop frames on low-end devices. |

---

## 15. Improvement Roadmap

### Completed Phases

#### Phase 1: Visual Overhaul ✅
- Parallax backgrounds with 5 depth layers
- Textured terrain (removed flat-color ground)
- Menu screen redesign with animated title
- Level map visual upgrade with node paths
- Death tumble animation
- Floating text particle system
- Speed lines at high velocity
- Slow-motion system foundation
- Announcement banner system
- Environment decorations per theme

#### Phase 2: Gameplay Feel ✅
- Near-miss slow-motion (0.15s time dilation on close dodge)
- Floating damage numbers on enemy hits
- Power-up announcement banners with per-type names/colors
- Combo escalation visuals (glow→fire→rainbow at 10/20/50x)
- Directional camera shake variety
- Improved onboarding with animated tutorial arrows
- Shield break blue flash

#### Phase 3: Enemy Physics & Backgrounds ✅
- Ground-based enemies now track terrain height
- Bouncing boulder/rock projectiles with proper gravity
- Richer parallax backgrounds per theme
- Removed ugly grass texture from terrain
- Fixed level 2 loading error

#### Phase 4: Daily & Missions ✅
- 7-day daily login calendar with escalating rewards
- Notification dots / red badges on menu items
- Improved missions UI with visual progress bars
- Claim animations and mission refresh timer

### Future Phases

#### Phase 5: Monetization & Analytics
- AdMob/Unity Ads SDK integration
- Firebase Analytics + Crashlytics
- A/B testing framework for gem economy tuning
- Revenue optimization (ad frequency, placement)

#### Phase 6: Polish & Launch
- Professional music tracks (5 themes + menu + boss)
- Designed SFX replacements
- Final sprite art polish pass
- Full QA across device matrix
- Store listing optimization (ASO)
- Soft launch in select markets
- Global release

#### Phase 7: Post-Launch Growth
- Google Play Games Services (leaderboards, achievements, cloud save)
- Push notification campaigns
- Seasonal events and limited-time content
- New characters, worlds, and boss types
- iOS App Store release
- Community features (sharing, friends)

---

## Appendix: File Structure

```
gronk-run-app/
├── index.html              # Complete game (HTML5 Canvas + all sprites)
├── gameHtml.js             # Generated: index.html packaged as JS module
├── gen-gamehtmljs.js       # Script to generate gameHtml.js
├── App.js                  # React Native entry (WebView wrapper)
├── app.json                # Expo config
├── package.json            # Dependencies
├── GAME_DESIGN_DOC.md      # This document
├── privacy-policy.html     # Privacy policy for Play Store
├── assets/
│   ├── gameHtml.js         # Copy of generated game module
│   └── spritesheets/
│       └── enemies/
│           ├── regenerated/ # Improved enemy sprite sheets
│           └── generated/   # Procedurally generated sheets
├── android/
│   └── app/
│       ├── build.gradle    # Android build config (signing, versioning)
│       └── build/outputs/
│           ├── apk/release/     # Built APKs
│           └── bundle/release/  # Built AABs for Play Store
├── phase1_visual_overhaul.js    # Phase 1 patch script
├── phase1_fix.js                # Phase 1 CRLF fix script
├── phase2_gameplay_feel.js      # Phase 2 patch script
├── phase3_patch.js              # Phase 3 patch script
├── phase4_patch.js              # Phase 4 patch script
├── phase4_daily_missions.js     # Phase 4 missions patch
├── gen_sprite_sheets.js         # Procedural enemy sprite generator
└── fix_all_sprites.js           # Sprite replacement script
```

---

*Document generated 2026-03-24. Update this file as features are completed.*
