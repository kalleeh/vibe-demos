/* clinic-admin — security UI: lock screen (first-run setup / unlock / backup restore), idle + visibility
   auto-lock, the 사용자 panel, the 데이터 처리 현황 panel, the PoC banner and the topbar user chip.
   Import position: files/lifecycle → lockscreen → shell (never imported by core/ or tabs/).

   Boot contract: shell.boot() awaits Lock.ready() before loading data and initialising tabs, so
   every tab always starts with an unlocked Store. Later locks just drop the key + cover the UI;
   the next unlock re-decrypts and re-emits `store:<key>` so tab renders refresh.
   i18n: every string goes through t(); the lock screen works while locked because core/i18n.js is a leaf
   (plain localStorage, not a Store key). onLangChange re-paints whatever pane/panel is open. */
import { $, $$, esc, Toast, Dialog, relTime, roleLabel } from "../core/ui.js";
import { t, getLang, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { downloadCSV } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Staff, JOB_FOR_SYSROLE } from "../core/entities.js";
import { Session } from "./session.js";
import { inventory, purgeExpired, destroy, destroyAll, exportBackup, parseBackup, restoreBackup } from "./lifecycle.js";

const HIDDEN_LOCK_MS = 60000;
const fmtDT = (ts) => ts ? new Date(ts).toLocaleString(getLang() === "en" ? "en-GB" : "ko-KR", { hour12: false }) : "—";
// Typed confirmation for 전체 파기 — the Korean word in both languages, plus DESTROY for the English reviewer.
const isDestroyWord = (s) => { const v = String(s ?? "").trim(); return v === "파기" || v.toUpperCase() === "DESTROY"; };

/* ─────────────────────────── Lock screen ─────────────────────────── */
const Lock = (() => {
  const scrim = () => $("#lock-scrim");
  let readyResolve;
  const ready = new Promise(res => { readyResolve = res; });
  let booted = false, selectedUser = null, countdownT = null, idleT = null, hiddenT = null, hiddenAt = 0, lastReset = 0;
  let restoreBk = null, pane = "unlock", reason = "", backoffShown = false;
  let created = false; // this page load created the workspace → shell shows the 기관 정보 first-run step

  function closeAllDialogs() {
    $$(".welcome-scrim.open, .search-scrim.open, .lightbox.open").forEach(s => Dialog.close(s));
    document.body.classList.remove("more-open");
    EventBus.emitLocal("shell:closeAll", true); // shell: ⋯ sheet + AI drawer
  }
  function showPane(name) {
    pane = name;
    ["setup", "unlock", "restore"].forEach(p => { const el = $(`#lock-${p}`); if (el) el.hidden = p !== name; });
    const tt = $("#lock-title");
    if (tt) tt.innerHTML = t(name === "setup" ? "lock.title.setup" : name === "restore" ? "lock.title.restore" : "lock.title.locked");
  }
  function setErr(id, msg) { const el = $(id); if (!el) return; el.textContent = msg || ""; el.hidden = !msg; }
  function renderReason() {
    const why = $("#lock-reason"); if (!why) return;
    why.textContent = reason === "idle" ? t("lock.reasonIdle", { m: Session.autolockMin() })
      : reason === "hidden" ? t("lock.reasonHidden")
      : reason === "manual" ? t("lock.reasonManual") : "";
    why.hidden = !why.textContent;
  }

  function renderUsers() {
    const list = $("#lock-users"); if (!list) return;
    const users = Session.users();
    if (!users.find(u => u.id === selectedUser)) selectedUser = users[0]?.id || null;
    list.innerHTML = users.map(u => `
      <button type="button" class="lock-user${u.id === selectedUser ? " sel" : ""}" data-id="${esc(u.id)}" role="radio" aria-checked="${u.id === selectedUser}">
        <span class="lu-name">${esc(u.name)}</span><span class="lu-role">${esc(roleLabel(u.role))}</span>
      </button>`).join("");
    list.querySelectorAll(".lock-user").forEach(b => b.addEventListener("click", () => {
      selectedUser = b.dataset.id; renderUsers(); $("#lock-pin")?.focus(); setErr("#lock-err", ""); armBackoff();
    }));
  }
  // Disable the submit while the selected user is in backoff; show a live countdown.
  function armBackoff() {
    clearInterval(countdownT);
    const btn = $("#lock-submit");
    const tick = () => {
      const u = Session.users().find(x => x.id === selectedUser);
      const left = u ? Math.ceil(((u.lockedUntil || 0) - Date.now()) / 1000) : 0;
      if (left > 0) { btn.disabled = true; backoffShown = true; setErr("#lock-err", t("lock.errBackoff", { s: left })); }
      else { btn.disabled = false; clearInterval(countdownT); if (backoffShown) { backoffShown = false; setErr("#lock-err", ""); } }
    };
    tick();
    countdownT = setInterval(tick, 250);
  }

  function open(why) {
    const sc = scrim(); if (!sc) return;
    closeAllDialogs();
    document.body.classList.add("locked");
    const shell = $(".frame.shell"); if (shell) shell.inert = true;
    sc.classList.add("open");
    reason = why || "";
    renderReason();
    if (Session.exists()) { showPane("unlock"); renderUsers(); armBackoff(); setTimeout(() => $("#lock-pin")?.focus(), 30); }
    else { showPane("setup"); setTimeout(() => $("#setup-name")?.focus(), 30); }
    $$("#lock-scrim input[type=password]").forEach(i => { i.value = ""; });
    updateChip();
  }
  function close() {
    const sc = scrim(); if (!sc) return;
    sc.classList.remove("open");
    document.body.classList.remove("locked");
    const shell = $(".frame.shell"); if (shell) shell.inert = false;
    updateChip();
  }

  /* ── idle / visibility auto-lock ── */
  function armIdle() {
    clearTimeout(idleT);
    if (!Session.isUnlocked()) return;
    idleT = setTimeout(() => lock("idle"), Session.autolockMin() * 60000);
  }
  function onActivity() {
    const now = Date.now();
    if (now - lastReset < 1000) return; // throttle
    lastReset = now;
    armIdle();
  }
  ["pointerdown", "keydown", "touchstart", "wheel"].forEach(ev => document.addEventListener(ev, onActivity, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      clearTimeout(hiddenT);
      if (Session.isUnlocked()) hiddenT = setTimeout(() => lock("hidden"), HIDDEN_LOCK_MS);
    } else {
      clearTimeout(hiddenT);
      if (hiddenAt && Date.now() - hiddenAt > HIDDEN_LOCK_MS && Session.isUnlocked()) lock("hidden");
      hiddenAt = 0;
      armIdle();
    }
  });

  function lock(why = "manual") {
    if (!Session.isUnlocked()) return;
    clearTimeout(idleT); clearTimeout(hiddenT);
    ActivityLog.add({ tag: "system", action: t("lock.logLock", { why: t(why === "idle" ? "lock.whyIdle" : why === "hidden" ? "lock.whyHidden" : "lock.whyManual") }), meta: { silent: true } });
    Session.lock(why); // → store bridge → session:locked → open()
  }

  function renderRestoreMeta() {
    if (!restoreBk) return;
    const el = $("#restore-meta"); if (!el) return;
    el.textContent = t("lock.restoreMeta", { dt: fmtDT(Date.parse(restoreBk.exportedAt)), n: Object.keys(restoreBk.sensitive || {}).length, a: (restoreBk.attachments || []).length });
    const sel = $("#restore-user"); if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = restoreBk.keyring.users.map(u => `<option value="${esc(u.id)}">${esc(u.name)} · ${esc(roleLabel(u.role))}</option>`).join("");
    if (cur) sel.value = cur;
  }

  /* ── wiring ── */
  function wire() {
    // Setup
    $("#lock-setup")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#setup-name").value.trim(), role = $("#setup-role").value, pin = $("#setup-pin").value, pin2 = $("#setup-pin2").value;
      if (pin !== pin2) { setErr("#setup-err", t("lock.errPinMismatch")); return; }
      const btn = $("#setup-submit"); btn.disabled = true; btn.textContent = t("lock.creating");
      try {
        await Session.create({ name, role, pin });
        created = true;
      } catch (err) { setErr("#setup-err", err.message || String(err)); }
      finally { btn.disabled = false; btn.textContent = t("lock.createBtn"); }
    });
    // Unlock
    $("#lock-pin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedUser) { setErr("#lock-err", t("lock.errPickUser")); return; }
      const pin = $("#lock-pin").value;
      const btn = $("#lock-submit"); btn.disabled = true; btn.textContent = t("lock.checking");
      try {
        await Session.unlock(selectedUser, pin);
        // success → session:unlocked handler closes the screen
      } catch (err) {
        $("#lock-pin").value = "";
        if (err.code === "pin-format") setErr("#lock-err", t("lock.errPinFormat"));
        else if (err.code === "backoff" || err.code === "wrong-pin") armBackoff();
        else setErr("#lock-err", err.message || t("lock.errUnlock"));
      } finally { btn.textContent = t("lock.unlockBtn"); armBackoff(); /* re-enables unless the user is in backoff */ }
    });
    $$("#lock-goto-restore, #lock-goto-restore2").forEach(b => b.addEventListener("click", () => openRestore()));
    $("#restore-back")?.addEventListener("click", () => { restoreBk = null; open(); });
    $("#restore-file")?.addEventListener("change", async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      setErr("#restore-err", "");
      try {
        restoreBk = parseBackup(await f.text());
        renderRestoreMeta();
        $("#restore-step2").hidden = false;
      } catch (err) { restoreBk = null; $("#restore-step2").hidden = true; setErr("#restore-err", err.message); }
    });
    $("#restore-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!restoreBk) { setErr("#restore-err", t("lock.errNoFile")); return; }
      if (Session.exists() && !confirm(t("lock.restoreConfirm"))) return;
      const btn = $("#restore-submit"); btn.disabled = true; btn.textContent = t("lock.restoring");
      try {
        const wasBooted = booted;
        const r = await restoreBackup(restoreBk, $("#restore-user").value, $("#restore-pin").value);
        restoreBk = null;
        Toast.show({ tag: "system", html: t("lock.restoredToast", { n: r.keys, a: r.attachments }) });
        if (wasBooted) setTimeout(() => location.reload(), 600); // tabs were initialised on the old data
      } catch (err) {
        setErr("#restore-err", err.name === "OperationError" || /wrong|decrypt/i.test(err.message || "") ? t("lock.errWrongPin") : (err.message || t("lock.errRestore")));
      } finally { btn.disabled = false; btn.textContent = t("lock.restoreBtn"); }
    });
    $("#rail-lock")?.addEventListener("click", () => lock("manual"));
    $("#topbar-lock")?.addEventListener("click", () => lock("manual"));

    EventBus.on("session:unlocked", async () => {
      await Store.whenUnlocked();
      try { await purgeExpired(); } catch (e) { console.warn("purge", e); }
      close();
      armIdle();
      const u = Session.user();
      if (booted) Toast.show({ tag: "system", html: t("lock.unlockedToast", { name: esc(u.name), role: esc(roleLabel(u.role)) }) });
      if (!booted) { booted = true; readyResolve(u); }
      ActivityLog.add({ tag: "system", action: t("lock.logUnlock"), meta: { silent: true } });
    });
    EventBus.on("session:locked", (why) => open(why));
    EventBus.on("session:users", () => { if (scrim()?.classList.contains("open")) renderUsers(); updateChip(); });
    // Language toggle while the lock screen is up: static copy is already swapped by applyStatic; redo the
    // dynamic parts (title, reason line, user roles, restore meta, any backoff countdown).
    onLangChange(() => {
      if (!scrim()?.classList.contains("open")) return;
      showPane(pane); renderReason();
      if (pane === "unlock") { renderUsers(); armBackoff(); }
      if (pane === "restore") renderRestoreMeta();
    });
  }

  function openRestore() {
    if (Session.isUnlocked()) Session.lock("restore");
    const sc = scrim(); if (sc && !sc.classList.contains("open")) open("restore");
    showPane("restore");
    $("#restore-step2").hidden = true; setErr("#restore-err", "");
    const f = $("#restore-file"); if (f) f.value = "";
    restoreBk = null;
  }

  function init() {
    wire();
    open();
    return ready;
  }
  return { init, ready: () => ready, lock, open, openRestore, armIdle, justCreated: () => created };
})();

/* topbar user chip */
function updateChip() {
  const chip = $("#topbar-user"); if (!chip) return;
  const u = Session.user();
  chip.style.display = u ? "inline-flex" : "none";
  const tt = $("#topbar-user-text"); if (tt && u) tt.textContent = `${u.name} · ${roleLabel(u.role)}`;
}

/* ─────────────────────────── 사용자 panel ───────────────────────────
   A thin view over the roster (core/entities.js Staff): every login IS a staff row with a userId. Rows show the
   system role (원장·행정·원무) next to the job; "삭제" here is Staff.revokeLogin (the person stays in the roster,
   only the PIN goes). Adding a user creates/links a roster row and issues the login — 원장 only. */
const UsersPanel = (() => {
  const scrim = () => $("#users-scrim");
  const msg = (text, kind = "") => { const el = $("#users-msg"); if (!el) return; el.textContent = text || ""; el.className = "sec-msg " + kind; el.hidden = !text; };
  // Audit subject for a login row: the pseudonymised staff reference ("한의사 윤○○"), never the name.
  const subj = (s, u) => (s ? Staff.ref(s) : (u ? roleLabel(u.role) : null));
  function render() {
    const me = Session.user(); if (!me) return;
    const owner = Session.isOwner();
    $("#users-me").innerHTML = `<strong>${esc(me.name)}</strong> · ${esc(roleLabel(me.role))}${owner ? ` <span class="sec-tag">${esc(t("users.adminTag"))}</span>` : ""}`;
    $("#users-autolock").value = String(Session.autolockMin());
    const staff = Staff.list();
    const rows = Session.users().map(u => ({ u, s: staff.find(x => x.userId === u.id) || staff.find(x => x.id === u.staffId) || null }));
    $("#users-list").innerHTML = rows.map(({ u, s }) => `
      <div class="sec-row" data-user="${esc(u.id)}">
        <span class="sec-name">${esc(u.name)}${u.role === "원장" ? ` <span class="sec-tag">${esc(t("users.ownerTag"))}</span>` : ""}</span>
        <span class="sec-role">${esc(roleLabel(u.role))}${s ? ` · ${esc(roleLabel(s.job))}` : ""}</span>
        <span class="sec-meta">${u.aiConsent ? esc(t("users.aiConsentAt", { dt: fmtDT(u.aiConsent.at) })) : esc(t("users.noAiConsent"))}</span>
        <span class="sec-actions">
          ${owner && u.id !== me.id ? `<button type="button" class="btn secondary sm" data-act="reset" data-id="${esc(u.id)}">${esc(t("users.resetPin"))}</button>
          <button type="button" class="btn secondary sm" data-act="remove" data-id="${esc(u.id)}" data-staff="${esc(s?.id || "")}">${esc(t("users.revokeLogin"))}</button>` : ""}
          ${u.aiConsent ? `<button type="button" class="btn secondary sm" data-act="revoke" data-id="${esc(u.id)}" ${owner || u.id === me.id ? "" : "disabled"}>${esc(t("users.revokeAi"))}</button>` : ""}
        </span>
      </div>`).join("");
    // Issuing a login is a 원장 action (Staff.issueLogin enforces it) — the form is read-only for everyone else.
    $$("#users-add-form input, #users-add-form select, #users-add-form button").forEach(el => { el.disabled = !owner; });
    const note = $("#users-add-note"); if (note) note.textContent = owner ? t("users.addNoteOwner") : t("common.ownerRequired");
    $$("#users-list [data-act]").forEach(b => b.addEventListener("click", async () => {
      const id = b.dataset.id, u = Session.users().find(x => x.id === id);
      const s = staff.find(x => x.userId === id) || null;
      const who = { name: u.name, role: roleLabel(u.role) };
      try {
        if (b.dataset.act === "reset") {
          const pin = prompt(t("users.promptNewPin", who)); if (pin == null) return;
          await Session.resetPin(id, pin.trim());
          ActivityLog.add({ tag: "system", action: t("users.logReset", { role: who.role }), subject: subj(s, u) });
          msg(t("users.msgReset"), "ok");
        } else if (b.dataset.act === "remove") {
          if (!confirm(t("users.confirmRevokeLogin", who))) return;
          if (s) Staff.revokeLogin(s.id); else Session.removeUser(id);
          ActivityLog.add({ tag: "system", action: t("users.logRevokeLogin", { role: who.role }), subject: subj(s, u) });
          msg(t("users.msgLoginRevoked"), "ok");
        } else if (b.dataset.act === "revoke") {
          Session.updateUser(id, { aiConsent: null });
          ActivityLog.add({ tag: "system", action: t("users.logRevoke", { role: who.role }), subject: subj(s, u) });
          msg(t("users.msgRevoked"), "ok");
        }
      } catch (err) { msg(err.message || String(err), "err"); }
      render();
    }));
  }
  /* Add = find the roster row with that exact name and no login (link it) or create one, then issue the login. */
  async function addLogin({ name, role, pin }) {
    const clean = String(name || "").trim();
    let row = Staff.list().find(x => !x.userId && x.name === clean);
    const id = row ? row.id : Staff.add({ name: clean, job: JOB_FOR_SYSROLE[role] || "기타" });
    const u = await Staff.issueLogin(id, { sysRole: role, pin });
    return { user: u, row: Staff.get(id) };
  }
  function open() { if (!Session.isUnlocked()) return; msg(""); render(); Dialog.open(scrim(), "#users-close"); }
  function close() { Dialog.close(scrim()); }
  function wire() {
    $("#rail-users")?.addEventListener("click", () => { document.body.classList.remove("more-open"); open(); });
    $("#topbar-user")?.addEventListener("click", open);
    $("#users-close")?.addEventListener("click", close);
    scrim()?.addEventListener("click", e => { if (e.target.id === "users-scrim") close(); });
    $("#users-lock-now")?.addEventListener("click", () => { close(); Lock.lock("manual"); });
    $("#users-autolock")?.addEventListener("change", (e) => { Session.setAutolock(e.target.value); Lock.armIdle(); msg(t("users.msgAutolock", { m: e.target.value }), "ok"); });
    $("#users-add-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#users-add-name").value.trim(), role = $("#users-add-role").value, pin = $("#users-add-pin").value;
      try {
        const { user: u, row } = await addLogin({ name, role, pin });
        ActivityLog.add({ tag: "system", action: t("users.logAdd", { role: roleLabel(u.role) }), subject: Staff.ref(row) });
        $("#users-add-name").value = ""; $("#users-add-pin").value = "";
        msg(t("users.msgAdded", { name: u.name }), "ok"); render();
      } catch (err) { msg(err.message || String(err), "err"); }
    });
    $("#users-open-roster")?.addEventListener("click", () => { close(); activateTab("tab-license"); });
    Staff.onChange(() => { if (Dialog.isOpen(scrim())) render(); });
    $("#users-pin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await Session.changeOwnPin($("#users-old-pin").value, $("#users-new-pin").value);
        ActivityLog.add({ tag: "system", action: t("users.logPinChanged") });
        $("#users-old-pin").value = ""; $("#users-new-pin").value = "";
        msg(t("users.msgPinChanged"), "ok");
      } catch (err) { msg(err.message || String(err), "err"); }
    });
    onLangChange(() => { if (Dialog.isOpen(scrim())) { msg(""); render(); } });
  }
  return { open, close, wire, render };
})();

/* ─────────────────────── 데이터 처리 현황 — 조직 › 데이터 처리 현황 (#tab-privacy) ───────────────────────
   Promoted from a modal to a panel. Every old opener (rail/⋯ button, PoC banner link, ⓘ modal link, ⌘K command) calls
   open(tab) which routes to activateTab("tab-privacy"); the register renders on every activation. */
const PrivacyPanel = (() => {
  const panel = () => $("#tab-privacy");
  const isActive = () => !!panel()?.classList.contains("active");
  const msg = (text, kind = "") => { const el = $("#privacy-msg"); if (!el) return; el.textContent = text || ""; el.className = "sec-msg " + kind; el.hidden = !text; };
  function selectTab(name) {
    $$("#tab-privacy [data-privacy-tab]").forEach(b => b.classList.toggle("active", b.dataset.privacyTab === name));
    $$("#tab-privacy [data-privacy-pane]").forEach(p => p.classList.toggle("active", p.dataset.privacyPane === name));
  }
  async function render() {
    const owner = Session.isOwner();
    ["#privacy-audit-export", "#privacy-audit-clear", "#privacy-destroy-all"].forEach(id => { const b = $(id); if (b) { b.disabled = !owner; b.title = owner ? "" : t("common.ownerRequired"); } });
    const rows = await inventory();
    const encLabel = (e) => e === true ? t("privacy.encYes") : e === false ? t("privacy.encNo") : String(e);
    $("#privacy-table").innerHTML = rows.map(r => `
      <tr class="${r.present ? "" : "absent"}${r.unregistered ? " unregistered" : ""}">
        <td>${r.id === "__ws" || r.id === "__internal" ? "" : `<input type="checkbox" data-destroy="${esc(r.id)}" ${r.present ? "" : "disabled"} aria-label="${esc(t("privacy.destroyAria", { label: r.label }))}">`}</td>
        <td><strong>${esc(r.label)}</strong><div class="sec-detail">${esc(r.detail || "")} · <code>${esc(r.store || (r.keys.length ? r.keys.join(", ") : "—"))}</code></div></td>
        <td>${esc(r.purpose)}<div class="sec-detail">${esc(r.basis)}</div></td>
        <td class="${r.encrypted === true ? "enc-yes" : ""}">${esc(encLabel(r.encrypted))}</td>
        <td>${esc(r.retention)}</td>
        <td class="num">${r.count}</td>
        <td class="when">${r.lastModified ? relTime(r.lastModified) : "—"}</td>
      </tr>`).join("");
    const n = ActivityLog.all().length;
    $("#privacy-audit-count").textContent = t("privacy.auditCount", { n, t: n ? relTime(ActivityLog.all()[0].at) : "—" });
    const wsid = Session.workspaceId();
    const ws = $("#privacy-wsid"); if (ws) ws.textContent = wsid ? wsid.slice(0, 8) + "…" : "—";
  }
  function open(tab = "status") { if (!Session.isUnlocked()) return; msg(""); selectTab(tab); activateTab("tab-privacy", { section: tab }); }
  function close() { /* a panel has nothing to close — kept for callers */ }
  function wire() {
    // The info-modal link is inside a data-i18n-html block and is re-created on every language swap → delegate.
    $("#info-scrim")?.addEventListener("click", (e) => { if (e.target.closest?.("#info-privacy-link")) { e.preventDefault(); Dialog.close($("#info-scrim")); open("legal"); } });
    $("#poc-banner-link")?.addEventListener("click", (e) => { e.preventDefault(); open("legal"); });
    EventBus.on("tab:activated", (p) => { if (p?.id !== "tab-privacy") return; if (p.ctx?.section) selectTab(p.ctx.section); render(); });
    EventBus.on("lifecycle:purged", () => { if (isActive()) render(); });
    $$("#tab-privacy [data-privacy-tab]").forEach(b => b.addEventListener("click", () => selectTab(b.dataset.privacyTab)));
    $("#privacy-destroy-selected")?.addEventListener("click", async () => {
      const ids = $$("#privacy-table input[data-destroy]:checked").map(i => i.dataset.destroy);
      if (!ids.length) { msg(t("privacy.msgPickItems"), "err"); return; }
      if (!confirm(t("privacy.confirmDestroy", { n: ids.length }))) return;
      const n = await destroy(ids);
      msg(t("privacy.msgDestroyed", { n }), "ok"); render();
    });
    $("#privacy-destroy-all")?.addEventListener("click", async () => {
      const typed = prompt(t("privacy.wipePrompt"));
      if (typed == null) return;
      if (!isDestroyWord(typed)) { msg(t("privacy.msgTypeWord"), "err"); return; }
      await destroyAll();
      location.reload();
    });
    $("#privacy-backup")?.addEventListener("click", async () => {
      try { const bk = await exportBackup(); msg(t("privacy.msgBackup", { n: Object.keys(bk.sensitive).length, a: bk.attachments.length }), "ok"); }
      catch (err) { msg(err.message || String(err), "err"); }
    });
    $("#privacy-restore")?.addEventListener("click", () => { Lock.openRestore(); });
    $("#privacy-audit-export")?.addEventListener("click", () => {
      try {
        const rows = ActivityLog.exportRows();
        if (!rows.length) { msg(t("privacy.msgNoAudit"), "err"); return; }
        downloadCSV(rows, t("privacy.auditFile", { date: new Date().toISOString().slice(0, 10) }));
        ActivityLog.add({ tag: "system", action: t("privacy.logAuditExport", { n: rows.length }) });
        msg(t("privacy.msgAuditExported"), "ok");
      } catch (err) { msg(err.message, "err"); }
    });
    $("#privacy-audit-clear")?.addEventListener("click", () => {
      if (!confirm(t("privacy.confirmAuditClear"))) return;
      try { ActivityLog.clear(); ActivityLog.add({ tag: "system", action: t("privacy.logAuditClear") }); msg(t("privacy.msgAuditCleared"), "ok"); render(); }
      catch (err) { msg(err.message, "err"); }
    });
    onLangChange(() => { if (isActive()) { msg(""); render(); } });
  }
  return { open, close, wire, render, isActive };
})();

/* PoC banner — dismissible per browser session only (it comes back on the next visit on purpose). */
function initBanner() {
  const b = $("#poc-banner"); if (!b) return;
  const KEY = "vibe.clinic-admin.poc-banner";
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(KEY) === "1"; } catch {}
  if (dismissed) b.hidden = true;
  $("#poc-banner-x")?.addEventListener("click", () => { b.hidden = true; try { sessionStorage.setItem(KEY, "1"); } catch {} });
}

/* Called once from shell.js at import time. Returns the first-unlock promise. */
function initSecurityUI() {
  initBanner();
  UsersPanel.wire();
  PrivacyPanel.wire();
  updateChip();
  onLangChange(updateChip);
  return Lock.init();
}

export { Lock, UsersPanel, PrivacyPanel, initSecurityUI, updateChip, isDestroyWord };
