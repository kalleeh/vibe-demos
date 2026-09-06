/* clinic-admin — ENTITY SYNC (step B of the shared single-clinic instance).

   Every Store key except the device-local ones follows the user to any device, END-TO-END ENCRYPTED under the clinic
   key (Session.key(), the same non-extractable AES-GCM key on every device). The server (pb/pb_migrations/006_sync_blobs.js)
   holds `sync_blob` rows = { key, payload: { v:1, iv, ct }, rev, updatedBy, deleted, updated } and `sync_file` rows for
   the licence photos — ciphertext, key names, sizes and timestamps only. Plain-tier keys (org.profile, tariff.*, …) are
   encrypted for transport / at rest on the server too: one envelope format for everything; only THIS device keeps its
   plain tier plain.

   Position in the import DAG: crypto → cloud → session → SYNC → attachments → store. sync.js therefore never imports
   store.js or attachments.js; both hand it a small bridge at module load (Sync.bind / Sync.bindFiles).

   DEVICE-LOCAL BY DESIGN (never leaves the browser): ui.* (language · last tab · current claims batch · welcome/nudge
   flags), __* (lock settings · mtimes · last save · this module's own __sync meta, __outbox, __conflicts), the dev server
   override (pbUrl), the board's anonymous player-id, and ai.draft (the AI note — registry: "저장하지 않음", purged at unlock).

   WRITE PATH   Store.set(key, v) → local write as before → enqueue { key, value } → 500 ms debounce → ONE flush: every
                pending key sealed under Session.key(), rev = last known server rev + 1, updatedBy = my staffId, upserted
                into sync_blob (record id = sha256(key)[0..15] on every device → /api/batch upsert, sequential fallback).
                Store.remove → the same row with deleted:true (soft delete; peers learn about it). Offline / locked →
                the pending set stays in an ENCRYPTED outbox (Store key __outbox, sealed under the session key) and
                flushes on reconnect / unlock. Retries back off 2 s → 60 s while anything is pending.
   READ PATH    On unlock (inside Store.unlockedInit, BEFORE the unlock hooks so a fresh device never "migrates" against an
                empty roster) and on every reconnect: pull sync_blob rows with updated ≥ lastSyncAt (paged), then realtime
                subscribe("*") applies live changes the same way. Every applied change goes through Store.applyRemote →
                the normal `store:<key>` event → every tab / panel re-renders as for a cross-tab change.
   MERGE        Last-write-wins PER KEY: the server's `updated` (server clock) against the local edit's time (the outbox
                entry's `at`, or the key's __mtime when this device has never synced the key — first sync / restore);
                ties break on updatedBy (larger string wins — arbitrary but identical on every device). A local edit that
                LOSES is never silently dropped: it is kept in the __conflicts ring (last 20, viewable + restorable in
                조직 › 데이터 처리 현황) and an audit entry "동기화 충돌 — 서버 값 적용" is written.
                `activity` is NOT LWW: entries are unioned by id (append-only log), sorted by `at`, capped at ActivityLog.MAX;
                a device re-pushes the union only when it held entries the server lacked (so the exchange terminates).
   FIRST SYNC   Server empty + local data (the device that bootstrapped / migrated in step A) → every local syncable key is
                pushed (one batch). Fresh device (empty local) → everything is pulled before the tabs initialise. Both with
                data → LWW per key as above (values that are equal never count as a conflict).
   ATTACHMENTS  core/attachments.js mirrors each encrypted record: put → upload the JSON of AES-GCM(record) as the `blob`
                file, remove → deleted:true + file cleared; a device that lacks a photo pulls it (realtime + on-miss).
   PURGE        Retention purge runs on EVERY device on unlock (lifecycle.purgeExpired) — its Store.set / Store.remove flow
                through this module, so the purge propagates as ordinary updates / tombstones and is idempotent (a device
                that already received the purged state finds nothing to purge). No leader election.
   전체 파기      lifecycle.destroyAll({ server:true }) (원장 only, checkbox default ON) soft-deletes every server row
                (payload blanked, deleted:true, files cleared) BEFORE wiping the device; every other device receives the
                tombstones and empties. A non-owner's 파기 only clears the device. */
import { Cloud } from "../security/cloud.js";
import { Session } from "../security/session.js";
import { encryptJSON, decryptJSON, isEnvelope, sha256hex } from "../security/crypto.js";
import { t } from "./i18n.js";

const LOCAL_ONLY = { exact: ["pbUrl", "player-id", "ai.draft", "__lock"], prefixes: ["ui.", "__"] };
const isSyncable = (key) => typeof key === "string" && key.length > 0 && key.length <= 120 && /^[A-Za-z0-9._-]+$/.test(key)
  && !LOCAL_ONLY.exact.includes(key) && !LOCAL_ONLY.prefixes.some(p => key.startsWith(p));
const META_KEY = "__sync";           // plain (no names): { v, lastSyncAt, revs: { key: rev }, tombs: [key] }
const OUTBOX_KEY = "__outbox";       // sensitive: { blobs: { key: { value, deleted, at } }, files: { id: "put" | "del" } }
const CONFLICTS_KEY = "__conflicts"; // sensitive: [{ id, key, at, by, serverUpdated, losing }]  (last 20)
const ACTIVITY_KEY = "activity";
const ACTIVITY_MAX = 500;
const DEBOUNCE_MS = 500;
const MAX_WAIT_MS = 2000; // a key rewritten faster than the debounce must still leave within 2 s (no starvation)
const PAGE = 200;
const BATCH_CHUNK = 50;
const MAX_PAYLOAD = 262144;
const MAX_CONFLICTS = 20;
const RETRY_MIN_MS = 2000, RETRY_MAX_MS = 60000;
const INITIAL_PULL_MS = 15000;
const HEALTH_MS = 2500;
const FILES_PULL_MIN_MS = 10000;

let S = null;   // Store bridge — { get, keys, mtime, applyRemote, set, remove, activityAdd }
let F = null;   // Attachments bridge — { getRaw, putRaw, del, allRaw }
let meta = { v: 1, lastSyncAt: null, revs: {}, tombs: [] };
let pending = new Map();      // key → { value, deleted, at }
let pendingFiles = new Map(); // attachment id → "put" | "del"
let inflight = new Map();     // key → rev being upserted right now (skip our own realtime echo)
let lastSent = new Map();     // key → JSON of the value the server is known to hold (pushed by us or applied from it) — no-op writes are not re-sent
let firstQueuedAt = 0;
let online = false, syncing = 0, started = false, lastOkAt = null, undecryptable = 0, fileCount = 0, lastError = null;
let timer = null, retryTimer = null, retryMs = RETRY_MIN_MS, flushing = false, flushAgain = false, lastFilesPull = 0;
let unsub = null, unsubFiles = null, unsubConnect = null;
let applyChain = Promise.resolve();
const idCache = new Map();
const listeners = [];
// Diagnostic ring (memory only, key names + revs + timestamps — never a value): Sync.trace() in the console / the e2e.
const TRACE_MAX = 300, trace = [];
const tr = (ev, extra) => { trace.push({ t: Date.now(), ev, ...(extra || {}) }); if (trace.length > TRACE_MAX) trace.shift(); };

const notify = () => { for (const fn of listeners) { try { fn(); } catch (e) { console.error(e); } } };
const me = () => { const u = Session.user(); return u ? (u.staffId || u.id || "") : ""; };
const ready = () => Session.isUnlocked() && Cloud.isAuthed();
const parseAt = (s) => { const n = Date.parse(String(s || "").replace(" ", "T")); return Number.isFinite(n) ? n : 0; };
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "timeout" })), ms))]);
async function idOf(key) {
  if (!idCache.has(key)) idCache.set(key, (await sha256hex(key)).slice(0, 15));
  return idCache.get(key);
}
const DEL = "\u0000deleted";
const sig = (v) => { try { return JSON.stringify(v) ?? "undefined"; } catch { return "\u0000unserialisable-" + Math.random(); } };
const setSyncing = (on) => { syncing = Math.max(0, syncing + (on ? 1 : -1)); notify(); };
const markOnline = () => { if (!online) { online = true; retryMs = RETRY_MIN_MS; } lastOkAt = Date.now(); notify(); };
const markOffline = () => { online = false; notify(); scheduleRetry(); };

/* ── meta / outbox / conflicts (through the Store bridge; all three keys are LOCAL_ONLY) ── */
function loadMeta() {
  const m = S?.get(META_KEY);
  meta = m && typeof m === "object" && m.revs ? { v: 1, lastSyncAt: m.lastSyncAt || null, revs: { ...m.revs }, tombs: Array.isArray(m.tombs) ? [...m.tombs] : [] } : { v: 1, lastSyncAt: null, revs: {}, tombs: [] };
}
function saveMeta() { try { S?.set(META_KEY, meta); } catch {} }
function setRev(key, rev, deleted) {
  meta.revs[key] = rev;
  const i = meta.tombs.indexOf(key);
  if (deleted && i < 0) meta.tombs.push(key); else if (!deleted && i >= 0) meta.tombs.splice(i, 1);
}
function loadOutbox() {
  const ob = S?.get(OUTBOX_KEY);
  if (!ob || typeof ob !== "object") return;
  for (const [k, p] of Object.entries(ob.blobs || {})) if (isSyncable(k) && p && !pending.has(k)) pending.set(k, { value: p.value, deleted: !!p.deleted, at: p.at || 0 });
  for (const [id, op] of Object.entries(ob.files || {})) if (!pendingFiles.has(id)) pendingFiles.set(id, op);
}
function persistOutbox() {
  if (!S || !Session.isUnlocked()) return;
  if (!pending.size && !pendingFiles.size) { if (S.keys().includes(OUTBOX_KEY)) S.remove(OUTBOX_KEY); return; }
  S.set(OUTBOX_KEY, { blobs: Object.fromEntries(pending), files: Object.fromEntries(pendingFiles) });
}
function conflicts() { const v = S?.get(CONFLICTS_KEY, []); return Array.isArray(v) ? v : []; }
function recordConflict(key, losing, rec) {
  const entry = { id: "cf-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6), key, at: Date.now(), by: rec.updatedBy || "", serverUpdated: rec.updated || "", losing: losing === undefined ? null : losing, deleted: losing === undefined };
  S.set(CONFLICTS_KEY, [entry, ...conflicts()].slice(0, MAX_CONFLICTS));
  try { S.activityAdd(t("sync.conflictAction", { key })); } catch {}
  notify();
}

/* ── crypto ── */
async function seal(value) { return encryptJSON(Session.key(), value); }
async function open(env) { if (!isEnvelope(env) || !Session.key()) return undefined; try { return await decryptJSON(Session.key(), env); } catch { return undefined; } }

/* ── activity union (append-only log — never LWW) ── */
const fp = (e) => e?.id || `${e?.at || 0}|${e?.staffId || ""}|${e?.action || e?.text || ""}`;
function unionActivity(a, b) {
  const seen = new Set(), out = [];
  for (const e of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) { if (!e || typeof e !== "object") continue; const k = fp(e); if (seen.has(k)) continue; seen.add(k); out.push(e); }
  out.sort((x, y) => (y.at || 0) - (x.at || 0));
  return out.slice(0, ACTIVITY_MAX);
}

/* ── write path ── */
function enqueue(key, value, { deleted = false } = {}) {
  if (!isSyncable(key)) return;
  if (deleted && !(key in meta.revs)) { pending.delete(key); return; } // never reached the server → nothing to tombstone
  // Same value the server already holds (a tab re-persisting on render, a remote change echoed back by a listener) → not a
  // write. Without this two devices would ping-pong an unchanged key forever.
  if (lastSent.get(key) === (deleted ? DEL : sig(value))) { if (pending.delete(key)) notify(); return; }
  pending.set(key, { value: deleted ? undefined : value, deleted, at: Date.now() });
  tr("queue", { key, deleted });
  schedule();
  notify();
}
function schedule(ms = DEBOUNCE_MS) {
  const now = Date.now();
  if (!timer) firstQueuedAt = now;
  const delay = Math.min(ms, Math.max(0, firstQueuedAt + MAX_WAIT_MS - now));
  clearTimeout(timer); timer = setTimeout(() => { timer = null; flush(); }, delay);
}
function scheduleRetry() {
  if (retryTimer || (!pending.size && !pendingFiles.size && online)) return;
  retryTimer = setTimeout(() => { retryTimer = null; resync(); }, retryMs);
  retryMs = Math.min(RETRY_MAX_MS, retryMs * 2);
}

async function upsertAll(c, ops) {
  if (!ops.length) return;
  if (ops.length > 1 && typeof c.createBatch === "function") {
    try {
      for (let i = 0; i < ops.length; i += BATCH_CHUNK) {
        const chunk = ops.slice(i, i + BATCH_CHUNK);
        const b = c.createBatch();
        for (const op of chunk) b.collection("sync_blob").upsert(op.body);
        const res = await b.send();
        chunk.forEach((op, j) => { const st = res?.[j]?.status; if (st !== 200 && st !== 201) throw Object.assign(new Error("batch item " + st), { status: st }); });
      }
      return;
    } catch (e) {
      // Batch API disabled / partial failure → the sequential path below (idempotent: same ids).
      if (e?.status === 0 || e?.isAbort) throw e;
    }
  }
  for (const op of ops) {
    const { id, ...rest } = op.body;
    try { await c.collection("sync_blob").create(op.body); }
    catch (e) { if (Number(e?.status) === 400) await c.collection("sync_blob").update(id, rest); else throw e; }
  }
}
async function flushFiles(c) {
  if (!F || !pendingFiles.size) return;
  const items = [...pendingFiles.entries()]; pendingFiles.clear();
  try {
    for (const [id, op] of items) {
      const rid = await idOf(id);
      if (op === "del") {
        try { await c.collection("sync_file").update(rid, { deleted: true, blob: null, updatedBy: me() }); }
        catch (e) { if (Number(e?.status) !== 404) throw e; }
        continue;
      }
      const raw = await F.getRaw(id);
      if (!raw) continue; // removed again before the flush
      const fd = new FormData();
      fd.set("id", rid); fd.set("key", id); fd.set("updatedBy", me()); fd.set("deleted", "false");
      fd.set("blob", new File([JSON.stringify(await seal(raw))], id + ".bin", { type: "application/octet-stream" }));
      try { await c.collection("sync_file").create(fd); }
      catch (e) { if (Number(e?.status) === 400) { fd.delete("id"); await c.collection("sync_file").update(rid, fd); } else throw e; }
    }
  } catch (e) {
    for (const [id, op] of items) if (!pendingFiles.has(id)) pendingFiles.set(id, op);
    throw e;
  }
}
async function flush() {
  if (flushing) { flushAgain = true; return; }
  if (!Session.isUnlocked() || !S) return;
  flushing = true; setSyncing(true);
  try {
    persistOutbox();
    if (!pending.size && !pendingFiles.size) return;
    if (!Cloud.isAuthed()) { markOffline(); return; }
    let c;
    try { c = await Cloud.getPB(); } catch { markOffline(); return; }
    const items = [...pending.entries()]; pending.clear();
    tr("flush", { keys: items.map(([k]) => k), files: pendingFiles.size });
    const ops = [];
    for (const [key, p] of items) {
      const rev = (meta.revs[key] || 0) + 1;
      let payload = null;
      if (!p.deleted) {
        let value = p.value;
        payload = await seal(value);
        if (JSON.stringify(payload).length > MAX_PAYLOAD) {
          if (key === ACTIVITY_KEY && Array.isArray(value)) { // trim the log until it fits — the newest entries win
            while (Array.isArray(value) && value.length > 20 && JSON.stringify(payload).length > MAX_PAYLOAD) { value = value.slice(0, Math.floor(value.length * 0.8)); payload = await seal(value); }
          }
          if (JSON.stringify(payload).length > MAX_PAYLOAD) { try { S.activityAdd(t("sync.tooLargeAction", { key })); } catch {} continue; }
        }
      }
      ops.push({ key, rev, sig: p.deleted ? DEL : sig(p.value), body: { id: await idOf(key), key, payload, rev, updatedBy: me(), deleted: !!p.deleted } });
    }
    for (const op of ops) inflight.set(op.key, op.rev);
    try {
      await upsertAll(c, ops);
      for (const op of ops) { setRev(op.key, op.rev, op.body.deleted); lastSent.set(op.key, op.sig); }
      tr("flush-ok", { revs: ops.map(op => op.key + "@" + op.rev) });
      saveMeta();
      await flushFiles(c);
      markOnline();
    } catch (e) {
      // Put the snapshot back unless a newer edit of the same key arrived meanwhile.
      for (const [key, p] of items) if (!pending.has(key)) pending.set(key, p);
      lastError = { at: Date.now(), status: Number(e?.status || 0), message: String(e?.response?.message || e?.message || e), keys: items.map(([k]) => k) };
      tr("flush-fail", { status: lastError.status, message: lastError.message });
      console.warn("sync flush failed", lastError.status, lastError.message, lastError.keys.join(","));
      markOffline();
    } finally {
      for (const op of ops) inflight.delete(op.key);
    }
    persistOutbox();
  } finally {
    flushing = false; setSyncing(false);
    if (flushAgain) { flushAgain = false; schedule(50); }
  }
}

/* ── read path ── */
async function applyRecord(rec, { initial = false } = {}) {
  const key = rec?.key;
  if (!isSyncable(key) || !S || !Session.isUnlocked()) return false;
  if (inflight.get(key) === rec.rev && rec.updatedBy === me()) { tr("skip-echo", { key, rev: rec.rev }); return false; } // our own write echoing back
  const known = meta.revs[key] || 0;
  if (typeof rec.rev === "number" && rec.rev <= known) { tr("skip-seen", { key, rev: rec.rev, known }); return false; } // seen already (or stale)
  const serverAt = parseAt(rec.updated);
  const serverVal = rec.deleted ? undefined : await open(rec.payload);
  if (!rec.deleted && serverVal === undefined) { undecryptable++; setRev(key, rec.rev, false); saveMeta(); return false; } // foreign key / corrupt → leave local as is

  if (key === ACTIVITY_KEY) {
    const local = S.get(ACTIVITY_KEY, []) || [];
    const server = Array.isArray(serverVal) ? serverVal : [];
    const merged = unionActivity(local, server);
    const localSet = new Set(local.map(fp)), serverSet = new Set(server.map(fp));
    const changedLocal = merged.length !== local.length || merged.some(e => !localSet.has(fp(e)));
    const serverLacks = merged.some(e => !serverSet.has(fp(e)));
    pending.delete(key);
    if (changedLocal) S.applyRemote(key, merged);
    setRev(key, rec.rev, false); saveMeta();
    lastSent.set(key, sig(server));
    if (serverLacks) { pending.set(key, { value: merged, deleted: false, at: Date.now() }); schedule(); }
    return changedLocal;
  }

  // Local candidate: an unflushed edit, or (never-synced key) whatever this device holds, timed by its mtime.
  let localAt = null, localVal, localDeleted = false;
  const p = pending.get(key);
  if (p) { localAt = p.at; localVal = p.value; localDeleted = p.deleted; }
  else if (initial && !known && S.keys().includes(key)) { localAt = S.mtime(key) || 0; localVal = S.get(key); }
  if (localAt != null) {
    const same = (!!localDeleted === !!rec.deleted) && (localDeleted || JSON.stringify(localVal) === JSON.stringify(serverVal));
    if (same) { tr("same", { key, rev: rec.rev }); pending.delete(key); setRev(key, rec.rev, !!rec.deleted); saveMeta(); lastSent.set(key, rec.deleted ? DEL : sig(serverVal)); return false; }
    const localWins = localAt > serverAt || (localAt === serverAt && me() > String(rec.updatedBy || ""));
    tr(localWins ? "local-wins" : "conflict", { key, rev: rec.rev, localAt, serverAt, initial, pendingHad: !!p });
    if (localWins) {
      setRev(key, rec.rev, !!rec.deleted); saveMeta();
      pending.set(key, { value: localVal, deleted: localDeleted, at: localAt }); schedule();
      return false;
    }
    pending.delete(key);
    recordConflict(key, localDeleted ? undefined : localVal, rec);
  }
  tr("apply", { key, rev: rec.rev, deleted: !!rec.deleted, initial });
  S.applyRemote(key, rec.deleted ? null : serverVal);
  setRev(key, rec.rev, !!rec.deleted); saveMeta();
  lastSent.set(key, rec.deleted ? DEL : sig(serverVal));
  return true;
}
const queueApply = (rec) => { applyChain = applyChain.then(() => applyRecord(rec)).catch((e) => console.warn("sync apply", e)); return applyChain; };

async function pull({ initial = false } = {}) {
  const c = await Cloud.getPB();
  const since = meta.lastSyncAt;
  initial = initial || !since; // first pull ever on this device → local values compete by their mtime
  tr("pull", { since, initial });
  let page = 1, applied = 0, total = 0, maxUpdated = since || "";
  for (;;) {
    const res = await c.collection("sync_blob").getList(page, PAGE, { sort: "updated,id", filter: since ? c.filter("updated >= {:t}", { t: since }) : "" });
    total = res.totalItems;
    for (const rec of res.items) {
      if (await applyRecord(rec, { initial })) applied++;
      if (rec.updated > maxUpdated) maxUpdated = rec.updated;
    }
    if (page >= res.totalPages || !res.items.length) break;
    page++;
  }
  if (maxUpdated && maxUpdated !== meta.lastSyncAt) { meta.lastSyncAt = maxUpdated; saveMeta(); }
  return { applied, total, empty: !since && total === 0 };
}
// Local syncable keys the server has never seen → push them (first device · restore · edits made while locked).
function pushMissing() {
  if (!S) return 0;
  let n = 0;
  for (const key of S.keys()) {
    if (!isSyncable(key) || key in meta.revs || pending.has(key)) continue;
    const v = S.get(key);
    if (v === undefined || v === null) continue;
    pending.set(key, { value: v, deleted: false, at: S.mtime(key) || Date.now() }); n++;
  }
  tr("push-missing", { n });
  if (n) schedule(50);
  return n;
}

/* ── attachments (sync_file) ── */
async function downloadFile(c, rec) {
  const url = c.files.getURL(rec, rec.blob);
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("file " + r.status);
  const raw = await open(await r.json());
  if (!raw || typeof raw !== "object" || raw.id !== rec.key) return null;
  return raw;
}
async function pullFiles({ force = false } = {}) {
  if (!F || !ready()) return 0;
  if (!force && Date.now() - lastFilesPull < FILES_PULL_MIN_MS) return 0;
  lastFilesPull = Date.now();
  const c = await Cloud.getPB();
  const rows = await c.collection("sync_file").getFullList({ sort: "updated" });
  const local = new Map((await F.allRaw()).map(r => [r.id, r]));
  let n = 0;
  const serverIds = new Set();
  for (const rec of rows) {
    if (rec.deleted) { if (local.has(rec.key) && !pendingFiles.has(rec.key)) { await F.del(rec.key); n++; } continue; }
    serverIds.add(rec.key);
    if (local.has(rec.key) || !rec.blob) continue;
    try { const raw = await downloadFile(c, rec); if (raw) { await F.putRaw(raw); n++; } } catch (e) { console.warn("sync file pull", rec.key, e); }
  }
  // Local photos the server has never seen (first device · restore) → upload.
  for (const id of local.keys()) if (!serverIds.has(id) && !rows.some(r => r.key === id && r.deleted) && !pendingFiles.has(id)) { pendingFiles.set(id, "put"); }
  if (pendingFiles.size) schedule(50);
  fileCount = serverIds.size;
  notify();
  return n;
}
async function onFileEvent(rec) {
  if (!F || !ready() || !rec?.key) return;
  try {
    if (rec.deleted) { if (!pendingFiles.has(rec.key)) { await F.del(rec.key); fileCount = Math.max(0, fileCount - 1); } }
    else if (rec.blob && !(await F.getRaw(rec.key))) { const raw = await downloadFile(await Cloud.getPB(), rec); if (raw) { await F.putRaw(raw); fileCount++; } }
    notify();
  } catch (e) { console.warn("sync file event", e); }
}

/* ── lifecycle ── */
async function subscribe() {
  if (!ready()) return;
  const c = await Cloud.getPB();
  try { unsub?.(); } catch {} try { unsubFiles?.(); } catch {} try { unsubConnect?.(); } catch {}
  unsub = await c.collection("sync_blob").subscribe("*", (e) => { if (e.action !== "delete") queueApply(e.record); });
  unsubFiles = await c.collection("sync_file").subscribe("*", (e) => { if (e.action !== "delete") onFileEvent(e.record); });
  // The SSE stream came (back) — pull whatever we missed while it was down. Connects within the first seconds are the
  // stream opening for this subscription (the initial pull just ran); the SDK re-submits the subscriptions itself.
  const t0 = Date.now();
  unsubConnect = await c.realtime.subscribe("PB_CONNECT", () => { tr("pb-connect", { age: Date.now() - t0 }); if (Date.now() - t0 > 3000) resync(); });
  c.realtime.onDisconnect = () => { tr("disconnect"); if (started) markOffline(); };
  tr("subscribed");
}
async function resync() {
  if (!started || !ready()) return;
  tr("resync");
  clearTimeout(retryTimer); retryTimer = null;
  setSyncing(true);
  try {
    if (!(await Cloud.health(HEALTH_MS))) { markOffline(); return; }
    await pull();
    markOnline();
    await flush();
    await pullFiles({ force: true });
  } catch (e) { markOffline(); }
  finally { setSyncing(false); }
}

/* Store.unlockedInit calls this after the cache is decrypted and BEFORE the unlock hooks (bounded; offline → skipped). */
async function initialPull() {
  if (!S) return null;
  tr("initial-pull");
  inflight = new Map(); lastSent = new Map(); undecryptable = 0; // edits queued while locked (plain keys) stay pending
  loadMeta(); loadOutbox();
  online = false; lastOkAt = null;
  if (!Cloud.isAuthed()) { notify(); return null; }
  setSyncing(true);
  try {
    if (!(await Cloud.health(HEALTH_MS))) { notify(); return null; }
    const r = await withTimeout(pull({ initial: true }), INITIAL_PULL_MS);
    markOnline();
    return r;
  } catch (e) { console.warn("sync initial pull", e?.message || e); return null; }
  finally { setSyncing(false); }
}
/* After Store.unlockedInit (hooks done, tabs about to re-render): push what the server lacks, flush the outbox, go live. */
async function start() {
  if (!S || !Session.isUnlocked()) return;
  tr("start");
  started = true;
  pushMissing();
  if (!Cloud.isAuthed()) { notify(); return; }
  try {
    if (!online && !(await Cloud.health(HEALTH_MS))) { markOffline(); return; }
    await subscribe();
    await flush();
    await pullFiles({ force: true });
    markOnline();
  } catch (e) { console.warn("sync start", e?.message || e); markOffline(); }
}
function stop() {
  tr("stop");
  started = false;
  clearTimeout(timer); timer = null; clearTimeout(retryTimer); retryTimer = null;
  try { unsub?.(); } catch {} try { unsubFiles?.(); } catch {} try { unsubConnect?.(); } catch {}
  unsub = unsubFiles = unsubConnect = null;
  pending = new Map(); pendingFiles = new Map(); inflight = new Map(); lastSent = new Map(); // the outbox on disk (sealed) is what survives a lock
  online = false; syncing = 0; lastOkAt = null;
  notify();
}
/* 전체 파기 (원장): tombstone every server row so the other devices empty themselves. Called BEFORE the local wipe. */
async function wipeServer() {
  if (!Session.isOwner() || !Cloud.isAuthed()) throw Object.assign(new Error(t("common.ownerRequired")), { code: "owner" });
  discardPending();
  const c = await Cloud.getPB();
  const blobs = await c.collection("sync_blob").getFullList({ fields: "id,rev,deleted" });
  const live = blobs.filter(r => !r.deleted);
  for (let i = 0; i < live.length; i += BATCH_CHUNK) {
    const b = c.createBatch();
    for (const r of live.slice(i, i + BATCH_CHUNK)) b.collection("sync_blob").update(r.id, { payload: null, rev: (r.rev || 0) + 1, deleted: true, updatedBy: me() });
    await b.send();
  }
  const files = await c.collection("sync_file").getFullList({ fields: "id,deleted" });
  for (const r of files) if (!r.deleted) { try { await c.collection("sync_file").update(r.id, { deleted: true, blob: null, updatedBy: me() }); } catch (e) { console.warn("wipe file", e); } }
  return { blobs: live.length, files: files.filter(r => !r.deleted).length };
}
function discardPending() { clearTimeout(timer); timer = null; pending = new Map(); pendingFiles = new Map(); }

/* ── conflicts ring ── */
function restoreConflict(id) {
  const list = conflicts();
  const cf = list.find(x => x.id === id);
  if (!cf) return false;
  if (cf.deleted) S.remove(cf.key); else S.set(cf.key, cf.losing);
  S.set(CONFLICTS_KEY, list.filter(x => x.id !== id));
  notify();
  return true;
}
function clearConflicts() { if (S?.keys().includes(CONFLICTS_KEY)) S.remove(CONFLICTS_KEY); notify(); }

/* ── reconnect triggers (no polling while healthy: the SSE stream + these events) ── */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { if (started) resync(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && started && (!online || pending.size)) resync(); });
}

const Sync = {
  LOCAL_ONLY, META_KEY, OUTBOX_KEY, CONFLICTS_KEY, isSyncable,
  bind(bridge) { S = bridge; },
  bindFiles(bridge) { F = bridge; },
  enqueue, initialPull, start, stop, resync, now: resync, flush, pullFiles, wipeServer, discardPending,
  filePut(id) { pendingFiles.set(id, "put"); schedule(); notify(); },
  fileDel(id) { pendingFiles.set(id, "del"); schedule(); notify(); },
  conflicts, restoreConflict, clearConflicts,
  onChange(fn) { listeners.push(fn); },
  trace() { return trace.slice(); },
  meta() { return { lastSyncAt: meta.lastSyncAt, keys: Object.keys(meta.revs).length - meta.tombs.length, tombs: meta.tombs.length }; },
  state() {
    return {
      enabled: ready(), started, online: online && ready(), syncing: syncing > 0, lastOkAt, lastSyncAt: meta.lastSyncAt,
      pending: pending.size + pendingFiles.size, conflicts: conflicts().length,
      serverKeys: Math.max(0, Object.keys(meta.revs).length - meta.tombs.length), files: fileCount, undecryptable,
      pendingKeys: [...pending.keys(), ...[...pendingFiles.keys()].map(id => "file:" + id)], lastError
    };
  }
};
export { Sync, isSyncable, LOCAL_ONLY };
