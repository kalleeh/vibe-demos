/* clinic-admin — Store + EventBus + ActivityLog + SyncStatus + bindPersist
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, relTime, debounce } from "./dom.js";
import { Attachments } from "./attachments.js";

/* ─────────────────────────────────────────────────────────
   Foundation — Store + EventBus + ActivityLog + SyncStatus
   Backend-free state layer. localStorage holds per-tool
   state under namespaced keys; BroadcastChannel + the
   'storage' window event keep multiple browser tabs in sync.
   ───────────────────────────────────────────────────────── */
const NS = "vibe.clinic-admin";
const Store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`${NS}.${key}`);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try {
      localStorage.setItem(`${NS}.${key}`, JSON.stringify(value));
      SyncStatus.touch();
      EventBus.emit(`store:${key}`, value);
    } catch (e) { console.warn("Store.set failed", e); }
  },
  remove(key) {
    try { localStorage.removeItem(`${NS}.${key}`); } catch {}
    EventBus.emit(`store:${key}`, null);
  },
  keys() {
    const out = [];
    const prefix = `${NS}.`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
    return out;
  },
  async wipeAll() {
    for (const k of this.keys()) localStorage.removeItem(`${NS}.${k}`);
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
  if (bc) bc.onmessage = (e) => {
    emitLocal(e.data?.ev, e.data?.data);
    SyncStatus.peer();
  };
  // 'storage' is only the fallback when BroadcastChannel is unavailable —
  // running both would deliver every cross-tab store event twice.
  else window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(`${NS}.`)) return;
    const key = e.key.slice(NS.length + 1);
    try { emitLocal(`store:${key}`, e.newValue ? JSON.parse(e.newValue) : null); } catch {}
    SyncStatus.peer();
  });
  return {
    on(ev, fn) {
      if (!handlers.has(ev)) handlers.set(ev, []);
      handlers.get(ev).push(fn);
    },
    emit(ev, data) {
      emitLocal(ev, data);
      if (bc) try { bc.postMessage({ ev, data }); } catch {}
    }
  };
})();

const ActivityLog = {
  MAX: 50,
  push(tag, text, meta = {}) {
    const items = Store.get("activity", []);
    const entry = { at: Date.now(), tag, text, meta };
    items.unshift(entry);
    Store.set("activity", items.slice(0, this.MAX));
    return entry;
  },
  recent(n = 10) { return Store.get("activity", []).slice(0, n); },
  clear() { Store.remove("activity"); }
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
    if (msg) msg.textContent = "로컬 저장 — 자동으로 이 브라우저에 보관됩니다.";
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
   and sync across tabs. Restores on page load. */
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
export { NS, Store, EventBus, ActivityLog, SyncStatus, bindPersist };
