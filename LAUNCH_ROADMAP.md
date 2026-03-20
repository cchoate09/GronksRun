# Gronk's Run — Android Launch Roadmap

> **Last updated:** 2026-03-19
> **Target:** Google Play Store launch (Android)
> **Tech stack:** HTML5 Canvas + Expo/React Native WebView

---

## Current State Summary

Gronk's Run is feature-rich for an indie runner. Here's what's already built:

| Category | Status | Details |
|----------|--------|---------|
| Core Gameplay | Done | 6 movement mechanics (jump, double-jump, slide, dash, parry, ground pound), combo system, 40-level campaign + endless mode |
| Characters | Done | 6 playable characters with unique stats, 24 cosmetic skins with trail effects |
| Sprites | Partial | Gronk & Pip have sprite sheets; Bruk, Zara, Rex, Mog use procedural fallback |
| Enemies | Done | 7 enemy types with AI, projectiles, telegraphs, HP system |
| Obstacles | Done | 8 obstacle types across 5 themed worlds |
| Progression | Done | 40-level campaign, star ratings, gem currency, character unlocks |
| Shop | Done | 4 consumable powerups + 4 permanent upgrades |
| Monetization | Partial | Rewarded interstitial ads (continue + 2x gems). No IAP, no ad-removal option |
| UI/UX | Done | 19 screens including level map, shop, skins, missions, spin wheel, daily rewards |
| Audio | Partial | 11 synthesized SFX via Web Audio API. No recorded music tracks |
| Engagement | Done | Achievements (10), daily rewards, daily/weekly missions, spin wheel, combo system |
| Leaderboards | Missing | No Google Play Games integration |
| Save System | Done | localStorage with auto-save, data migration, multi-field persistence |
| Safe Areas | Partial | CSS env() variables read but button positioning still overlaps edges |
| Performance | Untested | Object pooling, chunk rendering, 200-particle cap — not tested on budget devices |

---

## Benchmark: Comparable Indie Runners

| Game | Team Size | Rating | Key Differentiators |
|------|-----------|--------|---------------------|
| Geometry Dash | Solo dev | 4.3★ | Precise controls, music sync, level editor, community levels |
| Alto's Odyssey | ~8 people | 4.4★ | Art direction, ambient audio, zen mode, photo mode |
| Crossy Road | 2 people | 4.4★ | 150+ characters, gifting system, minimal UI, instant restart |
| Jetpack Joyride | Small team | 4.3★ | Mission system (3 concurrent), slot machine, vehicles, achievements |
| Canabalt | Solo dev | 4.0★ | One-button simplicity, adaptive music, instant restart |
| Temple Run 2 | Small team | 4.3★ | Google Play Games leaderboards, seasonal events, power-ups |

### What Separates 3★ from 4.5★ (from review analysis)

1. **Ad frequency** — interstitials every run = 1★ reviews. Every 3+ runs = acceptable
2. **Crash stability** — must stay below 1% crash rate
3. **Control responsiveness** — <100ms input lag is mandatory
4. **Content depth** — unlockables give reason to return
5. **Offline support** — must work without internet
6. **Quick restart** — <2 taps from death to playing again

---

## Launch Roadmap

### Phase 1: Critical Fixes (Must-Have for Launch)

> Things that would cause rejection, crashes, or immediate 1-star reviews.

- [x] **Safe area + button fixes** — safe area system with CSS env() + fallback padding already implemented; buttons use SAFE_TOP/BOTTOM/LEFT/RIGHT offsets
- [x] **Ad frequency control** — ads gated to every 3rd death minimum + 60s cooldown between ads
- [x] **Privacy policy** — privacy-policy.html created (needs hosting on GitHub Pages or similar)
- [ ] **Data Safety form** — declare localStorage usage, ad SDK data collection (AdMob), no personal data collected *(Play Console task)*
- [ ] **IARC content rating** — complete the rating questionnaire on Play Console *(Play Console task)*
- [x] **Target API level** — targetSdkVersion=36, compileSdkVersion=35 ✓
- [x] **AAB format** — eas.json production profile configured for AAB ✓
- [x] **App icon + adaptive icon** — foreground/background/monochrome layers configured ✓
- [x] **Crash handling** — ErrorBoundary in App.js + WebView onRenderProcessGone recovery + game loop try/catch with error overlay
- [x] **Android back button** — hardware back → WebView bridge → phase-aware navigation (pause, go back, exit at menu)
- [x] **Offline support** — navigator.onLine + online/offline event listeners; ad buttons hidden when offline

### Phase 2: Polish & Quality (High Priority)

> What users expect from a 4+ star runner in 2026.

- [ ] **Graphics uplift** — gradient backgrounds, terrain textures, enhanced gems/obstacles/particles (planned in prior batch)
- [ ] **Remaining character sprites** — Bruk, Zara, Rex, Mog still render as colored circles
- [ ] **Real music tracks** — at least 1 looping track per theme (5 total). Web Audio synth music sounds thin on device speakers. Consider royalty-free tracks or procedural music libraries
- [ ] **Haptic feedback** — vibration on hit, death, gem milestones via WebView bridge to `ReactNative.Vibration`
- [ ] **First-run onboarding** — skip menu on first launch, drop player directly into Level 1 with interactive tutorial (Crossy Road / Alto's model)
- [ ] **Quick restart** — death screen should allow retry in 1 tap (currently requires navigating through continue/ad options)
- [ ] **Loading performance** — sprite Base64 decoding adds ~1-2s on cold start. Consider lazy-loading non-selected character sprites
- [ ] **Screen transitions** — current 0.25s fade is functional but flat. Add slide/scale transitions for more polish
- [ ] **Settings improvements** — add music volume separate from SFX (already have sliders but verify they work), add language/credits
- [ ] **Consistent art style** — enemies and obstacles are procedurally drawn while characters have sprites. Visual mismatch will be noticeable. Plan enemy/obstacle sprites or shift to a cohesive procedural style

### Phase 3: Engagement & Retention (Medium Priority)

> Features that drive Day-7 and Day-30 retention. Target 35-40% Day-1 retention.

- [ ] **Google Play Games Services** — leaderboards (best score, highest level) + cloud save + Play achievements
- [ ] **Ad-removal IAP** — $2.99 "Remove Ads" is expected and is a significant revenue source for indie games
- [ ] **Gem bundle IAPs** — small/medium/large gem packs for players who want to skip grinding
- [ ] **Rate-the-app prompt** — trigger after 5+ sessions or level 10, using in-app review API
- [ ] **Push notifications** — "Your daily reward is ready!" and "New weekly missions available!" (via Expo Notifications)
- [ ] **Social sharing** — share score/achievement screenshots with a branded overlay
- [ ] **Seasonal events** — holiday-themed skins, limited-time missions (low effort, high retention impact)
- [ ] **More achievements** — expand from 10 to 20+ to match Play Games expectations
- [ ] **Statistics screen polish** — add graphs/charts for runs over time, gem history, etc.

### Phase 4: Performance & Stability (Medium Priority)

> WebView games have unique challenges. These prevent bad reviews on budget devices.

- [ ] **Budget device testing** — test on a sub-$150 Android phone (2GB RAM). Canvas in WebView can be sluggish
- [ ] **Memory profiling** — Base64 sprite data (~450KB in JS) + decoded canvases consume significant memory. Monitor for OOM on low-end devices
- [ ] **Frame rate monitoring** — add debug FPS counter (dev builds only), target consistent 60fps, accept 30fps floor
- [ ] **Analytics integration** — Firebase Analytics or similar to track: levels played, death causes, session length, ad engagement, purchase conversion
- [ ] **Crash reporting** — Sentry or Firebase Crashlytics for both React Native layer and WebView errors
- [ ] **Reduce APK size** — current Base64 sprite data inflates the JS bundle. Consider loading sprites from assets/ folder via WebView file:// or asset:// protocol
- [ ] **Proguard/R8 optimization** — ensure minification is enabled for release builds
- [ ] **WebView hardware acceleration** — verify `androidLayerType="hardware"` is set on WebView component

### Phase 5: Store Listing & Launch Prep (Required Before Submit)

> Play Store won't approve without these.

- [ ] **Store listing screenshots** — minimum 4 screenshots (phone), recommended 8. Show gameplay, characters, shop, level map
- [ ] **Feature graphic** — 1024×500 banner for Play Store listing
- [ ] **Short description** — max 80 chars, keyword-optimized
- [ ] **Full description** — max 4000 chars, structured with bullet points and feature highlights
- [ ] **Promo video** — 30s-1min YouTube gameplay trailer (optional but significantly boosts conversion)
- [ ] **Closed testing track** — new personal developer accounts require 12 testers running the app for 14+ consecutive days before production access is granted
- [ ] **Internal testing** — run at least 2 weeks of internal/closed testing before production release
- [ ] **Store listing experiments** — A/B test icon and screenshots once live
- [ ] **Developer account** — $25 one-time Google Play Developer registration (if not already done)
- [ ] **Content rating certificate** — generated after completing IARC questionnaire

### Phase 6: Post-Launch (Ongoing)

> Day-1 through Day-90 priorities.

- [ ] **Monitor crash rate** — keep below 1% (Play Console vitals)
- [ ] **Monitor ANR rate** — keep below 0.5% (WebView games are prone to ANR on slow devices)
- [ ] **Respond to reviews** — reply to all 1-2 star reviews within 48 hours
- [ ] **Weekly missions refresh** — keep mission content fresh to maintain engagement
- [ ] **Monthly content updates** — new skins, seasonal events, or levels to maintain visibility in Play Store algorithm
- [ ] **A/B test ad frequency** — find the revenue-optimal frequency that doesn't tank ratings
- [ ] **Monitor retention** — Day-1 target: 35-40%, Day-7 target: 15-20%, Day-30 target: 5-8%

---

## Gap Analysis Summary

| Feature Area | Gronk's Run | Typical 4★ Indie Runner | Gap |
|-------------|-------------|------------------------|-----|
| Core mechanics | 6 moves + combos | 2-3 moves | **Ahead** |
| Characters | 6 with skins | 3-5 with unlocks | **On par** |
| Visual quality | Mixed (sprites + procedural) | Consistent style | **Behind** |
| Music | Synth only | 1-5 recorded tracks | **Behind** |
| Ad implementation | Rewarded only | Rewarded + removal IAP | **Behind** |
| Engagement loops | Missions + daily + achievements | Same | **On par** |
| Leaderboards | None | Google Play Games | **Behind** |
| Onboarding | Menu-first | Play-first | **Behind** |
| Store readiness | No listing assets | Full listing | **Behind** |
| Haptics | None | Basic vibration | **Behind** |
| Offline support | Mostly works | Required | **Needs verification** |
| Performance | Untested on low-end | 60fps on budget phones | **Needs verification** |

---

## Estimated Batch Sizing

| Phase | Estimated Effort | Can Ship Without? |
|-------|-----------------|-------------------|
| Phase 1: Critical Fixes | 2-3 sessions | No |
| Phase 2: Polish & Quality | 4-6 sessions | Technically yes, but ratings will suffer |
| Phase 3: Engagement | 3-4 sessions | Yes (add post-launch) |
| Phase 4: Performance | 2-3 sessions | Risky — WebView on budget devices is unknown |
| Phase 5: Store Listing | 1-2 sessions | No |
| Phase 6: Post-Launch | Ongoing | N/A |

**Minimum viable launch path:** Phase 1 → Phase 5 → Phase 4 (testing) → Submit

**Recommended launch path:** Phase 1 → Phase 2 → Phase 4 → Phase 5 → Submit → Phase 3 post-launch

---

## Progress Tracking

**Overall: 8 / 47 items complete** (Phase 1: 9/11 — remaining 2 are Play Console tasks)

Use this file as a living document. Check off items as they're completed and update the date at the top.
