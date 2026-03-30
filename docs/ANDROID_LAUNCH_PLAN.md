# Gronk's Run Android Launch Plan

Last updated: 2026-03-29

## Goal

Take Gronk's Run from "playable and uploadable" to "credible Android launch candidate" with a plan that balances:

- launch quality
- Android compliance and operational readiness
- retention fundamentals
- scope discipline for a small team

This plan assumes Gronk's Run should launch first as a polished premium-feeling free-to-play Android game, not as a giant live-service title on day one.

## What I Scanned

Local product scan:

- current codebase and runtime notes in `progress.md`
- current backlog in `docs/GAME_IMPROVEMENT_TODO.md`
- native shell in `App.js`
- current Android config in `app.json` and Gradle files

External benchmark scan:

- Nintendo's current Super Mario Run pages and event messaging
- Halfbrick's current Jetpack Joyride, Dan the Man, and Jetpack Joyride Racing messaging
- Gameloft's 2025 Minion Rush relaunch/update messaging
- current Google Play launch-readiness guidance around testing, store assets, Android vitals, and target API policy

## Executive Read

Gronk's Run is closer to a soft-launch candidate than a true production launch candidate.

Why:

- The core game loop exists and already has more content depth than many early indie runners:
  characters, skins, missions, bosses, achievements, daily login, endless mode, rewarded ads, level map progression.
- The app now boots, builds, and can ship as an Android App Bundle.
- The launch blockers are not "missing game systems" so much as "missing product cohesion":
  art direction, onboarding, telemetry, stability instrumentation, store readiness, and Android hardening.

My recommendation:

- Do not treat the next upload as a full public launch.
- Use the next cycle as a structured soft launch / closed test push.
- Aim for production launch only after the presentation, onboarding, crash reporting, analytics, and retention surfaces are in materially better shape.

## Current Strengths

- Good content breadth for a small runner:
  boss fights, biome variety, character roster, skins, missions, daily rewards, endless mode.
- Distinct core verbs:
  jump, dash, slide, ground pound, parry, combo.
- Android packaging is functional right now:
  the game builds locally, signs, and uploads as an `.aab`.
- The game has personality:
  characters, bright readable themes, and enough meta systems to support progression.

## Current Launch Risks

- Visual cohesion is still below market leaders.
- The game teaches too much through text and too little through guided action.
- UI and reward presentation are improving, but still not at the level users expect from top Android runners.
- The WebView architecture is fragile and heavy for long-term Android scale.
- Analytics and crash reporting are not truly wired:
  `App.js` still contains TODO-level placeholders for Firebase / Crashlytics.
- Compliance and store readiness work is not visible in-repo:
  privacy policy, Data Safety, content rating, store assets, and testing-track process still need explicit completion.

## Benchmark Takeaways From Similar Games

### 1. Super Mario Run

What it does well:

- extremely clear one-hand core fantasy
- fast "tap to act" readability
- multiple distinct modes, not just a single run loop
- strong kingdom/meta layer
- current event cadence still gives it reasons to return

Relevant benchmark takeaway for Gronk's Run:

- Gronk does not need Mario's budget, but it does need the same clarity:
  one obvious verb at a time, fast onboarding, and a stronger "why play the next run?" structure.

### 2. Jetpack Joyride Classic

What it does well:

- instantly readable fantasy and silhouette
- high mechanical clarity at speed
- strong costume/vehicle identity
- long-running update history around rewards, daily value, and device-tailored performance

Relevant benchmark takeaway for Gronk's Run:

- Gronk needs clearer readability and cleaner moment-to-moment feedback before adding more systems.
- Cosmetic and progression value should be more visible and more desirable from the first session.

### 3. Dan the Man

What it does well:

- clearer authored identity as a mobile action-platformer
- strong content framing around story, battle mode, daily events, and character variety
- more cohesive art/presentation than Gronk currently has

Relevant benchmark takeaway for Gronk's Run:

- Gronk already has broad systems, but Dan the Man packages its breadth better.
- Gronk should improve how characters, progression, and modes are surfaced, not just increase raw feature count.

### 4. Minion Rush (2025 update)

What it does well:

- modernized visuals and streamlined UI
- explicit progression and accomplishment framing
- stronger profile/customization identity
- emphasis on endless run, rewards, and easier tracking of progress

Relevant benchmark takeaway for Gronk's Run:

- current runner expectations are no longer just "fun loop + store page."
- Even older runners are refreshing UX, progression surfaces, and player identity.

### 5. Current Halfbrick+ direction

What it signals about the market:

- cosmetics, passes, shared progression, and social connectivity now shape the upper end of mobile action-launch expectations
- small teams do not need to match this at launch, but they do need a believable future-facing retention spine

Relevant benchmark takeaway for Gronk's Run:

- do not try to bolt on a season pass right now
- do establish:
  clear cosmetic progression, a future event framework, better profile identity, and post-launch hooks

## Gap Analysis

## A. Core Presentation Gap

Benchmark norm:

- strong visual identity
- high readability at speed
- clean reward moments
- UI that feels authored, not debug-like

Gronk today:

- mixed sprite styles
- inconsistent obstacle/enemy presentation
- still-prototype-feeling typography and HUD treatment
- reward screens improving, but not yet premium

Launch impact:

- first impression risk
- lower store conversion
- weaker word of mouth

Priority:

- P0

## B. Onboarding Gap

Benchmark norm:

- new players learn the first 2-3 verbs by doing, not reading
- session-one success is engineered
- early progression is motivating and legible

Gronk today:

- relies heavily on tooltip text and discovery
- has strong verbs, but their sequencing is not taught as cleanly as it should be

Launch impact:

- lower tutorial completion
- weaker D1 retention
- early frustration on smaller Android screens

Priority:

- P0

## C. Meta/Retention Gap

Benchmark norm:

- clear reasons to come back:
  progression, cosmetics, challenges, events, streaks, profile identity

Gronk today:

- has missions, login rewards, achievements, endless mode, and skins
- but those systems are not framed cleanly enough to feel irresistible

Launch impact:

- the game may underperform relative to its actual content depth

Priority:

- P0 for clarity
- P1 for expansion

## D. Stability / Operations Gap

Benchmark norm:

- crash reporting
- analytics funnel coverage
- device profiling
- automated smoke coverage
- ANR/crash monitoring

Gronk today:

- logs analytics/crash messages internally but still has TODO-level integrations in the native shell
- lacks visible production telemetry plumbing

Launch impact:

- soft-launch data will be low-confidence
- production bugs will be slower to diagnose

Priority:

- P0

## E. Android Compliance / Store Gap

Benchmark norm:

- testing-track readiness
- store assets
- Data Safety
- target API compliance
- crash/vitals monitoring
- privacy/legal materials

Gronk today:

- has a buildable Android package
- but the launch-compliance layer is not fully represented in the repo or workflow

Launch impact:

- blocked or weak production rollout
- avoidable review friction

Priority:

- P0

## F. Monetization Trust Gap

Benchmark norm:

- ads feel deliberate and fair
- reward loops are visible
- monetization does not cheapen the first hour

Gronk today:

- rewarded ad hooks exist
- monetization balance and user trust positioning are not yet proven

Launch impact:

- poor reviews if ad friction arrives before the game earns trust

Priority:

- P1

## Recommended Launch Strategy

Use a three-stage release path:

1. Internal polish sprint
2. Closed / limited soft launch
3. Production launch

Do not skip directly from "it builds" to full public launch.

## Phase 1: Production-Candidate Sprint

Target: 3 to 5 weeks

Objective:

- Make the game look cohesive
- Make session one clear
- Make the app observable

Workstream 1: Visual identity and readability

- Lock a style guide for characters, enemies, hazards, FX, and UI.
- Normalize all hero, enemy, and obstacle assets to one art direction.
- Finish the HUD / overlay cleanup across every remaining screen.
- Redo level intro, level complete, and death screens to feel rewarding.
- Audit contrast and readability on smaller Android displays.

Exit criteria:

- every primary gameplay surface reads clearly on a 6-7 inch device
- no major style clashes remain in the first 10 levels

Workstream 2: First-session onboarding

- Convert early tutorialing from tooltip-heavy to action-heavy.
- Make levels 1-3 explicitly teach jump, dash, slide, ground pound, and threat reads.
- Add stronger first-win celebration.
- Clarify why characters, skins, missions, and login rewards matter.

Exit criteria:

- a new player can understand the run loop without external explanation
- first completion / failure states clearly push the next action

Workstream 3: Native telemetry and crash pipeline

- Integrate real analytics instead of dev logging only.
- Integrate real crash reporting instead of TODO placeholders.
- Add dashboard events for:
  app open, menu, map, char select, level start, tutorial completion, death, level complete, ad shown, ad rewarded, retry, next level.
- Add basic release logging around device model, OS version, selected character, level, and phase.

Exit criteria:

- every critical phase transition is traceable
- native and game-loop crashes are visible outside local logs

Workstream 4: Android performance and stability

- Profile load time, memory, frame pacing, and heat on at least:
  one low-end Android phone, one mid-range Samsung, one modern Pixel.
- Reduce boot pressure from the monolithic WebView payload where possible.
- Verify pause/resume, back button, gesture nav, rotation lock, audio interruption, and app restore.

Exit criteria:

- no major launch-blocking ANR / crash / resume bugs
- acceptable first-load time on mid/low-tier Android

## Phase 2: Soft Launch Readiness

Target: 2 to 4 weeks

Objective:

- Gather trustworthy retention and stability data
- Tune the first 10 levels and ad economy

Workstream 1: Progression clarity

- Tighten level map messaging.
- Make unlocks feel more deliberate.
- Surface missions and login rewards with clearer "claim" energy.
- Improve character differentiation and character-select comprehension.

Workstream 2: Economy and monetization

- Tune ad timing so the first-session experience is not disrupted too early.
- Decide whether launch includes:
  rewarded ads only, or rewarded plus interstitial.
- Add or explicitly defer:
  remove-ads IAP, starter pack, cosmetic bundle.

My recommendation:

- launch soft test with rewarded ads only unless retention is already strong
- add interstitials only after telemetry shows they do not damage D1/D7

Workstream 3: Content readiness

- Polish levels 1-10 first; this is where launch lives.
- Improve boss readability and reward value.
- Ensure every biome shown in store assets looks production-ready.

Exit criteria:

- first 20-30 minutes feel cohesive
- monetization feels fair
- store screenshots reflect the actual in-game quality

## Phase 3: Production Launch Readiness

Target: 1 to 2 weeks after soft-launch learnings

Objective:

- Finish Play Console readiness
- Turn soft-launch learnings into a clean production launch

Workstream 1: Play Console and policy completion

- Finalize Data Safety.
- Finalize content rating / IARC.
- Finalize privacy policy hosting and links.
- Validate testing-track requirements for your developer-account type.
- Verify target API compliance for the current Play policy window.
- Review Android vitals and pre-launch results before full rollout.

Workstream 2: Store presence

- Build final icon, feature graphic, and screenshot set.
- Rewrite short description and full description around the clearest game fantasy.
- Create a trailer only if it matches the actual quality bar.
- Make sure the first three screenshots communicate:
  1. the side-scrolling action
  2. character / progression identity
  3. boss / variety / reward energy

Workstream 3: Launch operations

- Decide update cadence for the first 30-60 days.
- Prepare first post-launch content drop:
  new challenge week, new skin drop, or first event.
- Prepare review-response workflow and crash triage cadence.

Exit criteria:

- crash and ANR data are acceptable
- store page assets match real gameplay quality
- first 30 days of support work are scheduled

## Suggested Priority Order

### Must do before any meaningful soft launch

- art / UI cohesion pass
- onboarding pass for levels 1-3
- real analytics integration
- real crash reporting integration
- Android device matrix test
- Play Console readiness checklist

### Must do before production launch

- polished store assets
- tuned ad economy
- first 10 levels polished
- level-complete / death / reward loops feeling premium
- launch QA across multiple Android device classes

### Safe to defer until after launch

- season pass
- social multiplayer
- deep cloud save
- cross-game progression
- large event framework

## Detailed Task List

## Product and design

- [ ] Write the v1 launch promise in one sentence.
- [ ] Define the first-session "aha" moment.
- [ ] Define the first-session win state.
- [ ] Choose the top 3 hero characters to foreground in launch assets.
- [ ] Choose the top 2 most visually polished biomes to foreground in store assets.

## Art and UI

- [ ] Finalize a style guide.
- [ ] Replace remaining off-style character/enemy/hazard art.
- [ ] Finish menu, map, pause, death, and completion presentation pass.
- [ ] Replace debug-feeling typography with a real title/body/number system.
- [ ] Create store screenshot compositions after the art pass, not before.

## Gameplay and onboarding

- [ ] Rebuild tutorial flow around action prompts and level scripting.
- [ ] Tune first 5 levels for readability and reduced friction.
- [ ] Clarify combo value and survivability tools.
- [ ] Improve boss telegraphs and early boss pacing.

## Tech and performance

- [ ] Integrate real analytics backend.
- [ ] Integrate real crash backend.
- [ ] Add automated smoke tests for boot, menu, map, play, complete, death.
- [ ] Profile startup and memory on low-end Android.
- [ ] Reduce boot cost from inline bundle / eager asset initialization.

## Android launch operations

- [ ] Confirm developer-account testing requirements.
- [ ] Verify target API compliance at release time.
- [ ] Complete Data Safety and content rating.
- [ ] Host privacy policy.
- [ ] Review ad SDK and policy requirements.
- [ ] Prepare store listing assets and metadata.

## Retention and monetization

- [ ] Decide final launch ad strategy.
- [ ] Decide whether to ship a remove-ads purchase at launch or later.
- [ ] Strengthen mission / daily reward / achievement framing.
- [ ] Prepare first 30-day event or content drop.

## Go / No-Go Checklist

Green-light production launch only if all of the following are true:

- the first 10 levels look visually cohesive
- session-one onboarding is clear without outside explanation
- the game is crash-reporting in production
- analytics covers the whole early funnel
- rewarded ads behave correctly on real devices
- Android navigation, resume, audio interruption, and safe areas are stable
- store page assets accurately reflect the shipping quality
- policy and listing tasks are complete in Play Console

## Success Metrics

These are launch heuristics, not sourced platform mandates.
They are informed estimates for a mobile runner soft launch and should be treated as working targets to refine once data exists.

- Tutorial completion:
  target 80%+
- Level 1 completion:
  target 70%+
- D1 retention:
  target 25-35%
- D7 retention:
  target 6-12%
- Crash-free users:
  target 99.5%+
- ANR:
  stay comfortably below bad-behavior thresholds visible in Android vitals
- Rewarded ad opt-in:
  target acceptance high enough to monetize without depressing progression sentiment

## Final Recommendation

The right launch question is not "Can this be published?"
It can.

The right question is:

"Can this compete for player trust once someone sees the icon, installs, opens the app, and plays for 10 minutes?"

Today, the answer is:

- yes on core mechanics
- maybe on content depth
- not yet on presentation, onboarding, telemetry, and launch operations

If you execute the P0 items in this plan, Gronk's Run can become a credible Android launch candidate without needing to become a giant live-service product first.

## References

- Nintendo: Super Mario Run event/news page and official site
  - https://www.nintendo.com/us/whatsnew/mobile-news-wonder-flowers-arrive-for-a-super-mario-run-special-event/
  - https://supermariorun.com/en/index.html
- Halfbrick: Jetpack Joyride Classic
  - https://www.halfbrick.com/games/jetpack-joyride
  - https://www.halfbrick.com/blog/jetpack-joyride-receives-biggest-update-ever
- Halfbrick: Dan the Man
  - https://www.halfbrick.com/games/dan-the-man
  - https://www.halfbrick.com/blog/halfbrick-kicking-old-school-global-launch-dan-man
- Halfbrick: Jetpack Joyride Racing / Halfbrick+ direction
  - https://www.halfbrick.com/news/jetpack-joyride-press-release
- Gameloft: Minion Rush 2025 update
  - https://www.gameloft.com/newsroom/minion-rush-unity-update
- Google Play / Android launch guidance
  - https://support.google.com/googleplay/android-developer/answer/14151465
  - https://support.google.com/googleplay/android-developer/answer/11926878
  - https://support.google.com/googleplay/android-developer/answer/9866151
  - https://developer.android.com/games/optimize/vitals
  - https://play.google.com/console/about/static/pdf/user_journey_checklist.pdf
