/* clinic-admin — Tab 02
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, fmtKRW, todayISO, fuzzyMatch, setStatus, debounce, Haptic, Toast } from "../core/ui.js";
import { Store, ActivityLog, bindPersist } from "../core/store.js";
import { downloadXLSX } from "../core/files.js";

/* ─────────────────────────────────────────────────────────
   Tab 2 — 자보 EDI 청구·지급 정산
   ───────────────────────────────────────────────────────── */
export function initTab2(ctx) {
  const { DATA } = ctx;
  const items = []; // {code, name, qty, unit, price, category, paid, cutCode}
  // HIRA 심사조정 사유 발췌 — 자보 한방진료 빈출 사유
  const CUT_REASONS = [
    { code: "",     label: "— 삭감 없음 —" },
    { code: "C001", label: "C001 · 진찰료 산정기준 위반" },
    { code: "C012", label: "C012 · 동일 부위 동일 시술 중복 산정" },
    { code: "C034", label: "C034 · 의학적 필요성 미흡 (자보)" },
    { code: "C047", label: "C047 · 첩약·약침 횟수 초과" },
    { code: "C055", label: "C055 · 추나 인정기준 미충족" },
    { code: "C061", label: "C061 · 상병코드와 시술 부위 불일치" },
    { code: "C078", label: "C078 · 통원기간 합리적 범위 초과" },
    { code: "C091", label: "C091 · 산정 단가 오류" },
    { code: "C099", label: "C099 · 기타 — 자료 추가 제출 후 재심사" }
  ];
  const dxSel = $("#jabo-dx");
  DATA.jabo.diagnosis_examples.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.code;
    opt.textContent = `${d.code} · ${d.name}`;
    dxSel.appendChild(opt);
  });

  const itemsByCode = new Map();
  DATA.jabo.items.forEach(i => itemsByCode.set(i.code, i));

  const searchEl = $("#jabo-search");
  const resultsEl = $("#jabo-search-results");
  let activeIdx = -1;

  const renderSearch = (query) => {
    if (!query.trim()) {
      resultsEl.classList.remove("show");
      resultsEl.innerHTML = "";
      return;
    }
    const matches = DATA.jabo.items.filter(i =>
      fuzzyMatch(i.name, query) || i.code.includes(query) || fuzzyMatch(i.category, query)
    ).slice(0, 12);
    if (!matches.length) {
      resultsEl.innerHTML = `<div class="search-opt"><span></span><span style="color: var(--muted); font-style: italic;">검색 결과 없음</span><span></span></div>`;
      resultsEl.classList.add("show");
      return;
    }
    resultsEl.innerHTML = matches.map((m, i) => `
      <div class="search-opt" data-code="${m.code}" data-idx="${i}">
        <span class="code-tag">${m.code}</span>
        <span><span style="color: var(--ink-2)">${m.name}</span> <span style="color: var(--faint); font-size: 11px; margin-left: 6px;">${m.category}</span></span>
        <span class="price-mini">${fmtKRW(m.price)} / ${m.unit}</span>
      </div>
    `).join("");
    resultsEl.classList.add("show");
    resultsEl.querySelectorAll(".search-opt").forEach(opt => {
      opt.addEventListener("click", () => addItem(opt.dataset.code));
    });
  };

  const addItem = (code) => {
    const def = itemsByCode.get(code);
    if (!def) return;
    const existing = items.find(x => x.code === code);
    if (existing) {
      existing.qty++;
    } else {
      // paid defaults to claimed amount; admin overrides as 지급내역서 arrives
      items.push({ ...def, qty: 1, paid: def.price, cutCode: "" });
    }
    searchEl.value = "";
    resultsEl.classList.remove("show");
    renderItems();
  };

  const renderItems = () => {
    const list = $("#jabo-items");
    if (!items.length) {
      list.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--muted); font-family: 'Fraunces', serif; font-style: italic; font-size: 14px;">아직 추가된 행위가 없습니다.</div>`;
    } else {
      list.innerHTML = items.map((it, i) => {
        const claimed = it.price * it.qty;
        const paid = (typeof it.paid === "number" ? it.paid : claimed) * it.qty;
        const cut = claimed - paid;
        const cutCls = cut > 0 ? "warn" : "ok";
        const cutOpts = CUT_REASONS.map(r =>
          `<option value="${r.code}"${r.code === it.cutCode ? " selected" : ""}>${r.label}</option>`
        ).join("");
        return `
        <div class="item-row recon" data-i="${i}">
          <span class="code-tag">${it.code}</span>
          <span class="name">${it.name} <span style="color: var(--faint); font-size: 11px; margin-left: 4px;">${it.category}</span></span>
          <input type="number" class="qty" min="1" max="999" value="${it.qty}" data-i="${i}" aria-label="횟수" title="횟수">
          <span class="price-display">청구 ${fmtKRW(claimed)}</span>
          <input type="number" class="paid-unit" min="0" value="${it.paid}" data-i="${i}" aria-label="지급단가" title="지급 단가 (보험사 지급내역서 기준)" placeholder="${it.price}">
          <span class="price-display ${cutCls}" style="${cut > 0 ? 'color:var(--accent)' : ''}">${cut > 0 ? '−' + fmtKRW(cut) : '0'}</span>
          <select class="cut-reason" data-i="${i}" title="삭감 사유">${cutOpts}</select>
          <button class="remove-btn" data-i="${i}" aria-label="삭제">×</button>
        </div>`;
      }).join("");
      list.querySelectorAll(".qty").forEach(input => {
        input.addEventListener("input", e => {
          const i = +e.target.dataset.i;
          items[i].qty = Math.max(1, +e.target.value || 1);
          renderItems();
        });
      });
      list.querySelectorAll(".paid-unit").forEach(input => {
        input.addEventListener("input", e => {
          const i = +e.target.dataset.i;
          items[i].paid = Math.max(0, +e.target.value || 0);
          renderItems();
        });
      });
      list.querySelectorAll(".cut-reason").forEach(sel => {
        sel.addEventListener("change", e => {
          const i = +e.target.dataset.i;
          items[i].cutCode = e.target.value;
          renderItems();
        });
      });
      list.querySelectorAll(".remove-btn").forEach(btn => {
        btn.addEventListener("click", e => {
          const i = +e.target.dataset.i;
          const [removed] = items.splice(i, 1);
          renderItems();
          Haptic.del();
          Toast.withUndo(`삭제됨 · ${removed.name}`, () => {
            items.splice(Math.min(i, items.length), 0, removed);
            renderItems();
          }, "jabo");
        });
      });
    }
    const totals = items.reduce((acc, it) => {
      const claimed = it.price * it.qty;
      const paid = (typeof it.paid === "number" ? it.paid : it.price) * it.qty;
      acc.claimed += claimed;
      acc.paid += paid;
      return acc;
    }, { claimed: 0, paid: 0 });
    const cutTotal = totals.claimed - totals.paid;
    const cutPct = totals.claimed > 0 ? Math.round((cutTotal / totals.claimed) * 1000) / 10 : 0;
    $("#jabo-total-num").textContent = fmtKRW(totals.claimed);
    $("#jabo-paid-num").textContent = fmtKRW(totals.paid);
    $("#jabo-cut-num").textContent = fmtKRW(cutTotal);
    $("#jabo-summary").innerHTML =
      `<strong>${items.length}건</strong> 행위 · 청구 <strong>${fmtKRW(totals.claimed)}원</strong> · 지급 <strong>${fmtKRW(totals.paid)}원</strong> · 삭감률 <strong>${cutPct}%</strong>`;
    $("#jabo-download").disabled = items.length === 0;

    // preview table
    if (!items.length) {
      $("#jabo-preview").innerHTML = `<div class="empty-state">행위와 지급내역을 입력하면 정산표가 표시됩니다.</div>`;
    } else {
      $("#jabo-preview").innerHTML = `
        <table>
          <thead><tr>
            <th class="code">코드</th><th>행위명</th>
            <th class="code">단가</th><th class="code">횟수</th>
            <th class="code">청구액</th><th class="code">지급액</th>
            <th class="code">삭감</th><th>삭감사유</th>
          </tr></thead>
          <tbody>
            ${items.map(it => {
              const claimed = it.price * it.qty;
              const paid = (typeof it.paid === "number" ? it.paid : it.price) * it.qty;
              const cut = claimed - paid;
              const reason = CUT_REASONS.find(r => r.code === it.cutCode)?.label || "—";
              return `<tr>
                <td class="code">${it.code}</td>
                <td>${it.name}</td>
                <td class="code" style="text-align:right">${fmtKRW(it.price)}</td>
                <td class="code" style="text-align:right">${it.qty}</td>
                <td class="code" style="text-align:right">${fmtKRW(claimed)}</td>
                <td class="code" style="text-align:right">${fmtKRW(paid)}</td>
                <td class="code" style="text-align:right${cut > 0 ? '; color:var(--accent); font-weight:600' : ''}">${cut > 0 ? '−' + fmtKRW(cut) : '0'}</td>
                <td style="font-size: 11px; color: var(--ink-2)">${cut > 0 ? reason : "—"}</td>
              </tr>`;
            }).join("")}
            <tr style="background: var(--paper-2); font-weight: 600">
              <td colspan="4" style="text-align:right">합계</td>
              <td class="code" style="text-align:right">${fmtKRW(totals.claimed)}</td>
              <td class="code" style="text-align:right">${fmtKRW(totals.paid)}</td>
              <td class="code" style="text-align:right; color:var(--accent)">${cutTotal > 0 ? '−' + fmtKRW(cutTotal) : '0'}</td>
              <td>삭감률 ${cutPct}%</td>
            </tr>
          </tbody>
        </table>`;
    }
  };

  searchEl.addEventListener("input", e => renderSearch(e.target.value));
  searchEl.addEventListener("focus", e => renderSearch(e.target.value));
  document.addEventListener("click", e => {
    if (!e.target.closest(".item-search")) resultsEl.classList.remove("show");
  });

  $("#jabo-download").addEventListener("click", () => {
    const name = $("#jabo-name").value || "—";
    const pid = $("#jabo-pid").value || "—";
    const insurer = $("#jabo-insurer").value || "—";
    const claimNo = $("#jabo-claim").value || "—";
    const accident = $("#jabo-accident").value || "—";
    const date = $("#jabo-date").value || todayISO();
    const dx = dxSel.value;
    const dxName = DATA.jabo.diagnosis_examples.find(d => d.code === dx)?.name || "";
    const totals = items.reduce((acc, it) => {
      acc.claimed += it.price * it.qty;
      acc.paid += (typeof it.paid === "number" ? it.paid : it.price) * it.qty;
      return acc;
    }, { claimed: 0, paid: 0 });
    const cutTotal = totals.claimed - totals.paid;

    // Append to history (capped at 100 entries)
    const history = Store.get("jabo.history", []);
    history.unshift({
      at: Date.now(), pid, name, insurer, claimNo, date,
      claimed: totals.claimed, paid: totals.paid, cut: cutTotal,
      itemCount: items.length
    });
    Store.set("jabo.history", history.slice(0, 100));
    ActivityLog.push("jabo",
      `자보 정산표 — ${name || pid} · ${insurer} · 청구 ${fmtKRW(totals.claimed)}원 · 삭감 ${fmtKRW(cutTotal)}원`,
      { pid, insurer });
    Haptic.save();

    const rows = items.map(it => {
      const claimed = it.price * it.qty;
      const paid = (typeof it.paid === "number" ? it.paid : it.price) * it.qty;
      const cut = claimed - paid;
      return {
        "환자명":      name,
        "환자번호":    pid,
        "보험사":      insurer,
        "접수번호":    claimNo,
        "사고일자":    accident,
        "진료일자":    date,
        "주상병코드":  dx,
        "주상병명":    dxName,
        "행위코드":    it.code,
        "행위명":      it.name,
        "분류":        it.category,
        "고시단가":    it.price,
        "단위":        it.unit,
        "횟수":        it.qty,
        "청구액":      claimed,
        "지급액":      paid,
        "삭감액":      cut,
        "삭감사유":    cut > 0 ? (CUT_REASONS.find(r => r.code === it.cutCode)?.label || "사유미입력") : ""
      };
    });
    rows.push({
      "환자명": "", "환자번호": "", "보험사": "", "접수번호": "",
      "사고일자": "", "진료일자": "",
      "주상병코드": "", "주상병명": "",
      "행위코드": "", "행위명": "합계",
      "분류": "", "고시단가": "", "단위": "", "횟수": "",
      "청구액": totals.claimed, "지급액": totals.paid, "삭감액": cutTotal,
      "삭감사유": ""
    });
    downloadXLSX(rows, `자보정산_${pid}_${date}.xlsx`, "자보 정산");
  });

  // initial render — restore form state if a draft exists
  const today = todayISO();
  $("#jabo-date").value = today;
  $("#jabo-accident").value = today;

  ["jabo-name", "jabo-pid", "jabo-insurer", "jabo-claim", "jabo-accident", "jabo-date"].forEach(id => {
    bindPersist("#" + id, "jabo.draft." + id);
  });
  bindPersist("#jabo-dx", "jabo.draft.jabo-dx");

  const draftItems = Store.get("jabo.draft.items");
  if (Array.isArray(draftItems) && draftItems.length) {
    items.push(...draftItems);
  }

  const persistDraftItems = debounce(() => {
    Store.set("jabo.draft.items", items.map(({ code, name, qty, unit, price, category, paid, cutCode }) =>
      ({ code, name, qty, unit, price, category, paid, cutCode })));
  }, 500);

  // Observe changes in #jabo-items (rerendered on every mutation) to auto-save the draft
  const itemsEl = $("#jabo-items");
  const obs = new MutationObserver(() => persistDraftItems());
  obs.observe(itemsEl, { childList: true, subtree: true });

  // Initial render (will pick up restored items)
  renderItems();

  // 새 케이스 — the six identity fields + item list persist as a draft, so
  // without this there is no way to start a second patient cleanly.
  // No confirm — the cleared case is restorable from the toast for 6 s.
  $("#jabo-new").addEventListener("click", () => {
    const FIELDS = ["jabo-name", "jabo-pid", "jabo-insurer", "jabo-claim", "jabo-accident", "jabo-date"];
    const dirty = items.length > 0 || ["jabo-name", "jabo-pid", "jabo-claim"].some(id => $("#" + id).value.trim());
    const statusEl = $("#jabo-status");
    const snap = {
      fields: Object.fromEntries(FIELDS.map(id => [id, $("#" + id).value])),
      dx: dxSel.value,
      items: items.map(it => ({ ...it })),
      status: statusEl.style.display !== "none" ? statusEl.innerHTML : null
    };
    const apply = (fields, dx, list) => {
      for (const [id, v] of Object.entries(fields)) {
        const el = $("#" + id); el.value = v;
        el.dispatchEvent(new Event("change", { bubbles: true })); // lets bindPersist store the value
      }
      if (dx) dxSel.value = dx; else dxSel.selectedIndex = 0;
      dxSel.dispatchEvent(new Event("change", { bubbles: true }));
      items.length = 0;
      items.push(...list);
      renderItems();
    };
    const t = todayISO();
    apply({ "jabo-name": "", "jabo-pid": "", "jabo-insurer": "", "jabo-claim": "", "jabo-accident": t, "jabo-date": t }, "", []);
    Store.remove("jabo.draft.items");
    statusEl.style.display = "none";
    if (!dirty) { Toast.show({ tag: "jabo", html: "새 케이스 — 입력을 비웠습니다." }); return; }
    Haptic.del();
    Toast.withUndo(`새 케이스 — 이전 케이스(${snap.fields["jabo-name"] || snap.fields["jabo-pid"] || "미입력"} · 행위 ${snap.items.length}건)를 비웠습니다`, () => {
      apply(snap.fields, snap.dx, snap.items);
      if (snap.status != null) { statusEl.innerHTML = snap.status; statusEl.style.display = "flex"; }
    }, "jabo");
  });

  $('[data-action="run-jabo"]').addEventListener("click", () => {
    $("#jabo-name").value = "박지훈";
    $("#jabo-pid").value = "2026-0142";
    $("#jabo-insurer").value = "DB";
    $("#jabo-claim").value = "DB-2026-0421-1234";
    const accidentDate = new Date(today);
    accidentDate.setDate(accidentDate.getDate() - 3);
    $("#jabo-accident").value = accidentDate.toISOString().slice(0, 10);
    $("#jabo-date").value = today;
    dxSel.value = "S134"; // 경추 염좌
    items.length = 0;
    // 5일 통원 — realistic case with partial cuts mirroring HIRA 자보 심사 patterns
    ["40011", "40031", "41001", "41001", "41001", "41001", "41001",
     "41021", "41021", "41021", "47011", "47011", "40301", "40301",
     "42011", "42011"].forEach(code => {
      const def = itemsByCode.get(code);
      if (!def) return;
      const existing = items.find(x => x.code === code);
      if (existing) existing.qty++;
      else items.push({ ...def, qty: 1, paid: def.price, cutCode: "" });
    });
    // Realistic 삭감 pattern: 약침 횟수 일부 삭감, 추나 단가 조정
    items.forEach(it => {
      if (it.code === "40301") {
        // 약침 2회 중 1회만 인정 — 단가 절반으로 표현
        it.paid = Math.round(it.price * 0.5);
        it.cutCode = "C047";
      } else if (it.code === "47011") {
        // 추나 단가 일부 조정
        it.paid = Math.round(it.price * 0.85);
        it.cutCode = "C055";
      } else {
        it.paid = it.price;
        it.cutCode = "";
      }
    });
    renderItems();
    setStatus($("#jabo-status"), null,
      "샘플 케이스 — 경추 염좌 통원 5일분, DB손해보험 지급내역 반영. 약침·추나에 부분 삭감(C047·C055)이 들어간 실전 정산 예시입니다.");
  });
}
