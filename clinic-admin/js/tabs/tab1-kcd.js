/* clinic-admin — Tab 01
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, setStatus, todayISO, relTime, bindDrop } from "../core/ui.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { readSpreadsheet, downloadXLSX } from "../core/files.js";

/* ─────────────────────────────────────────────────────────
   Tab 1 — KCD-8 진단코드 정비
   ───────────────────────────────────────────────────────── */
export function initTab1(ctx) {
  const { DATA } = ctx;
  let lastResult = null;

  const buildIndex = () => {
    const map = new Map();
    for (const m of DATA.kcd.mappings) {
      map.set(m.kcd8.replace(/\./g, ""), m);
      map.set(m.kcd8, m);
      map.set(m.kcd9.replace(/\./g, ""), m);
      map.set(m.kcd9, m);
    }
    return map;
  };
  const idx = buildIndex();

  // 한의 변증 U-codes (KCD-8 U20-U99 block) trigger an EDI dual-coding warning
  // when used solo without a paired 양방 진단 (M/G/K/F/...).
  const isUCode = (c) => /^U[2-9]\d/i.test(c.replace(/\./g, ""));

  const transform = (rows) => {
    const out = [];
    const counters = { clean: 0, normalized: 0, ambiguous: 0, deduped: 0, ucode_solo: 0, missing: 0 };
    // Patient → list of codes (for U-code pairing check + dedup)
    const byPatient = new Map();
    for (const row of rows) {
      const pid = String(row["환자번호"] || "").trim();
      const code = String(row["KCD코드"] || row["KCD8코드"] || row["코드"] || "").trim();
      if (!byPatient.has(pid)) byPatient.set(pid, []);
      byPatient.get(pid).push(code.replace(/\./g, ""));
    }

    const seen = new Map(); // patient+date+code → already saw

    for (const row of rows) {
      const pid = String(row["환자번호"] || "").trim();
      const date = String(row["진료일자"] || "").trim();
      const codeRaw = String(row["KCD코드"] || row["KCD8코드"] || row["코드"] || "").trim();
      const dx = String(row["진단명"] || row["상병명"] || "").trim();
      const codeNorm = codeRaw.replace(/\./g, "");
      const hit = idx.get(codeRaw) || idx.get(codeNorm);

      let standardCode = codeRaw, action = "missing", note = "마스터 미수록 — KOICD 직접 확인", category = "—";

      // Dedup check — same patient + same date + same standardized code
      const dedupKey = `${pid}|${date}|${codeNorm}`;
      if (seen.has(dedupKey)) {
        action = "deduped";
        note = "동일 환자·일자·진단 중복 — 1건으로 통합 권고";
        standardCode = codeRaw;
        counters.deduped++;
        out.push({
          "환자번호": pid, "진료일자": date, "진단명": dx,
          "입력코드": codeRaw, "표준코드": standardCode,
          "정비결과": action, "비고": (row["비고"] ? row["비고"] + " · " : "") + note,
          "_kind": "warn"
        });
        continue;
      }
      seen.set(dedupKey, true);

      if (hit) {
        standardCode = hit.kcd8 || codeRaw;
        category = hit.category || "—";
        if (hit.type === "split") {
          action = "ambiguous";
          note = "세분류 후보: " + (hit.candidates || []).join(" / ");
          counters.ambiguous++;
        } else if (hit.type === "recoded") {
          action = "normalized";
          // The normalized EDI form is the dotless kcd9 (e.g. S33.5 → S335) —
          // show that, not the dotted input form, or the row contradicts its note.
          standardCode = hit.kcd9 || codeNorm;
          note = "마침표 정리(.→없음) — EDI 청구 형식";
          counters.normalized++;
        } else if (hit.type === "merged") {
          action = "normalized";
          // merged → the current standard form lives in kcd9 (e.g. R51 → R51.9).
          standardCode = hit.kcd9 || codeRaw;
          note = "구버전 코드 → 현행 표준형으로 정리";
          counters.normalized++;
        } else {
          action = "clean";
          note = "현행 표준형 — EDI 청구 가능";
          counters.clean++;
        }
      } else {
        counters.missing++;
      }

      // U-code solo check — 한의 변증을 단독으로 입력한 경우 (양방 진단 없음)
      if (isUCode(codeNorm)) {
        const others = (byPatient.get(pid) || []).filter(c => c !== codeNorm);
        const hasWesternPair = others.some(c => /^[A-TVZ]/i.test(c) && !/^U/i.test(c));
        if (!hasWesternPair) {
          action = "ucode_solo";
          note = "한의 변증 단독 — 양방 진단(M/G/K…) 동반코딩 필요";
          counters.ucode_solo++;
          // Decrement the SAME logical bucket the first pass incremented above
          // (split→ambiguous, recoded/merged→normalized, else→clean), not the
          // raw hit.type — otherwise a recoded/split U-mapping double-counts.
          let bucket = "missing";
          if (hit) {
            bucket = hit.type === "split" ? "ambiguous"
                   : (hit.type === "recoded" || hit.type === "merged") ? "normalized"
                   : "clean";
          }
          counters[bucket]--;
        }
      }

      out.push({
        "환자번호": pid, "진료일자": date, "진단명": dx,
        "입력코드": codeRaw, "표준코드": standardCode,
        "정비결과": action,
        "비고": (row["비고"] ? row["비고"] + " · " : "") + note,
        "_kind": action === "clean" ? "ok"
                : action === "normalized" ? "ok"
                : action === "missing" ? "err"
                : "warn"
      });
    }
    return { rows: out, counters };
  };

  const renderResult = (result) => {
    const { rows, counters } = result;
    const total = rows.length;
    const okCount = (counters.clean || 0) + (counters.normalized || 0);
    const reviewCount = (counters.ambiguous || 0) + (counters.deduped || 0) + (counters.ucode_solo || 0);
    $("#kcd-summary").innerHTML =
      `<strong>${total}건</strong> 검토 · ` +
      `정상 <strong>${okCount}건</strong> · ` +
      `검토필요 <strong>${reviewCount}건</strong> · ` +
      `미수록 <strong>${counters.missing || 0}건</strong>`;
    $("#kcd-toolbar").style.display = "flex";
    $("#kcd-download").disabled = false;

    const labelMap = {
      clean:      ["정상",       "ok"],
      normalized: ["형식정리",   "ok"],
      ambiguous:  ["세분류 검토", "warn"],
      deduped:    ["중복",       "warn"],
      ucode_solo: ["U-code 단독", "warn"],
      missing:    ["미수록",     "err"]
    };

    const html = `
      <table>
        <thead>
          <tr>
            <th>환자번호</th><th>진료일자</th><th>진단명</th>
            <th class="code">입력</th><th class="code">표준형</th>
            <th>결과</th><th>비고</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const [label, cls] = labelMap[r.정비결과] || ["—", "ok"];
            const isMissing = r.정비결과 === "missing";
            const labelCell = isMissing
              ? `<td><button type="button" class="pill ${cls}" data-search="${(r.입력코드 || r.진단명 || "").replace(/"/g, "&quot;")}" title="통합검색에서 확인">${label} →</button></td>`
              : `<td><span class="pill ${cls}">${label}</span></td>`;
            return `<tr>
              <td>${r.환자번호}</td>
              <td class="code">${r.진료일자}</td>
              <td>${r.진단명 || "—"}</td>
              <td class="code">${r.입력코드 || "—"}</td>
              <td class="code">${r.표준코드 || "—"}</td>
              ${labelCell}
              <td>${r.비고}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
    $("#kcd-result").innerHTML = html;
    // Wire 미수록 pill → cross-tab search
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
    const summary = {
      total: result.rows.length,
      ok: (result.counters.clean || 0) + (result.counters.normalized || 0),
      review: (result.counters.ambiguous || 0) + (result.counters.deduped || 0) + (result.counters.ucode_solo || 0),
      missing: result.counters.missing || 0,
      missingCodes: result.rows.filter(r => r.정비결과 === "missing").map(r => r.입력코드).slice(0, 50),
      at: Date.now()
    };
    Store.set("kcd.lastSummary", summary);
  };

  bindDrop("drop-kcd", async (file) => {
    try {
      setStatus($("#kcd-status"), null, `파일을 읽는 중 — ${file.name}`);
      const rows = await readSpreadsheet(file);
      if (!rows.length) {
        setStatus($("#kcd-status"), "warn", "빈 파일이거나 데이터를 찾지 못했습니다.");
        return;
      }
      const result = transform(rows);
      lastResult = result;
      renderResult(result);
      persistKcd(result);
      ActivityLog.push("kcd", `KCD 정비 — ${result.rows.length}건 검토`, { file: file.name });
      setStatus($("#kcd-status"), null,
        `${result.rows.length}건 정비 완료 — EDI 청구 전 검토필요·미수록 항목을 우선 확인하세요.`);
    } catch (err) {
      setStatus($("#kcd-status"), "err", "파일을 읽지 못했습니다 — 형식 확인 필요.");
    }
  });

  $("#kcd-download").addEventListener("click", () => {
    if (!lastResult) return;
    const exportRows = lastResult.rows.map(({ _kind, ...rest }) => rest);
    downloadXLSX(exportRows, `KCD_정비_${todayISO()}.xlsx`, "KCD 정비");
    ActivityLog.push("kcd", `KCD 정비표 내려받음 (${exportRows.length}건)`, {});
  });

  const sampleKcdData = [
    { 환자번호: "P-2025-0042", 진료일자: "2025-12-10", 진단명: "요통",          KCD코드: "M54.5", 비고: "" },
    { 환자번호: "P-2025-0042", 진료일자: "2025-12-10", 진단명: "요통",          KCD코드: "M54.5", 비고: "이중 입력" },
    { 환자번호: "P-2025-0042", 진료일자: "2025-12-12", 진단명: "경부통",        KCD코드: "M54.2", 비고: "" },
    { 환자번호: "P-2025-0085", 진료일자: "2025-12-15", 진단명: "오십견",        KCD코드: "M75.0", 비고: "" },
    { 환자번호: "P-2025-0085", 진료일자: "2025-12-17", 진단명: "긴장성 두통",   KCD코드: "G44.2", 비고: "" },
    { 환자번호: "P-2025-0091", 진료일자: "2025-12-20", 진단명: "요추 염좌",     KCD코드: "S33.5", 비고: "교통사고" },
    { 환자번호: "P-2025-0091", 진료일자: "2025-12-20", 진단명: "경추 염좌",     KCD코드: "S13.4", 비고: "교통사고" },
    { 환자번호: "P-2025-0103", 진료일자: "2025-12-23", 진단명: "위염 NOS",      KCD코드: "K29.7", 비고: "" },
    { 환자번호: "P-2025-0117", 진료일자: "2025-12-26", 진단명: "노권상",        KCD코드: "U68.0", 비고: "한의 변증 단독" }
  ];

  $('[data-action="sample-kcd"]').addEventListener("click", (e) => {
    e.stopPropagation();
    downloadXLSX(sampleKcdData, "샘플_KCD_진단대장.xlsx", "샘플");
  });

  $('[data-action="run-kcd"]').addEventListener("click", () => {
    setStatus($("#kcd-status"), null, "샘플 데이터 9건 정비 중…");
    const result = transform(sampleKcdData);
    lastResult = result;
    renderResult(result);
    persistKcd(result);
    ActivityLog.push("kcd", `KCD 정비 시연 — ${result.rows.length}건`, { sample: true });
    setStatus($("#kcd-status"), null,
      `샘플 ${result.rows.length}건 정비 완료 — 중복·세분류·U-code 단독·미수록 등 EDI 청구 전 검토 케이스를 한 번에 보실 수 있습니다.`);
  });

  // Restore last summary status if any
  const lastKcd = Store.get("kcd.lastSummary");
  if (lastKcd) {
    setStatus($("#kcd-status"), null,
      `최근 정비 — ${relTime(lastKcd.at)} · ${lastKcd.total}건 · 미수록 ${lastKcd.missing}건. 새 파일을 올리면 갱신됩니다.`);
  }
}
