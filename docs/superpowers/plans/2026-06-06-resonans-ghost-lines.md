# Resonans Ghost Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add faint, drifting ghost lines of others' locked waves to the resonans demo — ambient presence only, ZERO counts/names/ranking/+1. Ghost lines drift slowly across the paper behind the active string, rendered in the same hand-inked style (low opacity, slowly fading). Fetch-on-open only (existing `getList(1, 30, {sort:'-created'})`), NO realtime, NO polling.

**Architecture:** Ghost-line rendering added to the 1D string scene render loop. Each ghost = standing-wave sine of its mode + amplitude, drawn via the existing `strokePath()` utility with reduced alpha, light jitter, single pass. Ghost opacity fades over time based on record age. Reduced-motion: static + fainter or omitted.

**Tech Stack:** Plain HTML/JS (existing resonans/index.html), PocketBase SDK (already lazy-loaded via dynamic import), Canvas 2D rendering (existing hand-drawn line utilities).

---

## Important Constraints

**HARD GUARD — ZERO COUNTS/NAMES/RANKING:** The spec's §5 HARD GUARD: "no number, no name, no ranking, no '+1', no 'N others.'" If any task introduces a count or ranking UI, it violates the demo's stated creed (line ~1598) and is out of scope. Ghost lines are the ONLY addition allowed — purely visual, no metrics, no social proof numbers.

**Local-first:** Offline = your own locked waves only, no ghosts from others. Online = fetch others' waves on gallery open (already happening), render ghosts on canvas.

**Fetch-on-open only:** NO realtime subscription, NO reconnection polling (per CLAUDE.md PB pattern). Ghost data comes from the existing `getList(1, 30, {sort:'-created'})` call that already happens when the gallery overlay is opened.

**Reduced-motion:** Ghosts render static (no drift animation, no fade animation) and at even lower opacity, or are omitted entirely.

**XSS-safety:** No user-submitted text is rendered via innerHTML anywhere (not an issue here — ghosts are visual only, no text).

**Verification:** `node --check` on extracted module (strip PB bare import), headless Playwright smoke (page loads, no pageerrors, ghost-render function runs, no count/name DOM).

---

## File Structure

```
resonans/
├── index.html         ← EDIT: add ghost-line rendering logic
├── sw.js              ← EDIT: bump CACHE version
└── pb/
    └── pb_migrations/
        └── 002_add_autodate.js  ← already exists, no schema change needed
```

---

## Current State (verified via Read)

The demo **already** fetches locked waves on gallery open:
- Line ~1825: `c.collection("locked_wave").getList(1, 30, { sort: "-created" })`
- Fetched records are rendered as **thumbnail cards in the gallery overlay** via `renderRows()` (line ~1750)
- Each card shows a tiny canvas with the standing wave drawn via `drawThumb(cv, n)` (line ~1717)
- The main string is drawn via `strokePath(coords, opts)` (line ~843) — hand-drawn multi-pass jitter strokes

**What needs to be added:** A new render function `drawGhostLines()` that takes the fetched locked_wave records, computes their standing-wave sine curves (mode + amplitude), and renders them faintly behind the active string in the main canvas (1D string scene only, not Chladni).

---

## Tasks

### Task 1: Add ghost-line data cache + render function

**Files:** `/home/ubuntu/projects/vibe-demos/resonans/index.html`

Add a global cache for fetched ghost records and a render function that draws them as faint, drifting standing waves behind the active string.

- [ ] Add ghost data cache at top of module script (after PB constants, line ~1622):
  ```javascript
  let ghostWaves = [];  // cached locked_wave records from others
  ```

- [ ] Add helper to build standing-wave coords for a given mode/amplitude (after `coefForRender()`, line ~931):
  ```javascript
  // Build standing-wave coordinates for a ghost line (mode n, amplitude amp).
  // Returns array of [x, y] coords matching curveCoords format.
  function ghostCoords(n, amp) {
    const coords = new Array(N);
    for (let i = 0; i < N; i++) {
      const x = gridX(i);
      const y = stringY - Math.sin((n * Math.PI * i) / (N - 1)) * amp;
      coords[i] = [x, y];
    }
    return coords;
  }
  ```

- [ ] Add ghost-line render function (after `drawRivalLeak()`, line ~1056):
  ```javascript
  // Draw faint, drifting ghost lines of others' locked waves — ambient presence only.
  // NO counts, NO names, NO ranking. Fetch-on-open only, NO realtime.
  function drawGhostLines(now) {
    if (!ghostWaves || ghostWaves.length === 0) return;
    const me = playerId();
    // Filter out own waves (ghost lines are "others", not self-echo).
    const others = ghostWaves.filter(r => r.player_id !== me);
    if (others.length === 0) return;
    
    ctx.save();
    // Render oldest-to-newest so newest ghosts draw on top (faintest to most visible).
    for (let i = others.length - 1; i >= 0; i--) {
      const r = others[i];
      const n = Math.max(1, Math.min(5, Math.round(r.mode || 1)));
      const amp = Math.max(0, Math.min(5, +(r.amplitude || 0))) * 90; // same scale as curveAmp
      
      // Fade opacity based on age: recent = more visible, old = near-invisible.
      // Parse created (space-separated; Safari NaN gotcha).
      const createdMs = Date.parse((r.created || "").replace(" ", "T"));
      const ageMs = Date.now() - (isNaN(createdMs) ? 0 : createdMs);
      const ageFade = Math.max(0, Math.min(1, 1 - ageMs / (14 * 86400 * 1000))); // fade over 14 days
      
      // Slow horizontal drift (phase offset based on record id or index).
      const driftPhase = (now * 0.00005 + i * 0.3) % 1;
      const driftX = reduceMotion ? 0 : driftPhase * stringW * 0.1 - stringW * 0.05;
      
      // Base opacity: very faint (0.08-0.14 range), scaled by age.
      let baseAlpha = (0.08 + ageFade * 0.06);
      // Reduced-motion: even fainter or omit entirely.
      if (reduceMotion) baseAlpha *= 0.5;
      if (baseAlpha < 0.02) continue;
      
      // Build coords and offset by drift.
      const coords = ghostCoords(n, amp);
      const driftedCoords = coords.map(([x, y]) => [x + driftX, y]);
      
      // Draw with the same hand-drawn style as the main string, but single pass + faint.
      strokePath(driftedCoords, {
        color: "rgba(107, 138, 118, 0.55)", // same muted bloom-2 as the target ghost
        alpha: baseAlpha,
        jitter: reduceMotion ? 0.2 : 0.8,
        passes: 1,
        lineWidth: 1.2
      });
    }
    ctx.restore();
  }
  ```

- [ ] Call `drawGhostLines(now)` in the main render loop (inside `if (scene === "string")` block, **before** `drawAntinodeHints()` so ghosts are behind all UI, line ~1318):
  ```javascript
      if (scene === "chladni") {
        drawChladni(now, dt);
      } else {
        const curveAmp = 90;
        drawGhostLines(now);          // ← ADD THIS LINE
        drawAntinodeHints();
        drawTarget(curveAmp);
        // ... rest of string scene render
      }
  ```

### Task 2: Populate ghost cache when gallery loads

**Files:** `/home/ubuntu/projects/vibe-demos/resonans/index.html`

Populate `ghostWaves` when the gallery fetches records, so the canvas render loop has data to draw.

- [ ] Update `loadGallery()` (line ~1817) to cache fetched records into `ghostWaves`:
  ```javascript
  async function loadGallery() {
    // fetch-on-open. Re-check health here (user-initiated action).
    if (!online) await checkHealth();
    if (!online) { 
      // Offline: only your own waves, no ghosts from others.
      ghostWaves = [];  // ← ADD THIS LINE
      renderRows(localList(), "local"); 
      return; 
    }
    renderSkeleton();
    try {
      const c = await getPB();
      if (!c) throw new Error("sdk unavailable");
      const res = await c.collection("locked_wave").getList(1, 30, { sort: "-created" });
      ghostWaves = res.items || [];  // ← ADD THIS LINE (cache for ghost rendering)
      renderRows(res.items || [], "shared");
    } catch (e) {
      online = false;
      ghostWaves = [];  // ← ADD THIS LINE (offline fallback)
      renderRows(localList(), "local");
    }
  }
  ```

- [ ] Add initial ghost load on page load (after the gallery event-listener block, line ~1856):
  ```javascript
  // Pre-load ghost data on page load (silent, doesn't open the overlay).
  // Gallery button will re-fetch when opened, so this is just a warm start.
  (async function preloadGhosts() {
    if (!online) await checkHealth();
    if (!online) return;
    try {
      const c = await getPB();
      if (!c) return;
      const res = await c.collection("locked_wave").getList(1, 30, { sort: "-created" });
      ghostWaves = res.items || [];
    } catch (e) { /* silent — ghosts are additive */ }
  })();
  ```

### Task 3: Service worker cache bump

**Files:** `/home/ubuntu/projects/vibe-demos/resonans/sw.js`

Bump the cache version so returning visitors get the new ghost-line code.

- [ ] Increment cache version (line 2):
  ```javascript
  const CACHE = "vibe-resonans-v10";  // was v9
  ```

### Task 4: Verification + cleanup

**Files:** temporary smoke files in `/home/ubuntu/projects/vibe-demos/resonans/`

Verify the changes via node --check + headless Playwright smoke, then clean up temp files.

- [ ] Strip PB bare import and run node --check:
  ```bash
  cd /home/ubuntu/projects/vibe-demos/resonans
  # Extract the module script (lines 1594-1857) to a temp file, replace bare 'pocketbase' import with the CDN URL
  sed -n '1594,1857p' index.html | \
    sed 's|const PB_ESM = "https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs";|const PB_ESM = "https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs"; const PocketBase = {}; const pb = null;|' | \
    sed 's|import(PB_ESM)|Promise.resolve({default: function() {}})|' > _check_module.mjs
  node --check _check_module.mjs
  ```
  Expected: no errors (syntax valid, no runtime issues).

- [ ] Write Playwright smoke test:
  ```javascript
  // resonans/_smoke.mjs
  import { chromium } from 'playwright';
  const exe = '/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///home/ubuntu/projects/vibe-demos/resonans/index.html');
  await page.waitForTimeout(2000);  // let page settle
  // Check: no pageerrors
  if (errors.length > 0) throw new Error(`Page errors: ${errors.join('; ')}`);
  // Check: canvas rendered
  const canvas = await page.locator('#sketch').boundingBox();
  if (!canvas || canvas.width < 100) throw new Error('Canvas not rendered');
  // Check: NO count/name/ranking DOM (hard guard)
  const suspectText = await page.locator('body').textContent();
  const banned = [' others', '+1', '#1', 'rank', 'leaderboard', 'N people', 'N명'];
  for (const b of banned) {
    if (suspectText.toLowerCase().includes(b.toLowerCase())) {
      throw new Error(`HARD GUARD VIOLATED: found banned text "${b}"`);
    }
  }
  // Check: ghost render function exists (grep the page source)
  const html = await page.content();
  if (!html.includes('drawGhostLines')) throw new Error('drawGhostLines not found');
  console.log('✓ resonans ghost-lines smoke passed');
  await browser.close();
  ```

- [ ] Run smoke test:
  ```bash
  cd /home/ubuntu/projects/vibe-demos/resonans
  NODE_PATH=/tmp/node_modules node _smoke.mjs
  ```
  Expected output: `✓ resonans ghost-lines smoke passed`

- [ ] Delete temp files:
  ```bash
  cd /home/ubuntu/projects/vibe-demos/resonans
  rm -f _check_module.mjs _smoke.mjs
  ```

### Task 5: Manual visual check + self-review

**Files:** n/a (manual check)

Open the demo locally and verify ghost lines render correctly + re-check the hard guard.

- [ ] Open the demo in a browser (file:// or via a local server).
- [ ] Open the gallery overlay ("others' resonances" button) to trigger ghost data fetch.
- [ ] Close the gallery and observe the canvas: faint, drifting ghost lines should be visible behind the active string (if any records exist in the collection).
- [ ] Reduced-motion check: toggle `prefers-reduced-motion: reduce` in DevTools and verify ghosts are static + fainter or omitted.
- [ ] HARD GUARD self-review: visually scan the entire page (canvas + all UI) and confirm ZERO counts, names, rankings, "+1", "N others" appeared. If any count-like UI is visible, the task FAILED the hard guard.

---

## Expected Outcome

After implementation:
- Others' locked waves drift faintly across the canvas as pale, slowly-fading ghost lines behind the active string, in the same hand-inked style.
- NO counts, NO names, NO ranking, NO "+1", NO "N others" anywhere on the page.
- Fetch-on-open only (no realtime, no polling).
- Offline = no ghosts (your own waves only in gallery).
- Reduced-motion = ghosts static + fainter or omitted.
- SW cache bumped to v10.
- Verification: node --check passes, Playwright smoke passes, manual visual check confirms no hard-guard violations.

---

## Self-Review Note

**CRITICAL:** Before marking this plan complete, re-read §5 of the source spec and confirm the implementation introduces ZERO counts/names/ranking. The demo's creed (line ~1598) states: "NOT a leaderboard: no scores, no ranking, no counts, no 'you're #1'." If any task added a count or ranking UI, it violated the spec and must be removed.
