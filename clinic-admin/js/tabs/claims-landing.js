/* clinic-admin — 청구 › 청구 배치 (#tab-claims): the shared claim batch promoted to a landing page — now for BOTH payers.
   · full batch strip (picker · 새 파일) — the strips inside 상병 정비 / 심사결과 대조 / 건보 대조 collapse to one line pointing here
   · both uploads: 청구 명세서 export → new `claims` batch (payer from the 보험유형 column; none → the batch-level 보험유형 select
     below the drops asks, and the batch stays 미지정 until answered); 심평원 심사결과 → `review` batch linked to the batch the
     strip points at (origin "landing" so the matching 대조 panel re-derives)
   · two payer cards (자보 · 건보), each with its batch summary and the 3-step progress — 상병 정비 → 심사결과 대조 → 이의신청 —
     derived from kcd.lastSummary / the review batch + recon history / appeals.list. The 대조 step links to tab-jabo or tab-nhis
     by payer; the 이의신청 step to tab-appeal (todo when cuts exist without appeals, need when one is overdue, done when all resolved).
   claimsSteps(payer?) is exported for 홈's todo list (tab0-today.js / P3c) so both read the same derivation:
     claimsSteps("auto" | "nhis") → the 3 steps of that payer's current batch
     claimsSteps()                → flat array over the payers that have a batch (자보 first), every step carrying `payer` + `batchId`
                                    (falls back to the idle 자보 steps when there is no batch at all)
     claimsStepsByPayer()         → { auto: [...], nhis: [...] } */
import { $, esc, setStatus, bindDrop, won, relTime } from "../core/ui.js";
import { t, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Batches } from "../core/entities.js";
import { currentClaimsBatch, reviewFor, ingestClaimsFile, createReviewBatch, renderBatchStrip, onClaimsChange, reconOf, appealStateOf, setBatchPayer, batchPayer, payerLabel, reconTabOf, PAYERS, Appeals, nhisHistory } from "./claims-shared.js";

export function seed() { /* the claims tools seed the shared batches themselves; the landing only reads them */ }

const reconHistoryOf = (payer, batchId) => (payer === "nhis" ? nhisHistory() : (Store.get("jabo.history", []) || [])).find(h => h && h.kind === "recon" && h.batchId === batchId) || null;

/* claimsSteps(payer) → [{ key, payer, batchId, state: "idle"|"todo"|"need"|"done", title, detail, link, ctx, btn }] */
export function claimsSteps(payer) {
  if (!payer) {
    const withBatch = PAYERS.filter(p => currentClaimsBatch(p));
    return (withBatch.length ? withBatch : ["auto"]).flatMap(p => claimsSteps(p));
  }
  const cur = currentClaimsBatch(payer);
  const batchId = cur?.id || null;
  const kcdS = Store.get("kcd.lastSummary");
  const kcdDone = !!(cur && kcdS && kcdS.batchId === cur.id);
  const review = cur ? reviewFor(cur.id) : null;
  const recon = cur ? reconHistoryOf(payer, cur.id) : null;
  const rate = recon && recon.claimed ? Math.round((recon.cut / recon.claimed) * 1000) / 10 : 0;
  const reconTab = reconTabOf(payer);
  const kcd = {
    key: "kcd", payer, batchId, title: t("claims.step.kcd"), link: "tab-kcd", ctx: cur ? { batchId: cur.id } : null,
    state: !cur ? "idle" : cur.meta?.partial === "items" ? "idle" : kcdDone ? "done" : "todo",
    detail: !cur ? t("claims.step.noBatch") : cur.meta?.partial === "items" ? t("claims.step.kcdNoSide") : kcdDone ? t("claims.step.kcdDone", { n: kcdS.total, m: kcdS.missing, r: kcdS.review }) : t("claims.step.kcdTodo", { n: cur.meta?.kcdLines ?? 0 }),
    btn: kcdDone ? t("claims.step.kcdOpen") : t("claims.step.kcdBtn")
  };
  const reconStep = {
    key: "recon", payer, batchId, title: t(payer === "nhis" ? "claims.step.reconNhis" : "claims.step.recon"),
    state: !cur ? "idle" : cur.meta?.partial === "kcd" ? "idle" : recon ? "done" : review ? "todo" : "need",
    link: !cur || review ? reconTab : "tab-claims", ctx: !cur || review ? null : { focus: "review", payer },
    detail: !cur ? t("claims.step.noBatch") : cur.meta?.partial === "kcd" ? t("claims.step.reconNoSide") : recon ? t("claims.step.reconDone", { cut: won(recon.cut || 0), rate }) : review ? t("claims.step.reconTodo", { n: review.rows.length }) : t("claims.step.reconNeed"),
    btn: !cur ? t("claims.step.reconOpen") : recon ? t("claims.step.reconOpen") : review ? t("claims.step.reconBtn") : t("claims.step.reconUpload")
  };
  const ap = appealStateOf(payer);
  const appeal = {
    key: "appeal", payer, batchId, title: t("claims.step.appeal"), link: "tab-appeal",
    ctx: cur ? { filter: { payer, month: cur.meta?.month || "" }, from: { batchId: cur.id } } : null,
    state: ap.state,
    detail: ap.state === "idle" ? (cur ? t("claims.step.appealIdle") : t("claims.step.noBatch"))
          : ap.cuts === 0 ? t("claims.step.appealNoCuts")
          : ap.state === "need" ? t("claims.step.appealOverdue", { n: ap.overdue, open: ap.open })
          : ap.state === "todo" && !ap.appeals ? t("claims.step.appealTodo", { n: ap.cuts })
          : ap.state === "todo" ? t("claims.step.appealOpen", { open: ap.open, n: ap.appeals, cuts: ap.cuts })
          : t("claims.step.appealDone", { n: ap.resolved }),
    btn: ap.state === "todo" && !ap.appeals ? t("claims.step.appealStart") : t("claims.step.appealOpenBtn")
  };
  return [kcd, reconStep, appeal];
}
export const claimsStepsByPayer = () => Object.fromEntries(PAYERS.map(p => [p, claimsSteps(p)]));

export function init() {
  let lastStatus = null;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#claims-status"), kind, fn()); };
  const cardHost = (p) => $(p === "nhis" ? "#claims-batch-card-nhis" : "#claims-batch-card");
  const stepsHost = (p) => $(p === "nhis" ? "#claims-steps-nhis" : "#claims-steps");

  const renderCard = (p) => {
    const el = cardHost(p); if (!el) return;
    const cur = currentClaimsBatch(p);
    if (!cur) { el.innerHTML = `<div class="empty-state small">${esc(t(p === "nhis" ? "claims.card.emptyNhis" : "claims.card.emptyAuto"))}</div>`; return; }
    const review = reviewFor(cur.id);
    const m = cur.meta || {};
    const cell = (k, v) => `<div class="cb-cell"><span class="cb-k">${esc(t(k))}</span><span class="cb-v">${v}</span></div>`;
    const rec = reconOf(p);
    el.innerHTML = `
      <div class="cb-head"><strong>${esc(cur.source || "—")}</strong>${m.month ? ` <span class="code">${esc(m.month)}</span>` : ""}${m.sample ? ` <span class="pill">${esc(t("jabo.batch.sample"))}</span>` : ""}${review ? ` <span class="pill ok">${esc(t("jabo.batch.reviewLinked"))}</span>` : ` <span class="pill warn">${esc(t("claims.card.noReview"))}</span>`}</div>
      <div class="cb-grid">
        ${cell("claims.card.stmts", esc(String(m.stmts ?? cur.rows.length)))}
        ${cell("claims.card.patients", esc(String(m.patients ?? 0)))}
        ${cell("claims.card.kcdLines", esc(String(m.kcdLines ?? 0)))}
        ${cell("claims.card.itemLines", esc(String(m.itemLines ?? 0)))}
        ${rec ? cell("claims.card.cut", `<span class="accent">${esc(won(rec.res.totals.cut))}</span>`) : cell("claims.card.created", esc(m.createdOn || relTime(cur.createdAt)))}
        ${cell("claims.card.appeals", esc(String(Appeals.forBatch(cur.id).length)))}
      </div>`;
  };
  const renderSteps = (p) => {
    const ol = stepsHost(p); if (!ol) return;
    const steps = claimsSteps(p);
    ol.innerHTML = steps.map((s, i) => `
      <li class="claims-step ${s.state}" data-step="${s.key}" data-payer="${p}">
        <span class="cs-n">${s.state === "done" ? "✓" : i + 1}</span>
        <div class="cs-body">
          <div class="cs-title">${esc(s.title)} <span class="cs-state">${esc(t(s.key === "appeal" && s.state === "need" ? "claims.state.appealNeed" : "claims.state." + s.state))}</span></div>
          <div class="cs-detail">${esc(s.detail)}</div>
        </div>
        <button type="button" class="btn secondary sm" data-step-go="${s.key}" ${s.state === "idle" && s.key !== "kcd" ? "disabled" : ""}>${esc(s.btn)}</button>
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
    if (el1) el1.innerHTML = c ? `<span class="pill ${c.meta?.sample ? "" : "ok"}">${esc(t(c.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(c.source)} · ${esc(t("jabo.batch.stmts", { n: c.meta?.stmts ?? c.rows.length }))} · ${esc(payerLabel(batchPayer(c)))}` : "";
    if (el2) el2.innerHTML = r ? `<span class="pill ${r.meta?.sample ? "" : "ok"}">${esc(t(r.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(r.source)} · ${esc(t("common.nRows", { n: r.rows.length }))}` : "";
  };
  // 미지정 payer → ask (batch-level select). Hidden when the strip's batch already has a payer.
  const renderPayerAsk = () => {
    const el = $("#claims-payer-ask"); if (!el) return;
    const c = currentClaimsBatch();
    if (!c || batchPayer(c)) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = `
      <span class="pill warn">${esc(t("claims.payer.none"))}</span>
      <label for="claims-payer-select">${esc(t("claims.payer.ask", { src: c.source || "—" }))}</label>
      <select id="claims-payer-select">
        <option value="">${esc(t("common.selectPlaceholder"))}</option>
        ${PAYERS.map(p => `<option value="${p}">${esc(payerLabel(p))}</option>`).join("")}
      </select>
      <button type="button" class="btn secondary sm" id="claims-payer-apply" disabled>${esc(t("claims.payer.apply"))}</button>
      <span class="hint">${esc(t("claims.payer.askHint"))}</span>`;
    const sel = el.querySelector("#claims-payer-select"), btn = el.querySelector("#claims-payer-apply");
    sel.addEventListener("change", () => { btn.disabled = !sel.value; });
    btn.addEventListener("click", () => {
      if (!sel.value) return;
      setBatchPayer(c.id, sel.value);
      ActivityLog.push("jabo", t("claims.logPayer", { src: c.source || "—", payer: payerLabel(sel.value) }), {});
      status(null, () => t("claims.statusPayer", { src: c.source || "—", payer: payerLabel(sel.value) }));
    });
  };
  const renderAll = () => { strip(); for (const p of PAYERS) { renderCard(p); renderSteps(p); } renderSlots(); renderPayerAsk(); };
  const flashReview = () => {
    const el = $("#drop-claims-review"); if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  };

  async function ingestClaims(file) {
    try {
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const r = await ingestClaimsFile(file); // payer from the 보험유형 column, else 미지정 → the select below asks
      if (r.empty) { status("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("jabo", t("jabo.logBatch", { src: file.name, n: r.batch.meta.stmts }), { rows: r.batch.rows.length });
      const p = batchPayer(r.batch);
      status(p ? null : "warn", () => p ? t("claims.statusClaimsPayer", { src: file.name, n: r.batch.meta.stmts, payer: payerLabel(p) }) : t("claims.statusClaimsNoPayer", { src: file.name, n: r.batch.meta.stmts }));
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
  Appeals.onChange(renderAll);
  ["store:ui.claimsBatch", "store:ui.claimsBatch.auto", "store:ui.claimsBatch.nhis", "store:kcd.lastSummary", "store:jabo.history", "store:nhis.history", "session:unlocked"].forEach(ev => EventBus.on(ev, renderAll));
  EventBus.on("tab:activated", (p) => {
    if (p?.id !== "tab-claims") return;
    renderAll();
    if (p.ctx?.focus === "review") setTimeout(flashReview, 80);
  });
  onLangChange(() => { renderAll(); if (lastStatus) setStatus($("#claims-status"), lastStatus.kind, lastStatus.fn()); });
}
