/* clinic-admin — Tab 02 · 자보 심사결과 정산
   Primary path: file-based reconciliation — 청구 명세서 export ⨝ 심평원 심사결과통보
   (join 명세서번호 + 행위코드) → per-line 청구 vs 인정 delta, grouped by 조정사유 and month.
   Secondary path: manual single-case entry (kept from the earlier build, focus-loss fixed).
   i18n: everything user-visible goes through t()/pick(); the language toggle re-renders the reconciliation,
   the manual case and the select options from state the tab already holds. */
import { $, esc, fmtKRW, won, todayISO, fuzzyMatch, setStatus, debounce, bindDrop, Haptic, Toast, redactSubject } from "../core/ui.js";
import { t, tOr, pick, onLangChange } from "../core/i18n.js";
import { Store, ActivityLog, bindPersist } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, loadJSON, headerRow } from "../core/files.js";
import { Masters } from "../core/masters.js";

export function initTab2(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  const REASONS = DATA.jabo.adjustment_reasons || [];
  const reasonLabel = (key, fallbackKey) => { const r = REASONS.find(x => x.key === key); return r ? pick(r, "label") : (fallbackKey ? t(fallbackKey) : (key ? String(key) : "")); };
  const unitLabel = (u) => tOr("common.unit." + (u || "회"), u || "회");
  const catLabel = (c) => c ? tOr("jabo.cat." + c, c) : "";

  const pickCol = (row, names) => {
    for (const n of names) if (row[n] != null && String(row[n]).trim() !== "") return String(row[n]).trim();
    return "";
  };
  const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : 0; };
  const CLAIM_COL = {
    stmt: ["명세서번호", "접수번호", "명세서 번호", "청구번호"], pid: ["환자번호", "등록번호"], date: ["진료일자", "진료일", "요양개시일"],
    code: ["행위코드", "수가코드", "코드"], name: ["행위명", "항목명", "수가명", "명칭"], qty: ["횟수", "청구횟수", "수량"], amt: ["청구금액", "청구액", "금액"]
  };
  const REVIEW_COL = {
    stmt: ["명세서번호", "접수번호", "명세서 번호", "청구번호"], code: ["행위코드", "수가코드", "코드"],
    qty: ["인정횟수", "인정 횟수"], amt: ["인정금액", "인정액", "지급금액", "결정금액"], rkey: ["조정사유코드", "조정코드", "사유코드"], rtxt: ["조정사유", "조정사유명", "사유", "심사조정사유"]
  };

  /* ───────────── Primary: file-based reconciliation ───────────── */
  const files = { claims: null, review: null };
  let lastRecon = null, lastReconStatus = null;
  const reconStatus = (kind, fn) => { lastReconStatus = { kind, fn }; setStatus($("#jabo-recon-status"), kind, fn()); };

  const reconcile = (claims, review) => {
    const revIdx = new Map();
    for (const r of review) {
      const k = `${pickCol(r, REVIEW_COL.stmt)}|${pickCol(r, REVIEW_COL.code)}`;
      revIdx.set(k, r);
    }
    const lines = [];
    const matched = new Set();
    for (const c of claims) {
      const stmt = pickCol(c, CLAIM_COL.stmt), code = pickCol(c, CLAIM_COL.code);
      const key = `${stmt}|${code}`;
      const r = revIdx.get(key);
      const claimed = num(pickCol(c, CLAIM_COL.amt)), qty = num(pickCol(c, CLAIM_COL.qty));
      const approved = r ? num(pickCol(r, REVIEW_COL.amt)) : null;
      const delta = approved == null ? 0 : claimed - approved;
      const rkey = r ? pickCol(r, REVIEW_COL.rkey) : "";
      const rtxt = r ? pickCol(r, REVIEW_COL.rtxt) : "";
      const status = !r ? "none" : delta <= 0 ? "full" : approved === 0 ? "cut_all" : "cut_part";
      if (r) matched.add(key);
      lines.push({
        stmt, pid: pickCol(c, CLAIM_COL.pid), date: pickCol(c, CLAIM_COL.date), code, name: pickCol(c, CLAIM_COL.name),
        qty, claimed, approvedQty: r ? num(pickCol(r, REVIEW_COL.qty)) : null, approved, delta, status,
        reasonKey: rkey, reasonText: rtxt, hasCut: delta > 0
      });
    }
    const orphans = review.filter(r => !matched.has(`${pickCol(r, REVIEW_COL.stmt)}|${pickCol(r, REVIEW_COL.code)}`)).map(r => ({
      stmt: pickCol(r, REVIEW_COL.stmt), code: pickCol(r, REVIEW_COL.code), approved: num(pickCol(r, REVIEW_COL.amt)), reason: pickCol(r, REVIEW_COL.rtxt)
    }));
    const totals = lines.reduce((a, l) => { a.claimed += l.claimed; if (l.approved != null) { a.approved += l.approved; a.reviewed += l.claimed; } a.cut += Math.max(0, l.delta); return a; }, { claimed: 0, approved: 0, reviewed: 0, cut: 0 });
    const byMonth = new Map();
    for (const l of lines) {
      const m = (l.date || "").slice(0, 7) || "—";
      if (!byMonth.has(m)) byMonth.set(m, { month: m, claimed: 0, approved: 0, cut: 0, lines: 0, unreviewed: 0 });
      const g = byMonth.get(m); g.lines++; g.claimed += l.claimed;
      if (l.approved == null) g.unreviewed++; else { g.approved += l.approved; g.cut += Math.max(0, l.delta); }
    }
    const stmts = new Set(lines.map(l => l.stmt)).size;
    return { lines, orphans, totals, stmts, byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)) };
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

  const renderRecon = (res) => {
    const { lines, orphans, totals, byMonth, stmts } = res;
    const byReason = groupByReason(lines);
    const rate = totals.reviewed ? Math.round((totals.cut / totals.reviewed) * 1000) / 10 : 0;
    $("#jabo-recon-toolbar").style.display = "flex";
    $("#jabo-recon-download").disabled = false;
    $("#jabo-recon-summary").innerHTML = t("jabo.reconSummary", { s: stmts, l: lines.length, c: won(totals.claimed), a: won(totals.approved), cut: won(totals.cut), rate });

    const groups = `
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
    $("#jabo-recon-groups").innerHTML = groups;

    $("#jabo-recon-result").innerHTML = `
      <table>
        <thead><tr>
          <th class="code">${esc(t("jabo.thStmt"))}</th><th>${esc(t("jabo.fPid"))}</th><th class="code">${esc(t("jabo.fDate"))}</th><th class="code">${esc(t("jabo.thCode"))}</th><th>${esc(t("jabo.thName"))}</th>
          <th class="code">${esc(t("jabo.thClaimed"))}</th><th class="code">${esc(t("jabo.thApproved"))}</th><th class="code">${esc(t("jabo.thDelta"))}</th><th>${esc(t("common.thResult"))}</th><th>${esc(t("jabo.thReason"))}</th>
        </tr></thead>
        <tbody>
          ${lines.map(l => `<tr>
              <td class="code">${esc(l.stmt)}</td><td>${esc(l.pid) || "—"}</td><td class="code">${esc(l.date)}</td>
              <td class="code">${esc(l.code)}</td><td>${esc(procName(l.code, l.name)) || "—"}</td>
              <td class="code" style="text-align:right">${fmtKRW(l.claimed)}<span class="qty-mini">×${l.qty}</span></td>
              <td class="code" style="text-align:right">${l.approved == null ? "—" : fmtKRW(l.approved) + `<span class="qty-mini">×${l.approvedQty}</span>`}</td>
              <td class="code" style="text-align:right${l.delta > 0 ? "; color:var(--accent); font-weight:600" : ""}">${l.delta > 0 ? "−" + fmtKRW(l.delta) : l.approved == null ? "—" : "0"}</td>
              <td><span class="pill ${STATUS_CLS[l.status]}">${esc(statusLabel(l.status))}</span></td>
              <td style="font-size:11px; color:var(--ink-2)">${esc(lineReason(l)) || "—"}</td>
            </tr>`).join("")}
          ${orphans.map(o => `<tr class="orphan">
              <td class="code">${esc(o.stmt)}</td><td>—</td><td>—</td><td class="code">${esc(o.code)}</td><td><em>${esc(t("jabo.orphanLine"))}</em></td>
              <td>—</td><td class="code" style="text-align:right">${fmtKRW(o.approved)}</td><td>—</td><td><span class="pill warn">${esc(t("jabo.status.orphan"))}</span></td><td style="font-size:11px">${esc(o.reason) || "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  };

  const runRecon = (claims, review, meta) => {
    const res = reconcile(claims, review);
    lastRecon = res;
    renderRecon(res);
    // History: 명세서 count + totals only — no names, no claim numbers.
    const history = Store.get("jabo.history", []);
    history.unshift({ at: Date.now(), kind: "recon", stmts: res.stmts, itemCount: res.lines.length, date: todayISO(),
      claimed: res.totals.claimed, paid: res.totals.approved, cut: res.totals.cut });
    Store.set("jabo.history", history.slice(0, 100));
    ActivityLog.push("jabo", t("jabo.logRecon", { s: res.stmts, cut: won(res.totals.cut) }), meta);
    const unreviewed = res.lines.filter(l => l.status === "none").length;
    reconStatus(unreviewed ? "warn" : null, () =>
      t("jabo.statusRecon", { l: res.lines.length, r: groupByReason(res.lines).length, cut: won(res.totals.cut) }) +
      (unreviewed ? t("jabo.statusUnreviewed", { n: unreviewed }) : "") + t("jabo.statusAppeal"));
  };

  const slots = { claims: null, review: null }; // { pillKey, labelKey|name, rows }
  const renderSlot = (kind) => {
    const s = slots[kind]; const el = $(`#jabo-file-${kind}`); if (!el) return;
    if (!s) { el.innerHTML = ""; return; }
    el.innerHTML = `<span class="pill ok">${esc(t(s.pillKey))}</span> ${esc(s.labelKey ? t(s.labelKey) : s.name)} · ${esc(t("common.nRows", { n: s.rows }))}`;
  };
  const fileSlot = (kind, file, rows) => {
    files[kind] = { name: file.name, rows };
    slots[kind] = { pillKey: "jabo.pillRead", name: file.name, rows: rows.length }; renderSlot(kind);
    if (files.claims && files.review) runRecon(files.claims.rows, files.review.rows, { claims: files.claims.rows.length, review: files.review.rows.length });
    else reconStatus(null, () => t("jabo.statusOneFile", { a: t(kind === "claims" ? "jabo.fileClaims" : "jabo.fileReview"), b: t(kind === "claims" ? "jabo.fileReview" : "jabo.fileClaims") }));
  };
  for (const kind of ["claims", "review"]) {
    bindDrop(`drop-jabo-${kind}`, async (file) => {
      try {
        const rows = await readSpreadsheet(file);
        if (!rows.length) { reconStatus("warn", () => t("common.statusEmptyFile")); return; }
        fileSlot(kind, file, rows);
      } catch (err) {
        console.error(err);
        reconStatus("err", () => t("common.statusReadFail"));
      }
    });
  }

  let samples = null;
  const loadSamples = async () => samples || (samples = await Promise.all([
    loadJSON("./data/jabo-sample-claims.json"), loadJSON("./data/jabo-sample-review.json")
  ]).then(([c, r]) => ({ claims: c.rows, review: r.rows })));

  $('[data-action="sample-jabo-claims"]').addEventListener("click", async (e) => {
    e.stopPropagation();
    const s = await loadSamples();
    downloadXLSX(s.claims, t("jabo.sampleClaimsFile"), t("jabo.sampleClaimsSheet"));
  });
  $('[data-action="sample-jabo-review"]').addEventListener("click", async (e) => {
    e.stopPropagation();
    const s = await loadSamples();
    downloadXLSX(s.review, t("jabo.sampleReviewFile"), t("jabo.sampleReviewSheet"));
  });
  $('[data-action="run-jabo"]').addEventListener("click", async () => {
    reconStatus(null, () => t("jabo.statusLoadingSamples"));
    try {
      const s = await loadSamples();
      files.claims = { name: "sample-claims", rows: s.claims };
      files.review = { name: "sample-review", rows: s.review };
      slots.claims = { pillKey: "jabo.pillSample", labelKey: "jabo.slotClaimsSample", rows: s.claims.length }; renderSlot("claims");
      slots.review = { pillKey: "jabo.pillSample", labelKey: "jabo.slotReviewSample", rows: s.review.length }; renderSlot("review");
      runRecon(s.claims, s.review, { sample: true });
    } catch (err) {
      console.error(err);
      reconStatus("err", () => t("jabo.statusSampleFail"));
    }
  });

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
  const buildSelects = () => {
    const dxCur = dxSel.value;
    dxSel.innerHTML = "";
    DATA.jabo.diagnosis_examples.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.code; opt.textContent = `${d.code} · ${pick(d, "name")}`;
      dxSel.appendChild(opt);
    });
    if (dxCur) dxSel.value = dxCur;
    const insCur = insSel.value;
    insSel.querySelectorAll("option[value]:not([value=''])").forEach(o => o.remove());
    (DATA.jabo.insurers || []).forEach(i => {
      const opt = document.createElement("option");
      opt.value = i.value; opt.textContent = i.type === "공제조합" ? `${pick(i, "label")} (${t("jabo.mutual")})` : pick(i, "label");
      insSel.appendChild(opt);
    });
    insSel.value = insCur;
  };
  buildSelects();

  const renderFeeBadge = () => {
    const f = Masters.fee();
    const el = $("#jabo-fee-badge");
    if (el) el.innerHTML = `<span class="src-pill ${f.source === "master" ? "master" : "demo"}">${esc(f.label)}</span>` +
      (f.source === "bundled" ? ` <span class="basis">${esc(pick(DATA.jabo, "table_label") || "")}</span>` : "");
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

  const addItem = (code) => {
    const def = feeByCode(code);
    if (!def) return;
    const existing = items.find(x => x.code === code);
    if (existing) existing.qty++;
    else items.push({ code: def.code, name: def.name, unit: def.unit || "회", price: def.price ?? 0, category: def.category || "", qty: 1, paid: def.price ?? 0, cutKey: "" });
    searchEl.value = "";
    resultsEl.classList.remove("show");
    renderItems();
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
  document.addEventListener("click", e => { if (!e.target.closest(".item-search")) resultsEl.classList.remove("show"); });

  $("#jabo-download").addEventListener("click", () => {
    const pid = $("#jabo-pid").value.trim() || "—";
    const insurer = $("#jabo-insurer").value || "—";
    const insurerLabel = (() => { const i = (DATA.jabo.insurers || []).find(x => x.value === insurer); return i ? pick(i, "label") : insurer; })();
    const claimNo = $("#jabo-claim").value.trim() || "—";
    const accident = $("#jabo-accident").value || "—";
    const date = $("#jabo-date").value || todayISO();
    const dx = dxSel.value;
    const dxRec = DATA.jabo.diagnosis_examples.find(d => d.code === dx);
    const dxName = dxRec ? pick(dxRec, "name") : "";
    const { totals, cutTotal } = refreshTotals();

    // History + activity carry 환자번호 + totals only — no name, no claim number. The 환자번호 goes
    // through meta.subject so the log stores only its pseudonymised form (****0142).
    const history = Store.get("jabo.history", []);
    history.unshift({ at: Date.now(), kind: "manual", pid, insurer, date, claimed: totals.claimed, paid: totals.paid, cut: cutTotal, itemCount: items.length });
    Store.set("jabo.history", history.slice(0, 100));
    ActivityLog.push("jabo", t("jabo.logManual", { ins: insurerLabel, c: won(totals.claimed), cut: won(cutTotal) }), { subject: { pid } });
    Haptic.save();

    const rows = items.map(it => {
      const { claimed, paid, cut } = lineOf(it);
      return headerRow([
        ["jabo.mcol.pid", pid], ["jabo.mcol.insurer", insurerLabel], ["jabo.mcol.claim", claimNo], ["jabo.mcol.accident", accident], ["jabo.mcol.date", date],
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

  $("#jabo-new").addEventListener("click", () => {
    const FIELDS = ["jabo-pid", "jabo-insurer", "jabo-claim", "jabo-accident", "jabo-date"];
    const dirty = items.length > 0 || ["jabo-pid", "jabo-claim"].some(id => $("#" + id).value.trim());
    const statusEl = $("#jabo-status");
    const snap = {
      fields: Object.fromEntries(FIELDS.map(id => [id, $("#" + id).value])), dx: dxSel.value,
      items: items.map(it => ({ ...it })), status: lastManualStatus && statusEl.style.display !== "none" ? lastManualStatus : null
    };
    const apply = (fields, dx, list) => {
      for (const [id, v] of Object.entries(fields)) { const el = $("#" + id); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); }
      if (dx) dxSel.value = dx; else dxSel.selectedIndex = 0;
      dxSel.dispatchEvent(new Event("change", { bubbles: true }));
      items.length = 0; items.push(...list); renderItems();
    };
    const t0 = todayISO();
    apply({ "jabo-pid": "", "jabo-insurer": "", "jabo-claim": "", "jabo-accident": t0, "jabo-date": t0 }, "", []);
    Store.remove("jabo.draft.items");
    statusEl.style.display = "none"; lastManualStatus = null;
    if (!dirty) { Toast.show({ tag: "jabo", html: esc(t("jabo.newCaseToast")) }); return; }
    Haptic.del();
    Toast.withUndo(t("jabo.newCaseUndo", { who: redactSubject({ pid: snap.fields["jabo-pid"] }), n: snap.items.length }), () => {
      apply(snap.fields, snap.dx, snap.items);
      if (snap.status) manualStatus(snap.status.kind, snap.status.fn);
    }, "jabo");
  });

  $('[data-action="run-jabo-manual"]').addEventListener("click", () => {
    $("#jabo-pid").value = "2026-0142";
    $("#jabo-insurer").value = "DB";
    $("#jabo-claim").value = "DB-2026-0421-1234";
    const accidentDate = new Date(today); accidentDate.setDate(accidentDate.getDate() - 3);
    $("#jabo-accident").value = accidentDate.toISOString().slice(0, 10);
    $("#jabo-date").value = today;
    dxSel.value = "S134";
    items.length = 0;
    const codes = feeRows().slice(0, 6).map(r => r.code); // first six of whatever table is active
    for (const code of codes) { const def = feeByCode(code); if (def) items.push({ code: def.code, name: def.name, unit: def.unit || "회", price: def.price ?? 0, category: def.category || "", qty: 1, paid: def.price ?? 0, cutKey: "" }); }
    if (items[2]) { items[2].qty = 3; items[2].paid = Math.round(items[2].price * 2 / 3); items[2].cutKey = "dup_same_site"; }
    if (items[5]) { items[5].paid = 0; items[5].cutKey = "site_mismatch"; }
    renderItems();
    manualStatus(null, () => t("jabo.statusManualSample"));
  });

  onLangChange(() => {
    buildSelects(); renderFeeBadge();
    if (lastRecon) renderRecon(lastRecon);
    renderSlot("claims"); renderSlot("review");
    if (lastReconStatus) setStatus($("#jabo-recon-status"), lastReconStatus.kind, lastReconStatus.fn());
    renderItems();
    if (lastManualStatus && $("#jabo-status").style.display !== "none") setStatus($("#jabo-status"), lastManualStatus.kind, lastManualStatus.fn());
    if (searchEl.value.trim() && resultsEl.classList.contains("show")) renderSearch(searchEl.value);
  });
}
