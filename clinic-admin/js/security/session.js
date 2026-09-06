/* clinic-admin — workspace session: users, PIN-wrapped master key, lock state.
   No DOM, no Store (sits BELOW store.js in the import DAG: dom → crypto → session → attachments → store …).
   The lock screen UI lives in ./lockscreen.js; the idle/visibility timers live there too.

   Persisted (localStorage `vibe.clinic-admin.__ws`, plaintext by necessity — it IS the key ring):
     { v:1, id, created, autolockMin,
       users: [{ id, name, role, created, salt, iterations, wrapped:{v,iv,ct},
                 aiConsent: {at, version} | null, fails, lockedUntil }] }
   The master key exists only in this module's closure while unlocked. Nothing here writes it
   anywhere. If every user PIN is lost the workspace is unrecoverable by design (see lockscreen copy).

   Wrong-PIN backoff: 1 s → 2 s → 4 s → 8 s, the 5th failure locks the user for 60 s. Persisted so
   a reload does not reset it. */
import { generateMasterKey, wrapMaster, unwrapMaster, randomBytes, b64 } from "./crypto.js";
import { t } from "../core/i18n.js"; // leaf module — keeps session.js below store.js in the DAG

const META_KEY = "vibe.clinic-admin.__ws";
const ROLES = ["원장", "행정", "원무"];
const PIN_RE = /^\d{4,8}$/;
const MAX_FAILS = 5;
const LOCKOUT_MS = 60000;

let masterKey = null;   // CryptoKey | null — memory only
let currentUser = null; // { id, name, role } | null
const listeners = [];

function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "null"); } catch { return null; }
}
function writeMeta(meta) { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
function notify(what, extra) { for (const fn of listeners) { try { fn(what, extra); } catch (e) { console.error(e); } } }
const hex = (n) => Array.from(randomBytes(n)).map(b => b.toString(16).padStart(2, "0")).join("");
const publicUser = (u) => ({ id: u.id, name: u.name, role: u.role, created: u.created, aiConsent: u.aiConsent || null, lockedUntil: u.lockedUntil || 0, fails: u.fails || 0 });

function assertUnlocked() { if (!masterKey || !currentUser) throw Object.assign(new Error("locked"), { code: "locked" }); }
function assertPin(pin) { if (!PIN_RE.test(String(pin))) throw Object.assign(new Error(t("lock.errPinFormat")), { code: "pin-format" }); }
function assertName(name) { if (!name || String(name).trim().length < 1 || String(name).length > 20) throw Object.assign(new Error(t("lock.errName")), { code: "name-format" }); }
function assertRole(role) { if (!ROLES.includes(role)) throw Object.assign(new Error(t("lock.errRole")), { code: "role" }); }

async function makeUser({ name, role, pin }, key) {
  assertName(name); assertRole(role); assertPin(pin);
  const w = await wrapMaster(key, pin);
  return { id: "u-" + hex(6), name: String(name).trim(), role, created: Date.now(), ...w, aiConsent: null, fails: 0, lockedUntil: 0 };
}

const Session = {
  ROLES, PIN_RE,
  exists() { const m = readMeta(); return !!(m && Array.isArray(m.users) && m.users.length); },
  meta() { return readMeta(); },
  users() { const m = readMeta(); return m ? m.users.map(publicUser) : []; },
  workspaceId() { return readMeta()?.id || null; },
  autolockMin() { return readMeta()?.autolockMin || 10; },
  isUnlocked() { return !!masterKey; },
  key() { return masterKey; },
  user() { return currentUser ? { ...currentUser } : null; },
  isOwner() { return currentUser?.role === "원장"; },
  onChange(fn) { listeners.push(fn); },

  /* First run: new master key + first user; unlocks immediately. */
  async create({ name, role, pin }) {
    if (this.exists()) throw new Error("workspace-exists");
    const key = await generateMasterKey();
    const user = await makeUser({ name, role, pin }, key);
    writeMeta({ v: 1, id: hex(16), created: Date.now(), autolockMin: 10, users: [user] });
    masterKey = key; currentUser = { id: user.id, name: user.name, role: user.role };
    notify("unlocked");
    return this.user();
  },

  async unlock(userId, pin) {
    const meta = readMeta();
    const u = meta?.users.find(x => x.id === userId);
    if (!u) throw Object.assign(new Error("no-user"), { code: "no-user" });
    const now = Date.now();
    if (u.lockedUntil && u.lockedUntil > now) throw Object.assign(new Error("backoff"), { code: "backoff", until: u.lockedUntil });
    if (!PIN_RE.test(String(pin))) throw Object.assign(new Error("pin-format"), { code: "pin-format" });
    try {
      const key = await unwrapMaster(u, pin);
      u.fails = 0; u.lockedUntil = 0; writeMeta(meta);
      masterKey = key; currentUser = { id: u.id, name: u.name, role: u.role };
      notify("unlocked");
      return this.user();
    } catch (e) {
      if (e && e.code) throw e;
      u.fails = (u.fails || 0) + 1;
      const delay = u.fails >= MAX_FAILS ? LOCKOUT_MS : Math.pow(2, u.fails - 1) * 1000;
      u.lockedUntil = now + delay;
      if (u.fails >= MAX_FAILS) u.fails = 0;
      writeMeta(meta);
      throw Object.assign(new Error("wrong-pin"), { code: "wrong-pin", until: u.lockedUntil, fails: u.fails, delay });
    }
  },

  lock(reason = "manual") {
    if (!masterKey && !currentUser) return;
    masterKey = null; currentUser = null;
    notify("locked", reason);
  },

  async addUser({ name, role, pin }) {
    assertUnlocked();
    const meta = readMeta();
    if (meta.users.length >= 12) throw new Error(t("users.errMax"));
    const user = await makeUser({ name, role, pin }, masterKey);
    meta.users.push(user); writeMeta(meta); notify("users");
    return publicUser(user);
  },

  removeUser(userId) {
    assertUnlocked();
    const meta = readMeta();
    if (meta.users.length <= 1) throw new Error(t("users.errLast"));
    if (userId === currentUser.id) throw new Error(t("users.errSelf"));
    if (!this.isOwner()) throw new Error(t("common.ownerRequired"));
    meta.users = meta.users.filter(u => u.id !== userId); writeMeta(meta); notify("users");
  },

  async changeOwnPin(oldPin, newPin) {
    assertUnlocked(); assertPin(newPin);
    const meta = readMeta();
    const u = meta.users.find(x => x.id === currentUser.id);
    try { await unwrapMaster(u, oldPin); } catch { throw Object.assign(new Error(t("users.errOldPin")), { code: "wrong-pin" }); }
    Object.assign(u, await wrapMaster(masterKey, newPin));
    writeMeta(meta); notify("users");
  },

  /* 원장 re-wraps the (already unlocked) master key under a new PIN for another user. */
  async resetPin(userId, newPin) {
    assertUnlocked(); assertPin(newPin);
    if (!this.isOwner()) throw new Error(t("common.ownerRequired"));
    const meta = readMeta();
    const u = meta.users.find(x => x.id === userId);
    if (!u) throw new Error("no-user");
    Object.assign(u, await wrapMaster(masterKey, newPin), { fails: 0, lockedUntil: 0 });
    writeMeta(meta); notify("users");
  },

  updateUser(userId, patch) {
    const meta = readMeta();
    const u = meta?.users.find(x => x.id === userId);
    if (!u) throw new Error("no-user");
    if ("aiConsent" in patch) u.aiConsent = patch.aiConsent;
    if (patch.name != null) { assertName(patch.name); u.name = String(patch.name).trim(); }
    if (patch.role != null) { assertRole(patch.role); u.role = patch.role; }
    writeMeta(meta);
    if (currentUser && currentUser.id === userId) currentUser = { id: u.id, name: u.name, role: u.role };
    notify("users");
    return publicUser(u);
  },

  setAutolock(min) {
    const meta = readMeta(); if (!meta) return;
    meta.autolockMin = [5, 10, 30].includes(Number(min)) ? Number(min) : 10;
    writeMeta(meta); notify("users");
  },

  /* Backup/restore + 전체 파기 */
  exportKeyring() { return readMeta(); },
  importKeyring(meta) {
    if (!meta || meta.v !== 1 || !Array.isArray(meta.users) || !meta.users.length || !meta.id) throw new Error("bad-keyring");
    writeMeta(meta); notify("users");
  },
  // Verifies a PIN against a keyring that is NOT installed yet (backup restore) → master CryptoKey.
  async unwrapFromKeyring(meta, userId, pin) {
    const u = meta.users.find(x => x.id === userId);
    if (!u) throw new Error("no-user");
    return unwrapMaster(u, pin);
  },
  // Restore path: adopt an unwrapped key without going through unlock().
  adopt(key, user) { masterKey = key; currentUser = { id: user.id, name: user.name, role: user.role }; notify("unlocked"); },
  destroy() { masterKey = null; currentUser = null; try { localStorage.removeItem(META_KEY); } catch {} notify("locked", "destroyed"); }
};

export { Session, META_KEY, ROLES, b64 };
