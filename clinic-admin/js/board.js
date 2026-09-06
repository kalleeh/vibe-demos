/* clinic-admin — 접수 보드 (PocketBase realtime, local-first fallback) — END-TO-END ENCRYPTED.

   ============================================================
   LIVE SHARED INTAKE BOARD — PocketBase realtime showcase
   Isolated module. The rest of clinic-admin works fully without
   it (local-first); this layer is purely additive.

   ⚠ PURE DEMO DATA. Every card is a fictional sample patient
   (#intake-name is a <select> of fixed fictional names). Since the
   security pass the card body is nevertheless ENCRYPTED CLIENT-SIDE
   with the workspace master key before it is uploaded, to prove the
   pattern: the server never sees a name or a summary.

   Collection: intake_card (base) — https://clinic-admin.pb.gurum.se/_/
     ws        (text, required, max 64)  — sha256(workspaceId): routes cards to a workspace,
                                            reveals nothing about it
     payload   (json, max 4096)           — { v:1, iv, ct } AES-GCM over { name, summary }
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
   ============================================================ */
import { Toast, esc } from "./core/ui.js";
import { Store, EventBus } from "./core/store.js";
import { Session } from "./security/session.js";
import { encryptJSON, decryptJSON, sha256hex, sha384b64, isEnvelope } from "./security/crypto.js";

const PB_URL = "https://clinic-admin.pb.gurum.se";
const PB_ESM = "https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs";
// sha384 of the pinned file above (curl + openssl dgst -sha384 -binary | base64, 2026-09-06)
const PB_ESM_SRI = "sha384-a/4W5e0T7WVUFpuqUhUJju6S/V52zZ0hZpIFQKf4bqCQLKF7ogeoVtWmOpT9U6Fd";
const STATUSES = ["대기", "진료중", "완료"];
const LS_LOCAL = "intake-cards"; // Store key (sensitive → encrypted)

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
async function sealCard({ name, summary }) {
  const key = Session.key();
  if (!key) throw Object.assign(new Error("locked"), { code: "locked" });
  return encryptJSON(key, { name: String(name || "").slice(0, 20), summary: String(summary || "").slice(0, 120) });
}
// server record → view card | null (cannot decrypt)
async function openRecord(rec) {
  const key = Session.key();
  if (!key || !isEnvelope(rec.payload)) return null;
  try {
    const body = await decryptJSON(key, rec.payload);
    return { id: rec.id, name: body.name, summary: body.summary, status: rec.status, player_id: rec.player_id, created: rec.created };
  } catch { return null; }
}

// ── Local-first store (used when offline / no backend) — encrypted by Store ──
function loadLocal() { const v = Store.get(LS_LOCAL); return Array.isArray(v) ? v : null; }
function saveLocal(list) { Store.set(LS_LOCAL, list); }
// Fictional seed patients — only ever sample data.
function seedCards() {
  const me = playerId();
  return [
    { id: "seed-1", name: "김민서", status: "대기",   summary: "요통 초진 · 접수 대기", player_id: "" },
    { id: "seed-2", name: "이준호", status: "대기",   summary: "교통사고 후 경추 통증", player_id: "" },
    { id: "seed-3", name: "박서연", status: "진료중", summary: "오십견 추나 진행 중", player_id: "" },
    { id: "seed-4", name: "정우진", status: "완료",   summary: "발목 염좌 · 침 치료 완료", player_id: me },
  ];
}

// In-memory view model: id -> card (decrypted). `foreign` = rows we could not decrypt.
let cards = new Map();
let records = new Map(); // online: raw server rows by id
let foreign = 0;

function setSync(connected, text) {
  const s = $id("intake-sync"), t = $id("intake-sync-text");
  if (s) { s.classList.toggle("on", connected); const d = s.querySelector(".dot"); if (d) d.textContent = connected ? "●" : "○"; }
  if (t) t.textContent = text;
}
function setForeign(n) {
  foreign = n;
  let el = $id("intake-foreign");
  if (!el) {
    const anchor = $id("intake-sync");
    if (!anchor) return;
    el = document.createElement("span");
    el.className = "intake-foreign"; el.id = "intake-foreign";
    el.title = "이 브라우저의 워크스페이스 키로 열 수 없는 카드 — 다른 워크스페이스에서 올린 암호문입니다.";
    anchor.insertAdjacentElement("afterend", el);
  }
  el.hidden = !n;
  el.textContent = n ? `다른 워크스페이스 카드 ${n}` : "";
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
  nameText.textContent = rec.name || "환자"; // textContent → no XSS
  name.appendChild(nameText);
  const lockTag = document.createElement("span");
  lockTag.className = "e2e-tag"; lockTag.textContent = "E2E"; lockTag.title = "이 카드는 워크스페이스 키로 암호화되어 저장됩니다";
  name.appendChild(lockTag);
  if (rec.player_id && rec.player_id === me) {
    const tag = document.createElement("span");
    tag.className = "mine-tag"; tag.textContent = "내가 추가";
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
    adv.textContent = nx === "진료중" ? "진료 시작 →" : "완료 →";
    adv.addEventListener("click", () => advanceCard(rec.id));
    actions.appendChild(adv);
  }
  const del = document.createElement("button");
  del.type = "button"; del.className = "pc-btn";
  del.textContent = "지우기";
  del.addEventListener("click", () => deleteCard(rec.id));
  actions.appendChild(del);
  el.appendChild(actions);

  return el;
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
      empty.textContent = st === "대기" ? "접수 대기 없음" : (st === "진료중" ? "진료 중 없음" : "완료 없음");
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
  Toast.withUndo(`지움 · 접수 카드 (${rec.status})`, restore, "system");
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
  if (!Session.isUnlocked()) { Toast.show({ tag: "system", html: "잠금 상태에서는 카드를 추가할 수 없습니다." }); return; }
  let name = (nameEl.value || "").trim().slice(0, 20); // <select> — fixed fictional names only
  if (!name) name = "예시 환자";
  const summary = (sumEl ? sumEl.value : "").trim().slice(0, 120);
  const card = { name, status: "대기", summary, player_id: playerId() };
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
  online = false; setSync(false, "로컬 — 이 기기에서만 · 암호화");
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
  EventBus.on("session:unlocked", () => { if (online) rebuildFromRecords(); else bootLocal(); });

  const wsId = Session.workspaceId();
  wsHash = wsId ? await sha256hex(wsId) : null;

  let c = null;
  try { c = await getPB(); if (c) { await c.health.check(); online = true; } } catch (e) { online = false; }

  if (online && c && wsHash) {
    setSync(true, "실시간 동기화 중 · E2E 암호화");
    try {
      const filter = c.filter("ws = {:ws}", { ws: wsHash });
      const rows = await c.collection("intake_card").getFullList({ sort: "created", filter });
      records = new Map(rows.map((r) => [r.id, r]));
      // First-run seed for THIS workspace: plant the fictional samples (encrypted).
      if (records.size === 0) {
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
  setSync(false, "로컬 — 이 기기에서만 · 암호화");
  const stored = loadLocal();
  const list = (stored && stored.length) ? stored : seedCards();
  cards = new Map(list.map((r) => [r.id, r]));
  if (!stored && Session.isUnlocked()) saveLocal(Array.from(cards.values()));
  render();
}

// Expose for quick console checks.
window.__intake = { getPB, get pb() { return pb; }, get online() { return online; }, playerId, get cards() { return cards; }, get foreign() { return foreign; } };

export { boot, getPB, playerId };
