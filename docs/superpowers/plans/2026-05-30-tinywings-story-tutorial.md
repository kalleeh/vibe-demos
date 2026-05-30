# Sketchwings Story Intro + Guided Tutorial + Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a heavy-little-bird story card (first-visit gated), a 3-step can't-fail interactive tutorial with just-in-time minimap + off-screen-arrow coachmarks, and a consolidated settings panel — all in `tinywings/index.html`.

**Architecture:** Single self-contained static HTML file (repo convention). A new `G.tutorial` state object drives a forgiving learn-mode that gates the existing `endRun()` and day-advance logic, and watches the existing `pitchDown` / `releasedAtCrest` / `boostingNow` signals to advance steps. New DOM: a coachmark layer, a HUD-pointer caption, and a relabeled settings panel reusing the existing `.tuner` aside. Two new localStorage flags gate first-visit and the one-time off-screen caption.

**Tech Stack:** Plain HTML/CSS/JS. No build, no framework, no test runner. Verification = `node --check` on the extracted script for JS validity + manual behavioral checks on the published GitHub Pages URL.

**Spec:** `docs/superpowers/specs/2026-05-30-tinywings-story-tutorial-design.md`

---

## Verification model (read before starting)

This repo has **no test framework** (plain static files, no package.json). Each task's verification is:

1. **JS validity** — extract the inline script and `node --check` it:
   ```bash
   cd /home/ubuntu/projects/vibe-demos
   python3 -c "
   import re,subprocess
   html=open('tinywings/index.html').read()
   blocks=re.findall(r'<script(?: type=\"module\")?>(.*?)</script>', html, re.S)
   open('/tmp/tw.js','w').write('\n;\n'.join(blocks))
   r=subprocess.run(['node','--check','/tmp/tw.js'],capture_output=True,text=True)
   print('OK' if r.returncode==0 else 'ERR:\n'+r.stderr)
   "
   ```
   Expected: `OK`
2. **Logic checks** where pure logic is involved — small Node snippet (shown in the task).
3. **Manual behavioral check** — listed per task as a checklist item to run on the published page after the final push. These are documented, not automated.

Commit after each task. Work on `main` is fine (repo convention: push = deploy), but make commits granular.

---

## File structure

Only one file changes: `tinywings/index.html` (plus a one-line bump in `tinywings/sw.js` at the end). The file is large and single-purpose by repo convention — do NOT split it. Additions are localized:

- **CSS** (`<style>`): `.coachmark`, `.hud-pointer`, settings-panel relabel + `.settings-disclosure`.
- **HTML** (`<body>`): second intro button, coachmark layer, HUD-pointer node, footer gear button, settings panel header/disclosure restructure.
- **JS** (`<script>`): `G.tutorial` state, `vibe.tinywings.onboarded` / `vibe.tinywings.seenOffscreen` flags, learn-mode guards in the physics tick + `endRun` calls + day-advance, step-detection in the tick, coachmark controller, settings wiring, off-screen caption hook in `drawOffscreenIndicator`.

---

## Task 1: First-visit gate + story card copy + two buttons

**Files:**
- Modify: `tinywings/index.html` (intro-panel HTML ~659-678; intro CSS ~304-316 for secondary button; dismiss JS ~2553-2565)

- [ ] **Step 1: Rewrite the intro-panel copy and add the second button**

Replace the existing intro `.copy` block (the `<div class="copy">…</div>` containing kicker/h1/p/beginBtn/legend) with this. Note: the `.legend` is removed; the install-help accordion that follows the legend is kept (do not delete it).

```html
      <div class="copy">
        <div class="kicker">A Quiet Glide · 단 한 번의 비행</div>
        <h1>A little bird, <em>too heavy to fly</em>, and a sky full of hills.</h1>
        <p>
          This bird can't keep itself up by flapping — it's a touch too heavy.
          So it does the next best thing: it <em>surfs the hills</em>. Dive down a
          slope to gather speed, let go on the rise, and it soars on what it
          borrowed from gravity.
        </p>
        <div class="intro-actions">
          <button id="beginBtn" type="button">teach me to glide →</button>
          <button id="skipIntroBtn" type="button" class="ghost">just let me fly</button>
        </div>
```

(Leave the `</div>` that currently closes `.copy` and the `install-help` block after it untouched — this replacement ends right before them. The removed `.legend` div is intentionally gone.)

- [ ] **Step 2: Add CSS for the action row + ghost button**

Add after the existing `.intro-panel button:hover { … }` rule (~316):

```css
    .intro-panel .intro-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 4px; }
    .intro-panel button.ghost {
      border-style: dotted;
      font-size: 16px;
      color: var(--muted);
      padding: 6px 16px;
    }
    .intro-panel button.ghost:hover { background: transparent; color: var(--ink); border-color: var(--ink-soft); }
```

- [ ] **Step 3: Add the first-visit flag helpers + gate, and wire both buttons**

In the intro/dismiss JS region (~2553-2565), replace the current block:

```javascript
    const intro = document.getElementById("introPanel");
    function dismissIntro() {
      ensureAudio();
      intro.classList.add("gone");
      // Restart fresh after preview so the bird begins from a known state.
      startGame();
    }
    document.getElementById("beginBtn").addEventListener("click", dismissIntro);
    // Also accept tap-anywhere on the canvas as "begin" while the panel
    // is up — a phone player won't notice a button.
    canvas.addEventListener("pointerdown", () => {
      if (!intro.classList.contains("gone")) dismissIntro();
    }, true);
```

with:

```javascript
    const intro = document.getElementById("introPanel");
    const ONBOARD_KEY = "vibe.tinywings.onboarded";
    function isOnboarded() {
      try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch (e) { return false; }
    }
    function setOnboarded() {
      try { localStorage.setItem(ONBOARD_KEY, "1"); } catch (e) {}
    }
    // Hide the intro panel; pass {tutorial:true} to launch the guided tutorial,
    // otherwise start normal free play. Always marks the player onboarded.
    function dismissIntro(opts) {
      ensureAudio();
      intro.classList.add("gone");
      setOnboarded();
      startGame();
      if (opts && opts.tutorial) startTutorial();
    }
    document.getElementById("beginBtn").addEventListener("click", () => dismissIntro({ tutorial: true }));
    document.getElementById("skipIntroBtn").addEventListener("click", () => dismissIntro({ tutorial: false }));
    // Tap-anywhere on the canvas while the panel is up = "just let me fly".
    canvas.addEventListener("pointerdown", () => {
      if (!intro.classList.contains("gone")) dismissIntro({ tutorial: false });
    }, true);
    // Returning players (already onboarded) never see the card — skip straight
    // to play. First-time visitors keep the panel up until they choose.
    if (isOnboarded()) {
      intro.classList.add("gone");
      startGame();
    }
```

Note: `startTutorial()` is defined in Task 3. This task will fail `node --check` only if `startTutorial` is referenced at parse time — it is not (it's inside a closure called later), so `node --check` passes. The function must exist before a user clicks; Task 3 adds it. To keep each task independently valid, add a temporary stub now and replace it in Task 3:

Add this stub near `startGame` (just after the `startGame` function definition, ~line 1360 area, after the closing `}` of `startGame`):

```javascript
    // Replaced with the real implementation in Task 3.
    function startTutorial() {}
```

- [ ] **Step 4: Verify JS validity**

Run the extract+`node --check` snippet from the Verification model.
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add tinywings/index.html
git commit -m "tinywings: heavy-little-bird story card + first-visit gate + two intro buttons"
```

---

## Task 2: Tutorial state + learn-mode guards (can't-fail)

**Files:**
- Modify: `tinywings/index.html` (G state object ~1131; `endRun` callers ~1796/1809/1816; day-advance ~1827-1834; `startGame` reset ~1266-1289)

- [ ] **Step 1: Add tutorial state to the G object**

In the `G = { … }` literal, after the line `perfectLaunch: false,   // visual flag right after a great release` (~1131), add:

```javascript
      // Tutorial / onboarding
      tutorial: false,        // true while the guided tutorial is active (learn-mode)
      tutorialStep: 0,        // 0=dive, 1=release, 2=boost, 3=done
```

- [ ] **Step 2: Guard the three endRun() calls so the bird can't lose mid-tutorial**

In the physics tick (~1794-1819), wrap the stuck/no-progress/backslide checks so they don't fire during the tutorial. Replace:

```javascript
        if (G.vx < 60) {
          G.stuckMs += dt * 1000;
          if (G.stuckMs > 700) endRun("the wind has settled");
        } else {
          G.stuckMs = 0;
        }
```

with:

```javascript
        if (G.vx < 60) {
          G.stuckMs += dt * 1000;
          if (G.stuckMs > 700 && !G.tutorial) endRun("the wind has settled");
        } else {
          G.stuckMs = 0;
        }
```

Replace:

```javascript
          G.noProgressMs += dt * 1000;
          if (G.noProgressMs > 1200) endRun("out of speed");
```

with:

```javascript
          G.noProgressMs += dt * 1000;
          if (G.noProgressMs > 1200 && !G.tutorial) endRun("out of speed");
```

Replace:

```javascript
          G.backslideMs += dt * 1000;
          if (G.backslideMs > 250) endRun("shoved back");
```

with:

```javascript
          G.backslideMs += dt * 1000;
          if (G.backslideMs > 250 && !G.tutorial) endRun("shoved back");
```

- [ ] **Step 3: Pause the day/night cycle during the tutorial**

In the day-timer block (~1827-1834), replace:

```javascript
      // Day timer
      if (!G.transitioning) {
        const elapsed = performance.now() - G.dayStartT;
        if (elapsed > G.dayDurMs) {
```

with:

```javascript
      // Day timer — frozen during the tutorial so the run can't time out.
      if (!G.transitioning && !G.tutorial) {
        const elapsed = performance.now() - G.dayStartT;
        if (elapsed > G.dayDurMs) {
```

- [ ] **Step 4: Reset tutorial flags in startGame (so a normal restart isn't stuck in learn-mode)**

In `startGame()` (~1266-1289), after the line `G.gameOver = false;` (~1282), add:

```javascript
      G.tutorial = false;
      G.tutorialStep = 0;
```

This ensures `restart` and day-to-day play always run with full loss conditions. `startTutorial()` (Task 3) re-enables `G.tutorial` *after* calling `startGame()`.

- [ ] **Step 5: Verify JS validity**

Run the extract+`node --check` snippet.
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add tinywings/index.html
git commit -m "tinywings: learn-mode — gate loss conditions + day cycle behind G.tutorial"
```

---

## Task 3: Coachmark layer + tutorial controller (3 gated steps)

**Files:**
- Modify: `tinywings/index.html` (CSS new block; HTML new coachmark node after canvas ~636; JS new controller; replace the Task-1 `startTutorial` stub; hook step-detection into the tick)

- [ ] **Step 1: Add coachmark CSS**

Add a new block in `<style>` after the `.rotate-hint` rules (search for `.rotate-hint button:hover` and add after its closing brace, ~489):

```css
    /* ── Tutorial coachmark — lower-center cream card with a squiggle arrow ── */
    .coachmark {
      position: absolute;
      left: 50%; bottom: 14%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      z-index: 6;
      pointer-events: none;
      text-align: center;
    }
    .coachmark.live { display: flex; }
    .coachmark .card {
      background: rgba(244, 236, 214, 0.94);
      border: 1px dashed var(--ink-soft);
      box-shadow: 0 8px 22px rgba(42,38,29,0.14);
      padding: 8px 18px;
      font-family: "Caveat", cursive;
      font-size: 22px;
      color: var(--ink);
      transform: rotate(-0.5deg);
      pointer-events: auto;
    }
    .coachmark .arrow { width: 34px; height: 34px; color: var(--bloom); animation: cm-bob 1.4s ease-in-out infinite; }
    @keyframes cm-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
    .coachmark .skip {
      margin-top: 4px;
      font-family: "JetBrains Mono", monospace;
      font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
      color: var(--muted);
      background: none; border: none; cursor: pointer; pointer-events: auto;
    }
    .coachmark .skip:hover { color: var(--ink); }
    @media (prefers-reduced-motion: reduce) {
      .coachmark .arrow { animation: none; }
    }

    /* ── HUD pointer — small caption that points at the topbar minimap or
         the off-screen chevron. Reuses the cream/Caveat grammar. ── */
    .hud-pointer {
      position: absolute;
      display: none;
      max-width: 230px;
      background: rgba(244, 236, 214, 0.95);
      border: 1px dashed var(--ink-soft);
      box-shadow: 0 6px 16px rgba(42,38,29,0.14);
      padding: 6px 12px;
      font-family: "Caveat", cursive;
      font-size: 18px; line-height: 1.2;
      color: var(--ink);
      z-index: 7;
      pointer-events: none;
    }
    .hud-pointer.live { display: block; }
```

- [ ] **Step 2: Add the coachmark + HUD-pointer DOM**

Immediately after the `<canvas id="sky" …></canvas>` line (~636), add:

```html
    <!-- Tutorial coachmark (lower-center) -->
    <div class="coachmark" id="coachmark" role="status" aria-live="polite">
      <div class="card" id="coachmarkText">hold on the way down ↓</div>
      <svg class="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 C 9 9, 15 13, 12 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 16 L12 21 L17 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <button class="skip" id="coachmarkSkip" type="button">skip tutorial</button>
    </div>

    <!-- HUD pointer (minimap / off-screen arrow callouts) -->
    <div class="hud-pointer" id="hudPointer"></div>
```

- [ ] **Step 3: Replace the Task-1 stub with the real tutorial controller**

Find the stub added in Task 1:

```javascript
    // Replaced with the real implementation in Task 3.
    function startTutorial() {}
```

Replace it with:

```javascript
    // ── Guided tutorial controller ───────────────────────────────────
    const coachmark = document.getElementById("coachmark");
    const coachmarkText = document.getElementById("coachmarkText");
    const hudPointer = document.getElementById("hudPointer");
    const TUTORIAL_STEPS = [
      "hold on the way down ↓",
      "now let go on the rise — soar ↑",
      "tap once in the air to spend boost ✦",
    ];
    function showCoachmark(text) {
      coachmarkText.textContent = text;
      coachmark.classList.add("live");
    }
    function hideCoachmark() { coachmark.classList.remove("live"); }

    // Position the HUD pointer under the topbar minimap and show a caption.
    function showMinimapPointer() {
      const mm = document.querySelector(".minimap-wrap");
      if (!mm) return;
      const r = mm.getBoundingClientRect();
      hudPointer.textContent = "the strip up top shows the hills ahead — and where your bird is";
      hudPointer.style.left = Math.max(8, Math.min(window.innerWidth - 240, r.left)) + "px";
      hudPointer.style.top = (r.bottom + 8) + "px";
      hudPointer.classList.add("live");
    }
    function hideHudPointer() { hudPointer.classList.remove("live"); }

    function startTutorial() {
      // startGame() has already run (see dismissIntro); enable learn-mode now.
      G.tutorial = true;
      G.tutorialStep = 0;
      showCoachmark(TUTORIAL_STEPS[0]);
      showMinimapPointer();
      // Auto-dismiss the minimap pointer after a few seconds even if the
      // player lingers on step 1.
      clearTimeout(G._minimapTimer);
      G._minimapTimer = setTimeout(hideHudPointer, 5000);
    }

    function endTutorial() {
      G.tutorial = false;
      G.tutorialStep = 3;
      hideCoachmark();
      hideHudPointer();
      setOnboarded();
      // Hand the run back to normal play with full loss conditions and the
      // day clock running from now.
      G.dayStartT = performance.now();
    }

    // Advance called from the physics tick when a real move is detected.
    function tutorialAdvance(step) {
      if (!G.tutorial || G.tutorialStep !== step) return;
      G.tutorialStep = step + 1;
      if (step === 0) hideHudPointer(); // minimap pointer goes once step 1 is done
      if (G.tutorialStep < TUTORIAL_STEPS.length) {
        showCoachmark(TUTORIAL_STEPS[G.tutorialStep]);
      } else {
        showCoachmark("that's it — the hills are yours.");
        setTimeout(endTutorial, 1400);
      }
    }

    document.getElementById("coachmarkSkip").addEventListener("click", endTutorial);
```

- [ ] **Step 4: Hook step-detection into the physics tick**

The three signals already exist. Add detection calls:

(a) **DIVE (step 0)** — in the tick, find the trail condition (~2526):

```javascript
      if (G.boostingNow || G.vy > 380 || (G.pitchDown && !G.airborne && G.terrain && G.terrain.slope(G.bx) > 0.10)) pushTrail(sx, sy);
```

Immediately BEFORE that line, add a dive detector (a held downslope is exactly the trail's third clause):

```javascript
      // Tutorial step 0: detect a real dive (held on a downslope).
      if (G.tutorial && G.tutorialStep === 0 &&
          G.pitchDown && !G.airborne && G.terrain && G.terrain.slope(G.bx) > 0.10) {
        tutorialAdvance(0);
      }
```

(b) **RELEASE (step 1)** — at the perfect-launch detection (~1695), inside the `if (releasedAtCrest) {` block, after `G.perfectCount++;` add a tutorial hook. But a tutorial launch should advance even on a *non-perfect* release, so place the hook on the broader launch. Find the natural-launch block opening (~1678) `if (slope < -0.18 && G.vy < 0 && Math.abs(G.vx) > 240 && !G.pitchDown && !G.airborne) {` and after the line `G.airborne = true;` (~1679) add:

```javascript
          if (G.tutorial && G.tutorialStep === 1) tutorialAdvance(1);
```

(c) **BOOST (step 2)** — in the pointerdown handler where boost is spent (~1343, the `G.boostingNow = true;` line inside `if (G.airborne && G.boost > 0.18) {`), after `G.boostingNow = true;` add:

```javascript
        if (G.tutorial && G.tutorialStep === 2) tutorialAdvance(2);
```

- [ ] **Step 5: Verify JS validity**

Run the extract+`node --check` snippet.
Expected: `OK`

- [ ] **Step 6: Logic check — step machine advances 0→1→2→done and ignores wrong-step signals**

```bash
node -e '
let G={tutorial:true,tutorialStep:0};
const STEPS=["dive","release","boost"];
let shown=null, ended=false;
function showCoachmark(t){shown=t;}
function endTutorial(){ended=true;G.tutorial=false;}
function tutorialAdvance(step){
  if(!G.tutorial||G.tutorialStep!==step)return;
  G.tutorialStep=step+1;
  if(G.tutorialStep<STEPS.length){showCoachmark(STEPS[G.tutorialStep]);}
  else{showCoachmark("done");endTutorial();}
}
tutorialAdvance(2); // wrong step early — must be ignored
console.log("after wrong-step boost, step =", G.tutorialStep, "(expect 0)");
tutorialAdvance(0);
console.log("after dive, step =", G.tutorialStep, "shown =", shown);
tutorialAdvance(0); // repeat — ignored
tutorialAdvance(1);
console.log("after release, step =", G.tutorialStep, "shown =", shown);
tutorialAdvance(2);
console.log("after boost, ended =", ended, "(expect true)");
'
```

Expected output:
```
after wrong-step boost, step = 0 (expect 0)
after dive, step = 1 shown = release
after release, step = 2 shown = boost
after boost, ended = true (expect true)
```

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add tinywings/index.html
git commit -m "tinywings: coachmark layer + 3-step guided tutorial controller"
```

---

## Task 4: Off-screen-arrow one-time caption

**Files:**
- Modify: `tinywings/index.html` (`drawOffscreenIndicator` ~2403; the HUD pointer node from Task 3)

- [ ] **Step 1: Add the one-time off-screen caption hook**

`drawOffscreenIndicator(sx, sy)` (~2403) declares function-level consts `px`/`py` at lines 2411-2412 (the clamped chevron position), and the function's last statement is `ctx.restore();` at line ~2448. Insert the caption call as the new last statement of the function, immediately AFTER that final `ctx.restore();` (px/py are function-level consts, so they remain in scope):

```javascript
      ctx.restore();
      maybeShowOffscreenCaption(px, py);
    }
```

(Match on the function's closing `ctx.restore();\n    }` to place the call. The caption positions an HTML overlay using these canvas-pixel coords, which map 1:1 to viewport CSS pixels here.)

- [ ] **Step 2: Define the caption helper**

Add this function just BEFORE `function drawOffscreenIndicator(sx, sy) {` (~2403):

```javascript
    // One-time caption next to the off-screen chevron. Shows once ever.
    const OFFSCREEN_KEY = "vibe.tinywings.seenOffscreen";
    let _offscreenSeen = (() => { try { return localStorage.getItem(OFFSCREEN_KEY) === "1"; } catch (e) { return false; } })();
    let _offscreenCaptionUntil = 0;
    function maybeShowOffscreenCaption(px, py) {
      if (_offscreenSeen) return;
      if (!_offscreenCaptionUntil) {
        // First sighting — arm a 4s display window and persist the flag.
        _offscreenCaptionUntil = performance.now() + 4000;
        try { localStorage.setItem(OFFSCREEN_KEY, "1"); } catch (e) {}
        const hp = document.getElementById("hudPointer");
        hp.textContent = "that's your bird — follow the arrow back down";
      }
      const hp = document.getElementById("hudPointer");
      if (performance.now() < _offscreenCaptionUntil) {
        // Pin near the chevron; the chevron canvas coords map 1:1 to the
        // overlay since both cover the full viewport.
        hp.style.left = Math.max(8, Math.min(window.innerWidth - 240, px + 18)) + "px";
        hp.style.top = Math.max(8, Math.min(window.innerHeight - 40, py - 8)) + "px";
        hp.classList.add("live");
      } else {
        _offscreenSeen = true;
        // Only hide if the tutorial isn't currently using the pointer.
        if (!G.tutorial) hp.classList.remove("live");
      }
    }
```

Note on interaction with Task 3's minimap pointer: the minimap pointer (step 1) and the off-screen caption share `#hudPointer`. During the tutorial the bird is unlikely to leave the viewport before step 1 completes (the minimap pointer auto-hides at 5s or on dive). If they ever collide, the off-screen caption wins (it's the later write) and `endTutorial`/`hideHudPointer` still clears it. Acceptable for this UX.

- [ ] **Step 3: Verify JS validity**

Run the extract+`node --check` snippet.
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add tinywings/index.html
git commit -m "tinywings: one-time off-screen-arrow caption (persists into normal play)"
```

---

## Task 5: Settings panel consolidation (footer → restart + gear)

**Files:**
- Modify: `tinywings/index.html` (footer HTML ~884-889; tuner aside ~892-902; tuner CSS ~561-624; tuner-open JS ~1537-1545; mute-button JS)

- [ ] **Step 1: Restructure the footer to `restart` + gear**

Replace the footer button cluster (~884-889), currently:

```html
      <button class="toggle" id="manualRestartBtn" title="Restart this run if it gets stuck">restart</button>
      <button class="toggle" id="tuneBtn" aria-pressed="false" title="Tweak physics">tune · physics</button>
      <button class="toggle" id="muteBtn" aria-pressed="false">sound · on</button>
```

with:

```html
      <button class="toggle" id="manualRestartBtn" title="Restart this run if it gets stuck">restart</button>
      <button class="toggle" id="settingsBtn" aria-pressed="false" aria-controls="tuner" title="Settings">⚙ settings</button>
```

(The `muteBtn` and `tuneBtn` move into the settings panel — Steps 2-3. Keep `muteBtn`'s id so the existing mute handler keeps working.)

- [ ] **Step 2: Rebuild the settings panel (relabel the tuner aside)**

Replace the `.tuner` aside (~892-902), currently:

```html
    <aside class="tuner" id="tuner" aria-hidden="true">
      <header>
        <span class="kicker">PHYSICS · LIVE</span>
        <button class="x" id="tuneClose" aria-label="Close">×</button>
      </header>
      <p class="lede">drag a slider — feels apply immediately. <em>copy</em> dumps the current values for me to paste.</p>
      <div class="rows" id="tuneRows"></div>
      <footer>
        <button class="toggle" id="tuneCopy">copy values</button>
        <button class="toggle" id="tuneReset">reset defaults</button>
      </footer>
    </aside>
```

with:

```html
    <aside class="tuner" id="tuner" aria-hidden="true">
      <header>
        <span class="kicker">SETTINGS</span>
        <button class="x" id="tuneClose" aria-label="Close">×</button>
      </header>
      <div class="settings-rows">
        <button class="toggle settings-item" id="howToPlayBtn" type="button">▸ how to play</button>
        <button class="toggle settings-item" id="muteBtn" aria-pressed="false">sound · on</button>
      </div>
      <div class="settings-disclosure">
        <button class="settings-summary" id="advancedToggle" type="button" aria-expanded="false" aria-controls="advancedBody">▸ advanced · physics</button>
        <div class="advanced-body" id="advancedBody" hidden>
          <p class="lede">drag a slider — feels apply immediately. <em>copy</em> dumps the current values for me to paste.</p>
          <div class="rows" id="tuneRows"></div>
          <footer>
            <button class="toggle" id="tuneCopy">copy values</button>
            <button class="toggle" id="tuneReset">reset defaults</button>
          </footer>
        </div>
      </div>
    </aside>
```

- [ ] **Step 3: Add settings CSS**

Add after the existing `.tuner footer .toggle { … }` block (~623):

```css
    .tuner .settings-rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
    .tuner .settings-item { text-align: left; }
    .settings-disclosure { border-top: 1px dashed var(--line); padding-top: 10px; }
    .settings-summary {
      appearance: none; background: none; border: none; cursor: pointer;
      font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.14em;
      text-transform: uppercase; color: var(--muted); padding: 2px 0;
    }
    .settings-summary[aria-expanded="true"] { color: var(--ink); }
    .advanced-body { margin-top: 10px; }
    .advanced-body[hidden] { display: none; }
```

- [ ] **Step 4: Rewire the open/close + add how-to-play and disclosure handlers**

The existing tuner-open JS (~1537-1545) references `tuneBtn`. Replace:

```javascript
    tuneBtn.addEventListener("click", () => {
      const live = tunerEl.classList.toggle("live");
      tunerEl.setAttribute("aria-hidden", live ? "false" : "true");
      tuneBtn.setAttribute("aria-pressed", live ? "true" : "false");
```

(find the full handler block; it continues to a close handler) — and the `const tuneBtn = document.getElementById("tuneBtn");` line (~1505).

Change the `tuneBtn` lookup (~1505) to:

```javascript
    const tuneBtn = document.getElementById("settingsBtn");
```

(Renaming the element it points at keeps the rest of the open/close logic intact — `tuneBtn` now opens the Settings panel.)

Then, after the existing close-handler block (`tuneClose` listener, ~1543-1545), add the new wiring:

```javascript
    // How-to-play: replay the full story card + tutorial on demand. Does NOT
    // clear the onboarded flag (explicit replay, not first-visit).
    document.getElementById("howToPlayBtn").addEventListener("click", () => {
      tunerEl.classList.remove("live");
      tunerEl.setAttribute("aria-hidden", "true");
      tuneBtn.setAttribute("aria-pressed", "false");
      const introEl = document.getElementById("introPanel");
      introEl.classList.remove("gone");
    });

    // Advanced·physics disclosure.
    const advancedToggle = document.getElementById("advancedToggle");
    const advancedBody = document.getElementById("advancedBody");
    advancedToggle.addEventListener("click", () => {
      const open = advancedBody.hasAttribute("hidden");
      if (open) { advancedBody.removeAttribute("hidden"); advancedToggle.setAttribute("aria-expanded", "true"); }
      else { advancedBody.setAttribute("hidden", ""); advancedToggle.setAttribute("aria-expanded", "false"); }
    });
```

- [ ] **Step 5: Make the intro buttons work on replay**

The intro buttons already call `dismissIntro({…})`, which hides the panel and calls `startGame()` / `startTutorial()`. On replay the panel is simply re-shown (Step 4), so the existing button handlers from Task 1 work unchanged. Verify the intro panel's `pointerdown`-capture "just let me fly" still functions after re-show — it does, because that listener is permanent.

No code change in this step — it is a verification checkpoint. Confirm by reading the Task 1 handlers are still present.

- [ ] **Step 6: Verify JS validity**

Run the extract+`node --check` snippet.
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add tinywings/index.html
git commit -m "tinywings: consolidate footer into restart + settings panel (how-to-play, sound, advanced·physics)"
```

---

## Task 6: SW cache bump + final verification

**Files:**
- Modify: `tinywings/sw.js:2`

- [ ] **Step 1: Bump the SW cache version**

In `tinywings/sw.js`, change:

```javascript
const CACHE = "vibe-tinywings-v31";
```

to:

```javascript
const CACHE = "vibe-tinywings-v32";
```

- [ ] **Step 2: Final JS validity check on both files**

```bash
cd /home/ubuntu/projects/vibe-demos
node --check tinywings/sw.js && echo "sw OK"
python3 -c "
import re,subprocess
html=open('tinywings/index.html').read()
blocks=re.findall(r'<script(?: type=\"module\")?>(.*?)</script>', html, re.S)
open('/tmp/tw.js','w').write('\n;\n'.join(blocks))
r=subprocess.run(['node','--check','/tmp/tw.js'],capture_output=True,text=True)
print('index OK' if r.returncode==0 else 'ERR:\n'+r.stderr)
"
```
Expected: `sw OK` and `index OK`

- [ ] **Step 3: Commit + push**

```bash
cd /home/ubuntu/projects/vibe-demos
git add tinywings/sw.js
git commit -m "tinywings: bump SW cache v31→v32 for story+tutorial+settings"
git push
```

- [ ] **Step 4: Manual behavioral verification (on the published page, ~60s after push)**

Run through these on `https://kalleeh.github.io/vibe-demos/tinywings/` in a fresh/incognito session (so localStorage is clean). Document pass/fail for each:

1. First load shows the story card with the heavy-little-bird copy and two buttons.
2. "teach me to glide →" hides the card, the minimap pointer appears, and coachmark step 1 ("hold on the way down ↓") is visible.
3. Holding through a downslope advances to step 2; releasing on a rise advances to step 3; tapping mid-air to spend boost shows "that's it — the hills are yours." then play resumes.
4. During the tutorial the bird cannot crash and the day does not advance.
5. "skip tutorial" link ends the tutorial immediately and resumes normal play.
6. Reload (same session): story card does NOT reappear; play starts immediately.
7. Footer shows only `restart` and `⚙ settings`.
8. ⚙ opens Settings with "how to play", "sound · on", and a collapsed "advanced · physics"; expanding it reveals the tuner sliders.
9. "how to play" re-opens the story card; choosing either button runs again.
10. Fly the bird off the top of the screen (a strong launch) — the one-time caption "that's your bird — follow the arrow back down" appears next to the chevron, and does not reappear on subsequent off-screen events.
11. With OS "reduce motion" on, the coachmark arrow does not bob.

---

## Self-review notes (completed by plan author)

- **Spec coverage:** Story card + premise (Task 1) ✓; first-visit gate `vibe.tinywings.onboarded` (Task 1) ✓; can't-fail learn-mode pausing day cycle + loss (Task 2) ✓; 3 gated steps dive/release/boost via existing signals (Task 3) ✓; minimap just-in-time pointer (Task 3) ✓; off-screen arrow one-time caption `vibe.tinywings.seenOffscreen` (Task 4) ✓; settings consolidation restart+gear, how-to-play replay (not clearing onboarded), sound, advanced·physics disclosure (Task 5) ✓; reduced-motion on coachmark (Task 3 CSS) ✓; keyboard play unaffected (no pointer-only gates added) ✓; SW cache bump (Task 6) ✓.
- **Signal names verified against code:** `G.pitchDown`, `G.boostingNow`, `releasedAtCrest`/natural-launch block, `endRun()`, day-advance block, `drawOffscreenIndicator(sx,sy)` with in-scope `px`/`py`, `startGame()`, `tuneBtn`/`tunerEl`/`tuneClose`/`tuneRows`, `muteBtn` — all present.
- **Type/name consistency:** `startTutorial` stub (Task 1) → real (Task 3); `G.tutorial`/`G.tutorialStep` defined in Task 2, used in Tasks 2-4; `#hudPointer` created Task 3, reused Task 4; `settingsBtn` id created Task 5 and the `tuneBtn` JS var repointed to it in the same task. No dangling references within a committed state.
- **Placeholder scan:** none.
