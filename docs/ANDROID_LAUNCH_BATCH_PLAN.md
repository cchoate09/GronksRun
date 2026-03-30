# Gronk's Run Android Launch Batch Plan

Last updated: 2026-03-29

This is the implementation-order version of the launch roadmap in `docs/ANDROID_LAUNCH_PLAN.md`.

The goal here is not just to list work.
It is to put the work into the order that gives the best chance of:

- improving the player experience fastest
- reducing rework
- making soft-launch data trustworthy
- getting the game to a launch-ready Android state without turning v1 into an endless refactor

## Planning Rules

This batch order is based on five rules:

1. Do foundational work early if every later batch depends on it.
2. Fix the first 10 minutes before expanding content.
3. Build one visual system before replacing lots of art.
4. Do not soft launch without real crash and analytics visibility.
5. Defer live-service ambition until the core experience is stable, readable, and retention-capable.

## Summary Sequence

1. Batch 1: Observability, release foundation, and test harness
2. Batch 2: First-session onboarding and early progression clarity
3. Batch 3: Global UI system and core screen cleanup
4. Batch 4: Art direction lock and sprite / hazard normalization
5. Batch 5: Gameplay feel, bosses, biome identity, and reward polish
6. Batch 6: Android hardening, performance, and monetization QA
7. Batch 7: Play Console, store assets, policy, and soft-launch setup
8. Batch 8: Soft-launch response and production-launch polish

## Batch 1: Observability, Release Foundation, and Test Harness

Target outcome:

- every important state can be measured
- every important crash can be seen
- later polish work is built on a safer release pipeline

Why first:

- This batch reduces blind spots for every later build.
- Without it, you can improve the game and still not know why players are dropping or crashing.

Main changes:

- Wire real analytics in the native shell.
- Wire real crash reporting in the native shell.
- Expand event coverage beyond the current placeholder flow.
- Add automated smoke coverage for:
  boot, menu, map, char select, level intro, gameplay, death, level complete.
- Make the generated bundle path more disciplined:
  `game.js` as source of truth, generated files always regenerated, never hand-tuned.
- Add a release checklist doc for test builds.

Likely repo areas:

- `App.js`
- `game.js`
- `gen-gamehtmljs.js`
- QA scripts
- docs

Concrete tasks:

- [ ] Replace analytics TODO plumbing in `App.js` with a real backend integration.
- [ ] Replace crash TODO plumbing in `App.js` with a real crash backend.
- [ ] Add events for:
  app_open, menu_view, map_view, char_select_view, level_start, tutorial_step, tutorial_complete, level_complete, death, continue_offer, ad_show, ad_reward, retry, next_level.
- [ ] Include context fields:
  level, biome, character, phase, run_score, run_gems, endless/daily flag, device model if available.
- [ ] Add a repeatable smoke script suite and document the expected run commands.
- [ ] Add a release checklist in `docs/`.

Exit criteria:

- one test build can be installed and monitored end to end
- crash reports show up outside local logs
- event funnel can answer where session-one players drop

Do not start Batch 7 before this is done.

## Batch 2: First-Session Onboarding and Early Progression Clarity

Target outcome:

- a new player understands the game in the first run
- the first 3 levels teach the core verbs naturally
- the player knows what to do next after level complete or death

Why second:

- This is the highest retention-leverage batch.
- It is more important than adding more content or more cosmetics.

Main changes:

- Rewrite tutorialing around action instead of banners alone.
- Tune levels 1-3 as a guided skill ramp.
- Clarify the first progression rewards and why the meta matters.
- Make the post-run CTAs obvious and rewarding.

Likely repo areas:

- `game.js`
- early level definitions / tuning
- level complete and death flows
- level map copy / progression framing

Concrete tasks:

- [ ] Rebuild the early tutorial flow around forced or near-forced interactions:
  jump, dash, slide, ground pound, combo awareness.
- [ ] Reduce dependency on large text prompts during live play.
- [ ] Tune level 1 for confidence and readability.
- [ ] Tune level 2 for slide / ground hazard literacy.
- [ ] Tune level 3 for enemy and dash-combat literacy.
- [ ] Improve first reward moments:
  first star clear, first skin relevance, first mission claim, first login value.
- [ ] Make the map explain the next goal more clearly.

Exit criteria:

- a fresh player can complete the first session without confusion
- early failure feels fair and teachable, not random
- the first three levels communicate the core fantasy cleanly

Do not start broad art replacement before this is locked, because tutorial and early-level structure will influence which assets matter most.

## Batch 3: Global UI System and Core Screen Cleanup

Target outcome:

- every major screen feels like the same game
- the UI stops feeling prototype-heavy
- the playfield stays readable under stress

Why third:

- The current UI needs a system, not isolated fixes.
- If you replace art first without solving layout language, you will rework those screens again.

Main changes:

- define title font / body font / number font roles
- define one button system
- define one panel system
- unify HUD, menu, map, character select, pause, death, and reward screens

Likely repo areas:

- `game.js`
- font assets if added
- generated bundle outputs

Concrete tasks:

- [ ] Replace the near-all-monospace look with a cleaner typography hierarchy.
- [ ] Standardize:
  buttons, chips, cards, title bars, accent colors, disabled states, CTA treatment.
- [ ] Finish gameplay HUD cleanup under multiple mobile aspect ratios.
- [ ] Rebuild the map header and progression summary band.
- [ ] Rework:
  main menu, level intro, level complete, death screen, pause screen, settings screen.
- [ ] Establish a "one dominant action per screen" rule.

Exit criteria:

- the top 8-10 player-facing screens look like one product
- there are no major overlapping or duplicate-info panels
- screenshots from the game no longer read as debug-like

This is the batch that turns the game from "functional" into "presentable."

## Batch 4: Art Direction Lock and Sprite / Hazard Normalization

Target outcome:

- characters, enemies, hazards, pickups, and UI all share one art direction
- assets are normalized, compressed, and easier to ship

Why fourth:

- Once onboarding and UI structure are stable, you can safely do the expensive visual pass without fighting layout churn.

Main changes:

- write the visual style guide
- normalize character sheets
- normalize enemy and obstacle sheets
- compress and standardize sprite exports
- clean up the asset pipeline

Likely repo areas:

- `gen_char_assets.js`
- enemy / obstacle asset scripts
- `assets.js`
- `assets/spritesheets/`
- sprite-pipeline docs or scripts

Concrete tasks:

- [ ] Write a one-page style guide:
  silhouette, shading, palette, outline, FX, UI treatment.
- [ ] Choose the final hero rendering style and normalize all characters to it.
- [ ] Choose the final enemy / hazard rendering style and normalize all hostile assets to it.
- [ ] Standardize frame size, baseline, anchor, naming, and compression rules.
- [ ] Remove or isolate debug sprite outputs from shipping paths.
- [ ] Add contact-sheet or preview generation for asset review.

Exit criteria:

- no obvious style clash in the first 10 levels or store-worthy screenshots
- startup pressure from oversized sheets is reduced
- new art can be produced through one repeatable pipeline

If Batch 4 drifts too wide, split it:

- 4A = hero + HUD-critical assets
- 4B = secondary enemies / lower-priority hazards

## Batch 5: Gameplay Feel, Bosses, Biome Identity, and Reward Polish

Target outcome:

- the game feels more authored and exciting, not just functional
- bosses and biomes become stronger selling points
- reward moments feel worth sharing

Why fifth:

- This batch benefits from the cleaned UI and normalized art.
- It is where the game starts feeling launch-worthy rather than merely clean.

Main changes:

- stronger biome silhouettes and prop language
- clearer boss telegraphs and phase changes
- upgraded VFX and audio payoffs
- better hit, pickup, combo, and completion feedback

Likely repo areas:

- `game.js`
- audio assets and wrappers
- biome deco data
- boss behaviors and FX

Concrete tasks:

- [ ] Strengthen each biome with unique prop language and atmosphere.
- [ ] Improve ground readability and foreground/midground/background separation.
- [ ] Improve boss intros, telegraphs, and phase transitions.
- [ ] Improve combo, pickup, hit, and level-complete feedback.
- [ ] Add stronger completion and star-award celebration.
- [ ] Improve audio identity for bosses and rewards.

Exit criteria:

- each biome is visually distinct in screenshots
- the first boss encounter is readable and memorable
- level completion feels rewarding enough to support retention

## Batch 6: Android Hardening, Performance, and Monetization QA

Target outcome:

- the game behaves reliably on real Android devices
- startup and memory are under control
- monetization is fair and stable

Why sixth:

- This batch should happen after the big presentation work so profiling reflects the more final game.
- It is the "make this survive the real world" batch.

Main changes:

- device matrix test
- startup optimization
- WebView / asset load hardening
- rewarded ad QA
- safe-area, resume, navigation, and audio interruption QA

Likely repo areas:

- `App.js`
- `game.js`
- `gen-gamehtmljs.js`
- Android config
- asset loading path

Concrete tasks:

- [ ] Profile low-end, mid-range, and modern Android devices.
- [ ] Measure:
  startup time, memory, frame pacing, thermal behavior, resume reliability.
- [ ] Reduce eager decode / inline payload pressure where practical.
- [ ] Validate hardware back behavior and app resume behavior.
- [ ] Validate gesture-nav and Samsung/Pixel safe-area layouts.
- [ ] Run full rewarded-ad QA:
  unavailable, loaded, rewarded, closed, interrupted, offline, repeated.
- [ ] Decide whether launch includes interstitials or rewarded-only.

My recommendation:

- soft-launch with rewarded-only first unless metrics prove room for more

Exit criteria:

- no major device-class-specific blockers remain
- no major resume / navigation / ad-flow issues remain
- performance is acceptable on at least one weaker Android phone

## Batch 7: Play Console, Store Assets, Policy, and Soft-Launch Setup

Target outcome:

- the game is operationally ready for external testing
- the store presence matches the product
- policy and listing work will not block rollout

Why seventh:

- This batch depends on the game looking close to final.
- Store assets made earlier would likely become obsolete.

Main changes:

- privacy policy
- Data Safety
- content rating
- final store art
- testing-track setup
- launch KPI dashboard

Likely repo areas:

- docs
- store art generation assets
- app metadata
- Play Console configuration outside repo

Concrete tasks:

- [ ] Confirm closed-testing requirements for the account and release path.
- [ ] Finalize privacy policy hosting.
- [ ] Complete Data Safety and content rating.
- [ ] Verify target API compliance at release time.
- [ ] Produce final launch assets:
  icon, feature graphic, screenshots, short description, long description.
- [ ] Build a soft-launch metrics sheet with target thresholds.
- [ ] Set up a pre-launch QA checklist tied to the exact release artifact.

Exit criteria:

- nothing policy-related blocks a rollout
- screenshots reflect the real in-game quality
- soft launch can be monitored with clear success/failure thresholds

## Batch 8: Soft-Launch Response and Production-Launch Polish

Target outcome:

- you use real data to decide what ships broadly
- the production launch is tuned, not guessed

Why last:

- This batch depends on external player behavior, crash data, and retention data.

Main changes:

- retention tuning
- early-level retune
- monetization adjustments
- final UX polish
- launch operations schedule

Concrete tasks:

- [ ] Review session-one funnel data.
- [ ] Review D1 / D7 retention.
- [ ] Review level fail points in the first 10 levels.
- [ ] Review ad acceptance and ad frustration signals.
- [ ] Tune:
  early difficulty, reward pacing, CTA clarity, mission framing, ad frequency.
- [ ] Prepare a 30-day post-launch content and support cadence.

Exit criteria:

- launch decisions are based on actual player behavior
- the first public rollout is a polished version of the soft-launch winner

## Recommended Team Rhythm

Use one batch at a time with short internal milestones:

- start of batch:
  scope lock, success criteria, no extra feature creep
- middle of batch:
  screenshot / video review and mobile playtest
- end of batch:
  build, device pass, written findings, go/no-go for the next batch

## Fastest Sensible Path to Soft Launch

If speed matters more than perfection, the minimum responsible sequence is:

1. Batch 1
2. Batch 2
3. Batch 3
4. Batch 4A
5. Batch 6
6. Batch 7

Where `Batch 4A` means:

- heroes
- the most visible enemies
- the most visible hazards
- the first two biomes
- reward and HUD-critical art only

That path gets you to a credible soft launch faster, then Batch 5 and Batch 8 refine it before a bigger public push.

## Work To Explicitly Defer Until After Launch

Do not let these derail the launch path unless data proves they are necessary:

- season pass
- cloud save
- notifications
- deep social systems
- multiplayer
- large event framework
- major mode expansion beyond the current set

## Final Recommendation

If I were implementing this myself, I would not start with art alone and I would not start with store assets.

I would do the work in this exact order:

1. make the game measurable
2. make the first session understandable
3. make the UI feel cohesive
4. make the art coherent
5. make the game feel rewarding
6. make Android behavior rock solid
7. make the Play Console and store presence production-ready
8. use soft-launch data to tune the final release

That order gives the best mix of momentum, reduced rework, and launch confidence.
