# Tinywings Shared Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared, persistent distance leaderboard to the tinywings demo, backed by PocketBase, that ranks players' best run distances while keeping the game fully playable when the backend is unreachable.

**Architecture:** A new PocketBase `leaderboard` collection (Tier 1 public) stores `{name, score, player_id}` records. The frontend adds a self-contained `<script type="module">` to `tinywings/index.html` that imports the PocketBase ESM SDK, does a one-time health check, reveals a submit field on the end panel only when the player beats their personal best, and opens a cream/pencil overlay (fetch-on-open) showing the top 25. All PB access is wrapped so the game loop never awaits or gates on the backend.

**Tech Stack:** Static HTML/CSS/JS (no build step), PocketBase `@0.25.0` via CDN ESM import, `localStorage` for identity/name, GitHub Pages for the frontend, `sync-backends.sh` for backend deploy (human-operated).

---

## Verification context (no test framework)

This repo has **no test runner** — demos are plain static files. "Tests" here are
manual verification steps run against the file or a local static server. Where a
step says "verify", it means open the page / run the curl / inspect the DOM, not
run a unit-test command. Keep changes small and verify after each.

A simple local server for manual checks:
```bash
cd /home/ubuntu/projects/vibe-demos && python3 -m http.server 8000
# then load http://localhost:8000/tinywings/
```

## File structure

- **Create** `tinywings/pb/pb_migrations/001_init_leaderboard.js` — PocketBase
  migration defining the `leaderboard` collection (source of truth for schema).
- **Modify** `backends/config.json` — register `"tinywings": { "port": 8091 }`.
- **Modify** `tinywings/index.html` — importmap, overlay markup, end-panel submit
  block, CSS, and a new `<script type="module">` with all PB logic.
- **Modify** `tinywings/sw.js` — explicit cross-origin skip + bump cache version.

The PB logic is intentionally isolated in its own module script so it can be
held in context as one unit and reasoned about independently of the ~2000-line
game script (which is a classic `<script>` using a global `G`).

---

## Task 1: Backend migration + port registration

**Files:**
- Create: `tinywings/pb/pb_migrations/001_init_leaderboard.js`
- Modify: `backends/config.json`

- [ ] **Step 1: Write the migration file**

Create `tinywings/pb/pb_migrations/001_init_leaderboard.js` with exactly:

```js
// tinywings/pb/pb_migrations/001_init_leaderboard.js
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "leaderboard",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "name", required: true, max: 20 },
      { type: "number", name: "score", required: true, min: 0 },
      { type: "text", name: "player_id" },
    ],
  });
  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("leaderboard");
  app.delete(collection);
});
```

- [ ] **Step 2: Register the port in config.json**

Modify `backends/config.json` — change the empty `"backends": {}` to:

```json
  "backends": {
    "tinywings": { "port": 8091 }
  }
```

(8091 is the first port per CLAUDE.md; ports increment and are never reused.)

- [ ] **Step 3: Verify config is valid JSON**

Run: `jq . backends/config.json`
Expected: pretty-prints the object with `tinywings.port == 8091`, no parse error.

- [ ] **Step 4: Verify migration file shape**

Run: `node --check tinywings/pb/pb_migrations/001_init_leaderboard.js 2>&1 || echo "note: migrate() is a PB global, ReferenceError at top level is expected; --check only validates syntax"`
Expected: `node --check` validates SYNTAX only (it does not execute), so it should
pass silently. `migrate`/`Collection` are PocketBase-provided globals — do not add
imports for them.

- [ ] **Step 5: Commit**

```bash
git add tinywings/pb/pb_migrations/001_init_leaderboard.js backends/config.json
git commit -m "tinywings: add leaderboard PocketBase collection + register backend port"
```

> **DEPLOY GATE (human, not agent):** After this commit, the human runs
> `./sync-backends.sh` from the dev box to create the collection on the server,
> then confirms at `https://tinywings.pb.gurum.se/_/`. The agent does NOT run the
> deploy. The frontend tasks below are written to degrade gracefully if the
> backend is not yet live, so they can be built/committed before the deploy
> completes — but full end-to-end verification (Task 7) requires the deploy.

---

## Task 2: Importmap + leaderboard module skeleton (health check + identity)

**Files:**
- Modify: `tinywings/index.html` (head importmap; new module script before `</body>`)

- [ ] **Step 1: Add the importmap to `<head>`**

In `tinywings/index.html`, immediately after the `<meta apple-mobile-web-app-title>`
line (currently line 21) and before the `<link rel="preconnect">` block, insert:

```html

  <script type="importmap">
    { "imports": { "pocketbase": "https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs" } }
  </script>
```

- [ ] **Step 2: Add the module skeleton before `</body>`**

The file ends with `  </script>\n</body>\n</html>` (the game's classic script
closes at line ~3037). Immediately before `</body>`, insert a new module script:

```html
  <script type="module">
    /* ============================================================
       LEADERBOARD (PocketBase, Tier 1 public)
       Isolated from the game script. Communicates only via the
       global window.G state (distance) and the DOM. The game never
       awaits PocketBase — this layer is purely additive.

       Collection: leaderboard (base)  — https://tinywings.pb.gurum.se/_/
         name      (text, required, max 20)
         score     (number, required, min 0)
         player_id (text)   ← anonymous UUID, used only to highlight "you"
         Rules: list="" view="" create="" update=null delete=null
       ============================================================ */
    import PocketBase from "pocketbase";

    const PB_URL = "https://tinywings.pb.gurum.se";
    const pb = new PocketBase(PB_URL);
    let online = false;

    // Anonymous identity — NOT access control (rules are public). Used only
    // to highlight the player's own rows in the overlay.
    function playerId() {
      let id = null;
      try { id = localStorage.getItem("vibe.tinywings.player-id"); } catch (e) {}
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID()
              : String(Date.now()) + "-" + Math.round(performance.now()));
        try { localStorage.setItem("vibe.tinywings.player-id", id); } catch (e) {}
      }
      return id;
    }
    function rememberedName() {
      try { return localStorage.getItem("vibe.tinywings.name") || ""; } catch (e) { return ""; }
    }

    // One-time, best-effort. No reconnection polling (per CLAUDE.md).
    async function checkHealth() {
      try { await pb.health.check(); online = true; }
      catch (e) { online = false; }
      return online;
    }
    checkHealth();

    // Exposed so later steps (and quick console checks) can reach them.
    window.__lb = { pb, playerId, rememberedName, get online() { return online; }, checkHealth };
  </script>
```

- [ ] **Step 3: Verify the module loads without errors**

Start the local server (see Verification context), load `http://localhost:8000/tinywings/`,
open DevTools console.
Expected: no module/import errors. `window.__lb` is defined. `window.__lb.playerId()`
returns a UUID and a second call returns the SAME value (persisted).
`localStorage["vibe.tinywings.player-id"]` is set. With the backend not yet
deployed, `window.__lb.online` is `false` after a moment (health check fails
quietly, no uncaught rejection).

- [ ] **Step 4: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: add PocketBase importmap + leaderboard module skeleton (health/identity)"
```

---

## Task 3: End-panel submit block — markup + CSS

**Files:**
- Modify: `tinywings/index.html` (end-panel markup ~line 996-1005; CSS near the
  `.end-panel` rules ~line 555-584)

- [ ] **Step 1: Add the submit block markup inside the end panel**

The end panel currently is (lines 996-1005):

```html
    <div class="end-panel" id="endPanel">
      <h2>the day ends</h2>
      <div class="sub" id="endReason">DAY 1 COMPLETE</div>
      <div class="lines">
        you flew <span class="num" id="endDist">0</span> m<br>
        with <span class="num" id="endPerfect">0</span> perfect launches<br>
        <span id="endNewBest" style="display:none">— a new best —</span>
      </div>
      <button id="restartBtn">begin again</button>
    </div>
```

Insert the submit block AFTER the `</div>` closing `.lines` and BEFORE
`<button id="restartBtn">`:

```html
      <div class="lb-submit" id="lbSubmit" hidden>
        <input id="lbName" type="text" maxlength="20" placeholder="your name"
               autocomplete="off" autocapitalize="words" spellcheck="false"
               aria-label="your name for the leaderboard">
        <button type="button" id="lbSubmitBtn">submit to leaderboard</button>
        <div class="lb-note" id="lbSubmitNote" role="status" aria-live="polite"></div>
      </div>
```

- [ ] **Step 2: Add CSS for the submit block**

After the `.end-panel button:hover` rule (line 584), insert:

```css
    .end-panel .lb-submit { margin-top: 14px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .end-panel .lb-submit[hidden] { display: none; }
    .end-panel .lb-submit input {
      appearance: none; border: 1px dashed var(--ink-soft); background: var(--paper-2);
      font-family: "Caveat", cursive; font-size: 20px; color: var(--ink);
      padding: 4px 12px; text-align: center; width: min(220px, 70vw);
    }
    .end-panel .lb-submit input:focus { outline: none; border-color: var(--bloom); }
    .end-panel .lb-note { font-family: "JetBrains Mono", monospace; font-size: 10px; letter-spacing: 0.12em; color: var(--muted); text-transform: uppercase; min-height: 12px; }
```

- [ ] **Step 3: Verify markup renders (no behavior yet)**

Reload the page. The submit block is `hidden`, so it does NOT appear on the end
panel yet. Confirm there are no layout shifts and no console errors. (Behavior is
wired in Task 5.) Optionally toggle in console:
`document.getElementById('lbSubmit').hidden = false` → the input + button appear
styled in the pencil aesthetic inside the end panel; restore with `= true`.

- [ ] **Step 4: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: add (hidden) end-panel leaderboard submit block + styles"
```

---

## Task 4: Leaderboard overlay — markup, CSS, topbar link

**Files:**
- Modify: `tinywings/index.html` (topbar ~line 709; overlay markup near end-panel;
  CSS)

- [ ] **Step 1: Add the topbar link before `← Studio`**

The topbar currently ends (line 709) with:

```html
      <a class="back" href="../">← Studio</a>
```

Insert a button immediately BEFORE that line:

```html
      <button class="back lb-open" id="lbOpenBtn" type="button">leaderboard</button>
```

- [ ] **Step 2: Add `.lb-open` button reset + overlay CSS**

After the `.back:hover` rule (line 170), insert:

```css
    button.back.lb-open { appearance: none; background: transparent; cursor: pointer; }

    /* Leaderboard overlay */
    .lb-overlay {
      position: absolute; inset: 0; z-index: 8;
      display: none; align-items: center; justify-content: center;
      background: rgba(42, 38, 29, 0.34);
      padding: 20px;
    }
    .lb-overlay.live { display: flex; }
    .lb-card {
      background: var(--paper); border: 1px dashed var(--ink-soft);
      box-shadow: 0 12px 30px rgba(42,38,29,0.18);
      width: min(420px, 92vw); max-height: 82vh; overflow: hidden;
      display: flex; flex-direction: column;
      padding: 20px 22px; transform: rotate(-0.6deg);
    }
    .lb-card h2 { font-family: "Fraunces", serif; font-style: italic; font-weight: 400; font-size: 24px; margin: 0 0 2px; color: var(--ink); }
    .lb-status { font-family: "JetBrains Mono", monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
    .lb-status .dot { color: var(--bloom-2); }
    .lb-status.off .dot { color: var(--muted); }
    .lb-list { list-style: none; margin: 0; padding: 0; overflow-y: auto; font-family: "Caveat", cursive; }
    .lb-list li { display: grid; grid-template-columns: 2.2em 1fr auto; gap: 10px; align-items: baseline; padding: 5px 4px; border-bottom: 1px dashed var(--line); font-size: 20px; color: var(--ink-soft); }
    .lb-list li .rank { color: var(--muted); font-family: "JetBrains Mono", monospace; font-size: 12px; }
    .lb-list li .who { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lb-list li .dist { color: var(--bloom); font-style: italic; }
    .lb-list li.me { background: var(--paper-2); }
    .lb-list li.me .who::after { content: " · you"; color: var(--bloom); font-size: 14px; }
    .lb-empty { font-family: "Caveat", cursive; font-size: 20px; color: var(--muted); padding: 14px 4px; }
    .lb-close { align-self: flex-end; margin-top: 14px; appearance: none; border: 1px dashed var(--ink-soft); background: transparent; font-family: "Caveat", cursive; font-size: 20px; color: var(--ink); padding: 4px 18px; cursor: pointer; }
    .lb-close:hover { background: var(--ink); color: var(--paper); }
    /* Loading shimmer — pencil-stroke placeholder rows */
    .lb-list li.skel { color: transparent; border-bottom-color: var(--line); }
    .lb-list li.skel .bar { grid-column: 1 / -1; height: 14px; border-radius: 7px;
      background: linear-gradient(90deg, var(--paper-2) 0%, rgba(201,126,96,0.18) 50%, var(--paper-2) 100%);
      background-size: 200% 100%; animation: lbShimmer 1.1s linear infinite; }
    @keyframes lbShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) {
      .lb-list li.skel .bar { animation: none; background: var(--paper-2); }
    }
```

- [ ] **Step 3: Add the overlay markup**

Immediately AFTER the end-panel `</div>` (the one closing `#endPanel`, currently
line 1005) and before the closing `</div>` of `.stage`, insert:

```html
    <div class="lb-overlay" id="lbOverlay" role="dialog" aria-modal="true" aria-label="Leaderboard">
      <div class="lb-card">
        <h2>longest glides</h2>
        <div class="lb-status off" id="lbStatus"><span class="dot">○</span> <span id="lbStatusText">connecting…</span></div>
        <ul class="lb-list" id="lbList"></ul>
        <button type="button" class="lb-close" id="lbCloseBtn">close</button>
      </div>
    </div>
```

- [ ] **Step 4: Verify the overlay opens/closes via console (no fetch wiring yet)**

Reload. In console: `document.getElementById('lbOverlay').classList.add('live')`
→ the cream card appears centered with the title and a `○ connecting…` status.
`...remove('live')` hides it. Confirm no console errors and the topbar shows a
`leaderboard` link styled like `← Studio`. (Button wiring + fetch come in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: add leaderboard overlay markup, styles, and topbar link"
```

---

## Task 5: Wire the submit flow (reveal on personal best, create record)

**Files:**
- Modify: `tinywings/index.html` — the `endRun` function (`#endNewBest` handling at
  line 2209) and the leaderboard module script from Task 2.

- [ ] **Step 1: Expose the run result from `endRun` to the module**

In the game script's `endRun`, the line (2209) is currently:

```js
      const endNewBest = $("endNewBest"); if (endNewBest) endNewBest.style.display = newBest ? "" : "none";
```

Immediately AFTER that line, insert a hook call:

```js
      // Notify the leaderboard layer (module script). Fire-and-forget; the
      // game never depends on it. window.__lbOnEnd is defined by the module.
      try { if (window.__lbOnEnd) window.__lbOnEnd({ distM, newBest }); } catch (e) {}
```

(`distM` and `newBest` are already in scope at this point in `endRun`.)

- [ ] **Step 2: Implement `__lbOnEnd` + submit handler in the module**

In the leaderboard `<script type="module">`, append (inside the module, after the
`window.__lb = …` line):

```js
    const $id = (id) => document.getElementById(id);

    function setSubmitNote(msg) { const n = $id("lbSubmitNote"); if (n) n.textContent = msg || ""; }

    // Called by the game's endRun. Reveal the submit field only on a genuine
    // new personal best AND when we have a backend. Otherwise keep it hidden —
    // the existing "— a new best —" line still shows (local-first, unchanged).
    window.__lbOnEnd = function ({ distM, newBest }) {
      const block = $id("lbSubmit");
      if (!block) return;
      block.dataset.score = String(Math.max(0, Math.round(distM || 0)));
      const eligible = !!newBest && online && (distM | 0) > 0;
      block.hidden = !eligible;
      if (eligible) {
        const input = $id("lbName");
        if (input && !input.value) input.value = rememberedName();
        setSubmitNote("");
        const btn = $id("lbSubmitBtn");
        if (btn) btn.disabled = false;
      }
    };

    async function submitScore() {
      const block = $id("lbSubmit");
      const input = $id("lbName");
      const btn = $id("lbSubmitBtn");
      if (!block || !input || !btn) return;
      const score = parseInt(block.dataset.score || "0", 10) || 0;
      let name = (input.value || "").trim().slice(0, 20);
      if (!name) name = "anon";
      btn.disabled = true;
      setSubmitNote("submitting…");
      try {
        await pb.collection("leaderboard").create({ name, score, player_id: playerId() });
        try { localStorage.setItem("vibe.tinywings.name", name); } catch (e) {}
        lbCacheDirty = true; // overlay refetches next open (Task 6)
        // Compute rank: how many strictly-greater scores exist, +1.
        let rank = null;
        try {
          const better = await pb.collection("leaderboard").getList(1, 1, {
            filter: `score > ${score}`, fields: "id", skipTotal: false,
          });
          rank = (better.totalItems ?? 0) + 1;
        } catch (e) {}
        block.hidden = true;
        setSubmitNote("");
        const note = $id("endNewBest");
        if (note) {
          note.textContent = rank ? `— submitted ✓ you're #${rank} —` : "— submitted ✓ —";
          note.style.display = "";
        }
      } catch (e) {
        online = false;
        btn.disabled = false;
        setSubmitNote("couldn't reach the leaderboard");
      }
    }

    let lbCacheDirty = true; // shared with Task 6
    const _submitBtn = $id("lbSubmitBtn");
    if (_submitBtn) _submitBtn.addEventListener("click", submitScore);
    const _nameInput = $id("lbName");
    if (_nameInput) _nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitScore(); } });
```

> Note: `lbCacheDirty` is declared here and ALSO referenced in Task 6. It must be
> declared exactly once in the module. If Task 6 is implemented first or merged,
> keep a single `let lbCacheDirty = true;` declaration — do not declare it twice.

- [ ] **Step 3: Verify submit reveal logic with backend offline**

Reload (backend not yet deployed → `online` false). Play or force a game-over.
Expected: the submit block stays HIDDEN even on a new best (because `online` is
false), and the original "— a new best —" line shows as before. No console errors.

- [ ] **Step 4: Verify submit reveal logic with `online` forced true (mock)**

In console, before triggering a death: `window.__lb.checkHealth` exists; to test
UI without a server, run:
`window.__lbOnEnd({ distM: 1234, newBest: true })` after manually setting the
module's `online` — since `online` is module-private, instead temporarily test by
opening the end panel and calling `document.getElementById('lbSubmit').hidden=false`
to confirm the button/Enter handlers call `submitScore()` and show
"couldn't reach the leaderboard" (expected while offline). Confirm the name field
pre-fills from `localStorage["vibe.tinywings.name"]` if set.

- [ ] **Step 5: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: wire leaderboard submit flow (reveal on PB, create record, rank)"
```

---

## Task 6: Wire the overlay open + fetch-on-open render

**Files:**
- Modify: `tinywings/index.html` — leaderboard module script.

- [ ] **Step 1: Implement open/close + render in the module**

Append to the leaderboard module (after the submit wiring from Task 5). Do NOT
re-declare `lbCacheDirty` — reuse the one from Task 5:

```js
    let lbCache = null; // last fetched rows

    function renderSkeleton() {
      const list = $id("lbList");
      if (!list) return;
      list.innerHTML = "";
      for (let i = 0; i < 6; i++) {
        const li = document.createElement("li");
        li.className = "skel";
        const bar = document.createElement("span");
        bar.className = "bar";
        li.appendChild(bar);
        list.appendChild(li);
      }
    }

    function setStatus(connected, text) {
      const s = $id("lbStatus"), t = $id("lbStatusText"), d = s ? s.querySelector(".dot") : null;
      if (s) s.classList.toggle("off", !connected);
      if (d) d.textContent = connected ? "●" : "○";
      if (t) t.textContent = text;
    }

    function renderRows(rows) {
      const list = $id("lbList");
      if (!list) return;
      list.innerHTML = "";
      if (!rows || rows.length === 0) {
        const li = document.createElement("li");
        li.className = "lb-empty";
        li.textContent = "no glides logged yet — be the first.";
        list.appendChild(li);
        return;
      }
      const me = playerId();
      rows.forEach((r, i) => {
        const li = document.createElement("li");
        if (r.player_id && r.player_id === me) li.classList.add("me");
        const rank = document.createElement("span"); rank.className = "rank"; rank.textContent = String(i + 1);
        const who = document.createElement("span"); who.className = "who"; who.textContent = r.name || "anon"; // textContent → no XSS
        const dist = document.createElement("span"); dist.className = "dist"; dist.textContent = `${r.score} m`;
        li.appendChild(rank); li.appendChild(who); li.appendChild(dist);
        list.appendChild(li);
      });
    }

    async function loadBoard() {
      if (!online) { await checkHealth(); }
      if (!online) { setStatus(false, "local — leaderboard unavailable"); renderRows([]); return; }
      setStatus(true, "connected");
      if (lbCache && !lbCacheDirty) { renderRows(lbCache); return; }
      renderSkeleton();
      try {
        const rows = await pb.collection("leaderboard").getList(1, 25, { sort: "-score" });
        lbCache = rows.items || [];
        lbCacheDirty = false;
        renderRows(lbCache);
      } catch (e) {
        online = false;
        setStatus(false, "local — leaderboard unavailable");
        renderRows([]);
      }
    }

    function openBoard() { const o = $id("lbOverlay"); if (o) { o.classList.add("live"); loadBoard(); } }
    function closeBoard() { const o = $id("lbOverlay"); if (o) o.classList.remove("live"); }

    const _open = $id("lbOpenBtn"); if (_open) _open.addEventListener("click", openBoard);
    const _close = $id("lbCloseBtn"); if (_close) _close.addEventListener("click", closeBoard);
    const _overlay = $id("lbOverlay");
    if (_overlay) _overlay.addEventListener("click", (e) => { if (e.target === _overlay) closeBoard(); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBoard(); });
```

- [ ] **Step 2: Verify overlay open with backend offline**

Reload (backend offline). Click the `leaderboard` topbar link.
Expected: overlay opens, status shows `○ local — leaderboard unavailable`, and the
list shows "no glides logged yet — be the first." Clicking the backdrop, the
`close` button, or pressing Escape closes it. No console errors. The game behind
the overlay is unaffected.

- [ ] **Step 3: Verify skeleton appears (simulate slow/online)**

Temporarily, in DevTools, you can confirm the shimmer by calling
`window.__lb` helpers are present; full online verification happens in Task 7
after deploy. Confirm `renderSkeleton`-driven rows animate (or are static under
`prefers-reduced-motion`).

- [ ] **Step 4: Commit**

```bash
git add tinywings/index.html
git commit -m "tinywings: wire leaderboard overlay open + fetch-on-open render (top 25)"
```

---

## Task 7: Service worker cross-origin skip + cache bump, end-to-end verify

**Files:**
- Modify: `tinywings/sw.js`

- [ ] **Step 1: Bump the cache version**

In `tinywings/sw.js` line 2, change:

```js
const CACHE = "vibe-tinywings-v39";
```
to:
```js
const CACHE = "vibe-tinywings-v40";
```

- [ ] **Step 2: Add an explicit cross-origin skip to the fetch handler**

The fetch handler starts (line 24-26):

```js
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
```

Immediately after the `if (req.method !== "GET") return;` line, insert:

```js
  // Never intercept cross-origin requests (PocketBase API, CDN ESM) — let them
  // hit the network untouched so leaderboard data is always fresh.
  if (new URL(req.url).origin !== self.location.origin) return;
```

- [ ] **Step 3: Verify SW syntax**

Run: `node --check tinywings/sw.js`
Expected: passes silently (valid syntax).

- [ ] **Step 4: Commit**

```bash
git add tinywings/sw.js
git commit -m "tinywings: SW skips cross-origin (PB/CDN) from cache + bump cache v40"
```

- [ ] **Step 5: End-to-end verification (requires backend deployed — see DEPLOY GATE)**

Preconditions: human has run `./sync-backends.sh` and the collection exists at
`https://tinywings.pb.gurum.se/_/`.

Local check first (`python3 -m http.server 8000`, load `/tinywings/`):
1. Console: `await window.__lb.checkHealth()` → `true` (backend reachable).
2. Open the overlay → status `● connected`, list renders (empty or rows). Skeleton
   shimmer shows briefly while fetching.
3. Play to a new personal best → end panel shows the name field + submit button.
4. Enter a name, submit → block hides, "— submitted ✓ you're #N —" appears, name
   persisted to `localStorage["vibe.tinywings.name"]`.
5. Reopen the overlay → your row appears, highlighted with " · you".
6. DevTools → Application → Service Workers: confirm `vibe-tinywings-v40` is the
   active cache and the PB request is NOT in Cache Storage.
7. Simulate offline (DevTools Network → Offline, or block the PB origin): the game
   still plays; overlay shows `○ local — leaderboard unavailable`; submit block
   stays hidden on a best. No uncaught errors.

- [ ] **Step 6: Deploy verification (after push to `main`)**

After the human pushes to `main` and Pages rebuilds (~30-60s):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://kalleeh.github.io/vibe-demos/tinywings/
```
Expected: `200`. Then load the live URL and repeat the key checks from Step 5
(open board, submit a best, reopen to see your highlighted row).

---

## Task 8: Documentation pass — capture first-integration issues

**Files:**
- Modify: `CLAUDE.md` (only if the running issue log surfaced real doc problems)
- This plan's companion: a short issues summary appended here.

- [ ] **Step 1: Review the running issue log**

Throughout implementation + the first real deploy, an issue log has been kept
(this is the first time the PocketBase backend pattern is exercised end-to-end).
Collect every point of friction: migration format surprises, `sync-backends.sh`
behavior, collection-rule gotchas, SDK version issues, SW caching, CORS/
`anthropic-dangerous`-style headers, the `getList` vs `getFullList` choice, rank
query correctness, etc.

- [ ] **Step 2: Decide which are real doc fixes vs one-offs**

For each logged item, classify: (a) CLAUDE.md is wrong/misleading → fix it;
(b) CLAUDE.md is fine, was operator error → drop; (c) genuinely new guidance worth
adding → add a concise note.

- [ ] **Step 3: Apply targeted CLAUDE.md edits**

Make minimal, surgical edits to the PocketBase section of CLAUDE.md for class (a)
and (c) items only. Do not restructure the section.

- [ ] **Step 4: Commit (only if edits were made)**

```bash
git add CLAUDE.md
git commit -m "docs: fix PocketBase pattern notes from tinywings first-integration learnings"
```

---

## Self-review notes

- **Spec coverage:** metric (Task 1 schema), Tier-1 backend + migration + config
  (Task 1), importmap + PB constant + health check + identity (Task 2), submit-on-
  personal-best with remembered name and no user-editable score (Tasks 3, 5),
  overlay-from-topbar-link + fetch-on-open + top-25 + own-row highlight + textContent
  XSS-safety (Tasks 4, 6), loading shimmer with reduced-motion (Task 4 CSS, Task 6
  render), local-first health/degradation (Tasks 2, 5, 6), SW cross-origin skip +
  cache bump (Task 7), human-operated deploy gate (Task 1 note, Task 7 Step 5).
  Maintenance contract correctly NOT triggered (in-place enhancement) — no works-
  index/README/thumbnail tasks. All spec sections map to a task.
- **Type/name consistency:** module exposes `window.__lb` and `window.__lbOnEnd`;
  `endRun` calls `window.__lbOnEnd({distM, newBest})`. DOM ids consistent across
  tasks: `lbSubmit`, `lbName`, `lbSubmitBtn`, `lbSubmitNote`, `lbOverlay`, `lbList`,
  `lbStatus`, `lbStatusText`, `lbOpenBtn`, `lbCloseBtn`, `endNewBest`. `lbCacheDirty`
  declared once (Task 5) and reused (Task 6) — explicitly flagged to avoid double
  declaration.
- **No placeholders:** every code step shows complete code; verification steps give
  exact commands/expected output. The one model-judgment task (Task 8) is a
  deliberate doc-reflection step, not a code placeholder.
```
