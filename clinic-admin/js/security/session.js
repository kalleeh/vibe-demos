/* clinic-admin — session: server identity (Cloud), PIN-unwrapped master key, lock state, session persistence.
   No DOM, no Store (sits BELOW store.js in the import DAG: dom → crypto → cloud → session → attachments → store …).
   The lock screen UI lives in ./lockscreen.js; the idle/visibility/expiry timers live there too.

   SHARED IDENTITY (step A, 2026-09). The keyring moved to the server (js/security/cloud.js): users, their PIN-derived
   passwords and their PIN-wrapped copies of the ONE clinic master key live in PocketBase; every device shows the same
   user dropdown (workspace.directory, public read) and unlocks by authenticating the PIN against the server.
     unlock  = Cloud.login(userId, PIN)  → PB token + this user's `wrapped`  → unwrapMaster(wrapped, PIN) → raw master
               bytes → importSessionKey → NON-EXTRACTABLE session key (persisted in IndexedDB, see below).
     The PIN itself never leaves the browser: the server sees base64(PBKDF2-SHA256(PIN, workspace.salt, 310k)).
   What stays LOCAL (plaintext localStorage `vibe.clinic-admin.__lock`, no names):
     { v:2, autolockMin, sessionMode, backoff: { [userId]: { fails, lockedUntil } }, consent: { [userId]: { at, version } } }
   The pre-cloud keyring (`vibe.clinic-admin.__ws`) is only read by the bootstrap-from-legacy path and deleted after it.

   SESSION PERSISTENCE. The IndexedDB record (`vibe-clinic-admin-session` / `session` / "current") holds
     { key (non-extractable CryptoKey), userId, staffId, unlockedAt, expiresAt, lastActiveAt, mode, nonce,
       sealed: AES-GCM(key, { name, role, pbAuth, wrapped, directory, workspace }) }
   i.e. the PocketBase token, my wrapped key (for offline PIN 재확인) and the directory snapshot are stored ONLY inside
   the session record and ONLY as ciphertext under the session key. restore() at boot resumes without the PIN and
   WITHOUT the server while all bounds hold (absolute length by sessionMode "1h" | "4h" | "8h" | "tab"; idle bound
   autolockMin; "tab" → nonce == sessionStorage nonce). When online it then verifies the token in the background —
   a PIN reset or a removed login on another device locks this one ("revoked").

   RAW KEY. Wrapping the master key for ANOTHER PIN (addUser · changeOwnPin · resetPin · completePinChange) needs the raw
   bytes: requireRaw() returns them from a short in-memory GRANT (RAW_GRANT_MS after the last PIN entry in THIS page
   load) or asks the lock screen for a "PIN 재확인" (setReauthPrompt) — verified OFFLINE against my cached `wrapped`.

   Wrong-PIN backoff (unlock AND re-auth), per user, per device: 1 s → 2 s → 4 s → 8 s, the 5th failure locks the user
   for 60 s; persisted in __lock so a reload does not reset it. The server adds its own rate limit (12 auth / 10 s / IP).
   PIN policy: 6–8 digits (raised from 4). */
import { generateMasterRaw, importSessionKey, wrapMaster, unwrapMaster, randomBytes, b64, encryptJSON, decryptJSON } from "./crypto.js";
import { Cloud } from "./cloud.js";
import { t } from "../core/i18n.js"; // leaf module — keeps session.js below store.js in the DAG

const LEGACY_KEY = "vibe.clinic-admin.__ws";
const LOCAL_KEY = "vibe.clinic-admin.__lock";
const ROLES = ["원장", "행정", "원무"];
const PIN_RE = /^\d{6,8}$/;
const MAX_FAILS = 5;
const LOCKOUT_MS = 60000;
const SESSION_DB = "vibe-clinic-admin-session";
const SESSION_STORE = "session";
const SESSION_ID = "current";
const SESSION_MODES = { "1h": 3600000, "4h": 4 * 3600000, "8h": 8 * 3600000, tab: 8 * 3600000 }; // "tab" is also capped at 8 h
const DEFAULT_MODE = "8h";
const TOUCH_MIN_MS = 30000;
const RAW_GRANT_MS = 5 * 60000;
const NONCE_KEY = "vibe.clinic-admin.session-nonce";
const CHANNEL = "vibe.clinic-admin.session";

let sessionKey = null;   // non-extractable CryptoKey | null
let currentUser = null;  // { id, name, role, staffId } | null
let record = null;       // in-memory copy of the IDB record (without key + sealed)
let rawGrant = null;     // { raw: Uint8Array, at } | null — memory only, never persisted
let reauthPrompt = null; // set by lockscreen.js: () => Promise<Uint8Array | null>
let lastTouchWrite = 0;
let directory = [];      // workspace.directory snapshot [{ id, staffId, name, role }]
let workspace = null;    // { slug, name, salt, bootstrapped } | null
let wrappedMine = null;  // my { salt, iterations, wrapped } — offline PIN 재확인
let pending = null;      // { raw, user, wrapped, pin } between a temp-PIN login and the forced new PIN
const listeners = [];

function readLocal() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null") || { v: 2 }; } catch { return { v: 2 }; } }
function writeLocal(o) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ v: 2, ...o })); } catch {} }
function readLegacy() { try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || "null"); } catch { return null; } }
function notify(what, extra) { for (const fn of listeners) { try { fn(what, extra); } catch (e) { console.error(e); } } }
const hex = (n) => Array.from(randomBytes(n)).map(b => b.toString(16).padStart(2, "0")).join("");
const err = (msg, extra) => Object.assign(new Error(msg), extra);
const asCurrent = (u) => ({ id: u.id, name: u.name, role: u.role, staffId: u.staffId || null });
function publicUser(d) {
  const L = readLocal();
  const bo = L.backoff?.[d.id] || {};
  return { id: d.id, name: d.name, role: d.role, staffId: d.staffId || null, aiConsent: L.consent?.[d.id] || null, lockedUntil: bo.lockedUntil || 0, fails: bo.fails || 0 };
}

function assertUnlocked() { if (!sessionKey || !currentUser) throw err("locked", { code: "locked" }); }
function assertPin(pin) { if (!PIN_RE.test(String(pin))) throw err(t("lock.errPinFormat"), { code: "pin-format" }); }
function assertName(name) { if (!name || String(name).trim().length < 1 || String(name).length > 20) throw err(t("lock.errName"), { code: "name-format" }); }
function assertRole(role) { if (!ROLES.includes(role)) throw err(t("lock.errRole"), { code: "role" }); }
function assertOwner() { if (currentUser?.role !== "원장") throw err(t("common.ownerRequired"), { code: "owner" }); }
// Server / network errors → the user-facing message (code kept for the UI).
function cloudErr(e) {
  if (e?.code === "wrong-pin" || e?.code === "backoff" || e?.code === "pin-format" || e?.code === "locked" || e?.code === "owner" || e?.code === "no-user") throw e;
  const key = e?.code === "offline" ? "cloud.errOffline" : e?.code === "rate" ? "cloud.errRate" : e?.code === "forbidden" ? "cloud.errForbidden"
    : e?.code === "conflict" ? "cloud.errConflict" : e?.code === "no-workspace" ? "cloud.errNoWorkspace" : "cloud.errServer";
  throw err(t(key, { s: e?.status || 0 }), { code: e?.code || "server", status: e?.status });
}

/* ── wrong-PIN backoff, per user, persisted locally ── */
function backoffCheck(userId) {
  const bo = readLocal().backoff?.[userId];
  if (bo?.lockedUntil && bo.lockedUntil > Date.now()) throw err("backoff", { code: "backoff", until: bo.lockedUntil });
}
function backoffFail(userId) {
  const L = readLocal(); L.backoff = L.backoff || {};
  const bo = L.backoff[userId] || { fails: 0, lockedUntil: 0 };
  bo.fails = (bo.fails || 0) + 1;
  const delay = bo.fails >= MAX_FAILS ? LOCKOUT_MS : Math.pow(2, bo.fails - 1) * 1000;
  bo.lockedUntil = Date.now() + delay;
  const fails = bo.fails;
  if (bo.fails >= MAX_FAILS) bo.fails = 0;
  L.backoff[userId] = bo; writeLocal(L);
  return err("wrong-pin", { code: "wrong-pin", until: bo.lockedUntil, fails, delay });
}
function backoffClear(userId) { const L = readLocal(); if (L.backoff?.[userId]) { delete L.backoff[userId]; writeLocal(L); } }

/* ── IndexedDB session store ── */
let dbp = null;
function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    let r;
    try { r = indexedDB.open(SESSION_DB, 1); } catch (e) { dbp = null; return rej(e); }
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE); };
    r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); dbp = null; }; res(r.result); };
    r.onerror = () => { dbp = null; rej(r.error); };
  });
  return dbp;
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function idbGet() { try { const db = await openDb(); return await req(db.transaction(SESSION_STORE).objectStore(SESSION_STORE).get(SESSION_ID)); } catch { return null; } }
async function idbPut(rec) { try { const db = await openDb(); await req(db.transaction(SESSION_STORE, "readwrite").objectStore(SESSION_STORE).put(rec, SESSION_ID)); } catch (e) { console.warn("session store write", e); } }
async function idbDelete() { try { const db = await openDb(); await req(db.transaction(SESSION_STORE, "readwrite").objectStore(SESSION_STORE).delete(SESSION_ID)); } catch {} }
async function idbDrop() {
  try { if (dbp) { (await dbp).close(); dbp = null; } } catch {}
  await new Promise((res) => { let r; try { r = indexedDB.deleteDatabase(SESSION_DB); } catch { return res(); } r.onsuccess = r.onerror = r.onblocked = () => res(); });
}

/* ── cross-tab ── */
let bc = null;
try { bc = new BroadcastChannel(CHANNEL); } catch {}
const post = (msg) => { if (bc) try { bc.postMessage(msg); } catch {} };
if (bc) bc.onmessage = (e) => {
  const m = e.data || {};
  if (m.state === "locked" && sessionKey) lockLocal(m.reason === "destroyed" ? "destroyed" : "peer");
  else if (m.state === "unlocked" && !sessionKey) Session.restore().catch(() => {});
};

/* ── session record ── */
const modeOf = () => { const m = readLocal().sessionMode; return m in SESSION_MODES ? m : DEFAULT_MODE; };
function tabNonce(create) {
  try {
    let n = sessionStorage.getItem(NONCE_KEY);
    if (!n && create) { n = hex(16); sessionStorage.setItem(NONCE_KEY, n); }
    return n || null;
  } catch { return null; }
}
async function sealState() {
  return encryptJSON(sessionKey, { name: currentUser.name, role: currentUser.role, pbAuth: Cloud.serialized(), wrapped: wrappedMine, directory, workspace });
}
async function persistSession(unlockedAt = Date.now()) {
  if (!sessionKey || !currentUser) return;
  const mode = modeOf();
  const now = Date.now();
  record = { userId: currentUser.id, staffId: currentUser.staffId || null, unlockedAt, expiresAt: unlockedAt + SESSION_MODES[mode], lastActiveAt: now, mode, nonce: mode === "tab" ? tabNonce(true) : null };
  lastTouchWrite = now;
  await idbPut({ key: sessionKey, ...record, sealed: await sealState() });
}
function dropGrant() { if (rawGrant) { try { rawGrant.raw.fill(0); } catch {} rawGrant = null; } }
function grant(raw) { dropGrant(); rawGrant = { raw, at: Date.now() }; }
async function adoptRaw(raw, user, { persist = true, reason, wrapped = null } = {}) {
  sessionKey = await importSessionKey(raw);
  currentUser = asCurrent(user);
  if (wrapped) wrappedMine = wrapped;
  grant(raw); // the caller just typed a PIN — key management stays PIN-free for RAW_GRANT_MS in this page load
  if (persist) await persistSession(); else { record = null; await idbDelete(); }
  notify("unlocked", reason);
  post({ state: "unlocked" });
}
function lockLocal(reason) {
  if (!sessionKey && !currentUser) return;
  sessionKey = null; currentUser = null; record = null; wrappedMine = null; dropGrant();
  Cloud.logout();
  idbDelete();
  notify("locked", reason);
}
// Token refreshed / changed while unlocked → re-seal the record (keeps unlockedAt).
Cloud.onAuthChange(() => { if (sessionKey && record && Cloud.isAuthed()) persistSession(record.unlockedAt).catch(() => {}); });

/* Background, after a resume: is the token still good, did the directory change? Network errors are ignored
   (offline resume is a feature); a revoked login (PIN reset · removed · workspace gone) locks this device. */
async function verifyResumed() {
  if (!(await Cloud.health(3000))) return;
  try {
    const me = await Cloud.verify();
    if (me && currentUser && (me.name !== currentUser.name || me.role !== currentUser.role)) { currentUser = asCurrent({ ...currentUser, ...me }); notify("users"); }
  } catch (e) {
    if (e.code === "forbidden" || e.code === "not-found") { if (sessionKey) { lockLocal("revoked"); post({ state: "locked", reason: "revoked" }); } }
    return;
  }
  try { await Session.refreshDirectory(); } catch {}
}

const Session = {
  ROLES, PIN_RE, SESSION_DB, SESSION_STORE, SESSION_MODES, RAW_GRANT_MS, LEGACY_KEY, LOCAL_KEY,
  /* ── identity state ── */
  users() { return directory.map(publicUser); },
  workspace() { return workspace ? { ...workspace } : null; },
  workspaceName() { return workspace?.name || ""; },
  workspaceId() { return workspace?.slug || null; },
  isBootstrapped() { return !!workspace?.bootstrapped; },
  autolockMin() { return readLocal().autolockMin || 10; },
  sessionMode() { return modeOf(); },
  sessionLengthMs() { return SESSION_MODES[this.sessionMode()]; },
  expiresAt() { return record?.expiresAt || null; },
  // The stored record WITHOUT the key / sealed blob (processing register). null when no session is persisted.
  async sessionRecord() { const r = await idbGet(); return r ? { userId: r.userId, unlockedAt: r.unlockedAt, expiresAt: r.expiresAt, lastActiveAt: r.lastActiveAt, mode: r.mode, extractable: r.key?.extractable ?? null, sealed: !!r.sealed } : null; },
  isUnlocked() { return !!sessionKey; },
  key() { return sessionKey; },
  user() { return currentUser ? { ...currentUser } : null; },
  isOwner() { return currentUser?.role === "원장"; },
  isAuthed() { return Cloud.isAuthed(); },
  onChange(fn) { listeners.push(fn); },
  hasPending() { return !!pending; },
  pendingUser() { return pending ? asCurrent(pending.user) : null; },

  /* Lock screen boot: ask the server for the workspace (public). → { reachable, workspace } */
  async probe() {
    try { workspace = await Cloud.workspace(); }
    catch (e) { return { reachable: false, workspace: null, error: e }; }
    directory = workspace?.directory || [];
    notify("users");
    return { reachable: true, workspace };
  },
  async refreshDirectory() {
    const ws = await Cloud.workspace();
    const before = JSON.stringify(directory);
    workspace = ws; directory = ws?.directory || [];
    if (JSON.stringify(directory) !== before) { notify("users"); if (record) await persistSession(record.unlockedAt); }
    return this.users();
  },
  /* The pre-cloud keyring on THIS device (bootstrap-from-legacy offer), or null. */
  legacy() {
    const m = readLegacy();
    if (!m || !Array.isArray(m.users) || !m.users.length) return null;
    return { id: m.id, users: m.users.map(u => ({ id: u.id, name: u.name, role: u.role, staffId: u.staffId || null })) };
  },

  /* First run of the INSTANCE: new master key + first 원장 on the server; unlocks immediately. */
  async bootstrap({ workspaceName, name, pin }) {
    assertName(name); assertPin(pin);
    const raw = generateMasterRaw();
    const salt = b64(randomBytes(16));
    const w = await wrapMaster(raw, pin);
    const staffId = "st-" + Date.now().toString(36) + "-" + hex(3);
    let res;
    try { res = await Cloud.bootstrap({ workspaceName: String(workspaceName || "").trim(), name: String(name).trim(), staffId, pin, salt, wrapped: w }); }
    catch (e) { cloudErr(e); }
    workspace = res.workspace; directory = res.workspace.directory;
    await adoptRaw(raw, res.user, { wrapped: res.wrapped });
    return this.user();
  },
  /* This device's legacy workspace → the server, with the SAME master key (local encrypted data stays readable).
     Only the chosen 원장 moves (its PIN unwraps the key); other legacy users are re-issued by the owner. */
  async bootstrapFromLegacy({ workspaceName, legacyUserId, oldPin, newPin }) {
    const meta = readLegacy();
    const u = meta?.users?.find(x => x.id === legacyUserId);
    if (!u) throw err("no-user", { code: "no-user" });
    const pin = String(newPin || oldPin);
    assertPin(pin);
    let raw;
    try { raw = await unwrapMaster(u, oldPin); } catch { throw err("wrong-pin", { code: "wrong-pin" }); }
    const salt = b64(randomBytes(16));
    const w = await wrapMaster(raw, pin);
    const staffId = u.staffId || ("st-" + Date.now().toString(36) + "-" + hex(3));
    let res;
    try { res = await Cloud.bootstrap({ workspaceName: String(workspaceName || "").trim(), name: u.name, staffId, pin, salt, wrapped: w }); }
    catch (e) { cloudErr(e); }
    workspace = res.workspace; directory = res.workspace.directory;
    // Carry the device's lock settings over; the old keyring (other users' wrapped keys) is gone for good.
    const L = readLocal(); if (meta.autolockMin) L.autolockMin = meta.autolockMin; if (meta.sessionMode) L.sessionMode = meta.sessionMode; writeLocal(L);
    try { localStorage.removeItem(LEGACY_KEY); } catch {}
    await adoptRaw(raw, res.user, { wrapped: res.wrapped });
    return { user: this.user(), skipped: meta.users.length - 1 };
  },

  /* Unlock = server PIN auth + unwrap. Resolves the user, or { mustChangePin: true } (then completePinChange). */
  async unlock(userId, pin) {
    if (!directory.find(x => x.id === userId)) throw err("no-user", { code: "no-user" });
    backoffCheck(userId);
    if (!PIN_RE.test(String(pin))) throw err("pin-format", { code: "pin-format" });
    let res;
    try { res = await Cloud.login(userId, pin); }
    catch (e) { if (e.code === "wrong-pin") throw backoffFail(userId); cloudErr(e); }
    backoffClear(userId);
    let raw;
    try { raw = await unwrapMaster(res.wrapped, pin); }
    catch { throw err(t("cloud.errKeyMismatch"), { code: "key-mismatch" }); }
    workspace = res.workspace; directory = res.workspace.directory;
    if (res.user.mustChangePin) { pending = { raw, user: res.user, wrapped: res.wrapped, pin: String(pin) }; return { mustChangePin: true, user: asCurrent(res.user) }; }
    await adoptRaw(raw, res.user, { wrapped: res.wrapped });
    return this.user();
  },
  /* Temp-PIN login → the forced new PIN. */
  async completePinChange(newPin) {
    if (!pending) throw err("no-pending", { code: "no-pending" });
    assertPin(newPin);
    if (String(newPin) === pending.pin) throw err(t("lock.errSamePin"), { code: "same-pin" });
    const w = await wrapMaster(pending.raw, newPin);
    let user;
    try { user = await Cloud.changeOwnPin(pending.pin, newPin, w); } catch (e) { cloudErr(e); }
    const p = pending; pending = null;
    await adoptRaw(p.raw, user || p.user, { wrapped: w });
    return this.user();
  },
  cancelPending() { if (pending) { try { pending.raw.fill(0); } catch {} pending = null; Cloud.logout(); } },

  /* Boot: resume from the IndexedDB record if every bound holds — no PIN, no server. Emits "unlocked" ("restored"). */
  async restore() {
    if (sessionKey) return true;
    // A clean device (fresh profile · after 전체 파기) must not grow a session DB just by looking for one.
    if (indexedDB.databases) { try { if (!(await indexedDB.databases()).some(d => d.name === SESSION_DB)) return false; } catch {} }
    const rec = await idbGet();
    if (!rec) return false;
    const now = Date.now();
    const mode = modeOf();
    const idleMs = this.autolockMin() * 60000;
    const ok = rec.key && typeof rec.key === "object" && (typeof CryptoKey === "undefined" || rec.key instanceof CryptoKey) && rec.key.extractable === false
      && rec.sealed && typeof rec.expiresAt === "number" && now < rec.expiresAt
      && typeof rec.lastActiveAt === "number" && now - rec.lastActiveAt < idleMs
      && (mode !== "tab" || (rec.nonce && rec.nonce === tabNonce(false)));
    if (!ok) { await idbDelete(); return false; }
    let open;
    try { open = await decryptJSON(rec.key, rec.sealed); } catch { await idbDelete(); return false; }
    sessionKey = rec.key;
    currentUser = { id: rec.userId, name: open.name, role: open.role, staffId: rec.staffId || null };
    wrappedMine = open.wrapped || null; directory = Array.isArray(open.directory) ? open.directory : []; workspace = open.workspace || null;
    Cloud.adoptAuth(open.pbAuth || null);
    record = { userId: rec.userId, staffId: rec.staffId || null, unlockedAt: rec.unlockedAt, expiresAt: rec.expiresAt, lastActiveAt: now, mode, nonce: rec.nonce || null };
    lastTouchWrite = now;
    idbPut({ key: sessionKey, ...record, sealed: rec.sealed });
    notify("unlocked", "restored");
    verifyResumed();
    return true;
  },

  /* Activity → lastActiveAt, written at most every TOUCH_MIN_MS. */
  touch() {
    if (!sessionKey || !record) return;
    const now = Date.now();
    if (now - lastTouchWrite < TOUCH_MIN_MS) return;
    lastTouchWrite = now;
    record.lastActiveAt = now;
    sealState().then((sealed) => idbPut({ key: sessionKey, ...record, sealed })).catch(() => {});
  },

  lock(reason = "manual") {
    if (!sessionKey && !currentUser) return;
    lockLocal(reason);
    post({ state: "locked", reason });
  },

  /* ── raw key for key management ── */
  setReauthPrompt(fn) { reauthPrompt = fn; },
  hasRawGrant() { return !!(rawGrant && Date.now() - rawGrant.at < RAW_GRANT_MS); },
  forgetRaw() { dropGrant(); },
  // Re-auth for the CURRENT user against the cached wrapped key (offline-capable; same backoff as unlock).
  async verifyPin(pin) {
    assertUnlocked();
    if (!wrappedMine) throw err(t("lock.reauthRequired"), { code: "reauth-required" });
    backoffCheck(currentUser.id);
    if (!PIN_RE.test(String(pin))) throw err("pin-format", { code: "pin-format" });
    let raw;
    try { raw = await unwrapMaster(wrappedMine, pin); } catch { throw backoffFail(currentUser.id); }
    backoffClear(currentUser.id);
    grant(raw);
    return raw;
  },
  async requireRaw() {
    assertUnlocked();
    if (this.hasRawGrant()) return rawGrant.raw;
    if (!reauthPrompt) throw err(t("lock.reauthRequired"), { code: "reauth-required" });
    const raw = await reauthPrompt();
    if (!raw) throw err(t("lock.reauthCancelled"), { code: "reauth-cancelled" });
    return raw;
  },

  /* 원장: new login with a TEMP PIN (mustChangePin unless the demo seed says otherwise). */
  async addUser({ name, role, pin, staffId = null, mustChangePin = true }) {
    assertUnlocked(); assertOwner();
    if (directory.length >= 12) throw new Error(t("users.errMax"));
    assertName(name); assertRole(role); assertPin(pin);
    const raw = await this.requireRaw();
    const w = await wrapMaster(raw, pin);
    let res;
    try { res = await Cloud.createUser({ name: String(name).trim(), role, staffId: staffId || "", pin, wrapped: w, mustChangePin }); }
    catch (e) { cloudErr(e); }
    directory = res.directory || directory;
    if (record) await persistSession(record.unlockedAt);
    notify("users");
    return publicUser(directory.find(x => x.id === res.id) || { id: res.id, name, role, staffId });
  },

  async removeUser(userId) {
    assertUnlocked(); assertOwner();
    if (userId === currentUser.id) throw new Error(t("users.errSelf"));
    let res;
    try { res = await Cloud.deleteUser(userId); } catch (e) { cloudErr(e); }
    directory = res.directory || directory.filter(u => u.id !== userId);
    backoffClear(userId);
    if (record) await persistSession(record.unlockedAt);
    notify("users");
  },

  async changeOwnPin(oldPin, newPin) {
    assertUnlocked(); assertPin(newPin);
    let raw;
    try { raw = await this.verifyPin(oldPin); }
    catch (e) { throw err(e.code === "backoff" || e.code === "wrong-pin" || e.code === "pin-format" ? t("users.errOldPin") : (e.message || String(e)), { code: e.code || "wrong-pin", until: e.until }); }
    const w = await wrapMaster(raw, newPin);
    const keep = record; record = null; // the re-auth inside changeOwnPin fires onAuthChange — with no record it does not re-seal
    try { await Cloud.changeOwnPin(oldPin, newPin, w); } catch (e) { record = keep; cloudErr(e); }
    wrappedMine = w;
    await idbDelete(); // policy: a PIN change ends the persisted session — the next reload asks for the new PIN
    notify("users");
  },

  /* 원장 re-wraps the master key under a TEMP PIN for another user (needs the raw key → re-auth); their tokens die. */
  async resetPin(userId, newPin) {
    assertUnlocked(); assertOwner(); assertPin(newPin);
    if (!directory.find(x => x.id === userId)) throw new Error("no-user");
    const raw = await this.requireRaw();
    const w = await wrapMaster(raw, newPin);
    try { await Cloud.resetPin(userId, newPin, w); } catch (e) { cloudErr(e); }
    backoffClear(userId);
    notify("users");
  },

  /* Per-device, per-user flags (AI consent). Names/roles live on the server and are not patchable here. */
  updateUser(userId, patch) {
    const d = directory.find(x => x.id === userId) || (currentUser?.id === userId ? currentUser : null);
    if (!d) throw new Error("no-user");
    if ("aiConsent" in patch) { const L = readLocal(); L.consent = L.consent || {}; if (patch.aiConsent) L.consent[userId] = patch.aiConsent; else delete L.consent[userId]; writeLocal(L); }
    notify("users");
    return publicUser(d);
  },

  setAutolock(min) {
    const L = readLocal();
    L.autolockMin = [5, 10, 30].includes(Number(min)) ? Number(min) : 10;
    writeLocal(L); notify("users");
  },
  /* Absolute session length — 원장 only (this device). Re-persists the live record so the new bound applies at once. */
  async setSessionMode(mode) {
    assertUnlocked(); assertOwner();
    const L = readLocal();
    L.sessionMode = mode in SESSION_MODES ? mode : DEFAULT_MODE;
    writeLocal(L);
    if (record) await persistSession(record.unlockedAt);
    notify("users");
  },

  /* Backup/restore + 전체 파기 */
  // v3 keyring: the exporting user's wrapped copy of the clinic key (restore verifies it against the server).
  exportKeyring() {
    assertUnlocked();
    return { v: 3, workspace: workspace ? { slug: workspace.slug, name: workspace.name } : null, users: [{ id: currentUser.id, name: currentUser.name, role: currentUser.role, staffId: currentUser.staffId || null, ...(wrappedMine || {}) }] };
  },
  // Verifies a PIN against a backup keyring entry → raw master bytes.
  async unwrapFromKeyring(meta, userId, pin) {
    const u = meta.users.find(x => x.id === userId);
    if (!u) throw new Error("no-user");
    return unwrapMaster(u, pin);
  },
  // Restore path: adopt raw bytes without going through unlock(). NOT persisted — the next reload asks for the PIN.
  async adopt(raw, user, wrapped = null) { await adoptRaw(raw, user, { persist: false, reason: "restore", wrapped }); },
  async destroy() {
    sessionKey = null; currentUser = null; record = null; wrappedMine = null; pending = null; dropGrant();
    try { localStorage.removeItem(LOCAL_KEY); } catch {}
    try { localStorage.removeItem(LEGACY_KEY); } catch {}
    try { sessionStorage.removeItem(NONCE_KEY); } catch {}
    Cloud.logout();
    await idbDrop();
    notify("locked", "destroyed");
    post({ state: "locked", reason: "destroyed" });
  }
};

export { Session, LOCAL_KEY, LEGACY_KEY, ROLES, b64 };
