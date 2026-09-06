/* clinic-admin — 청구 › 건보 심사결과 대조 (#tab-nhis · payer "nhis")
   The 건강보험 twin of 심사결과 대조: the 건보 청구 명세서 export (a `claims` batch with meta.payer "nhis") ⨝ 심평원 심사결과통보
   (its linked `review` batch) → the SAME reconciliation tables (claims-shared.renderReconciliation) with 건보-specific
   조정사유 classes (nhis.reason.* — 일수 초과 · 빈도 초과 · 상병-행위 불일치 · 산정특례/자격 · 본인부담 구분 · 서류 미비;
   descriptive keys, not real 심평원 codes) and NO 보험사 select (건보 has one payer: 공단).
   Domain (confidence): 요양기관 → 심평원 EDI 청구 (월 단위) → 심사결과통보 → 공단 지급 at 인정 amount (high); 이의신청 to 심평원
   within 90 days of the notice — 국민건강보험법 §87 (medium-high, shown as "확인 필요").
   Row hand-offs: 상병 정비 { stmt, batchId } · 검색 { query } · 이의신청 준비 → tab-appeal { create } · ctx { stmt } highlights a 명세서.
   State: nhis.history (mirror of jabo.history — counts + totals + byReason, no pid) for 홈; registered in claims-shared.js. */
import { $, esc, won, todayISO, setStatus, bindDrop } from "../core/ui.js";
import { t, pick, onLangChange } from "../core/i18n.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX } from "../core/files.js";
import { Masters } from "../core/masters.js";
import { activateTab } from "../core/nav.js";
import { Patients } from "../core/entities.js";
import { currentClaimsBatch, reviewFor, ingestClaimsFile, createReviewBatch, stmtCodes, renderBatchStrip, onClaimsChange, ensureNhisSampleBatch, loadNhisSampleRows,
         renderReconciliation, reconExportRows, lineReasonOf, groupCuts, reasonKeysOf, nhisReasonLabel, NHIS_REASON_KEYS, payerLabel, batchPayer, pushNhisHistory, Appeals } from "./claims-shared.js";

let seedFn = null;
export function seed() { return seedFn ? seedFn() : Promise.resolve(); }
export { NHIS_REASON_KEYS };

export function init(ctx) {
  const { DATA } = ctx;
  const host = $('[data-p3-slot="tab-nhis"]');
  if (!host) return;
  Masters.init(DATA);
  const feeByCode = (code) => Masters.fee().rows.find(i => i.code === code);
  const procName = (code, name) => { const d = feeByCode(code); return d ? (pick(d, "name") || name) : name; };
  const ASK_REASONS = new Set(["dx_proc_mismatch", "freq_exceeded", "days_exceeded"]);
  const lineReason = lineReasonOf(nhisReasonLabel);
  const groupByReason = (lines) => groupCuts(lines, lineReason);

  let lastRecon = null, lastPair = null, lastStatus = null, lastClaimsId = null, focusStmt = null;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#nhis-recon-status"), kind, fn()); };
  const askPrefill = (l) => {
    const batch = lastPair?.claims || currentClaimsBatch("nhis");
    return t("nhis.askPrefill", { stmt: l.stmt, who: Patients.alias(l.pid), dx: stmtCodes(batch, l.stmt).join(", ") || "—", code: l.code, name: procName(l.code, l.name) || l.code, reason: lineReason(l) || "—" });
  };
  const renderRecon = () => {
    if (!lastPair) return null;
    lastRecon = renderReconciliation($("#nhis-recon-card"), {
      claims: lastPair.claims, review: lastPair.review, payer: "nhis", insurerSelect: false, procName, reasonLabel: nhisReasonLabel,
      askReasons: ASK_REASONS, askPrefill, focusStmt
    });
    renderNext();
    return lastRecon;
  };
  // Card 02 — what to do with the cuts: counts + one button into 이의신청 filtered to this batch's month.
  const renderNext = () => {
    const el = $("#nhis-next"); if (!el) return;
    if (!lastRecon || !lastPair) { el.innerHTML = `<div class="empty-state small">${esc(t("nhis.nextEmpty"))}</div>`; return; }
    const cuts = lastRecon.lines.filter(l => l.hasCut);
    const appeals = Appeals.forBatch(lastPair.claims.id);
    const open = appeals.filter(Appeals.isOpen).length, overdue = appeals.filter(Appeals.isOverdue).length;
    const cell = (k, v, cls = "") => `<div class="cb-cell"><span class="cb-k">${esc(t(k))}</span><span class="cb-v ${cls}">${v}</span></div>`;
    el.innerHTML = `
      <div class="cb-grid">
        ${cell("nhis.next.cuts", cuts.length, cuts.length ? "accent" : "")}
        ${cell("nhis.next.cutAmt", won(lastRecon.totals.cut))}
        ${cell("nhis.next.appeals", appeals.length)}
        ${cell("nhis.next.open", open)}
        ${cell("nhis.next.overdue", overdue, overdue ? "accent" : "")}
      </div>
      <div class="nhis-next-actions">
        <button type="button" class="btn secondary sm" data-nhis-appeals ${appeals.length || cuts.length ? "" : "disabled"}>${esc(t(appeals.length ? "nhis.next.openAppeals" : "nhis.next.startAppeals"))} <span class="arrow">→</span></button>
        <span class="hint">${esc(t("nhis.next.hint", { n: Appeals.WINDOW_DAYS.nhis }))}</span>
      </div>`;
    el.querySelector("[data-nhis-appeals]")?.addEventListener("click", () => activateTab("tab-appeal", { filter: { payer: "nhis", month: lastPair.claims.meta?.month || "" }, from: { batchId: lastPair.claims.id } }));
  };

  const runRecon = (claims, review, { silent = false, meta = {} } = {}) => {
    if (!claims || !review) return;
    lastPair = { claims, review }; lastClaimsId = claims.id;
    const res = renderRecon();
    renderSlots();
    if (!silent) {
      pushNhisHistory({ at: Date.now(), kind: "recon", payer: "nhis", stmts: res.stmts, itemCount: res.lines.length, date: todayISO(),
        claimed: res.totals.claimed, paid: res.totals.approved, cut: res.totals.cut, batchId: claims.id, month: claims.meta?.month || "", byReason: reasonKeysOf(res.lines) });
      ActivityLog.push("nhis", t("nhis.logRecon", { s: res.stmts, cut: won(res.totals.cut) }), meta);
    }
    const unreviewed = res.lines.filter(l => l.status === "none").length;
    status(unreviewed ? "warn" : null, () =>
      t("jabo.statusRecon", { l: res.lines.length, r: groupByReason(res.lines).length, cut: won(res.totals.cut) }) +
      (unreviewed ? t("jabo.statusUnreviewed", { n: unreviewed }) : "") + t("nhis.statusAppeal", { n: Appeals.WINDOW_DAYS.nhis }));
  };
  const renderSlots = () => {
    const c = currentClaimsBatch("nhis"), r = c ? reviewFor(c.id) : null;
    const el1 = $("#nhis-file-claims"), el2 = $("#nhis-file-review");
    if (el1) el1.innerHTML = c ? `<span class="pill ${c.meta?.sample ? "" : "ok"}">${esc(t(c.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(c.source)} · ${esc(t("common.nRows", { n: c.meta?.itemLines ?? 0 }))}` : "";
    if (el2) el2.innerHTML = r ? `<span class="pill ${r.meta?.sample ? "" : "ok"}">${esc(t(r.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(r.source)} · ${esc(t("common.nRows", { n: r.rows.length }))}` : "";
  };
  const clearRecon = () => {
    lastRecon = null; lastPair = null; lastClaimsId = null;
    $("#nhis-recon-toolbar").style.display = "none"; $("#nhis-recon-groups").innerHTML = "";
    $("#nhis-recon-result").innerHTML = `<div class="empty-state">${esc(t("jabo.reconEmpty"))}</div>`;
    renderSlots(); renderNext();
  };
  const restore = ({ silent = true, meta } = {}) => {
    const c = currentClaimsBatch("nhis");
    if (!c) {
      clearRecon();
      const g = currentClaimsBatch();
      status(null, () => g ? t("nhis.statusOtherPayer", { src: g.source || "—", payer: payerLabel(batchPayer(g)) }) : t("nhis.statusNoBatch"));
      return;
    }
    if (c.meta?.partial === "kcd") { clearRecon(); status("warn", () => t("jabo.noItemSide")); return; }
    const r = reviewFor(c.id);
    if (!r) { clearRecon(); status(null, () => t("jabo.statusNeedReview", { src: c.source || "—", n: c.meta?.stmts ?? c.rows.length })); return; }
    runRecon(c, r, { silent, meta });
  };

  const ingestClaims = async (file) => {
    try {
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const r = await ingestClaimsFile(file, { defaultPayer: "nhis" });
      if (r.empty) { status("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("nhis", t("jabo.logBatch", { src: file.name, n: r.batch.meta.stmts }), { rows: r.batch.rows.length });
      if (batchPayer(r.batch) !== "nhis") { status("warn", () => t("nhis.statusWrongPayer", { payer: payerLabel(batchPayer(r.batch)) })); return; }
      restore({ silent: false, meta: { claims: r.batch.rows.length } });
    } catch (err) { console.error(err); status("err", () => t("common.statusReadFail")); }
  };
  const ingestReview = async (file) => {
    try {
      const c = currentClaimsBatch("nhis");
      if (!c) { status("warn", () => t("jabo.statusNoClaims")); return; }
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const rows = await readSpreadsheet(file);
      if (!rows.length) { status("warn", () => t("common.statusEmptyFile")); return; }
      const rv = createReviewBatch({ rows, source: file.name, claimsBatchId: c.id, origin: "nhis" });
      if (!rv) { status("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("nhis", t("jabo.logReview", { src: file.name, n: rv.rows.length }), { review: rv.rows.length });
      restore({ silent: false, meta: { review: rv.rows.length } });
    } catch (err) { console.error(err); status("err", () => t("common.statusReadFail")); }
  };
  bindDrop("drop-nhis-claims", ingestClaims);
  bindDrop("drop-nhis-review", ingestReview);
  const strip = () => renderBatchStrip($("#nhis-batch-strip"), { onFile: ingestClaims, compact: true, payer: "nhis" });
  strip();

  $('[data-action="sample-nhis-claims"]').addEventListener("click", async (e) => {
    e.stopPropagation();
    const s = await loadNhisSampleRows();
    downloadXLSX(s.claims.rows, t("nhis.sampleClaimsFile"), t("nhis.sampleClaimsSheet"));
  });
  $('[data-action="sample-nhis-review"]').addEventListener("click", async (e) => {
    e.stopPropagation();
    const s = await loadNhisSampleRows();
    downloadXLSX(s.review.rows, t("nhis.sampleReviewFile"), t("nhis.sampleReviewSheet"));
  });
  seedFn = async () => {
    status(null, () => t("jabo.statusLoadingSamples"));
    try {
      const { claims, review } = await ensureNhisSampleBatch();
      runRecon(claims, review, { meta: { sample: true } });
    } catch (err) { console.error(err); status("err", () => t("jabo.statusSampleFail")); }
  };
  $('[data-action="run-nhis"]').addEventListener("click", () => { seedFn(); });

  $("#nhis-recon-download").addEventListener("click", () => {
    if (!lastRecon) return;
    const { rows, R } = reconExportRows(lastRecon, { procName, reasonLabel: nhisReasonLabel });
    rows.push(R({ stmt: "", pid: "", date: "", code: "", name: t("nhis.payerRow"), qty: "", claimed: "", aqty: "", approved: "", delta: "", result: "", reason: "" }));
    downloadXLSX(rows, t("nhis.reconFile", { date: todayISO() }), t("nhis.reconSheet")); // watermark + _PoC applied inside
    ActivityLog.push("nhis", t("nhis.logReconDl", { n: lastRecon.lines.length }), {});
  });

  // Reason glossary (caveat) — the six 건보 classes in the UI language.
  const renderGlossary = () => { const el = $("#nhis-reason-list"); if (el) el.textContent = NHIS_REASON_KEYS.map(k => t("nhis.reason." + k)).join(" · "); };
  renderGlossary();

  /* ── batch changes · ctx · restore ── */
  onClaimsChange((ev) => {
    strip();
    const c = currentClaimsBatch("nhis");
    if (!c) { restore(); return; }
    if (ev?.kind === "review") {
      if (ev.origin === "landing" && ev.claimsBatchId === c.id) restore({ silent: false, meta: { review: true } });
      return;
    }
    if (c.id !== lastClaimsId || ev?.kind === "remove" || ev?.kind === "payer") restore();
  });
  ["store:ui.claimsBatch", "store:ui.claimsBatch.nhis"].forEach(ev => EventBus.on(ev, () => { const c = currentClaimsBatch("nhis"); if ((c && c.id !== lastClaimsId) || (!c && lastClaimsId)) { strip(); restore(); } }));
  Appeals.onChange(() => { if (lastPair) renderRecon(); });
  EventBus.on("tab:activated", (p) => {
    const c = p?.id === "tab-nhis" ? p.ctx : null;
    if (!c) return;
    if (c.stmt) { focusStmt = c.stmt; if (!lastPair) restore(); else renderRecon(); }
  });
  restore();
  EventBus.on("session:unlocked", () => { strip(); if (!lastRecon) restore(); });
  onLangChange(() => {
    strip(); renderGlossary();
    if (lastPair) renderRecon(); else renderNext();
    renderSlots();
    if (lastStatus) setStatus($("#nhis-recon-status"), lastStatus.kind, lastStatus.fn());
  });
}
