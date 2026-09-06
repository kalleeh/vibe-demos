/* clinic-admin — 청구 › 청구 배치 (#tab-claims): the shared claim batch promoted to a landing page.
   · full batch strip (picker · 새 파일) — the strips inside 상병 정비 / 심사결과 대조 collapse to one line pointing here
   · both uploads: 청구 명세서 export → new `claims` batch (claims-shared.createClaimsBatch); 심평원 심사결과 → `review`
     batch linked to the current one (origin "landing" so tab2-jabo re-derives its reconciliation)
   · a 3-step progress for the CURRENT batch — 상병 정비 → 심사결과 대조 → 이의신청 — each step's state derived from
     kcd.lastSummary / the review batch / jabo.history, with one button into the step.
   claimsSteps() is exported for 홈's todo list (tab0-today.js) so both read the same derivation.
   PHASE 3 SLOT: 이의신청 is the third step (state "soon" today) — give it a panel (tab-appeal, area "claims", order 3),
   flip STEP_APPEAL to link there and derive its state from the appeal tracker. */
import { $, esc, setStatus, bindDrop, won, relTime } from "../core/ui.js";
import { t, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Batches } from "../core/entities.js";
import { currentClaimsBatch, reviewFor, ingestClaimsFile, createReviewBatch, renderBatchStrip, onClaimsChange } from "./claims-shared.js";

export function seed() { /* the claims tools seed the shared batch themselves; the landing only reads it */ }

/* claimsSteps() → [{ key, state: "idle"|"todo"|"need"|"done"|"soon", title, detail, link, ctx, btn }] for the current batch. */
export function claimsSteps() {
  const cur = currentClaimsBatch();
  const kcdS = Store.get("kcd.lastSummary");
  const kcdDone = !!(cur && kcdS && kcdS.batchId === cur.id);
  const review = cur ? reviewFor(cur.id) : null;
  const recon = cur ? (Store.get("jabo.history", []) || []).find(h => h && h.kind === "recon" && h.batchId === cur.id) : null;
  const rate = recon && recon.claimed ? Math.round((recon.cut / recon.claimed) * 1000) / 10 : 0;
  const kcd = {
    key: "kcd", title: t("claims.step.kcd"), link: "tab-kcd", ctx: null,
    state: !cur ? "idle" : cur.meta?.partial === "items" ? "idle" : kcdDone ? "done" : "todo",
    detail: !cur ? t("claims.step.noBatch") : cur.meta?.partial === "items" ? t("claims.step.kcdNoSide") : kcdDone ? t("claims.step.kcdDone", { n: kcdS.total, m: kcdS.missing, r: kcdS.review }) : t("claims.step.kcdTodo", { n: cur.meta?.kcdLines ?? 0 }),
    btn: kcdDone ? t("claims.step.kcdOpen") : t("claims.step.kcdBtn")
  };
  const reconStep = {
    key: "recon", title: t("claims.step.recon"),
    state: !cur ? "idle" : cur.meta?.partial === "kcd" ? "idle" : recon ? "done" : review ? "todo" : "need",
    link: !cur || review ? "tab-jabo" : "tab-claims", ctx: !cur || review ? null : { focus: "review" },
    detail: !cur ? t("claims.step.noBatch") : cur.meta?.partial === "kcd" ? t("claims.step.reconNoSide") : recon ? t("claims.step.reconDone", { cut: won(recon.cut || 0), rate }) : review ? t("claims.step.reconTodo", { n: review.rows.length }) : t("claims.step.reconNeed"),
    btn: !cur ? t("claims.step.reconOpen") : recon ? t("claims.step.reconOpen") : review ? t("claims.step.reconBtn") : t("claims.step.reconUpload")
  };
  const appeal = { key: "appeal", title: t("claims.step.appeal"), state: "soon", link: null, ctx: null, detail: t("claims.step.appealSoon"), btn: t("claims.step.appealBtn") };
  return [kcd, reconStep, appeal];
}

export function init() {
  let lastStatus = null;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#claims-status"), kind, fn()); };

  const renderCard = () => {
    const el = $("#claims-batch-card"); if (!el) return;
    const cur = currentClaimsBatch();
    if (!cur) { el.innerHTML = `<div class="empty-state small">${esc(t("claims.card.empty"))}</div>`; return; }
    const review = reviewFor(cur.id);
    const m = cur.meta || {};
    const cell = (k, v) => `<div class="cb-cell"><span class="cb-k">${esc(t(k))}</span><span class="cb-v">${v}</span></div>`;
    el.innerHTML = `
      <div class="cb-head"><strong>${esc(cur.source || "—")}</strong>${m.month ? ` <span class="code">${esc(m.month)}</span>` : ""}${m.sample ? ` <span class="pill">${esc(t("jabo.batch.sample"))}</span>` : ""}${review ? ` <span class="pill ok">${esc(t("jabo.batch.reviewLinked"))}</span>` : ` <span class="pill warn">${esc(t("claims.card.noReview"))}</span>`}</div>
      <div class="cb-grid">
        ${cell("claims.card.stmts", esc(String(m.stmts ?? cur.rows.length)))}
        ${cell("claims.card.patients", esc(String(m.patients ?? 0)))}
        ${cell("claims.card.kcdLines", esc(String(m.kcdLines ?? 0)))}
        ${cell("claims.card.itemLines", esc(String(m.itemLines ?? 0)))}
        ${cell("claims.card.created", esc(m.createdOn || relTime(cur.createdAt)))}
        ${cell("claims.card.batches", esc(String(Batches.list("claims").length)))}
      </div>`;
  };
  const renderSteps = () => {
    const ol = $("#claims-steps"); if (!ol) return;
    const steps = claimsSteps();
    ol.innerHTML = steps.map((s, i) => `
      <li class="claims-step ${s.state}" data-step="${s.key}">
        <span class="cs-n">${s.state === "done" ? "✓" : i + 1}</span>
        <div class="cs-body">
          <div class="cs-title">${esc(s.title)} <span class="cs-state">${esc(t("claims.state." + s.state))}</span></div>
          <div class="cs-detail">${esc(s.detail)}</div>
        </div>
        <button type="button" class="btn secondary sm" data-step-go="${s.key}" ${s.state === "soon" || (s.state === "idle" && s.key !== "kcd") ? "disabled" : ""}>${esc(s.btn)}</button>
      </li>`).join("");
    ol.querySelectorAll("[data-step-go]").forEach(b => b.addEventListener("click", () => {
      const s = steps.find(x => x.key === b.dataset.stepGo); if (!s || !s.link) return;
      if (s.key === "recon" && s.state === "need") { flashReview(); return; }
      activateTab(s.link, s.ctx || undefined);
    }));
  };
  const strip = () => renderBatchStrip($("#claims-batch-strip"), { onFile: ingestClaims });
  const renderSlots = () => {
    const c = currentClaimsBatch(), r = c ? reviewFor(c.id) : null;
    const el1 = $("#claims-file-claims"), el2 = $("#claims-file-review");
    if (el1) el1.innerHTML = c ? `<span class="pill ${c.meta?.sample ? "" : "ok"}">${esc(t(c.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(c.source)} · ${esc(t("jabo.batch.stmts", { n: c.meta?.stmts ?? c.rows.length }))}` : "";
    if (el2) el2.innerHTML = r ? `<span class="pill ${r.meta?.sample ? "" : "ok"}">${esc(t(r.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(r.source)} · ${esc(t("common.nRows", { n: r.rows.length }))}` : "";
  };
  const renderAll = () => { strip(); renderCard(); renderSteps(); renderSlots(); };
  const flashReview = () => {
    const el = $("#drop-claims-review"); if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  };

  async function ingestClaims(file) {
    try {
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const r = await ingestClaimsFile(file);
      if (r.empty) { status("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("jabo", t("jabo.logBatch", { src: file.name, n: r.batch.meta.stmts }), { rows: r.batch.rows.length });
      status(null, () => t("claims.statusClaims", { src: file.name, n: r.batch.meta.stmts }));
    } catch (err) { console.error(err); status("err", () => t("common.statusReadFail")); }
  }
  async function ingestReview(file) {
    try {
      const c = currentClaimsBatch();
      if (!c) { status("warn", () => t("jabo.statusNoClaims")); return; }
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const rows = await readSpreadsheet(file);
      if (!rows.length) { status("warn", () => t("common.statusEmptyFile")); return; }
      const rv = createReviewBatch({ rows, source: file.name, claimsBatchId: c.id, origin: "landing" });
      if (!rv) { status("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("jabo", t("jabo.logReview", { src: file.name, n: rv.rows.length }), { review: rv.rows.length });
      status(null, () => t("claims.statusReview", { src: file.name, n: rv.rows.length }));
    } catch (err) { console.error(err); status("err", () => t("common.statusReadFail")); }
  }
  bindDrop("drop-claims-claims", ingestClaims);
  bindDrop("drop-claims-review", ingestReview);

  renderAll();
  onClaimsChange(renderAll);
  Batches.onChange(renderAll);
  ["store:ui.claimsBatch", "store:kcd.lastSummary", "store:jabo.history", "session:unlocked"].forEach(ev => EventBus.on(ev, renderAll));
  EventBus.on("tab:activated", (p) => {
    if (p?.id !== "tab-claims") return;
    renderAll();
    if (p.ctx?.focus === "review") setTimeout(flashReview, 80);
  });
  onLangChange(() => { renderAll(); if (lastStatus) setStatus($("#claims-status"), lastStatus.kind, lastStatus.fn()); });
}
