/* clinic-admin — claims area shared core (tabs 01 · 02, read by 06 · 07).
   THE CLAIM BATCH IS THE UNIT. One 청구 명세서 export → one `claims` batch whose rows are
     { stmt, pid, date, kcdCodes: [{ code, edi, primary, name, input, memo }], items: [{ code, name, qty, claimed }] }
   parsed from BOTH the 상병 columns (01 needs them) and the 행위 columns (02 needs them). A file that carries
   only one side is accepted and marked `meta.partial = "kcd" | "items"`. The 심평원 심사결과 file becomes a
   `review` batch linked through meta.claimsBatchId. Tab 01 cleans the 상병 side, tab 02 reconciles the 행위 side,
   both against the same batch, and both render the same 청구 배치 strip (renderBatchStrip).
   Entities come from the F1 contract (Batches · Patients · Tariff) — see _entities-shim.js for the local stand-in. */
import { esc, todayISO } from "../core/ui.js";
import { t } from "../core/i18n.js";
import { Store, EventBus } from "../core/store.js";
import { readSpreadsheet, loadJSON } from "../core/files.js";
import { toEdi, toDotted } from "../core/masters.js";
import { Batches, Patients, Tariff } from "./_entities-shim-claims.js"; // TODO(integrator): ../core/entities.js

const CURRENT_KEY = "ui.claimsBatch";   // plaintext ui.* setting — a batch id, nothing personal
const EV = "claims:batch";              // { id, kind: "claims" | "review" | "select" | "remove" }
export const SAMPLE_TAG = "hansol-2026-08";

/* ── column aliases (Korean EMR export headers — data, not UI copy) ── */
const COL = {
  stmt:     ["명세서번호", "명세서 번호", "접수번호", "청구번호"],
  pid:      ["환자번호", "등록번호", "환자ID"],
  date:     ["진료일자", "진료일", "일자", "요양개시일"],
  kcd:      ["KCD코드", "KCD8코드", "KCD9코드", "상병코드", "상병기호", "진단코드"],
  dx:       ["진단명", "상병명", "한글명"],
  rank:     ["주/부상병", "주부상병", "상병구분", "주부구분", "주상병구분"],
  memo:     ["비고"],
  item:     ["행위코드", "수가코드"],
  itemName: ["행위명", "항목명", "수가명", "명칭"],
  qty:      ["횟수", "청구횟수", "수량"],
  amt:      ["청구금액", "청구액", "금액"],
  generic:  ["코드"]
};
const REVIEW_COL = {
  stmt: ["명세서번호", "명세서 번호", "접수번호", "청구번호"], code: ["행위코드", "수가코드", "코드"],
  qty: ["인정횟수", "인정 횟수"], amt: ["인정금액", "인정액", "지급금액", "결정금액"],
  rkey: ["조정사유코드", "조정코드", "사유코드"], rtxt: ["조정사유", "조정사유명", "사유", "심사조정사유"]
};
const pickCol = (row, names) => { for (const n of names) if (row[n] != null && String(row[n]).trim() !== "") return String(row[n]).trim(); return ""; };
const hasCol = (rows, names) => rows.some(r => names.some(n => n in r));
const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
const isMainRank = (v) => /^(주|주상병|1|M|main)$/i.test(String(v).trim());
const isCodeShape = (edi) => /^[A-Z]\d{2}[A-Z0-9]{0,4}$/.test(edi);

/* ── 명세서 export → batch rows ── */
export function parseClaims(rawRows) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const hasK = hasCol(rows, COL.kcd), hasI = hasCol(rows, COL.item), hasG = !hasK && !hasI && hasCol(rows, COL.generic);
  const hasRank = hasCol(rows, COL.rank);
  const hasStmt = hasCol(rows, COL.stmt);
  const stmts = new Map();
  for (const row of rows) {
    const pid = pickCol(row, COL.pid), date = pickCol(row, COL.date);
    const stmt = hasStmt ? pickCol(row, COL.stmt) : (pid || date ? `${pid}·${date}` : "");
    if (!stmt && !pid) continue;
    const key = stmt || `${pid}|${date}`;
    if (!stmts.has(key)) stmts.set(key, { stmt, pid, date, kcdCodes: [], items: [] });
    const s = stmts.get(key);
    if (!s.pid && pid) s.pid = pid;
    if (!s.date && date) s.date = date;

    let kcdRaw = hasK ? pickCol(row, COL.kcd) : "";
    let itemRaw = hasI ? pickCol(row, COL.item) : "";
    if (hasG) { const g = pickCol(row, COL.generic); if (g) { if (isCodeShape(toEdi(g))) kcdRaw = g; else itemRaw = g; } }
    if (kcdRaw) {
      const edi = toEdi(kcdRaw);
      s.kcdCodes.push({
        code: isCodeShape(edi) ? toDotted(edi) : kcdRaw, edi, input: kcdRaw,
        primary: hasRank ? isMainRank(pickCol(row, COL.rank)) : false,
        name: pickCol(row, COL.dx), memo: pickCol(row, COL.memo)
      });
    }
    if (itemRaw) {
      s.items.push({ code: itemRaw, name: pickCol(row, COL.itemName), qty: num(pickCol(row, COL.qty)) || 1, claimed: num(pickCol(row, COL.amt)) });
    }
  }
  const out = [...stmts.values()];
  // No 주/부상병 column → the first non-U code of each 명세서 is treated as 주상병 (01 warns about the guess).
  if (!hasRank) for (const s of out) { const first = s.kcdCodes.find(k => k.edi && !/^U/.test(k.edi)); if (first) first.primary = true; }
  const anyK = out.some(s => s.kcdCodes.length), anyI = out.some(s => s.items.length);
  const months = [...new Set(out.map(s => (s.date || "").slice(0, 7)).filter(Boolean))].sort();
  const monthCount = new Map(); for (const s of out) { const m = (s.date || "").slice(0, 7); if (m) monthCount.set(m, (monthCount.get(m) || 0) + 1); }
  const month = [...monthCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return {
    rows: out,
    meta: {
      partial: !anyK && anyI ? "items" : anyK && !anyI ? "kcd" : null,
      hasRank, hasStmt, month, months,
      stmts: out.length, patients: new Set(out.map(s => s.pid).filter(Boolean)).size,
      kcdLines: out.reduce((a, s) => a + s.kcdCodes.length, 0), itemLines: out.reduce((a, s) => a + s.items.length, 0)
    }
  };
}
/* ── 심사결과통보 → review rows ── */
export function parseReview(rawRows) {
  return (Array.isArray(rawRows) ? rawRows : []).map(r => ({
    stmt: pickCol(r, REVIEW_COL.stmt), code: pickCol(r, REVIEW_COL.code),
    approvedQty: num(pickCol(r, REVIEW_COL.qty)), approved: num(pickCol(r, REVIEW_COL.amt)),
    reasonKey: pickCol(r, REVIEW_COL.rkey), reasonText: pickCol(r, REVIEW_COL.rtxt)
  })).filter(r => r.stmt || r.code);
}

/* ── batch creation (either tab) ── */
export function createClaimsBatch({ rows, source, sample = null }) {
  const parsed = parseClaims(rows);
  if (!parsed.rows.length) return null;
  const meta = { ...parsed.meta, sample, createdOn: todayISO() };
  const id = Batches.create({ kind: "claims", source, rows: parsed.rows, meta });
  const tag = meta.month ? `claims:${meta.month}` : "claims";
  for (const s of parsed.rows) if (s.pid) { Patients.ensure(s.pid, { tags: [tag] }); Patients.touch(s.pid, s.date); }
  Store.set(CURRENT_KEY, id);
  EventBus.emitLocal(EV, { id, kind: "claims" });
  return Batches.get(id);
}
export function createReviewBatch({ rows, source, claimsBatchId, sample = null }) {
  const lines = parseReview(rows);
  if (!lines.length) return null;
  const id = Batches.create({ kind: "review", source, rows: lines, meta: { claimsBatchId, lines: lines.length, sample, createdOn: todayISO() } });
  EventBus.emitLocal(EV, { id, kind: "review" });
  return Batches.get(id);
}
export async function ingestClaimsFile(file) {
  const rows = await readSpreadsheet(file);
  if (!rows.length) return { empty: true };
  const batch = createClaimsBatch({ rows, source: file.name });
  return batch ? { batch } : { empty: true };
}

/* ── current batch + lookups ── */
export function currentClaimsBatch() {
  const id = Store.get(CURRENT_KEY);
  const b = id ? Batches.get(id) : null;
  return b && b.kind === "claims" ? b : Batches.latest("claims");
}
export function reviewFor(claimsBatchId) {
  return claimsBatchId ? (Batches.list("review").find(r => r.meta?.claimsBatchId === claimsBatchId) || null) : null;
}
export function selectBatch(id) { Store.set(CURRENT_KEY, id); EventBus.emitLocal(EV, { id, kind: "select" }); }
export function removeBatch(id) {
  for (const r of Batches.list("review")) if (r.meta?.claimsBatchId === id) Batches.remove(r.id);
  Batches.remove(id);
  if (Store.get(CURRENT_KEY) === id) Store.remove(CURRENT_KEY);
  EventBus.emitLocal(EV, { id, kind: "remove" });
}
export const onClaimsChange = (fn) => EventBus.on(EV, fn);

/* ── side views ── */
// Tab 01: one row per 상병 line, 명세서-aware. `rank` only when the file had a 주/부상병 column.
export const kcdRowsOf = (batch) => (batch?.rows || []).flatMap(s => s.kcdCodes.map(k => ({
  stmt: s.stmt, pid: s.pid, date: s.date, rank: batch.meta?.hasRank ? (k.primary ? "주" : "부") : "",
  dx: k.name || "", input: k.input || k.code, memo: k.memo || ""
})));
// Tab 02: one line per 행위.
export const itemLinesOf = (batch) => (batch?.rows || []).flatMap(s => s.items.map(it => ({
  stmt: s.stmt, pid: s.pid, date: s.date, code: it.code, name: it.name, qty: it.qty, claimed: it.claimed
})));
// Diagnosis codes of one 명세서 (dotted), for AI prefills and the 02 → 01 hand-off.
export const stmtCodes = (batch, stmt) => (batch?.rows || []).find(s => s.stmt === stmt)?.kcdCodes.map(k => k.code) || [];
export const stmtOf = (batch, stmt) => (batch?.rows || []).find(s => s.stmt === stmt) || null;

/* ── tariff (our 비급여 prices — Tariff.get may return a number or an object) ── */
export function tariffPrice(code) {
  const v = Tariff.get(code);
  const p = typeof v === "number" ? v : v && typeof v === "object" ? (v.price ?? v.amount ?? null) : v != null && v !== "" ? Number(v) : null;
  return Number.isFinite(p) && p > 0 ? p : null;
}
export function tariffRows(nameOf = () => "") {
  const all = Tariff.all();
  const list = Array.isArray(all) ? all : Object.entries(all || {}).map(([code, v]) => ({ code, price: typeof v === "object" ? v?.price : v }));
  return list.map(r => ({ code: r.code, name: r.name || nameOf(r.code) || "", price: Number(r.price) })).filter(r => r.code && Number.isFinite(r.price) && r.price > 0);
}

/* ── 청구 배치 strip (rendered in #kcd-batch-strip and #jabo-batch-strip) ── */
export function renderBatchStrip(host, { onFile } = {}) {
  if (!host) return;
  const cur = currentClaimsBatch();
  const list = Batches.list("claims");
  const pickerOpen = host.dataset.pickerOpen === "1";
  const partialPill = (b) => b.meta?.partial === "kcd" ? `<span class="pill warn">${esc(t("jabo.batch.partialKcd"))}</span>`
                          : b.meta?.partial === "items" ? `<span class="pill warn">${esc(t("jabo.batch.partialItems"))}</span>` : "";
  const main = cur ? `
      <span class="pill info">${esc(t("jabo.batch.title"))}</span>
      <span class="batch-main"><strong>${esc(cur.source || "—")}</strong> · ${esc(t("jabo.batch.stmts", { n: cur.meta?.stmts ?? cur.rows.length }))} · ${esc(t("jabo.batch.patients", { n: cur.meta?.patients ?? 0 }))}${cur.meta?.month ? ` · <span class="code">${esc(cur.meta.month)}</span>` : ""}</span>
      ${partialPill(cur)}${cur.meta?.sample ? `<span class="pill">${esc(t("jabo.batch.sample"))}</span>` : ""}`
    : `<span class="pill info">${esc(t("jabo.batch.title"))}</span><span class="batch-main batch-empty">${esc(t("jabo.batch.empty"))}</span>`;
  host.innerHTML = `
    <div class="batch-strip">
      ${main}
      <div class="batch-actions">
        ${list.length > 1 ? `<button type="button" class="ghost" data-batch-pick aria-expanded="${pickerOpen}">${esc(t("jabo.batch.pick"))}</button>` : ""}
        <button type="button" class="ghost" data-batch-new>${esc(t("jabo.batch.new"))}</button>
        <input type="file" accept=".xlsx,.xls,.csv" hidden>
      </div>
    </div>
    <div class="batch-picker" ${pickerOpen && list.length > 1 ? "" : "hidden"}>
      ${list.map(b => `<div class="batch-row${cur && b.id === cur.id ? " current" : ""}">
          <span class="code">${esc(b.meta?.month || "—")}</span>
          <span class="batch-row-main"><strong>${esc(b.source || "—")}</strong> · ${esc(t("jabo.batch.stmts", { n: b.meta?.stmts ?? b.rows.length }))}${reviewFor(b.id) ? ` · <span class="pill ok">${esc(t("jabo.batch.reviewLinked"))}</span>` : ""}</span>
          <span class="batch-row-date">${esc(b.meta?.createdOn || "")}</span>
          ${cur && b.id === cur.id ? `<span class="pill info">${esc(t("jabo.batch.current"))}</span>` : `<button type="button" class="ghost" data-batch-use="${esc(b.id)}">${esc(t("jabo.batch.use"))}</button>`}
          <button type="button" class="ghost danger" data-batch-remove="${esc(b.id)}" aria-label="${esc(t("common.delete"))}">×</button>
        </div>`).join("")}
    </div>`;
  const input = host.querySelector("input[type=file]");
  host.querySelector("[data-batch-new]")?.addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => { const f = e.target.files[0]; if (f && onFile) onFile(f); e.target.value = ""; });
  host.querySelector("[data-batch-pick]")?.addEventListener("click", () => { host.dataset.pickerOpen = pickerOpen ? "0" : "1"; renderBatchStrip(host, { onFile }); });
  host.querySelectorAll("[data-batch-use]").forEach(b => b.addEventListener("click", () => { host.dataset.pickerOpen = "0"; selectBatch(b.dataset.batchUse); }));
  host.querySelectorAll("[data-batch-remove]").forEach(b => b.addEventListener("click", () => { removeBatch(b.dataset.batchRemove); }));
}

/* ── shared-clinic sample (한솔한방병원 · 2026-08 · 명세서 M2608-0001…0012) ── */
let sampleRows = null;
export const loadSampleRows = async () => sampleRows || (sampleRows = await Promise.all([
  loadJSON("./data/jabo-sample-claims.json"), loadJSON("./data/jabo-sample-review.json")
]).then(([c, r]) => ({ claims: c, review: r })));

let samplePending = null;
// One shared batch for every tab's seed(): re-used when it already exists (and re-selected), created once otherwise.
export function ensureSampleBatch() {
  const existing = Batches.list("claims").find(b => b.meta?.sample === SAMPLE_TAG);
  if (existing && reviewFor(existing.id)) {
    if (Store.get(CURRENT_KEY) !== existing.id) selectBatch(existing.id);
    return Promise.resolve({ claims: existing, review: reviewFor(existing.id) });
  }
  if (!samplePending) samplePending = (async () => {
    const s = await loadSampleRows();
    const claims = existing || createClaimsBatch({ rows: s.claims.rows, source: s.claims.file_name, sample: SAMPLE_TAG });
    if (existing) selectBatch(existing.id);
    const review = reviewFor(claims.id) || createReviewBatch({ rows: s.review.rows, source: s.review.file_name, claimsBatchId: claims.id, sample: SAMPLE_TAG });
    return { claims, review };
  })().finally(() => { samplePending = null; });
  return samplePending;
}
