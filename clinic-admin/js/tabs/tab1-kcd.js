/* clinic-admin — Tab 01 · 상병코드 정비
   입력형 → EDI 표준형 정규화 + 최신 개정판(마스터) 대조. Works against the uploaded
   KOICD 상병마스터 when present (core/masters.js), else the bundled 발췌.
   THE CLAIM BATCH IS THE UNIT (tabs/claims-shared.js): the 명세서 export uploaded here or in 02 becomes one
   `claims` batch; this tab cleans its 상병 side. ctx from other tabs: activateTab("tab-kcd", { stmt }) filters the
   result to that 명세서 and highlights it.
   i18n: result rows carry neutral field names + a `note` [key, vars] so the table, the status line and the
   XLSX headers can be re-rendered in either language from the same `lastResult`. */
import { $, esc, setStatus, todayISO, relTime, bindDrop } from "../core/ui.js";
import { t, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { downloadXLSX, headerRow } from "../core/files.js";
import { Masters, toEdi, toDotted } from "../core/masters.js";
import { activateTab } from "../core/nav.js";
import { Patients } from "../core/entities.js";
import { currentClaimsBatch, ingestClaimsFile, kcdRowsOf, renderBatchStrip, onClaimsChange, ensureSampleBatch, loadSampleRows } from "./claims-shared.js";

let seedFn = null;
export function seed() { return seedFn ? seedFn() : Promise.resolve(); }

export function init(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  let lastResult = null, lastStatus = null, lastBatchId = null, focusStmt = null;
  const status = (kind, fn) => { lastStatus = { kind, fn }; setStatus($("#kcd-status"), kind, fn()); };

  // 한의 병증 U코드 블록: U20–U33 (사상체질병증), U50–U79 (한의 병증). U80–U89 = WHO AMR, not 한의.
  const isHanuiU = (edi) => /^U(2\d|3[0-3]|[5-7]\d)/.test(edi);
  const isAmrU   = (edi) => /^U8\d/.test(edi);
  const isCodeShape = (edi) => /^[A-Z]\d{2}[A-Z0-9]{0,4}$/.test(edi);
  const isMainRank = (v) => /^(주|주상병|1|M|main)$/i.test(String(v).trim());

  // rows: kcdRowsOf(batch) → { stmt, pid, date, rank, dx, input, memo }
  const transform = (rows, { hasRank }) => {
    const idx = Masters.kcdIndex();
    const src = Masters.kcd();
    const out = [];
    const counters = { clean: 0, normalized: 0, ucode_solo: 0, deduped: 0, missing: 0, invalid: 0 };
    const warnings = [];
    const rankColPresent = !!hasRank;
    if (!rankColPresent) warnings.push("kcd.warnNoRank");

    // 명세서 = the batch's 명세서번호 (or 환자번호+진료일자 when the file had none). Collect the codes on each
    // so the U-code rule can be checked against the SAME 명세서, not the patient's whole history.
    const stmts = new Map();
    for (const row of rows) {
      const edi = toEdi(row.input);
      if (!stmts.has(row.stmt)) stmts.set(row.stmt, { codes: [], main: null, firstNonU: null });
      const s = stmts.get(row.stmt);
      s.codes.push(edi);
      if (rankColPresent && isMainRank(row.rank) && !s.main) s.main = edi;
      if (!s.firstNonU && edi && !/^U/.test(edi)) s.firstNonU = edi;
    }

    const seen = new Set();
    for (const row of rows) {
      const { stmt: stmtId, pid, date, dx, memo } = row;
      const codeRaw = row.input;
      const rank = rankColPresent ? row.rank : "";
      const edi = toEdi(codeRaw);
      const stmt = stmts.get(stmtId);
      // note: [key, vars] → resolved at render/export time
      const push = (verdict, note, kind, std = edi) => out.push({
        stmt: stmtId, pid, date, rank: rank || (stmt?.firstNonU === edi ? t("kcd.rankMainGuess") : ""), rankGuess: !rank && stmt?.firstNonU === edi, dx,
        input: codeRaw, std, verdict, memo, note, kind
      });

      if (!edi || !isCodeShape(edi)) { counters.invalid++; push("invalid", ["kcd.noteInvalidShape"], "err", codeRaw); continue; }

      const dedupKey = `${stmtId}|${edi}`;
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
  const ASKABLE = new Set(["missing", "ucode_solo", "deduped", "invalid"]);

  const askPrefill = (r) => t("kcd.askPrefill", { dx: r.dx || "—", code: r.input || "—", stmt: r.stmt || "—", who: Patients.alias(r.pid) });

  const renderFilter = () => {
    const el = $("#kcd-filter");
    if (!el) return;
    if (!focusStmt || !lastResult) { el.hidden = true; el.innerHTML = ""; return; }
    const n = lastResult.rows.filter(r => r.stmt === focusStmt).length;
    el.hidden = false;
    el.innerHTML = `<span class="pill info">${esc(t("kcd.focusChip", { stmt: focusStmt, n }))}</span>
      <button type="button" class="ghost" id="kcd-filter-all">${esc(t("kcd.focusAll"))}</button>`;
    $("#kcd-filter-all").addEventListener("click", () => { focusStmt = null; renderResult(lastResult); });
  };

  const renderResult = (result) => {
    const { rows, counters, warnings } = result;
    const okCount = counters.clean + counters.normalized;
    const reviewCount = counters.ucode_solo + counters.deduped;
    const errCount = counters.missing + counters.invalid;
    $("#kcd-summary").innerHTML = t("kcd.summary", { n: rows.length, ok: okCount, rv: reviewCount, err: errCount });
    $("#kcd-toolbar").style.display = "flex";
    $("#kcd-download").disabled = false;
    renderFilter();

    const shown = focusStmt ? rows.filter(r => r.stmt === focusStmt) : rows;
    const warnHtml = warnings.length ? `<div class="kcd-warnings">${warnings.map(w => `<div>⚠ ${esc(t(w))}</div>`).join("")}</div>` : "";
    $("#kcd-result").innerHTML = warnHtml + `
      <table>
        <thead><tr>
          <th class="code">${esc(t("kcd.thStmt"))}</th><th>${esc(t("kcd.thPid"))}</th><th class="code">${esc(t("kcd.thDate"))}</th><th>${esc(t("kcd.thRank"))}</th><th>${esc(t("kcd.thDx"))}</th>
          <th class="code">${esc(t("kcd.thInput"))}</th><th class="code">${esc(t("kcd.thEdi"))}</th><th>${esc(t("common.thResult"))}</th><th>${esc(t("common.thNote"))}</th><th>${esc(t("kcd.thActions"))}</th>
        </tr></thead>
        <tbody>
          ${shown.map(r => {
            const label = verdictLabel(r.verdict), cls = CLS[r.verdict] || "ok";
            const idx = rows.indexOf(r);
            const actions = ASKABLE.has(r.verdict)
              ? `<button type="button" class="row-act" data-ask="${idx}" title="${esc(t("kcd.actAskTitle"))}">${esc(t("kcd.actAsk"))}</button>
                 <button type="button" class="row-act" data-search="${idx}" title="${esc(t("kcd.searchTitle"))}">${esc(t("kcd.actSearch"))}</button>`
              : "";
            return `<tr class="${focusStmt && r.stmt === focusStmt ? "focus" : ""}">
              <td class="code">${esc(r.stmt) || "—"}</td><td>${esc(r.pid)}</td><td class="code">${esc(r.date)}</td><td>${esc(rankText(r)) || "—"}</td>
              <td>${esc(r.dx) || "—"}</td>
              <td class="code">${esc(r.input) || "—"}</td><td class="code">${esc(r.std) || "—"}</td>
              <td><span class="pill ${cls}">${esc(label)}</span></td><td>${esc(rowNote(r))}</td>
              <td class="actions">${actions || "—"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
    $("#kcd-result").querySelectorAll("button[data-search]").forEach(btn => {
      btn.addEventListener("click", () => {
        const r = rows[+btn.dataset.search]; const q = r.input || r.dx;
        ActivityLog.push("kcd", t("kcd.logSearch", { q }), {});
        activateTab("tab-search", { query: q });
      });
    });
    $("#kcd-result").querySelectorAll("button[data-ask]").forEach(btn => {
      btn.addEventListener("click", () => {
        const r = rows[+btn.dataset.ask];
        ActivityLog.push("kcd", t("kcd.logAsk", { code: r.input || "—" }), { pid: r.pid });
        activateTab("tab-ai", { prefill: askPrefill(r), pid: r.pid, stmt: r.stmt });
      });
    });
    if (focusStmt) $("#kcd-result tr.focus")?.scrollIntoView({ block: "nearest" });
  };

  const persistKcd = (result, batchId) => {
    Store.set("kcd.lastSummary", {
      total: result.rows.length,
      ok: result.counters.clean + result.counters.normalized,
      review: result.counters.ucode_solo + result.counters.deduped,
      missing: result.counters.missing + result.counters.invalid,
      missingCodes: result.rows.filter(r => r.verdict === "missing").map(r => r.input).slice(0, 50),
      batchId: batchId || null,
      at: Date.now()
    });
  };

  // Run the cleanup for one batch. silent → restoring on boot / batch switch (no activity entry, no summary write).
  const run = (batch, { statusFn, meta, silent = false } = {}) => {
    if (!batch) return;
    lastBatchId = batch.id;
    if (batch.meta?.partial === "items") {
      lastResult = null; $("#kcd-toolbar").style.display = "none"; renderFilter();
      $("#kcd-result").innerHTML = `<div class="empty-state">${esc(t("kcd.noKcdSide"))}</div>`;
      status("warn", () => t("kcd.noKcdSide"));
      return;
    }
    const result = transform(kcdRowsOf(batch), batch.meta || {});
    lastResult = result;
    renderResult(result);
    if (!silent) {
      persistKcd(result, batch.id);
      ActivityLog.push("kcd", t("kcd.logRun", { n: result.rows.length }), meta || {});
    }
    status(null, () => statusFn ? statusFn(result) : t("kcd.statusBatch", { src: batch.source || "—", n: result.rows.length }));
  };

  const ingest = async (file) => {
    try {
      status(null, () => t("common.statusReading", { name: esc(file.name) }));
      const r = await ingestClaimsFile(file);
      if (r.empty) { status("warn", () => t("common.statusEmptyFile")); return; }
      ActivityLog.push("kcd", t("kcd.logBatch", { src: file.name, n: r.batch.meta.stmts }), { rows: r.batch.rows.length });
      focusStmt = null;
      run(r.batch, { statusFn: (res) => t("kcd.statusDone", { n: res.rows.length }), meta: { rows: r.batch.rows.length } });
    } catch (err) {
      console.error(err);
      status("err", () => t("common.statusReadFail"));
    }
  };
  bindDrop("drop-kcd", ingest);
  const strip = () => renderBatchStrip($("#kcd-batch-strip"), { onFile: ingest });
  strip();

  $("#kcd-download").addEventListener("click", () => {
    if (!lastResult) return;
    // downloadXLSX stamps the PoC watermark row + _PoC filename itself. Headers follow the UI language.
    const rows = lastResult.rows.map(r => headerRow([
      ["kcd.col.stmt", r.stmt], ["kcd.col.pid", r.pid], ["kcd.col.date", r.date], ["kcd.col.rank", rankText(r)], ["kcd.col.dx", r.dx],
      ["kcd.col.input", r.input], ["kcd.col.std", r.std], ["kcd.col.verdict", verdictLabel(r.verdict)], ["kcd.col.note", rowNote(r)]
    ]));
    downloadXLSX(rows, t("kcd.fileSheet", { date: todayISO() }), t("kcd.sheetName"));
    ActivityLog.push("kcd", t("kcd.logDownload", { n: lastResult.rows.length }), {});
  });

  // "샘플 파일 받기" — the 상병 side of the shared 한솔한방병원 명세서 (Korean EMR-export headers the parser expects).
  $('[data-action="sample-kcd"]').addEventListener("click", async (e) => {
    e.stopPropagation();
    const s = await loadSampleRows();
    const rows = s.claims.rows.filter(r => r["상병코드"]).map(r => ({
      명세서번호: r["명세서번호"], 환자번호: r["환자번호"], 진료일자: r["진료일자"], "주/부상병": r["주/부상병"], 진단명: r["진단명"], KCD코드: r["상병코드"], 비고: r["비고"]
    }));
    downloadXLSX(rows, t("kcd.sampleFile"), t("common.sampleSheet"));
  });

  seedFn = async () => {
    status(null, () => t("kcd.statusSampleRunning"));
    try {
      const { claims } = await ensureSampleBatch();
      focusStmt = null;
      run(claims, { statusFn: (r) => t("kcd.statusSampleDone", { n: r.rows.length }), meta: { sample: true } });
    } catch (err) { console.error(err); status("err", () => t("common.statusReadFail")); }
  };
  $('[data-action="run-kcd"]').addEventListener("click", () => { seedFn(); });

  // 기준일 + master source banner (badge → 06 마스터 업로드 section)
  const renderBanner = () => {
    const src = Masters.kcd();
    const rev = DATA.kcd?.revision || {};
    const el = $("#kcd-master-badge");
    if (!el) return;
    el.innerHTML = `<button type="button" class="src-pill clickable ${src.source === "master" ? "master" : "demo"}" data-masters title="${esc(t("search.gotoMastersTitle"))}">${esc(src.label)}</button>
      <span class="basis">${t("kcd.banner", { date: esc(src.source === "master" ? src.date : DATA.kcd?.basis_date || "—"), rev: esc(rev.current || "KCD"), eff: esc(rev.effective_date || "") })}</span>`;
    el.querySelector("[data-masters]").addEventListener("click", () => activateTab("tab-search", { section: "masters" }));
  };
  renderBanner();
  // A silent re-run that keeps the "최근 정비 …" resume line (kcd.lastSummary) when there is one — the batch line is
  // for explicit runs and batch switches. Used on boot and when the master source flips underneath the result.
  const rerunQuietly = (b) => {
    run(b, { silent: true });
    const s = Store.get("kcd.lastSummary");
    if (s) status(null, () => t("kcd.statusLast", { t: relTime(s.at), n: s.total, m: s.missing }));
  };
  Masters.onChange(() => { renderBanner(); const b = currentClaimsBatch(); if (b && lastResult) rerunQuietly(b); });

  // Restore the current batch on boot; follow batch changes made in 02.
  const restore = () => {
    const b = currentClaimsBatch();
    if (b) rerunQuietly(b);
    else { lastResult = null; lastBatchId = null; $("#kcd-toolbar").style.display = "none"; renderFilter(); $("#kcd-result").innerHTML = `<div class="empty-state">${esc(t("kcd.empty"))}</div>`; }
  };
  onClaimsChange((ev) => {
    strip();
    if (ev?.kind === "review") return;
    const b = currentClaimsBatch();
    if (!b) { restore(); return; }
    if (b.id !== lastBatchId || ev?.kind === "remove") { focusStmt = null; run(b, { silent: true }); }
  });
  EventBus.on("store:ui.claimsBatch", () => { const b = currentClaimsBatch(); if (b && b.id !== lastBatchId) { strip(); focusStmt = null; run(b, { silent: true }); } });

  // ctx from 02 (and the palette): { stmt } → filter + highlight that 명세서.
  EventBus.on("tab:activated", (p) => {
    const c = p?.id === "tab-kcd" ? p.ctx : null;
    if (!c) return;
    if (c.stmt) {
      if (!lastResult) { const b = currentClaimsBatch(); if (b) run(b, { silent: true }); }
      if (lastResult) { focusStmt = c.stmt; renderResult(lastResult); }
    }
  });

  const lastKcd = Store.get("kcd.lastSummary");
  if (currentClaimsBatch()) restore();
  else if (lastKcd) status(null, () => t("kcd.statusLast", { t: relTime(lastKcd.at), n: lastKcd.total, m: lastKcd.missing }));
  EventBus.on("session:unlocked", () => { strip(); if (!lastResult) restore(); });

  onLangChange(() => {
    renderBanner(); strip();
    if (lastResult) renderResult(lastResult);
    if (lastStatus) setStatus($("#kcd-status"), lastStatus.kind, lastStatus.fn());
  });
}
