/* clinic-admin — Phase 3 integration shim for the HOME KPI / RECORDS builder (P3c).
   // TODO(integrator): delete this file once P3a (tab-appeal · claims-landing payer) and P3b (tab-guarantee · tab-docs ·
   // tab-consent · patients-shared) have landed, and point the imports in tab0-today.js / tab4-bigeup.js / tab5-retention.js /
   // tab3-yearend.js at the real modules:
   //   appealDeadlines · appealStats      ← ../tabs/tab-appeal.js
   //   guaranteeDeadlines                 ← ../tabs/tab-guarantee.js
   //   patientCounts                      ← ../tabs/patients-shared.js
   //   registerRows                       ← ../security/lifecycle.js (if the integrator adds it there — see below)
   Every export here is the CONTRACT the P3c modules code against; the fallbacks are empty / derived so the panels render
   with 자보-only data while the sibling builders are still in flight.

   registerRows(rows) — processing-register + ENCRYPTION-TIER registration for a NEW Store key. lifecycle.registerRows
   (scaffold 032199c) only appends the register row; it does not put an `encrypted: true` key on the AES-GCM tier. This
   wrapper derives `id`/`match` from `key`, calls lifecycle.registerRows, and pushes encrypted keys into store.js
   SENSITIVE_KEYS.exact (isSensitive() reads the array at call time). Tab modules are imported by main.js BEFORE the first
   unlock, so the tier is known before Store.unlockedInit decrypts.
   // TODO(integrator): fold the SENSITIVE_KEYS step into lifecycle.registerRows (or store.js) and delete this wrapper.
     registerRows([{ key: "retention.disposals", id?: key, label, detail, purpose, basis, encrypted, retention, days, purge? }]) */
import { Store, SENSITIVE_KEYS } from "../core/store.js";
import { registerRows as lifecycleRegisterRows } from "../security/lifecycle.js";

const todayISO = () => new Date().toISOString().slice(0, 10);

/* ── P3a · tab-appeal ── */
// [{ key, label, due, ctx: { appealId } }] — the appeal tracker owns the real list.
export function appealDeadlines() { return []; }
// { open, overdue, submitted, resolved, recovered } — derived from appeals.list rows { status, dueAt, amount, resultAmount }
// when the tracker has stored any; otherwise all zeros. Status vocabulary assumed: draft|open → open, submitted,
// resolved|accepted|rejected|partial → resolved. Confidence: low — P3a's report fixes the words.
export function appealStats() {
  const rows = Store.get("appeals.list", []) || [];
  const s = { open: 0, overdue: 0, submitted: 0, resolved: 0, recovered: 0, appealed: 0 };
  const today = todayISO();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r) continue;
    const st = String(r.status || "open");
    s.appealed += +r.amount || 0;
    if (/resolved|accepted|rejected|partial|closed|done/.test(st)) { s.resolved++; s.recovered += +r.resultAmount || 0; continue; }
    if (/submitted|filed/.test(st)) { s.submitted++; continue; }
    s.open++;
    if (r.dueAt && String(r.dueAt).slice(0, 10) < today) s.overdue++;
  }
  return s;
}

/* ── P3b · tab-guarantee ── */
// [{ key, label, due, ctx: { guaranteeId } }]
export function guaranteeDeadlines() { return []; }

/* ── P3b · patients-shared ── */
export function patientCounts(/* pid */) { return { guarantees: 0, docs: 0, consents: 0 }; }

/* ── lifecycle · registerRows ── */
const exact = (x) => (k) => k === x;
export function registerRows(rows) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !r.key) continue;
    if (r.encrypted === true && !SENSITIVE_KEYS.exact.includes(r.key) && !SENSITIVE_KEYS.prefixes.some(p => r.key.startsWith(p))) SENSITIVE_KEYS.exact.push(r.key);
    const { key, ...rest } = r;
    out.push({ id: r.id || key, match: exact(key), days: null, ...rest });
  }
  if (out.length) lifecycleRegisterRows(out);
}
