/* clinic-admin — 접수 보드 (PocketBase realtime, local-first fallback). Was the standalone <script type=module>
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { Toast } from "./core/ui.js";

/* ============================================================
   LIVE SHARED INTAKE BOARD — PocketBase realtime showcase
   Isolated module. The rest of clinic-admin works fully without
   it (local-first); this layer is purely additive.

   ⚠ PURE DEMO DATA. Every card is a fictional sample patient.
   There is NO real patient data in this collection, ever. The board
   is PUBLIC (open create/update rules), so the UI does not accept a
   typed name at all — #intake-name is a <select> of fixed fictional
   names (mirrored server-side by the pattern constraint in
   pb/pb_migrations/003_field_limits.js), and the pill reads
   "공유 보드 — 실명 입력 불가".

   Collection: intake_card (base) — https://clinic-admin.pb.gurum.se/_/
     patient_name (text, required, max 40)
     status       (text, required, max 12)  — 대기 | 진료중 | 완료
     summary      (text, max 200)
     player_id    (text)  — anonymous UUID, origin tag, NOT auth
     Rules: list="" view="" create="" update="" delete=""
            (open update/delete — a shared demo board where any
             device must be able to advance any card's status;
             data is fictional seed, so no ownership gate. See
             the migration file for the full rationale.)

   Realtime: pb.collection('intake_card').subscribe('*', …) — a card
   created/updated/deleted on one device appears on every other open
   screen instantly. SDK auto-reconnects; no manual polling.
   ============================================================ */
// SDK is loaded lazily by full URL via dynamic import() — NOT a static
// import + importmap. A static import that can't resolve throws at
// module-eval time and would kill every handler below. Dynamic import of
// a full URL degrades gracefully if the CDN/backend is down (the board
// still runs on the local-first seed).
const PB_URL = "https://clinic-admin.pb.gurum.se";
const PB_ESM = "https://cdn.jsdelivr.net/npm/pocketbase@0.25.0/dist/pocketbase.es.mjs";
const STATUSES = ["대기", "진료중", "완료"];
const LS_LOCAL = "vibe.clinic-admin.intake-cards"; // local-first fallback store

let pb = null, online = false, _pbPromise = null, _sub = null;

function getPB() {
  if (pb) return Promise.resolve(pb);
  if (!_pbPromise) {
    _pbPromise = import(PB_ESM)
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

// ── Local-first store (used when offline / no backend) ──
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_LOCAL) || "null"); } catch (e) { return null; }
}
function saveLocal(cards) {
  try { localStorage.setItem(LS_LOCAL, JSON.stringify(cards)); } catch (e) {}
}
// Fictional seed patients — only ever sample data.
function seedCards() {
  const me = playerId();
  return [
    { id: "seed-1", patient_name: "김민서", status: "대기",   summary: "요통 초진 · 접수 대기", player_id: "" },
    { id: "seed-2", patient_name: "이준호", status: "대기",   summary: "교통사고 후 경추 통증", player_id: "" },
    { id: "seed-3", patient_name: "박서연", status: "진료중", summary: "오십견 추나 진행 중", player_id: "" },
    { id: "seed-4", patient_name: "정우진", status: "완료",   summary: "발목 염좌 · 침 치료 완료", player_id: me },
  ];
}

// In-memory view model: id -> card record
let cards = new Map();

function setSync(connected, text) {
  const s = $id("intake-sync"), t = $id("intake-sync-text");
  if (s) { s.classList.toggle("on", connected); const d = s.querySelector(".dot"); if (d) d.textContent = connected ? "●" : "○"; }
  if (t) t.textContent = text;
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
  nameText.textContent = rec.patient_name || "환자"; // textContent → no XSS
  name.appendChild(nameText);
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

function persistIfLocal() { if (!online) saveLocal(Array.from(cards.values())); }

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
    } catch (e) { online = false; setSync(false, "로컬 — 이 기기에서만"); }
  }
  rec.status = nx; cards.set(id, rec); persistIfLocal(); render(id);
}

// Undo toast via the classic-script Toast helper (a top-level const is a
// shared global lexical binding, so it is reachable from this module).
function undoToast(rec, restore) {
  if (typeof Toast === "undefined") return;
  Toast.withUndo(`지움 · ${rec.patient_name || "환자"} (${rec.status})`, restore, "system");
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
        const body = { patient_name: rec.patient_name, status: rec.status, summary: rec.summary, player_id: rec.player_id };
        const c2 = await getPB();
        if (!c2) throw new Error("sdk");
        try { await c2.collection("intake_card").create({ id: rec.id, ...body }); }
        catch (e) { await c2.collection("intake_card").create(body); }
        // realtime event re-renders
      });
      return; // realtime event re-renders
    } catch (e) { online = false; setSync(false, "로컬 — 이 기기에서만"); }
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
  let name = (nameEl.value || "").trim().slice(0, 20); // <select> — fixed fictional names only
  if (!name) name = "예시 환자";
  const summary = (sumEl ? sumEl.value : "").trim().slice(0, 120);
  const payload = { patient_name: name, status: "대기", summary, player_id: playerId() };
  if (btn) btn.disabled = true;
  if (online) {
    try {
      const c = await getPB();
      if (!c) throw new Error("sdk");
      await c.collection("intake_card").create(payload);
      nameEl.selectedIndex = 0; if (sumEl) sumEl.value = "";
      if (btn) btn.disabled = false;
      return; // realtime event re-renders
    } catch (e) { online = false; setSync(false, "로컬 — 이 기기에서만"); }
  }
  const rec = Object.assign({ id: "local-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now()) }, payload);
  cards.set(rec.id, rec); persistIfLocal();
  nameEl.selectedIndex = 0; if (sumEl) sumEl.value = "";
  if (btn) btn.disabled = false;
  render(rec.id);
}

// ── Boot: health check once, then either go live or run local ──
async function boot() {
  // Wire add controls immediately (work in every mode).
  const btn = $id("intake-add-btn");
  if (btn) btn.addEventListener("click", addCard);
  const sumEl = $id("intake-summary");
  if (sumEl) sumEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCard(); } });

  let c = null;
  try { c = await getPB(); if (c) { await c.health.check(); online = true; } } catch (e) { online = false; }

  if (online && c) {
    setSync(true, "실시간 동기화 중");
    try {
      const rows = await c.collection("intake_card").getFullList({ sort: "created" });
      cards = new Map(rows.map((r) => [r.id, r]));
      // First-run seed: if the shared board is empty, plant fictional samples.
      if (cards.size === 0) {
        for (const s of seedCards()) {
          try { await c.collection("intake_card").create({ patient_name: s.patient_name, status: s.status, summary: s.summary, player_id: s.player_id }); } catch (e) {}
        }
        const seeded = await c.collection("intake_card").getFullList({ sort: "created" });
        cards = new Map(seeded.map((r) => [r.id, r]));
      }
      render();
      // Realtime: live create/update/delete across all open screens.
      _sub = await c.collection("intake_card").subscribe("*", (e) => {
        if (e.action === "delete") cards.delete(e.record.id);
        else cards.set(e.record.id, e.record);
        render(e.action === "create" || e.action === "update" ? e.record.id : null);
      });
      return;
    } catch (e) { online = false; setSync(false, "로컬 — 이 기기에서만"); }
  }

  // Local-first path (no backend / offline / CDN down).
  setSync(false, "로컬 — 이 기기에서만");
  const stored = loadLocal();
  const list = (stored && stored.length) ? stored : seedCards();
  cards = new Map(list.map((r) => [r.id, r]));
  if (!stored) saveLocal(Array.from(cards.values()));
  render();
}

// Expose for quick console checks.
window.__intake = { getPB, get pb() { return pb; }, get online() { return online; }, playerId, get cards() { return cards; } };

export { boot, getPB, playerId };
