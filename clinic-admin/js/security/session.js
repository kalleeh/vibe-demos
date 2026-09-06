/* clinic-admin — workspace session: users, PIN-wrapped master key, lock state, session persistence.
   No DOM, no Store (sits BELOW store.js in the import DAG: dom → crypto → session → attachments → store …).
   The lock screen UI lives in ./lockscreen.js; the idle/visibility/expiry timers live there too.

   Persisted (localStorage `vibe.clinic-admin.__ws`, plaintext by necessity — it IS the key ring):
     { v:1, id, created, autolockMin, sessionMode,
       users: [{ id, name, role, staffId, created, salt, iterations, wrapped:{v,iv,ct},
                 aiConsent: {at, version} | null, fails, lockedUntil }] }
   `staffId` (since the entities pass) links the login to its roster row in core/entities.js Staff — the roster
   is the source of truth for who a person is; the keyring keeps only what the lock screen needs while LOCKED
   (name + system role, plaintext) plus the wrapped key. `role` here is the SYSTEM role (원장 · 행정 · 원무),
   not the job (한의사 · 간호사 …), which lives on the staff row.

   SESSION PERSISTENCE (2026-09). A PIN entry unwraps the master key to raw bytes, which are immediately imported
   as a NON-EXTRACTABLE AES-GCM CryptoKey — the "session key" — and stored in IndexedDB
   (`vibe-clinic-admin-session` / store `session` / key "current") together with
     { userId, staffId, unlockedAt, expiresAt, lastActiveAt, nonce }.
   restore() at boot resumes an unlocked session without the PIN while ALL of these hold:
     · now < expiresAt        — absolute length: sessionMode "1h" | "4h" | "8h" (default) | "tab"
     · now − lastActiveAt < autolockMin  — the idle bound (lastActiveAt is refreshed by touch(), throttled ≥30 s)
     · sessionMode "tab" → the record's nonce must equal the one in sessionStorage (a closed tab loses it)
     · the record's user still exists in the keyring
   Anything else → the record is deleted and the PIN pane shows. lock() / destroy() / removeUser / PIN change /
   resetPin / backup restore all delete the record. A BroadcastChannel tells other tabs about lock/unlock so
   they lock together (and a locked tab resumes when another tab unlocks).

   RAW KEY. The session key cannot be exported, and the raw bytes are dropped right after import. Wrapping the
   master key for ANOTHER PIN (addUser · changeOwnPin · resetPin) therefore needs a fresh PIN entry: requireRaw()
   returns the bytes from a short in-memory GRANT (RAW_GRANT_MS after the last PIN entry in THIS page load —
   never persisted, cleared on lock) or asks the lock screen to run the "PIN 재확인" dialog (setReauthPrompt).
   A session resumed from IndexedDB has no grant — exactly the case where re-auth matters.

   Wrong-PIN backoff (unlock AND re-auth): 1 s → 2 s → 4 s → 8 s, the 5th failure locks the user for 60 s.
   Persisted so a reload does not reset it. */
import { generateMasterRaw, importSessionKey, wrapMaster, unwrapMaster, randomBytes, b64 } from "./crypto.js";
import { t } from "../core/i18n.js"; // leaf module — keeps session.js below store.js in the DAG

const META_KEY = "vibe.clinic-admin.__ws";
const ROLES = ["원장", "행정", "원무"];
const PIN_RE = /^\d{4,8}$/;
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

let sessionKey = null;  // non-extractable CryptoKey | null
let currentUser = null; // { id, name, role, staffId } | null
let record = null;      // in-memory copy of the IDB record (without the key)
let rawGrant = null;    // { raw: Uint8Array, at } | null — memory only, never persisted
let reauthPrompt = null; // set by lockscreen.js: () => Promise<Uint8Array | null>
let lastTouchWrite = 0;
const listeners = [];

function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "null"); } catch { return null; }
}
function writeMeta(meta) { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
function notify(what, extra) { for (const fn of listeners) { try { fn(what, extra); } catch (e) { console.error(e); } } }
const hex = (n) => Array.from(randomBytes(n)).map(b => b.toString(16).padStart(2, "0")).join("");
const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role, staffId: u.staffId || null, created: u.created, aiConsent: u.aiConsent || null, lockedUntil: u.lockedUntil || 0, fails: u.fails || 0 });
const asCurrent = (u) => ({ id: u.id, name: u.name, role: u.role, staffId: u.staffId || null });
const err = (msg, extra) => Object.assign(new Error(msg), extra);

function assertUnlocked() { if (!sessionKey || !currentUser) throw err("locked", { code: "locked" }); }
function assertPin(pin) { if (!PIN_RE.test(String(pin))) throw err(t("lock.errPinFormat"), { code: "pin-format" }); }
function assertName(name) { if (!name || String(name).trim().length < 1 || String(name).length > 20) throw err(t("lock.errName"), { code: "name-format" }); }
function assertRole(role) { if (!ROLES.includes(role)) throw err(t("lock.errRole"), { code: "role" }); }

async function makeUser({ name, role, pin, staffId = null }, raw) {
  assertName(name); assertRole(role); assertPin(pin);
  const w = await wrapMaster(raw, pin);
  return { id: "u-" + hex(6), name: String(name).trim(), role, staffId: staffId || null, created: Date.now(), ...w, aiConsent: null, fails: 0, lockedUntil: 0 };
}

/* ── PIN verification with the persisted backoff (shared by unlock() and re-auth) → raw master bytes ── */
async function verifyUserPin(meta, u, pin) {
  const now = Date.now();
  if (u.lockedUntil && u.lockedUntil > now) throw err("backoff", { code: "backoff", until: u.lockedUntil });
  if (!PIN_RE.test(String(pin))) throw err("pin-format", { code: "pin-format" });
  try {
    const raw = await unwrapMaster(u, pin);
    u.fails = 0; u.lockedUntil = 0; writeMeta(meta);
    return raw;
  } catch (e) {
    if (e && e.code) throw e;
    u.fails = (u.fails || 0) + 1;
    const delay = u.fails >= MAX_FAILS ? LOCKOUT_MS : Math.pow(2, u.fails - 1) * 1000;
    u.lockedUntil = now + delay;
    if (u.fails >= MAX_FAILS) u.fails = 0;
    writeMeta(meta);
    throw err("wrong-pin", { code: "wrong-pin", until: u.lockedUntil, fails: u.fails, delay });
  }
}

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
const modeOf = (meta) => (meta && meta.sessionMode in SESSION_MODES ? meta.sessionMode : DEFAULT_MODE);
function tabNonce(create) {
  try {
    let n = sessionStorage.getItem(NONCE_KEY);
    if (!n && create) { n = hex(16); sessionStorage.setItem(NONCE_KEY, n); }
    return n || null;
  } catch { return null; }
}
async function persistSession(unlockedAt = Date.now()) {
  const meta = readMeta(); if (!meta || !sessionKey || !currentUser) return;
  const mode = modeOf(meta);
  const now = Date.now();
  record = { userId: currentUser.id, staffId: currentUser.staffId || null, unlockedAt, expiresAt: unlockedAt + SESSION_MODES[mode], lastActiveAt: now, mode, nonce: mode === "tab" ? tabNonce(true) : null };
  lastTouchWrite = now;
  await idbPut({ key: sessionKey, ...record });
}
function dropGrant() { if (rawGrant) { try { rawGrant.raw.fill(0); } catch {} rawGrant = null; } }
function grant(raw) { dropGrant(); rawGrant = { raw, at: Date.now() }; }
async function adoptRaw(raw, user, { persist = true, reason } = {}) {
  sessionKey = await importSessionKey(raw);
  currentUser = asCurrent(user);
  grant(raw); // the caller just typed a PIN — key management stays PIN-free for RAW_GRANT_MS in this page load
  if (persist) await persistSession(); else { record = null; await idbDelete(); }
  notify("unlocked", reason);
  post({ state: "unlocked" });
}
function lockLocal(reason) {
  if (!sessionKey && !currentUser) return;
  sessionKey = null; currentUser = null; record = null; dropGrant();
  idbDelete();
  notify("locked", reason);
}

const Session = {
  ROLES, PIN_RE, SESSION_DB, SESSION_STORE, SESSION_MODES, RAW_GRANT_MS,
  exists() { const m = readMeta(); return !!(m && Array.isArray(m.users) && m.users.length); },
  meta() { return readMeta(); },
  users() { const m = readMeta(); return m ? m.users.map(publicUser) : []; },
  workspaceId() { return readMeta()?.id || null; },
  autolockMin() { return readMeta()?.autolockMin || 10; },
  sessionMode() { return modeOf(readMeta()); },
  sessionLengthMs() { return SESSION_MODES[this.sessionMode()]; },
  expiresAt() { return record?.expiresAt || null; },
  // The stored record WITHOUT the key (processing register). null when no session is persisted.
  async sessionRecord() { const r = await idbGet(); return r ? { userId: r.userId, unlockedAt: r.unlockedAt, expiresAt: r.expiresAt, lastActiveAt: r.lastActiveAt, mode: r.mode, extractable: r.key?.extractable ?? null } : null; },
  isUnlocked() { return !!sessionKey; },
  key() { return sessionKey; },
  user() { return currentUser ? { ...currentUser } : null; },
  isOwner() { return currentUser?.role === "원장"; },
  onChange(fn) { listeners.push(fn); },

  /* First run: new master key + first user; unlocks immediately. */
  async create({ name, role, pin }) {
    if (this.exists()) throw new Error("workspace-exists");
    const raw = generateMasterRaw();
    const user = await makeUser({ name, role, pin }, raw);
    writeMeta({ v: 1, id: hex(16), created: Date.now(), autolockMin: 10, sessionMode: DEFAULT_MODE, users: [user] });
    await adoptRaw(raw, user);
    return this.user();
  },

  async unlock(userId, pin) {
    const meta = readMeta();
    const u = meta?.users.find(x => x.id === userId);
    if (!u) throw err("no-user", { code: "no-user" });
    const raw = await verifyUserPin(meta, u, pin); // throws backoff / pin-format / wrong-pin
    await adoptRaw(raw, u);
    return this.user();
  },

  /* Boot: resume from the IndexedDB record if every bound holds. Resolves true when the session is unlocked
     (emits "unlocked" with reason "restored" so the UI can tell it apart from a PIN entry). */
  async restore() {
    if (sessionKey) return true;
    const meta = readMeta();
    if (!meta || !Array.isArray(meta.users) || !meta.users.length) return false; // no workspace — do not even create the DB
    const rec = await idbGet();
    if (!rec) return false;
    const u = meta.users.find(x => x.id === rec.userId);
    const now = Date.now();
    const mode = modeOf(meta);
    const idleMs = (meta.autolockMin || 10) * 60000;
    const ok = u && rec.key && typeof rec.key === "object" && (typeof CryptoKey === "undefined" || rec.key instanceof CryptoKey) && rec.key.extractable === false
      && typeof rec.expiresAt === "number" && now < rec.expiresAt
      && typeof rec.lastActiveAt === "number" && now - rec.lastActiveAt < idleMs
      && (mode !== "tab" || (rec.nonce && rec.nonce === tabNonce(false)));
    if (!ok) { await idbDelete(); return false; }
    sessionKey = rec.key; currentUser = asCurrent(u);
    record = { userId: rec.userId, staffId: rec.staffId || null, unlockedAt: rec.unlockedAt, expiresAt: rec.expiresAt, lastActiveAt: now, mode, nonce: rec.nonce || null };
    lastTouchWrite = now;
    idbPut({ key: sessionKey, ...record });
    notify("unlocked", "restored");
    return true;
  },

  /* Activity → lastActiveAt, written at most every TOUCH_MIN_MS. */
  touch() {
    if (!sessionKey || !record) return;
    const now = Date.now();
    if (now - lastTouchWrite < TOUCH_MIN_MS) return;
    lastTouchWrite = now;
    record.lastActiveAt = now;
    idbPut({ key: sessionKey, ...record });
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
  // Re-auth for the CURRENT user (same backoff as unlock). → raw master bytes, also refreshes the grant.
  async verifyPin(pin) {
    assertUnlocked();
    const meta = readMeta();
    const u = meta.users.find(x => x.id === currentUser.id);
    if (!u) throw err("no-user", { code: "no-user" });
    const raw = await verifyUserPin(meta, u, pin);
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

  async addUser({ name, role, pin, staffId = null }) {
    assertUnlocked();
    const meta = readMeta();
    if (meta.users.length >= 12) throw new Error(t("users.errMax"));
    assertName(name); assertRole(role); assertPin(pin);
    const raw = await this.requireRaw();
    const user = await makeUser({ name, role, pin, staffId }, raw);
    meta.users.push(user); writeMeta(meta); notify("users");
    return publicUser(user);
  },

  removeUser(userId) {
    assertUnlocked();
    const meta = readMeta();
    if (meta.users.length <= 1) throw new Error(t("users.errLast"));
    if (userId === currentUser.id) throw new Error(t("users.errSelf"));
    if (!this.isOwner()) throw new Error(t("common.ownerRequired"));
    meta.users = meta.users.filter(u => u.id !== userId); writeMeta(meta);
    record = null; idbDelete(); // keyring changed → the next reload asks for a PIN
    notify("users");
  },

  async changeOwnPin(oldPin, newPin) {
    assertUnlocked(); assertPin(newPin);
    let raw;
    try { raw = await this.verifyPin(oldPin); }
    catch (e) { throw err(e.code === "backoff" || e.code === "wrong-pin" ? t("users.errOldPin") : (e.message || String(e)), { code: e.code || "wrong-pin", until: e.until }); }
    const meta = readMeta();
    const u = meta.users.find(x => x.id === currentUser.id);
    Object.assign(u, await wrapMaster(raw, newPin));
    writeMeta(meta);
    record = null; await idbDelete();
    notify("users");
  },

  /* 원장 re-wraps the master key under a new PIN for another user (needs the raw key → re-auth). */
  async resetPin(userId, newPin) {
    assertUnlocked(); assertPin(newPin);
    if (!this.isOwner()) throw new Error(t("common.ownerRequired"));
    const meta0 = readMeta();
    if (!meta0.users.find(x => x.id === userId)) throw new Error("no-user");
    const raw = await this.requireRaw();
    const meta = readMeta();
    const u = meta.users.find(x => x.id === userId);
    if (!u) throw new Error("no-user");
    Object.assign(u, await wrapMaster(raw, newPin), { fails: 0, lockedUntil: 0 });
    writeMeta(meta);
    record = null; await idbDelete();
    notify("users");
  },

  updateUser(userId, patch) {
    const meta = readMeta();
    const u = meta?.users.find(x => x.id === userId);
    if (!u) throw new Error("no-user");
    if ("aiConsent" in patch) u.aiConsent = patch.aiConsent;
    if (patch.name != null) { assertName(patch.name); u.name = String(patch.name).trim(); }
    if (patch.role != null) { assertRole(patch.role); u.role = patch.role; }
    writeMeta(meta);
    if (currentUser && currentUser.id === userId) currentUser = asCurrent(u);
    notify("users");
    return publicUser(u);
  },
  /* Roster link (core/entities.js Staff). Plain keyring write — the id is opaque, never a name. */
  linkStaff(userId, staffId) {
    const meta = readMeta();
    const u = meta?.users.find(x => x.id === userId);
    if (!u) throw new Error("no-user");
    u.staffId = staffId || null;
    writeMeta(meta);
    if (currentUser && currentUser.id === userId) currentUser = asCurrent(u);
    notify("users");
  },

  setAutolock(min) {
    const meta = readMeta(); if (!meta) return;
    meta.autolockMin = [5, 10, 30].includes(Number(min)) ? Number(min) : 10;
    writeMeta(meta); notify("users");
  },
  /* Absolute session length — 원장 only. Re-persists the live record so the new bound applies at once. */
  async setSessionMode(mode) {
    assertUnlocked();
    if (!this.isOwner()) throw new Error(t("common.ownerRequired"));
    const meta = readMeta(); if (!meta) return;
    meta.sessionMode = mode in SESSION_MODES ? mode : DEFAULT_MODE;
    writeMeta(meta);
    if (record) await persistSession(record.unlockedAt);
    notify("users");
  },

  /* Backup/restore + 전체 파기 */
  exportKeyring() { return readMeta(); },
  importKeyring(meta) {
    if (!meta || meta.v !== 1 || !Array.isArray(meta.users) || !meta.users.length || !meta.id) throw new Error("bad-keyring");
    writeMeta(meta); notify("users");
  },
  // Verifies a PIN against a keyring that is NOT installed yet (backup restore) → raw master bytes.
  async unwrapFromKeyring(meta, userId, pin) {
    const u = meta.users.find(x => x.id === userId);
    if (!u) throw new Error("no-user");
    return unwrapMaster(u, pin);
  },
  // Restore path: adopt raw bytes without going through unlock(). NOT persisted — the next reload asks for the PIN.
  async adopt(raw, user) { await adoptRaw(raw, user, { persist: false, reason: "restore" }); },
  async destroy() {
    sessionKey = null; currentUser = null; record = null; dropGrant();
    try { localStorage.removeItem(META_KEY); } catch {}
    try { sessionStorage.removeItem(NONCE_KEY); } catch {}
    await idbDrop();
    notify("locked", "destroyed");
    post({ state: "locked", reason: "destroyed" });
  }
};

export { Session, META_KEY, ROLES, b64 };
