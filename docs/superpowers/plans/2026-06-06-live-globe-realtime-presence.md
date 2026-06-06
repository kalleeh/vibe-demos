# live-globe Realtime Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make other visitors' pins appear on the live-globe in real time (with an arrival glow) and show a soft "recent activity" count, turning the solo globe into a felt-shared one.

**Architecture:** live-globe's presence layer is an isolated `<script type="module">` (lines ~1986–2375 of `live-globe/index.html`) that talks to a Three.js globe only through the `window.__globe` bridge. Today it fetches pins once on open via `getList`. This plan adds a PocketBase realtime `subscribe('*')` so `create` events render incrementally, a per-pin "arrival glow" animation in the globe bridge, and an activity count derived from recent `created` timestamps. Everything is additive and degrades to the existing local-first behavior when offline.

**Tech Stack:** Plain static HTML/JS (no build tool, no framework — per CLAUDE.md). PocketBase JS SDK 0.25.0 (loaded via dynamic `import()` of a full CDN URL — the page's importmap is owned by Three.js). Three.js 0.160 for the globe. Verification via `node --check` (module syntax) + a headless Playwright smoke test using the repo's cached Chromium.

**Spec:** `docs/superpowers/specs/2026-06-06-play-demos-social-presence-design.md` §2.

---

## Important constraints (read before starting)

- **No build tool / no package.json / no framework.** Edit `live-globe/index.html` in place. (CLAUDE.md "Things to NOT do".)
- **Local-first is sacred.** The page must fully work with the backend down. Realtime is purely additive; never gate the UI on it.
- **No reconnection polling.** The PB SDK auto-reconnects its realtime subscription; do not add manual polling loops (CLAUDE.md PocketBase pattern).
- **XSS-safe.** All user-submitted fields (`city`, `note`) render via `textContent` only — the existing `renderList` already does this; preserve it.
- **PB SDK import style.** Use the existing `getPB()` (dynamic `import()` of `PB_ESM`). Do NOT add a static `import "pocketbase"` or touch the Three.js importmap.
- **The collection has `created`** (autodate, added in commit `c2b4d3c`) and `refresh()` already requests it in `fields`. Reuse it.

---

## File Structure

- **Modify only:** `live-globe/index.html`
  - Globe bridge object `window.__globe` (~lines 1229–1280): add a `glowPin(rec)` method and a per-frame glow updater hooked into the existing `onFrame`/tick path.
  - Presence module (~lines 1986–2375): add realtime subscribe/unsubscribe, incremental insert of new records, and the activity-count UI wiring.
  - Presence panel header DOM (~line 919–920): add a count element.
  - A small CSS rule for the count (near the existing `.presence .p-head` styles, ~line 618).
- **Modify:** `live-globe/sw.js` line 2 — bump cache `vibe-live-globe-v6` → `v7`.
- **Create (temporary, not committed):** `live-globe/_smoke.mjs` — a headless Playwright smoke test. Deleted before the final commit.

No new files ship. No migration needed (schema unchanged).

---

## Task 1: Add incremental-insert helper to the presence module (no realtime yet)

Today `renderAll(records)` replaces the entire list + all globe pins. Realtime needs to add a *single* new record without clearing. This task adds `addRecord(rec)` and is independently testable via the existing render path.

**Files:**
- Modify: `live-globe/index.html` (presence module, near `renderAll`, ~line 2173)

- [ ] **Step 1: Add a de-dupe key helper and `addRecord` above `setOnline` (after `renderAll`, ~line 2178)**

Insert immediately after the closing `}` of `renderAll`:

```javascript
    // Stable-ish identity for a record across local/server variants. Server
    // recs have a real `id`; local-only recs don't, so fall back to geo+city.
    function recKey(r) {
      return r.id || `${r.lat}|${r.lon}|${r.city}`;
    }

    // Incrementally add ONE record (used by realtime). No full clear/redraw:
    // prepends to the list, adds a single globe pin, and triggers its glow.
    // Ignores records we already have (e.g. our own create echoed back).
    function addRecord(rec) {
      const key = recKey(rec);
      if (allRecords.some(r => recKey(r) === key)) return false;
      allRecords = [rec, ...allRecords].slice(0, FETCH_N);
      // Re-render the list (cheap, capped at FETCH_N) so "mine" highlighting
      // and click handlers stay correct.
      renderList(allRecords);
      // Add just this pin to the globe + glow it, without clearing others.
      const g = window.__globe;
      if (g && typeof rec.lat === "number" && typeof rec.lon === "number") {
        const mine = rec.player_id === playerId();
        g.addPin({ city: rec.city, note: rec.note, lat: rec.lat, lon: rec.lon, mine });
        if (typeof g.glowLastPin === "function") g.glowLastPin();
      }
      return true;
    }
```

- [ ] **Step 2: Verify module syntax**

Extract the module body and syntax-check it. Run:

```bash
cd /home/ubuntu/projects/vibe-demos
node -e "const fs=require('fs');const h=fs.readFileSync('live-globe/index.html','utf8');const blocks=h.split('<script type=\"module\">');const m=blocks[blocks.length-1].split('</script>')[0];fs.writeFileSync('/tmp/lg-mod.mjs', m.replace(/import\((PB_ESM)\)/,'Promise.resolve({default:class{}})'));" && node --check /tmp/lg-mod.mjs && echo "SYNTAX OK"
```

Expected: `SYNTAX OK` (the `glowLastPin` reference is fine — it's a runtime property access, guarded by `typeof`).

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add live-globe/index.html
git commit -m "live-globe: add incremental addRecord() helper for realtime inserts"
```

---

## Task 2: Add `glowLastPin()` + per-frame glow decay to the globe bridge

The globe bridge owns Three.js objects. Add a method that makes the most-recently-added pin flare (scale + opacity) then decay over ~1.6s, updated each frame. This is what makes an arriving pin catch the eye.

**Files:**
- Modify: `live-globe/index.html` (globe bridge `window.__globe`, ~lines 1229–1280; tick loop ~line 1486)

- [ ] **Step 1: Add a glow-tracking array near the presence pin declarations (~line 1225)**

Find:

```javascript
    const presencePins = []; // { mesh, halo, rec } — rec = {city, note, lat, lon, mine}
    const presenceGroup = new THREE.Group();
    globe.add(presenceGroup);
```

Add directly below `globe.add(presenceGroup);`:

```javascript
    const glowing = []; // { halo, dot, t0 } — pins currently animating their arrival flare
    const GLOW_MS = 1600;
```

- [ ] **Step 2: Add `glowLastPin` + `updateGlows` to the `window.__globe` object**

Find the `clearPins() { ... }` method (~line 1251). Immediately after its closing `},` insert:

```javascript
      // Flare the most-recently-added pin so an arriving ping catches the eye.
      glowLastPin() {
        const p = presencePins[presencePins.length - 1];
        if (!p) return;
        glowing.push({ halo: p.halo, dot: p.mesh, t0: performance.now() });
      },
      // Called every frame from tick(); advances + retires arrival flares.
      updateGlows() {
        if (!glowing.length) return;
        const now = performance.now();
        for (let i = glowing.length - 1; i >= 0; i--) {
          const gobj = glowing[i];
          const k = (now - gobj.t0) / GLOW_MS; // 0 → 1
          if (k >= 1) {
            // Settle back to the resting look.
            gobj.halo.scale.setScalar(1);
            gobj.halo.material.opacity = 0.18;
            glowing.splice(i, 1);
            continue;
          }
          // Ease-out flare: big bright halo that shrinks/fades to rest.
          const ease = 1 - Math.pow(1 - k, 3);
          const scale = 1 + (1 - ease) * 4;      // starts 5×, ends 1×
          gobj.halo.scale.setScalar(scale);
          gobj.halo.material.opacity = 0.18 + (1 - ease) * 0.55; // 0.73 → 0.18
        }
      },
```

(Note: `clearPins()` must also empty `glowing` — without it, a glow holds a disposed material. Update `clearPins` to add `glowing.length = 0;` as its last line, before the closing `}`.)

- [ ] **Step 3: Update `clearPins()` to drop in-flight glows**

Find inside `clearPins()`:

```javascript
        presencePins.length = 0;
      },
```

Replace with:

```javascript
        presencePins.length = 0;
        glowing.length = 0;
      },
```

- [ ] **Step 4: Call `updateGlows()` from the tick loop**

Find (~line 1486):

```javascript
      /* Let the presence layer reposition its open tooltip as the globe spins. */
      if (typeof window.__globe.onFrame === "function") window.__globe.onFrame();
```

Add directly above that block:

```javascript
      /* Advance any arrival-glow flares on freshly-dropped pins. */
      window.__globe.updateGlows();
```

- [ ] **Step 5: Verify the page still parses + globe initializes (headless smoke)**

Create `live-globe/_smoke.mjs`:

```javascript
import { chromium } from 'playwright';
const root = '/home/ubuntu/.cache/ms-playwright';
// Resolve the cached chromium build dir.
import { readdirSync } from 'fs';
const dir = readdirSync(root).find(d => d.startsWith('chromium-'));
const exe = `${root}/${dir}/chrome-linux/chrome`;
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
await p.goto('file:///home/ubuntu/projects/vibe-demos/live-globe/index.html');
await p.waitForTimeout(1500);
const hasGlobe = await p.evaluate(() => !!(window.__globe && typeof window.__globe.glowLastPin === 'function' && typeof window.__globe.updateGlows === 'function'));
const hasPresence = await p.evaluate(() => !!(window.__presence));
await b.close();
console.log('pageerrors:', errors);
console.log('globe bridge + glow methods present:', hasGlobe);
console.log('presence module present:', hasPresence);
if (errors.length || !hasGlobe || !hasPresence) { console.log('SMOKE FAIL'); process.exit(1); }
console.log('SMOKE OK');
```

Run:

```bash
cd /home/ubuntu/projects/vibe-demos/live-globe
node _smoke.mjs
```

Expected: `globe bridge + glow methods present: true`, `presence module present: true`, `SMOKE OK`. (If Playwright isn't installed as a node module, run `npm_config_yes=true npx --yes playwright@1.48 install-deps` is NOT allowed — instead `node -e "require.resolve('playwright')"`; if it throws, install locally with `cd /tmp && npm i playwright@1.48` and set `NODE_PATH=/tmp/node_modules`. Do not add playwright to the repo.)

- [ ] **Step 6: Commit (smoke file NOT yet committed)**

```bash
cd /home/ubuntu/projects/vibe-demos
git add live-globe/index.html
git commit -m "live-globe: arrival-glow flare for freshly-dropped pins (glowLastPin + per-frame decay)"
```

---

## Task 3: Wire PocketBase realtime subscription into the presence module

Now connect `addRecord` to live `create` events. Subscribe after a successful `refresh()`; unsubscribe on page hide to be tidy. The SDK auto-reconnects — no manual polling.

**Files:**
- Modify: `live-globe/index.html` (presence module — `init`/`refresh` area ~lines 2276–2317, and the `window.__presence` export ~line 2372)

- [ ] **Step 1: Add subscribe/unsubscribe functions after `refresh()` (~line 2317)**

Insert immediately after the closing `}` of `refresh()`:

```javascript
    let _sub = null; // unsubscribe fn returned by pb.subscribe

    // Subscribe to live create events. Each new record is added incrementally
    // (addRecord de-dupes our own echoed create). PB SDK auto-reconnects; we do
    // NOT poll. Safe to call repeatedly — it no-ops if already subscribed.
    async function subscribeLive() {
      if (_sub) return;
      try {
        const c = await getPB();
        if (!c) return;
        _sub = await c.collection(COLLECTION).subscribe("*", (e) => {
          if (e.action !== "create" || !e.record) return;
          const r = e.record;
          // Coerce lat/lon to numbers (PB returns numbers already, but be safe).
          addRecord({
            id: r.id, city: r.city, note: r.note,
            lat: +r.lat, lon: +r.lon, player_id: r.player_id, created: r.created
          });
          bumpActivity(); // defined in Task 4
        });
      } catch (e) { _sub = null; }
    }

    function unsubscribeLive() {
      if (_sub) { try { _sub(); } catch (e) {} _sub = null; }
    }
```

> NOTE: `bumpActivity()` is added in Task 4. Until then this references an undefined function. To keep Task 3 independently runnable, define a temporary no-op now and replace it in Task 4: add `function bumpActivity() {}` directly above `subscribeLive`. Task 4 Step 1 will replace that stub with the real implementation.

- [ ] **Step 2: Add the temporary `bumpActivity` stub**

Directly above the `let _sub = null;` line you just added, insert:

```javascript
    function bumpActivity() {} // replaced in Task 4 with real activity-count logic
```

- [ ] **Step 3: Call `subscribeLive()` after a successful refresh in `init()`**

Find in `init()` (~line 2296):

```javascript
      const ok = await checkHealth();
      setOnline(ok);
      if (ok) { await refresh(); }
      else if (!mine.length) { renderAll([]); }
```

Replace with:

```javascript
      const ok = await checkHealth();
      setOnline(ok);
      if (ok) { await refresh(); await subscribeLive(); }
      else if (!mine.length) { renderAll([]); }
```

- [ ] **Step 4: Unsubscribe when the page is hidden/unloaded**

Find the `window.__presence = {...}` export (~line 2372) and insert directly ABOVE it:

```javascript
    // Tidy up the realtime connection when the tab goes away. (No reconnect
    // polling; the SDK reconnects on its own while the page is alive.)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") unsubscribeLive();
      else if (online) subscribeLive();
    });
    window.addEventListener("pagehide", unsubscribeLive);
```

- [ ] **Step 5: Expose sub controls on the debug handle**

Find:

```javascript
    window.__presence = { getPB, refresh, get online() { return online; }, playerId };
```

Replace with:

```javascript
    window.__presence = { getPB, refresh, subscribeLive, unsubscribeLive, addRecord, get online() { return online; }, playerId };
```

- [ ] **Step 6: Syntax-check the module**

```bash
cd /home/ubuntu/projects/vibe-demos
node -e "const fs=require('fs');const h=fs.readFileSync('live-globe/index.html','utf8');const blocks=h.split('<script type=\"module\">');const m=blocks[blocks.length-1].split('</script>')[0];fs.writeFileSync('/tmp/lg-mod.mjs', m.replace(/import\((PB_ESM)\)/,'Promise.resolve({default:class{}})'));" && node --check /tmp/lg-mod.mjs && echo "SYNTAX OK"
```

Expected: `SYNTAX OK`.

- [ ] **Step 7: Live realtime smoke — two pages, one sees the other's pin**

This verifies the whole point. It hits the real backend (`https://live-globe.pb.gurum.se`). Append to a new `live-globe/_smoke2.mjs`:

```javascript
import { chromium } from 'playwright';
import { readdirSync } from 'fs';
const root = '/home/ubuntu/.cache/ms-playwright';
const dir = readdirSync(root).find(d => d.startsWith('chromium-'));
const exe = `${root}/${dir}/chrome-linux/chrome`;
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const url = 'file:///home/ubuntu/projects/vibe-demos/live-globe/index.html';
const a = await b.newPage(); await a.goto(url); await a.waitForTimeout(2500);
const c = await b.newPage(); await c.goto(url); await c.waitForTimeout(2500);
const onlineA = await a.evaluate(() => window.__presence.online);
console.log('page A online:', onlineA);
if (!onlineA) { console.log('BACKEND OFFLINE — realtime path not exercised (local-first still OK)'); await b.close(); process.exit(0); }
// Count B's records before, then have A drop a uniquely-named pin.
const tag = 'SMOKE-' + Math.floor(performance.now());
const before = await c.evaluate(() => window.__presence && document.querySelectorAll('#pList li').length);
await a.evaluate((t) => window.__presence.addRecord({ id: t, city: t, note: 'rt', lat: 10, lon: 10, player_id: 'smoke' }), tag);
// Real cross-client check: create via A's pb, expect B's subscription to insert it.
await a.evaluate(async (t) => { const c = await window.__presence.getPB(); await c.collection('globe_ping').create({ city: t, note: 'rt', lat: 11, lon: 11, player_id: 'smoke-'+t }); }, tag);
await c.waitForTimeout(2500);
const sawIt = await c.evaluate((t) => [...document.querySelectorAll('#pList .p-city')].some(el => el.textContent === t), tag);
await b.close();
console.log('page B saw page A\\'s live pin:', sawIt);
if (!sawIt) { console.log('SMOKE2 FAIL'); process.exit(1); }
console.log('SMOKE2 OK');
```

Run:

```bash
cd /home/ubuntu/projects/vibe-demos/live-globe
node _smoke2.mjs
```

Expected: `page A online: true` then `page B saw page A's live pin: true`, `SMOKE2 OK`. If the backend is offline it prints the local-first note and exits 0 (acceptable — realtime can't be exercised, but the page didn't break).

- [ ] **Step 8: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add live-globe/index.html
git commit -m "live-globe: subscribe to realtime create events; pins from others drop in live"
```

---

## Task 4: Soft "recent activity" count in the panel header

Add an honest, understated count of recent pin activity (not a fake live-connection number — see spec §10). It counts records with `created` in the last 5 minutes, plus increments live as new pins arrive.

**Files:**
- Modify: `live-globe/index.html` — panel header DOM (~line 919), a CSS rule (~line 618 area), and the presence module (`bumpActivity`, `recentCount`, called from `refresh`/`addRecord`).

- [ ] **Step 1: Add the count element to the panel header**

Find (~lines 919–920):

```html
      <span class="p-title"><span class="pdot" aria-hidden="true"></span>Who's looking right now</span>
      <span class="p-status" id="pStatus">○ local</span>
```

Replace with:

```html
      <span class="p-title"><span class="pdot" aria-hidden="true"></span>Who's looking right now</span>
      <span class="p-activity" id="pActivity" aria-live="polite" hidden></span>
      <span class="p-status" id="pStatus">○ local</span>
```

- [ ] **Step 2: Add a CSS rule for `.p-activity`**

Find the `.presence .p-head .p-title {` rule (~line 618) and insert this rule directly before it:

```css
    .presence .p-head .p-activity {
      font-size: 11px;
      color: var(--accent, #ffb37a);
      opacity: 0.85;
      margin-left: auto;
      margin-right: 10px;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
```

- [ ] **Step 3: Replace the `bumpActivity` stub with real logic**

In the presence module, find the stub from Task 3:

```javascript
    function bumpActivity() {} // replaced in Task 4 with real activity-count logic
```

Replace with:

```javascript
    const pActivity = $id("pActivity");
    const ACTIVITY_WINDOW_MS = 5 * 60 * 1000; // "recent" = last 5 minutes

    // Count records whose `created` falls within the recent window. PB `created`
    // is an ISO-ish string ("2026-06-06 03:13:59.377Z"); Date can parse it.
    function recentCount() {
      const now = Date.now();
      let n = 0;
      for (const r of allRecords) {
        if (!r.created) continue;
        const t = Date.parse(r.created.replace(" ", "T"));
        if (!Number.isNaN(t) && now - t <= ACTIVITY_WINDOW_MS) n++;
      }
      return n;
    }

    function renderActivity() {
      const n = recentCount();
      if (!online || n <= 0) { pActivity.hidden = true; pActivity.textContent = ""; return; }
      pActivity.hidden = false;
      pActivity.textContent = `${n} recently active`;
    }

    // Called when a live pin arrives — re-derive the count from current records.
    function bumpActivity() { renderActivity(); }
```

- [ ] **Step 4: Call `renderActivity()` after `refresh()` populates records**

Find in `refresh()` (~line 2312):

```javascript
        const items = recs.items || [];
        renderAll(items.length ? items : localPins());
```

Replace with:

```javascript
        const items = recs.items || [];
        renderAll(items.length ? items : localPins());
        renderActivity();
```

- [ ] **Step 5: Syntax-check**

```bash
cd /home/ubuntu/projects/vibe-demos
node -e "const fs=require('fs');const h=fs.readFileSync('live-globe/index.html','utf8');const blocks=h.split('<script type=\"module\">');const m=blocks[blocks.length-1].split('</script>')[0];fs.writeFileSync('/tmp/lg-mod.mjs', m.replace(/import\((PB_ESM)\)/,'Promise.resolve({default:class{}})'));" && node --check /tmp/lg-mod.mjs && echo "SYNTAX OK"
```

Expected: `SYNTAX OK`.

- [ ] **Step 6: Headless check — activity element exists and is wired**

Reuse the smoke harness. Run:

```bash
cd /home/ubuntu/projects/vibe-demos/live-globe
node -e "import('playwright').then(async ({chromium})=>{const {readdirSync}=await import('fs');const root='/home/ubuntu/.cache/ms-playwright';const dir=readdirSync(root).find(d=>d.startsWith('chromium-'));const b=await chromium.launch({executablePath:root+'/'+dir+'/chrome-linux/chrome',args:['--no-sandbox']});const p=await b.newPage();await p.goto('file:///home/ubuntu/projects/vibe-demos/live-globe/index.html');await p.waitForTimeout(1500);const ok=await p.evaluate(()=>!!document.getElementById('pActivity'));await b.close();console.log('pActivity present:',ok);process.exit(ok?0:1);})"
```

Expected: `pActivity present: true`.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add live-globe/index.html
git commit -m "live-globe: soft 'N recently active' count from recent pin timestamps"
```

---

## Task 5: Reduced-motion guard + SW cache bump + cleanup

Honor `prefers-reduced-motion` for the new glow (CLAUDE.md loading-states rule), bump the SW cache so the change deploys, and remove the temporary smoke files.

**Files:**
- Modify: `live-globe/index.html` (globe bridge `glowLastPin`)
- Modify: `live-globe/sw.js` (line 2)
- Delete: `live-globe/_smoke.mjs`, `live-globe/_smoke2.mjs`

- [ ] **Step 1: Make `glowLastPin` respect reduced-motion**

Find the `glowLastPin()` method added in Task 2:

```javascript
      glowLastPin() {
        const p = presencePins[presencePins.length - 1];
        if (!p) return;
        glowing.push({ halo: p.halo, dot: p.mesh, t0: performance.now() });
      },
```

Replace with:

```javascript
      glowLastPin() {
        const p = presencePins[presencePins.length - 1];
        if (!p) return;
        // Respect reduced-motion: skip the animated flare, just nudge opacity.
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          p.halo.material.opacity = 0.35;
          return;
        }
        glowing.push({ halo: p.halo, dot: p.mesh, t0: performance.now() });
      },
```

- [ ] **Step 2: Bump the SW cache version**

In `live-globe/sw.js`, find line 2:

```javascript
const CACHE = "vibe-live-globe-v6";
```

Replace with:

```javascript
const CACHE = "vibe-live-globe-v7";
```

- [ ] **Step 3: Delete the temporary smoke files**

```bash
cd /home/ubuntu/projects/vibe-demos/live-globe
rm -f _smoke.mjs _smoke2.mjs
```

- [ ] **Step 4: Final syntax check + confirm no smoke files staged**

```bash
cd /home/ubuntu/projects/vibe-demos
node -e "const fs=require('fs');const h=fs.readFileSync('live-globe/index.html','utf8');const blocks=h.split('<script type=\"module\">');const m=blocks[blocks.length-1].split('</script>')[0];fs.writeFileSync('/tmp/lg-mod.mjs', m.replace(/import\((PB_ESM)\)/,'Promise.resolve({default:class{}})'));" && node --check /tmp/lg-mod.mjs && echo "SYNTAX OK"
git status --short live-globe/
```

Expected: `SYNTAX OK`; `git status` shows only `live-globe/index.html` and `live-globe/sw.js` modified, no `_smoke*.mjs`.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/projects/vibe-demos
git add live-globe/index.html live-globe/sw.js
git commit -m "live-globe: reduced-motion guard for arrival glow + SW cache v7"
```

---

## Task 6: Manual verification checklist (human/agent, against the real backend)

No code — confirm the feature actually works end-to-end before declaring done.

- [ ] **Step 1: Open two browser windows** to `live-globe/index.html` (locally via `file://` or the deployed URL). Confirm both show `● live` in the panel header.
- [ ] **Step 2:** In window A, type a city (e.g. "Lisbon") and drop a pin. Within ~1–2s, window B shows the pin **appear on the globe with a glow** and a new list row — **without reloading**.
- [ ] **Step 3:** Confirm the `N recently active` count appears and increments as pins drop.
- [ ] **Step 4: Offline degradation** — in DevTools, block `live-globe.pb.gurum.se` (or disconnect). Reload: the page still loads, shows `○ local`, your local pins render, the activity count is hidden, and dropping a pin saves locally with "Saved locally (offline)." No console errors, no spinner hang.
- [ ] **Step 5: Reduced motion** — enable OS "reduce motion", reload, drop a pin: it appears without the animated flare.

---

## Self-Review notes (already applied)

- **Spec §2 coverage:** realtime pin drops (Tasks 1–3), arrival glow (Task 2), soft presence count (Task 4), reduced-motion (Task 5), local-first preserved (Task 6 step 4). All three spec sub-points covered.
- **No reconnection polling:** only `subscribe()` + SDK auto-reconnect; visibility handler re-subscribes on show but does not poll. ✓
- **Type consistency:** `addRecord`, `recKey`, `glowLastPin`, `updateGlows`, `glowing`, `bumpActivity`, `renderActivity`, `recentCount`, `_sub` used consistently across tasks. `glowLastPin` is referenced in Task 1 (guarded by `typeof`) and defined in Task 2 — ordering is safe because it's a runtime call, not load-time.
- **No placeholders:** every step has concrete code/commands. The Task 3 forward-reference to `bumpActivity` is resolved by an explicit stub (Task 3 Step 2) replaced in Task 4 Step 3.
- **CLAUDE.md compliance:** no build tool, no package.json added (playwright installed to /tmp if needed, never to the repo); SW cache bumped; XSS-safe rendering preserved; cross-origin PB fetch already skipped by SW.
```
