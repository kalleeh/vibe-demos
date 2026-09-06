/* clinic-admin — Tab 02 · 자보 심사결과 정산
   Primary path: file-based reconciliation — the 청구 명세서 export (one `claims` batch, shared with tab 01 — see
   tabs/claims-shared.js) ⨝ 심평원 심사결과통보 (a `review` batch linked by meta.claimsBatchId), joined on
   명세서번호 + 행위코드 → per-line 청구 vs 인정 delta, grouped by 조정사유 and month. A batch-level 보험사 select
   (default Insurers.lastUsed()) is stored on every recon history entry.
   Secondary path: manual single-case entry. Receives ctx from 07/06: activateTab("tab-jabo", { dx, items, pid,
   insurer?, claim?, accident? }) → sets the 주상병, adds each 행위, prefills the 환자번호.
   Cross-tab actions per reconciliation row: 상병 정비에서 보기 (01, focused on the 명세서) · 행위 검색 (06) ·
   AI에게 묻기 (07, for 상병-처치 부위 불일치 / 동일부위 중복).
   i18n: everything user-visible goes through t()/pick(); the language toggle re-renders from state the tab holds. */
import { $, esc, fmtKRW, won, todayISO, fuzzyMatch, setStatus, debounce, bindDrop, Haptic, Toast, redactSubject } from "../core/ui.js";
import { t, tOr, pick, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog, bindPersist } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, headerRow } from "../core/files.js";
import { Masters, toEdi, toDotted } from "../core/masters.js";
import { activateTab, Insurers, Patients } from "./_entities-shim.js"; // TODO(integrator): ../core/nav.js + ../core/entities.js
import { currentClaimsBatch, reviewFor, ingestClaimsFile, createReviewBatch, itemLinesOf, stmtCodes, renderBatchStrip, onClaimsChange, ensureSampleBatch, loadSampleRows } from "./claims-shared.js";

let seedFn = null;
export function seed() { return seedFn ? seedFn() : Promise.resolve(); }

export function initTab2(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  const REASONS = DATA.jabo.adjustment_reasons || [];
  const reasonLabel = (key, fallbackKey) => { const r = REASONS.find(x => x.key === key); return r ? pick(r, "label") : (fallbackKey ? t(fallbackKey) : (key ? String(key) : "")); };
  const unitLabel = (u) => tOr("common.unit." + (u || "회"), u || "회");
  const catLabel = (c) => c ? tOr("jabo.cat." + c, c) : "";
  // Insurers: the entity list when the clinic has one, else the bundled example list (strings or {value,label} rows).
  const insurerRows = () => {
    const l = Insurers.list();
    const rows = l && l.length ? l : (DATA.jabo.insurers || []);
    return rows.map(x => typeof x === "string" ? { value: x, label: x, label_en: x, type: "" } : x);
  };
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

  /* ───────────── Primary: file-based reconciliation ───────────── */
  let lastRecon = null, lastReconStatus = null, lastClaimsId = null, lastReviewId = null;
  const reconStatus = (kind, fn) => { lastReconStatus = { kind, fn }; setStatus($("#jabo-recon-status"), kind, fn()); };
  const ASK_REASONS = new Set(["site_mismatch", "dup_same_site"]);

  // lines: itemLinesOf(claimsBatch) · review: reviewBatch.rows (parseReview shape)
  const reconcile = (lines, review) => {
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
  };
  // Reason text for a line — file wording first (the notice's own words win), else the example class in the UI
  // language (matched by key), else "reason not stated". Resolved at render time so it follows the language.
  const lineReason = (l) => {
    if (!l.hasCut) return "";
    const known = REASONS.find(x => x.key === l.reasonKey);
    if (known) return pick(known, "label");
    return l.reasonText || t("jabo.reasonUnknown");
  };
  const groupByReason = (lines) => {
    const byReason = new Map();
    for (const l of lines) if (l.hasCut) {
      const k = lineReason(l);
      if (!byReason.has(k)) byReason.set(k, { reason: k, lines: 0, cut: 0 });
      const g = byReason.get(k); g.lines++; g.cut += l.delta;
    }
    return [...byReason.values()].sort((a, b) => b.cut - a.cut);
  };

  const STATUS_CLS = { full: "ok", cut_part: "warn", cut_all: "err", none: "info" };
  const statusLabel = (s) => t("jabo.status." + s);
  const askPrefill = (l) => {
    const batch = currentClaimsBatch();
    const dx = stmtCodes(batch, l.stmt).join(", ") || "—";
    return t("jabo.askPrefill", { stmt: l.stmt, who: Patients.alias(l.pid), dx, code: l.code, name: procName(l.code, l.name) || l.code, reason: lineReason(l) || "—" });
  };

  const renderRecon = (res) => {
    const { lines, orphans, totals, byMonth, stmts } = res;
    const byReason = groupByReason(lines);
    const rate = totals.reviewed ? Math.round((totals.cut / totals.reviewed) * 1000) / 10 : 0;
    $("#jabo-recon-toolbar").style.display = "flex";
    $("#jabo-recon-download").disabled = false;
    $("#jabo-recon-summary").innerHTML = t("jabo.reconSummary", { s: stmts, l: lines.length, c: won(totals.claimed), a: won(totals.approved), cut: won(totals.cut), rate });

    $("#jabo-recon-groups").innerHTML = `
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

    $("#jabo-recon-result").innerHTML = `
      <table>
        <thead><tr>
          <th class="code">${esc(t("jabo.thStmt"))}</th><th>${esc(t("jabo.fPid"))}</th><th class="code">${esc(t("jabo.fDate"))}</th><th class="code">${esc(t("jabo.thCode"))}</th><th>${esc(t("jabo.thName"))}</th>
          <th class="code">${esc(t("jabo.thClaimed"))}</th><th class="code">${esc(t("jabo.thApproved"))}</th><th class="code">${esc(t("jabo.thDelta"))}</th><th>${esc(t("common.thResult"))}</th><th>${esc(t("jabo.thReason"))}</th><th>${esc(t("jabo.thActions"))}</th>
        </tr></thead>
        <tbody>
          ${lines.map((l, i) => `<tr>
              <td class="code">${esc(l.stmt)}</td><td>${esc(l.pid) || "—"}</td><td class="code">${esc(l.date)}</td>
              <td class="code">${esc(l.code)}</td><td>${esc(procName(l.code, l.name)) || "—"}</td>
              <td class="code" style="text-align:right">${fmtKRW(l.claimed)}<span class="qty-mini">×${l.qty}</span></td>
              <td class="code" style="text-align:right">${l.approved == null ? "—" : fmtKRW(l.approved) + `<span class="qty-mini">×${l.approvedQty}</span>`}</td>
              <td class="code" style="text-align:right${l.delta > 0 ? "; color:var(--accent); font-weight:600" : ""}">${l.delta > 0 ? "−" + fmtKRW(l.delta) : l.approved == null ? "—" : "0"}</td>
              <td><span class="pill ${STATUS_CLS[l.status]}">${esc(statusLabel(l.status))}</span></td>
              <td style="font-size:11px; color:var(--ink-2)">${esc(lineReason(l)) || "—"}</td>
              <td class="actions">
                <button type="button" class="row-act" data-act="kcd" data-i="${i}" title="${esc(t("jabo.actKcdTitle"))}">${esc(t("jabo.actKcd"))}</button>
                <button type="button" class="row-act" data-act="search" data-i="${i}" title="${esc(t("jabo.actSearchTitle"))}">${esc(t("jabo.actSearch"))}</button>
                ${l.hasCut && ASK_REASONS.has(l.reasonKey) ? `<button type="button" class="row-act accent" data-act="ask" data-i="${i}" title="${esc(t("jabo.actAskTitle"))}">${esc(t("jabo.actAsk"))}</button>` : ""}
              </td>
            </tr>`).join("")}
          ${orphans.map(o => `<tr class="orphan">
              <td class="code">${esc(o.stmt)}</td><td>—</td><td>—</td><td class="code">${esc(o.code)}</td><td><em>${esc(t("jabo.orphanLine"))}</em></td>
              <td>—</td><td class="code" style="text-align:right">${fmtKRW(o.approved)}</td><td>—</td><td><span class="pill warn">${esc(t("jabo.status.orphan"))}</span></td><td style="font-size:11px">${esc(o.reason) || "—"}</td><td>—</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
    $("#jabo-recon-result").querySelectorAll("button[data-act]").forEach(btn => btn.addEventListener("click", () => {
      const l = lines[+btn.dataset.i]; if (!l) return;
      if (btn.dataset.act === "kcd") activateTab("tab-kcd", { stmt: l.stmt });
      else if (btn.dataset.act === "search") activateTab("tab-search", { query: l.code });
      else if (btn.dataset.act === "ask") {
        ActivityLog.push("jabo", t("jabo.logAsk", { code: l.code }), { pid: l.pid });
        activateTab("tab-ai", { prefill: askPrefill(l), pid: l.pid, stmt: l.stmt });
      }
    }));
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
    const res = reconcile(itemLinesOf(claims), review.rows);
    lastRecon = res; lastClaimsId = claims.id; lastReviewId = review.id;
    renderRecon(res);
    renderSlots();
    const insurer = reconInsurer.value || Insurers.lastUsed() || "";
    if (!silent) {
      if (insurer) Insurers.setLastUsed(insurer);
      // History: 명세서 count + totals + insurer + batch id — no names, no claim numbers.
      const history = Store.get("jabo.history", []) || [];
      history.unshift({ at: Date.now(), kind: "recon", stmts: res.stmts, itemCount: res.lines.length, date: todayISO(),
        claimed: res.totals.claimed, paid: res.totals.approved, cut: res.totals.cut, insurer, batchId: claims.id, month: claims.meta?.month || "" });
      Store.set("jabo.history", history.slice(0, 100));
      ActivityLog.push("jabo", t("jabo.logRecon", { s: res.stmts, cut: won(res.totals.cut) }), meta);
    }
    const unreviewed = res.lines.filter(l => l.status === "none").length;
    reconStatus(unreviewed ? "warn" : null, () =>
      t("jabo.statusRecon", { l: res.lines.length, r: groupByReason(res.lines).length, cut: won(res.totals.cut) }) +
      (unreviewed ? t("jabo.statusUnreviewed", { n: unreviewed }) : "") + t("jabo.statusAppeal"));
  };

  // File slots under the two drops: current claims batch + its linked review batch.
  const renderSlots = () => {
    const c = currentClaimsBatch(), r = c ? reviewFor(c.id) : null;
    const el1 = $("#jabo-file-claims"), el2 = $("#jabo-file-review");
    if (el1) el1.innerHTML = c ? `<span class="pill ${c.meta?.sample ? "" : "ok"}">${esc(t(c.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(c.source)} · ${esc(t("common.nRows", { n: c.meta?.itemLines ?? 0 }))}` : "";
    if (el2) el2.innerHTML = r ? `<span class="pill ${r.meta?.sample ? "" : "ok"}">${esc(t(r.meta?.sample ? "jabo.pillSample" : "jabo.pillRead"))}</span> ${esc(r.source)} · ${esc(t("common.nRows", { n: r.rows.length }))}` : "";
  };
  const clearRecon = () => {
    lastRecon = null; lastClaimsId = null; lastReviewId = null;
    $("#jabo-recon-toolbar").style.display = "none"; $("#jabo-recon-groups").innerHTML = "";
    $("#jabo-recon-result").innerHTML = `<div class="empty-state">${esc(t("jabo.reconEmpty"))}</div>`;
    renderSlots();
  };
  // Re-derive the reconciliation from the current batch pair (boot, batch switch, review upload).
  const restore = ({ silent = true, meta } = {}) => {
    const c = currentClaimsBatch();
    if (!c) { clearRecon(); return; }
    if (c.meta?.partial === "kcd") { clearRecon(); reconStatus("warn", () => t("jabo.noItemSide")); return; }
    const r = reviewFor(c.id);
    if (!r) { clearRecon(); reconStatus(null, () => t("jabo.statusNeedReview", { src: c.source || "—", n: c.meta?.stmts ?? c.rows.length })); return; }
    runRecon(c, r, { silent, meta });
  };

  const ingestClaims = async (file) => {
    try {
      reconStatus(null, () => t("common.statusReading", { name: esc(file.name) }));
      const r = await ingestClaimsFile(file);
      if (r.empty) { reconStatus("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("jabo", t("jabo.logBatch", { src: file.name, n: r.batch.meta.stmts }), { rows: r.batch.rows.length });
      restore({ silent: false, meta: { claims: r.batch.rows.length } });
    } catch (err) { console.error(err); reconStatus("err", () => t("common.statusReadFail")); }
  };
  const ingestReview = async (file) => {
    try {
      const c = currentClaimsBatch();
      if (!c) { reconStatus("warn", () => t("jabo.statusNoClaims")); return; }
      reconStatus(null, () => t("common.statusReading", { name: esc(file.name) }));
      const rows = await readSpreadsheet(file);
      if (!rows.length) { reconStatus("warn", () => t("common.statusEmptyFile")); return; }
      const rv = createReviewBatch({ rows, source: file.name, claimsBatchId: c.id });
      if (!rv) { reconStatus("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("jabo", t("jabo.logReview", { src: file.name, n: rv.rows.length }), { review: rv.rows.length });
      restore({ silent: false, meta: { review: rv.rows.length } });
    } catch (err) { console.error(err); reconStatus("err", () => t("common.statusReadFail")); }
  };
  bindDrop("drop-jabo-claims", ingestClaims);
  bindDrop("drop-jabo-review", ingestReview);
  const strip = () => renderBatchStrip($("#jabo-batch-strip"), { onFile: ingestClaims });
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
    const R = (l) => headerRow([
      ["jabo.col.stmt", l.stmt], ["jabo.col.pid", l.pid], ["jabo.col.date", l.date], ["jabo.col.code", l.code], ["jabo.col.name", l.name],
      ["jabo.col.qty", l.qty], ["jabo.col.claimed", l.claimed], ["jabo.col.aqty", l.aqty], ["jabo.col.approved", l.approved],
      ["jabo.col.delta", l.delta], ["jabo.col.result", l.result], ["jabo.col.reason", l.reason]
    ]);
    const rows = lastRecon.lines.map(l => R({
      stmt: l.stmt, pid: l.pid, date: l.date, code: l.code, name: procName(l.code, l.name), qty: l.qty, claimed: l.claimed,
      aqty: l.approvedQty ?? "", approved: l.approved ?? "", delta: l.approved == null ? "" : l.delta, result: statusLabel(l.status), reason: lineReason(l)
    }));
    for (const o of lastRecon.orphans) rows.push(R({ stmt: o.stmt, pid: "", date: "", code: o.code, name: t("jabo.orphanLine"), qty: "", claimed: "", aqty: "", approved: o.approved, delta: "", result: t("jabo.status.orphan"), reason: o.reason }));
    rows.push(R({ stmt: "", pid: "", date: "", code: "", name: t("jabo.total"), qty: "", claimed: lastRecon.totals.claimed, aqty: "", approved: lastRecon.totals.approved, delta: lastRecon.totals.cut, result: "", reason: "" }));
    for (const g of groupByReason(lastRecon.lines)) rows.push(R({ stmt: "", pid: "", date: "", code: "", name: t("jabo.byReasonRow", { reason: g.reason }), qty: "", claimed: "", aqty: "", approved: "", delta: g.cut, result: t("jabo.nLines", { n: g.lines }), reason: "" }));
    rows.push(R({ stmt: "", pid: "", date: "", code: "", name: t("jabo.insurerRow", { ins: insurerLabel(reconInsurer.value) }), qty: "", claimed: "", aqty: "", approved: "", delta: "", result: "", reason: "" }));
    downloadXLSX(rows, t("jabo.reconFile", { date: todayISO() }), t("jabo.reconSheet")); // watermark + _PoC applied inside
    ActivityLog.push("jabo", t("jabo.logReconDl", { n: lastRecon.lines.length }), {});
  });

  /* ───────────── Secondary: manual single-case entry ───────────── */
  const items = []; // {code, name, qty, unit, price, category, paid, cutKey}
  const dxSel = $("#jabo-dx");
  const insSel = $("#jabo-insurer");
  const feeRows = () => Masters.fee().rows;
  const feeByCode = (code) => feeRows().find(i => i.code === code);
  // Procedure name for display: the fee table's localised name when the code is known, else the stored/file name.
  const procName = (code, name) => { const d = feeByCode(code); return d ? (pick(d, "name") || name) : name; };
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
    const existing = items.find(x => x.code === code);
    if (existing) existing.qty++;
    else items.push({ code: def.code, name: def.name, unit: def.unit || "회", price: def.price ?? 0, category: def.category || "", qty: 1, paid: def.price ?? 0, cutKey: "" });
    searchEl.value = "";
    resultsEl.classList.remove("show");
    if (render) renderItems();
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
      <div class="item-row recon" data-i="${i}">
        <span class="code-tag">${esc(it.code)}</span>
        <span class="name">${esc(procName(it.code, it.name))} <span style="color: var(--faint); font-size: 11px; margin-left: 4px;">${esc(catLabel(it.category))}</span></span>
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
                <td class="code">${esc(it.code)}</td><td>${esc(procName(it.code, it.name))}</td>
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
    Toast.withUndo(t("jabo.removedToast", { name: procName(removed.code, removed.name) }), () => { items.splice(Math.min(i, items.length), 0, removed); renderItems(); }, "jabo");
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
        ["jabo.mcol.dx", dx], ["jabo.mcol.dxName", dxName], ["jabo.mcol.code", it.code], ["jabo.mcol.name", procName(it.code, it.name)], ["jabo.mcol.cat", catLabel(it.category)],
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
  if (Array.isArray(draftItems) && draftItems.length) items.push(...draftItems.map(({ cutCode, ...rest }) => ({ cutKey: "", ...rest })));
  const persistDraftItems = debounce(() => {
    Store.set("jabo.draft.items", items.map(({ code, name, qty, unit, price, category, paid, cutKey }) => ({ code, name, qty, unit, price, category, paid, cutKey })));
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

  // ctx from 07 (AI result) / 06 (insert): { dx, items, pid, insurer, claim, accident, date }
  const applyCase = (c) => {
    if (c.pid) { $("#jabo-pid").value = c.pid; $("#jabo-pid").dispatchEvent(new Event("change", { bubbles: true })); }
    if (c.insurer) { insSel.value = c.insurer; insSel.dispatchEvent(new Event("change", { bubbles: true })); }
    else if (!insSel.value && Insurers.lastUsed()) { insSel.value = Insurers.lastUsed(); }
    if (c.claim) { $("#jabo-claim").value = c.claim; $("#jabo-claim").dispatchEvent(new Event("change", { bubbles: true })); }
    if (c.accident) { $("#jabo-accident").value = c.accident; $("#jabo-accident").dispatchEvent(new Event("change", { bubbles: true })); }
    if (c.date) { $("#jabo-date").value = c.date; $("#jabo-date").dispatchEvent(new Event("change", { bubbles: true })); }
    if (c.dx) setDx(c.dx);
    const added = [], skipped = [];
    for (const code of (Array.isArray(c.items) ? c.items : [])) (addItem(code, { render: false }) ? added : skipped).push(code);
    renderItems();
    manualStatus(skipped.length ? "warn" : null, () => t("jabo.caseFilled", { n: added.length, dx: c.dx ? toEdi(c.dx) : "—" }) + (skipped.length ? t("jabo.caseSkipped", { codes: skipped.join(", ") }) : ""));
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
    const c = currentClaimsBatch();
    if (!c) { clearRecon(); return; }
    if (ev?.kind === "review") return; // the uploading tab re-runs itself (non-silent) right after
    // a batch created elsewhere (01) or here, a switch from the strip, or a removal → re-derive silently
    if (c.id !== lastClaimsId || ev?.kind === "remove") restore();
  });
  EventBus.on("store:ui.claimsBatch", () => { const c = currentClaimsBatch(); if (c && c.id !== lastClaimsId) { strip(); restore(); } });
  EventBus.on("tab:activated", (p) => {
    const id = typeof p === "string" ? p : p?.id; const c = typeof p === "string" ? null : p?.ctx;
    if (id !== "tab-jabo" || !c) return;
    if (c.dx || (Array.isArray(c.items) && c.items.length) || c.pid) applyCase(c);
  });
  restore();
  EventBus.on("session:unlocked", () => { strip(); if (!lastRecon) restore(); });

  onLangChange(() => {
    buildSelects(); renderFeeBadge(); fillInsurerSelect(reconInsurer, true); strip();
    if (lastRecon) renderRecon(lastRecon);
    renderSlots();
    if (lastReconStatus) setStatus($("#jabo-recon-status"), lastReconStatus.kind, lastReconStatus.fn());
    renderItems();
    if (lastManualStatus && $("#jabo-status").style.display !== "none") setStatus($("#jabo-status"), lastManualStatus.kind, lastManualStatus.fn());
    if (searchEl.value.trim() && resultsEl.classList.contains("show")) renderSearch(searchEl.value);
  });
}
