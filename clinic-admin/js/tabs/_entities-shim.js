// TODO(integrator): delete — stand-in for F1's js/core/entities.js + nav ctx + the reporting dictionary merge.
/* clinic-admin — F3 shim. The reporting tabs (00/03/04/05/09) import { Org, Staff, Patients, Batches, Tariff,
   activateTab } from THIS file only. To integrate:
     1. sed  's#"./_entities-shim.js"#"../core/entities.js"#'  over js/tabs/tab{0,3,4,5,9}*.js (Org…Tariff), and
        import activateTab from "../core/nav.js" instead (the real one already emits `tab:activated {id, ctx}`).
     2. Make core/i18n.js merge js/i18n/ko.reporting.js + en.reporting.js (base → entities → claims → reporting,
        later wins) — the Object.assign below is the interim version of that step.
     3. Delete this file. Nothing else references it.
   Contract implemented here (what the tabs expect from the real module):
     Org.get() → { name, ykiho, bizNo, kind, rep }   Org.set(patch)   Org.isComplete()   Org.onChange(fn)
     Staff.list() → [{ id, name, job, licenseNo, acquired, reported, cme, expiry?, basis? }]   Staff.hasDuty(job)
     Patients.alias(pid) → "****0142"   Patients.list()   Patients.touch(pid)
     Batches.latest(kind) / Batches.list(kind) → [{ id, kind, at, rows, meta }] newest first
     Batches.add(kind, { rows, meta }) → batch          (03 stores `yearend`, 05 stores `retention`)
     Tariff.get(code) → { min, max, med, freq } | undefined   Tariff.set(code, vals | null)   Tariff.all() → [{ code, … }]
     Tariff.effectiveDate() → "yyyy-mm-dd" | ""   Tariff.setEffectiveDate(iso)
     EventBus: "org:changed" · "tariff:changed" · "batches:changed" {kind} — the tabs also listen to store:<key> so either works. */
import { Store, EventBus } from "../core/store.js";
import { activateTab as navActivate } from "../core/nav.js";
import { redactSubject } from "../core/dom.js";
import { getLang, applyStatic } from "../core/i18n.js";
import { hasDuty } from "./tab8-license.js";
import ko from "../i18n/ko.js";
import en from "../i18n/en.js";
import koReporting from "../i18n/ko.reporting.js";
import enReporting from "../i18n/en.reporting.js";

/* ── dictionary merge (later wins) + re-apply static copy of the reporting panels on an EN boot ── */
Object.assign(ko, koReporting);
Object.assign(en, enReporting);
if (typeof document !== "undefined" && getLang() !== "ko") {
  for (const id of ["tab-today", "tab-yearend", "tab-bigeup", "tab-retention", "tab-accred"]) {
    const el = document.getElementById(id);
    if (el) applyStatic(el);
  }
}

/* ── Org ── plaintext (institution data, not personal data) */
const ORG_KEY = "org.profile";
const Org = {
  get() { return Store.get(ORG_KEY, null) || {}; },
  set(patch) { Store.set(ORG_KEY, { ...this.get(), ...(patch || {}) }); EventBus.emitLocal("org:changed", this.get()); },
  isComplete() { const o = this.get(); return !!(o.name && o.ykiho && o.bizNo && o.kind); },
  onChange(fn) { EventBus.on(`store:${ORG_KEY}`, () => fn(this.get())); }
};

/* ── Staff ── view over tab 08's license.list (role → job) */
const Staff = {
  list() {
    return (Store.get("license.list", []) || []).map(r => ({
      id: r.id, name: r.name, job: r.role, licenseNo: r.licenseNo || "", acquired: r.acquired || "",
      reported: r.reported || "", cme: r.cme || "", expiry: r.expiry || "", basis: r.basis || ""
    }));
  },
  hasDuty
};

/* ── Patients ── alias only; no registry in the shim */
const Patients = {
  alias(pid) { return redactSubject({ pid }); },
  list() { return []; },
  touch() {}
};

/* ── Batches ── newest first, 5 per kind. NOTE: the shim key `batches.*` is not in store.js SENSITIVE_KEYS
   (pids would be plaintext) — the real entities.js owns the key policy. */
const BK = (kind) => `batches.${kind}`;
const Batches = {
  list(kind) { return Store.get(BK(kind), []) || []; },
  latest(kind) { return this.list(kind)[0] || null; },
  add(kind, { rows = [], meta = {} } = {}) {
    const b = { id: `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, kind, at: Date.now(), rows, meta };
    Store.set(BK(kind), [b, ...this.list(kind)].slice(0, 5));
    EventBus.emitLocal("batches:changed", { kind, id: b.id });
    return b;
  }
};

/* ── Tariff ── keeps tab 04's historical plaintext key `bigeup.tariff` (code → { min, max, med, freq }) */
const TK = "bigeup.tariff", TM = "bigeup.tariffMeta";
const Tariff = {
  get(code) { return (Store.get(TK, {}) || {})[code]; },
  all() { return Object.entries(Store.get(TK, {}) || {}).map(([code, v]) => ({ code, ...v })); },
  set(code, vals) {
    const m = { ...(Store.get(TK, {}) || {}) };
    if (vals == null) delete m[code]; else m[code] = vals;
    Store.set(TK, m);
    EventBus.emitLocal("tariff:changed", { code });
  },
  effectiveDate() { return (Store.get(TM, {}) || {}).effectiveDate || ""; },
  setEffectiveDate(iso) {
    Store.set(TM, { ...(Store.get(TM, {}) || {}), effectiveDate: iso || "" });
    EventBus.emitLocal("tariff:changed", { effectiveDate: iso || "" });
  }
};

/* ── activateTab(id, ctx) ── the base nav.js in this worktree emits `tab:activated` with a bare id string.
   When that happens right after a ctx call, re-emit the contract shape { id, ctx } locally. */
let pending = null;
EventBus.on("tab:activated", (p) => {
  if (pending && typeof p === "string" && p === pending.id) {
    const c = pending; pending = null;
    queueMicrotask(() => EventBus.emitLocal("tab:activated", { id: c.id, ctx: c.ctx }));
  } else if (typeof p !== "string") pending = null;
});
function activateTab(id, ctx) {
  pending = ctx ? { id, ctx } : null;
  navActivate(id, ctx);
}

export { Org, Staff, Patients, Batches, Tariff, activateTab };
