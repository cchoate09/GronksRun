# Gronk's Run Deep Product Audit

Date: 2026-04-07

## Executive Summary

Gronk's Run is no longer in a "broken prototype" state. It boots, the core loop works, there is real progression, and the content surface is larger than a typical hobby runner. The problem is that it still does not *feel* like a strong shipped game.

The UI feels poor because it is still being drawn by overlapping generations of screen code instead of one coherent presentation system. The gameplay feels unengaging because the game has many mechanics but too few memorable, authored moments that make the player feel smart, powerful, or surprised. The graphics feel substandard because the project now has a more stable sprite pipeline, but it still lacks a locked art direction, clear silhouette hierarchy, and premium-feeling effects.

This is fixable, but the next step should not be "keep tweaking boxes." The game needs a product-quality pass across four layers:

1. One unified UI system
2. Better moment-to-moment gameplay feel
3. A stricter art direction and replacement pass for the weakest assets
4. Code cleanup so future polish does not keep reintroducing regressions

## What The Audit Was Based On

- Current repo scan
- Current browser/WebView smoke pass via `npm run smoke:mobile-webview`
- Visual review of the current smoke screenshot and existing UI screens
- Code audit of `game.js`, asset folders, and current Android-launch planning docs
- Comparison against current official positioning for leading mobile runners/platformers:
  - Super Mario Run
  - Jetpack Joyride Classic
  - Dan the Man
  - Minion Rush

## Current Strengths

- The game now has a real amount of content: multiple screens, missions, progression, characters, bosses, skins, daily reward, and a level map.
- The app has been stabilized materially compared to its earlier broken state.
- There is already a guided tutorial/onboarding structure in place for the first levels.
- Telemetry and smoke-testing foundations exist, which is a real advantage for future iteration.
- The enemy/character sprite path is more coherent than it was previously.

## Root Causes Of The Current Quality Gap

### 1. The UI system is fragmented

The UI is not just "ugly"; it is structurally inconsistent.

- `game.js` is `9,733` lines long.
- Several major screens have duplicate renderer functions still living in the same file:
  - `drawMenu` at lines `5329` and `7795`
  - `drawLevelComplete` at lines `5599` and `7908`
  - `drawDeathScreen` at lines `5646` and `9089`
  - `drawPausedScreen` at lines `5818` and `9229`
  - `drawTutorial` at lines `5864` and `9293`
  - `drawDailyReward` at lines `6904` and `7048`
  - `drawLevelMap` at lines `7229` and `8109`
- The file contains `229` text-draw calls (`fillText` / `strokeText`), which is a strong sign that text layout is being hand-managed screen by screen instead of coming from a reusable design system.

Effect on the product:

- visual rules change from screen to screen
- spacing and scaling drift over time
- different screens feel like different games
- "small fix" UI work keeps creating new inconsistencies

### 2. The game has mechanics, but not enough authored excitement

There is more design depth in this game than a first play suggests. The issue is not a total lack of systems; the issue is poor delivery of those systems.

Evidence in code:

- Early onboarding/tutorial content exists around the level-1-to-3 guided lesson data near line `636`.
- Levels are defined centrally in `LEVEL_DEFS` at line `1327`.
- Combo, dash, and action-chain systems exist around line `1913` and related gameplay code in the `3000`-line range.

What is missing:

- memorable setpieces in the first five minutes
- clearer "I learned something cool" beats
- stronger anticipation, impact, and payoff when you do something skillful
- more authored enemy/hazard combinations that teach through play instead of through text

Right now the game often feels like:

- survive lane hazards
- read another box
- clear another small lesson

instead of:

- read the lane instantly
- make one cool decision
- get rewarded with spectacle and momentum

### 3. The art pipeline is more stable, but the art direction is still weak

The project has improved from "broken sprite sheets" to "consistent enough to ship," but that is not the same thing as "good-looking."

What still feels off:

- characters and enemies live in a similar pipeline but do not yet share a strong visual personality
- biome identity is still driven too much by color and not enough by shape language
- hazards read functionally, but not richly
- VFX and impact feedback are still not carrying enough of the presentation load
- some UI surfaces still feel detached from the world art rather than part of a single universe

There is also asset clutter in the repo:

- `assets/spritesheets/enemies/debug` contains `521` files
- `assets/spritesheets/enemies/generated` contains `12`
- `assets/spritesheets/enemies/regenerated` contains `11`

That is manageable during development, but it is a warning sign that the pipeline still has "temporary" layers hanging around.

### 4. The game is text-forward where it should be silhouette-forward

The player is being asked to read too much UI and explanatory language relative to the amount of visual clarity the game provides.

Symptoms:

- screens depend on title cards, stat cards, labels, and reminders to explain themselves
- combat/power moments are not visually loud enough to stand on their own
- UI frequently compensates for weak scene readability

That is the opposite of what strong mobile runners do well.

## Gap Analysis Against Stronger Games

### Super Mario Run

Nintendo frames Super Mario Run as "a new kind of Mario game that you can play with one hand" and emphasizes many ways to play, including World Tour, Toad Rally, Kingdom Builder, and character-specific abilities. It also describes short, purpose-built course structures and one-handed clarity.

Gap for Gronk's Run:

- Gronk's Run has more text friction and less instantly readable play
- the one-sentence control fantasy is weaker
- mode identity is less crisp
- the first-session structure is less elegant and less legible

### Jetpack Joyride Classic

Halfbrick positions Jetpack Joyride around a loud, simple fantasy: "Strap on a bullet-powered jetpack!" It leans on readable hazards, absurd spectacle, vehicles, costumes, and a very clear run fantasy.

Gap for Gronk's Run:

- the fantasy is not punchy enough in the first ten seconds
- runs lack the same level of escalating spectacle
- player actions do not consistently produce satisfying audiovisual payoff

### Dan the Man

Halfbrick sells Dan the Man as a "hard-hitting action platformer" with action-packed authored levels, battle mode, daily events, and more characters. Its pitch is built around impact and level-driven combat identity.

Gap for Gronk's Run:

- Gronk's Run has some combat depth, but it does not feel as intentionally staged
- enemy encounters are not yet memorable enough
- the action-platformer promise is weaker than the systems imply it should be

### Minion Rush

Gameloft's 2025 Minion Rush update explicitly called out overhauled visuals, a more streamlined user interface, new modes, new progression, and new collectible features.

Gap for Gronk's Run:

- this is the clearest benchmark for what the current game lacks
- Gronk's Run still feels like a game with systems added over time
- Minion Rush's update framing shows the bar: visuals, UI, progression, and customization all need to feel refreshed together, not one at a time

## Product Diagnosis By Area

## UI / UX

Verdict: improving, but still below launch quality.

Major issues:

- too many panel styles and spacing rules
- too much HUD text during play
- too many screens still centered around stacked boxes instead of information hierarchy
- typography still does too much work because layout and iconography are not strong enough
- several screens still read like admin panels rather than game surfaces

What to do:

1. Build a single HUD grammar.
   - One top-left cluster for run state
   - One top-center or top-right cluster for score/resources
   - One transient lane for tutorial/prompts
   - One bottom interaction lane for abilities

2. Reduce active text during play by at least 30-40%.
   - Replace labels with icons wherever the state is already obvious
   - Stop duplicating values and labels across multiple chips
   - Remove non-essential "status copy" from the run HUD

3. Standardize all panel primitives.
   - one modal card
   - one stat pill
   - one primary button
   - one secondary button
   - one reward badge

4. Move more screens from "stacked rectangles" to "hero + supporting stats + single CTA."

5. Remove any remaining UI that does not directly support:
   - decision-making
   - reward anticipation
   - progression clarity

## Gameplay Feel

Verdict: system-rich, but not yet emotionally rewarding.

Major issues:

- too much of the early game is instructional rather than thrilling
- too few authored setpieces
- dashing/combat can be mechanically useful without feeling especially awesome
- enemies/hazards are not consistently introduced in the most teachable order
- the run curve needs more peaks and valleys

What to do:

1. Re-author the first 10 minutes around memorable beats.
   - one "I barely cleared that" moment
   - one dash-through-enemy triumph
   - one satisfying stomp/slide resolution
   - one coin/gem/reward shower moment
   - one very clear boss or mini-boss ramp

2. Reduce tutorial copy further and teach through geometry.
   - safer lead-in space
   - obvious lanes
   - spotlight obstacle pairings
   - fewer text prompts, more setup/payoff

3. Increase feel polish on every successful action.
   - stronger anticipation
   - sharper impact frames
   - slightly more hit-stop
   - better reward sounds
   - more dramatic camera/trauma bursts on important interactions

4. Make the run curve less flat.
   - calmer setup pockets
   - short intensity spikes
   - obvious recovery moments
   - visible "final stretch" escalation before clear

5. Make progression rewards more immediate.
   - clearer unlock surfaces
   - stronger post-level reward reveal
   - more visible reason to care about next run

## Graphics / Art Direction

Verdict: coherent enough to function, not polished enough to impress.

Major issues:

- silhouettes are still not distinctive enough at a glance
- biome themes need stronger unique props and foreground identity
- characters still need more personality and premium finish
- hazards still look serviceable more than exciting
- VFX do not yet elevate the art enough

What to do:

1. Lock a strict style guide.
   - line weight
   - outline strategy
   - shadow treatment
   - highlight placement
   - palette rules by biome
   - silhouette rules by enemy family

2. Rebuild the weakest art around shape identity, not just cleanup.
   - make every enemy readable as a unique problem in silhouette alone
   - make every hero readable as a unique fantasy in one frame
   - make hazards look dangerous before the player learns them

3. Give each biome three signature prop families.
   - background shapes
   - midground landmarks
   - foreground gameplay-adjacent props

4. Do a dedicated VFX pass.
   - dash trail
   - shield impact
   - enemy defeat burst
   - landing dust
   - reward sparkle
   - boss telegraph effects

5. Unify UI art with world art.
   - icon style
   - reward badge style
   - panel accent treatment
   - button gloss/shadow language

## Technical / Production

Verdict: stable enough to improve, but still too monolithic for efficient polish.

Major issues:

- `game.js` is still carrying too much responsibility
- duplicate renderers make it hard to know which system is the true source of UI behavior
- future polish work is likely to continue drifting without structural cleanup

What to do:

1. Remove duplicate screen implementations and keep one canonical renderer per screen.
2. Split the game into clearer modules:
   - HUD/UI
   - meta screens
   - player
   - enemies
   - level generation / chunks
   - VFX / audio helpers
3. Move layout constants into shared screen-system config instead of ad hoc coordinates.
4. Archive or remove obsolete sprite/debug artifacts after the pipeline is finalized.

## Recommended Order Of Work

### Phase 1: Presentation Reset

Goal: make the game readable and intentional fast.

- eliminate duplicate UI renderers
- build one shared HUD/modal/button system
- simplify in-run HUD
- rebuild level-clear, pause, map, missions, shop, and stats on the same design grammar

### Phase 2: First-Session Engagement Pass

Goal: make the first 10 minutes genuinely fun.

- re-author early encounters
- add clearer setpieces
- tune the reward cadence
- sharpen combat/dash payoffs
- reduce tutorial dependence

### Phase 3: Art Direction Lock

Goal: make the game look like one game.

- finalize character silhouette polish
- replace weakest enemies/hazards
- add biome prop packs
- run full VFX pass
- unify UI art with world art

### Phase 4: Technical Cleanup For Sustainability

Goal: stop future polish from re-breaking the product.

- break up `game.js`
- remove dead/duplicate renderers
- reduce asset clutter
- codify layout rules and art export rules

## Fastest High-ROI Improvements

If time is limited, these five changes would make the biggest visible difference fastest:

1. Kill duplicate screen implementations and standardize every UI surface.
2. Re-author the first three levels as memorable setpieces instead of tutorial corridors.
3. Rebuild the weakest 4-6 enemy/hazard silhouettes and add stronger impact VFX.
4. Simplify the in-run HUD until the playfield is the main thing on screen again.
5. Create a strict style guide and enforce it across characters, enemies, UI, and biomes.

## Bottom Line

The game is not failing because it lacks enough features. It is failing because too many partially-good layers are competing with each other.

The path forward is not "add more stuff." The path forward is:

- unify
- simplify
- stage better moments
- improve feel
- replace weak visuals instead of endlessly patching them

If that work is done in that order, the game can move from "functioning but rough" to something that feels genuinely launchable.

## Sources

- Nintendo, Super Mario Run official site: https://supermariorun.com/en/index.html
- Halfbrick, Jetpack Joyride Classic official page: https://www.halfbrick.com/games/jetpack-joyride-classic
- Halfbrick, Dan the Man official page: https://www.halfbrick.com/games/dan-the-man
- Gameloft newsroom, Minion Rush Unity/update announcement: https://www.gameloft.com/newsroom/minion-rush-unity-update
