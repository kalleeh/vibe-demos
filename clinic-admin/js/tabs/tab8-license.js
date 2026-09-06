/* clinic-admin — Tab 08
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, $$, esc, todayISO, daysUntil, Haptic, Toast, Lightbox, Share, bindCameraButton } from "../core/ui.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { Attachments } from "../core/attachments.js";
import { OCR } from "../core/ocr.js";

/* ─────────────────────────────────────────────────────────
   Tab 8 — 면허·자격 갱신 트래커
   ───────────────────────────────────────────────────────── */
export function initTab8() {
  // 의료법 §25: 면허신고 is per person, every 3 years from the last report.
  // `reported` = last report date (user input); `expiry` = the computed
  // deadline, kept under its historical key so dashboards/ics/palette
  // that already read `expiry` keep working.
  const addYears = (iso, n) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return "";
    d.setFullYear(d.getFullYear() + n);
    return d.toISOString().slice(0, 10);
  };
  let editingId = null;
  const setEditing = (on) => {
    $("#lic-add-btn").textContent = on ? "저장" : "추가";
    $("#lic-cancel").style.display = on ? "" : "none";
  };
  const resetForm = () => {
    editingId = null;
    $("#lic-name").value = "";
    $("#lic-reported").value = "";
    $("#lic-cme").value = "";
    setEditing(false);
  };

  const renderList = () => {
    const list = Store.get("license.list", []);
    if (!list.length) {
      $("#lic-list").innerHTML = `<div class="empty-state">등록된 직원이 없습니다 — 아래 양식에서 추가하거나 샘플 5명 채우기를 눌러보세요.</div>`;
      $("#lic-summary").textContent = "총 0명 · 기한 임박 0명";
      return;
    }
    let imminent = 0;
    const html = list.map(lic => {
      const expDays = daysUntil(lic.expiry);
      const cmeDays = daysUntil(lic.cme);
      const minDays = Math.min(expDays ?? 99999, cmeDays ?? 99999);
      let cls = "", note = "";
      if (minDays < 0) { cls = "urgent"; note = `<em>${-minDays}일 초과</em>`; imminent++; }
      else if (minDays <= 90) { cls = "urgent"; note = `<em>${minDays}일 남음</em>`; imminent++; }
      else if (minDays <= 180) { cls = "warn"; note = `<em>${minDays}일 남음</em>`; }
      else if (minDays !== 99999) { note = `<em>${minDays}일 남음</em>`; }
      return `
        <div class="lic ${cls}" data-id="${lic.id}">
          <span class="lic-role">${esc(lic.role)}</span>
          <span class="lic-name">${esc(lic.name)}
            <span class="lic-meta">면허신고 기한 ${lic.expiry || "—"}${lic.reported ? ` (신고 ${lic.reported})` : ""} · 보수교육 ${lic.cme || "—"}</span>
            <span class="attach-row" data-attach-row data-owner="${lic.id}"></span>
          </span>
          <span class="lic-due">${note}</span>
          <span class="lic-actions">
            <label class="icon-btn" data-act="cam" data-id="${lic.id}" title="면허증 촬영 · OCR로 신고일/기한 추출" aria-label="면허증 촬영">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <input type="file" accept="image/*" capture="environment">
            </label>
            <button data-id="${lic.id}" data-act="edit" title="수정">✎</button>
            <button data-id="${lic.id}" data-act="del" title="삭제">×</button>
          </span>
        </div>`;
    }).join("");
    $("#lic-list").innerHTML = html;
    $("#lic-summary").textContent = `총 ${list.length}명 · 기한 임박 ${imminent}명`;

    $$("#lic-list .lic-actions > button").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        if (b.dataset.act === "del") {
          // No confirm — the row (and its IndexedDB attachments, which are keyed
          // by id and left untouched) comes back from the undo toast for 6 s.
          const idx = list.findIndex(x => x.id === id);
          const removed = list[idx];
          if (!removed) return;
          if (editingId === id) resetForm();
          Store.set("license.list", list.filter(x => x.id !== id));
          ActivityLog.push("license", `면허 직원 삭제 — ${removed.role} ${removed.name}`, { silent: true });
          Haptic.del();
          renderList();
          Toast.withUndo(`삭제됨 · ${removed.role} ${removed.name}`, () => {
            const cur = Store.get("license.list", []);
            if (cur.some(x => x.id === id)) return;
            cur.splice(Math.min(idx, cur.length), 0, removed);
            Store.set("license.list", cur);
            ActivityLog.push("license", `삭제 취소 — ${removed.role} ${removed.name}`, { silent: true });
            renderList();
          }, "license");
        } else if (b.dataset.act === "edit") {
          // Edit in place — the record (and its IndexedDB attachments keyed by id) stays put
          // until 저장; nothing is deleted up front.
          const lic = list.find(x => x.id === id);
          if (!lic) return;
          editingId = id;
          $("#lic-role").value = lic.role;
          $("#lic-name").value = lic.name;
          $("#lic-reported").value = lic.reported || (lic.expiry ? addYears(lic.expiry, -3) : "");
          $("#lic-cme").value = lic.cme || "";
          setEditing(true);
          $("#lic-name").focus();
          Haptic.tap();
        }
      });
    });

    // ── Camera buttons + OCR per row ──
    $$("#lic-list .icon-btn[data-act=cam]").forEach(btn => {
      const ownerId = btn.dataset.id;
      const row = btn.closest(".lic");
      bindCameraButton(btn, async (dataUrl) => {
        const att = {
          id: "att-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          owner: ownerId, kind: "license", at: Date.now(), data: dataUrl
        };
        await Attachments.put(att);
        Haptic.save();

        // Run OCR with shimmer feedback
        const dueEl = row.querySelector(".lic-due");
        const shim = document.createElement("span");
        shim.className = "ocr-shimmer";
        shim.innerHTML = `<span class="dot"></span>OCR 분석 중…`;
        dueEl.appendChild(shim);
        try {
          const { expiry, text } = await OCR.run(dataUrl, m => {
            if (m.status && m.progress != null) {
              const pct = Math.round(m.progress * 100);
              shim.innerHTML = `<span class="dot"></span>${m.status} ${pct}%`;
            }
          });
          if (expiry) {
            // A past date on the card is the report/issue date → deadline = +3y;
            // a future date is taken as the deadline itself.
            const isPast = expiry < todayISO();
            const due = isPast ? addYears(expiry, 3) : expiry;
            shim.classList.add("success");
            shim.innerHTML = `✓ 면허신고 기한 ${due} 자동입력${isPast ? " (신고일 + 3년)" : ""}`;
            const list2 = Store.get("license.list", []);
            const target = list2.find(x => x.id === ownerId);
            if (target) {
              target.expiry = due;
              if (isPast) target.reported = expiry;
              Store.set("license.list", list2);
              ActivityLog.push("license", `OCR — ${target.name} 면허신고 기한 ${due}`, {});
            }
            setTimeout(() => shim.remove(), 2500);
          } else {
            shim.classList.add("fail");
            shim.innerHTML = `× 날짜 인식 실패`;
            setTimeout(() => shim.remove(), 2500);
          }
        } catch (err) {
          console.error(err);
          shim.classList.add("fail");
          shim.textContent = `× ${err.message || "OCR 실패"}`;
          Toast.show({ tag: "license", html: esc(err.message || "OCR 실패") });
          setTimeout(() => shim.remove(), 4000);
        }
        // Re-render attachments thumbs for this row
        renderAttachments(ownerId);
      });
    });

    // ── Render existing attachments (async) ──
    $$("#lic-list [data-attach-row]").forEach(el => {
      renderAttachments(el.dataset.owner);
    });
  };

  async function renderAttachments(ownerId) {
    const row = $(`#lic-list [data-attach-row][data-owner="${ownerId}"]`);
    if (!row) return;
    const atts = await Attachments.getByOwner(ownerId);
    if (!atts.length) { row.innerHTML = ""; return; }
    row.innerHTML = atts.map(a => `
      <span class="attach-thumb" data-att="${a.id}">
        <img src="${a.data}" alt="첨부 사진">
        <span class="x" data-att="${a.id}" title="삭제">×</span>
      </span>
    `).join("");
    row.querySelectorAll(".attach-thumb img").forEach((img, i) => {
      img.addEventListener("click", () => Lightbox.open(atts[i].data));
    });
    row.querySelectorAll(".attach-thumb .x").forEach(x => {
      x.addEventListener("click", async (e) => {
        e.stopPropagation();
        const att = atts.find(a => a.id === x.dataset.att);
        await Attachments.del(x.dataset.att);
        Haptic.del();
        renderAttachments(ownerId);
        if (att) Toast.withUndo("삭제됨 · 첨부 사진", async () => {
          await Attachments.put(att); // same id + timestamp → same slot
          renderAttachments(ownerId);
        }, "license");
      });
    });
  }

  $("#lic-add-btn").addEventListener("click", () => {
    const role = $("#lic-role").value;
    const name = $("#lic-name").value.trim();
    const reported = $("#lic-reported").value;
    const expiry = addYears(reported, 3);
    const cme = $("#lic-cme").value;
    if (!name) { Haptic.warn(); alert("이름을 입력해주세요."); return; }
    const list = Store.get("license.list", []);
    if (editingId) {
      const target = list.find(x => x.id === editingId);
      if (target) Object.assign(target, { role, name, reported, expiry, cme });
      else list.push({ id: editingId, role, name, reported, expiry, cme });
      ActivityLog.push("license", `직원 수정 — ${role} ${name}`, {});
    } else {
      list.push({ id: "lic-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        role, name, reported, expiry, cme });
      ActivityLog.push("license", `직원 추가 — ${role} ${name}`, {});
    }
    Store.set("license.list", list);
    Haptic.save();
    resetForm();
    renderList();
  });
  $("#lic-cancel").addEventListener("click", () => { resetForm(); Haptic.tap(); });

  $("#lic-sample").addEventListener("click", () => {
    const today = new Date();
    const offset = (m) => {
      const d = new Date(today); d.setMonth(d.getMonth() + m);
      return d.toISOString().slice(0, 10);
    };
    // reported = last 면허신고 (months relative to today); deadline = reported + 3y
    const sample = [
      { role: "한의사",     name: "윤지훈", reported: offset(2 - 36),  cme: offset(8) },
      { role: "한의사",     name: "박서영", reported: offset(14 - 36), cme: offset(-1) },
      { role: "간호사",     name: "이민하", reported: offset(5 - 36),  cme: offset(11) },
      { role: "물리치료사", name: "김도현", reported: offset(22 - 36), cme: offset(4) },
      { role: "간호조무사", name: "최유진", reported: offset(-2 - 36), cme: offset(7) }
    ].map(x => ({ ...x, id: "lic-sample-" + x.name, expiry: addYears(x.reported, 3) }));
    Store.set("license.list", sample);
    ActivityLog.push("license", "샘플 직원 5명 등록", {});
    renderList();
  });

  $("#lic-ics").addEventListener("click", () => {
    const list = Store.get("license.list", []);
    if (!list.length) { alert("등록된 직원이 없습니다."); return; }
    const pad = n => String(n).padStart(2, "0");
    const fmt = d => {
      const dt = new Date(d + "T09:00:00");
      return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T090000`;
    };
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vibe Studio//Clinic Admin//KO"];
    for (const lic of list) {
      if (lic.expiry) ics.push("BEGIN:VEVENT",
        `UID:${lic.id}-exp@vibe-clinic-admin`,
        `DTSTAMP:${fmt(todayISO())}Z`, `DTSTART:${fmt(lic.expiry)}`,
        `DTEND:${fmt(lic.expiry).slice(0,11)}5959`,
        `SUMMARY:${lic.role} ${lic.name} — 면허신고 기한`,
        "BEGIN:VALARM","TRIGGER:-P30D","ACTION:DISPLAY",
        `DESCRIPTION:면허신고 기한 (의료법 §25 · 신고일 + 3년)`,"END:VALARM",
        "END:VEVENT");
      if (lic.cme) ics.push("BEGIN:VEVENT",
        `UID:${lic.id}-cme@vibe-clinic-admin`,
        `DTSTAMP:${fmt(todayISO())}Z`, `DTSTART:${fmt(lic.cme)}`,
        `DTEND:${fmt(lic.cme).slice(0,11)}5959`,
        `SUMMARY:${lic.role} ${lic.name} — 보수교육 마감`,
        "BEGIN:VALARM","TRIGGER:-P30D","ACTION:DISPLAY",
        `DESCRIPTION:보수교육 마감 예정`,"END:VALARM",
        "END:VEVENT");
    }
    ics.push("END:VCALENDAR");
    const blob = new Blob([ics.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `licenses_${todayISO()}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ActivityLog.push("license", "면허신고 기한 캘린더 .ics 내려받음", {});
  });

  $("#lic-share")?.addEventListener("click", async () => {
    const list = Store.get("license.list", []);
    if (!list.length) { alert("등록된 직원이 없습니다."); return; }
    const lines = list.map(l => {
      const expDays = daysUntil(l.expiry);
      const tag = expDays == null ? "—" : (expDays < 0 ? `D+${-expDays}` : `D-${expDays}`);
      return `• ${l.role} ${l.name} · 면허신고 기한 ${l.expiry || "—"} (${tag}) · 보수교육 ${l.cme || "—"}`;
    });
    const text = `[한방병원 면허·자격 명부]\n${lines.join("\n")}\n\n— ${todayISO()} 기준`;
    await Share.send({ title: "면허·자격 명부", text });
    ActivityLog.push("license", "면허 명부 공유", {});
  });

  EventBus.on("store:license.list", renderList);
  renderList();
}
