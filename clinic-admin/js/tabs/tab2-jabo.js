/* clinic-admin — Tab 02 · 자보 심사결과 정산
   Primary path: file-based reconciliation — 청구 명세서 export ⨝ 심평원 심사결과통보
   (join 명세서번호 + 행위코드) → per-line 청구 vs 인정 delta, grouped by 조정사유 and month.
   Secondary path: manual single-case entry (kept from the earlier build, focus-loss fixed). */
import { $, esc, fmtKRW, todayISO, fuzzyMatch, setStatus, debounce, bindDrop, Haptic, Toast } from "../core/ui.js";
import { Store, ActivityLog, bindPersist } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, loadJSON } from "../core/files.js";
import { Masters } from "../core/masters.js";

// TODO(coordinator): replace with `import { redactSubject } from "../core/dom.js"` once the
// security agent lands it. Same signature: ({name,pid}) → display string with no name.
const redactSubject = ({ pid } = {}) => {
  const p = String(pid || "").trim();
  return p ? `환자 ****${p.slice(-4)}` : "환자";
};
// TODO(coordinator): replace with `import { pocWatermark } from "../core/files.js"`.
const pocWatermark = (rows) => {
  if (!rows.length) return rows;
  const blank = Object.fromEntries(Object.keys(rows[0]).map(k => [k, ""]));
  const first = Object.keys(rows[0])[0];
  return [...rows, { ...blank, [first]: `※ PoC 데모 출력 — 실제 이의제기·제출용 문서가 아닙니다 (생성 ${todayISO()})` }];
};

export function initTab2(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  const REASONS = DATA.jabo.adjustment_reasons || [];
  const reasonLabel = (key, fallback) => REASONS.find(r => r.key === key)?.label || fallback || (key ? String(key) : "");

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
  let lastRecon = null;

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
      const rtxt = r ? (pickCol(r, REVIEW_COL.rtxt) || reasonLabel(rkey)) : "";
      const status = !r ? "none" : delta <= 0 ? "full" : approved === 0 ? "cut_all" : "cut_part";
      if (r) matched.add(key);
      lines.push({
        stmt, pid: pickCol(c, CLAIM_COL.pid), date: pickCol(c, CLAIM_COL.date), code, name: pickCol(c, CLAIM_COL.name),
        qty, claimed, approvedQty: r ? num(pickCol(r, REVIEW_COL.qty)) : null, approved, delta, status,
        reasonKey: rkey, reason: delta > 0 ? (rtxt || "사유 미기재") : ""
      });
    }
    const orphans = review.filter(r => !matched.has(`${pickCol(r, REVIEW_COL.stmt)}|${pickCol(r, REVIEW_COL.code)}`)).map(r => ({
      stmt: pickCol(r, REVIEW_COL.stmt), code: pickCol(r, REVIEW_COL.code), approved: num(pickCol(r, REVIEW_COL.amt)), reason: pickCol(r, REVIEW_COL.rtxt)
    }));
    const totals = lines.reduce((a, l) => { a.claimed += l.claimed; if (l.approved != null) { a.approved += l.approved; a.reviewed += l.claimed; } a.cut += Math.max(0, l.delta); return a; }, { claimed: 0, approved: 0, reviewed: 0, cut: 0 });
    const byReason = new Map();
    for (const l of lines) if (l.delta > 0) {
      const k = l.reason || "사유 미기재";
      if (!byReason.has(k)) byReason.set(k, { reason: k, lines: 0, cut: 0 });
      const g = byReason.get(k); g.lines++; g.cut += l.delta;
    }
    const byMonth = new Map();
    for (const l of lines) {
      const m = (l.date || "").slice(0, 7) || "—";
      if (!byMonth.has(m)) byMonth.set(m, { month: m, claimed: 0, approved: 0, cut: 0, lines: 0, unreviewed: 0 });
      const g = byMonth.get(m); g.lines++; g.claimed += l.claimed;
      if (l.approved == null) g.unreviewed++; else { g.approved += l.approved; g.cut += Math.max(0, l.delta); }
    }
    const stmts = new Set(lines.map(l => l.stmt)).size;
    return {
      lines, orphans, totals, stmts,
      byReason: [...byReason.values()].sort((a, b) => b.cut - a.cut),
      byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
    };
  };

  const STATUS = { full: ["전액 인정", "ok"], cut_part: ["일부 조정", "warn"], cut_all: ["전액 조정", "err"], none: ["심사결과 없음", "info"] };

  const renderRecon = (res) => {
    const { lines, orphans, totals, byReason, byMonth, stmts } = res;
    const rate = totals.reviewed ? Math.round((totals.cut / totals.reviewed) * 1000) / 10 : 0;
    $("#jabo-recon-toolbar").style.display = "flex";
    $("#jabo-recon-download").disabled = false;
    $("#jabo-recon-summary").innerHTML =
      `명세서 <strong>${stmts}건</strong> · 행위 <strong>${lines.length}줄</strong> · 청구 <strong>${fmtKRW(totals.claimed)}원</strong> · 인정 <strong>${fmtKRW(totals.approved)}원</strong> · 조정 <strong>${fmtKRW(totals.cut)}원</strong> (${rate}%)`;

    const groups = `
      <div class="recon-groups">
        <div class="recon-group">
          <h5>조정사유별 <span>(예시 분류)</span></h5>
          ${byReason.length ? `<table><thead><tr><th>조정사유</th><th class="code">줄</th><th class="code">조정액</th></tr></thead><tbody>
            ${byReason.map(g => `<tr><td>${esc(g.reason)}</td><td class="code" style="text-align:right">${g.lines}</td><td class="code" style="text-align:right; color:var(--accent)">−${fmtKRW(g.cut)}</td></tr>`).join("")}
          </tbody></table>` : `<div class="empty-state small">조정 없음</div>`}
        </div>
        <div class="recon-group">
          <h5>월별</h5>
          <table><thead><tr><th>월</th><th class="code">청구</th><th class="code">인정</th><th class="code">조정</th><th class="code">조정률</th></tr></thead><tbody>
            ${byMonth.map(g => {
              const rv = g.claimed ? Math.round((g.cut / g.claimed) * 1000) / 10 : 0;
              return `<tr><td class="code">${esc(g.month)}${g.unreviewed ? ` <span class="pill info" title="심사결과 없는 줄">${g.unreviewed}</span>` : ""}</td>
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
          <th class="code">명세서</th><th>환자번호</th><th class="code">진료일자</th><th class="code">행위코드</th><th>행위명</th>
          <th class="code">청구</th><th class="code">인정</th><th class="code">차액</th><th>결과</th><th>조정사유</th>
        </tr></thead>
        <tbody>
          ${lines.map(l => {
            const [label, cls] = STATUS[l.status];
            return `<tr>
              <td class="code">${esc(l.stmt)}</td><td>${esc(l.pid) || "—"}</td><td class="code">${esc(l.date)}</td>
              <td class="code">${esc(l.code)}</td><td>${esc(l.name) || "—"}</td>
              <td class="code" style="text-align:right">${fmtKRW(l.claimed)}<span class="qty-mini">×${l.qty}</span></td>
              <td class="code" style="text-align:right">${l.approved == null ? "—" : fmtKRW(l.approved) + `<span class="qty-mini">×${l.approvedQty}</span>`}</td>
              <td class="code" style="text-align:right${l.delta > 0 ? "; color:var(--accent); font-weight:600" : ""}">${l.delta > 0 ? "−" + fmtKRW(l.delta) : l.approved == null ? "—" : "0"}</td>
              <td><span class="pill ${cls}">${label}</span></td>
              <td style="font-size:11px; color:var(--ink-2)">${esc(l.reason) || "—"}</td>
            </tr>`;
          }).join("")}
          ${orphans.map(o => `<tr class="orphan">
              <td class="code">${esc(o.stmt)}</td><td>—</td><td>—</td><td class="code">${esc(o.code)}</td><td><em>청구 명세서에 없는 심사 줄</em></td>
              <td>—</td><td class="code" style="text-align:right">${fmtKRW(o.approved)}</td><td>—</td><td><span class="pill warn">대조 불가</span></td><td style="font-size:11px">${esc(o.reason) || "—"}</td>
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
    ActivityLog.push("jabo", `자보 심사결과 대조 — 명세서 ${res.stmts}건 · 조정 ${fmtKRW(res.totals.cut)}원`, meta);
    const unreviewed = res.lines.filter(l => l.status === "none").length;
    setStatus($("#jabo-recon-status"), unreviewed ? "warn" : null,
      `${res.lines.length}줄 대조 완료 — 조정 ${res.byReason.length}개 사유 · ${fmtKRW(res.totals.cut)}원.` +
      (unreviewed ? ` 심사결과가 없는 줄 ${unreviewed}건은 통보서 누락 여부를 확인하세요.` : "") +
      ` 이의제기는 심평원(HIRA)에 합니다.`);
  };

  const fileSlot = (kind, file, rows) => {
    files[kind] = { name: file.name, rows };
    const el = $(`#jabo-file-${kind}`);
    el.innerHTML = `<span class="pill ok">읽음</span> ${esc(file.name)} · ${rows.length}행`;
    if (files.claims && files.review) runRecon(files.claims.rows, files.review.rows, { claims: files.claims.rows.length, review: files.review.rows.length });
    else setStatus($("#jabo-recon-status"), null, `${kind === "claims" ? "청구 명세서" : "심사결과"} 파일을 읽었습니다 — ${kind === "claims" ? "심사결과" : "청구 명세서"} 파일도 올리면 자동으로 대조합니다.`);
  };
  for (const kind of ["claims", "review"]) {
    bindDrop(`drop-jabo-${kind}`, async (file) => {
      try {
        const rows = await readSpreadsheet(file);
        if (!rows.length) { setStatus($("#jabo-recon-status"), "warn", "빈 파일이거나 데이터를 찾지 못했습니다."); return; }
        fileSlot(kind, file, rows);
      } catch (err) {
        console.error(err);
        setStatus($("#jabo-recon-status"), "err", "파일을 읽지 못했습니다 — 형식 확인 필요.");
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
    downloadXLSX(s.claims, "샘플_자보_청구명세서_예시.xlsx", "청구명세서(예시)");
  });
  $('[data-action="sample-jabo-review"]').addEventListener("click", async (e) => {
    e.stopPropagation();
    const s = await loadSamples();
    downloadXLSX(s.review, "샘플_자보_심사결과_예시.xlsx", "심사결과(예시)");
  });
  $('[data-action="run-jabo"]').addEventListener("click", async () => {
    setStatus($("#jabo-recon-status"), null, "샘플 명세서·심사결과 불러오는 중…");
    try {
      const s = await loadSamples();
      files.claims = { name: "샘플_청구명세서(예시)", rows: s.claims };
      files.review = { name: "샘플_심사결과(예시)", rows: s.review };
      $("#jabo-file-claims").innerHTML = `<span class="pill ok">샘플</span> 청구 명세서(예시) · ${s.claims.length}행`;
      $("#jabo-file-review").innerHTML = `<span class="pill ok">샘플</span> 심사결과통보(예시) · ${s.review.length}행`;
      runRecon(s.claims, s.review, { sample: true });
    } catch (err) {
      console.error(err);
      setStatus($("#jabo-recon-status"), "err", "샘플 파일을 불러오지 못했습니다.");
    }
  });

  $("#jabo-recon-download").addEventListener("click", () => {
    if (!lastRecon) return;
    const rows = lastRecon.lines.map(l => ({
      "명세서번호": l.stmt, "환자번호": l.pid, "진료일자": l.date, "행위코드": l.code, "행위명": l.name,
      "청구횟수": l.qty, "청구금액": l.claimed, "인정횟수": l.approvedQty ?? "", "인정금액": l.approved ?? "",
      "차액": l.approved == null ? "" : l.delta, "결과": STATUS[l.status][0], "조정사유": l.reason
    }));
    for (const o of lastRecon.orphans) rows.push({ "명세서번호": o.stmt, "환자번호": "", "진료일자": "", "행위코드": o.code, "행위명": "청구 명세서에 없는 심사 줄", "청구횟수": "", "청구금액": "", "인정횟수": "", "인정금액": o.approved, "차액": "", "결과": "대조 불가", "조정사유": o.reason });
    rows.push({ "명세서번호": "", "환자번호": "", "진료일자": "", "행위코드": "", "행위명": "합계", "청구횟수": "", "청구금액": lastRecon.totals.claimed, "인정횟수": "", "인정금액": lastRecon.totals.approved, "차액": lastRecon.totals.cut, "결과": "", "조정사유": "" });
    for (const g of lastRecon.byReason) rows.push({ "명세서번호": "", "환자번호": "", "진료일자": "", "행위코드": "", "행위명": "사유별 · " + g.reason, "청구횟수": "", "청구금액": "", "인정횟수": "", "인정금액": "", "차액": g.cut, "결과": `${g.lines}줄`, "조정사유": "" });
    downloadXLSX(pocWatermark(rows), `자보_심사결과_대조표_${todayISO()}.xlsx`, "자보 심사결과 대조표");
    ActivityLog.push("jabo", `자보 대조표 내려받음 (${lastRecon.lines.length}줄)`, {});
  });

  /* ───────────── Secondary: manual single-case entry ───────────── */
  const items = []; // {code, name, qty, unit, price, category, paid, cutKey}
  const dxSel = $("#jabo-dx");
  DATA.jabo.diagnosis_examples.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.code; opt.textContent = `${d.code} · ${d.name}`;
    dxSel.appendChild(opt);
  });
  const insSel = $("#jabo-insurer");
  (DATA.jabo.insurers || []).forEach(i => {
    const opt = document.createElement("option");
    opt.value = i.value; opt.textContent = i.type === "공제조합" ? `${i.label} (공제조합)` : i.label;
    insSel.appendChild(opt);
  });

  const feeRows = () => Masters.fee().rows;
  const feeByCode = (code) => feeRows().find(i => i.code === code);
  const renderFeeBadge = () => {
    const f = Masters.fee();
    const el = $("#jabo-fee-badge");
    if (el) el.innerHTML = `<span class="src-pill ${f.source === "master" ? "master" : "demo"}">${esc(f.label)}</span>` +
      (f.source === "bundled" ? ` <span class="basis">${esc(DATA.jabo.table_label || "")}</span>` : "");
  };
  renderFeeBadge();
  Masters.onChange(renderFeeBadge);

  const searchEl = $("#jabo-search");
  const resultsEl = $("#jabo-search-results");
  const renderSearch = (query) => {
    if (!query.trim()) { resultsEl.classList.remove("show"); resultsEl.innerHTML = ""; return; }
    const matches = feeRows().filter(i =>
      fuzzyMatch(i.name || "", query) || String(i.code).includes(query) || fuzzyMatch(i.category || "", query)
    ).slice(0, 12);
    if (!matches.length) {
      resultsEl.innerHTML = `<div class="search-opt"><span></span><span style="color: var(--muted); font-style: italic;">검색 결과 없음</span><span></span></div>`;
      resultsEl.classList.add("show");
      return;
    }
    resultsEl.innerHTML = matches.map(m => `
      <div class="search-opt" data-code="${esc(m.code)}">
        <span class="code-tag">${esc(m.code)}</span>
        <span><span style="color: var(--ink-2)">${esc(m.name)}</span> <span style="color: var(--faint); font-size: 11px; margin-left: 6px;">${esc(m.category || "")}</span></span>
        <span class="price-mini">${m.price == null ? "단가 미입력" : fmtKRW(m.price) + " / " + esc(m.unit || "회")}</span>
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
  const reasonOpts = (sel) => [`<option value="">— 조정 없음 —</option>`, ...REASONS.map(r => `<option value="${r.key}"${r.key === sel ? " selected" : ""}>${esc(r.label)}</option>`)].join("");

  const rowHTML = (it, i) => {
    const { claimed, cut } = lineOf(it);
    return `
      <div class="item-row recon" data-i="${i}">
        <span class="code-tag">${esc(it.code)}</span>
        <span class="name">${esc(it.name)} <span style="color: var(--faint); font-size: 11px; margin-left: 4px;">${esc(it.category)}</span></span>
        <input type="number" class="qty" min="1" max="999" value="${it.qty}" data-i="${i}" aria-label="횟수" title="횟수">
        <span class="price-display claimed">청구 ${fmtKRW(claimed)}</span>
        <input type="number" class="paid-unit" min="0" value="${it.paid}" data-i="${i}" aria-label="인정단가" title="인정 단가 (심사결과통보서 기준)" placeholder="${it.price}">
        <span class="price-display cut ${cut > 0 ? "warn" : "ok"}">${cut > 0 ? "−" + fmtKRW(cut) : "0"}</span>
        <select class="cut-reason" data-i="${i}" title="조정 사유 (예시 분류)">${reasonOpts(it.cutKey)}</select>
        <button class="remove-btn" data-i="${i}" aria-label="삭제">×</button>
      </div>`;
  };

  // In-place update — never rebuilds the row while the admin is typing in it.
  const refreshRow = (i) => {
    const row = $(`#jabo-items .item-row[data-i="${i}"]`);
    if (!row) return;
    const { claimed, cut } = lineOf(items[i]);
    row.querySelector(".claimed").textContent = `청구 ${fmtKRW(claimed)}`;
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
    $("#jabo-summary").innerHTML =
      `<strong>${items.length}건</strong> 행위 · 청구 <strong>${fmtKRW(totals.claimed)}원</strong> · 인정 <strong>${fmtKRW(totals.paid)}원</strong> · 조정률 <strong>${cutPct}%</strong>`;
    $("#jabo-download").disabled = items.length === 0;
    if (!items.length) {
      $("#jabo-preview").innerHTML = `<div class="empty-state">행위와 인정금액을 입력하면 정산표가 표시됩니다.</div>`;
    } else {
      $("#jabo-preview").innerHTML = `
        <table>
          <thead><tr>
            <th class="code">코드</th><th>행위명</th><th class="code">단가</th><th class="code">횟수</th>
            <th class="code">청구액</th><th class="code">인정액</th><th class="code">조정</th><th>조정사유</th>
          </tr></thead>
          <tbody>
            ${items.map(it => {
              const { claimed, paid, cut } = lineOf(it);
              return `<tr>
                <td class="code">${esc(it.code)}</td><td>${esc(it.name)}</td>
                <td class="code" style="text-align:right">${fmtKRW(it.price)}</td><td class="code" style="text-align:right">${it.qty}</td>
                <td class="code" style="text-align:right">${fmtKRW(claimed)}</td><td class="code" style="text-align:right">${fmtKRW(paid)}</td>
                <td class="code" style="text-align:right${cut > 0 ? "; color:var(--accent); font-weight:600" : ""}">${cut > 0 ? "−" + fmtKRW(cut) : "0"}</td>
                <td style="font-size: 11px; color: var(--ink-2)">${cut > 0 ? esc(reasonLabel(it.cutKey, "사유 미입력")) : "—"}</td>
              </tr>`;
            }).join("")}
            <tr style="background: var(--paper-2); font-weight: 600">
              <td colspan="4" style="text-align:right">합계</td>
              <td class="code" style="text-align:right">${fmtKRW(totals.claimed)}</td><td class="code" style="text-align:right">${fmtKRW(totals.paid)}</td>
              <td class="code" style="text-align:right; color:var(--accent)">${cutTotal > 0 ? "−" + fmtKRW(cutTotal) : "0"}</td><td>조정률 ${cutPct}%</td>
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
      list.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--muted); font-family: 'Fraunces', serif; font-style: italic; font-size: 14px;">아직 추가된 행위가 없습니다.</div>`;
    } else {
      list.innerHTML = items.map(rowHTML).join("");
    }
    refreshTotals();
  };

  // One delegated listener set — rows are updated in place, so focus survives every keystroke.
  const itemsEl = $("#jabo-items");
  itemsEl.addEventListener("input", (e) => {
    const t = e.target; const i = +t.dataset.i;
    if (!(i in items)) return;
    if (t.classList.contains("qty")) items[i].qty = Math.max(1, +t.value || 1);
    else if (t.classList.contains("paid-unit")) items[i].paid = Math.max(0, +t.value || 0);
    else return;
    refreshRow(i); refreshTotals();
  });
  itemsEl.addEventListener("change", (e) => {
    const t = e.target; const i = +t.dataset.i;
    if (!(i in items)) return;
    if (t.classList.contains("cut-reason")) { items[i].cutKey = t.value; refreshTotals(); }
    else if (t.classList.contains("qty") && (+t.value || 0) < 1) { t.value = 1; items[i].qty = 1; refreshRow(i); refreshTotals(); }
  });
  itemsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-btn");
    if (!btn) return;
    const i = +btn.dataset.i;
    const [removed] = items.splice(i, 1);
    renderItems();
    Haptic.del();
    Toast.withUndo(`삭제됨 · ${removed.name}`, () => { items.splice(Math.min(i, items.length), 0, removed); renderItems(); }, "jabo");
  });

  searchEl.addEventListener("input", e => renderSearch(e.target.value));
  searchEl.addEventListener("focus", e => renderSearch(e.target.value));
  document.addEventListener("click", e => { if (!e.target.closest(".item-search")) resultsEl.classList.remove("show"); });

  $("#jabo-download").addEventListener("click", () => {
    const pid = $("#jabo-pid").value.trim() || "—";
    const insurer = $("#jabo-insurer").value || "—";
    const claimNo = $("#jabo-claim").value.trim() || "—";
    const accident = $("#jabo-accident").value || "—";
    const date = $("#jabo-date").value || todayISO();
    const dx = dxSel.value;
    const dxName = DATA.jabo.diagnosis_examples.find(d => d.code === dx)?.name || "";
    const { totals, cutTotal } = refreshTotals();

    // History + activity carry 환자번호 + totals only — no name, no claim number.
    const history = Store.get("jabo.history", []);
    history.unshift({ at: Date.now(), kind: "manual", pid, insurer, date, claimed: totals.claimed, paid: totals.paid, cut: cutTotal, itemCount: items.length });
    Store.set("jabo.history", history.slice(0, 100));
    ActivityLog.push("jabo", `자보 정산표 — ${redactSubject({ pid })} · ${insurer} · 청구 ${fmtKRW(totals.claimed)}원 · 조정 ${fmtKRW(cutTotal)}원`, { insurer });
    Haptic.save();

    const rows = items.map(it => {
      const { claimed, paid, cut } = lineOf(it);
      return {
        "환자번호": pid, "보험사/공제": insurer, "접수번호": claimNo, "사고일자": accident, "진료일자": date,
        "주상병코드": dx, "주상병명": dxName, "행위코드": it.code, "행위명": it.name, "분류": it.category,
        "단가": it.price, "단위": it.unit, "횟수": it.qty, "청구액": claimed, "인정액": paid, "조정액": cut,
        "조정사유": cut > 0 ? reasonLabel(it.cutKey, "사유 미입력") : ""
      };
    });
    rows.push({ "환자번호": "", "보험사/공제": "", "접수번호": "", "사고일자": "", "진료일자": "", "주상병코드": "", "주상병명": "", "행위코드": "", "행위명": "합계", "분류": "", "단가": "", "단위": "", "횟수": "", "청구액": totals.claimed, "인정액": totals.paid, "조정액": cutTotal, "조정사유": "" });
    downloadXLSX(pocWatermark(rows), `자보정산_${pid}_${date}.xlsx`, "자보 정산(수기)");
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

  $("#jabo-new").addEventListener("click", () => {
    const FIELDS = ["jabo-pid", "jabo-insurer", "jabo-claim", "jabo-accident", "jabo-date"];
    const dirty = items.length > 0 || ["jabo-pid", "jabo-claim"].some(id => $("#" + id).value.trim());
    const statusEl = $("#jabo-status");
    const snap = {
      fields: Object.fromEntries(FIELDS.map(id => [id, $("#" + id).value])), dx: dxSel.value,
      items: items.map(it => ({ ...it })), status: statusEl.style.display !== "none" ? statusEl.innerHTML : null
    };
    const apply = (fields, dx, list) => {
      for (const [id, v] of Object.entries(fields)) { const el = $("#" + id); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); }
      if (dx) dxSel.value = dx; else dxSel.selectedIndex = 0;
      dxSel.dispatchEvent(new Event("change", { bubbles: true }));
      items.length = 0; items.push(...list); renderItems();
    };
    const t = todayISO();
    apply({ "jabo-pid": "", "jabo-insurer": "", "jabo-claim": "", "jabo-accident": t, "jabo-date": t }, "", []);
    Store.remove("jabo.draft.items");
    statusEl.style.display = "none";
    if (!dirty) { Toast.show({ tag: "jabo", html: "새 케이스 — 입력을 비웠습니다." }); return; }
    Haptic.del();
    Toast.withUndo(`새 케이스 — 이전 케이스(${redactSubject({ pid: snap.fields["jabo-pid"] })} · 행위 ${snap.items.length}건)를 비웠습니다`, () => {
      apply(snap.fields, snap.dx, snap.items);
      if (snap.status != null) { statusEl.innerHTML = snap.status; statusEl.style.display = "flex"; }
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
    setStatus($("#jabo-status"), null, "수기 샘플 케이스 — 경추 염좌 통원, 심사결과통보의 조정(동일부위 중복·상병-부위 불일치)을 반영한 예시입니다. 행위표는 예시 코드입니다.");
  });
}
