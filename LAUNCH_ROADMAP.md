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

- [x] **Graphics uplift** — gradient backgrounds, terrain gradients, twinkling stars, cloud parallax, enhanced gems with glow/sparkles, additive particle blending, atmospheric overlays, vignette
- [ ] **Remaining character sprites** — Bruk, Zara, Rex, Mog still render as colored circles *(deferred — needs artist assets)*
- [x] **Enhanced procedural music** — 6-layer system: bass drone, sub bass, pad with LFO rhythm, filtered melody arpeggio, high shimmer, filter sweeps. Per-theme patterns
- [x] **Haptic feedback** — vibration via WebView→RN bridge: light (gem), medium (hit), heavy (death), pattern (level complete)
- [x] **First-run onboarding** — fresh save skips menu, drops directly into Level 1 as Gronk with tutorial
- [x] **Quick restart** — death screen: instant RETRY (same level), NEW RUN (level 1), LEVEL MAP. No cooldown timer
- [x] **Loading performance** — lazy sprite loading: only selected character loads during splash, others load in background from MENU
- [x] **Screen transitions** — snappier 0.2s fade transitions (from 0.25s)
- [x] **Settings improvements** — credits section added, music/SFX volume sliders verified working, version bumped to 1.3
- [ ] **Consistent art style** — enemies/obstacles procedurally drawn vs sprite characters *(deferred — needs artist assets)*

### Phase 3: Engagement & Retention (Medium Priority)

> Features that drive Day-7 and Day-30 retention. Target 35-40% Day-1 retention.

- [ ] **Google Play Games Services** — leaderboards + cloud save + Play achievements *(deferred — needs Play Console setup)*
- [ ] **Ad-removal IAP** — $2.99 "Remove Ads" *(deferred — needs Play Console billing setup)*
- [ ] **Gem bundle IAPs** — gem packs for skip grinding *(deferred — needs Play Console billing setup)*
- [x] **Rate-the-app prompt** — triggers after 5+ runs or level 10, with Rate/Later buttons, opens Play Store listing
- [ ] **Push notifications** — daily reward/mission reminders *(deferred — needs Expo Notifications setup)*
- [x] **Social sharing** — canvas screenshot capture + RN Share API on death & level complete screens
- [x] **Seasonal events** — 4 seasonal events (Halloween, Winter, Spring, Summer) with event-specific missions + level map banner
- [x] **More achievements** — expanded from 10 to 24 achievements across 5 tiers (beginner, gems, score, combat, persistence)
- [x] **Statistics screen polish** — grouped layout (Progression/Collection/Combat), icons, achievement progress bar, best score & streak display

### Phase 4: Performance & Stability (Medium Priority)

> WebView games have unique challenges. These prevent bad reviews on budget devices.

- [x] **Budget device adaptive quality** — auto-detects device performance in first 1.5s of gameplay, scales particles (60/120/200), stars (20/40/60), clouds (2/4/6), ambients (10/20/30), skips vignette+atmospheric overlay on low-end
- [x] **Memory profiling** — vignette cache cleared on resize, sprite memory documented (~1MB/character), particle object pooling verified
- [x] **Frame rate monitoring** — rolling 60-frame FPS average, frame time graph in debug mode, mini FPS overlay during gameplay, auto-detection of low/medium/high performance tiers
- [x] **Analytics integration** — event bridge from WebView→RN for 8 event types (level_start, level_complete, player_death, ad_watched, shop_purchase, achievement_unlocked, session_start, share). Ready for Firebase drop-in
- [x] **Crash reporting** — WebView game loop errors + global window.onerror + unhandled promise rejections forwarded to RN with phase, FPS, particle count context. Ready for Crashlytics drop-in
- [x] **Reduce APK size** — stripped x86/x86_64 architectures (ARM-only), enabled JS bundle compression, R8 minification. **APK: 66MB → 31MB (53% reduction)**
- [x] **Proguard/R8 optimization** — R8 minification enabled for release builds ✓
- [x] **WebView hardware acceleration** — `androidLayerType="hardware"` set on WebView component ✓

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

**Overall: 29 / 47 items complete** (Phase 1: 9/11, Phase 2: 8/10 — remaining items need artist assets or Play Console)

Use this file as a living document. Check off items as they're completed and update the date at the top.
