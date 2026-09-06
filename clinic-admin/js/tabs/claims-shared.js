/* clinic-admin — claims area shared core (청구 배치 · 상병 정비 · 자보/건보 심사결과 대조 · 이의신청, read by 검색 · AI · 홈).
   THE CLAIM BATCH IS THE UNIT. One 청구 명세서 export → one `claims` batch whose rows are
     { stmt, pid, date, kcdCodes: [{ code, edi, primary, name, input, memo }], items: [{ code, name, qty, claimed }] }
   parsed from BOTH the 상병 columns (상병 정비 needs them) and the 행위 columns (대조 needs them). A file that carries
   only one side is accepted and marked `meta.partial = "kcd" | "items"`. The 심평원 심사결과 file becomes a
   `review` batch linked through meta.claimsBatchId.

   PAYER (Phase 3): a batch is payer-agnostic in shape but carries `meta.payer: "auto" | "nhis" | null` — derived from a
   보험유형 column (aliases 보험유형/보험구분/구분; 건강보험·건보·NHIS → nhis, 자동차보험·자보 → auto), else from the surface
   that uploaded it (심사결과 대조 → auto, 건보 대조 → nhis), else null = 미지정 and the 청구 배치 landing asks with a
   batch-level select (setBatchPayer). `currentClaimsBatch()` is the legacy global current (ui.claimsBatch — the strip's
   selection, used by 상병 정비); `currentClaimsBatch(payer)` resolves that payer's own current batch (ui.claimsBatch.<payer>,
   else the latest batch of that payer) so seeding a 건보 batch never hijacks the 자보 대조 and vice versa.

   RECONCILIATION is shared: reconcile() joins claims ⨝ review on 명세서번호 + 행위코드; renderReconciliation(host, …) draws
   the same summary / by-reason / by-month / line table for either payer (자보 with the 보험사 select, 건보 without) and wires
   the per-row hand-offs (상병 정비 · 검색 · AI · 이의신청 준비).

   APPEALS (이의신청) live here as a data layer (Appeals) so the landing, both 대조 panels, the 이의신청 panel and 홈 share one
   store key without a tab→tab import cycle: `appeals.list` (encrypted — carries the 환자번호 — listed in store.js
   SENSITIVE_KEYS and registered below with purpose/basis/retention). 홈 reads appealStats() / appealDeadlines() from here.

   DOMAIN NOTES (confidence stated):
   · 건강보험: 요양기관 → 심평원 EDI 명세서 청구 (monthly) → 심사결과통보서 (조정 lines + 조정사유) → 공단 지급 at 인정 amount.
     High confidence on the cycle; the 조정사유 keys used here are descriptive classes, NOT real 심평원 codes.
   · 이의신청 (국민건강보험법 §87): 처분이 있음을 안 날부터 90일 이내 (처분일부터 180일) — medium-high confidence on the 90-day
     figure, labelled "확인 필요" in the UI; needs 진료기록 사본 등 근거. Outcomes 인정 / 일부인정 / 기각.
   · 자보: 이의제기 to 심평원 자보심사센터 first; the deadline window is also shown as 90일 "확인 필요" (LOW confidence —
     the 자배법 기준 may differ; the notice's own wording wins).
   Entities: core/entities.js (Batches · Patients · Tariff). Events: `claims:batch` { id, kind: "claims" | "review" | "select" |
   "remove" | "payer" } is emitted LOCALLY here after every batch mutation. */
import { esc, todayISO, daysUntil, fmtKRW, won } from "../core/ui.js";
import { t } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, loadJSON, headerRow } from "../core/files.js";
import { toEdi, toDotted } from "../core/masters.js";
import { activateTab } from "../core/nav.js";
import { Batches, Patients, Tariff, ENTITY_KEYS } from "../core/entities.js";
import { registerRows } from "../security/lifecycle.js";

const CURRENT_KEY = "ui.claimsBatch";   // plaintext ui.* setting — a batch id, nothing personal
const payerKey = (p) => `${CURRENT_KEY}.${p}`; // ui.claimsBatch.auto · ui.claimsBatch.nhis
const EV = "claims:batch";              // { id, kind: "claims" | "review" | "select" | "remove" | "payer" }
export const SAMPLE_TAG = "hansol-2026-08";
export const NHIS_SAMPLE_TAG = "hansol-nhis-2026-08";
export const PAYERS = ["auto", "nhis"];
export const payerLabel = (p) => t(p === "nhis" ? "claims.payer.nhis" : p === "auto" ? "claims.payer.auto" : "claims.payer.none");
export const reconTabOf = (p) => p === "nhis" ? "tab-nhis" : "tab-jabo";

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
  payer:    ["보험유형", "보험구분", "구분"],
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

/* ── payer ── */
// "건강보험" · "건보" · "NHIS" → nhis · "자동차보험" · "자보" · "auto" → auto · anything else → null (unknown).
export function payerOf(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/건강보험|건보|NHIS|NHI\b|health/i.test(s)) return "nhis";
  if (/자동차|자보|auto/i.test(s)) return "auto";
  return null;
}
// Majority vote over the payer column (a generic 구분 column with unrelated values yields no votes → null).
function detectPayer(rows) {
  const votes = { auto: 0, nhis: 0 };
  for (const r of rows) { const p = payerOf(pickCol(r, COL.payer)); if (p) votes[p]++; }
  if (!votes.auto && !votes.nhis) return null;
  return votes.nhis > votes.auto ? "nhis" : "auto";
}
export const batchPayer = (b) => (b?.meta?.payer === "nhis" || b?.meta?.payer === "auto") ? b.meta.payer : null;

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
  // No 주/부상병 column → the first non-U code of each 명세서 is treated as 주상병 (상병 정비 warns about the guess).
  if (!hasRank) for (const s of out) { const first = s.kcdCodes.find(k => k.edi && !/^U/.test(k.edi)); if (first) first.primary = true; }
  const anyK = out.some(s => s.kcdCodes.length), anyI = out.some(s => s.items.length);
  const months = [...new Set(out.map(s => (s.date || "").slice(0, 7)).filter(Boolean))].sort();
  const monthCount = new Map(); for (const s of out) { const m = (s.date || "").slice(0, 7); if (m) monthCount.set(m, (monthCount.get(m) || 0) + 1); }
  const month = [...monthCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return {
    rows: out,
    meta: {
      partial: !anyK && anyI ? "items" : anyK && !anyI ? "kcd" : null,
      hasRank, hasStmt, month, months, payer: detectPayer(rows),
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

/* ── batch creation (any surface) ──
   payer: explicit override (a surface that only handles one payer) · defaultPayer: used when the file has no payer column ·
   select: false keeps the global current (ui.claimsBatch) untouched — the seed uses it so 상병 정비 stays on the 자보 batch. */
export function createClaimsBatch({ rows, source, sample = null, payer, defaultPayer = null, select = true }) {
  const parsed = parseClaims(rows);
  if (!parsed.rows.length) return null;
  const meta = { ...parsed.meta, payer: payer ?? parsed.meta.payer ?? defaultPayer ?? null, sample, createdOn: todayISO() };
  const id = Batches.create({ kind: "claims", source, rows: parsed.rows, meta });
  const tag = meta.month ? `claims:${meta.month}` : "claims";
  for (const s of parsed.rows) if (s.pid) { Patients.ensure(s.pid, { tags: [tag, ...(meta.payer ? [meta.payer === "nhis" ? "건보" : "자보"] : [])] }); Patients.touch(s.pid, s.date); }
  if (select) Store.set(CURRENT_KEY, id);
  if (meta.payer) Store.set(payerKey(meta.payer), id);
  EventBus.emitLocal(EV, { id, kind: "claims", payer: meta.payer });
  return Batches.get(id);
}
/* `origin` names the uploading surface ("jabo" · "nhis" · "landing" · undefined for the sample seed) so a 대조 panel can tell
   its own upload (it re-runs itself) from one made on the 청구 배치 landing (it must re-derive). */
export function createReviewBatch({ rows, source, claimsBatchId, sample = null, origin = null }) {
  const lines = parseReview(rows);
  if (!lines.length) return null;
  const claims = claimsBatchId ? Batches.get(claimsBatchId) : null;
  const payer = batchPayer(claims) ?? detectPayer(rows);
  const id = Batches.create({ kind: "review", source, rows: lines, meta: { claimsBatchId, lines: lines.length, sample, payer, createdOn: todayISO() } });
  EventBus.emitLocal(EV, { id, kind: "review", claimsBatchId, origin, payer });
  return Batches.get(id);
}
export async function ingestClaimsFile(file, opts = {}) {
  const rows = await readSpreadsheet(file);
  if (!rows.length) return { empty: true };
  const batch = createClaimsBatch({ rows, source: file.name, ...opts });
  return batch ? { batch } : { empty: true };
}
// Assign / change a batch's payer (the landing's 미지정 select). Also stamps the linked review batch.
export function setBatchPayer(id, payer) {
  const b = Batches.get(id);
  if (!b || !PAYERS.includes(payer)) return null;
  Store.set(ENTITY_KEYS.batch + id, { ...b, meta: { ...(b.meta || {}), payer } });
  const r = reviewFor(id);
  if (r) Store.set(ENTITY_KEYS.batch + r.id, { ...r, meta: { ...(r.meta || {}), payer } });
  if (Store.get(CURRENT_KEY) === id || !Store.get(payerKey(payer))) Store.set(payerKey(payer), id);
  EventBus.emitLocal(EV, { id, kind: "payer", payer });
  return Batches.get(id);
}

/* ── current batch + lookups ── */
export function currentClaimsBatch(payer) {
  if (!payer) {
    const id = Store.get(CURRENT_KEY);
    const b = id ? Batches.get(id) : null;
    return b && b.kind === "claims" ? b : Batches.latest("claims");
  }
  const id = Store.get(payerKey(payer));
  const b = id ? Batches.get(id) : null;
  if (b && b.kind === "claims" && batchPayer(b) === payer) return b;
  return Batches.list("claims").find(x => batchPayer(x) === payer) || null;
}
export function reviewFor(claimsBatchId) {
  return claimsBatchId ? (Batches.list("review").find(r => r.meta?.claimsBatchId === claimsBatchId) || null) : null;
}
export function selectBatch(id) {
  Store.set(CURRENT_KEY, id);
  const p = batchPayer(Batches.get(id)); if (p) Store.set(payerKey(p), id);
  EventBus.emitLocal(EV, { id, kind: "select", payer: p });
}
export function removeBatch(id) {
  for (const r of Batches.list("review")) if (r.meta?.claimsBatchId === id) Batches.remove(r.id);
  Batches.remove(id);
  if (Store.get(CURRENT_KEY) === id) Store.remove(CURRENT_KEY);
  for (const p of PAYERS) if (Store.get(payerKey(p)) === id) Store.remove(payerKey(p));
  EventBus.emitLocal(EV, { id, kind: "remove" });
}
export const onClaimsChange = (fn) => EventBus.on(EV, fn);

/* ── side views ── */
// 상병 정비: one row per 상병 line, 명세서-aware. `rank` only when the file had a 주/부상병 column.
export const kcdRowsOf = (batch) => (batch?.rows || []).flatMap(s => s.kcdCodes.map(k => ({
  stmt: s.stmt, pid: s.pid, date: s.date, rank: batch.meta?.hasRank ? (k.primary ? "주" : "부") : "",
  dx: k.name || "", input: k.input || k.code, memo: k.memo || ""
})));
// 대조: one line per 행위.
export const itemLinesOf = (batch) => (batch?.rows || []).flatMap(s => s.items.map(it => ({
  stmt: s.stmt, pid: s.pid, date: s.date, code: it.code, name: it.name, qty: it.qty, claimed: it.claimed
})));
// Diagnosis codes of one 명세서 (dotted), for AI prefills and the 대조 → 상병 정비 hand-off.
export const stmtCodes = (batch, stmt) => (batch?.rows || []).find(s => s.stmt === stmt)?.kcdCodes.map(k => k.code) || [];
export const stmtOf = (batch, stmt) => (batch?.rows || []).find(s => s.stmt === stmt) || null;

/* ── reconciliation core (shared by 자보 · 건보) ──
   lines: itemLinesOf(claimsBatch) · review: reviewBatch.rows (parseReview shape) → { lines, orphans, totals, stmts, byMonth } */
export function reconcile(lines, review) {
  const revIdx = new Map();
  for (const r of review) revIdx.set(`${r.stmt}|${r.code}`, r);
  const out = [];
  const matched = new Set();
  for (const c of lines) {
    const key = `${c.stmt}|${c.code}`;
    const r = revIdx.get(key);
    const approved = r ? r.approved : null;
    const delta = approved == null ? 0 : c.claimed - approved;
    const status = !r ? "none" : delta <= 0 ? "full" : approved === 0 ? "cut_all" : "cut_part";
    if (r) matched.add(key);
    out.push({ ...c, approvedQty: r ? r.approvedQty : null, approved, delta, status, reasonKey: r?.reasonKey || "", reasonText: r?.reasonText || "", hasCut: delta > 0 });
  }
  const orphans = review.filter(r => !matched.has(`${r.stmt}|${r.code}`)).map(r => ({ stmt: r.stmt, code: r.code, approved: r.approved, reason: r.reasonText }));
  const totals = out.reduce((a, l) => { a.claimed += l.claimed; if (l.approved != null) { a.approved += l.approved; a.reviewed += l.claimed; } a.cut += Math.max(0, l.delta); return a; }, { claimed: 0, approved: 0, reviewed: 0, cut: 0 });
  const byMonth = new Map();
  for (const l of out) {
    const m = (l.date || "").slice(0, 7) || "—";
    if (!byMonth.has(m)) byMonth.set(m, { month: m, claimed: 0, approved: 0, cut: 0, lines: 0, unreviewed: 0 });
    const g = byMonth.get(m); g.lines++; g.claimed += l.claimed;
    if (l.approved == null) g.unreviewed++; else { g.approved += l.approved; g.cut += Math.max(0, l.delta); }
  }
  const stmts = new Set(out.map(l => l.stmt)).size;
  return { lines: out, orphans, totals, stmts, byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)) };
}
// Reconciliation of a payer's current batch pair, or null — the landing / 홈 derive step states from this.
export function reconOf(payer) {
  const c = currentClaimsBatch(payer); if (!c || c.meta?.partial === "kcd") return null;
  const r = reviewFor(c.id); if (!r) return null;
  return { claims: c, review: r, res: reconcile(itemLinesOf(c), r.rows) };
}
// Reason text for a line — file wording first (the notice's own words win), else the class label in the UI language
// (matched by key), else "reason not stated". `reasonLabel(key) → string | null` is payer-specific.
export const lineReasonOf = (reasonLabel) => (l) => {
  if (!l.hasCut) return "";
  const known = reasonLabel(l.reasonKey);
  if (known) return known;
  return l.reasonText || t("jabo.reasonUnknown");
};
// Group the cut lines by reason — `keyOf` = display text (tables) or the stable reason key (history → 홈 KPI tile).
export function groupCuts(lines, keyOf) {
  const byReason = new Map();
  for (const l of lines) if (l.hasCut) {
    const k = keyOf(l);
    if (!byReason.has(k)) byReason.set(k, { reason: k, lines: 0, cut: 0 });
    const g = byReason.get(k); g.lines++; g.cut += l.delta;
  }
  return [...byReason.values()].sort((a, b) => b.cut - a.cut);
}
export const reasonKeysOf = (lines) => groupCuts(lines, (l) => l.reasonKey || l.reasonText || "other").map(g => ({ key: g.reason, cut: g.cut, lines: g.lines }));
// 건보 조정사유 classes — descriptive keys (NOT real 심평원 codes), labels via nhis.reason.<key>.
export const NHIS_REASON_KEYS = ["days_exceeded", "freq_exceeded", "dx_proc_mismatch", "eligibility", "copay_class", "docs_missing"];
export const nhisReasonLabel = (key) => key && NHIS_REASON_KEYS.includes(key) ? t("nhis.reason." + key) : null;
const STATUS_CLS = { full: "ok", cut_part: "warn", cut_all: "err", none: "info" };
export const reconStatusLabel = (s) => t("jabo.status." + s);

// The facts an appeal draft is created from (one 대조 line with a cut).
export function appealFactsOf(l, claims, { payer, insurer = "", procName = (c, n) => n, reasonLabel = () => null } = {}) {
  return {
    batchId: claims.id, payer: payer || batchPayer(claims) || "auto", stmt: l.stmt, code: l.code, reasonKey: l.reasonKey || "", reasonText: l.reasonText || "",
    reason: lineReasonOf(reasonLabel)(l), pid: l.pid, date: l.date, month: claims.meta?.month || (l.date || "").slice(0, 7), name: procName(l.code, l.name) || l.code,
    qty: l.qty, approvedQty: l.approvedQty, claimed: l.claimed, approved: l.approved ?? 0, cutAmount: Math.max(0, l.delta), insurer, dx: stmtCodes(claims, l.stmt)
  };
}

/* renderReconciliation(host, opts) — draws summary · by-reason · by-month · line table into the [data-recon=…] slots of `host`
   and wires the row actions. Returns the reconciliation result. Both 대조 panels call this; the history entry / status line
   stay with the caller.
     claims · review      the batch pair
     payer                "auto" | "nhis" (reason vocabulary · 이의신청 facts · activity tag)
     insurerSelect        show/hide [data-recon=insurer] (자보 only)
     procName(code, name) localised 행위명 (Masters.fee) · reasonLabel(key) → label | null
     askReasons           Set of reason keys that get the AI action · askPrefill(l) → text
     insurer()            current 보험사 value (자보) for the appeal facts
     focusStmt            highlight + scroll to that 명세서's rows ({ stmt } ctx) */
export function renderReconciliation(host, { claims, review, payer = "auto", insurerSelect = payer === "auto", procName = (c, n) => n, reasonLabel = () => null, askReasons = new Set(), askPrefill = null, insurer = () => "", focusStmt = null } = {}) {
  if (!host || !claims || !review) return null;
  const q = (k) => host.querySelector(`[data-recon="${k}"]`);
  const res = reconcile(itemLinesOf(claims), review.rows);
  const { lines, orphans, totals, byMonth, stmts } = res;
  const lineReason = lineReasonOf(reasonLabel);
  const byReason = groupCuts(lines, lineReason);
  const rate = totals.reviewed ? Math.round((totals.cut / totals.reviewed) * 1000) / 10 : 0;
  const tag = payer === "nhis" ? "nhis" : "jabo";
  const tb = q("toolbar"); if (tb) tb.style.display = "flex";
  const dl = q("download"); if (dl) dl.disabled = false;
  const ins = q("insurer"); if (ins) ins.hidden = !insurerSelect;
  const sum = q("summary"); if (sum) sum.innerHTML = t("jabo.reconSummary", { s: stmts, l: lines.length, c: won(totals.claimed), a: won(totals.approved), cut: won(totals.cut), rate });

  const groups = q("groups");
  if (groups) groups.innerHTML = `
      <div class="recon-groups">
        <div class="recon-group">
          <h5>${esc(t("jabo.byReasonH"))} <span>${esc(t("jabo.exampleClass"))}</span></h5>
          ${byReason.length ? `<table><thead><tr><th>${esc(t("jabo.thReason"))}</th><th class="code">${esc(t("jabo.thLines"))}</th><th class="code">${esc(t("jabo.thCut"))}</th></tr></thead><tbody>
            ${byReason.map(g => `<tr><td>${esc(g.reason)}</td><td class="code" style="text-align:right">${g.lines}</td><td class="code" style="text-align:right; color:var(--accent)">−${fmtKRW(g.cut)}</td></tr>`).join("")}
          </tbody></table>` : `<div class="empty-state small">${esc(t("jabo.noCuts"))}</div>`}
        </div>
        <div class="recon-group">
          <h5>${esc(t("jabo.byMonthH"))}</h5>
          <table><thead><tr><th>${esc(t("jabo.thMonth"))}</th><th class="code">${esc(t("jabo.thClaimed"))}</th><th class="code">${esc(t("jabo.thApproved"))}</th><th class="code">${esc(t("jabo.thAdj"))}</th><th class="code">${esc(t("jabo.thRate"))}</th></tr></thead><tbody>
            ${byMonth.map(g => {
              const rv = g.claimed ? Math.round((g.cut / g.claimed) * 1000) / 10 : 0;
              return `<tr><td class="code">${esc(g.month)}${g.unreviewed ? ` <span class="pill info" title="${esc(t("jabo.unreviewedTitle"))}">${g.unreviewed}</span>` : ""}</td>
                <td class="code" style="text-align:right">${fmtKRW(g.claimed)}</td><td class="code" style="text-align:right">${fmtKRW(g.approved)}</td>
                <td class="code" style="text-align:right; color:var(--accent)">${g.cut ? "−" + fmtKRW(g.cut) : "0"}</td><td class="code" style="text-align:right">${rv}%</td></tr>`;
            }).join("")}
          </tbody></table>
        </div>
      </div>`;

  const appealed = (l) => Appeals.findByLine({ batchId: claims.id, stmt: l.stmt, code: l.code });
  const result = q("result");
  if (result) {
    result.innerHTML = `
      <table>
        <thead><tr>
          <th class="code">${esc(t("jabo.thStmt"))}</th><th>${esc(t("jabo.fPid"))}</th><th class="code">${esc(t("jabo.fDate"))}</th><th class="code">${esc(t("jabo.thCode"))}</th><th>${esc(t("jabo.thName"))}</th>
          <th class="code">${esc(t("jabo.thClaimed"))}</th><th class="code">${esc(t("jabo.thApproved"))}</th><th class="code">${esc(t("jabo.thDelta"))}</th><th>${esc(t("common.thResult"))}</th><th>${esc(t("jabo.thReason"))}</th><th>${esc(t("jabo.thActions"))}</th>
        </tr></thead>
        <tbody>
          ${lines.map((l, i) => {
            const ap = l.hasCut ? appealed(l) : null;
            return `<tr class="${focusStmt && l.stmt === focusStmt ? "focus" : ""}" data-stmt="${esc(l.stmt)}">
              <td class="code">${esc(l.stmt)}</td><td>${l.pid ? esc(Patients.alias(l.pid)) : "—"}</td><td class="code">${esc(l.date)}</td>
              <td class="code">${esc(l.code)}</td><td>${esc(procName(l.code, l.name)) || "—"}</td>
              <td class="code" style="text-align:right">${fmtKRW(l.claimed)}<span class="qty-mini">×${l.qty}</span></td>
              <td class="code" style="text-align:right">${l.approved == null ? "—" : fmtKRW(l.approved) + `<span class="qty-mini">×${l.approvedQty}</span>`}</td>
              <td class="code" style="text-align:right${l.delta > 0 ? "; color:var(--accent); font-weight:600" : ""}">${l.delta > 0 ? "−" + fmtKRW(l.delta) : l.approved == null ? "—" : "0"}</td>
              <td><span class="pill ${STATUS_CLS[l.status]}">${esc(reconStatusLabel(l.status))}</span></td>
              <td style="font-size:11px; color:var(--ink-2)">${esc(lineReason(l)) || "—"}</td>
              <td class="actions">
                <button type="button" class="row-act" data-act="kcd" data-i="${i}" title="${esc(t("jabo.actKcdTitle"))}">${esc(t("jabo.actKcd"))}</button>
                <button type="button" class="row-act" data-act="search" data-i="${i}" title="${esc(t("jabo.actSearchTitle"))}">${esc(t("jabo.actSearch"))}</button>
                ${l.hasCut && askPrefill && askReasons.has(l.reasonKey) ? `<button type="button" class="row-act accent" data-act="ask" data-i="${i}" title="${esc(t("jabo.actAskTitle"))}">${esc(t("jabo.actAsk"))}</button>` : ""}
                ${l.hasCut ? (ap ? `<button type="button" class="row-act appeal-open" data-act="appeal-open" data-i="${i}" data-appeal="${esc(ap.id)}" title="${esc(t("claims.actAppealOpenTitle"))}">${esc(t("claims.actAppealOpen", { st: t("appeal.status." + ap.status) }))}</button>`
                                     : `<button type="button" class="row-act accent" data-act="appeal" data-i="${i}" title="${esc(t("claims.actAppealTitle"))}">${esc(t("claims.actAppeal"))}</button>`) : ""}
              </td>
            </tr>`; }).join("")}
          ${orphans.map(o => `<tr class="orphan">
              <td class="code">${esc(o.stmt)}</td><td>—</td><td>—</td><td class="code">${esc(o.code)}</td><td><em>${esc(t("jabo.orphanLine"))}</em></td>
              <td>—</td><td class="code" style="text-align:right">${fmtKRW(o.approved)}</td><td>—</td><td><span class="pill warn">${esc(t("jabo.status.orphan"))}</span></td><td style="font-size:11px">${esc(o.reason) || "—"}</td><td>—</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
    result.querySelectorAll("button[data-act]").forEach(btn => btn.addEventListener("click", () => {
      const l = lines[+btn.dataset.i]; if (!l) return;
      const act = btn.dataset.act;
      if (act === "kcd") activateTab("tab-kcd", { stmt: l.stmt, batchId: claims.id });
      else if (act === "search") activateTab("tab-search", { query: l.code });
      else if (act === "ask") {
        ActivityLog.push(tag, t("jabo.logAsk", { code: l.code }), { pid: l.pid });
        activateTab("tab-ai", { prefill: askPrefill(l), pid: l.pid, stmt: l.stmt });
      }
      else if (act === "appeal") activateTab("tab-appeal", { create: appealFactsOf(l, claims, { payer, insurer: insurer() || "", procName, reasonLabel }) });
      else if (act === "appeal-open") activateTab("tab-appeal", { appealId: btn.dataset.appeal });
    }));
    if (focusStmt) setTimeout(() => result.querySelector("tr.focus")?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  }
  return res;
}
// XLSX rows for a reconciliation (the caller adds payer-specific footer rows and downloads — watermark applied by downloadXLSX).
export function reconExportRows(res, { procName = (c, n) => n, reasonLabel = () => null } = {}) {
  const lineReason = lineReasonOf(reasonLabel);
  const R = (l) => headerRow([
    ["jabo.col.stmt", l.stmt], ["jabo.col.pid", l.pid], ["jabo.col.date", l.date], ["jabo.col.code", l.code], ["jabo.col.name", l.name],
    ["jabo.col.qty", l.qty], ["jabo.col.claimed", l.claimed], ["jabo.col.aqty", l.aqty], ["jabo.col.approved", l.approved],
    ["jabo.col.delta", l.delta], ["jabo.col.result", l.result], ["jabo.col.reason", l.reason]
  ]);
  const rows = res.lines.map(l => R({
    stmt: l.stmt, pid: l.pid, date: l.date, code: l.code, name: procName(l.code, l.name), qty: l.qty, claimed: l.claimed,
    aqty: l.approvedQty ?? "", approved: l.approved ?? "", delta: l.approved == null ? "" : l.delta, result: reconStatusLabel(l.status), reason: lineReason(l)
  }));
  for (const o of res.orphans) rows.push(R({ stmt: o.stmt, pid: "", date: "", code: o.code, name: t("jabo.orphanLine"), qty: "", claimed: "", aqty: "", approved: o.approved, delta: "", result: t("jabo.status.orphan"), reason: o.reason }));
  rows.push(R({ stmt: "", pid: "", date: "", code: "", name: t("jabo.total"), qty: "", claimed: res.totals.claimed, aqty: "", approved: res.totals.approved, delta: res.totals.cut, result: "", reason: "" }));
  for (const g of groupCuts(res.lines, lineReason)) rows.push(R({ stmt: "", pid: "", date: "", code: "", name: t("jabo.byReasonRow", { reason: g.reason }), qty: "", claimed: "", aqty: "", approved: "", delta: g.cut, result: t("jabo.nLines", { n: g.lines }), reason: "" }));
  return { rows, R };
}

/* ── tariff (our 비급여 단가표) — one representative price per code: 중간 when entered, else the midpoint of
   최저·최고, else 최저. Tariff.get(code) → { min, max, med, freq } | null (strings from the inputs). ── */
const posNum = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
function priceOf(e) {
  if (!e) return null;
  const med = posNum(e.med), min = posNum(e.min), max = posNum(e.max);
  return med ?? (min && max ? Math.round((min + max) / 2) : min ?? max);
}
export const tariffPrice = (code) => priceOf(Tariff.get(code));
export function tariffRows(nameOf = () => "") {
  return Object.entries(Tariff.all()).map(([code, e]) => ({ code, name: nameOf(code) || "", price: priceOf(e) })).filter(r => r.price);
}

/* ── 청구 배치 strip — FULL on the 청구 배치 landing (#claims-batch-strip: picker · 새 파일); COMPACT inside 상병 정비 /
   심사결과 대조 / 건보 대조 (#kcd-batch-strip · #jabo-batch-strip · #nhis-batch-strip): one line naming the batch + a link
   back to the landing. `payer` scopes the compact strip to that payer's current batch. ── */
const payerPill = (b) => { const p = batchPayer(b); return `<span class="pill ${p ? "info" : "warn"} payer">${esc(payerLabel(p))}</span>`; };
export function renderBatchStrip(host, { onFile, compact = false, payer = null } = {}) {
  if (!host) return;
  const cur = currentClaimsBatch(payer || undefined);
  const list = Batches.list("claims");
  const pickerOpen = host.dataset.pickerOpen === "1";
  const partialPill = (b) => b.meta?.partial === "kcd" ? `<span class="pill warn">${esc(t("jabo.batch.partialKcd"))}</span>`
                          : b.meta?.partial === "items" ? `<span class="pill warn">${esc(t("jabo.batch.partialItems"))}</span>` : "";
  const main = cur ? `
      <span class="pill info">${esc(t("jabo.batch.title"))}</span>
      <span class="batch-main"><strong>${esc(cur.source || "—")}</strong> · ${esc(t("jabo.batch.stmts", { n: cur.meta?.stmts ?? cur.rows.length }))} · ${esc(t("jabo.batch.patients", { n: cur.meta?.patients ?? 0 }))}${cur.meta?.month ? ` · <span class="code">${esc(cur.meta.month)}</span>` : ""}</span>
      ${payerPill(cur)}${partialPill(cur)}${cur.meta?.sample ? `<span class="pill">${esc(t("jabo.batch.sample"))}</span>` : ""}`
    : `<span class="pill info">${esc(t("jabo.batch.title"))}</span><span class="batch-main batch-empty">${esc(payer ? t("claims.batch.emptyPayer", { payer: payerLabel(payer) }) : t("jabo.batch.empty"))}</span>`;
  if (compact) {
    host.innerHTML = `
    <div class="batch-strip compact">
      ${main}
      <div class="batch-actions">
        <button type="button" class="ghost" data-batch-open>${esc(t("jabo.batch.open"))}</button>
      </div>
    </div>`;
    host.querySelector("[data-batch-open]").addEventListener("click", () => activateTab("tab-claims"));
    return;
  }
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
          <span class="batch-row-main"><strong>${esc(b.source || "—")}</strong> · ${esc(t("jabo.batch.stmts", { n: b.meta?.stmts ?? b.rows.length }))} · ${payerPill(b)}${reviewFor(b.id) ? ` · <span class="pill ok">${esc(t("jabo.batch.reviewLinked"))}</span>` : ""}</span>
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

/* ── shared-clinic samples ──
   자보: 한솔한방병원 · 2026-08 · 명세서 M2608-0001…0012 (data/jabo-sample-*.json)
   건보: 한솔한방병원 · 2026-08 · 명세서 N2608-0001…0010 (data/nhis-sample-*.json) — same 건보 patients 0233 · 0301 · 0509 */
let sampleRows = null;
export const loadSampleRows = async () => sampleRows || (sampleRows = await Promise.all([
  loadJSON("./data/jabo-sample-claims.json"), loadJSON("./data/jabo-sample-review.json")
]).then(([c, r]) => ({ claims: c, review: r })));
let nhisSampleRows = null;
export const loadNhisSampleRows = async () => nhisSampleRows || (nhisSampleRows = await Promise.all([
  loadJSON("./data/nhis-sample-claims.json"), loadJSON("./data/nhis-sample-review.json")
]).then(([c, r]) => ({ claims: c, review: r })));

// One shared batch pair per payer for every tab's seed(): re-used when it already exists, created once otherwise.
function ensurePair({ tag, payer, load, select, pendingRef }) {
  const existing = Batches.list("claims").find(b => b.meta?.sample === tag);
  if (existing && reviewFor(existing.id)) {
    if (select && Store.get(CURRENT_KEY) !== existing.id) selectBatch(existing.id);
    if (!Store.get(payerKey(payer))) Store.set(payerKey(payer), existing.id);
    return Promise.resolve({ claims: existing, review: reviewFor(existing.id) });
  }
  if (!pendingRef.p) pendingRef.p = (async () => {
    const s = await load();
    const claims = existing || createClaimsBatch({ rows: s.claims.rows, source: s.claims.file_name, sample: tag, payer, select });
    if (existing && select) selectBatch(existing.id);
    const review = reviewFor(claims.id) || createReviewBatch({ rows: s.review.rows, source: s.review.file_name, claimsBatchId: claims.id, sample: tag });
    return { claims, review };
  })().finally(() => { pendingRef.p = null; });
  return pendingRef.p;
}
const samplePending = { p: null }, nhisSamplePending = { p: null };
export const ensureSampleBatch = () => ensurePair({ tag: SAMPLE_TAG, payer: "auto", load: loadSampleRows, select: true, pendingRef: samplePending });
// The 건보 pair does NOT take the global current (select: false) — 상병 정비 keeps working on whatever the user picked.
export const ensureNhisSampleBatch = () => ensurePair({ tag: NHIS_SAMPLE_TAG, payer: "nhis", load: loadNhisSampleRows, select: false, pendingRef: nhisSamplePending });

/* ═══════════════════════════════ Appeals (이의신청) data layer ═══════════════════════════════
   appeals.list — encrypted (pid inside). One appeal per adjusted line, keyed { batchId, payer, stmt, code, reasonKey }.
     { id, batchId, payer, stmt, code, reasonKey, reasonText, reason, pid, date, month, name, qty, approvedQty, claimed, approved,
       cutAmount, insurer, dx: [..],
       status: "prep" | "submitted" | "result", result: null | "accepted" | "partial" | "rejected",
       summary, evidence, attachments: { records, tests, opinion } (booleans),
       noticeDate, dueDate (noticeDate + 90d — "확인 필요"), submittedDate, resultDate, resultAmount,
       createdAt, updatedAt }
   nhis.history — the 건보 대조 counterpart of jabo.history (counts + totals + byReason, no pid), 90 days. */
const APPEALS_KEY = "appeals.list";
const NHIS_HISTORY_KEY = "nhis.history";
registerRows([
  { id: "appeals.list", match: (k) => k === APPEALS_KEY, label: "이의신청 대장", detail: "조정 건별 이의신청 초안·상태 (환자번호·명세서번호·조정금액·기한·근거 메모)",
    purpose: "심평원 심사조정에 대한 이의신청 준비·기한 관리", basis: "국민건강보험법 §87 이의신청 · 자동차손해배상 보장법 §12의2 · 개인정보보호법 §15①4 (계약 이행)",
    encrypted: true, retention: "1년 (마지막 수정일 기준)", days: 365, purge: (v, cutoff) => (Array.isArray(v) ? v.filter(a => (a.updatedAt || a.createdAt || 0) >= cutoff) : v) },
  { id: "nhis.history", match: (k) => k === NHIS_HISTORY_KEY, label: "건보 대조 기록", detail: "대조 요약 (건수·금액·사유별 — 환자번호 없음)",
    purpose: "건보 조정 추세 집계 (홈)", basis: "동일 — 통계 목적, 최소 보존", encrypted: true, retention: "90일", days: 90,
    purge: (v, cutoff) => (Array.isArray(v) ? v.filter(h => (h.at || 0) >= cutoff) : v) }
]);
// Statutory window per payer — 국민건강보험법 §87: 90 days from knowing the decision (medium-high); 자보 shown with the same
// figure as a placeholder (LOW confidence). Both are labelled "확인 필요" in the UI.
export const APPEAL_WINDOW_DAYS = { nhis: 90, auto: 90 };
const addDays = (iso, n) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return ""; d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const aid = () => `ap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const str = (v) => String(v ?? "").trim();
const readAppeals = () => { const v = Store.get(APPEALS_KEY, []); return Array.isArray(v) ? v : []; };
const writeAppeals = (list) => Store.set(APPEALS_KEY, list);
const STATUSES = ["prep", "submitted", "result"];
const RESULTS = ["accepted", "partial", "rejected"];
function normAppeal(a) {
  const status = STATUSES.includes(a.status) ? a.status : "prep";
  const noticeDate = str(a.noticeDate);
  return {
    id: a.id || aid(), batchId: str(a.batchId), payer: a.payer === "nhis" ? "nhis" : "auto", stmt: str(a.stmt), code: str(a.code),
    reasonKey: str(a.reasonKey), reasonText: str(a.reasonText), reason: str(a.reason), pid: str(a.pid), date: str(a.date), month: str(a.month) || str(a.date).slice(0, 7),
    name: str(a.name), qty: a.qty ?? "", approvedQty: a.approvedQty ?? "", claimed: +a.claimed || 0, approved: +a.approved || 0, cutAmount: Math.max(0, +a.cutAmount || 0),
    insurer: str(a.insurer), dx: Array.isArray(a.dx) ? a.dx.map(str) : [],
    status, result: status === "result" && RESULTS.includes(a.result) ? a.result : null,
    summary: str(a.summary), evidence: str(a.evidence),
    attachments: { records: !!a.attachments?.records, tests: !!a.attachments?.tests, opinion: !!a.attachments?.opinion },
    noticeDate, dueDate: str(a.dueDate) || (noticeDate ? addDays(noticeDate, APPEAL_WINDOW_DAYS[a.payer === "nhis" ? "nhis" : "auto"]) : ""),
    submittedDate: str(a.submittedDate), resultDate: str(a.resultDate), resultAmount: a.resultAmount === "" || a.resultAmount == null ? "" : +a.resultAmount || 0,
    createdAt: a.createdAt || Date.now(), updatedAt: a.updatedAt || Date.now()
  };
}
const lineKey = (a) => `${a.batchId}|${a.stmt}|${a.code}`;
export const Appeals = {
  STATUSES, RESULTS, WINDOW_DAYS: APPEAL_WINDOW_DAYS,
  list() { return readAppeals().map(a => ({ ...a })); },
  get(id) { const a = readAppeals().find(x => x.id === id); return a ? { ...a } : null; },
  forBatch(batchId) { return readAppeals().filter(a => a.batchId === batchId).map(a => ({ ...a })); },
  findByLine({ batchId, stmt, code }) { const k = `${batchId}|${stmt}|${code}`; const a = readAppeals().find(x => lineKey(x) === k); return a ? { ...a } : null; },
  // Create from 대조 facts (appealFactsOf) — idempotent per line: an existing appeal for the same line is returned as is.
  create(facts) {
    const list = readAppeals();
    const dup = list.find(x => lineKey(x) === lineKey({ batchId: str(facts.batchId), stmt: str(facts.stmt), code: str(facts.code) }));
    if (dup) return { ...dup, existed: true };
    const a = normAppeal({ ...facts, id: undefined, status: "prep", createdAt: Date.now(), updatedAt: Date.now() });
    list.unshift(a); writeAppeals(list);
    if (a.pid) { try { Patients.ensure(a.pid, { tags: ["이의신청"] }); } catch {} }
    return { ...a };
  },
  update(id, patch) {
    const list = readAppeals();
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return null;
    const merged = { ...list[i], ...(patch || {}), id, createdAt: list[i].createdAt, updatedAt: Date.now() };
    // a changed 통보일 recomputes the deadline unless the user typed one explicitly in the same patch
    if (patch && "noticeDate" in patch && !("dueDate" in patch)) merged.dueDate = "";
    list[i] = normAppeal(merged); writeAppeals(list);
    return { ...list[i] };
  },
  remove(id) { const list = readAppeals(); const a = list.find(x => x.id === id); if (!a) return null; writeAppeals(list.filter(x => x.id !== id)); return { ...a }; },
  isOpen: (a) => a.status !== "result",
  daysLeft: (a) => (a.status === "result" || !a.dueDate) ? null : daysUntil(a.dueDate),
  isOverdue: (a) => { const d = Appeals.daysLeft(a); return d != null && d < 0; },
  onChange(fn) { EventBus.on(`store:${APPEALS_KEY}`, fn); }
};
/* appealDeadlines() → open appeals with a 통보일, soonest first:
     [{ key: "appeal-<id>", label, due, daysLeft, ctx: { appealId }, link: "tab-appeal", payer, status,
        title (= label), date (= due), source }]   — the title/date/link/source aliases match core/calendar.js items so 홈 can
   splice them into its deadline list; 홈 (P3c) consumes this, calendar.js is not extended here. */
export function appealDeadlines() {
  return Appeals.list().filter(a => a.status !== "result" && a.dueDate).map(a => {
    const label = t("appeal.dl.title", { stmt: a.stmt, who: a.pid ? Patients.alias(a.pid) : "—", payer: payerLabel(a.payer) });
    return { key: `appeal-${a.id}`, label, title: label, due: a.dueDate, date: a.dueDate, daysLeft: daysUntil(a.dueDate), link: "tab-appeal", ctx: { appealId: a.id }, payer: a.payer, status: a.status, source: t("appeal.dl.source", { n: APPEAL_WINDOW_DAYS[a.payer] }) };
  }).sort((a, b) => a.daysLeft - b.daysLeft);
}
/* appealStats() → the tracker's global status for 홈's 이의신청 tile / 원장 요약 (rows are not month-scoped):
     open       준비중 (prep) count            submitted  제출 count           overdue  open rows past their 기한
     resolved   결과 (result) count            recovered  Σ resultAmount of resolved rows
     appealed   Σ cutAmount of the open rows (prep + submitted) — what is already under appeal, subtracted from 미수금 */
export function appealStats() {
  const s = { open: 0, overdue: 0, submitted: 0, resolved: 0, recovered: 0, appealed: 0 };
  for (const a of Appeals.list()) {
    if (a.status === "result") { s.resolved++; s.recovered += +a.resultAmount || 0; continue; }
    if (a.status === "submitted") s.submitted++; else s.open++;
    s.appealed += a.cutAmount;
    if (Appeals.isOverdue(a)) s.overdue++;
  }
  return s;
}
/* Appeal-step state for one payer's current batch — used by the landing (claimsSteps) and exposed for 홈:
   { state: "idle" | "todo" | "need" | "done", cuts, appeals, open, overdue, resolved } */
export function appealStateOf(payer) {
  const rec = reconOf(payer);
  if (!rec) return { state: "idle", cuts: 0, appeals: 0, open: 0, overdue: 0, resolved: 0, batchId: null };
  const cuts = rec.res.lines.filter(l => l.hasCut).length;
  const list = Appeals.forBatch(rec.claims.id);
  const open = list.filter(Appeals.isOpen), overdue = open.filter(Appeals.isOverdue), resolved = list.filter(a => a.status === "result");
  const state = !cuts ? "done" : overdue.length ? "need" : !list.length ? "todo" : open.length ? "todo" : "done";
  return { state, cuts, appeals: list.length, open: open.length, overdue: overdue.length, resolved: resolved.length, batchId: rec.claims.id, month: rec.claims.meta?.month || "" };
}
// 건보 대조 history (mirror of jabo.history for the 건보 payer) — read by 홈.
export const nhisHistory = () => (Store.get(NHIS_HISTORY_KEY, []) || []);
export function pushNhisHistory(entry) { const h = nhisHistory(); h.unshift(entry); Store.set(NHIS_HISTORY_KEY, h.slice(0, 100)); }
export const NHIS_HISTORY = NHIS_HISTORY_KEY;
