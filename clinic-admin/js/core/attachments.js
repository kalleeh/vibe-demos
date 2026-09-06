/* clinic-admin — IndexedDB attachment store (license photos live outside localStorage)
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */

// ── IndexedDB attachment store (binary lives outside localStorage) ──
const Attachments = (() => {
  const DB = "vibe-clinic-admin";
  const STORE = "attachments";
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode) {
    const db = await open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }
  async function put(rec) {
    const s = await tx("readwrite");
    return new Promise((res, rej) => {
      const r = s.put(rec);
      r.onsuccess = () => res(rec);
      r.onerror   = () => rej(r.error);
    });
  }
  async function getByOwner(owner) {
    const s = await tx("readonly");
    return new Promise((res, rej) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result.filter(x => x.owner === owner)
        .sort((a, b) => a.at - b.at));
      r.onerror   = () => rej(r.error);
    });
  }
  async function del(id) {
    const s = await tx("readwrite");
    return new Promise((res, rej) => {
      const r = s.delete(id);
      r.onsuccess = () => res(true);
      r.onerror   = () => rej(r.error);
    });
  }
  async function count() {
    const s = await tx("readonly");
    return new Promise((res, rej) => {
      const r = s.count();
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
  async function close() {
    if (!dbp) return;
    const db = await dbp;
    dbp = null;
    db.close();
  }
  return { put, getByOwner, del, count, close };
})();
export { Attachments };
