// TODO(integrator): delete, use ../core/entities.js (Org · Patients · Batches · Tariff · Insurers) and
// ../core/nav.js activateTab(id, ctx). Also: the i18n merge below goes away once core/i18n.js merges
// ko.js → ko.entities.js → ko.claims.js → ko.reporting.js itself (later files win).
//
// Minimal local stand-in for the F1 contract so the claims tabs (01/02/06/07) run end-to-end in this
// worktree. Same signatures as the contract; storage is deliberately simple:
//   · patients + batches → Store key "jabo.draft.entities" (encrypted tier, registered under the
//     jabo.draft prefix in security/lifecycle.js → no 미등록 row in 데이터 처리 현황)
//   · insurer last-used → "ui.insurer.lastUsed" (plaintext ui.* setting, not personal)
//   · tariff → reads tab 04's "bigeup.tariff" { code: price } as-is
import { Store, EventBus } from "../core/store.js";
import { activateTab as navActivate } from "../core/nav.js";
import { redactSubject } from "../core/dom.js";
import { applyStatic, getLang } from "../core/i18n.js";
import ko from "../i18n/ko.js";
import en from "../i18n/en.js";
import koClaims from "../i18n/ko.claims.js";
import enClaims from "../i18n/en.claims.js";

/* ── i18n merge (claims dictionaries take precedence over the base) ── */
Object.assign(ko, koClaims);
Object.assign(en, enClaims);
if (typeof document !== "undefined" && getLang() !== "ko") applyStatic(document);

/* ── Org ── */
const ORG = { name: "한솔한방병원", ykiho: "11000123", biz: "123-45-67890", kind: "한방병원", rep: "" };
const Org = { get: () => ({ ...ORG }) };

/* ── shared encrypted record ── */
const KEY = "jabo.draft.entities";
const read = () => { const v = Store.get(KEY, null); return v && typeof v === "object" ? v : { patients: {}, batches: [] }; };
const write = (rec) => Store.set(KEY, rec);

/* ── Patients ── */
const Patients = {
  ensure(pid, { tags = [] } = {}) {
    const id = String(pid || "").trim(); if (!id) return null;
    const rec = read();
    const p = rec.patients[id] || (rec.patients[id] = { pid: id, tags: [], firstSeen: Date.now(), lastDate: "" });
    for (const tg of tags) if (tg && !p.tags.includes(tg)) p.tags.push(tg);
    write(rec);
    return p;
  },
  alias(pid) { return redactSubject({ pid }); },
  touch(pid, date) {
    const id = String(pid || "").trim(); if (!id) return;
    const rec = read();
    const p = rec.patients[id] || (rec.patients[id] = { pid: id, tags: [], firstSeen: Date.now(), lastDate: "" });
    if (date && String(date) > String(p.lastDate || "")) p.lastDate = String(date);
    write(rec);
  },
  list() { return Object.values(read().patients); }
};

/* ── Batches ── */
const newId = () => "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
const Batches = {
  create({ kind, source, rows, meta = {} }) {
    const rec = read();
    const b = { id: newId(), kind, source: String(source || ""), rows: Array.isArray(rows) ? rows : [], meta: { ...meta }, at: Date.now() };
    rec.batches.unshift(b);
    rec.batches = rec.batches.slice(0, 40);
    write(rec);
    return b.id;
  },
  get(id) { return read().batches.find(b => b.id === id) || null; },
  list(kind) { return read().batches.filter(b => !kind || b.kind === kind).sort((a, b) => b.at - a.at); },
  latest(kind) { return Batches.list(kind)[0] || null; },
  remove(id) { const rec = read(); rec.batches = rec.batches.filter(b => b.id !== id); write(rec); }
};

/* ── Tariff (tab 04's 비급여 단가표) ── */
const Tariff = {
  get(code) { const v = Store.get("bigeup.tariff", {}) || {}; return v[code] ?? null; },
  all() { return Object.entries(Store.get("bigeup.tariff", {}) || {}).map(([code, price]) => ({ code, price })); }
};

/* ── Insurers ── */
const Insurers = {
  list() { return []; }, // empty → callers fall back to data/jabo.json insurers
  lastUsed() { return Store.get("ui.insurer.lastUsed", "") || ""; },
  setLastUsed(name) { Store.set("ui.insurer.lastUsed", String(name || "")); }
};

/* ── activateTab(id, ctx) — nav.js still emits the bare id; re-emit the contract shape when a ctx is given ── */
function activateTab(id, ctx) {
  navActivate(id);
  if (ctx) EventBus.emitLocal("tab:activated", { id, ctx });
}

export { Org, Patients, Batches, Tariff, Insurers, activateTab };
