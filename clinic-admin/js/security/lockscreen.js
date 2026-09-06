/* clinic-admin — security UI: lock screen (first-run setup / unlock / backup restore), idle + visibility
   auto-lock, the 사용자 panel, the 데이터 처리 현황 panel, the PoC banner and the topbar user chip.
   Import position: files/lifecycle → lockscreen → shell (never imported by core/ or tabs/).

   Boot contract: shell.boot() awaits Lock.ready() before loading data and initialising tabs, so
   every tab always starts with an unlocked Store. Later locks just drop the key + cover the UI;
   the next unlock re-decrypts and re-emits `store:<key>` so tab renders refresh. */
import { $, $$, esc, Toast, Dialog, relTime } from "../core/ui.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { downloadCSV } from "../core/files.js";
import { Session, ROLES } from "./session.js";
import { inventory, purgeExpired, destroy, destroyAll, exportBackup, parseBackup, restoreBackup } from "./lifecycle.js";

const HIDDEN_LOCK_MS = 60000;
const fmtDT = (ts) => ts ? new Date(ts).toLocaleString("ko-KR", { hour12: false }) : "—";

/* ─────────────────────────── Lock screen ─────────────────────────── */
const Lock = (() => {
  const scrim = () => $("#lock-scrim");
  let readyResolve;
  const ready = new Promise(res => { readyResolve = res; });
  let booted = false, selectedUser = null, countdownT = null, idleT = null, hiddenT = null, hiddenAt = 0, lastReset = 0;
  let restoreBk = null;

  function closeAllDialogs() {
    $$(".welcome-scrim.open, .palette-scrim.open, .lightbox.open").forEach(s => Dialog.close(s));
    document.body.classList.remove("rail-open");
  }
  function showPane(name) {
    ["setup", "unlock", "restore"].forEach(p => { const el = $(`#lock-${p}`); if (el) el.hidden = p !== name; });
    const t = $("#lock-title");
    if (t) t.innerHTML = name === "setup" ? "워크스페이스를 <em>만듭니다</em>" : name === "restore" ? "암호화 백업 <em>복원</em>" : "잠겨 <em>있습니다</em>";
  }
  function setErr(id, msg) { const el = $(id); if (!el) return; el.textContent = msg || ""; el.hidden = !msg; }

  function renderUsers() {
    const list = $("#lock-users"); if (!list) return;
    const users = Session.users();
    if (!users.find(u => u.id === selectedUser)) selectedUser = users[0]?.id || null;
    list.innerHTML = users.map(u => `
      <button type="button" class="lock-user${u.id === selectedUser ? " sel" : ""}" data-id="${esc(u.id)}" role="radio" aria-checked="${u.id === selectedUser}">
        <span class="lu-name">${esc(u.name)}</span><span class="lu-role">${esc(u.role)}</span>
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
      if (left > 0) { btn.disabled = true; setErr("#lock-err", `PIN이 틀렸습니다 — ${left}초 후 다시 시도할 수 있습니다`); }
      else { btn.disabled = false; clearInterval(countdownT); if (($("#lock-err")?.textContent || "").includes("초 후")) setErr("#lock-err", ""); }
    };
    tick();
    countdownT = setInterval(tick, 250);
  }

  function open(reason) {
    const sc = scrim(); if (!sc) return;
    closeAllDialogs();
    document.body.classList.add("locked");
    const shell = $(".frame.shell"); if (shell) shell.inert = true;
    sc.classList.add("open");
    const why = $("#lock-reason");
    if (why) {
      why.textContent = reason === "idle" ? `${Session.autolockMin()}분 동안 활동이 없어 자동으로 잠겼습니다.`
        : reason === "hidden" ? "화면을 60초 이상 벗어나 자동으로 잠겼습니다."
        : reason === "manual" ? "잠금 버튼으로 잠겼습니다." : "";
      why.hidden = !why.textContent;
    }
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

  function lock(reason = "manual") {
    if (!Session.isUnlocked()) return;
    clearTimeout(idleT); clearTimeout(hiddenT);
    ActivityLog.add({ tag: "system", action: `잠금 (${reason === "idle" ? "자동 · 무활동" : reason === "hidden" ? "자동 · 화면 이탈" : "수동"})`, meta: { silent: true } });
    Session.lock(reason); // → store bridge → session:locked → open()
  }

  /* ── wiring ── */
  function wire() {
    // Setup
    $("#lock-setup")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#setup-name").value.trim(), role = $("#setup-role").value, pin = $("#setup-pin").value, pin2 = $("#setup-pin2").value;
      if (pin !== pin2) { setErr("#setup-err", "PIN 두 번 입력이 서로 다릅니다"); return; }
      const btn = $("#setup-submit"); btn.disabled = true; btn.textContent = "키 생성 중…";
      try {
        await Session.create({ name, role, pin });
      } catch (err) { setErr("#setup-err", err.message || String(err)); }
      finally { btn.disabled = false; btn.textContent = "워크스페이스 만들기"; }
    });
    // Unlock
    $("#lock-pin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedUser) { setErr("#lock-err", "사용자를 선택하세요"); return; }
      const pin = $("#lock-pin").value;
      const btn = $("#lock-submit"); btn.disabled = true; btn.textContent = "확인 중…";
      try {
        await Session.unlock(selectedUser, pin);
        // success → session:unlocked handler closes the screen
      } catch (err) {
        $("#lock-pin").value = "";
        if (err.code === "pin-format") setErr("#lock-err", "PIN은 4~8자리 숫자입니다");
        else if (err.code === "backoff" || err.code === "wrong-pin") armBackoff();
        else setErr("#lock-err", err.message || "잠금 해제 실패");
      } finally { btn.textContent = "열기"; armBackoff(); /* re-enables unless the user is in backoff */ }
    });
    $$("#lock-goto-restore, #lock-goto-restore2").forEach(b => b.addEventListener("click", () => openRestore()));
    $("#restore-back")?.addEventListener("click", () => { restoreBk = null; open(); });
    $("#restore-file")?.addEventListener("change", async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      setErr("#restore-err", "");
      try {
        restoreBk = parseBackup(await f.text());
        const sel = $("#restore-user");
        sel.innerHTML = restoreBk.keyring.users.map(u => `<option value="${esc(u.id)}">${esc(u.name)} · ${esc(u.role)}</option>`).join("");
        $("#restore-meta").textContent = `백업 일시 ${fmtDT(Date.parse(restoreBk.exportedAt))} · 항목 ${Object.keys(restoreBk.sensitive || {}).length}개 · 첨부 ${(restoreBk.attachments || []).length}장`;
        $("#restore-step2").hidden = false;
      } catch (err) { restoreBk = null; $("#restore-step2").hidden = true; setErr("#restore-err", err.message); }
    });
    $("#restore-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!restoreBk) { setErr("#restore-err", "백업 파일을 먼저 선택하세요"); return; }
      if (Session.exists() && !confirm("이 브라우저의 현재 워크스페이스(사용자·데이터·첨부)를 모두 지우고 백업으로 대체합니다. 계속할까요?")) return;
      const btn = $("#restore-submit"); btn.disabled = true; btn.textContent = "복원 중…";
      try {
        const wasBooted = booted;
        const r = await restoreBackup(restoreBk, $("#restore-user").value, $("#restore-pin").value);
        restoreBk = null;
        Toast.show({ tag: "system", html: `<strong>백업 복원 완료.</strong> 항목 ${r.keys}개 · 첨부 ${r.attachments}장` });
        if (wasBooted) setTimeout(() => location.reload(), 600); // tabs were initialised on the old data
      } catch (err) {
        setErr("#restore-err", err.name === "OperationError" || /wrong|decrypt/i.test(err.message || "") ? "PIN이 틀렸거나 이 백업의 키와 맞지 않습니다" : (err.message || "복원 실패"));
      } finally { btn.disabled = false; btn.textContent = "복원"; }
    });
    $("#rail-lock")?.addEventListener("click", () => lock("manual"));
    $("#topbar-lock")?.addEventListener("click", () => lock("manual"));

    EventBus.on("session:unlocked", async () => {
      await Store.whenUnlocked();
      try { await purgeExpired(); } catch (e) { console.warn("purge", e); }
      close();
      armIdle();
      const u = Session.user();
      if (booted) Toast.show({ tag: "system", html: `잠금 해제 — <strong>${esc(u.name)}</strong> · ${esc(u.role)}` });
      if (!booted) { booted = true; readyResolve(u); }
      ActivityLog.add({ tag: "system", action: "잠금 해제", meta: { silent: true } });
    });
    EventBus.on("session:locked", (reason) => open(reason));
    EventBus.on("session:users", () => { if (scrim()?.classList.contains("open")) renderUsers(); updateChip(); });
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
  return { init, ready: () => ready, lock, open, openRestore, armIdle };
})();

/* topbar user chip */
function updateChip() {
  const chip = $("#topbar-user"); if (!chip) return;
  const u = Session.user();
  chip.style.display = u ? "inline-flex" : "none";
  const t = $("#topbar-user-text"); if (t && u) t.textContent = `${u.name} · ${u.role}`;
}

/* ─────────────────────────── 사용자 panel ─────────────────────────── */
const UsersPanel = (() => {
  const scrim = () => $("#users-scrim");
  const msg = (text, kind = "") => { const el = $("#users-msg"); if (!el) return; el.textContent = text || ""; el.className = "sec-msg " + kind; el.hidden = !text; };
  function render() {
    const me = Session.user(); if (!me) return;
    const owner = Session.isOwner();
    $("#users-me").innerHTML = `<strong>${esc(me.name)}</strong> · ${esc(me.role)}${owner ? ' <span class="sec-tag">관리 권한</span>' : ""}`;
    $("#users-autolock").value = String(Session.autolockMin());
    $("#users-list").innerHTML = Session.users().map(u => `
      <div class="sec-row">
        <span class="sec-name">${esc(u.name)}</span>
        <span class="sec-role">${esc(u.role)}</span>
        <span class="sec-meta">${u.aiConsent ? "AI 동의 " + fmtDT(u.aiConsent.at) : "AI 동의 없음"}</span>
        <span class="sec-actions">
          ${owner && u.id !== me.id ? `<button type="button" class="btn secondary sm" data-act="reset" data-id="${esc(u.id)}">PIN 재설정</button>
          <button type="button" class="btn secondary sm" data-act="remove" data-id="${esc(u.id)}">삭제</button>` : ""}
          ${u.aiConsent ? `<button type="button" class="btn secondary sm" data-act="revoke" data-id="${esc(u.id)}" ${owner || u.id === me.id ? "" : "disabled"}>AI 동의 철회</button>` : ""}
        </span>
      </div>`).join("");
    $$("#users-list [data-act]").forEach(b => b.addEventListener("click", async () => {
      const id = b.dataset.id, u = Session.users().find(x => x.id === id);
      try {
        if (b.dataset.act === "reset") {
          const pin = prompt(`${u.name} 님의 새 PIN (4~8자리 숫자)`); if (pin == null) return;
          await Session.resetPin(id, pin.trim());
          ActivityLog.add({ tag: "system", action: `PIN 재설정 — 사용자 ${u.name} (${u.role})` });
          msg("PIN을 재설정했습니다", "ok");
        } else if (b.dataset.act === "remove") {
          if (!confirm(`${u.name} (${u.role}) 사용자를 삭제할까요? 이 사용자의 PIN으로는 더 이상 열 수 없습니다.`)) return;
          Session.removeUser(id);
          ActivityLog.add({ tag: "system", action: `사용자 삭제 — ${u.name} (${u.role})` });
          msg("사용자를 삭제했습니다", "ok");
        } else if (b.dataset.act === "revoke") {
          Session.updateUser(id, { aiConsent: null });
          ActivityLog.add({ tag: "system", action: `AI 전송 동의 철회 — ${u.name}` });
          msg("AI 전송 동의를 철회했습니다", "ok");
        }
      } catch (err) { msg(err.message || String(err), "err"); }
      render();
    }));
  }
  function open() { if (!Session.isUnlocked()) return; msg(""); render(); Dialog.open(scrim(), "#users-close"); }
  function close() { Dialog.close(scrim()); }
  function wire() {
    $("#rail-users")?.addEventListener("click", () => { document.body.classList.remove("rail-open"); open(); });
    $("#topbar-user")?.addEventListener("click", open);
    $("#users-close")?.addEventListener("click", close);
    scrim()?.addEventListener("click", e => { if (e.target.id === "users-scrim") close(); });
    $("#users-lock-now")?.addEventListener("click", () => { close(); Lock.lock("manual"); });
    $("#users-autolock")?.addEventListener("change", (e) => { Session.setAutolock(e.target.value); Lock.armIdle(); msg(`자동 잠금 ${e.target.value}분`, "ok"); });
    $("#users-add-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#users-add-name").value.trim(), role = $("#users-add-role").value, pin = $("#users-add-pin").value;
      try {
        const u = await Session.addUser({ name, role, pin });
        ActivityLog.add({ tag: "system", action: `사용자 추가 — ${u.name} (${u.role})` });
        $("#users-add-name").value = ""; $("#users-add-pin").value = "";
        msg(`${u.name} 님을 추가했습니다`, "ok"); render();
      } catch (err) { msg(err.message || String(err), "err"); }
    });
    $("#users-pin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await Session.changeOwnPin($("#users-old-pin").value, $("#users-new-pin").value);
        ActivityLog.add({ tag: "system", action: "내 PIN 변경" });
        $("#users-old-pin").value = ""; $("#users-new-pin").value = "";
        msg("PIN을 변경했습니다", "ok");
      } catch (err) { msg(err.message || String(err), "err"); }
    });
  }
  return { open, close, wire, render };
})();

/* ─────────────────────── 데이터 처리 현황 panel ─────────────────────── */
const PrivacyPanel = (() => {
  const scrim = () => $("#privacy-scrim");
  const msg = (text, kind = "") => { const el = $("#privacy-msg"); if (!el) return; el.textContent = text || ""; el.className = "sec-msg " + kind; el.hidden = !text; };
  function selectTab(name) {
    $$("#privacy-scrim [data-privacy-tab]").forEach(b => b.classList.toggle("active", b.dataset.privacyTab === name));
    $$("#privacy-scrim [data-privacy-pane]").forEach(p => p.classList.toggle("active", p.dataset.privacyPane === name));
  }
  async function render() {
    const owner = Session.isOwner();
    ["#privacy-audit-export", "#privacy-audit-clear", "#privacy-destroy-all"].forEach(id => { const b = $(id); if (b) { b.disabled = !owner; b.title = owner ? "" : "원장 권한이 필요합니다"; } });
    const rows = await inventory();
    const encLabel = (e) => e === true ? "예 · AES-GCM" : e === false ? "아니오 (개인정보 아님)" : String(e);
    $("#privacy-table").innerHTML = rows.map(r => `
      <tr class="${r.present ? "" : "absent"}${r.unregistered ? " unregistered" : ""}">
        <td>${r.id === "__ws" || r.id === "__internal" ? "" : `<input type="checkbox" data-destroy="${esc(r.id)}" ${r.present ? "" : "disabled"} aria-label="${esc(r.label)} 파기 선택">`}</td>
        <td><strong>${esc(r.label)}</strong><div class="sec-detail">${esc(r.detail || "")} · <code>${esc(r.store || (r.keys.length ? r.keys.join(", ") : "—"))}</code></div></td>
        <td>${esc(r.purpose)}<div class="sec-detail">${esc(r.basis)}</div></td>
        <td class="${r.encrypted === true ? "enc-yes" : ""}">${encLabel(r.encrypted)}</td>
        <td>${esc(r.retention)}</td>
        <td class="num">${r.count}</td>
        <td class="when">${r.lastModified ? relTime(r.lastModified) : "—"}</td>
      </tr>`).join("");
    const n = ActivityLog.all().length;
    $("#privacy-audit-count").textContent = `${n}건 · 최근 ${n ? relTime(ActivityLog.all()[0].at) : "—"}`;
    const wsid = Session.workspaceId();
    $("#privacy-wsid").textContent = wsid ? wsid.slice(0, 8) + "…" : "—";
  }
  function open(tab = "status") { if (!Session.isUnlocked()) return; msg(""); selectTab(tab); render(); Dialog.open(scrim(), "#privacy-close"); }
  function close() { Dialog.close(scrim()); }
  function wire() {
    $("#rail-privacy")?.addEventListener("click", () => { document.body.classList.remove("rail-open"); open("status"); });
    $("#info-privacy-link")?.addEventListener("click", (e) => { e.preventDefault(); Dialog.close($("#info-scrim")); open("legal"); });
    $("#poc-banner-link")?.addEventListener("click", (e) => { e.preventDefault(); open("legal"); });
    $("#privacy-close")?.addEventListener("click", close);
    scrim()?.addEventListener("click", e => { if (e.target.id === "privacy-scrim") close(); });
    $$("#privacy-scrim [data-privacy-tab]").forEach(b => b.addEventListener("click", () => selectTab(b.dataset.privacyTab)));
    $("#privacy-destroy-selected")?.addEventListener("click", async () => {
      const ids = $$("#privacy-table input[data-destroy]:checked").map(i => i.dataset.destroy);
      if (!ids.length) { msg("파기할 항목을 선택하세요", "err"); return; }
      if (!confirm(`선택한 ${ids.length}개 영역의 데이터를 이 브라우저에서 파기합니다 — 되돌릴 수 없습니다. 계속할까요?`)) return;
      const n = await destroy(ids);
      msg(`${n}개 키를 파기했습니다`, "ok"); render();
    });
    $("#privacy-destroy-all")?.addEventListener("click", async () => {
      const typed = prompt("모든 데이터·첨부·사용자·암호화 키를 파기합니다. 되돌릴 수 없으며 백업 없이는 복구도 불가능합니다.\n\n계속하려면 「파기」라고 입력하세요.");
      if (typed == null) return;
      if (typed.trim() !== "파기") { msg("「파기」를 정확히 입력해야 합니다", "err"); return; }
      await destroyAll();
      location.reload();
    });
    $("#privacy-backup")?.addEventListener("click", async () => {
      try { const bk = await exportBackup(); msg(`암호화 백업을 내려받았습니다 (${Object.keys(bk.sensitive).length}개 암호문 · 첨부 ${bk.attachments.length}장). 복원에는 이 워크스페이스 사용자의 PIN이 필요합니다.`, "ok"); }
      catch (err) { msg(err.message || String(err), "err"); }
    });
    $("#privacy-restore")?.addEventListener("click", () => { close(); Lock.openRestore(); });
    $("#privacy-audit-export")?.addEventListener("click", () => {
      try {
        const rows = ActivityLog.exportRows();
        if (!rows.length) { msg("활동 기록이 없습니다", "err"); return; }
        downloadCSV(rows, `활동기록_${new Date().toISOString().slice(0, 10)}.csv`);
        ActivityLog.add({ tag: "system", action: `활동 기록 CSV 내려받음 (${rows.length}건)` });
        msg("활동 기록 CSV를 내려받았습니다", "ok");
      } catch (err) { msg(err.message, "err"); }
    });
    $("#privacy-audit-clear")?.addEventListener("click", () => {
      if (!confirm("활동 기록 전체를 삭제합니다 (원장 권한). 계속할까요?")) return;
      try { ActivityLog.clear(); ActivityLog.add({ tag: "system", action: "활동 기록 삭제 (원장)" }); msg("활동 기록을 삭제했습니다", "ok"); render(); }
      catch (err) { msg(err.message, "err"); }
    });
  }
  return { open, close, wire, render };
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
  return Lock.init();
}

export { Lock, UsersPanel, PrivacyPanel, initSecurityUI, updateChip };
