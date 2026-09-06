/* clinic-admin — Tab 01 · 상병코드 정비
   입력형 → EDI 표준형 정규화 + 최신 개정판(마스터) 대조. Works against the uploaded
   KOICD 상병마스터 when present (core/masters.js), else the bundled 발췌. */
import { $, esc, setStatus, todayISO, relTime, bindDrop } from "../core/ui.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX } from "../core/files.js";
import { Masters, toEdi, toDotted } from "../core/masters.js";

export function initTab1(ctx) {
  const { DATA } = ctx;
  Masters.init(DATA);
  let lastResult = null;

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
    if (!rankColPresent) warnings.push("주/부상병 컬럼이 없어 진료일자별 첫 비U 코드를 주상병으로 간주했습니다 — EMR export에 상병구분 컬럼을 포함하세요.");

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
      const push = (action, note, kind, std = edi) => out.push({
        "환자번호": pid, "진료일자": date, "주/부": rank || (stmt?.firstNonU === edi ? "주(추정)" : "") , "진단명": dx,
        "입력코드": codeRaw, "표준코드": std, "정비결과": action,
        "비고": (memo ? memo + " · " : "") + note, "_kind": kind
      });

      if (!edi || !isCodeShape(edi)) { counters.invalid++; push("invalid", "코드 형식 오류 — 영문 1자 + 숫자 2자 (+ 세분류) 형태여야 합니다", "err", codeRaw); continue; }

      const dedupKey = `${pid}|${date}|${edi}`;
      if (seen.has(dedupKey)) { counters.deduped++; push("deduped", "동일 명세서(환자·일자) 내 동일 상병 중복 — 1건으로 통합", "warn"); continue; }
      seen.add(dedupKey);

      if (isAmrU(edi)) { counters.invalid++; push("invalid", "U80–U89는 WHO 항생제 내성 코드 — 한의 병증 코드가 아닙니다", "err"); continue; }

      const hit = idx.get(edi);
      if (isHanuiU(edi)) {
        // Must ride with a non-U 주상병 on the same 명세서.
        const main = rankColPresent ? stmt.main : stmt.firstNonU;
        const mainOk = main && !/^U/.test(main);
        if (!mainOk) {
          counters.ucode_solo++;
          push("ucode_solo", rankColPresent && stmt.main && /^U/.test(stmt.main)
            ? "U코드가 주상병으로 지정됨 — 동일 명세서에 비U 주상병(M/G/S…) 필요"
            : "한의 병증 U코드 단독 — 동일 명세서(환자·일자)에 비U 주상병 필요", "warn");
          continue;
        }
        const note = hit ? `한의 병증 · 주상병 ${toDotted(main)} 동반 — 정상` : `한의 병증 · 주상병 ${toDotted(main)} 동반 · 마스터 미수록(U블록 구조 확인만)`;
        if (codeRaw !== edi) { counters.normalized++; push("normalized", "표기 정리(마침표·공백 제거 → EDI형) · " + note, "ok"); }
        else { counters.clean++; push("clean", note, "ok"); }
        continue;
      }

      if (!hit) {
        counters.missing++;
        push("missing", src.source === "master" ? "업로드 마스터 미수록 — 개정판(KCD-9) 삭제·변경 여부 확인" : "발췌본 미수록 — KOICD 또는 업로드 마스터에서 현행 여부 확인", "err");
        continue;
      }
      if (hit.complete === false) { counters.missing++; push("missing", "불완전 코드(상위 분류) — 완전코드(세분류)로 청구해야 합니다", "err"); continue; }
      if (codeRaw !== edi) { counters.normalized++; push("normalized", "표기 정리(마침표·공백 제거 → EDI형) — 현행 마스터 수록", "ok"); }
      else { counters.clean++; push("clean", "현행 표준형 — EDI 청구 가능", "ok"); }
    }
    return { rows: out, counters, warnings, source: src };
  };

  const LABEL = {
    clean:      ["정상",        "ok"],
    normalized: ["형식정리",    "ok"],
    ucode_solo: ["U코드 단독",  "warn"],
    deduped:    ["중복",        "warn"],
    missing:    ["미수록",      "err"],
    invalid:    ["형식오류",    "err"]
  };

  const renderResult = (result) => {
    const { rows, counters, warnings } = result;
    const okCount = counters.clean + counters.normalized;
    const reviewCount = counters.ucode_solo + counters.deduped;
    const errCount = counters.missing + counters.invalid;
    $("#kcd-summary").innerHTML =
      `<strong>${rows.length}건</strong> 검토 · 정상 <strong>${okCount}건</strong> · 검토필요 <strong>${reviewCount}건</strong> · 미수록/오류 <strong>${errCount}건</strong>`;
    $("#kcd-toolbar").style.display = "flex";
    $("#kcd-download").disabled = false;

    const warnHtml = warnings.length ? `<div class="kcd-warnings">${warnings.map(w => `<div>⚠ ${esc(w)}</div>`).join("")}</div>` : "";
    $("#kcd-result").innerHTML = warnHtml + `
      <table>
        <thead><tr>
          <th>환자번호</th><th>진료일자</th><th>주/부</th><th>진단명</th>
          <th class="code">입력</th><th class="code">EDI 표준형</th><th>결과</th><th>비고</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => {
            const [label, cls] = LABEL[r.정비결과] || ["—", "ok"];
            const searchable = r.정비결과 === "missing";
            const labelCell = searchable
              ? `<td><button type="button" class="pill ${cls}" data-search="${esc(r.입력코드 || r.진단명)}" title="통합검색에서 확인">${label} →</button></td>`
              : `<td><span class="pill ${cls}">${label}</span></td>`;
            return `<tr>
              <td>${esc(r.환자번호)}</td><td class="code">${esc(r.진료일자)}</td><td>${esc(r["주/부"]) || "—"}</td>
              <td>${esc(r.진단명) || "—"}</td>
              <td class="code">${esc(r.입력코드) || "—"}</td><td class="code">${esc(r.표준코드) || "—"}</td>
              ${labelCell}<td>${esc(r.비고)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
    $("#kcd-result").querySelectorAll("button[data-search]").forEach(btn => {
      btn.style.cursor = "pointer";
      btn.addEventListener("click", () => {
        const q = btn.getAttribute("data-search");
        EventBus.emit("search:query", q);
        ActivityLog.push("kcd", `미수록 코드 통합검색 — "${q}"`, {});
      });
    });
  };

  const persistKcd = (result) => {
    Store.set("kcd.lastSummary", {
      total: result.rows.length,
      ok: result.counters.clean + result.counters.normalized,
      review: result.counters.ucode_solo + result.counters.deduped,
      missing: result.counters.missing + result.counters.invalid,
      missingCodes: result.rows.filter(r => r.정비결과 === "missing").map(r => r.입력코드).slice(0, 50),
      at: Date.now()
    });
  };

  const run = (rows, statusText, meta) => {
    const result = transform(rows);
    lastResult = result;
    renderResult(result);
    persistKcd(result);
    ActivityLog.push("kcd", `상병코드 정비 — ${result.rows.length}건 검토`, meta);
    setStatus($("#kcd-status"), null, statusText(result));
  };

  bindDrop("drop-kcd", async (file) => {
    try {
      setStatus($("#kcd-status"), null, `파일을 읽는 중 — ${esc(file.name)}`);
      const rows = await readSpreadsheet(file);
      if (!rows.length) { setStatus($("#kcd-status"), "warn", "빈 파일이거나 데이터를 찾지 못했습니다."); return; }
      run(rows, r => `${r.rows.length}건 정비 완료 — EDI 청구 전 검토필요·미수록 항목을 우선 확인하세요.`, { rows: rows.length });
    } catch (err) {
      console.error(err);
      setStatus($("#kcd-status"), "err", "파일을 읽지 못했습니다 — 형식 확인 필요.");
    }
  });

  $("#kcd-download").addEventListener("click", () => {
    if (!lastResult) return;
    // downloadXLSX stamps the PoC watermark row + _PoC filename itself.
    downloadXLSX(lastResult.rows.map(({ _kind, ...rest }) => rest), `상병코드_정리표_${todayISO()}.xlsx`, "상병코드 정리표");
    ActivityLog.push("kcd", `상병코드 정리표 내려받음 (${lastResult.rows.length}건)`, {});
  });

  // Sample rows carry a 주/부상병 column so the per-명세서 U-code rule is exercised.
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
    downloadXLSX(sampleKcdData, "샘플_상병대장_예시.xlsx", "샘플(예시)");
  });

  $('[data-action="run-kcd"]').addEventListener("click", () => {
    setStatus($("#kcd-status"), null, `샘플 데이터 ${sampleKcdData.length}건 정비 중…`);
    run(sampleKcdData, r => `샘플 ${r.rows.length}건 정비 완료 — 중복·형식정리·U코드 단독·미수록 등 EDI 청구 전 검토 케이스를 한 번에 보실 수 있습니다.`, { sample: true });
  });

  // 기준일 + master source banner
  const renderBanner = () => {
    const src = Masters.kcd();
    const rev = DATA.kcd?.revision || {};
    const el = $("#kcd-master-badge");
    if (!el) return;
    el.innerHTML = `<span class="src-pill ${src.source === "master" ? "master" : "demo"}">${esc(src.label)}</span>
      <span class="basis">기준일 ${esc(src.source === "master" ? src.date : DATA.kcd?.basis_date || "—")} · ${esc(rev.current || "KCD")} ${esc(rev.effective_date || "")} 시행 — <em>확인 필요</em></span>`;
  };
  renderBanner();
  Masters.onChange(renderBanner);

  const lastKcd = Store.get("kcd.lastSummary");
  if (lastKcd) {
    setStatus($("#kcd-status"), null,
      `최근 정비 — ${relTime(lastKcd.at)} · ${lastKcd.total}건 · 미수록 ${lastKcd.missing}건. 새 파일을 올리면 갱신됩니다.`);
  }
}
