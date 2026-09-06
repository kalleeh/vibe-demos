/* clinic-admin — Store + EventBus + ActivityLog + SyncStatus + bindPersist

   Security pass (2026-09): Store gained an ENCRYPTED TIER.
   ─ Any key matching SENSITIVE_KEYS is persisted as an AES-GCM envelope { v:1, iv, ct } under
     the workspace master key (js/security/session.js). Plaintext for those keys lives only in an
     in-memory cache while the session is unlocked.
   ─ Store.get(sensitiveKey, fallback) returns `fallback` while locked (callers pass [] / {} / null,
     so tabs render their empty state; use Session.isUnlocked() to tell "locked" from "empty").
   ─ Store.set(sensitiveKey) is a no-op while locked (warns).
   ─ Cross-tab sync: BroadcastChannel carries only a "changed" NOTICE for sensitive keys — never
     plaintext — and the receiving tab re-reads + decrypts with its own unlocked key.
   ─ Plaintext values left by an earlier build are migrated (read → encrypt → overwrite) on the
     first unlock (Store.unlockedInit), together with IndexedDB attachments.
   Events: `session:unlocked` (after the cache is populated; `resumed: true` when restored from the IndexedDB session
   record at boot without a PIN) and `session:locked` (local only — session.js has its own cross-tab channel). */
import { $, relTime, debounce, redactSubject, redactStaff } from "./dom.js";
import { t } from "./i18n.js";
import { Attachments } from "./attachments.js";
import { Session } from "../security/session.js";
import { encryptJSON, decryptJSON, isEnvelope } from "../security/crypto.js";
import { scrubIdentifiers } from "../security/redact.js";

/* ─────────────────────────────────────────────────────────
   Foundation — Store + EventBus + ActivityLog + SyncStatus
   Backend-free state layer. localStorage holds per-tool
   state under namespaced keys; BroadcastChannel + the
   'storage' window event keep multiple browser tabs in sync.
   ───────────────────────────────────────────────────────── */
const NS = "vibe.clinic-admin";

/* Encryption policy. Anything that can hold a person's name / 번호 / date is here — this list is the CANONICAL home
   (Phase 3 trackers included: appeals.list · nhis.history · guarantee.list · docs.list · consent.list · retention.disposals).
   security/lifecycle.js registerRows() also adds any `encrypted: true` key it registers, so a new tab module cannot
   register a pid-carrying key on the plain tier by omission.
   NOT sensitive (plaintext): accred.checked, tariff.* (price list + history, no names), kcd.lastSummary and
   retention.lastAudit (counts only), ui.* (screen settings), __* (internal: key ring, mtimes). */
const SENSITIVE_KEYS = {
  exact: ["jabo.history", "license.list", "activity", "intake-cards", "staff.list", "patients.register",
          "appeals.list", "nhis.history", "guarantee.list", "docs.list", "consent.list", "retention.disposals"],
  prefixes: ["jabo.draft.", "ai.", "yearend.", "bigeup.profile.", "claims.batch."]
};
/* Unlock hooks (entities.js registers its legacy → entity migration): awaited inside unlockedInit() AFTER the
   cache is populated and BEFORE the `store:<key>` re-emits, so tabs never initialise against un-migrated data. */
const unlockHooks = [];
const isSensitive = (key) => SENSITIVE_KEYS.exact.includes(key) || SENSITIVE_KEYS.prefixes.some(p => key.startsWith(p));
const isInternal = (key) => key.startsWith("__");

const cache = new Map();        // sensitive key → plaintext (unlocked only)
const writeChains = new Map();  // sensitive key → tail promise (serialises async encrypt+write)
let unlockP = Promise.resolve();

function enqueueWrite(key, job) {
  const tail = (writeChains.get(key) || Promise.resolve()).then(job).catch(e => console.warn("Store encrypt/write failed", key, e));
  writeChains.set(key, tail);
  return tail;
}
function readRaw(key) {
  try { const raw = localStorage.getItem(`${NS}.${key}`); return raw == null ? undefined : JSON.parse(raw); } catch { return undefined; }
}
function touchMtime(key) {
  if (isInternal(key)) return;
  try {
    const m = readRaw("__mtime") || {};
    m[key] = Date.now();
    localStorage.setItem(`${NS}.__mtime`, JSON.stringify(m));
  } catch {}
}

const Store = {
  isSensitive,
  onUnlock(fn) { unlockHooks.push(fn); },
  get(key, fallback = null) {
    if (isSensitive(key)) {
      if (!Session.isUnlocked()) return fallback;
      return cache.has(key) ? cache.get(key) : fallback;
    }
    const v = readRaw(key);
    return v === undefined ? fallback : v;
  },
  set(key, value) {
    if (isSensitive(key)) {
      if (!Session.isUnlocked()) { console.warn("Store.set ignored while locked:", key); return; }
      cache.set(key, value);
      touchMtime(key);
      SyncStatus.touch();
      EventBus.emitLocal(`store:${key}`, value);
      const k = Session.key();
      enqueueWrite(key, async () => {
        const env = await encryptJSON(k, value);
        localStorage.setItem(`${NS}.${key}`, JSON.stringify(env));
        EventBus.notify(`store:${key}`); // only after the envelope is on disk — peers re-read it
      });
      return;
    }
    try {
      localStorage.setItem(`${NS}.${key}`, JSON.stringify(value));
      touchMtime(key);
      SyncStatus.touch();
      EventBus.emit(`store:${key}`, value);
    } catch (e) { console.warn("Store.set failed", e); }
  },
  remove(key) {
    cache.delete(key);
    enqueueWrite(key, () => { try { localStorage.removeItem(`${NS}.${key}`); } catch {} });
    try { localStorage.removeItem(`${NS}.${key}`); } catch {}
    const m = readRaw("__mtime"); if (m && key in m) { delete m[key]; try { localStorage.setItem(`${NS}.__mtime`, JSON.stringify(m)); } catch {} }
    if (isSensitive(key)) { EventBus.emitLocal(`store:${key}`, null); EventBus.notify(`store:${key}`); }
    else EventBus.emit(`store:${key}`, null);
  },
  // Every key under the namespace — what is on disk PLUS sensitive keys set this session whose encrypted write is
  // still in flight (a batch created a moment ago must be listable at once; backup awaits flush() before reading).
  keys() {
    const out = new Set();
    const prefix = `${NS}.`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.add(k.slice(prefix.length));
    }
    if (Session.isUnlocked()) for (const k of cache.keys()) out.add(k);
    return [...out];
  },
  mtime(key) { return (readRaw("__mtime") || {})[key] || null; },
  // Raw envelope (or plaintext for non-sensitive keys) — used by the encrypted backup.
  raw(key) { return readRaw(key); },
  // Await every pending encrypted write (before backup / lock / wipe).
  async flush() { await Promise.all([...writeChains.values()]); },
  whenUnlocked() { return unlockP; },

  /* Called once per unlock: decrypt every sensitive key into the cache, migrate legacy
     plaintext, then tell the tabs to re-render (`store:<key>` for each restored key). */
  async unlockedInit() {
    const key = Session.key();
    if (!key) return;
    cache.clear();
    const restored = [];
    let migrated = 0;
    for (const k of this.keys()) {
      if (!isSensitive(k)) continue;
      const raw = readRaw(k);
      if (raw === undefined) continue;
      if (isEnvelope(raw)) {
        try { cache.set(k, await decryptJSON(key, raw)); restored.push(k); }
        catch (e) { console.warn("Store: cannot decrypt", k, "— wrong workspace key? leaving as-is"); }
      } else {
        cache.set(k, raw); restored.push(k); migrated++;
        await enqueueWrite(k, async () => {
          const env = await encryptJSON(key, raw);
          localStorage.setItem(`${NS}.${k}`, JSON.stringify(env));
        });
      }
    }
    try { migrated += await Attachments.migratePlaintext(); } catch (e) { console.warn("attachment migration", e); }
    const hooks = {};
    for (const fn of unlockHooks) { try { Object.assign(hooks, await fn()); } catch (e) { console.warn("Store unlock hook", e); } }
    for (const k of restored) if (cache.has(k)) EventBus.emitLocal(`store:${k}`, cache.get(k));
    return { restored: restored.length, migrated, hooks };
  },
  lockedTeardown() { cache.clear(); },
  // Cross-tab: a peer changed a sensitive key → re-read + decrypt with OUR key.
  async refreshKey(key) {
    if (!isSensitive(key) || !Session.isUnlocked()) return;
    const raw = readRaw(key);
    if (raw === undefined) { cache.delete(key); EventBus.emitLocal(`store:${key}`, null); return; }
    if (!isEnvelope(raw)) return;
    try {
      const prev = cache.get(key);
      const v = await decryptJSON(Session.key(), raw);
      cache.set(key, v);
      EventBus.emitLocal(`store:${key}`, v);
      if (key === "activity" && Array.isArray(v) && v[0] && (!prev?.[0] || v[0].at > prev[0].at)) EventBus.emitLocal("activity:push", v[0]);
    } catch {}
  },
  /* keepWorkspace: leave the key ring (__ws) in place — "선택 항목 파기" uses remove(); this is the
     full wipe. Without keepWorkspace the users + wrapped keys go too (전체 파기). */
  async wipeAll({ keepWorkspace = false } = {}) {
    await this.flush();
    for (const k of this.keys()) {
      if (keepWorkspace && k === "__ws") continue;
      localStorage.removeItem(`${NS}.${k}`);
    }
    cache.clear();
    // Attachments (license photos) live in IndexedDB, not localStorage.
    try { await Attachments.close(); } catch {}
    await new Promise((res) => {
      let r;
      try { r = indexedDB.deleteDatabase("vibe-clinic-admin"); } catch { return res(); }
      r.onsuccess = r.onerror = r.onblocked = () => res();
    });
    EventBus.emit("store:wiped", null);
  }
};

const EventBus = (() => {
  const handlers = new Map();
  let bc = null;
  try { bc = new BroadcastChannel(`${NS}.bus`); } catch {}
  const emitLocal = (ev, data) => {
    const list = handlers.get(ev) || [];
    for (const fn of list) { try { fn(data); } catch (e) { console.error(e); } }
    const wild = handlers.get("*") || [];
    for (const fn of wild) { try { fn(ev, data); } catch (e) { console.error(e); } }
  };
  const onPeer = (msg) => {
    if (!msg || !msg.ev) return;
    if (msg.notice) {
      // "changed" notice for an encrypted key — no plaintext crossed the channel.
      if (msg.ev.startsWith("store:")) Store.refreshKey(msg.ev.slice(6));
      else emitLocal(msg.ev, undefined);
    } else emitLocal(msg.ev, msg.data);
    SyncStatus.peer();
  };
  if (bc) bc.onmessage = (e) => onPeer(e.data);
  // 'storage' is only the fallback when BroadcastChannel is unavailable —
  // running both would deliver every cross-tab store event twice.
  else window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(`${NS}.`)) return;
    const key = e.key.slice(NS.length + 1);
    if (isSensitive(key)) { Store.refreshKey(key); SyncStatus.peer(); return; }
    try { emitLocal(`store:${key}`, e.newValue ? JSON.parse(e.newValue) : null); } catch {}
    SyncStatus.peer();
  });
  return {
    on(ev, fn) {
      if (!handlers.has(ev)) handlers.set(ev, []);
      handlers.get(ev).push(fn);
    },
    // local + cross-tab WITH data — only for non-sensitive payloads
    emit(ev, data) {
      emitLocal(ev, data);
      if (bc) try { bc.postMessage({ ev, data }); } catch {}
    },
    emitLocal,
    // cross-tab "something changed" — never carries a value
    notify(ev) { if (bc) try { bc.postMessage({ ev, notice: true }); } catch {} }
  };
})();

/* Session ↔ Store bridge. Unlock → decrypt cache → `session:unlocked`; lock → drop cache → `session:locked`.
   `resumed: true` on the unlock payload = the session came back from the IndexedDB record at boot (no PIN typed). */
Session.onChange((what, reason) => {
  if (what === "unlocked") {
    unlockP = Store.unlockedInit().then((r) => { EventBus.emitLocal("session:unlocked", { user: Session.user(), resumed: reason === "restored", ...r }); return r; });
  } else if (what === "locked") {
    Store.lockedTeardown();
    EventBus.emitLocal("session:locked", reason || "manual");
  } else if (what === "users") {
    EventBus.emitLocal("session:users", Session.users());
  }
});

/* ─────────────────────────────────────────────────────────
   ActivityLog — append-only, pseudonymised, encrypted (key `activity`).
   Entry: { at, actor, staffId, role, tag, action, subject, text, meta }
     actor/role  — the unlocked user (never a patient); `actor` is the name snapshot at the time,
                   `staffId` the roster row (core/entities.js Staff) the login belongs to
     action      — what happened; RRN/phone digits scrubbed defensively
     subject     — pseudonymised reference: redactSubject() for a patient ("****0142"),
                   redactStaff() for a staff row ("한의사 윤○○"); NEVER a full name
     text        — alias of `action` (older render code reads entry.text)
   push(tag, text, meta) is the legacy signature: pass meta.subject = { name, pid } for a patient,
   { role, name } for a staff member (or meta.pid) and the subject is derived; do NOT embed a
   name in `text`.
   No per-entry delete. clear()/export() are 원장-only (compliance panel). Retention 1 year
   (lifecycle.js purges on unlock). */
const ActivityLog = {
  MAX: 500,
  add({ tag, action, subject = null, meta = {} }) {
    if (!Session.isUnlocked()) return null; // an entry without an actor is not an audit entry
    const u = Session.user();
    const keep = {};
    for (const k of ["silent", "sample", "len", "id"]) if (k in meta) keep[k] = meta[k];
    const act = scrubIdentifiers(String(action ?? ""));
    const entry = { at: Date.now(), actor: u.name, staffId: u.staffId || null, role: u.role, tag, action: act, subject: subject || null, text: act, meta: keep };
    const items = Store.get("activity", []) || [];
    items.unshift(entry);
    Store.set("activity", items.slice(0, this.MAX));
    EventBus.emitLocal("activity:push", entry);
    return entry;
  },
  push(tag, text, meta = {}) {
    const s = meta?.subject;
    const subject = s ? (s.role ? redactStaff(s) : redactSubject(s)) : meta?.pid ? redactSubject({ pid: meta.pid }) : null;
    return this.add({ tag, action: text, subject, meta: meta || {} });
  },
  recent(n = 10) { return (Store.get("activity", []) || []).slice(0, n); },
  all() { return Store.get("activity", []) || []; },
  // CSV text (BOM + header). The caller adds the PoC watermark row via files.js/pocWatermark.
  // Column headers follow the UI language (lifecycle.audit.col.*); values are the stored records.
  exportRows() {
    const H = ["at", "actor", "role", "tag", "action", "subject"].map(k => t("lifecycle.audit.col." + k));
    return this.all().map(e => ({
      [H[0]]: new Date(e.at).toISOString(), [H[1]]: e.actor || "", [H[2]]: e.role || "",
      [H[3]]: e.tag || "", [H[4]]: e.action || e.text || "", [H[5]]: e.subject || ""
    }));
  },
  clear() {
    if (!Session.isOwner()) throw new Error(t("common.ownerRequired"));
    Store.remove("activity");
  }
};

const SyncStatus = (() => {
  let peerTimer = null;
  const tickEls = () => {
    const led = $("#sync-led");
    const msg = $("#sync-msg");
    const saved = $("#sync-saved");
    const when = $("#sync-when");
    const last = Store.get("__lastSave");
    if (last && saved && when) {
      saved.style.display = "inline-flex";
      when.textContent = relTime(last);
    }
    if (led) {
      led.classList.remove("idle");
      led.classList.add("live");
    }
    if (msg) msg.textContent = t("shell.syncSaved");
  };
  return {
    touch() {
      try { localStorage.setItem(`${NS}.__lastSave`, JSON.stringify(Date.now())); } catch {}
      tickEls();
    },
    peer() {
      const ind = $("#sync-broadcast");
      if (ind) ind.style.display = "inline-flex";
      clearTimeout(peerTimer);
      peerTimer = setTimeout(() => { if (ind) ind.style.display = "none"; }, 4000);
    },
    refresh: tickEls
  };
})();

/* Auto-bind a form input to a Store key so values persist across reloads
   and sync across tabs. Restores on page load (and again on `store:<key>` after an unlock). */
function bindPersist(selectorOrEl, key, opts = {}) {
  const el = typeof selectorOrEl === "string" ? $(selectorOrEl) : selectorOrEl;
  if (!el) return;
  const fullKey = opts.namespace ? `${opts.namespace}.${key}` : key;
  const stored = Store.get(fullKey);
  if (stored != null && el.type !== "file") el.value = stored;
  const handler = debounce(() => {
    Store.set(fullKey, el.value);
    if (opts.onChange) opts.onChange(el.value);
  }, 300);
  el.addEventListener("input", handler);
  el.addEventListener("change", handler);
  EventBus.on(`store:${fullKey}`, (v) => {
    if (v != null && el.value !== v && document.activeElement !== el) el.value = v;
  });
}
export { NS, SENSITIVE_KEYS, Store, EventBus, ActivityLog, SyncStatus, bindPersist };
