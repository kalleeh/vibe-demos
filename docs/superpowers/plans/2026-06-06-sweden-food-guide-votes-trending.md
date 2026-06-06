# Sweden Food Guide: Live Vote Tallies + Trending Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live vote tallies (optimistic + fetch-on-action), a "이번 주 인기" (trending this week) rail using `spot_vote.created` timestamp window, and a climbing-count "+1" animation to community spots in sweden-food-guide, preserving local-first fallback.

**Architecture:** Fetch-on-action (vote) to refresh tallies, client-side trending-window computation (rolling 7 days from `spot_vote.created`), optimistic UI updates for votes, "+1" CSS animation on count rise, and graceful offline degradation (all-time counts). No reconnection polling (per CLAUDE.md).

**Tech Stack:** Plain HTML/JS/CSS, PocketBase SDK (dynamic `import()` at full URL per existing pattern), existing `community_spot` + `spot_vote` collections (autodate fields already present), XSS-safe `textContent` rendering.

---

## Important constraints

1. **Plain static HTML/JS.** NO build tool, NO package.json. Edit `sweden-food-guide/index.html` (and its `sw.js`) in place.
2. **Preserve existing PB import pattern:** dynamic `import("https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs")` (line ~3181), NOT a static import + importmap. Match that exactly.
3. **NO reconnection polling** (per CLAUDE.md). Fetch-on-action (vote) is allowed.
4. **XSS-safe:** all user-submitted fields via `textContent`, never `innerHTML`.
5. **Date parsing across browsers (Safari gotcha):** PocketBase timestamps are SPACE-SEPARATED (`"2026-06-06 10:13:34.219Z"`). Safari's `Date.parse()` returns NaN on that form. Always use `Date.parse(s.replace(" ", "T"))` in any date-window computation (line ~3336 equivalent). Verify this is documented inline in the code.
6. **Local-first:** offline = all-time counts, no trending window. Online/offline indicator already present (line ~3227).
7. **Verification pattern in this repo:** (a) `node --check` on extracted module body (neutralize dynamic import), (b) headless Playwright smoke test. Playwright is at `/tmp/node_modules`, chromium at `/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`. Smoke tests write to the real backend — acceptable (public demo data). Temp smoke files (`_smoke*.mjs`) stay UNTRACKED and are deleted in the final task.

---

## File Structure

```
sweden-food-guide/
├── index.html                   ← ALL changes (PB module, trending rail, vote logic, +1 animation CSS)
└── sw.js                        ← cache bump only (vibe-sweden-food-guide-v1 → v2)
```

**Responsibility:**
- `index.html` lines ~3137–3442: PocketBase module script. Changes: live tally on vote (optimistic + re-fetch counts), trending-window computation (rolling 7 days), trending rail UI + CSS, "+1" animation.
- `index.html` lines ~27–1869: CSS. Add: trending rail styles, "+1" animation, reduced-motion fallback.
- `sw.js`: bump cache name from `vibe-sweden-food-guide-v1` to `vibe-sweden-food-guide-v2`.

---

## Task 1: Server-side vote-count aggregation helper (no new collection, client-side compute)

**Goal:** Refactor the existing client-side vote-count aggregation into a reusable helper that can accept an optional date window for trending computation. Keep current fetch-on-open behavior unchanged for now (full counts).

**Files:** `/home/ubuntu/projects/vibe-demos/sweden-food-guide/index.html`

**Steps:**

- [ ] Read lines 3320–3341 (current `loadSpots()` function). Note the vote-count aggregation logic at line ~3336: `voteRes.forEach((v) => { counts[v.spot] = (counts[v.spot] || 0) + 1; });`.
- [ ] Extract a helper function `aggregateVoteCounts(voteRows, afterTimestamp = null)` above `loadSpots()` (~line 3310). This function:
  - Takes `voteRows` (array of `spot_vote` records from PB) and an optional `afterTimestamp` (JS timestamp in ms since epoch, or null).
  - If `afterTimestamp` is null, counts ALL votes per spot (current behavior).
  - If `afterTimestamp` is a number, counts only votes where `Date.parse(vote.created.replace(" ", "T"))` >= `afterTimestamp`.
  - Returns an object `{ [spotId]: count }`.
  - **Critical date-parsing note:** PocketBase `created` timestamps are SPACE-SEPARATED like `"2026-06-06 10:13:34.219Z"`. Safari's `Date.parse()` returns NaN on that form. Always use `Date.parse(s.replace(" ", "T"))`. Include an inline comment in the code warning about this Safari gotcha.
- [ ] Write the helper (complete code):

```javascript
// Aggregate vote counts per spot. If afterTimestamp is provided (ms since epoch),
// only count votes created after that timestamp (for trending-window computation).
// CRITICAL: PocketBase 'created' timestamps are space-separated ("2026-06-06 10:13:34.219Z").
// Safari's Date.parse() returns NaN on that form. Always use .replace(" ", "T").
function aggregateVoteCounts(voteRows, afterTimestamp = null) {
  const counts = {};
  voteRows.forEach((v) => {
    if (afterTimestamp !== null) {
      // Parse the timestamp safely across browsers (Safari gotcha).
      const voteTime = Date.parse((v.created || "").replace(" ", "T"));
      if (isNaN(voteTime) || voteTime < afterTimestamp) return; // skip votes outside window
    }
    counts[v.spot] = (counts[v.spot] || 0) + 1;
  });
  return counts;
}
```

- [ ] Update `loadSpots()` (line ~3336) to call `aggregateVoteCounts(voteRes)` instead of the inline forEach. Replace the inline aggregation with:

```javascript
const counts = aggregateVoteCounts(voteRes);
```

- [ ] Verify: `node --check` on the module script. Extract lines ~3137–3442 to `/tmp/sweden-pb-module-extracted.mjs`. Neutralize the dynamic import at line ~3181 by replacing `import(PB_ESM)` with `Promise.resolve({ default: class {} })` in the extracted copy. Run:

```bash
cd /tmp
# Extract the module script (lines 3137-3442)
sed -n '3137,3442p' /home/ubuntu/projects/vibe-demos/sweden-food-guide/index.html > sweden-pb-module-extracted.mjs
# Neutralize the dynamic import so node --check doesn't fail on bare specifier
sed -i 's|import(PB_ESM)|Promise.resolve({ default: class {} })|' sweden-pb-module-extracted.mjs
node --check sweden-pb-module-extracted.mjs
```

Expected output: (silence, or `syntax OK` depending on node version). Any error = syntax bug, fix before committing.

- [ ] Commit: `git add -A && git commit -m "sweden: extract vote-count aggregation helper (prep for trending window)"`

---

## Task 2: Live vote tally on vote action (optimistic + fetch-on-action)

**Goal:** When a viewer votes, immediately increment the displayed count (optimistic UI), write the vote to PB, then re-fetch ALL spot_vote rows and re-render the grid so other voters' tallies stay current. Fetch-on-action (vote), NOT polling.

**Files:** `/home/ubuntu/projects/vibe-demos/sweden-food-guide/index.html`

**Steps:**

- [ ] Read the current `upvote()` function (lines ~3393–3429). Note it writes the vote, increments the local count, but does NOT re-fetch other spots' counts.
- [ ] Refactor `upvote()` to re-fetch counts after a successful vote. After line ~3421 (`btn.classList.add("voted");`), add a call to `loadSpots()` so the grid re-renders with fresh counts from the server.
- [ ] Current code at line ~3424 already calls `loadSpots()` — verify it's in the right place (after marking the button as voted). No change needed IF it's already there. If missing, add it.
- [ ] Test the optimistic flow: the count increments immediately (line ~3403 or ~3418), then `loadSpots()` re-fetches and re-renders. The viewer sees their +1 immediately, and others' votes appear on the re-render.
- [ ] Handle the offline case: if `online === false`, the local bump (line ~3403) is the final state; do NOT call `loadSpots()` in the offline branch (it would just re-render the same local data). The current code already handles this — verify no redundant call.
- [ ] Verify: `node --check` on the extracted module (same neutralization as Task 1).
- [ ] Commit: `git add -A && git commit -m "sweden: live vote tally (optimistic + fetch-on-action)"`

---

## Task 3: Trending-window computation (rolling 7 days) + "이번 주 인기" rail UI

**Goal:** Add a horizontal trending rail above the community grid. Compute trending spots by counting votes in the last 7 days (using `spot_vote.created`). Falls back to all-time counts offline. Render top 3–5 trending spots in a compact horizontal strip.

**Files:** `/home/ubuntu/projects/vibe-demos/sweden-food-guide/index.html`

**Steps:**

- [ ] Add CSS for the trending rail in the `<style>` block (lines ~27–1869). Insert before the `.comm-status` rule (~line 576):

```css
/* ── Trending rail (이번 주 인기) ── */
.comm-trending {
  border: 1px solid var(--line);
  border-bottom: 0;
  padding: 18px 22px 16px;
  background: rgba(254, 204, 2, 0.03);
  display: none; /* shown only when online + trending data exists */
}
.comm-trending.show { display: block; }
.comm-trending .head {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 12px;
}
.comm-trending .rail {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--gold) transparent;
}
.comm-trending .rail::-webkit-scrollbar { height: 4px; }
.comm-trending .rail::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }
.comm-trending .rail::-webkit-scrollbar-track { background: transparent; }
.trending-spot {
  flex-shrink: 0;
  width: 200px;
  border: 1px solid var(--line-strong);
  padding: 14px 16px 12px;
  background: var(--paper);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.trending-spot .name {
  font-family: "Fraunces", "Noto Serif KR", serif;
  font-weight: 500;
  font-size: 16px;
  letter-spacing: -0.005em;
  line-height: 1.2;
}
.trending-spot .city {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--frost);
}
.trending-spot .votes {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--gold);
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.trending-spot .votes .heart { font-size: 12px; color: var(--berry); }
.trending-spot .votes .n { font-weight: 600; font-feature-settings: "tnum"; }
@media (prefers-reduced-motion: reduce) {
  .comm-trending .rail { scroll-behavior: auto; }
}
```

- [ ] In the HTML (line ~2291, above `<div class="comm-status" id="commStatus">`), insert the trending rail:

```html
<div class="comm-trending" id="commTrending">
  <div class="head">이번 주 인기 · Trending This Week</div>
  <div class="rail" id="trendingRail"></div>
</div>
```

- [ ] In the PB module script, add a `renderTrending(trendingSpots)` function above `loadSpots()` (~line 3310):

```javascript
// Render the trending rail (top 3-5 spots by votes in the last 7 days).
// Called only when online; offline mode hides the rail.
function renderTrending(trendingSpots) {
  const container = $id("commTrending");
  const rail = $id("trendingRail");
  if (!container || !rail) return;
  rail.textContent = ""; // clear
  if (!trendingSpots || trendingSpots.length === 0) {
    container.classList.remove("show");
    return;
  }
  container.classList.add("show");
  // Top 5 trending (or fewer if list is short)
  const top = trendingSpots.slice(0, 5);
  top.forEach((s) => {
    const card = document.createElement("div");
    card.className = "trending-spot";
    const name = document.createElement("div"); name.className = "name";
    name.textContent = s.name; // XSS-safe
    const city = document.createElement("div"); city.className = "city";
    city.textContent = citySigil(s.city) + " · " + s.city;
    const votes = document.createElement("div"); votes.className = "votes";
    const heart = document.createElement("span"); heart.className = "heart"; heart.textContent = "♥";
    const n = document.createElement("span"); n.className = "n"; n.textContent = String(s.votes || 0);
    const label = document.createElement("span"); label.textContent = "이번 주";
    votes.appendChild(heart); votes.appendChild(n); votes.appendChild(label);
    card.appendChild(name); card.appendChild(city); card.appendChild(votes);
    rail.appendChild(card);
  });
}
```

- [ ] Update `loadSpots()` (line ~3320) to compute trending data when online. After fetching `spotRes` and `voteRes` (line ~3332), compute two sets of counts:
  - All-time counts (existing logic, used for the main grid).
  - Trending-window counts (last 7 days only, used for the rail).
  - Replace the current aggregation call (line ~3336) with:

```javascript
// All-time counts for the main grid
const counts = aggregateVoteCounts(voteRes);

// Trending window: last 7 days (rolling)
const now = Date.now();
const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
const trendingCounts = aggregateVoteCounts(voteRes, sevenDaysAgo);

// Build remote spots with all-time vote counts
const remote = spotRes.map((r) => ({
  id: r.id, name: r.name, city: r.city, note: r.note || "",
  player_id: r.player_id, votes: counts[r.id] || 0, source: "remote",
}));

// Build trending list (spots with votes in the last 7 days, sorted desc)
const trending = spotRes
  .map((r) => ({
    id: r.id, name: r.name, city: r.city,
    votes: trendingCounts[r.id] || 0, source: "remote",
  }))
  .filter((s) => s.votes > 0) // only spots with at least 1 vote this week
  .sort((a, b) => b.votes - a.votes); // desc by trending votes

renderTrending(trending);
renderSpots(sortSpots(remote));
_loaded = true;
```

- [ ] Offline fallback: in the offline branch (line ~3345, the `catch` block), hide the trending rail:

```javascript
const container = $id("commTrending");
if (container) container.classList.remove("show");
```

- [ ] Verify: `node --check` on the extracted module (same neutralization).
- [ ] Commit: `git add -A && git commit -m "sweden: trending rail (이번 주 인기) — rolling 7-day window"`

---

## Task 4: "+1" climbing-count animation on vote rise

**Goal:** When a spot's vote count increases, show a subtle "+1" animation next to the number (fades in, floats up slightly, fades out). Reduced-motion: no float, just a quick fade.

**Files:** `/home/ubuntu/projects/vibe-demos/sweden-food-guide/index.html`

**Steps:**

- [ ] Add CSS for the "+1" animation in the `<style>` block (~line 700, after `.comm-vote .n`):

```css
/* +1 climbing animation (triggered by JS on vote) */
.comm-vote .n {
  position: relative;
}
.comm-vote .plus-one {
  position: absolute;
  left: 100%;
  top: -2px;
  margin-left: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--pine);
  pointer-events: none;
  animation: climbFade 1.2s ease-out forwards;
}
@keyframes climbFade {
  0% { opacity: 0; transform: translateY(0); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-8px); }
}
@media (prefers-reduced-motion: reduce) {
  .comm-vote .plus-one {
    animation: climbFadeReduced 0.8s ease-out forwards;
  }
  @keyframes climbFadeReduced {
    0% { opacity: 0; }
    30% { opacity: 1; }
    100% { opacity: 0; }
  }
}
```

- [ ] In the `upvote()` function (line ~3393), after incrementing the count (line ~3403 or ~3418), trigger the "+1" animation by injecting a temporary element:

```javascript
// After line ~3403 (local) or ~3418 (remote):
spot.votes = (spot.votes || 0) + 1;
nEl.textContent = String(spot.votes);

// Trigger +1 animation
const plus = document.createElement("span");
plus.className = "plus-one";
plus.textContent = "+1";
plus.setAttribute("aria-hidden", "true"); // decorative, not announced
nEl.parentElement.appendChild(plus);
setTimeout(() => { if (plus.parentElement) plus.parentElement.removeChild(plus); }, 1300); // cleanup after animation
```

- [ ] Verify the animation fires on both local and remote votes (test by clicking a vote button). The "+1" should appear next to the number, float up, and fade out.
- [ ] Verify: `node --check` on the extracted module.
- [ ] Commit: `git add -A && git commit -m "sweden: +1 climbing-count animation on vote rise"`

---

## Task 5: Reduced-motion fallback + SW cache bump + cleanup

**Goal:** Ensure reduced-motion users see a simpler animation (no float), bump the service worker cache name, and clean up any temp smoke files.

**Files:** `/home/ubuntu/projects/vibe-demos/sweden-food-guide/index.html`, `/home/ubuntu/projects/vibe-demos/sweden-food-guide/sw.js`

**Steps:**

- [ ] Verify reduced-motion CSS is already present (added in Task 4). No further changes needed for `index.html`.
- [ ] Read `sw.js` (current cache name is `vibe-sweden-food-guide-v1` in the CACHE_NAME constant). Bump to `v2`:

```javascript
const CACHE_NAME = 'vibe-sweden-food-guide-v2';
```

- [ ] Verify the activate handler deletes old caches (it should — this is standard PWA boilerplate). If missing, add:

```javascript
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
});
```

(Most likely already present — just verify.)

- [ ] Clean up any temp smoke files in the demo folder:

```bash
cd /home/ubuntu/projects/vibe-demos/sweden-food-guide
rm -f _smoke*.mjs
```

- [ ] Commit: `git add -A && git commit -m "sweden: reduced-motion + SW cache bump (v1 → v2)"`

---

## Task 6: Playwright smoke test (headless, writes to real backend)

**Goal:** Write a headless Playwright smoke test that loads the demo, adds a spot, votes on it, and verifies the trending rail appears (if online). Accepts that it writes to the real backend (public demo data).

**Files:** `/home/ubuntu/projects/vibe-demos/sweden-food-guide/_smoke_test.mjs` (temp, untracked, deleted in Task 7)

**Steps:**

- [ ] Write the smoke test. Playwright is at `/tmp/node_modules`, chromium at `/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`. Use `NODE_PATH=/tmp/node_modules` to resolve `playwright` (bare specifier). Run from a FILE (not `node -e`) so dynamic import honors NODE_PATH.

```javascript
// /home/ubuntu/projects/vibe-demos/sweden-food-guide/_smoke_test.mjs
// Smoke test: headless Playwright check for trending rail + vote logic.
// Writes to the real backend (acceptable for demo data).

import { chromium } from 'playwright';

const DEMO_URL = 'file://' + process.cwd() + '/index.html';
const CHROMIUM_PATH = '/home/ubuntu/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';

(async () => {
  console.log('[smoke] Launching chromium...');
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  console.log('[smoke] Loading demo...');
  await page.goto(DEMO_URL, { waitUntil: 'networkidle' });

  // Wait for the community section to load (skeleton → real data or local fallback)
  await page.waitForSelector('#commGrid', { timeout: 10000 });
  console.log('[smoke] Community grid loaded.');

  // Check if online (status indicator)
  const statusText = await page.locator('#commStatusText').textContent();
  const isOnline = statusText.includes('연결됨') || statusText.includes('커뮤니티');
  console.log(`[smoke] Online status: ${isOnline ? 'YES' : 'NO (local mode)'}`);

  if (isOnline) {
    // Check trending rail visibility
    const trendingVisible = await page.locator('#commTrending.show').count();
    console.log(`[smoke] Trending rail visible: ${trendingVisible > 0 ? 'YES' : 'NO (no trending data or offline)'}`);
  } else {
    console.log('[smoke] Offline mode — trending rail should be hidden.');
    const trendingVisible = await page.locator('#commTrending.show').count();
    if (trendingVisible > 0) {
      throw new Error('[smoke] FAIL: Trending rail visible in offline mode!');
    }
  }

  // Add a spot (writes to backend if online, or local storage)
  const testSpotName = 'Smoke Test Café ' + Date.now();
  await page.fill('#commName', testSpotName);
  await page.selectOption('#commCity', '스톡홀름');
  await page.fill('#commNote', 'Automated smoke test entry.');
  await page.click('#commAddBtn');
  await page.waitForTimeout(2000); // wait for add to complete
  console.log('[smoke] Added test spot:', testSpotName);

  // Verify the spot appears in the grid
  const spotCards = await page.locator('.comm-spot').all();
  let foundTestSpot = false;
  for (const card of spotCards) {
    const nameEl = await card.locator('h4').textContent();
    if (nameEl.includes(testSpotName)) {
      foundTestSpot = true;
      console.log('[smoke] Test spot found in grid.');

      // Vote on it (if not already voted)
      const voteBtn = await card.locator('.comm-vote').first();
      const isDisabled = await voteBtn.isDisabled();
      if (!isDisabled) {
        await voteBtn.click();
        await page.waitForTimeout(1500); // wait for vote + re-render
        console.log('[smoke] Voted on test spot.');

        // Verify the count incremented
        const countEl = await card.locator('.comm-vote .n').textContent();
        const count = parseInt(countEl, 10);
        if (count >= 1) {
          console.log(`[smoke] Vote count after click: ${count} (OK)`);
        } else {
          throw new Error('[smoke] FAIL: Vote count did not increment!');
        }
      } else {
        console.log('[smoke] Vote button already disabled (already voted).');
      }
      break;
    }
  }

  if (!foundTestSpot) {
    throw new Error('[smoke] FAIL: Test spot not found in grid after add!');
  }

  await browser.close();
  console.log('[smoke] ✓ All checks passed.');
})();
```

- [ ] Run the smoke test:

```bash
cd /home/ubuntu/projects/vibe-demos/sweden-food-guide
NODE_PATH=/tmp/node_modules node _smoke_test.mjs
```

Expected output: logs showing grid load, trending visibility check (online/offline), spot add, vote, and vote-count verification. If any step fails, the script throws.

- [ ] If the test passes, note that it wrote a test spot to the backend (acceptable for demo data). If it fails, debug the failure (likely a timing issue or missing element — adjust wait selectors).
- [ ] Do NOT commit `_smoke_test.mjs` — it will be deleted in Task 7.

---

## Task 7: Manual E2E verification + cleanup

**Goal:** Manually open the demo in a browser (local file or live Pages URL after push), verify the full flow end-to-end, then delete temp smoke files.

**Files:** N/A (manual testing)

**Steps:**

- [ ] Open `/home/ubuntu/projects/vibe-demos/sweden-food-guide/index.html` in a browser (or push to `pocketbase-backends-batch` and open the Pages preview).
- [ ] Verify the community section loads:
  - [ ] If online: status shows "● 연결됨 · 커뮤니티 추천".
  - [ ] If offline: status shows "○ 로컬 모드 — 이 기기에만 저장".
- [ ] Verify the trending rail (online only):
  - [ ] If online AND there are spots with votes in the last 7 days: the "이번 주 인기 · Trending This Week" rail appears above the grid with top 3–5 spots.
  - [ ] If offline: the rail is hidden.
- [ ] Add a test spot:
  - [ ] Fill "장소 이름", select a city, optionally add a note, click "추천 추가".
  - [ ] Verify it appears in the grid (bottom or top depending on sort).
- [ ] Vote on a spot (yours or someone else's):
  - [ ] Click "실제로 가봤어요" on a spot with 0 votes.
  - [ ] Verify the count increments immediately (optimistic).
  - [ ] Verify the "+1" animation appears next to the number (floats up, fades out).
  - [ ] Wait 1-2 seconds for the re-fetch; verify other spots' counts are current (if online).
  - [ ] Verify the button changes to "가봤어요" and becomes disabled.
- [ ] Verify reduced-motion fallback (if you have a way to toggle `prefers-reduced-motion`):
  - [ ] The "+1" animation should fade in/out WITHOUT floating up.
  - [ ] The trending rail scrollbar should not smooth-scroll.
- [ ] Verify offline fallback:
  - [ ] Disconnect network (or block `sweden-food-guide.pb.gurum.se` in devtools).
  - [ ] Reload the page.
  - [ ] Verify status shows "로컬 모드".
  - [ ] Verify trending rail is hidden.
  - [ ] Add a spot; verify it's stored locally (appears in grid immediately).
  - [ ] Vote on a local spot; verify the count increments (local-only).
- [ ] Clean up temp smoke files:

```bash
cd /home/ubuntu/projects/vibe-demos/sweden-food-guide
rm -f _smoke*.mjs /tmp/sweden-pb-module-extracted.mjs
```

- [ ] If all checks pass, the implementation is complete.

---

## Self-review notes

Before marking this plan as "done", verify:

1. **Date parsing is correct.** All code that parses `spot_vote.created` uses `Date.parse(s.replace(" ", "T"))`, never `Date.parse(s)` directly. Inline comment warns about Safari.
2. **No reconnection polling.** The only fetch-on-action is triggered by a vote (user-initiated). No `setInterval`, no heartbeat.
3. **XSS-safe rendering.** All user fields (`name`, `city`, `note`) rendered via `textContent`, never `innerHTML`.
4. **Trending rail hidden offline.** The `catch` block in `loadSpots()` explicitly hides `#commTrending`.
5. **Reduced-motion fallback.** The "+1" animation has a `@media (prefers-reduced-motion: reduce)` version that skips the float.
6. **Cache bump.** `sw.js` cache name is `vibe-sweden-food-guide-v2`.
7. **Temp files deleted.** `_smoke*.mjs` and `/tmp/sweden-pb-module-extracted.mjs` removed before final commit.

If any of these are missing, revisit the relevant task.

---

## Final commit message (after all tasks)

```
sweden: live vote tallies + trending rail (이번 주 인기)

- Add fetch-on-action vote refresh (optimistic UI + re-fetch counts)
- Trending rail: rolling 7-day window via spot_vote.created
- +1 climbing-count animation on vote rise (reduced-motion fallback)
- Offline: all-time counts, no trending rail
- Date-parsing Safari gotcha documented inline (.replace(" ", "T"))
- SW cache bump: v1 → v2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```
