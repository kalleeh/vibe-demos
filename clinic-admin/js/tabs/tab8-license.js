/* clinic-admin — Tab 08 · 면허·자격 트래커 */
import { $, $$, esc, todayISO, daysUntil, Haptic, Toast, Lightbox, Share, bindCameraButton } from "../core/ui.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { Attachments } from "../core/attachments.js";
import { OCR } from "../core/ocr.js";
import { redactSubject } from "./reporting-shared.js";

/* ─────────────────────────────────────────────────────────
   Tab 8 — 면허·자격 트래커
   Record: { id, role, name, licenseNo, acquired, reported, cme, expiry, basis }
   · expiry (kept under its historical key so dashboard / ics / palette keep working)
     = reported + 3y when the last 신고일 is known,
     = acquired + 3y flagged basis:"acquired" ("신고 이력 미확인") otherwise,
     = "" for roles with no 신고 duty (원무 · 기타).
   · 면허증 OCR reads 면허번호 + 취득일 — a card never shows a 신고일.
   ───────────────────────────────────────────────────────── */

// Which roles carry a periodic 신고 duty, and where it is filed.
// 한의사 — 의료법 §25 (3년, 대한한의사협회). 간호사 — 의료법 §25 (3년, 대한간호협회).
// 간호조무사 — 의료법 §80 준용 (3년, 대한간호조무사협회). 물리치료사 — 의료기사 등에 관한 법률 §11 (3년, 대한물리치료사협회).
// Confidence: high on the duty + 3-year cycle; portal URLs are "확인 필요".
const ROLE_DUTY = {
  "한의사":     { years: 3, law: "의료법 §25",           org: "대한한의사협회",     url: "https://www.akom.org" },
  "간호사":     { years: 3, law: "의료법 §25",           org: "대한간호협회",       url: "https://www.koreanurse.or.kr" },
  "간호조무사": { years: 3, law: "의료법 §80",           org: "대한간호조무사협회", url: "https://www.klpna.or.kr" },
  "물리치료사": { years: 3, law: "의료기사 등에 관한 법률 §11", org: "대한물리치료사협회", url: "https://www.kpta.co.kr" }
};
export const hasDuty = (role) => !!ROLE_DUTY[role];

export function initTab8() {
  // Local-date arithmetic — toISOString() would shift KST midnight back a day.
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addYears = (iso, n) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return "";
    d.setFullYear(d.getFullYear() + n);
    return ymd(d);
  };
  // Deadline + basis from the record's dates and role.
  const computeDue = ({ role, reported, acquired }) => {
    const duty = ROLE_DUTY[role];
    if (!duty) return { expiry: "", basis: "none" };
    if (reported) return { expiry: addYears(reported, duty.years), basis: "reported" };
    if (acquired) return { expiry: addYears(acquired, duty.years), basis: "acquired" };
    return { expiry: "", basis: "unknown" };
  };
  const who = (lic) => `${lic.role} ${redactSubject({ name: lic.name })}`;

  let editingId = null;
  const setEditing = (on) => {
    $("#lic-add-btn").textContent = on ? "저장" : "추가";
    $("#lic-cancel").style.display = on ? "" : "none";
  };
  const resetForm = () => {
    editingId = null;
    $("#lic-name").value = "";
    $("#lic-no").value = "";
    $("#lic-acquired").value = "";
    $("#lic-reported").value = "";
    $("#lic-cme").value = "";
    setEditing(false);
  };
  // 원무·기타 have no 신고 duty — grey out the date fields in the form.
  const syncRoleFields = () => {
    const duty = hasDuty($("#lic-role").value);
    ["lic-acquired", "lic-reported", "lic-no"].forEach(id => { $("#" + id).disabled = !duty; });
    $("#lic-role-note").textContent = duty ? "" : "이 역할은 면허·자격 신고 대상이 아닙니다 (해당 없음).";
  };
  $("#lic-role").addEventListener("change", syncRoleFields);

  const renderList = () => {
    const list = Store.get("license.list", []);
    if (!list.length) {
      $("#lic-list").innerHTML = `<div class="empty-state">등록된 직원이 없습니다 — 아래 양식에서 추가하거나 샘플 5명 채우기를 눌러보세요.</div>`;
      $("#lic-summary").textContent = "총 0명 · 기한 임박 0명";
      return;
    }
    let imminent = 0;
    const html = list.map(lic => {
      const duty = hasDuty(lic.role);
      const expDays = duty ? daysUntil(lic.expiry) : null;
      const cmeDays = daysUntil(lic.cme);
      const minDays = Math.min(expDays ?? 99999, cmeDays ?? 99999);
      let cls = "", note = "";
      if (minDays < 0) { cls = "urgent"; note = `<em>${-minDays}일 초과</em>`; imminent++; }
      else if (minDays <= 90) { cls = "urgent"; note = `<em>${minDays}일 남음</em>`; imminent++; }
      else if (minDays <= 180) { cls = "warn"; note = `<em>${minDays}일 남음</em>`; }
      else if (minDays !== 99999) { note = `<em>${minDays}일 남음</em>`; }
      else if (!duty) { note = `<em>해당 없음</em>`; }
      const dueText = !duty ? "면허신고 해당 없음"
        : !lic.expiry ? "면허신고 기한 — 신고일 또는 취득일 입력 필요"
        : lic.basis === "acquired"
          ? `면허신고 기한 ${esc(lic.expiry)} <span class="lic-flag" title="신고 이력 미확인 — 협회 포털에서 확인">신고 이력 미확인 — 협회 포털에서 확인</span> (취득 ${esc(lic.acquired)})`
          : `면허신고 기한 ${esc(lic.expiry)} (신고 ${esc(lic.reported)})`;
      const noText = lic.licenseNo ? ` · 면허번호 ${esc(lic.licenseNo)}` : "";
      return `
        <div class="lic ${cls}" data-id="${esc(lic.id)}">
          <span class="lic-role">${esc(lic.role)}</span>
          <span class="lic-name">${esc(lic.name)}
            <span class="lic-meta">${dueText}${noText} · 보수교육 ${esc(lic.cme || "—")}</span>
            <span class="attach-row" data-attach-row data-owner="${esc(lic.id)}"></span>
          </span>
          <span class="lic-due">${note}</span>
          <span class="lic-actions">
            ${duty ? `<label class="icon-btn" data-act="cam" data-id="${esc(lic.id)}" title="면허증에서 면허번호·취득일 읽기" aria-label="면허증 촬영 — 면허번호·취득일 읽기">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <input type="file" accept="image/*" capture="environment">
            </label>` : ""}
            <button data-id="${esc(lic.id)}" data-act="edit" title="수정">✎</button>
            <button data-id="${esc(lic.id)}" data-act="del" title="삭제">×</button>
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
          ActivityLog.push("license", `면허 직원 삭제 — ${who(removed)}`, { silent: true });
          Haptic.del();
          renderList();
          Toast.withUndo(`삭제됨 · ${removed.role} ${removed.name}`, () => {
            const cur = Store.get("license.list", []);
            if (cur.some(x => x.id === id)) return;
            cur.splice(Math.min(idx, cur.length), 0, removed);
            Store.set("license.list", cur);
            ActivityLog.push("license", `삭제 취소 — ${who(removed)}`, { silent: true });
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
          $("#lic-no").value = lic.licenseNo || "";
          $("#lic-acquired").value = lic.acquired || "";
          $("#lic-reported").value = lic.reported || "";
          $("#lic-cme").value = lic.cme || "";
          syncRoleFields();
          setEditing(true);
          $("#lic-name").focus();
          Haptic.tap();
        }
      });
    });

    // ── Camera buttons + OCR per row — reads 면허번호 + 취득일 (never a 신고일) ──
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
          const { issued, licenseNo } = await OCR.run(dataUrl, m => {
            if (m.status && m.progress != null) {
              const pct = Math.round(m.progress * 100);
              shim.innerHTML = `<span class="dot"></span>${esc(m.status)} ${pct}%`;
            }
          });
          if (issued || licenseNo) {
            const list2 = Store.get("license.list", []);
            const target = list2.find(x => x.id === ownerId);
            if (target) {
              if (issued) target.acquired = issued;
              if (licenseNo) target.licenseNo = licenseNo;
              Object.assign(target, computeDue(target));
              Store.set("license.list", list2);
              ActivityLog.push("license", `OCR — ${who(target)} 면허증 ${[issued && "취득일", licenseNo && "면허번호"].filter(Boolean).join("·")} 읽음`, {});
            }
            shim.classList.add("success");
            shim.innerHTML = `✓ ${[issued && `취득일 ${esc(issued)}`, licenseNo && `면허번호 ${esc(licenseNo)}`].filter(Boolean).join(" · ")} 입력`;
            setTimeout(() => shim.remove(), 2500);
          } else {
            shim.classList.add("fail");
            shim.innerHTML = `× 면허번호·취득일 인식 실패`;
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
    const duty = hasDuty(role);
    const licenseNo = duty ? $("#lic-no").value.trim() : "";
    const acquired = duty ? $("#lic-acquired").value : "";
    const reported = duty ? $("#lic-reported").value : "";
    const cme = $("#lic-cme").value;
    if (!name) { Haptic.warn(); alert("이름을 입력해주세요."); return; }
    const rec = { role, name, licenseNo, acquired, reported, cme };
    Object.assign(rec, computeDue(rec));
    const list = Store.get("license.list", []);
    if (editingId) {
      const target = list.find(x => x.id === editingId);
      if (target) Object.assign(target, rec);
      else list.push({ id: editingId, ...rec });
      ActivityLog.push("license", `직원 수정 — ${who(rec)}`, {});
    } else {
      list.push({ id: "lic-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), ...rec });
      ActivityLog.push("license", `직원 추가 — ${who(rec)}`, {});
    }
    Store.set("license.list", list);
    Haptic.save();
    resetForm();
    syncRoleFields();
    renderList();
  });
  $("#lic-cancel").addEventListener("click", () => { resetForm(); syncRoleFields(); Haptic.tap(); });

  $("#lic-sample").addEventListener("click", () => {
    const today = new Date();
    const offset = (m) => {
      const d = new Date(today); d.setMonth(d.getMonth() + m);
      return ymd(d);
    };
    // reported = last 면허신고 (months relative to today); one row has only a 취득일 (basis
    // "acquired" → flagged), and one 원무 row has no duty at all.
    const sample = [
      { role: "한의사",     name: "윤지훈", licenseNo: "12345", acquired: "2009-02-27", reported: offset(2 - 36),  cme: offset(8) },
      { role: "한의사",     name: "박서영", licenseNo: "23456", acquired: "1998-02-27", reported: "",              cme: offset(-1) },
      { role: "간호사",     name: "이민하", licenseNo: "345678", acquired: "2014-02-25", reported: offset(5 - 36),  cme: offset(11) },
      { role: "물리치료사", name: "김도현", licenseNo: "45678", acquired: "2016-03-01", reported: offset(22 - 36), cme: offset(4) },
      { role: "간호조무사", name: "최유진", licenseNo: "567890", acquired: "2018-01-20", reported: offset(-2 - 36), cme: offset(7) },
      { role: "원무",       name: "한지원", licenseNo: "", acquired: "", reported: "", cme: "" }
    ].map(x => ({ ...x, id: "lic-sample-" + x.name, ...computeDue(x) }));
    Store.set("license.list", sample);
    ActivityLog.push("license", `샘플 직원 ${sample.length}명 등록`, {});
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
      const duty = ROLE_DUTY[lic.role];
      if (duty && lic.expiry) ics.push("BEGIN:VEVENT",
        `UID:${lic.id}-exp@vibe-clinic-admin`,
        `DTSTAMP:${fmt(todayISO())}Z`, `DTSTART:${fmt(lic.expiry)}`,
        `DTEND:${fmt(lic.expiry).slice(0,11)}5959`,
        `SUMMARY:${lic.role} ${lic.name} — 면허신고 기한${lic.basis === "acquired" ? " (신고 이력 미확인)" : ""}`,
        "BEGIN:VALARM","TRIGGER:-P30D","ACTION:DISPLAY",
        `DESCRIPTION:면허신고 기한 (${duty.law} · ${lic.basis === "acquired" ? "취득일" : "신고일"} + ${duty.years}년)`,"END:VALARM",
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
      if (!hasDuty(l.role)) return `• ${l.role} ${l.name} · 면허신고 해당 없음 · 보수교육 ${l.cme || "—"}`;
      const expDays = daysUntil(l.expiry);
      const tag = expDays == null ? "—" : (expDays < 0 ? `D+${-expDays}` : `D-${expDays}`);
      return `• ${l.role} ${l.name} · 면허신고 기한 ${l.expiry || "—"} (${tag})${l.basis === "acquired" ? " · 신고 이력 미확인" : ""} · 보수교육 ${l.cme || "—"}`;
    });
    const text = `[한방병원 면허·자격 명부]\n${lines.join("\n")}\n\n— ${todayISO()} 기준`;
    await Share.send({ title: "면허·자격 명부", text });
    ActivityLog.push("license", "면허 명부 공유", {});
  });

  // Per-role 협회 links for the caveat (URLs marked 확인 필요 in the HTML).
  const orgEl = $("#lic-orgs");
  if (orgEl) orgEl.innerHTML = Object.entries(ROLE_DUTY).map(([role, d]) =>
    `${esc(role)} → <a class="small-link" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.org)}</a> (${esc(d.law)})`
  ).join(" · ");

  EventBus.on("store:license.list", renderList);
  syncRoleFields();
  renderList();
}
