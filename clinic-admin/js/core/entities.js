/* clinic-admin — shared entities: Org · Staff · Patients · Batches · Tariff · Insurers.

   ONE fictional clinic, referenced by every tab. Each entity is a thin, synchronous facade over Store keys
   (Store decides the tier — plaintext vs AES-GCM envelope — and the cross-tab sync). Position in the import DAG:
   dom → … → store → ENTITIES → nav → ui → files → calendar. Imports store/dom/i18n/session only — never a tab,
   never shell.js.

   Keys (registered in security/lifecycle.js REGISTRY):
     org.profile        plain      { name, ykiho, biz, kind: "병원"|"의원", rep }
     staff.list         encrypted  [{ id, name, job, licenseNo, acquired, reported, cme, note, userId, expiry, basis, created }]
     patients.register  encrypted  { [pid]: { pid, tags, firstSeen, lastSeen } }   — never a name, never an RRN
     claims.batch.<id>  encrypted  { id, kind, source, rows, meta, count, createdAt, createdBy }   90 days · max 20
     tariff.items       plain      { [code]: { min, max, med, freq } }
     tariff.effectiveDate plain    "yyyy-mm-dd"
     insurers.lastUsed  plain      "삼성화재"
   Events (EventBus, local): entities:org · entities:staff · entities:patients · entities:batches · entities:tariff.
   Each entity also exposes onChange(fn) — fn(value) — which fires for local AND peer-tab changes (it hangs off
   the `store:<key>` events, which Store emits in both cases).

   MIGRATION (runs inside Store.unlockedInit via Store.onUnlock, i.e. on every unlock and after a backup restore):
     yearend.ye-biz · yearend.ye-clinic · bigeup.profile.bg-ykiho · bigeup.profile.bg-clinic → org.profile
     bigeup.tariff · bigeup.profile.bg-date                                                 → tariff.*
     license.list (role → job)                                                              → staff.list
     __ws.users without a staff row (match by name, else create one)                        → staff.list + staffId link
   The legacy keys are DELETED once copied. Legacy READS/WRITES by tab code still work through Store aliases
   (see the ALIASES block at the bottom) until F2/F3 switch to these APIs — then the aliases go. */
import { redactSubject, redactStaff, todayISO } from "./dom.js";
import { t } from "./i18n.js";
import { Store, EventBus } from "./store.js";
import { Session } from "../security/session.js";

const KEYS = {
  org: "org.profile", staff: "staff.list", patients: "patients.register", batch: "claims.batch.",
  tariff: "tariff.items", tariffDate: "tariff.effectiveDate", insurer: "insurers.lastUsed"
};
const BATCH_MAX = 20;
const BATCH_KINDS = ["claims", "review", "kcd", "yearend", "retention"];
const rid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const str = (v) => String(v ?? "").trim();

/* ── change hub: entity-level listeners + `entities:<name>` events, fed by the underlying store:<key> events ── */
function hub(name, storeKeys, read) {
  const listeners = [];
  const fire = () => { const v = read(); EventBus.emitLocal(`entities:${name}`, v); for (const fn of listeners) { try { fn(v); } catch (e) { console.error(e); } } };
  for (const k of storeKeys) EventBus.on(`store:${k}`, fire);
  return { onChange(fn) { listeners.push(fn); }, fire };
}

/* ═══════════════════════════════ Org ═══════════════════════════════ */
const ORG_FIELDS = ["name", "ykiho", "biz", "kind", "rep"];
const Org = {
  KINDS: ["병원", "의원"],
  get() {
    const v = Store.get(KEYS.org) || {};
    return { name: str(v.name), ykiho: str(v.ykiho), biz: str(v.biz), kind: v.kind === "의원" ? "의원" : "병원", rep: str(v.rep) };
  },
  set(patch) {
    const cur = Org.get(), next = { ...cur };
    for (const f of ORG_FIELDS) if (patch && f in patch) next[f] = f === "kind" ? (patch.kind === "의원" ? "의원" : "병원") : str(patch[f]);
    Store.set(KEYS.org, next);
    emitLegacy(["yearend.ye-biz", "yearend.ye-clinic", "bigeup.profile.bg-ykiho", "bigeup.profile.bg-clinic"]);
  },
  isComplete() { const o = Org.get(); return !!(o.name && o.ykiho && o.biz && o.rep); },
  isEmpty() { const o = Org.get(); return !(o.name || o.ykiho || o.biz || o.rep); },
  onChange: null
};
Org.onChange = hub("org", [KEYS.org], Org.get).onChange;

/* ═══════════════════════════════ Staff ═══════════════════════════════ */
// Jobs (직종) — stored in Korean like every role value in this app. Labels via common.roleShort.* / common.role.*.
const JOBS = ["한의사", "간호사", "물리치료사", "간호조무사", "행정", "원무", "기타"];
// Which jobs carry a periodic 면허·자격 신고 duty, and where it is filed.
// 한의사 — 의료법 §25 (3년, 대한한의사협회). 간호사 — 의료법 §25 (3년, 대한간호협회).
// 간호조무사 — 의료법 §80 준용 (3년, 대한간호조무사협회). 물리치료사 — 의료기사 등에 관한 법률 §11 (3년, 대한물리치료사협회).
// Confidence: high on the duty + 3-year cycle; portal URLs are "확인 필요".
const DUTY = {
  "한의사":     { years: 3, url: "https://www.akom.org" },
  "간호사":     { years: 3, url: "https://www.koreanurse.or.kr" },
  "간호조무사": { years: 3, url: "https://www.klpna.or.kr" },
  "물리치료사": { years: 3, url: "https://www.kpta.co.kr" }
};
// System role of a login → the job a migrated user most plausibly holds (의료법 §33: the 원장 of a 한방병원 is a 한의사).
const JOB_FOR_SYSROLE = { "원장": "한의사", "행정": "행정", "원무": "원무" };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addYears = (iso, n) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return ""; d.setFullYear(d.getFullYear() + n); return ymd(d); };
// Deadline + basis from the row's dates and job: reported + 3y → "reported"; else acquired + 3y → "acquired" (flagged
// 신고 이력 미확인); no duty → "none"; duty but no date → "unknown".
function dueOf({ job, reported, acquired }) {
  const duty = DUTY[job];
  if (!duty) return { expiry: "", basis: "none" };
  if (reported) return { expiry: addYears(reported, duty.years), basis: "reported" };
  if (acquired) return { expiry: addYears(acquired, duty.years), basis: "acquired" };
  return { expiry: "", basis: "unknown" };
}
const normJob = (j) => JOBS.includes(j) ? j : "기타";
function normRow(r) {
  const job = normJob(r.job ?? r.role);
  const duty = !!DUTY[job];
  const row = {
    id: r.id || rid("st"), name: str(r.name), job,
    licenseNo: duty ? str(r.licenseNo) : "", acquired: duty ? str(r.acquired) : "", reported: duty ? str(r.reported) : "",
    cme: str(r.cme), note: str(r.note), userId: r.userId || null, created: r.created || Date.now()
  };
  return { ...row, ...dueOf(row) };
}
const readStaff = () => { const v = Store.get(KEYS.staff, []); return Array.isArray(v) ? v : []; };
const writeStaff = (rows) => { Store.set(KEYS.staff, rows); emitLegacy(["license.list"]); };
const assertUnlocked = () => { if (!Session.isUnlocked()) throw Object.assign(new Error("locked"), { code: "locked" }); };

const Staff = {
  JOBS, DUTY, dueOf,
  hasDuty: (job) => !!DUTY[job],
  // Pseudonymised reference for toasts / feeds / audit subjects — "한의사 윤○○", never the full name.
  ref: (row) => redactStaff({ role: row?.job, name: row?.name }),
  list() { return readStaff().map(r => ({ ...r })); },
  get(id) { const r = readStaff().find(x => x.id === id); return r ? { ...r } : null; },
  add(fields) {
    assertUnlocked();
    const row = normRow({ ...fields, id: fields?.id, userId: null });
    if (!row.name) throw new Error(t("license.alertName"));
    const rows = readStaff();
    if (rows.some(x => x.id === row.id)) throw new Error("duplicate-id");
    rows.push(row); writeStaff(rows);
    return row.id;
  },
  // Undo helper: put a removed row back at its old index (same id → its attachments are still linked).
  insert(row, index) {
    assertUnlocked();
    const rows = readStaff();
    if (rows.some(x => x.id === row.id)) return row.id;
    rows.splice(Math.min(Math.max(index ?? rows.length, 0), rows.length), 0, normRow(row));
    writeStaff(rows);
    return row.id;
  },
  update(id, patch) {
    assertUnlocked();
    const rows = readStaff();
    const i = rows.findIndex(x => x.id === id);
    if (i < 0) throw new Error("no-staff");
    const { userId, id: _id, created, ...safe } = patch || {}; // links and identity are not patchable here
    rows[i] = normRow({ ...rows[i], ...safe, id, userId: rows[i].userId, created: rows[i].created });
    if (!rows[i].name) throw new Error(t("license.alertName"));
    writeStaff(rows);
    return { ...rows[i] };
  },
  remove(id) {
    assertUnlocked();
    const rows = readStaff();
    const row = rows.find(x => x.id === id);
    if (!row) return null;
    if (row.userId) throw new Error(t("license.errHasLogin"));
    writeStaff(rows.filter(x => x.id !== id));
    return { ...row };
  },
  byUser(userId) { const r = readStaff().find(x => x.userId && x.userId === userId); return r ? { ...r } : null; },
  /* 원장 only: creates the login (keyring user wrapped under `pin`) and links it to the roster row. */
  async issueLogin(id, { sysRole, pin }) {
    assertUnlocked();
    if (!Session.isOwner()) throw new Error(t("common.ownerRequired"));
    const rows = readStaff();
    const row = rows.find(x => x.id === id);
    if (!row) throw new Error("no-staff");
    if (row.userId && Session.users().some(u => u.id === row.userId)) throw new Error(t("license.errHasLogin"));
    const user = await Session.addUser({ name: row.name, role: sysRole, pin, staffId: id });
    row.userId = user.id; writeStaff(rows);
    return user;
  },
  /* 원장 only (Session.removeUser enforces owner · not self · not the last user). */
  revokeLogin(id) {
    assertUnlocked();
    const rows = readStaff();
    const row = rows.find(x => x.id === id);
    if (!row || !row.userId) return;
    if (Session.users().some(u => u.id === row.userId)) Session.removeUser(row.userId);
    row.userId = null; writeStaff(rows);
  },
  // The login (public keyring user) behind a row, or null.
  loginOf(row) { return row?.userId ? Session.users().find(u => u.id === row.userId) || null : null; },
  onChange: null
};
Staff.onChange = hub("staff", [KEYS.staff], Staff.list).onChange;

/* ═══════════════════════════════ Patients ═══════════════════════════════ */
const readPatients = () => { const v = Store.get(KEYS.patients, {}); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
const withAlias = (p) => ({ pid: p.pid, alias: Patients.alias(p.pid), tags: [...(p.tags || [])], firstSeen: p.firstSeen || "", lastSeen: p.lastSeen || "" });
const normPid = (pid) => str(pid);
const Patients = {
  // "환자 ****0142" — last four of the pseudonymous 환자번호 via redactSubject; never a name.
  alias(pid) { return t("entities.patientAlias", { ref: redactSubject({ pid: normPid(pid) }) }); },
  ensure(pid, { tags, date } = {}) {
    assertUnlocked();
    const id = normPid(pid);
    if (!id) throw new Error("no-pid");
    const reg = readPatients();
    const today = date || todayISO();
    const cur = reg[id] || { pid: id, tags: [], firstSeen: today, lastSeen: today };
    const next = { ...cur, tags: [...new Set([...(cur.tags || []), ...(tags || []).map(str).filter(Boolean)])] };
    if (!reg[id] || JSON.stringify(next) !== JSON.stringify(cur)) { reg[id] = next; Store.set(KEYS.patients, reg); }
    return withAlias(next);
  },
  get(pid) { const p = readPatients()[normPid(pid)]; return p ? withAlias(p) : null; },
  list() { return Object.values(readPatients()).sort((a, b) => a.pid < b.pid ? -1 : 1).map(withAlias); },
  touch(pid, dateISO) {
    assertUnlocked();
    const id = normPid(pid);
    if (!id) return null;
    const reg = readPatients();
    const d = str(dateISO) || todayISO();
    const cur = reg[id] || { pid: id, tags: [], firstSeen: d, lastSeen: d };
    const next = { ...cur, firstSeen: cur.firstSeen && cur.firstSeen < d ? cur.firstSeen : d, lastSeen: cur.lastSeen && cur.lastSeen > d ? cur.lastSeen : d };
    if (JSON.stringify(next) !== JSON.stringify(reg[id])) { reg[id] = next; Store.set(KEYS.patients, reg); }
    return withAlias(next);
  },
  remove(pid) { assertUnlocked(); const reg = readPatients(); if (reg[normPid(pid)]) { delete reg[normPid(pid)]; Store.set(KEYS.patients, reg); } },
  // A fresh pseudonymous 환자번호 that does not collide with the register: P-YYYY-NNNN.
  newPid() {
    const reg = readPatients(), y = new Date().getFullYear();
    for (let i = 0; i < 50; i++) { const pid = `P-${y}-${String(Math.floor(1000 + Math.random() * 9000))}`; if (!reg[pid]) return pid; }
    return `P-${y}-${Date.now().toString().slice(-4)}`;
  },
  onChange: null
};
Patients.onChange = hub("patients", [KEYS.patients], Patients.list).onChange;

/* ═══════════════════════════════ Batches ═══════════════════════════════ */
const batchKeys = () => Store.keys().filter(k => k.startsWith(KEYS.batch));
const readBatches = () => batchKeys().map(k => Store.get(k)).filter(b => b && b.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
// createdAt is strictly increasing within a page so "oldest" / latest() are never a coin toss when several batches
// land in the same millisecond (a multi-file drop).
let lastBatchAt = 0;
const batchNow = () => { lastBatchAt = Math.max(Date.now(), lastBatchAt + 1); return lastBatchAt; };
const Batches = {
  KINDS: BATCH_KINDS, MAX: BATCH_MAX,
  create({ kind, source, rows, meta } = {}) {
    assertUnlocked();
    if (!BATCH_KINDS.includes(kind)) throw new Error("bad-kind");
    const u = Session.user();
    const id = rid("b");
    const list = Array.isArray(rows) ? rows : [];
    const rec = { id, kind, source: str(source), rows: list, meta: meta && typeof meta === "object" ? meta : {}, count: list.length, createdAt: batchNow(), createdBy: u ? { staffId: u.staffId || null, name: u.name } : null };
    // Cap: oldest evicted first, across kinds.
    const existing = readBatches();
    for (const old of existing.slice(BATCH_MAX - 1)) Store.remove(KEYS.batch + old.id);
    Store.set(KEYS.batch + id, rec);
    return id;
  },
  get(id) { const v = Store.get(KEYS.batch + id); return v && v.id ? v : null; },
  list(kind) { const all = readBatches(); return kind ? all.filter(b => b.kind === kind) : all; },
  latest(kind) { return Batches.list(kind)[0] || null; },
  remove(id) { Store.remove(KEYS.batch + id); },
  onChange: null
};
{
  const listeners = [];
  const fire = () => { const v = Batches.list(); EventBus.emitLocal("entities:batches", v); for (const fn of listeners) { try { fn(v); } catch (e) { console.error(e); } } };
  EventBus.on("*", (ev) => { if (typeof ev === "string" && ev.startsWith("store:" + KEYS.batch)) fire(); });
  Batches.onChange = (fn) => { listeners.push(fn); };
}

/* ═══════════════════════════════ Tariff ═══════════════════════════════ */
const readTariff = () => { const v = Store.get(KEYS.tariff, {}); return v && typeof v === "object" ? v : {}; };
const emptyEntry = (e) => !e || ["min", "max", "med", "freq"].every(k => e[k] === "" || e[k] == null);
const Tariff = {
  get(code) { const e = readTariff()[code]; return e ? { ...e } : null; },
  all() { return JSON.parse(JSON.stringify(readTariff())); },
  set(code, entry) {
    const items = readTariff();
    if (emptyEntry(entry)) delete items[code];
    else items[code] = { min: entry.min ?? "", max: entry.max ?? "", med: entry.med ?? "", freq: entry.freq ?? "" };
    Store.set(KEYS.tariff, items); emitLegacy(["bigeup.tariff"]);
  },
  replaceAll(obj) {
    const items = {};
    for (const [code, e] of Object.entries(obj || {})) if (!emptyEntry(e)) items[code] = { min: e.min ?? "", max: e.max ?? "", med: e.med ?? "", freq: e.freq ?? "" };
    Store.set(KEYS.tariff, items); emitLegacy(["bigeup.tariff"]);
  },
  effectiveDate() { return str(Store.get(KEYS.tariffDate, "")); },
  setEffectiveDate(iso) { Store.set(KEYS.tariffDate, str(iso)); emitLegacy(["bigeup.profile.bg-date"]); },
  onChange: null
};
Tariff.onChange = hub("tariff", [KEYS.tariff, KEYS.tariffDate], () => ({ items: Tariff.all(), effectiveDate: Tariff.effectiveDate() })).onChange;

/* ═══════════════════════════════ Insurers ═══════════════════════════════ */
let insurerRows = [];
const Insurers = {
  // Called once from shell.boot() with the loaded DATA — the list lives in data/jabo.json (`insurers`).
  load(DATA) { insurerRows = Array.isArray(DATA?.jabo?.insurers) ? DATA.jabo.insurers.map(x => ({ ...x })) : []; },
  list() { return insurerRows.map(x => ({ ...x })); },
  lastUsed() { return str(Store.get(KEYS.insurer, "")); },
  setLastUsed(name) { Store.set(KEYS.insurer, str(name)); }
};

/* ═══════════════════════════════ Migration (legacy keys → entities) ═══════════════════════════════ */
const LEGACY_ORG = { "yearend.ye-biz": "biz", "yearend.ye-clinic": "name", "bigeup.profile.bg-ykiho": "ykiho", "bigeup.profile.bg-clinic": "name" };
const rawGet = (k) => { const v = Store.getStored(k); return v == null || v === "" ? null : v; }; // bypasses the aliases below
const legacyPresent = (k) => Store.keys().includes(k);

async function migrateLegacy() {
  if (!Session.isUnlocked()) return {};
  const out = { org: 0, tariff: 0, staff: 0, users: 0, removed: 0 };
  // 1 · Org — only fill fields that are still empty (a profile edited in the new UI wins).
  {
    const cur = Org.get(), patch = {};
    for (const [k, f] of Object.entries(LEGACY_ORG)) { const v = rawGet(k); if (v && !cur[f] && !patch[f]) patch[f] = str(v); }
    if (Object.keys(patch).length) { Org.set(patch); out.org = Object.keys(patch).length; }
    for (const k of Object.keys(LEGACY_ORG)) if (legacyPresent(k)) { Store.remove(k); out.removed++; }
  }
  // 2 · Tariff
  {
    const tariff = rawGet("bigeup.tariff");
    if (tariff && typeof tariff === "object" && !Object.keys(readTariff()).length) { Tariff.replaceAll(tariff); out.tariff = Object.keys(tariff).length; }
    if (legacyPresent("bigeup.tariff")) { Store.remove("bigeup.tariff"); out.removed++; }
    const date = rawGet("bigeup.profile.bg-date");
    if (date && !Tariff.effectiveDate()) Tariff.setEffectiveDate(date);
    if (legacyPresent("bigeup.profile.bg-date")) { Store.remove("bigeup.profile.bg-date"); out.removed++; }
  }
  // 3 · Staff ← license.list (role → job; ids kept so IndexedDB attachments stay attached)
  {
    const legacy = rawGet("license.list");
    if (Array.isArray(legacy) && legacy.length) {
      const rows = readStaff();
      const ids = new Set(rows.map(r => r.id));
      for (const l of legacy) { if (!l || ids.has(l.id)) continue; rows.push(normRow({ ...l, job: l.job ?? l.role, userId: null })); out.staff++; }
      if (out.staff) writeStaff(rows);
    }
    if (legacyPresent("license.list")) { Store.remove("license.list"); out.removed++; }
  }
  // 4 · Users ⇄ Staff — every login gets a roster row: existing link, else match by name, else a new row.
  {
    const rows = readStaff();
    let changed = false;
    for (const u of Session.users()) {
      if (u.staffId && rows.some(r => r.id === u.staffId)) { const r = rows.find(x => x.id === u.staffId); if (r.userId !== u.id) { r.userId = u.id; changed = true; } continue; }
      let r = rows.find(x => !x.userId && x.name === str(u.name));
      if (!r) { r = normRow({ name: u.name, job: JOB_FOR_SYSROLE[u.role] || "기타", userId: u.id }); rows.push(r); }
      r.userId = u.id; changed = true; out.users++;
      try { Session.linkStaff(u.id, r.id); } catch (e) { console.warn("linkStaff", e); }
    }
    if (changed) writeStaff(rows);
  }
  return out;
}
Store.onUnlock(migrateLegacy);

/* ═══════════════════════════════ ALIASES — compat shims for tab code still on the legacy keys ═══════════════════════════════
   Delete each line once its last caller is gone (tab0/tab3/tab4 today; see the integrator notes). */
const legacyRow = (s) => ({ id: s.id, role: s.job, job: s.job, name: s.name, licenseNo: s.licenseNo, acquired: s.acquired, reported: s.reported, cme: s.cme, expiry: s.expiry, basis: s.basis, userId: s.userId });
const nn = (v) => (v == null || v === "" ? null : v);
Store.alias("license.list", {
  get: () => Session.isUnlocked() ? readStaff().map(legacyRow) : null,
  set: (rows) => { // keep logins of rows that survive by id
    const cur = readStaff();
    writeStaff((Array.isArray(rows) ? rows : []).map(r => normRow({ ...r, job: r.job ?? r.role, userId: cur.find(x => x.id === r.id)?.userId || null })));
  }
});
Store.alias("bigeup.tariff", { get: () => Tariff.all(), set: (v) => Tariff.replaceAll(v) });
Store.alias("bigeup.profile.bg-date", { get: () => nn(Tariff.effectiveDate()), set: (v) => Tariff.setEffectiveDate(v) });
Store.alias("bigeup.profile.bg-ykiho", { get: () => nn(Org.get().ykiho), set: (v) => Org.set({ ykiho: v }) });
Store.alias("bigeup.profile.bg-clinic", { get: () => nn(Org.get().name), set: (v) => Org.set({ name: v }) });
Store.alias("yearend.ye-biz", { get: () => nn(Org.get().biz), set: (v) => Org.set({ biz: v }) });
Store.alias("yearend.ye-clinic", { get: () => nn(Org.get().name), set: (v) => Org.set({ name: v }) });
// Legacy listeners (EventBus.on("store:license.list") in tab0, bindPersist inputs in tab3/tab4) still get poked.
function emitLegacy(keys) { for (const k of keys) EventBus.emitLocal(`store:${k}`, Store.get(k)); }

export { Org, Staff, Patients, Batches, Tariff, Insurers, migrateLegacy, KEYS as ENTITY_KEYS, JOBS, DUTY, JOB_FOR_SYSROLE };
