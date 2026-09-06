/* clinic-admin — 청구 › 심사결과 대조 (자보 payer)
   Primary path: file-based reconciliation — the 자보 청구 명세서 export (a `claims` batch with meta.payer "auto", shared with
   상병 정비 — see tabs/claims-shared.js) ⨝ 심평원 심사결과통보 (a `review` batch linked by meta.claimsBatchId), joined on
   명세서번호 + 행위코드 → per-line 청구 vs 인정 delta, grouped by 조정사유 and month. The join + tables are the shared
   renderReconciliation (also used by 건보 대조); a batch-level 보험사 select (default Insurers.lastUsed()) is stored on every
   recon history entry. Rows with a cut carry 이의신청 준비 → tab-appeal { create }; ctx { stmt } from 이의신청 highlights a 명세서.
   Secondary path: manual single-case entry. Receives ctx from 07/06: activateTab("tab-jabo", { dx, items, pid,
   insurer?, claim?, accident? }) → sets the 주상병, adds each 행위, prefills the 환자번호.
   TWO CODE SPACES: `items` are 자보 fee-list codes (Masters.fee / data/jabo.json 예시-NN); `bigeupItems` (from 환자 › 비급여
   동의) are Tariff codes (data/bigeup.json 예시-NN — the same-looking ids name different things). 비급여 codes are added as
   비급여 lines (kind "bigeup") priced from the clinic's Tariff; they never resolve against the fee list.
   Cross-tab actions per reconciliation row: 상병 정비에서 보기 (01, focused on the 명세서) · 행위 검색 (06) ·
   AI에게 묻기 (07, for 상병-처치 부위 불일치 / 동일부위 중복).
   i18n: everything user-visible goes through t()/pick(); the language toggle re-renders from state the tab holds. */
import { $, esc, fmtKRW, won, todayISO, fuzzyMatch, setStatus, debounce, bindDrop, Haptic, Toast, redactSubject } from "../core/ui.js";
import { t, tOr, pick, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog, bindPersist } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, headerRow } from "../core/files.js";
import { Masters, toEdi, toDotted } from "../core/masters.js";
import { activateTab } from "../core/nav.js";
import { Insurers, Patients } from "../core/entities.js";
import { currentClaimsBatch, reviewFor, ingestClaimsFile, createReviewBatch, stmtCodes, renderBatchStrip, onClaimsChange, ensureSampleBatch, loadSampleRows,
         renderReconciliation, reconExportRows, lineReasonOf, groupCuts, reasonKeysOf, payerLabel, batchPayer, Appeals, tariffPrice } from "./claims-shared.js";

let seedFn = null;
export function seed() { return seedFn ? seedFn() : Promise.resolve(); }

export function init(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  const REASONS = DATA.jabo.adjustment_reasons || [];
  const reasonLabel = (key, fallbackKey) => { const r = REASONS.find(x => x.key === key); return r ? pick(r, "label") : (fallbackKey ? t(fallbackKey) : (key ? String(key) : "")); };
  const unitLabel = (u) => tOr("common.unit." + (u || "회"), u || "회");
  const catLabel = (c) => c ? tOr("jabo.cat." + c, c) : "";
  // Insurers (core/entities.js, loaded from data/jabo.json): [{ value, label, label_en, type }].
  const insurerRows = () => Insurers.list();
  const insurerLabel = (v) => { const i = insurerRows().find(x => x.value === v); return i ? pick(i, "label") : (v || "—"); };
  const fillInsurerSelect = (sel, keepPlaceholder) => {
    const cur = sel.value;
    sel.querySelectorAll("option[value]:not([value=''])").forEach(o => o.remove());
    if (!keepPlaceholder) sel.innerHTML = "";
    for (const i of insurerRows()) {
      const opt = document.createElement("option");
      opt.value = i.value; opt.textContent = i.type === "공제조합" ? `${pick(i, "label")} (${t("jabo.mutual")})` : pick(i, "label");
      sel.appendChild(opt);
    }
    sel.value = cur;
  };

  /* ───────────── Primary: file-based reconciliation (자보 payer) ─────────────
     The join + tables live in claims-shared.js (renderReconciliation) and are shared with 건보 대조; this panel owns the
     보험사 select, the recon history entry (홈 KPIs), the status line and the XLSX footer rows. */
  let lastRecon = null, lastPair = null, lastReconStatus = null, lastClaimsId = null, focusStmt = null;
  const reconStatus = (kind, fn) => { lastReconStatus = { kind, fn }; setStatus($("#jabo-recon-status"), kind, fn()); };
  const ASK_REASONS = new Set(["site_mismatch", "dup_same_site"]);
  const knownReason = (key) => { const r = REASONS.find(x => x.key === key); return r ? pick(r, "label") : null; };
  const lineReason = lineReasonOf(knownReason);
  const groupByReason = (lines) => groupCuts(lines, lineReason);
  const askPrefill = (l) => {
    const batch = lastPair?.claims || currentClaimsBatch("auto");
    const dx = stmtCodes(batch, l.stmt).join(", ") || "—";
    return t("jabo.askPrefill", { stmt: l.stmt, who: Patients.alias(l.pid), dx, code: l.code, name: procName(l.code, l.name) || l.code, reason: lineReason(l) || "—" });
  };
  const reconHost = () => $("#jabo-recon-card");
  const renderRecon = () => {
    if (!lastPair) return null;
    const res = renderReconciliation(reconHost(), {
      claims: lastPair.claims, review: lastPair.review, payer: "auto", insurerSelect: true, procName, reasonLabel: knownReason,
      askReasons: ASK_REASONS, askPrefill, insurer: () => reconInsurer.value || Insurers.lastUsed() || "", focusStmt
    });
    lastRecon = res;
    return res;
  };

  // Batch-level 보험사 — default Insurers.lastUsed(); every recon history entry carries it.
  const reconInsurer = $("#jabo-recon-insurer");
  fillInsurerSelect(reconInsurer, true);
  if (!reconInsurer.value) reconInsurer.value = Insurers.lastUsed() || "";
  reconInsurer.addEventListener("change", () => {
    Insurers.setLastUsed(reconInsurer.value);
    if (!lastClaimsId) return;
    const history = Store.get("jabo.history", []) || [];
    const i = history.findIndex(h => h.kind === "recon" && h.batchId === lastClaimsId);
    if (i >= 0) { history[i] = { ...history[i], insurer: reconInsurer.value }; Store.set("jabo.history", history); }
  });

  const runRecon = (claims, review, { silent = false, meta = {} } = {}) => {
    if (!claims || !review) return;
    lastPair = { claims, review }; lastClaimsId = claims.id;
    const res = renderRecon();
    renderSlots();
    const insurer = reconInsurer.value || Insurers.lastUsed() || "";
    if (!silent) {
      if (insurer) Insurers.setLastUsed(insurer);
      // History: 명세서 count + totals + insurer + batch id + cuts by reason key (홈's KPI tiles) — no names, no claim numbers.
      const history = Store.get("jabo.history", []) || [];
      history.unshift({ at: Date.now(), kind: "recon", stmts: res.stmts, itemCount: res.lines.length, date: todayISO(),
        claimed: res.totals.claimed, paid: res.totals.approved, cut: res.totals.cut, insurer, batchId: claims.id, month: claims.meta?.month || "", byReason: reasonKeysOf(res.lines) });
      Store.set("jabo.history", history.slice(0, 100));
      ActivityLog.push("jabo", t("jabo.logRecon", { s: res.stmts, cut: won(res.totals.cut) }), meta);
    }
    const unreviewed = res.lines.filter(l => l.status === "none").length;
    reconStatus(unreviewed ? "warn" : null, () =>
      t("jabo.statusRecon", { l: res.lines.length, r: groupByReason(res.lines).length, cut: won(res.totals.cut) }) +
      (unreviewed ? t("jabo.statusUnreviewed", { n: unreviewed }) : "") + t("jabo.statusAppeal"));
  };

  // File slots under the two drops: the 자보 claims batch + its linked review batch.
  const renderSlots = () => {
    const c = currentClaimsBatch("auto"), r = c ? reviewFor(c.id) : null;
    const el1 = $("#jabo-file-claims"), el2 = $("#jabo-file-review");
    if (el1) el1.innerHTML = c ? `<span class="pill ${c.meta?.sample ? "" : "ok"}">${esc(t(c.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(c.source)} · ${esc(t("common.nRows", { n: c.meta?.itemLines ?? 0 }))}` : "";
    if (el2) el2.innerHTML = r ? `<span class="pill ${r.meta?.sample ? "" : "ok"}">${esc(t(r.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(r.source)} · ${esc(t("common.nRows", { n: r.rows.length }))}` : "";
  };
  const clearRecon = () => {
    lastRecon = null; lastPair = null; lastClaimsId = null;
    $("#jabo-recon-toolbar").style.display = "none"; $("#jabo-recon-groups").innerHTML = "";
    $("#jabo-recon-result").innerHTML = `<div class="empty-state">${esc(t("jabo.reconEmpty"))}</div>`;
    renderSlots();
  };
  // Re-derive the reconciliation from the 자보 batch pair (boot, batch switch, review upload). A global current batch of
  // another payer (건보 · 미지정) is named in the status line with a pointer to its own panel / the landing.
  const restore = ({ silent = true, meta } = {}) => {
    const c = currentClaimsBatch("auto");
    if (!c) {
      clearRecon();
      const g = currentClaimsBatch();
      if (g) reconStatus(null, () => t("jabo.statusOtherPayer", { src: g.source || "—", payer: payerLabel(batchPayer(g)) }));
      return;
    }
    if (c.meta?.partial === "kcd") { clearRecon(); reconStatus("warn", () => t("jabo.noItemSide")); return; }
    const r = reviewFor(c.id);
    if (!r) { clearRecon(); reconStatus(null, () => t("jabo.statusNeedReview", { src: c.source || "—", n: c.meta?.stmts ?? c.rows.length })); return; }
    runRecon(c, r, { silent, meta });
  };

  const ingestClaims = async (file) => {
    try {
      reconStatus(null, () => t("common.statusReading", { name: esc(file.name) }));
      const r = await ingestClaimsFile(file, { defaultPayer: "auto" });
      if (r.empty) { reconStatus("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("jabo", t("jabo.logBatch", { src: file.name, n: r.batch.meta.stmts }), { rows: r.batch.rows.length });
      restore({ silent: false, meta: { claims: r.batch.rows.length } });
    } catch (err) { console.error(err); reconStatus("err", () => t("common.statusReadFail")); }
  };
  const ingestReview = async (file) => {
    try {
      const c = currentClaimsBatch("auto");
      if (!c) { reconStatus("warn", () => t("jabo.statusNoClaims")); return; }
      reconStatus(null, () => t("common.statusReading", { name: esc(file.name) }));
      const rows = await readSpreadsheet(file);
      if (!rows.length) { reconStatus("warn", () => t("common.statusEmptyFile")); return; }
      const rv = createReviewBatch({ rows, source: file.name, claimsBatchId: c.id, origin: "jabo" });
      if (!rv) { reconStatus("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("jabo", t("jabo.logReview", { src: file.name, n: rv.rows.length }), { review: rv.rows.length });
      restore({ silent: false, meta: { review: rv.rows.length } });
    } catch (err) { console.error(err); reconStatus("err", () => t("common.statusReadFail")); }
  };
  bindDrop("drop-jabo-claims", ingestClaims);
  bindDrop("drop-jabo-review", ingestReview);
  const strip = () => renderBatchStrip($("#jabo-batch-strip"), { onFile: ingestClaims, compact: true, payer: "auto" }); // one line → 청구 › 청구 배치
  strip();

  $('[data-action="sample-jabo-claims"]').addEventListener("click", async (e) => {
    e.stopPropagation();
    const s = await loadSampleRows();
    downloadXLSX(s.claims.rows, t("jabo.sampleClaimsFile"), t("jabo.sampleClaimsSheet"));
  });
  $('[data-action="sample-jabo-review"]').addEventListener("click", async (e) => {
    e.stopPropagation();
    const s = await loadSampleRows();
    downloadXLSX(s.review.rows, t("jabo.sampleReviewFile"), t("jabo.sampleReviewSheet"));
  });
  seedFn = async () => {
    reconStatus(null, () => t("jabo.statusLoadingSamples"));
    try {
      const { claims, review } = await ensureSampleBatch();
      if (!reconInsurer.value) reconInsurer.value = Insurers.lastUsed() || "삼성";
      runRecon(claims, review, { meta: { sample: true } });
    } catch (err) { console.error(err); reconStatus("err", () => t("jabo.statusSampleFail")); }
  };
  $('[data-action="run-jabo"]').addEventListener("click", () => { seedFn(); });

  $("#jabo-recon-download").addEventListener("click", () => {
    if (!lastRecon) return;
    const { rows, R } = reconExportRows(lastRecon, { procName, reasonLabel: knownReason });
    rows.push(R({ stmt: "", pid: "", date: "", code: "", name: t("jabo.insurerRow", { ins: insurerLabel(reconInsurer.value) }), qty: "", claimed: "", aqty: "", approved: "", delta: "", result: "", reason: "" }));
    downloadXLSX(rows, t("jabo.reconFile", { date: todayISO() }), t("jabo.reconSheet")); // watermark + _PoC applied inside
    ActivityLog.push("jabo", t("jabo.logReconDl", { n: lastRecon.lines.length }), {});
  });

  /* ───────────── Secondary: manual single-case entry ───────────── */
  const items = []; // {code, name, qty, unit, price, category, paid, cutKey, kind?} — kind "bigeup" = a 비급여 line (Tariff code space)
  const dxSel = $("#jabo-dx");
  const insSel = $("#jabo-insurer");
  const feeRows = () => Masters.fee().rows;
  const feeByCode = (code) => feeRows().find(i => i.code === code);
  // Procedure name for display: the fee table's localised name when the code is known, else the stored/file name.
  const procName = (code, name) => { const d = feeByCode(code); return d ? (pick(d, "name") || name) : name; };
  // Line name: a 비급여 line keeps its Tariff name (its code would collide with the fee list's 예시-NN); fee lines resolve as usual.
  const bigeupDef = (code) => (DATA.bigeup?.items || []).find(i => i.code === code) || null;
  const lineName = (it) => it.kind === "bigeup" ? (bigeupDef(it.code) ? pick(bigeupDef(it.code), "name") : it.name) : procName(it.code, it.name);
  let extraDx = null; // a 주상병 handed over by 07/06 that is not in the example list: { code(EDI), name }
  const buildSelects = () => {
    const dxCur = dxSel.value;
    dxSel.innerHTML = "";
    const list = [...DATA.jabo.diagnosis_examples];
    if (extraDx && !list.some(d => d.code === extraDx.code)) list.unshift(extraDx);
    list.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.code; opt.textContent = `${d.code} · ${pick(d, "name")}`;
      dxSel.appendChild(opt);
    });
    if (dxCur) dxSel.value = dxCur;
    fillInsurerSelect(insSel, true);
  };
  buildSelects();
  const setDx = (edi) => {
    const code = toEdi(edi);
    if (!code) return;
    if (!DATA.jabo.diagnosis_examples.some(d => d.code === code)) {
      const m = Masters.kcdIndex().get(code);
      extraDx = { code, name: m?.name || toDotted(code), name_en: m?.name_en || "" };
    }
    buildSelects();
    dxSel.value = code;
    dxSel.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const renderFeeBadge = () => {
    const f = Masters.fee();
    const el = $("#jabo-fee-badge");
    if (!el) return;
    el.innerHTML = `<button type="button" class="src-pill clickable ${f.source === "master" ? "master" : "demo"}" data-masters title="${esc(t("search.gotoMastersTitle"))}">${esc(f.label)}</button>` +
      (f.source === "bundled" ? ` <span class="basis">${esc(pick(DATA.jabo, "table_label") || "")}</span>` : "");
    el.querySelector("[data-masters]").addEventListener("click", () => activateTab("tab-search", { section: "masters" }));
  };
  renderFeeBadge();
  Masters.onChange(renderFeeBadge);

  const searchEl = $("#jabo-search");
  const resultsEl = $("#jabo-search-results");
  const renderSearch = (query) => {
    if (!query.trim()) { resultsEl.classList.remove("show"); resultsEl.innerHTML = ""; return; }
    const matches = feeRows().filter(i =>
      fuzzyMatch(i.name || "", query) || fuzzyMatch(i.name_en || "", query) || String(i.code).includes(query) || fuzzyMatch(i.category || "", query)
    ).slice(0, 12);
    if (!matches.length) {
      resultsEl.innerHTML = `<div class="search-opt"><span></span><span style="color: var(--muted); font-style: italic;">${esc(t("jabo.noMatch"))}</span><span></span></div>`;
      resultsEl.classList.add("show");
      return;
    }
    resultsEl.innerHTML = matches.map(m => `
      <div class="search-opt" data-code="${esc(m.code)}">
        <span class="code-tag">${esc(m.code)}</span>
        <span><span style="color: var(--ink-2)">${esc(pick(m, "name"))}</span> <span style="color: var(--faint); font-size: 11px; margin-left: 6px;">${esc(catLabel(m.category))}</span></span>
        <span class="price-mini">${m.price == null ? esc(t("jabo.noPrice")) : fmtKRW(m.price) + " / " + esc(unitLabel(m.unit))}</span>
      </div>`).join("");
    resultsEl.classList.add("show");
    resultsEl.querySelectorAll(".search-opt").forEach(opt => opt.addEventListener("click", () => addItem(opt.dataset.code)));
  };

  const addItem = (code, { render = true } = {}) => {
    const def = feeByCode(code);
    if (!def) return false;
    const existing = items.find(x => x.code === code && x.kind !== "bigeup");
    if (existing) existing.qty++;
    else items.push({ code: def.code, name: def.name, unit: def.unit || "회", price: def.price ?? 0, category: def.category || "", qty: 1, paid: def.price ?? 0, cutKey: "" });
    searchEl.value = "";
    resultsEl.classList.remove("show");
    if (render) renderItems();
    return true;
  };
  // 비급여 line from the Tariff code space (환자 › 비급여 동의 hand-off): name from data/bigeup.json, price = the clinic's own 단가
  // (중간값, else the min/max midpoint). No Tariff price → not added (the caller reports the code as skipped).
  const addBigeupItem = (code, { qty = 1 } = {}) => {
    const def = bigeupDef(code), price = tariffPrice(code);
    if (!def || !price) return false;
    const existing = items.find(x => x.code === code && x.kind === "bigeup");
    if (existing) existing.qty += qty;
    else items.push({ code, name: def.name, unit: def.unit || "회", price, category: "비급여", qty, paid: price, cutKey: "", kind: "bigeup" });
    return true;
  };

  const lineOf = (it) => {
    const claimed = it.price * it.qty;
    const paid = (typeof it.paid === "number" ? it.paid : it.price) * it.qty;
    return { claimed, paid, cut: claimed - paid };
  };
  const reasonOpts = (sel) => [`<option value="">${esc(t("jabo.noAdj"))}</option>`, ...REASONS.map(r => `<option value="${r.key}"${r.key === sel ? " selected" : ""}>${esc(pick(r, "label"))}</option>`)].join("");

  const rowHTML = (it, i) => {
    const { claimed, cut } = lineOf(it);
    return `
      <div class="item-row recon${it.kind === "bigeup" ? " bigeup" : ""}" data-i="${i}">
        <span class="code-tag">${esc(it.code)}</span>
        <span class="name">${esc(lineName(it))} <span style="color: var(--faint); font-size: 11px; margin-left: 4px;">${esc(catLabel(it.category))}</span></span>
        <input type="number" class="qty" min="1" max="999" value="${it.qty}" data-i="${i}" aria-label="${esc(t("jabo.qtyAria"))}" title="${esc(t("jabo.qtyAria"))}">
        <span class="price-display claimed">${esc(t("jabo.claimedLabel", { amt: fmtKRW(claimed) }))}</span>
        <input type="number" class="paid-unit" min="0" value="${it.paid}" data-i="${i}" aria-label="${esc(t("jabo.paidAria"))}" title="${esc(t("jabo.paidTitle"))}" placeholder="${it.price}">
        <span class="price-display cut ${cut > 0 ? "warn" : "ok"}">${cut > 0 ? "−" + fmtKRW(cut) : "0"}</span>
        <select class="cut-reason" data-i="${i}" title="${esc(t("jabo.reasonTitle"))}">${reasonOpts(it.cutKey)}</select>
        <button class="remove-btn" data-i="${i}" aria-label="${esc(t("common.delete"))}">×</button>
      </div>`;
  };

  // In-place update — never rebuilds the row while the admin is typing in it.
  const refreshRow = (i) => {
    const row = $(`#jabo-items .item-row[data-i="${i}"]`);
    if (!row) return;
    const { claimed, cut } = lineOf(items[i]);
    row.querySelector(".claimed").textContent = t("jabo.claimedLabel", { amt: fmtKRW(claimed) });
    const cutEl = row.querySelector(".cut");
    cutEl.textContent = cut > 0 ? "−" + fmtKRW(cut) : "0";
    cutEl.classList.toggle("warn", cut > 0); cutEl.classList.toggle("ok", cut <= 0);
  };

  const refreshTotals = () => {
    const totals = items.reduce((acc, it) => { const l = lineOf(it); acc.claimed += l.claimed; acc.paid += l.paid; return acc; }, { claimed: 0, paid: 0 });
    const cutTotal = totals.claimed - totals.paid;
    const cutPct = totals.claimed > 0 ? Math.round((cutTotal / totals.claimed) * 1000) / 10 : 0;
    $("#jabo-total-num").textContent = fmtKRW(totals.claimed);
    $("#jabo-paid-num").textContent = fmtKRW(totals.paid);
    $("#jabo-cut-num").textContent = fmtKRW(cutTotal);
    $("#jabo-summary").innerHTML = t("jabo.manualSummary", { n: items.length, c: won(totals.claimed), a: won(totals.paid), r: cutPct });
    $("#jabo-download").disabled = items.length === 0;
    if (!items.length) {
      $("#jabo-preview").innerHTML = `<div class="empty-state">${esc(t("jabo.manualEmpty"))}</div>`;
    } else {
      $("#jabo-preview").innerHTML = `
        <table>
          <thead><tr>
            <th class="code">${esc(t("jabo.thCodeShort"))}</th><th>${esc(t("jabo.thName"))}</th><th class="code">${esc(t("jabo.thPrice"))}</th><th class="code">${esc(t("jabo.thQty"))}</th>
            <th class="code">${esc(t("jabo.thClaimedAmt"))}</th><th class="code">${esc(t("jabo.thApprovedAmt"))}</th><th class="code">${esc(t("jabo.thAdj"))}</th><th>${esc(t("jabo.thReason"))}</th>
          </tr></thead>
          <tbody>
            ${items.map(it => {
              const { claimed, paid, cut } = lineOf(it);
              return `<tr>
                <td class="code">${esc(it.code)}</td><td>${esc(lineName(it))}</td>
                <td class="code" style="text-align:right">${fmtKRW(it.price)}</td><td class="code" style="text-align:right">${it.qty}</td>
                <td class="code" style="text-align:right">${fmtKRW(claimed)}</td><td class="code" style="text-align:right">${fmtKRW(paid)}</td>
                <td class="code" style="text-align:right${cut > 0 ? "; color:var(--accent); font-weight:600" : ""}">${cut > 0 ? "−" + fmtKRW(cut) : "0"}</td>
                <td style="font-size: 11px; color: var(--ink-2)">${cut > 0 ? esc(reasonLabel(it.cutKey, "jabo.reasonMissing")) : "—"}</td>
              </tr>`;
            }).join("")}
            <tr style="background: var(--paper-2); font-weight: 600">
              <td colspan="4" style="text-align:right">${esc(t("jabo.total"))}</td>
              <td class="code" style="text-align:right">${fmtKRW(totals.claimed)}</td><td class="code" style="text-align:right">${fmtKRW(totals.paid)}</td>
              <td class="code" style="text-align:right; color:var(--accent)">${cutTotal > 0 ? "−" + fmtKRW(cutTotal) : "0"}</td><td>${esc(t("jabo.rateRow", { r: cutPct }))}</td>
            </tr>
          </tbody>
        </table>`;
    }
    persistDraftItems();
    return { totals, cutTotal };
  };

  const renderItems = () => {
    const list = $("#jabo-items");
    if (!items.length) {
      list.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--muted); font-family: 'Fraunces', serif; font-style: italic; font-size: 14px;">${esc(t("jabo.noItems"))}</div>`;
    } else {
      list.innerHTML = items.map(rowHTML).join("");
    }
    refreshTotals();
  };

  // One delegated listener set — rows are updated in place, so focus survives every keystroke.
  const itemsEl = $("#jabo-items");
  itemsEl.addEventListener("input", (e) => {
    const tg = e.target; const i = +tg.dataset.i;
    if (!(i in items)) return;
    if (tg.classList.contains("qty")) items[i].qty = Math.max(1, +tg.value || 1);
    else if (tg.classList.contains("paid-unit")) items[i].paid = Math.max(0, +tg.value || 0);
    else return;
    refreshRow(i); refreshTotals();
  });
  itemsEl.addEventListener("change", (e) => {
    const tg = e.target; const i = +tg.dataset.i;
    if (!(i in items)) return;
    if (tg.classList.contains("cut-reason")) { items[i].cutKey = tg.value; refreshTotals(); }
    else if (tg.classList.contains("qty") && (+tg.value || 0) < 1) { tg.value = 1; items[i].qty = 1; refreshRow(i); refreshTotals(); }
  });
  itemsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-btn");
    if (!btn) return;
    const i = +btn.dataset.i;
    const [removed] = items.splice(i, 1);
    renderItems();
    Haptic.del();
    Toast.withUndo(t("jabo.removedToast", { name: lineName(removed) }), () => { items.splice(Math.min(i, items.length), 0, removed); renderItems(); }, "jabo");
  });

  searchEl.addEventListener("input", e => renderSearch(e.target.value));
  searchEl.addEventListener("focus", e => renderSearch(e.target.value));
  document.addEventListener("click", e => { if (!e.target.closest(".item-search")) resultsEl.classList.remove("show"); if (!e.target.closest("#jabo-new, #jabo-new-menu")) $("#jabo-new-menu").hidden = true; });

  $("#jabo-download").addEventListener("click", () => {
    const pid = $("#jabo-pid").value.trim() || "—";
    const insurer = $("#jabo-insurer").value || "—";
    const insurerLbl = insurerLabel(insurer);
    const claimNo = $("#jabo-claim").value.trim() || "—";
    const accident = $("#jabo-accident").value || "—";
    const date = $("#jabo-date").value || todayISO();
    const dx = dxSel.value;
    const dxRec = DATA.jabo.diagnosis_examples.find(d => d.code === dx) || (extraDx && extraDx.code === dx ? extraDx : null);
    const dxName = dxRec ? pick(dxRec, "name") : "";
    const { totals, cutTotal } = refreshTotals();
    if ($("#jabo-insurer").value) Insurers.setLastUsed($("#jabo-insurer").value);
    if (pid !== "—") Patients.ensure(pid, { tags: ["jabo"] });

    // History + activity carry 환자번호 + totals only — no name, no claim number. The 환자번호 goes
    // through meta.subject so the log stores only its pseudonymised form (****0142).
    const history = Store.get("jabo.history", []) || [];
    history.unshift({ at: Date.now(), kind: "manual", pid, insurer, date, claimed: totals.claimed, paid: totals.paid, cut: cutTotal, itemCount: items.length });
    Store.set("jabo.history", history.slice(0, 100));
    ActivityLog.push("jabo", t("jabo.logManual", { ins: insurerLbl, c: won(totals.claimed), cut: won(cutTotal) }), { subject: { pid } });
    Haptic.save();

    const rows = items.map(it => {
      const { claimed, paid, cut } = lineOf(it);
      return headerRow([
        ["jabo.mcol.pid", pid], ["jabo.mcol.insurer", insurerLbl], ["jabo.mcol.claim", claimNo], ["jabo.mcol.accident", accident], ["jabo.mcol.date", date],
        ["jabo.mcol.dx", dx], ["jabo.mcol.dxName", dxName], ["jabo.mcol.code", it.code], ["jabo.mcol.name", lineName(it)], ["jabo.mcol.cat", catLabel(it.category)],
        ["jabo.mcol.price", it.price], ["jabo.mcol.unit", unitLabel(it.unit)], ["jabo.mcol.qty", it.qty], ["jabo.mcol.claimed", claimed], ["jabo.mcol.approved", paid], ["jabo.mcol.cut", cut],
        ["jabo.mcol.reason", cut > 0 ? reasonLabel(it.cutKey, "jabo.reasonMissing") : ""]
      ]);
    });
    rows.push(headerRow([
      ["jabo.mcol.pid", ""], ["jabo.mcol.insurer", ""], ["jabo.mcol.claim", ""], ["jabo.mcol.accident", ""], ["jabo.mcol.date", ""], ["jabo.mcol.dx", ""], ["jabo.mcol.dxName", ""],
      ["jabo.mcol.code", ""], ["jabo.mcol.name", t("jabo.total")], ["jabo.mcol.cat", ""], ["jabo.mcol.price", ""], ["jabo.mcol.unit", ""], ["jabo.mcol.qty", ""],
      ["jabo.mcol.claimed", totals.claimed], ["jabo.mcol.approved", totals.paid], ["jabo.mcol.cut", cutTotal], ["jabo.mcol.reason", ""]
    ]));
    downloadXLSX(rows, t("jabo.manualFile", { pid, date }), t("jabo.manualSheet")); // watermark + _PoC applied inside
  });

  const today = todayISO();
  $("#jabo-date").value = today;
  $("#jabo-accident").value = today;
  ["jabo-pid", "jabo-insurer", "jabo-claim", "jabo-accident", "jabo-date"].forEach(id => bindPersist("#" + id, "jabo.draft." + id));
  bindPersist("#jabo-dx", "jabo.draft.jabo-dx");

  const draftItems = Store.get("jabo.draft.items");
  if (Array.isArray(draftItems) && draftItems.length) items.push(...draftItems.map(d => { const it = { cutKey: "", ...d }; delete it.cutCode; return it; })); // cutCode: pre-security-pass field
  const persistDraftItems = debounce(() => {
    Store.set("jabo.draft.items", items.map(({ code, name, qty, unit, price, category, paid, cutKey, kind }) => ({ code, name, qty, unit, price, category, paid, cutKey, ...(kind ? { kind } : {}) })));
  }, 500);
  renderItems();

  let lastManualStatus = null;
  const manualStatus = (kind, fn) => { lastManualStatus = { kind, fn }; setStatus($("#jabo-status"), kind, fn()); };

  /* 새 케이스 — 같은 사고 다음 진료 (keeps 환자번호·보험사·사고일·접수번호·주상병, clears 진료일·행위) vs 완전히 새로. */
  const FIELDS = ["jabo-pid", "jabo-insurer", "jabo-claim", "jabo-accident", "jabo-date"];
  const applyFields = (fields, dx, list) => {
    for (const [id, v] of Object.entries(fields)) { const el = $("#" + id); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); }
    if (dx) dxSel.value = dx; else dxSel.selectedIndex = 0;
    dxSel.dispatchEvent(new Event("change", { bubbles: true }));
    items.length = 0; items.push(...list); renderItems();
  };
  const newCase = (mode) => {
    const dirty = items.length > 0 || ["jabo-pid", "jabo-claim"].some(id => $("#" + id).value.trim());
    const statusEl = $("#jabo-status");
    const snap = {
      fields: Object.fromEntries(FIELDS.map(id => [id, $("#" + id).value])), dx: dxSel.value,
      items: items.map(it => ({ ...it })), status: lastManualStatus && statusEl.style.display !== "none" ? lastManualStatus : null
    };
    const t0 = todayISO();
    if (mode === "same") {
      applyFields({ "jabo-pid": snap.fields["jabo-pid"], "jabo-insurer": snap.fields["jabo-insurer"], "jabo-claim": snap.fields["jabo-claim"], "jabo-accident": snap.fields["jabo-accident"], "jabo-date": t0 }, snap.dx, []);
      Store.remove("jabo.draft.items");
      manualStatus(null, () => t("jabo.newSameStatus", { who: redactSubject({ pid: snap.fields["jabo-pid"] }) }));
    } else {
      applyFields({ "jabo-pid": "", "jabo-insurer": "", "jabo-claim": "", "jabo-accident": t0, "jabo-date": t0 }, "", []);
      Store.remove("jabo.draft.items");
      statusEl.style.display = "none"; lastManualStatus = null;
    }
    if (!dirty) { Toast.show({ tag: "jabo", html: esc(t("jabo.newCaseToast")) }); return; }
    Haptic.del();
    Toast.withUndo(t("jabo.newCaseUndo", { who: redactSubject({ pid: snap.fields["jabo-pid"] }), n: snap.items.length }), () => {
      applyFields(snap.fields, snap.dx, snap.items);
      if (snap.status) manualStatus(snap.status.kind, snap.status.fn);
    }, "jabo");
  };
  $("#jabo-new").addEventListener("click", () => { const m = $("#jabo-new-menu"); m.hidden = !m.hidden; });
  $("#jabo-new-same").addEventListener("click", () => { $("#jabo-new-menu").hidden = true; newCase("same"); });
  $("#jabo-new-fresh").addEventListener("click", () => { $("#jabo-new-menu").hidden = true; newCase("fresh"); });

  // ctx from 07 (AI result) / 06 (insert) / 환자 trackers: { dx, items, bigeupItems, pid, insurer, claim, accident, date }
  const applyCase = (c) => {
    if (c.pid) { $("#jabo-pid").value = c.pid; $("#jabo-pid").dispatchEvent(new Event("change", { bubbles: true })); }
    if (c.insurer) { insSel.value = c.insurer; insSel.dispatchEvent(new Event("change", { bubbles: true })); }
    else if (!insSel.value && Insurers.lastUsed()) { insSel.value = Insurers.lastUsed(); }
    if (c.claim) { $("#jabo-claim").value = c.claim; $("#jabo-claim").dispatchEvent(new Event("change", { bubbles: true })); }
    if (c.accident) { $("#jabo-accident").value = c.accident; $("#jabo-accident").dispatchEvent(new Event("change", { bubbles: true })); }
    if (c.date) { $("#jabo-date").value = c.date; $("#jabo-date").dispatchEvent(new Event("change", { bubbles: true })); }
    if (c.dx) setDx(c.dx);
    const added = [], skipped = [], addedBg = [], skippedBg = [];
    for (const code of (Array.isArray(c.items) ? c.items : [])) (addItem(code, { render: false }) ? added : skipped).push(code);
    for (const code of (Array.isArray(c.bigeupItems) ? c.bigeupItems : [])) (addBigeupItem(code) ? addedBg : skippedBg).push(code);
    renderItems();
    manualStatus(skipped.length || skippedBg.length ? "warn" : null, () => t("jabo.caseFilled", { n: added.length, dx: c.dx ? toEdi(c.dx) : "—" })
      + (skipped.length ? t("jabo.caseSkipped", { codes: skipped.join(", ") }) : "")
      + (addedBg.length ? t("jabo.caseBigeup", { n: addedBg.length }) : "")
      + (skippedBg.length ? t("jabo.caseBigeupSkipped", { codes: skippedBg.join(", ") }) : ""));
    $("#jabo-items")?.closest(".card")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // 수기 샘플 — 명세서 M2608-0001 of the shared clinic (P-2026-0142 · 삼성화재 · 접수 SS-2026-77812 · 사고 2026-08-03).
  $('[data-action="run-jabo-manual"]').addEventListener("click", () => {
    $("#jabo-pid").value = "P-2026-0142";
    insSel.value = "삼성";
    $("#jabo-claim").value = "SS-2026-77812";
    $("#jabo-accident").value = "2026-08-03";
    $("#jabo-date").value = "2026-08-04";
    setDx("S134");
    items.length = 0;
    for (const code of ["예시-01", "예시-03", "예시-08", "예시-10", "예시-13"]) addItem(code, { render: false });
    const cup = items.find(x => x.code === "예시-08"); if (cup) { cup.qty = 2; }
    const yak = items.find(x => x.code === "예시-13"); if (yak) { yak.qty = 2; yak.paid = Math.round(yak.price / 2); yak.cutKey = "site_mismatch"; }
    renderItems();
    manualStatus(null, () => t("jabo.statusManualSample"));
  });

  /* ───────────── batch changes · ctx · restore ───────────── */
  onClaimsChange((ev) => {
    strip();
    const c = currentClaimsBatch("auto");
    if (!c) { restore(); return; }
    if (ev?.kind === "review") {
      // our own upload re-runs itself (non-silent) right after; the sample seed's review is run by seed(); a review
      // uploaded on the 청구 배치 landing (origin "landing") must be reconciled HERE — non-silent so the KPI history lands.
      if (ev.origin === "landing" && ev.claimsBatchId === c.id) restore({ silent: false, meta: { review: true } });
      return;
    }
    // a 자보 batch created elsewhere (상병 정비 · 청구 배치) or here, a switch from the strip, a payer assignment, or a
    // removal → re-derive silently. Events about the other payer's batches leave this panel alone.
    if (c.id !== lastClaimsId || ev?.kind === "remove" || ev?.kind === "payer") restore();
  });
  ["store:ui.claimsBatch", "store:ui.claimsBatch.auto"].forEach(ev => EventBus.on(ev, () => { const c = currentClaimsBatch("auto"); if ((c && c.id !== lastClaimsId) || (!c && lastClaimsId)) { strip(); restore(); } }));
  // Appeals change → the row buttons flip between 이의신청 준비 / 보기.
  Appeals.onChange(() => { if (lastPair) renderRecon(); });
  EventBus.on("tab:activated", (p) => {
    const c = p?.id === "tab-jabo" ? p.ctx : null;
    if (!c) return;
    if (c.dx || (Array.isArray(c.items) && c.items.length) || (Array.isArray(c.bigeupItems) && c.bigeupItems.length) || c.pid) applyCase(c);
    else if (c.focus === "manual") setTimeout(() => $("#jabo-items")?.closest(".card")?.scrollIntoView({ block: "start", behavior: "smooth" }), 60); // 홈 todo → the unfinished 수기 case
    else if (c.stmt) { // 이의신청 → 대조로 보기: highlight that 명세서's rows
      focusStmt = c.stmt;
      if (!lastPair) restore();
      else renderRecon();
    }
  });
  restore();
  EventBus.on("session:unlocked", () => { strip(); if (!lastRecon) restore(); });

  onLangChange(() => {
    buildSelects(); renderFeeBadge(); fillInsurerSelect(reconInsurer, true); strip();
    if (lastPair) renderRecon();
    renderSlots();
    if (lastReconStatus) setStatus($("#jabo-recon-status"), lastReconStatus.kind, lastReconStatus.fn());
    renderItems();
    if (lastManualStatus && $("#jabo-status").style.display !== "none") setStatus($("#jabo-status"), lastManualStatus.kind, lastManualStatus.fn());
    if (searchEl.value.trim() && resultsEl.classList.contains("show")) renderSearch(searchEl.value);
  });
}
