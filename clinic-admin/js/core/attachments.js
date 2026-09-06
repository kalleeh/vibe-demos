/* clinic-admin — IndexedDB attachment store (license photos live outside localStorage).
   Encrypted at rest since the security pass: a record is stored as
     { id, owner, kind, at, enc: { v:1, iv, ct } }
   where `enc` is the AES-GCM ciphertext (workspace master key) of the UTF-8 bytes of the
   data URL. `owner` is the opaque staff-row id, never a name. Reads return the decrypted
   `{ …, data }` shape callers always used; while locked put() throws and getByOwner() → [].
   Plaintext records left by an earlier build are re-encrypted on first unlock (migratePlaintext).
   ENTITY SYNC (core/sync.js): every sealed record is mirrored to the server's `sync_file` collection (put → upload,
   del → soft-delete); a device that lacks a photo receives it through the realtime stream or pulls on a miss. */
import { Session } from "../security/session.js";
import { encryptString, decryptString, isEnvelope } from "../security/crypto.js";
import { Sync } from "./sync.js";

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
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  async function putRaw(rec) { const s = await tx("readwrite"); await req(s.put(rec)); return rec; }
  async function getAllRaw() { const s = await tx("readonly"); return req(s.getAll()); }
  async function getRaw(id) { const s = await tx("readonly"); return (await req(s.get(id))) || null; }
  async function delRaw(id) { const s = await tx("readwrite"); await req(s.delete(id)); return true; }

  async function seal(rec) {
    const key = Session.key();
    if (!key) throw Object.assign(new Error("locked"), { code: "locked" });
    const { data, ...rest } = rec;
    return { ...rest, enc: await encryptString(key, String(data ?? "")) };
  }
  async function unseal(raw) {
    const key = Session.key();
    if (!key) return null;
    if (isEnvelope(raw.enc)) {
      try { const { enc, ...rest } = raw; return { ...rest, data: await decryptString(key, enc) }; }
      catch { return null; } // another workspace's key / corrupt → hidden
    }
    if (typeof raw.data === "string") return raw; // legacy plaintext (migrated on unlock)
    return null;
  }

  async function put(rec) {
    await putRaw(await seal(rec));
    Sync.filePut(rec.id);
    return rec;
  }
  async function readOwner(owner) {
    const all = await getAllRaw();
    const mine = all.filter(x => x.owner === owner).sort((a, b) => a.at - b.at);
    return (await Promise.all(mine.map(unseal))).filter(Boolean);
  }
  async function getByOwner(owner) {
    if (!Session.isUnlocked()) return [];
    let list = await readOwner(owner);
    // Pull-on-miss: this device has no photo for the row — another device may have taken one (rate-limited inside Sync).
    if (!list.length && Sync.state().online) { try { if (await Sync.pullFiles()) list = await readOwner(owner); } catch {} }
    return list;
  }
  async function del(id) { await delRaw(id); Sync.fileDel(id); return true; }
  async function count() { const s = await tx("readonly"); return req(s.count()); }
  async function clearAll() { const ids = (await getAllRaw()).map(r => r.id); const s = await tx("readwrite"); await req(s.clear()); for (const id of ids) Sync.fileDel(id); }
  async function close() {
    if (!dbp) return;
    const db = await dbp;
    dbp = null;
    db.close();
  }

  // First unlock after upgrading: encrypt anything still stored as a plaintext data URL.
  async function migratePlaintext() {
    if (!Session.isUnlocked()) return 0;
    const all = await getAllRaw();
    let n = 0;
    for (const raw of all) {
      if (isEnvelope(raw.enc) || typeof raw.data !== "string") continue;
      await putRaw(await seal(raw)); n++;
    }
    return n;
  }
  // Backup: ciphertext records only (never decrypted); restore writes them back verbatim.
  async function exportRaw() { return (await getAllRaw()).filter(r => isEnvelope(r.enc)); }
  async function importRaw(list) { for (const r of list || []) if (r && r.id && isEnvelope(r.enc)) await putRaw(r); }
  // Owners referenced by encrypted records (for the compliance inventory + orphan purge).
  async function stats() {
    const all = await getAllRaw();
    return { count: all.length, lastAt: all.reduce((m, r) => Math.max(m, r.at || 0), 0), owners: [...new Set(all.map(r => r.owner))] };
  }
  async function deleteByOwners(owners) {
    const set = new Set(owners);
    const all = await getAllRaw();
    let n = 0;
    for (const r of all) if (set.has(r.owner)) { await del(r.id); n++; }
    return n;
  }
  // The server mirror (core/sync.js) reads and writes the sealed records directly — never through put()/del(), which enqueue.
  Sync.bindFiles({ getRaw, putRaw, del: delRaw, allRaw: getAllRaw });
  return { put, getByOwner, del, count, close, clearAll, migratePlaintext, exportRaw, importRaw, stats, deleteByOwners };
})();
export { Attachments };
