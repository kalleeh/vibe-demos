/* clinic-admin — Tab 01 · 상병코드 정비
   입력형 → EDI 표준형 정규화 + 최신 개정판(마스터) 대조. Works against the uploaded
   KOICD 상병마스터 when present (core/masters.js), else the bundled 발췌.
   i18n: result rows carry neutral field names + a `note` [key, vars] so the table, the status line and the
   XLSX headers can be re-rendered in either language from the same `lastResult`. */
import { $, esc, setStatus, todayISO, relTime, bindDrop } from "../core/ui.js";
import { t, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX, headerRow } from "../core/files.js";
import { Masters, toEdi, toDotted } from "../core/masters.js";

export function initTab1(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  let lastResult = null, lastStatus = null;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#kcd-status"), kind, fn()); };

  // 한의 병증 U코드 블록: U20–U33 (사상체질병증), U50–U79 (한의 병증). U80–U89 = WHO AMR, not 한의.
  const isHanuiU = (edi) => /^U(2\d|3[0-3]|[5-7]\d)/.test(edi);
  const isAmrU   = (edi) => /^U8\d/.test(edi);
  const isCodeShape = (edi) => /^[A-Z]\d{2}[A-Z0-9]{0,4}$/.test(edi);

  const pickCol = (row, names) => {
    for (const n of names) if (row[n] != null && String(row[n]).trim() !== "") return String(row[n]).trim();
    return "";
  };
  const hasCol = (rows, names) => rows.some(r => names.some(n => n in r));
  const COL = {
    pid:  ["환자번호", "등록번호", "환자ID"],
    date: ["진료일자", "진료일", "일자", "요양개시일"],
    code: ["KCD코드", "KCD8코드", "상병코드", "상병기호", "진단코드", "코드"],
    dx:   ["진단명", "상병명", "한글명"],
    rank: ["주/부상병", "주부상병", "상병구분", "주부구분", "주상병구분"],
    memo: ["비고"]
  };
  const isMainRank = (v) => /^(주|주상병|1|M|main)$/i.test(String(v).trim());

  const transform = (rows) => {
    const idx = Masters.kcdIndex();
    const src = Masters.kcd();
    const out = [];
    const counters = { clean: 0, normalized: 0, ucode_solo: 0, deduped: 0, missing: 0, invalid: 0 };
    const warnings = [];
    const rankColPresent = hasCol(rows, COL.rank);
    if (!rankColPresent) warnings.push("kcd.warnNoRank");

    // 명세서 = 환자번호 + 진료일자. Collect the codes on each so the U-code rule can be
    // checked against the SAME 명세서, not the patient's whole history.
    const stmts = new Map();
    for (const row of rows) {
      const key = `${pickCol(row, COL.pid)}|${pickCol(row, COL.date)}`;
      const edi = toEdi(pickCol(row, COL.code));
      if (!stmts.has(key)) stmts.set(key, { codes: [], main: null, firstNonU: null });
      const s = stmts.get(key);
      s.codes.push(edi);
      if (rankColPresent && isMainRank(pickCol(row, COL.rank)) && !s.main) s.main = edi;
      if (!s.firstNonU && edi && !/^U/.test(edi)) s.firstNonU = edi;
    }

    const seen = new Set();
    for (const row of rows) {
      const pid = pickCol(row, COL.pid), date = pickCol(row, COL.date);
      const codeRaw = pickCol(row, COL.code), dx = pickCol(row, COL.dx), memo = pickCol(row, COL.memo);
      const rank = rankColPresent ? pickCol(row, COL.rank) : "";
      const edi = toEdi(codeRaw);
      const stmt = stmts.get(`${pid}|${date}`);
      // note: [key, vars] → resolved at render/export time
      const push = (verdict, note, kind, std = edi) => out.push({
        pid, date, rank: rank || (stmt?.firstNonU === edi ? t("kcd.rankMainGuess") : ""), rankGuess: !rank && stmt?.firstNonU === edi, dx,
        input: codeRaw, std, verdict, memo, note, kind
      });

      if (!edi || !isCodeShape(edi)) { counters.invalid++; push("invalid", ["kcd.noteInvalidShape"], "err", codeRaw); continue; }

      const dedupKey = `${pid}|${date}|${edi}`;
      if (seen.has(dedupKey)) { counters.deduped++; push("deduped", ["kcd.noteDedup"], "warn"); continue; }
      seen.add(dedupKey);

      if (isAmrU(edi)) { counters.invalid++; push("invalid", ["kcd.noteAmr"], "err"); continue; }

      const hit = idx.get(edi);
      if (isHanuiU(edi)) {
        // Must ride with a non-U 주상병 on the same 명세서.
        const main = rankColPresent ? stmt.main : stmt.firstNonU;
        const mainOk = main && !/^U/.test(main);
        if (!mainOk) {
          counters.ucode_solo++;
          push("ucode_solo", [rankColPresent && stmt.main && /^U/.test(stmt.main) ? "kcd.noteUSoloMain" : "kcd.noteUSolo"], "warn");
          continue;
        }
        const note = [hit ? "kcd.noteUOk" : "kcd.noteUNoMaster", { main: toDotted(main) }];
        if (codeRaw !== edi) { counters.normalized++; push("normalized", ["kcd.noteNormalized", { note }], "ok"); }
        else { counters.clean++; push("clean", note, "ok"); }
        continue;
      }

      if (!hit) {
        counters.missing++;
        push("missing", [src.source === "master" ? "kcd.noteMissingMaster" : "kcd.noteMissingBundled"], "err");
        continue;
      }
      if (hit.complete === false) { counters.missing++; push("missing", ["kcd.noteIncomplete"], "err"); continue; }
      if (codeRaw !== edi) { counters.normalized++; push("normalized", ["kcd.noteNormalizedCurrent"], "ok"); }
      else { counters.clean++; push("clean", ["kcd.noteClean"], "ok"); }
    }
    return { rows: out, counters, warnings, source: src };
  };
  // Resolve a [key, vars] note (vars may themselves hold a nested note under `note`).
  const noteText = (n) => {
    if (!n) return "";
    const [key, vars] = n;
    const v = vars && vars.note ? { ...vars, note: noteText(vars.note) } : vars;
    return t(key, v);
  };
  const rowNote = (r) => (r.memo ? r.memo + " · " : "") + noteText(r.note);
  const rankText = (r) => r.rankGuess ? t("kcd.rankMainGuess") : r.rank;
  const verdictLabel = (v) => t("kcd.verdict." + v);
  const CLS = { clean: "ok", normalized: "ok", ucode_solo: "warn", deduped: "warn", missing: "err", invalid: "err" };

  const renderResult = (result) => {
    const { rows, counters, warnings } = result;
    const okCount = counters.clean + counters.normalized;
    const reviewCount = counters.ucode_solo + counters.deduped;
    const errCount = counters.missing + counters.invalid;
    $("#kcd-summary").innerHTML = t("kcd.summary", { n: rows.length, ok: okCount, rv: reviewCount, err: errCount });
    $("#kcd-toolbar").style.display = "flex";
    $("#kcd-download").disabled = false;

    const warnHtml = warnings.length ? `<div class="kcd-warnings">${warnings.map(w => `<div>⚠ ${esc(t(w))}</div>`).join("")}</div>` : "";
    $("#kcd-result").innerHTML = warnHtml + `
      <table>
        <thead><tr>
          <th>${esc(t("kcd.thPid"))}</th><th>${esc(t("kcd.thDate"))}</th><th>${esc(t("kcd.thRank"))}</th><th>${esc(t("kcd.thDx"))}</th>
          <th class="code">${esc(t("kcd.thInput"))}</th><th class="code">${esc(t("kcd.thEdi"))}</th><th>${esc(t("common.thResult"))}</th><th>${esc(t("common.thNote"))}</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => {
            const label = verdictLabel(r.verdict), cls = CLS[r.verdict] || "ok";
            const searchable = r.verdict === "missing";
            const labelCell = searchable
              ? `<td><button type="button" class="pill ${cls}" data-search="${esc(r.input || r.dx)}" title="${esc(t("kcd.searchTitle"))}">${esc(label)} →</button></td>`
              : `<td><span class="pill ${cls}">${esc(label)}</span></td>`;
            return `<tr>
              <td>${esc(r.pid)}</td><td class="code">${esc(r.date)}</td><td>${esc(rankText(r)) || "—"}</td>
              <td>${esc(r.dx) || "—"}</td>
              <td class="code">${esc(r.input) || "—"}</td><td class="code">${esc(r.std) || "—"}</td>
              ${labelCell}<td>${esc(rowNote(r))}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
    $("#kcd-result").querySelectorAll("button[data-search]").forEach(btn => {
      btn.style.cursor = "pointer";
      btn.addEventListener("click", () => {
        const q = btn.getAttribute("data-search");
        EventBus.emit("search:query", q);
        ActivityLog.push("kcd", t("kcd.logSearch", { q }), {});
      });
    });
  };

  const persistKcd = (result) => {
    Store.set("kcd.lastSummary", {
      total: result.rows.length,
      ok: result.counters.clean + result.counters.normalized,
      review: result.counters.ucode_solo + result.counters.deduped,
      missing: result.counters.missing + result.counters.invalid,
      missingCodes: result.rows.filter(r => r.verdict === "missing").map(r => r.input).slice(0, 50),
      at: Date.now()
    });
  };

  const run = (rows, statusFn, meta) => {
    const result = transform(rows);
    lastResult = result;
    renderResult(result);
    persistKcd(result);
    ActivityLog.push("kcd", t("kcd.logRun", { n: result.rows.length }), meta);
    status(null, () => statusFn(result));
  };

  bindDrop("drop-kcd", async (file) => {
    try {
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const rows = await readSpreadsheet(file);
      if (!rows.length) { status("warn", () => t("common.statusEmptyFile")); return; }
      run(rows, r => t("kcd.statusDone", { n: r.rows.length }), { rows: rows.length });
    } catch (err) {
      console.error(err);
      status("err", () => t("common.statusReadFail"));
    }
  });

  $("#kcd-download").addEventListener("click", () => {
    if (!lastResult) return;
    // downloadXLSX stamps the PoC watermark row + _PoC filename itself. Headers follow the UI language.
    const rows = lastResult.rows.map(r => headerRow([
      ["kcd.col.pid", r.pid], ["kcd.col.date", r.date], ["kcd.col.rank", rankText(r)], ["kcd.col.dx", r.dx],
      ["kcd.col.input", r.input], ["kcd.col.std", r.std], ["kcd.col.verdict", verdictLabel(r.verdict)], ["kcd.col.note", rowNote(r)]
    ]));
    downloadXLSX(rows, t("kcd.fileSheet", { date: todayISO() }), t("kcd.sheetName"));
    ActivityLog.push("kcd", t("kcd.logDownload", { n: lastResult.rows.length }), {});
  });

  // Sample rows carry a 주/부상병 column so the per-명세서 U-code rule is exercised.
  // Column headers are the Korean EMR-export names the parser expects (data, not UI copy).
  const sampleKcdData = [
    { 환자번호: "P-2025-0042", 진료일자: "2025-12-10", "주/부상병": "주", 진단명: "요통",             KCD코드: "M54.5",  비고: "" },
    { 환자번호: "P-2025-0042", 진료일자: "2025-12-10", "주/부상병": "부", 진단명: "요통",             KCD코드: "M54.5",  비고: "이중 입력" },
    { 환자번호: "P-2025-0042", 진료일자: "2025-12-10", "주/부상병": "부", 진단명: "한의 병증 (예시)",  KCD코드: "U60.0",  비고: "예시 U코드 — 주상병 동반" },
    { 환자번호: "P-2025-0042", 진료일자: "2025-12-12", "주/부상병": "주", 진단명: "경부통",           KCD코드: "M542",   비고: "" },
    { 환자번호: "P-2025-0085", 진료일자: "2025-12-15", "주/부상병": "주", 진단명: "어깨의 유착성 관절낭염", KCD코드: "M75.0", 비고: "" },
    { 환자번호: "P-2025-0085", 진료일자: "2025-12-17", "주/부상병": "주", 진단명: "긴장형 두통",       KCD코드: "G44.20", 비고: "5자리 입력" },
    { 환자번호: "P-2025-0091", 진료일자: "2025-12-20", "주/부상병": "주", 진단명: "요추 염좌",         KCD코드: "S33.5",  비고: "교통사고" },
    { 환자번호: "P-2025-0091", 진료일자: "2025-12-20", "주/부상병": "부", 진단명: "경추 염좌",         KCD코드: "S13.4",  비고: "교통사고" },
    { 환자번호: "P-2025-0103", 진료일자: "2025-12-23", "주/부상병": "주", 진단명: "위염, 상세불명",     KCD코드: "K29.7",  비고: "" },
    { 환자번호: "P-2025-0117", 진료일자: "2025-12-26", "주/부상병": "주", 진단명: "한의 병증 (예시)",  KCD코드: "U68.0",  비고: "예시 U코드 — 단독" }
  ];

  $('[data-action="sample-kcd"]').addEventListener("click", (e) => {
    e.stopPropagation();
    downloadXLSX(sampleKcdData, t("kcd.sampleFile"), t("common.sampleSheet"));
  });

  $('[data-action="run-kcd"]').addEventListener("click", () => {
    status(null, () => t("kcd.statusSampleRunning", { n: sampleKcdData.length }));
    run(sampleKcdData, r => t("kcd.statusSampleDone", { n: r.rows.length }), { sample: true });
  });

  // 기준일 + master source banner
  const renderBanner = () => {
    const src = Masters.kcd();
    const rev = DATA.kcd?.revision || {};
    const el = $("#kcd-master-badge");
    if (!el) return;
    el.innerHTML = `<span class="src-pill ${src.source === "master" ? "master" : "demo"}">${esc(src.label)}</span>
      <span class="basis">${t("kcd.banner", { date: esc(src.source === "master" ? src.date : DATA.kcd?.basis_date || "—"), rev: esc(rev.current || "KCD"), eff: esc(rev.effective_date || "") })}</span>`;
  };
  renderBanner();
  Masters.onChange(renderBanner);

  const lastKcd = Store.get("kcd.lastSummary");
  if (lastKcd) status(null, () => t("kcd.statusLast", { t: relTime(lastKcd.at), n: lastKcd.total, m: lastKcd.missing }));

  onLangChange(() => {
    renderBanner();
    if (lastResult) renderResult(lastResult);
    if (lastStatus) setStatus($("#kcd-status"), lastStatus.kind, lastStatus.fn());
  });
}
