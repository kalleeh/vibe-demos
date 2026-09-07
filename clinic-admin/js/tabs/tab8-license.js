/* clinic-admin — Tab 08 · 직원 명부 — 면허·자격 + 로그인 (the roster UI over core/entities.js Staff) */
import { $, $$, esc, todayISO, daysUntil, Haptic, Toast, Lightbox, Share, bindCameraButton, roleLabel, emptyHTML } from "../core/ui.js";
import { t, getLang, onLangChange } from "../core/i18n.js";
import { EventBus, ActivityLog } from "../core/store.js";
import { Attachments } from "../core/attachments.js";
import { OCR } from "../core/ocr.js";
import { downloadText, pocMark } from "../core/files.js";
import { Staff } from "../core/entities.js";
import { Session } from "../security/session.js";

/* ─────────────────────────────────────────────────────────
   Tab 8 — 직원 명부 (면허·자격 트래커 + 로그인)
   Row (Staff): { id, name, job, licenseNo, acquired, reported, cme, note, userId, expiry, basis }
   · expiry = reported + 3y when the last 신고일 is known, = acquired + 3y flagged basis:"acquired"
     ("신고 이력 미확인") otherwise, = "" for jobs with no 신고 duty (행정 · 원무 · 기타). Computed by Staff.
   · 면허증 OCR reads 면허번호 + 취득일 — a card never shows a 신고일.
   · 로그인 column: a row may carry a SERVER login (shared identity: Staff.issueLogin → Cloud.createUser with a temp PIN,
     the person sets their own PIN at first login) — issue / revoke is 원장 only; "원장 권한" marks the logins that
     administer the workspace. The 사용자 panel is the server directory joined with these rows.
   i18n: job VALUES stay Korean (stored); labels, laws and association names resolve through
   common.roleShort.* / license.law.* / license.org.* so the register, .ics and share text follow the language.
   ───────────────────────────────────────────────────────── */

// The roster is a shared entity: shell.seedAll() seeds it (seedEntities) before calling tab seeds — nothing to add here.
export function seed() {}

const lawOf = (job) => t("license.law." + job);
const orgOf = (job) => t("license.org." + job);

export function init() {
  // Audit entries never carry the staff name in `text`; the pseudonymised subject
  // ("한의사 윤○○") is derived by ActivityLog from meta.subject = { role, name }.
  const subj = (row) => ({ subject: { role: row.job, name: row.name } });

  let editingId = null, loginFor = null, highlightId = null;
  const setEditing = (on) => {
    $("#lic-add-btn").textContent = t(on ? "common.save" : "common.add");
    $("#lic-cancel").style.display = on ? "" : "none";
  };
  const resetForm = () => {
    editingId = null;
    ["lic-name", "lic-no", "lic-acquired", "lic-reported", "lic-cme"].forEach(id => { $("#" + id).value = ""; });
    setEditing(false);
  };
  // 행정·원무·기타 have no 신고 duty — grey out the licence fields in the form.
  const syncRoleFields = () => {
    const duty = Staff.hasDuty($("#lic-role").value);
    ["lic-acquired", "lic-reported", "lic-no"].forEach(id => { $("#" + id).disabled = !duty; });
    $("#lic-role-note").textContent = duty ? "" : t("license.noDutyNote");
  };
  $("#lic-role").addEventListener("change", syncRoleFields);

  /* ── login form (inline, below the list) ── */
  const loginForm = () => $("#lic-login-form");
  const showLogin = (row) => {
    loginFor = row.id;
    $("#lic-login-who").textContent = t("license.loginWho", { name: row.name, job: roleLabel(row.job) });
    $("#lic-login-role").value = row.job === "행정" ? "행정" : row.job === "원무" ? "원무" : "행정";
    $("#lic-login-pin").value = "";
    loginForm().hidden = false;
    loginForm().scrollIntoView({ block: "nearest", behavior: "smooth" });
    setTimeout(() => $("#lic-login-pin").focus(), 30);
  };
  const hideLogin = () => { loginFor = null; loginForm().hidden = true; $("#lic-login-pin").value = ""; };
  $("#lic-login-cancel").addEventListener("click", () => { hideLogin(); Haptic.tap(); });
  $("#lic-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const row = loginFor && Staff.get(loginFor);
    if (!row) { hideLogin(); return; }
    const sysRole = $("#lic-login-role").value, pin = $("#lic-login-pin").value;
    const btn = $("#lic-login-ok"); btn.disabled = true;
    try {
      await Staff.issueLogin(row.id, { sysRole, pin });
      ActivityLog.push("license", t("license.logLoginIssued", { role: roleLabel(sysRole) }), subj(row));
      Toast.show({ tag: "license", html: esc(t("license.loginIssuedToast", { who: Staff.ref(row), role: roleLabel(sysRole) })) });
      Haptic.save();
      hideLogin();
    } catch (err) {
      Toast.show({ tag: "license", html: esc(err.message || String(err)) });
      Haptic.warn();
    } finally { btn.disabled = false; }
    renderList();
  });

  const renderList = () => {
    const list = Staff.list();
    const owner = Session.isOwner(), me = Session.user();
    if (!list.length) {
      $("#lic-list").innerHTML = emptyHTML(esc(t("license.emptyList")), { demoOnly: true });
      $("#lic-summary").textContent = t("license.summary", { n: 0, i: 0, l: 0 });
      return;
    }
    let imminent = 0, logins = 0;
    const html = list.map(lic => {
      const duty = Staff.hasDuty(lic.job);
      const expDays = duty ? daysUntil(lic.expiry) : null;
      const cmeDays = daysUntil(lic.cme);
      const minDays = Math.min(expDays ?? 99999, cmeDays ?? 99999);
      let cls = "", note = "";
      if (minDays < 0) { cls = "urgent"; note = t("license.overdue", { n: -minDays }); imminent++; }
      else if (minDays <= 90) { cls = "urgent"; note = t("license.daysLeft", { n: minDays }); imminent++; }
      else if (minDays <= 180) { cls = "warn"; note = t("license.daysLeft", { n: minDays }); }
      else if (minDays !== 99999) { note = t("license.daysLeft", { n: minDays }); }
      else if (!duty) { note = t("license.na"); }
      const dueText = !duty ? esc(t("license.noDuty"))
        : !lic.expiry ? esc(t("license.needDate"))
        : lic.basis === "acquired"
          ? t("license.dueAcquired", { d: esc(lic.expiry), flag: esc(t("license.unverifiedFlag")), acq: esc(lic.acquired) })
          : esc(t("license.dueReported", { d: lic.expiry, r: lic.reported }));
      const noText = lic.licenseNo ? esc(t("license.noText", { no: lic.licenseNo })) : "";
      // 로그인 column — badge for a linked login (원장 권한 when it administers the workspace) + 원장-only actions.
      const login = Staff.loginOf(lic);
      if (login) logins++;
      const loginCell = login
        ? `<span class="sec-tag${login.role === "원장" ? " owner" : ""}" title="${esc(t("license.loginTagTitle"))}">${esc(login.role === "원장" ? t("license.ownerTag") : t("license.loginTag", { role: roleLabel(login.role) }))}</span>${login.id === me?.id ? `<span class="lic-me">${esc(t("license.meTag"))}</span>` : ""}
           ${owner && login.id !== me?.id ? `<button type="button" class="lic-link" data-id="${esc(lic.id)}" data-act="revoke">${esc(t("license.revokeLogin"))}</button>` : ""}`
        : owner ? `<button type="button" class="lic-link" data-id="${esc(lic.id)}" data-act="login">${esc(t("license.issueLogin"))}</button>`
                : `<span class="lic-nologin">${esc(t("license.noLogin"))}</span>`;
      return `
        <div class="lic ${cls}${lic.id === highlightId ? " highlight" : ""}" data-id="${esc(lic.id)}">
          <span class="lic-role">${esc(roleLabel(lic.job))}</span>
          <span class="lic-name">${esc(lic.name)}
            <span class="lic-meta">${dueText}${noText}${esc(t("license.cmeMeta", { cme: lic.cme || "—" }))}</span>
            <span class="attach-row" data-attach-row data-owner="${esc(lic.id)}"></span>
            <span class="lic-login">${loginCell}</span>
          </span>
          <span class="lic-due">${note}</span>
          <span class="lic-actions">
            ${duty ? `<label class="icon-btn" data-act="cam" data-id="${esc(lic.id)}" title="${esc(t("license.camTitle"))}" aria-label="${esc(t("license.camAria"))}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <input type="file" accept="image/*" capture="environment">
            </label>` : ""}
            <button data-id="${esc(lic.id)}" data-act="edit" title="${esc(t("common.edit"))}">✎</button>
            <button data-id="${esc(lic.id)}" data-act="del" title="${esc(t("common.delete"))}">×</button>
          </span>
        </div>`;
    }).join("");
    $("#lic-list").innerHTML = html;
    $("#lic-summary").textContent = t("license.summary", { n: list.length, i: imminent, l: logins });

    $$("#lic-list .lic-actions > button, #lic-list .lic-login > button").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        const row = list.find(x => x.id === id);
        if (!row) return;
        if (b.dataset.act === "del") {
          // No confirm — the row (and its IndexedDB attachments, which are keyed by id and left untouched)
          // comes back from the undo toast for 6 s. A row with a login must have it revoked first.
          const idx = list.findIndex(x => x.id === id);
          let removed;
          try { removed = Staff.remove(id); } catch (err) { Toast.show({ tag: "license", html: esc(err.message || String(err)) }); Haptic.warn(); return; }
          if (!removed) return;
          if (editingId === id) resetForm();
          ActivityLog.push("license", t("license.logDelete"), { silent: true, ...subj(removed) });
          Haptic.del();
          Toast.withUndo(t("license.removedToast", { who: Staff.ref(removed) }), () => {
            Staff.insert(removed, idx);
            ActivityLog.push("license", t("license.logUndo"), { silent: true, ...subj(removed) });
          }, "license");
        } else if (b.dataset.act === "edit") {
          // Edit in place — the record (and its IndexedDB attachments keyed by id) stays put until 저장.
          editingId = id;
          $("#lic-role").value = row.job;
          $("#lic-name").value = row.name;
          $("#lic-no").value = row.licenseNo || "";
          $("#lic-acquired").value = row.acquired || "";
          $("#lic-reported").value = row.reported || "";
          $("#lic-cme").value = row.cme || "";
          syncRoleFields();
          setEditing(true);
          $("#lic-name").focus();
          Haptic.tap();
        } else if (b.dataset.act === "login") {
          showLogin(row);
        } else if (b.dataset.act === "revoke") {
          if (!confirm(t("license.confirmRevoke", { who: Staff.ref(row) }))) return;
          b.disabled = true;
          // Server call (DELETE /api/clinic/users/{id}) — async; the roster re-renders on Staff.onChange.
          Staff.revokeLogin(id).then(() => {
            ActivityLog.push("license", t("license.logLoginRevoked"), subj(row));
            Toast.show({ tag: "license", html: esc(t("license.loginRevokedToast", { who: Staff.ref(row) })) });
            Haptic.del();
          }).catch((err) => { b.disabled = false; Toast.show({ tag: "license", html: esc(err.message || String(err)) }); Haptic.warn(); });
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
        shim.innerHTML = `<span class="dot"></span>${esc(t("license.ocrRunning"))}`;
        dueEl.appendChild(shim);
        try {
          const { issued, licenseNo } = await OCR.run(dataUrl, m => {
            if (m.status && m.progress != null) {
              const pct = Math.round(m.progress * 100);
              shim.innerHTML = `<span class="dot"></span>${esc(m.status)} ${pct}%`;
            }
          });
          if (issued || licenseNo) {
            const target = Staff.get(ownerId);
            if (target) {
              const patch = {};
              if (issued) patch.acquired = issued;
              if (licenseNo) patch.licenseNo = licenseNo;
              Staff.update(ownerId, patch);
              ActivityLog.push("license", t("license.ocrLog", { what: [issued && t("license.acquiredWord"), licenseNo && t("license.licNoWord")].filter(Boolean).join("·") }), subj(target));
            }
            shim.classList.add("success");
            shim.innerHTML = esc(t("license.ocrDone", { parts: [issued && t("license.ocrAcq", { d: issued }), licenseNo && t("license.ocrNo", { n: licenseNo })].filter(Boolean).join(" · ") }));
            setTimeout(() => shim.remove(), 2500);
          } else {
            shim.classList.add("fail");
            shim.innerHTML = esc(t("license.ocrFail"));
            setTimeout(() => shim.remove(), 2500);
          }
        } catch (err) {
          console.error(err);
          shim.classList.add("fail");
          shim.textContent = `× ${err.message || t("license.ocrErr")}`;
          Toast.show({ tag: "license", html: esc(err.message || t("license.ocrErr")) });
          setTimeout(() => shim.remove(), 4000);
        }
        renderAttachments(ownerId);
      });
    });

    // ── Render existing attachments (async) ──
    $$("#lic-list [data-attach-row]").forEach(el => { renderAttachments(el.dataset.owner); });

    if (highlightId) {
      const el = $(`#lic-list .lic[data-id="${highlightId}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      highlightId = null;
    }
  };

  async function renderAttachments(ownerId) {
    const row = $(`#lic-list [data-attach-row][data-owner="${ownerId}"]`);
    if (!row) return;
    const atts = await Attachments.getByOwner(ownerId);
    if (!atts.length) { row.innerHTML = ""; return; }
    row.innerHTML = atts.map(a => `
      <span class="attach-thumb" data-att="${a.id}">
        <img src="${a.data}" alt="${esc(t("license.attachAlt"))}">
        <span class="x" data-att="${a.id}" title="${esc(t("common.delete"))}">×</span>
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
        if (att) Toast.withUndo(t("license.attachRemoved"), async () => {
          await Attachments.put(att); // same id + timestamp → same slot
          renderAttachments(ownerId);
        }, "license");
      });
    });
  }

  $("#lic-add-btn").addEventListener("click", () => {
    const job = $("#lic-role").value;
    const name = $("#lic-name").value.trim();
    const duty = Staff.hasDuty(job);
    const rec = {
      name, job,
      licenseNo: duty ? $("#lic-no").value.trim() : "", acquired: duty ? $("#lic-acquired").value : "", reported: duty ? $("#lic-reported").value : "",
      cme: $("#lic-cme").value
    };
    if (!name) { Haptic.warn(); alert(t("license.alertName")); return; }
    try {
      if (editingId) {
        const row = Staff.update(editingId, rec);
        ActivityLog.push("license", t("license.logEdit"), subj(row));
      } else {
        const id = Staff.add(rec);
        ActivityLog.push("license", t("license.logAdd"), subj(Staff.get(id)));
      }
    } catch (err) { Toast.show({ tag: "license", html: esc(err.message || String(err)) }); Haptic.warn(); return; }
    Haptic.save();
    resetForm();
    syncRoleFields();
  });
  $("#lic-cancel").addEventListener("click", () => { resetForm(); syncRoleFields(); Haptic.tap(); });

  $("#lic-ics").addEventListener("click", () => {
    const list = Staff.list();
    if (!list.length) { alert(t("license.alertNoStaff")); return; }
    const pad = n => String(n).padStart(2, "0");
    const fmt = d => {
      const dt = new Date(d + "T09:00:00");
      return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T090000`;
    };
    const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/[,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
    // PoC watermark: calendar-level notice + every event DESCRIPTION opens with the mark (UI language).
    const mark = pocMark();
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//Vibe Studio//Clinic Admin//${getLang().toUpperCase()}`, `X-POC-NOTICE:${icsText(mark)}`];
    for (const lic of list) {
      const duty = Staff.DUTY[lic.job];
      const role = roleLabel(lic.job);
      if (duty && lic.expiry) ics.push("BEGIN:VEVENT",
        `UID:${lic.id}-exp@vibe-clinic-admin`,
        `DTSTAMP:${fmt(todayISO())}Z`, `DTSTART:${fmt(lic.expiry)}`,
        `DTEND:${fmt(lic.expiry).slice(0,11)}5959`,
        `SUMMARY:${icsText(t("license.icsReport", { role, name: lic.name, flag: lic.basis === "acquired" ? t("license.icsUnverified") : "" }))}`,
        `DESCRIPTION:${icsText(t("license.icsReportDesc", { mark, law: lawOf(lic.job), basis: t(lic.basis === "acquired" ? "license.basisAcquired" : "license.basisReported"), y: duty.years }))}`,
        "BEGIN:VALARM","TRIGGER:-P30D","ACTION:DISPLAY",
        `DESCRIPTION:${icsText(t("license.icsAlarm", { law: lawOf(lic.job) }))}`,"END:VALARM",
        "END:VEVENT");
      if (lic.cme) ics.push("BEGIN:VEVENT",
        `UID:${lic.id}-cme@vibe-clinic-admin`,
        `DTSTAMP:${fmt(todayISO())}Z`, `DTSTART:${fmt(lic.cme)}`,
        `DTEND:${fmt(lic.cme).slice(0,11)}5959`,
        `SUMMARY:${icsText(t("license.icsCme", { role, name: lic.name }))}`,
        `DESCRIPTION:${icsText(t("license.icsCmeDesc", { mark }))}`,
        "BEGIN:VALARM","TRIGGER:-P30D","ACTION:DISPLAY",
        `DESCRIPTION:${icsText(t("license.icsCmeAlarm"))}`,"END:VALARM",
        "END:VEVENT");
    }
    ics.push("END:VCALENDAR");
    downloadText(ics.join("\r\n"), `licenses_${todayISO()}.ics`, "text/calendar;charset=utf-8"); // filename → _PoC
    ActivityLog.push("license", t("license.logIcs"), {});
  });

  $("#lic-share")?.addEventListener("click", async () => {
    const list = Staff.list();
    if (!list.length) { alert(t("license.alertNoStaff")); return; }
    const lines = list.map(l => {
      const role = roleLabel(l.job);
      if (!Staff.hasDuty(l.job)) return t("license.shareNoDuty", { role, name: l.name, cme: l.cme || "—" });
      const expDays = daysUntil(l.expiry);
      const tag = expDays == null ? "—" : (expDays < 0 ? `D+${-expDays}` : `D-${expDays}`);
      return t("license.shareLine", { role, name: l.name, d: l.expiry || "—", tag, flag: l.basis === "acquired" ? t("license.shareFlag") : "", cme: l.cme || "—" });
    });
    const text = t("license.shareText", { lines: lines.join("\n"), date: todayISO() });
    await Share.send({ title: t("license.shareTitle"), text });
    ActivityLog.push("license", t("license.logShare"), {});
  });

  // Per-job 협회 links for the caveat (URLs marked 확인 필요 in the HTML). Re-filled after a language swap
  // (the caveat is a data-i18n-html block, so the #lic-orgs span is re-created).
  const renderOrgs = () => {
    const orgEl = $("#lic-orgs");
    if (orgEl) orgEl.innerHTML = Object.entries(Staff.DUTY).map(([job, d]) =>
      `${esc(roleLabel(job))} → <a class="small-link" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(orgOf(job))}</a> (${esc(lawOf(job))})`
    ).join(" · ");
  };
  renderOrgs();

  // Re-render on roster changes (local or peer tab), on user switch (owner-only buttons) and when another surface
  // lands here with { staffId } (dashboard deadline, palette, topbar chip).
  Staff.onChange(renderList);
  EventBus.on("session:unlocked", renderList);
  EventBus.on("session:users", renderList);
  EventBus.on("tab:activated", (p) => { if (p?.id === "tab-license" && p.ctx?.staffId) { highlightId = p.ctx.staffId; renderList(); } });
  syncRoleFields();
  renderList();

  onLangChange(() => { renderOrgs(); setEditing(!!editingId); syncRoleFields(); renderList(); if (loginFor) { const r = Staff.get(loginFor); if (r) $("#lic-login-who").textContent = t("license.loginWho", { name: r.name, job: roleLabel(r.job) }); } });
}
