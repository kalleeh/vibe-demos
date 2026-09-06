/* clinic-admin — 환자 area shared helpers for the three patient-facing trackers (tab-guarantee · tab-docs · tab-consent).

   THE PATIENT IS A PID. Every record here references a pseudonymous 환자번호 from core/entities.js Patients and shows
   Patients.alias(pid) ("환자 ****0142"); staff are Staff ids shown as Staff.ref(row) ("한의사 윤○○") outside the roster.
   No name, no RRN, no phone number of a patient is ever stored or rendered by these panels.

   Store keys (registered by each tab through security/lifecycle.js registerRows, all encrypted):
     guarantee.list   [{ id, pid, insurer, accidentDate, claimNo, guaranteeNo, scope, from, to, contact, status, log, note, createdAt, updatedAt }]
     docs.list        [{ id, no, pid, docType, issuedAt, issuedBy, purpose, fee, copies, recipient, proxy, note, createdAt, updatedAt }]
     consent.list     [{ id, pid, at, items, explainedBy, method, signed, note, createdAt, updatedAt }]
   collection(key) is the tiny synchronous facade the tabs share (list · get · upsert · remove · insert · onChange).
   renderPatientStrip(host, pid) / patientCounts(pid) are the beginning of a per-patient view — 홈 (P3c) reads the counts.
   Import position: a tab-level module (imports core + security only; never shell.js). */
import { $, $$, esc, daysUntil, roleLabel } from "../core/ui.js";
import { t, pick, getLang } from "../core/i18n.js";
import { Store, EventBus, ActivityLog, SENSITIVE_KEYS } from "../core/store.js";
import { activateTab } from "../core/nav.js";
import { pocMark } from "../core/files.js";
import { Patients, Staff, Insurers } from "../core/entities.js";
import { Session } from "../security/session.js";

export const KEYS = { guarantee: "guarantee.list", docs: "docs.list", consent: "consent.list" };
/* ENCRYPTED TIER. Every tracker key references a pid, so it must live in Store's AES-GCM tier. lifecycle.registerRows()
   only adds the processing-register row; the encryption policy is Store's SENSITIVE_KEYS, which we join here at import
   time — before the first unlock decrypts the cache, so a stored envelope is read back correctly. (Integrator: the
   canonical home for these three names is store.js SENSITIVE_KEYS.exact; this push is idempotent either way.) */
for (const k of Object.values(KEYS)) if (!SENSITIVE_KEYS.exact.includes(k)) SENSITIVE_KEYS.exact.push(k);

/* Intro block rendered INSIDE the slot (the panel head above it belongs to the coordinator's scaffold): the two badges
   and the domain blurb, from the <ns>.badgeLaw / <ns>.badge / <ns>.blurb keys. */
export const introHTML = (ns) => `
  <div class="badges p3-badges"><span class="badge law">${esc(t(ns + ".badgeLaw"))}</span><span class="badge">${esc(t(ns + ".badge"))}</span></div>
  <p class="panel-blurb">${t(ns + ".blurb")}</p>`;
export const rid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const str = (v) => String(v ?? "").trim();
export const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
export const assertUnlocked = () => { if (!Session.isUnlocked()) throw Object.assign(new Error(t("guarantee.errLocked")), { code: "locked" }); };

/* ── collection(key): array-of-records facade over one encrypted Store key ── */
export function collection(key) {
  const read = () => { const v = Store.get(key, []); return Array.isArray(v) ? v : []; };
  const write = (rows) => { Store.set(key, rows); };
  return {
    key,
    list() { return read().map(r => ({ ...r })); },
    get(id) { const r = read().find(x => x.id === id); return r ? { ...r } : null; },
    // Insert or replace by id; stamps createdAt / updatedAt. Returns the stored record.
    upsert(rec) {
      assertUnlocked();
      const rows = read(), now = Date.now();
      const id = rec.id || rid(key.split(".")[0]);
      const i = rows.findIndex(x => x.id === id);
      const next = { ...(i >= 0 ? rows[i] : {}), ...rec, id, createdAt: i >= 0 ? rows[i].createdAt || now : rec.createdAt || now, updatedAt: now };
      if (i >= 0) rows[i] = next; else rows.push(next);
      write(rows);
      return { ...next };
    },
    // Remove → { row, index } for the undo toast; insert(row, index) puts it back in the same slot with the same id.
    remove(id) {
      assertUnlocked();
      const rows = read(), i = rows.findIndex(x => x.id === id);
      if (i < 0) return null;
      const [row] = rows.splice(i, 1);
      write(rows);
      return { row, index: i };
    },
    insert(row, index) {
      assertUnlocked();
      const rows = read();
      if (rows.some(x => x.id === row.id)) return;
      rows.splice(Math.min(Math.max(index ?? rows.length, 0), rows.length), 0, row);
      write(rows);
    },
    // Local + peer-tab changes and every re-unlock (the cache is refilled then).
    onChange(fn) { EventBus.on(`store:${key}`, () => fn()); EventBus.on("session:unlocked", () => fn()); }
  };
}

/* ── per-patient counts (홈 · the strip) ── */
const countFor = (key, pid) => (Store.get(key, []) || []).filter(r => r && r.pid === pid).length;
export function patientCounts(pid) {
  return { guarantees: countFor(KEYS.guarantee, pid), docs: countFor(KEYS.docs, pid), consents: countFor(KEYS.consent, pid) };
}
/* Patient strip — alias · tags · counts, each count a link into that tracker filtered on the pid. `self` hides the
   link of the panel the strip sits in. */
export function renderPatientStrip(host, pid, { self = "" } = {}) {
  if (!host) return;
  if (!pid) { host.hidden = true; host.innerHTML = ""; return; }
  const p = Patients.get(pid);
  const c = patientCounts(pid);
  const link = (tab, key, n) => tab === self
    ? `<span class="p3-count-pill current">${esc(t(key, { n }))}</span>`
    : `<button type="button" class="p3-count-pill" data-strip-go="${tab}">${esc(t(key, { n }))} →</button>`;
  host.hidden = false;
  host.innerHTML = `
    <span class="p3-strip-alias">${esc(Patients.alias(pid))}</span>
    ${(p?.tags || []).map(tg => `<span class="pill info">${esc(tg)}</span>`).join("")}
    ${p?.firstSeen ? `<span class="p3-strip-dates">${esc(t("patients.strip.seen", { first: p.firstSeen, last: p.lastSeen || p.firstSeen }))}</span>` : `<span class="p3-strip-dates">${esc(t("patients.strip.unregistered"))}</span>`}
    <span class="spacer"></span>
    ${link("tab-guarantee", "patients.strip.guarantees", c.guarantees)}
    ${link("tab-docs", "patients.strip.docs", c.docs)}
    ${link("tab-consent", "patients.strip.consents", c.consents)}`;
  host.querySelectorAll("[data-strip-go]").forEach(b => b.addEventListener("click", () => activateTab(b.dataset.stripGo, { pid })));
}

/* ── pickers ── */
// <option>s over the pseudonymous register: "환자 ****0142 · 자보, 교통사고". `extra` pids (a ctx pid not yet registered) are appended.
export function pidOptions(selected, { placeholder = true, extra = [] } = {}) {
  const list = Session.isUnlocked() ? Patients.list() : [];
  const pids = new Set(list.map(p => p.pid));
  const rows = [...list, ...extra.filter(Boolean).filter(pid => !pids.has(pid)).map(pid => ({ pid, alias: Patients.alias(pid), tags: [] }))];
  return (placeholder ? `<option value="">${esc(t("patients.pickPatient"))}</option>` : "")
    + rows.map(p => `<option value="${esc(p.pid)}"${p.pid === selected ? " selected" : ""}>${esc(p.alias)}${p.tags.length ? ` · ${esc(p.tags.join(", "))}` : ""}</option>`).join("");
}
// <option>s over the roster: "한의사 윤지훈" (the picker needs the full name to tell two 한의사 apart; every other surface shows Staff.ref).
export function staffOptions(selected, { jobs = null, placeholder = true } = {}) {
  const list = (Session.isUnlocked() ? Staff.list() : []).filter(s => !jobs || jobs.includes(s.job));
  return (placeholder ? `<option value="">${esc(t("patients.pickStaff"))}</option>` : "")
    + list.map(s => `<option value="${esc(s.id)}"${s.id === selected ? " selected" : ""}>${esc(roleLabel(s.job))} ${esc(s.name)}</option>`).join("");
}
export const staffRef = (id) => { const s = id ? Staff.get(id) : null; return s ? Staff.ref(s) : "—"; };
export const staffJob = (id) => (id && Staff.get(id)?.job) || "";
export function insurerOptions(selected) {
  return `<option value="">${esc(t("patients.pickInsurer"))}</option>` + Insurers.list().map(i => `<option value="${esc(i.value)}"${i.value === selected ? " selected" : ""}>${esc(pick(i, "label"))}</option>`).join("");
}
export const insurerLabel = (value) => { const i = Insurers.list().find(x => x.value === value); return i ? pick(i, "label") : (value || "—"); };
export const aliasOf = (pid) => pid ? Patients.alias(pid) : "—";
export const dash = (v) => (v == null || v === "" ? "—" : String(v));

/* ── audit: every entry pseudonymised through meta.pid (ActivityLog derives "****0142") ── */
export function audit(tag, text, pid, meta = {}) { return ActivityLog.push(tag, text, { ...meta, pid }); }

/* ── responsive table: <table> on desktop, a card list on the phone (td[data-th] carries the header label) ──
   columns: [{ key, label, cls? }]  rows: [{ id, cls?, cells: { key: html }, actions?: html }] */
export function renderTable(host, { columns, rows, empty, highlightId = null }) {
  if (!host) return;
  if (!rows.length) { host.innerHTML = `<div class="empty-state">${empty}</div>`; return; }
  host.innerHTML = `
    <table class="p3-table">
      <thead><tr>${columns.map(c => `<th class="${esc(c.cls || "")}">${esc(c.label)}</th>`).join("")}<th class="p3-th-actions"></th></tr></thead>
      <tbody>${rows.map(r => `
        <tr data-id="${esc(r.id)}" class="${esc(r.cls || "")}${r.id === highlightId ? " highlight" : ""}">
          ${columns.map(c => `<td class="${esc(c.cls || "")}" data-th="${esc(c.label)}">${r.cells[c.key] ?? "—"}</td>`).join("")}
          <td class="p3-actions" data-th="">${r.actions || ""}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  if (highlightId) host.querySelector(`tr[data-id="${CSS.escape(highlightId)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/* ── filter chips: values stay internal (Korean status values), labels via labelOf ── */
export function chipRow(values, active, labelOf, attr = "data-chip") {
  return values.map(v => `<button type="button" class="filter-chip${v === active ? " active" : ""}" ${attr}="${esc(v)}">${esc(labelOf(v))}</button>`).join("");
}

/* ── tab:activated dispatcher — ctx { pid } · { pid, create: true } · { id } ── */
export function onPanelCtx(tabId, { onPid, onCreate, onId }) {
  EventBus.on("tab:activated", (p) => {
    if (p?.id !== tabId) return;
    const c = p.ctx;
    if (!c) return;
    if (c.id && onId) onId(c.id);
    else if (c.create && onCreate) onCreate(c);
    else if (c.pid && onPid) onPid(c.pid);
  });
}

/* ── printable sheet — same pattern as 04's 가격 고지문: a new window with inline CSS, PoC mark in the footer.
   Returns the HTML so tests (and a popup-blocked browser) can still read it: with no window the HTML lands in
   #p3-print-fallback and window.print() is called. ── */
export function openPrint(title, bodyHTML) {
  const mark = pocMark();
  const css = `body{font:13px/1.5 -apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#111;margin:28px;} h5{font-size:20px;margin:0 0 4px;} h6{font-size:13px;margin:16px 0 4px;letter-spacing:.3px;} p{margin:2px 0 10px;color:#333;} table{width:100%;border-collapse:collapse;font-size:12.5px;} th,td{border-bottom:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top;} th{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:#333;} .code{font-family:ui-monospace,Menlo,monospace;} .muted{color:#666;font-size:11.5px;} .sign{margin-top:26px;display:flex;gap:40px;} .sign div{flex:1;border-top:1px solid #000;padding-top:6px;font-size:12px;} .mark{margin-top:22px;padding-top:6px;border-top:1px solid #000;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:1.5px;text-align:center;}`;
  const html = `${bodyHTML}<div class="mark">${esc(mark)}</div>`;
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) {
    let fb = $("#p3-print-fallback");
    if (!fb) { fb = document.createElement("div"); fb.id = "p3-print-fallback"; fb.className = "p3-print"; document.body.appendChild(fb); }
    fb.innerHTML = html;
    try { window.print(); } catch {}
    return html;
  }
  w.document.write(`<!doctype html><html lang="${esc(getLang())}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.print(); } catch {} }, 250);
  return html;
}

/* ── small formatters ── */
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (iso, n) => { const d = new Date((iso || ymd(new Date())) + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
export const dLabel = (iso) => { const n = daysUntil(iso); return n == null ? "—" : n < 0 ? `D+${-n}` : `D-${n}`; };
export { $, $$, esc, daysUntil };
