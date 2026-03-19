# Gronk's Run: Graphical Improvement Recommendations

Following a scan of the `index.html` rendering pipeline and project assets, here is a prioritized list of recommendations to improve the visual quality and animation "feel" of the game.

## 1. High ROI / Low Effort (Procedural Polish)

These changes can be made within the existing `drawChar`, `drawEnemies`, and `drawBoss` functions without requiring external assets.

### **P0: Silhouette & Contrast Pass**
*   **Recommendation**: Add a consistent 1-2px dark outline to all gameplay-critical entities (Player, Enemies, Boss).
*   **Why**: The current procedural shapes (arcs/ellipses) can sometimes blend into the terrain. Outlines provide instant readability.
*   **Implementation**: Use `ctx.stroke()` after `ctx.fill()` with a slightly darker version of the main body color.

### **P1: Enhanced Face & Expression Logic**
*   **Recommendation**: Increase the size and detail of eyes/mouths. Add "Blink" logic and "Combat States".
*   **Why**: Players track the "head" of the character. Expressive faces make the characters feel alive.
*   **Details**:
    *   Change eye shape during Dash (e.g., narrowed "determined" eyes).
    *   Add a "Hurt" expression frame when taking damage.
    *   Add specialized "Telegraph" eyes for enemies (e.g., glowing red pupils before an attack).

### **P1: Procedural Biome Decorations**
*   **Recommendation**: Add small, biome-specific procedural details to enemies.
*   **Why**: Currently, enemies feel like color-swapped versions of the same template.
*   **Suggestions**:
    *   **Jungle**: Random "vines" (Bezier curves) hanging from the Troll.
    *   **Volcano**: Glowing "cracks" (thin orange lines) on the Golem.
    *   **Glacier**: Small "icicles" or "frost" overlays.

---

## 2. Animation & Juice (Feel Improvements)

These focus on the "weight" and "impact" of movement.

### **P0: Animation "Juice" (Weight & Impact)**
*   **Recommendation**: Refine the squash and stretch values for landing and jumping.
*   **Why**: Current values are a good start, but adding a "frame-zero" anticipation (tiny squeeze before a big jump) adds a lot of perceived quality.
*   **Implementation**: 
    *   **Anticipation**: Brief `scale(1.1, 0.9)` just before `vy` changes for a jump.
    *   **Impact**: More dramatic `scale(1.3, 0.7)` for 2-3 frames upon landing.

### **P2: Afterimage / Ghosting Effects**
*   **Recommendation**: Implement a simple "ghosting" trail for the Dash and High-Speed states.
*   **Why**: It provides a sense of immense speed and makes the game feel more "premium."
*   **Implementation**: Store the last 3-4 positions/scales of the character and draw them with decreasing `globalAlpha`.

---

## 3. High Effort / Custom Assets (Phase 2)

Moving from procedural drawing to hand-drawn sprites.

### **P2: Hybrid Sprite Integration**
*   **Recommendation**: Replace the main character (Gronk) with a hand-drawn sprite sheet.
*   **Why**: No amount of procedural arcs can match the personality of a hand-drawn character.
*   **Strategy**: 
    *   Keep the procedural terrain/background (they look great!).
    *   Only replace the "Hero" and "Major Bosses" with `ctx.drawImage` calls.
    *   Include 4 distinct animations: `Run`, `Jump`, `Slide`, `Hit`.

---

## Technical Summary of Scanned Code
*   **Key Render Loop**: `drawChar` (L3113), `drawEnemies` (L2747), `drawBoss` (L1218).
*   **Current State**: 100% procedural (code-drawn).
*   **Performance**: Excellent, as there are no heavy image decoding steps.
*   **Flexibility**: High. Changing a color or shape only takes a few lines of code.

> [!TIP]
> Prioritize the **P0 Silhouette Pass** first. It is a "one-line" change that will immediately make the game feel more finished and professional.
