/* clinic-admin — 접수 보드 (PocketBase realtime, local-first fallback) — END-TO-END ENCRYPTED.

   ============================================================
   LIVE SHARED INTAKE BOARD — PocketBase realtime showcase
   Isolated module. The rest of clinic-admin works fully without
   it (local-first); this layer is purely additive.

   ⚠ PURE DEMO DATA. Every card references a PSEUDONYMOUS patient from
   the shared register (core/entities.js Patients): #intake-name is a
   <select> over Patients.list() (P-2026-0142 → "환자 ****0142") plus
   "새 가명 환자". No name is ever typed or stored. Since the security
   pass the card body is nevertheless ENCRYPTED CLIENT-SIDE with the
   workspace master key before it is uploaded, to prove the pattern:
   the server never sees a pid or a summary.

   Collection: intake_card (base) — https://clinic-admin.pb.gurum.se/_/
     ws        (text, required, max 64)  — sha256(workspaceId): routes cards to a workspace,
                                            reveals nothing about it
     payload   (json, max 4096)           — { v:1, iv, ct } AES-GCM over { pid, summary } (older cards: { name, summary })
     status    (text, required, max 12)   — 대기 | 진료중 | 완료 (plaintext: column placement only)
     player_id (text, max 64)             — anonymous UUID, "added by you" marker, NOT auth
     Rules: list="" view="" create="" update="" delete=""   (see pb_migrations/004_intake_e2e.js
            for the residual-risk note and the Tier-3 path)

   Realtime: subscribe('*', …, { filter: ws = <ours> }) — only this
   workspace's rows arrive. Rows that do not decrypt (another
   workspace, tampering, garbage written through the open create rule)
   are hidden and counted: "다른 워크스페이스 카드 N".

   Local mode: cards live in Store key `intake-cards`, which is in the
   SENSITIVE_KEYS policy → AES-GCM envelope in localStorage.

   Supply chain: the PocketBase SDK is fetched, its SHA-384 compared to
   the pinned hash (dynamic import() cannot carry an integrity
   attribute), and only then imported from a blob URL. A mismatch keeps
   the board in local mode.

   i18n: status VALUES stay Korean (server column + Store), only the labels/buttons go through t();
   the fictional seed summaries are sample data and stay Korean on purpose.
   ============================================================ */
import { Toast, esc, todayISO } from "./core/ui.js";
import { t, onLangChange } from "./core/i18n.js";
import { Store, EventBus } from "./core/store.js";
import { Patients } from "./core/entities.js";
import { activateTab } from "./core/nav.js";
import { Session } from "./security/session.js";
import { encryptJSON, decryptJSON, sha256hex, sha384b64, isEnvelope } from "./security/crypto.js";

const PB_URL = "https://clinic-admin.pb.gurum.se";
const PB_ESM = "https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs";
// sha384 of the pinned file above (curl + openssl dgst -sha384 -binary | base64, 2026-09-06)
const PB_ESM_SRI = "sha384-a/4W5e0T7WVUFpuqUhUJju6S/V52zZ0hZpIFQKf4bqCQLKF7ogeoVtWmOpT9U6Fd";
const STATUSES = ["대기", "진료중", "완료"];
const LS_LOCAL = "intake-cards"; // Store key (sensitive → encrypted)
const statusLabel = (st) => t("board.status." + st);

let pb = null, online = false, _pbPromise = null, _sub = null, wsHash = null;

async function loadPBModule() {
  const r = await fetch(PB_ESM, { cache: "force-cache" });
  if (!r.ok) throw new Error("sdk " + r.status);
  const buf = await r.arrayBuffer();
  const got = "sha384-" + await sha384b64(buf);
  if (got !== PB_ESM_SRI) { console.warn("PocketBase SDK integrity mismatch — board stays local", got); throw new Error("sri"); }
  const url = URL.createObjectURL(new Blob([buf], { type: "text/javascript" }));
  try { return await import(url); } finally { URL.revokeObjectURL(url); }
}
function getPB() {
  if (pb) return Promise.resolve(pb);
  if (!_pbPromise) {
    _pbPromise = loadPBModule()
      .then((m) => { pb = new m.default(PB_URL); return pb; })
      .catch(() => { _pbPromise = null; return null; });
  }
  return _pbPromise;
}

// Anonymous identity — NOT access control. Only tags which device
// created a card so the UI can show an "added by you" marker.
function playerId() {
  let id = null;
  try { id = localStorage.getItem("vibe.clinic-admin.player-id"); } catch (e) {}
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID()
          : String(Date.now()) + "-" + Math.round(performance.now()));
    try { localStorage.setItem("vibe.clinic-admin.player-id", id); } catch (e) {}
  }
  return id;
}

const $id = (id) => document.getElementById(id);

/* ── crypto helpers ── */
async function sealCard({ pid, name, summary }) {
  const key = Session.key();
  if (!key) throw Object.assign(new Error("locked"), { code: "locked" });
  const body = { summary: String(summary || "").slice(0, 120) };
  if (pid) body.pid = String(pid).slice(0, 20); else if (name) body.name = String(name).slice(0, 20); // legacy cards only
  return encryptJSON(key, body);
}
// server record → view card | null (cannot decrypt)
async function openRecord(rec) {
  const key = Session.key();
  if (!key || !isEnvelope(rec.payload)) return null;
  try {
    const body = await decryptJSON(key, rec.payload);
    return { id: rec.id, pid: body.pid || "", name: body.name || "", summary: body.summary, status: rec.status, player_id: rec.player_id, created: rec.created };
  } catch { return null; }
}
// Card label: the register alias for a pid ("환자 ****0142"); a pre-entities card still carries its fixed sample name.
const cardLabel = (rec) => rec.pid ? Patients.alias(rec.pid) : (rec.name || t("board.patientFallback"));

// ── Local-first store (used when offline / no backend) — encrypted by Store ──
function loadLocal() { const v = Store.get(LS_LOCAL); return Array.isArray(v) ? v : null; }
function saveLocal(list) { Store.set(LS_LOCAL, list); }
// Seed cards — the shared fictional clinic's pseudonymous patients (same pids as every other tab's sample).
const SEED_PIDS = { "P-2026-0142": ["자보", "교통사고"], "P-2026-0233": [], "P-2026-0301": [] };
function seedCards() {
  return [
    { id: "seed-1", pid: "P-2026-0142", status: "대기",   summary: "교통사고 후 경추 통증 · 자보", player_id: "" },
    { id: "seed-2", pid: "P-2026-0233", status: "대기",   summary: "요통 초진 · 접수 대기", player_id: "" },
    { id: "seed-3", pid: "P-2026-0301", status: "진료중", summary: "오십견 추나 진행 중", player_id: "" }
  ];
}
function ensureSeedPatients() {
  if (!Session.isUnlocked()) return;
  try { for (const [pid, tags] of Object.entries(SEED_PIDS)) Patients.ensure(pid, { tags }); } catch {}
}

/* ── pid picker (#intake-name): every registered pseudonymous patient + "새 가명 환자" ── */
const NEW_PID = "__new";
function renderPicker() {
  const sel = $id("intake-name");
  if (!sel) return;
  const cur = sel.value;
  const list = Session.isUnlocked() ? Patients.list() : [];
  sel.innerHTML = list.map(p => `<option value="${esc(p.pid)}">${esc(p.alias)}${p.tags.length ? ` · ${esc(p.tags.join(", "))}` : ""}</option>`).join("")
    + `<option value="${NEW_PID}">${esc(t("board.newPatient"))}</option>`;
  if (cur && Array.from(sel.options).some(o => o.value === cur)) sel.value = cur; else sel.selectedIndex = 0;
}

// In-memory view model: id -> card (decrypted). `foreign` = rows we could not decrypt.
let cards = new Map();
let records = new Map(); // online: raw server rows by id
let foreign = 0;
let syncKey = "board.syncLocal", syncOn = false; // last sync state, re-painted on language toggle

function setSync(connected, key) {
  syncOn = connected; syncKey = key;
  const s = $id("intake-sync"), tt = $id("intake-sync-text");
  if (s) { s.classList.toggle("on", connected); const d = s.querySelector(".dot"); if (d) d.textContent = connected ? "●" : "○"; }
  if (tt) tt.textContent = t(key);
}
function setForeign(n) {
  foreign = n;
  let el = $id("intake-foreign");
  if (!el) {
    const anchor = $id("intake-sync");
    if (!anchor) return;
    el = document.createElement("span");
    el.className = "intake-foreign"; el.id = "intake-foreign";
    anchor.insertAdjacentElement("afterend", el);
  }
  el.title = t("board.foreignTitle");
  el.hidden = !n;
  el.textContent = n ? t("board.foreign", { n }) : "";
}

function nextStatus(st) {
  const i = STATUSES.indexOf(st);
  return i >= 0 && i < STATUSES.length - 1 ? STATUSES[i + 1] : null;
}

function makeCardEl(rec, flash) {
  const me = playerId();
  const el = document.createElement("div");
  el.className = "intake-card" + (rec.player_id && rec.player_id === me ? " mine" : "") + (flash ? " flash" : "");
  el.dataset.id = rec.id;

  const name = document.createElement("div");
  name.className = "pc-name";
  const nameText = document.createElement("span");
  nameText.textContent = cardLabel(rec); // textContent → no XSS
  name.appendChild(nameText);
  const lockTag = document.createElement("span");
  lockTag.className = "e2e-tag"; lockTag.textContent = "E2E"; lockTag.title = t("board.e2eTitle");
  name.appendChild(lockTag);
  if (rec.player_id && rec.player_id === me) {
    const tag = document.createElement("span");
    tag.className = "mine-tag"; tag.textContent = t("board.mine");
    name.appendChild(tag);
  }
  el.appendChild(name);

  if (rec.summary) {
    const sum = document.createElement("div");
    sum.className = "pc-summary";
    sum.textContent = rec.summary; // textContent → no XSS
    el.appendChild(sum);
  }

  const actions = document.createElement("div");
  actions.className = "pc-actions";
  const nx = nextStatus(rec.status);
  if (nx) {
    const adv = document.createElement("button");
    adv.type = "button"; adv.className = "pc-btn advance";
    adv.textContent = nx === "진료중" ? t("board.startTreatment") : t("board.complete");
    adv.addEventListener("click", () => advanceCard(rec.id));
    actions.appendChild(adv);
  }
  const del = document.createElement("button");
  del.type = "button"; del.className = "pc-btn";
  del.textContent = t("board.remove");
  del.addEventListener("click", () => deleteCard(rec.id));
  actions.appendChild(del);
  if (rec.pid) actions.appendChild(makeMoreMenu(rec));
  el.appendChild(actions);

  return el;
}

/* ⋯ hand-off menu — the card is where a 자보 patient, a certificate request or a 비급여 explanation first shows up, so the
   three 환자 trackers and the AI drawer open from here with the pid as ctx ({ pid, create: true } → editor prefilled).
   지불보증 only for a pid tagged 자보 in the register; the AI note is prefilled with the card summary (no name — the
   summary is sample text, the pid becomes the drawer's alias chip). One menu open at a time; click-away closes. */
const MENU_ITEMS = [
  { key: "guarantee", tab: "tab-guarantee", when: (p) => (p?.tags || []).includes("자보") },
  { key: "docs", tab: "tab-docs" },
  { key: "consent", tab: "tab-consent" },
  { key: "ai", tab: "tab-ai" }
];
function closeMenus(except) { document.querySelectorAll(".pc-menu:not([hidden])").forEach(m => { if (m !== except) { m.hidden = true; m.previousElementSibling?.setAttribute("aria-expanded", "false"); } }); }
document.addEventListener("click", (e) => { if (!e.target.closest?.(".pc-more, .pc-menu")) closeMenus(); });
function makeMoreMenu(rec) {
  const wrap = document.createElement("span");
  wrap.className = "pc-more-wrap";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "pc-btn pc-more"; btn.textContent = "⋯";
  btn.setAttribute("aria-haspopup", "menu"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", t("board.more"));
  const menu = document.createElement("div");
  menu.className = "pc-menu"; menu.hidden = true; menu.setAttribute("role", "menu");
  const p = Patients.get(rec.pid);
  for (const it of MENU_ITEMS) {
    if (it.when && !it.when(p)) continue;
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "menuitem"); b.dataset.menu = it.key;
    b.textContent = t("board.menu." + it.key);
    b.addEventListener("click", () => {
      closeMenus();
      if (it.tab === "tab-ai") activateTab("tab-ai", { prefill: rec.summary || "", pid: rec.pid });
      else activateTab(it.tab, { pid: rec.pid, create: true });
    });
    menu.appendChild(b);
  }
  btn.addEventListener("click", (e) => { e.stopPropagation(); const open = menu.hidden; closeMenus(menu); menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); });
  wrap.appendChild(btn); wrap.appendChild(menu);
  return wrap;
}

function render(flashId) {
  const buckets = { "대기": [], "진료중": [], "완료": [] };
  for (const rec of cards.values()) {
    const st = STATUSES.includes(rec.status) ? rec.status : "대기";
    buckets[st].push(rec);
  }
  for (const st of STATUSES) {
    const col = $id("intake-col-" + st);
    if (!col) continue;
    col.innerHTML = "";
    const list = buckets[st];
    const cnt = document.querySelector('.col-count[data-count="' + st + '"]');
    if (cnt) cnt.textContent = String(list.length);
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "col-empty";
      empty.textContent = st === "대기" ? t("board.emptyWaiting") : (st === "진료중" ? t("board.emptyTreating") : t("board.emptyDone"));
      col.appendChild(empty);
      continue;
    }
    list.forEach((rec) => col.appendChild(makeCardEl(rec, rec.id === flashId)));
  }
}

// Online: rebuild the decrypted view from the raw server rows.
async function rebuildFromRecords(flashId) {
  const next = new Map();
  let bad = 0;
  for (const rec of records.values()) {
    const c = await openRecord(rec);
    if (c) next.set(c.id, c); else bad++;
  }
  cards = next; setForeign(bad); render(flashId);
}

function persistIfLocal() { if (!online) saveLocal(Array.from(cards.values())); }

const toServerBody = async (c) => ({ ws: wsHash, payload: await sealCard(c), status: c.status, player_id: c.player_id || "" });

// ── Mutations: try backend, fall back to local ──
async function advanceCard(id) {
  const rec = cards.get(id);
  if (!rec) return;
  const nx = nextStatus(rec.status);
  if (!nx) return;
  if (online) {
    try {
      const c = await getPB();
      if (!c) throw new Error("sdk");
      await c.collection("intake_card").update(id, { status: nx });
      return; // realtime event re-renders
    } catch (e) { goLocal(); }
  }
  rec.status = nx; cards.set(id, rec); persistIfLocal(); render(id);
}

function undoToast(rec, restore) {
  // Fixed fictional name — still shown redacted-style in the toast to keep the PoC rule visible.
  Toast.withUndo(t("board.removedToast", { status: statusLabel(rec.status) }), restore, "system");
}

async function deleteCard(id) {
  const rec = cards.get(id);
  if (!rec) return;
  const idx = Array.from(cards.keys()).indexOf(id);
  if (online) {
    try {
      const c = await getPB();
      if (!c) throw new Error("sdk");
      await c.collection("intake_card").delete(id);
      // Re-create with the same id (PocketBase accepts a client id that matches
      // its 15-char pattern); if the server refuses, fall back to a fresh id.
      undoToast(rec, async () => {
        const body = await toServerBody(rec);
        const c2 = await getPB();
        if (!c2) throw new Error("sdk");
        try { await c2.collection("intake_card").create({ id: rec.id, ...body }); }
        catch (e) { await c2.collection("intake_card").create(body); }
        // realtime event re-renders
      });
      return; // realtime event re-renders
    } catch (e) { goLocal(); }
  }
  cards.delete(id); persistIfLocal(); render();
  undoToast(rec, () => {
    if (cards.has(rec.id)) return;
    const entries = Array.from(cards.entries());
    entries.splice(Math.min(idx, entries.length), 0, [rec.id, rec]); // same id, same slot
    cards = new Map(entries);
    persistIfLocal(); render(rec.id);
  });
}

async function addCard() {
  const nameEl = $id("intake-name"), sumEl = $id("intake-summary"), btn = $id("intake-add-btn");
  if (!nameEl) return;
  if (!Session.isUnlocked()) { Toast.show({ tag: "system", html: t("board.lockedToast") }); return; }
  // <select> over the pseudonymous register — a pid, never a name. "새 가명 환자" mints a fresh P-YYYY-NNNN.
  let pid = (nameEl.value || "").trim();
  if (!pid || pid === NEW_PID) pid = Patients.newPid();
  Patients.ensure(pid); Patients.touch(pid, todayISO());
  const summary = (sumEl ? sumEl.value : "").trim().slice(0, 120);
  const card = { pid, status: "대기", summary, player_id: playerId() };
  if (btn) btn.disabled = true;
  if (online) {
    try {
      const c = await getPB();
      if (!c) throw new Error("sdk");
      await c.collection("intake_card").create(await toServerBody(card));
      nameEl.selectedIndex = 0; if (sumEl) sumEl.value = "";
      if (btn) btn.disabled = false;
      return; // realtime event re-renders
    } catch (e) { goLocal(); }
  }
  const rec = Object.assign({ id: "local-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) }, card);
  cards.set(rec.id, rec); persistIfLocal();
  nameEl.selectedIndex = 0; if (sumEl) sumEl.value = "";
  if (btn) btn.disabled = false;
  render(rec.id);
}

function goLocal() {
  online = false; setSync(false, "board.syncLocalEnc");
  try { _sub?.(); } catch {} _sub = null;
  setForeign(0);
}

// ── Boot: health check once, then either go live or run local ──
async function boot() {
  // Wire add controls immediately (work in every mode).
  const btn = $id("intake-add-btn");
  if (btn) btn.addEventListener("click", addCard);
  const sumEl = $id("intake-summary");
  if (sumEl) sumEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCard(); } });
  // After a re-unlock the key is back: re-decrypt whatever we hold.
  EventBus.on("session:unlocked", () => { renderPicker(); if (online) rebuildFromRecords(); else bootLocal(); });
  // Register changes (any tab) → picker + card labels follow.
  Patients.onChange(() => { renderPicker(); render(); });
  renderPicker();
  // Language toggle: same cards, new labels (applyStatic already reset the static sync text → repaint it).
  onLangChange(() => { setSync(syncOn, syncKey); setForeign(foreign); renderPicker(); render(); });

  const wsId = Session.workspaceId();
  wsHash = wsId ? await sha256hex(wsId) : null;

  let c = null;
  try { c = await getPB(); if (c) { await c.health.check(); online = true; } } catch (e) { online = false; }

  if (online && c && wsHash) {
    setSync(true, "board.syncLive");
    try {
      const filter = c.filter("ws = {:ws}", { ws: wsHash });
      const rows = await c.collection("intake_card").getFullList({ sort: "created", filter });
      records = new Map(rows.map((r) => [r.id, r]));
      // First-run seed for THIS workspace: plant the fictional samples (encrypted).
      if (records.size === 0) {
        ensureSeedPatients();
        for (const s of seedCards()) {
          try { await c.collection("intake_card").create(await toServerBody(s)); } catch (e) {}
        }
        const seeded = await c.collection("intake_card").getFullList({ sort: "created", filter });
        records = new Map(seeded.map((r) => [r.id, r]));
      }
      await rebuildFromRecords();
      // Realtime: live create/update/delete across all open screens — this workspace only.
      _sub = await c.collection("intake_card").subscribe("*", (e) => {
        if (e.action === "delete") records.delete(e.record.id);
        else records.set(e.record.id, e.record);
        rebuildFromRecords(e.action === "create" || e.action === "update" ? e.record.id : null);
      }, { filter });
      return;
    } catch (e) { goLocal(); }
  }

  bootLocal();
}

function bootLocal() {
  // Local-first path (no backend / offline / CDN down / integrity mismatch / no workspace).
  setSync(false, "board.syncLocalEnc");
  const stored = loadLocal();
  const list = (stored && stored.length) ? stored : seedCards();
  cards = new Map(list.map((r) => [r.id, r]));
  if (!stored && Session.isUnlocked()) { ensureSeedPatients(); saveLocal(Array.from(cards.values())); }
  render();
}

// Expose for quick console checks.
window.__intake = { getPB, get pb() { return pb; }, get online() { return online; }, playerId, get cards() { return cards; }, get foreign() { return foreign; } };

export { boot, getPB, playerId };
