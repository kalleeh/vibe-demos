/* clinic-admin — security UI: lock screen (instance bootstrap / server PIN unlock / forced new PIN / offline /
   backup restore / PIN 재확인), idle + visibility + absolute-expiry auto-lock, the 사용자 panel, the 데이터 처리 현황
   panel, the PoC banner and the topbar user chip. Import position: files/lifecycle → lockscreen → shell (never
   imported by core/ or tabs/).

   Boot contract: shell.boot() awaits Lock.ready() before loading data and initialising tabs, so every tab always
   starts with an unlocked Store. Lock.init() covers the shell at once and asks Session.restore() to resume from the
   IndexedDB session record (no PIN, no server); only when that fails does it ask the server (Session.probe) which pane
   to show:  unreachable → "offline" (retry) · no workspace yet → "setup" (bootstrap the instance, optionally from this
   device's legacy keyring) · bootstrapped → "unlock" (directory dropdown + PIN). A temp-PIN login lands on "newpin"
   before the app opens. Later locks just drop the key + cover the UI; the next unlock re-decrypts and re-emits
   `store:<key>` so tab renders refresh.
   Re-auth: Session.requireRaw() (login issue · PIN reset) calls the "PIN 재확인" dialog registered here via
   Session.setReauthPrompt — the current user's PIN checked offline against the cached wrapped key, same backoff.
   i18n: every string goes through t(); the lock screen works while locked because core/i18n.js is a leaf. */
import { $, $$, esc, Toast, Dialog, relTime, roleLabel } from "../core/ui.js";
import { t, getLang, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { downloadCSV } from "../core/files.js";
import { activateTab } from "../core/nav.js";
import { Staff, JOB_FOR_SYSROLE } from "../core/entities.js";
import { Session } from "./session.js";
import { Cloud } from "./cloud.js";
import { inventory, purgeExpired, destroy, destroyAll, exportBackup, parseBackup, restoreBackup } from "./lifecycle.js";

const HIDDEN_LOCK_MS = 60000;
const fmtDT = (ts) => ts ? new Date(ts).toLocaleString(getLang() === "en" ? "en-GB" : "ko-KR", { hour12: false }) : "—";
// Typed confirmation for 전체 파기 — the Korean word in both languages, plus DESTROY for the English reviewer.
const isDestroyWord = (s) => { const v = String(s ?? "").trim(); return v === "파기" || v.toUpperCase() === "DESTROY"; };
const PANES = ["setup", "unlock", "restore", "offline", "newpin"];
const TITLE_KEY = { setup: "lock.title.setup", restore: "lock.title.restore", offline: "lock.title.offline", newpin: "lock.title.newpin" };

/* ─────────────────────────── Lock screen ─────────────────────────── */
const Lock = (() => {
  const scrim = () => $("#lock-scrim");
  let readyResolve;
  const ready = new Promise(res => { readyResolve = res; });
  let booted = false, selectedUser = null, countdownT = null, idleT = null, hiddenT = null, expiryT = null, hiddenAt = 0, lastReset = 0;
  let restoreBk = null, pane = "none", reason = "", backoffShown = false, probeSeq = 0, lastProbeErr = null;
  let created = false; // this page load bootstrapped the instance → shell shows the 기관 정보 first-run step

  function closeAllDialogs() {
    $$(".welcome-scrim.open, .search-scrim.open, .lightbox.open").forEach(s => Dialog.close(s));
    document.body.classList.remove("more-open");
    EventBus.emitLocal("shell:closeAll", true); // shell: ⋯ sheet + AI drawer
  }
  // "none" = scrim up, no pane (while Session.restore() / the server probe decide).
  function showPane(name) {
    pane = name;
    PANES.forEach(p => { const el = $(`#lock-${p}`); if (el) el.hidden = p !== name; });
    const lg = $("#setup-legacy"); if (lg && name !== "setup") lg.hidden = true; // renderLegacy() decides on the setup pane
    const tt = $("#lock-title");
    if (tt) tt.innerHTML = t(TITLE_KEY[name] || "lock.title.locked");
    if (name === "unlock") renderHint();
  }
  function setErr(id, msg) { const el = $(id); if (!el) return; el.textContent = msg || ""; el.hidden = !msg; }
  function setBusy(msg) { const el = $("#lock-busy"); if (!el) return; el.textContent = msg || ""; el.hidden = !msg; }
  const absLabel = () => { const mode = Session.sessionMode(); return mode === "tab" ? t("users.sessionTab") : t("lock.hours", { h: parseInt(mode, 10) }); };
  function renderReason() {
    const why = $("#lock-reason"); if (!why) return;
    why.textContent = reason === "idle" ? t("lock.reasonIdle", { m: Session.autolockMin() })
      : reason === "hidden" ? t("lock.reasonHidden")
      : reason === "manual" ? t("lock.reasonManual")
      : reason === "expired" ? t("lock.reasonExpired", { abs: absLabel() })
      : reason === "peer" ? t("lock.reasonPeer")
      : reason === "revoked" ? t("lock.reasonRevoked") : "";
    why.hidden = !why.textContent;
  }
  // Unlock pane: one line that states the persistence contract with the CURRENT settings.
  function renderHint() {
    const el = $("#lock-persist-hint"); if (!el) return;
    const m = Session.autolockMin();
    el.textContent = Session.sessionMode() === "tab" ? t("lock.persistHintTab", { m }) : t("lock.persistHint", { abs: absLabel(), m });
  }
  function renderClinic() {
    const el = $("#lock-clinic"); if (!el) return;
    const ws = Session.workspace();
    el.textContent = ws?.name ? t("lock.clinicLine", { name: ws.name, host: Cloud.url().replace(/^https?:\/\//, "") }) : "";
    el.hidden = !el.textContent;
  }

  /* Unlock pane — the server directory as a dropdown (name · role). */
  function renderUsers() {
    const sel = $("#lock-user"); if (!sel) return;
    const users = Session.users();
    if (!users.find(u => u.id === selectedUser)) selectedUser = users[0]?.id || null;
    sel.innerHTML = users.map(u => `<option value="${esc(u.id)}">${esc(u.name)} · ${esc(roleLabel(u.role))}</option>`).join("");
    if (selectedUser) sel.value = selectedUser;
    sel.disabled = !users.length;
    const empty = $("#lock-users-empty"); if (empty) empty.hidden = users.length > 0;
    renderClinic();
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
  /* Setup pane: the bootstrap-from-legacy offer when this device still has a pre-cloud keyring. */
  function renderLegacy() {
    const box = $("#setup-legacy"); if (!box) return;
    const legacy = Session.legacy();
    box.hidden = !legacy;
    if (!legacy) return;
    const owners = legacy.users.filter(u => u.role === "원장");
    const list = owners.length ? owners : legacy.users;
    const sel = $("#legacy-user");
    if (sel) sel.innerHTML = list.map(u => `<option value="${esc(u.id)}">${esc(u.name)} · ${esc(roleLabel(u.role))}</option>`).join("");
    const note = $("#legacy-note"); if (note) note.textContent = t("lock.legacyNote", { n: legacy.users.length });
  }

  /* No session to resume → ask the server which pane applies. */
  async function decidePane() {
    const seq = ++probeSeq;
    showPane("none");
    setBusy(t("lock.connecting"));
    const r = await Session.probe();
    if (seq !== probeSeq || Session.isUnlocked()) return; // a newer probe / a resume won
    setBusy("");
    lastProbeErr = r.error || null;
    if (!r.reachable) {
      showPane("offline");
      setErr("#offline-err", t(r.error?.code === "sri" || /sri|sdk/.test(r.error?.message || "") ? "cloud.errSdk" : "cloud.errOffline", { s: r.error?.status || 0 }));
      const host = $("#offline-host"); if (host) host.textContent = Cloud.url();
      return;
    }
    if (!r.workspace?.bootstrapped) {
      showPane("setup");
      renderLegacy();
      const clinic = $("#setup-clinic");
      if (clinic && !clinic.value) { try { clinic.value = Store.get("org.profile")?.name || ""; } catch {} }
      // Focus synchronously — a deferred focus would steal keystrokes already going into another field.
      $(clinic?.value ? "#setup-name" : "#setup-clinic")?.focus();
      return;
    }
    showPane("unlock"); renderUsers(); armBackoff();
    $("#lock-pin")?.focus();
  }

  function open(why) {
    const sc = scrim(); if (!sc) return;
    closeAllDialogs();
    document.body.classList.add("locked");
    const shell = $(".frame.shell"); if (shell) shell.inert = true;
    sc.classList.add("open");
    reason = why || "";
    renderReason();
    $$("#lock-scrim input[type=password]").forEach(i => { i.value = ""; });
    updateChip();
    decidePane();
  }
  function close() {
    const sc = scrim(); if (!sc) return;
    sc.classList.remove("open");
    document.body.classList.remove("locked");
    setBusy("");
    const shell = $(".frame.shell"); if (shell) shell.inert = false;
    updateChip();
  }

  /* ── idle / visibility / absolute-expiry auto-lock ── */
  function armExpiry() {
    clearTimeout(expiryT);
    const at = Session.expiresAt();
    if (!Session.isUnlocked() || !at) return;
    const left = at - Date.now();
    if (left <= 0) { lock("expired"); return; }
    expiryT = setTimeout(() => lock("expired"), Math.min(left, 2147000000)); // setTimeout caps at ~24.8 days
  }
  function armIdle() {
    clearTimeout(idleT);
    if (!Session.isUnlocked()) return;
    idleT = setTimeout(() => lock("idle"), Session.autolockMin() * 60000);
    armExpiry();
  }
  function onActivity() {
    const now = Date.now();
    if (now - lastReset < 1000) return; // throttle
    lastReset = now;
    armIdle();
    Session.touch(); // lastActiveAt in the session record — session.js throttles the write to ≥30 s
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
      else if (Session.isUnlocked() && Session.expiresAt() && Date.now() >= Session.expiresAt()) lock("expired"); // timers stall in a suspended tab
      hiddenAt = 0;
      armIdle();
    }
  });

  const WHY_KEY = { idle: "lock.whyIdle", hidden: "lock.whyHidden", expired: "lock.whyExpired", manual: "lock.whyManual" };
  function lock(why = "manual") {
    if (!Session.isUnlocked()) return;
    clearTimeout(idleT); clearTimeout(hiddenT); clearTimeout(expiryT);
    ActivityLog.add({ tag: "system", action: t("lock.logLock", { why: t(WHY_KEY[why] || "lock.whyManual") }), meta: { silent: true } });
    Session.lock(why); // → store bridge → session:locked → open(); deletes the IndexedDB session record; tells other tabs
  }

  /* ── PIN 재확인 — Session.requireRaw() calls this when key management needs the raw master key and the
     post-PIN grant has lapsed (or the session was resumed from IndexedDB, so no PIN was typed this page load).
     Resolves the raw bytes (Session.verifyPin) or null when cancelled. Wrong PIN → the shared backoff. ── */
  function reauth() {
    return new Promise((resolve) => {
      const sc = $("#reauth-scrim"), form = $("#reauth-form"), pinEl = $("#reauth-pin"), btn = $("#reauth-submit");
      const me = Session.user();
      if (!sc || !form || !me) return resolve(null);
      const who = $("#reauth-user"); if (who) who.textContent = `${me.name} · ${roleLabel(me.role)}`;
      pinEl.value = ""; setErr("#reauth-err", "");
      let cd = null, shown = false, done = false;
      const tick = () => {
        const u = Session.users().find(x => x.id === me.id);
        const left = u ? Math.ceil(((u.lockedUntil || 0) - Date.now()) / 1000) : 0;
        if (left > 0) { btn.disabled = true; shown = true; setErr("#reauth-err", t("lock.errBackoff", { s: left })); }
        else { btn.disabled = false; clearInterval(cd); if (shown) { shown = false; setErr("#reauth-err", ""); } }
      };
      const arm = () => { clearInterval(cd); tick(); cd = setInterval(tick, 250); };
      const cancelBtn = $("#reauth-cancel"), closeBtn = $("#reauth-close");
      const finish = (raw) => {
        if (done) return; done = true;
        clearInterval(cd);
        form.removeEventListener("submit", onSubmit); cancelBtn?.removeEventListener("click", onCancel); closeBtn?.removeEventListener("click", onCancel); sc.removeEventListener("click", onScrim);
        pinEl.value = "";
        Dialog.close(sc);
        resolve(raw);
      };
      const onCancel = () => finish(null);
      const onScrim = (e) => { if (e.target === sc) finish(null); };
      const onSubmit = async (e) => {
        e.preventDefault();
        const pin = pinEl.value;
        btn.disabled = true;
        try { finish(await Session.verifyPin(pin)); }
        catch (err) {
          pinEl.value = "";
          if (err.code === "pin-format") { setErr("#reauth-err", t("lock.errPinFormat")); btn.disabled = false; }
          else if (err.code === "wrong-pin" || err.code === "backoff") arm();
          else { setErr("#reauth-err", err.message || String(err)); btn.disabled = false; }
          pinEl.focus();
        }
      };
      form.addEventListener("submit", onSubmit); cancelBtn?.addEventListener("click", onCancel); closeBtn?.addEventListener("click", onCancel); sc.addEventListener("click", onScrim);
      arm();
      Dialog.open(sc, "#reauth-pin");
    });
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
  // Server / PIN errors of the lock screen forms → one readable line.
  const errText = (err, fallbackKey) => err?.code === "pin-format" ? t("lock.errPinFormat") : err?.code === "wrong-pin" ? t("lock.errWrongPin") : (err?.message || t(fallbackKey));

  /* ── wiring ── */
  function wire() {
    // Setup = bootstrap the instance (clinic name · first 원장 · PIN)
    $("#lock-setup")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const clinic = $("#setup-clinic").value.trim(), name = $("#setup-name").value.trim(), pin = $("#setup-pin").value, pin2 = $("#setup-pin2").value;
      if (pin !== pin2) { setErr("#setup-err", t("lock.errPinMismatch")); return; }
      setErr("#setup-err", "");
      const btn = $("#setup-submit"); btn.disabled = true; btn.textContent = t("lock.creating");
      try {
        await Session.bootstrap({ workspaceName: clinic, name, pin });
        created = true;
      } catch (err) { setErr("#setup-err", errText(err, "lock.errUnlock")); }
      finally { btn.disabled = false; btn.textContent = t("lock.createBtn"); }
    });
    // Setup — bootstrap FROM this device's legacy workspace (same master key → local data stays readable)
    $("#lock-legacy-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const legacyUserId = $("#legacy-user").value, oldPin = $("#legacy-old-pin").value, newPin = $("#legacy-new-pin").value, newPin2 = $("#legacy-new-pin2").value;
      const clinic = $("#setup-clinic").value.trim();
      if (newPin !== newPin2) { setErr("#legacy-err", t("lock.errPinMismatch")); return; }
      setErr("#legacy-err", "");
      const btn = $("#legacy-submit"); btn.disabled = true; btn.textContent = t("lock.creating");
      try {
        const r = await Session.bootstrapFromLegacy({ workspaceName: clinic, legacyUserId, oldPin, newPin: newPin || null });
        created = true;
        Toast.show({ tag: "system", ttl: 12000, html: t("lock.legacyDoneToast", { name: esc(r.user.name), n: r.skipped }) });
      } catch (err) { setErr("#legacy-err", err.code === "wrong-pin" ? t("lock.errLegacyPin") : errText(err, "lock.errUnlock")); }
      finally { btn.disabled = false; btn.textContent = t("lock.legacyBtn"); }
    });
    // Unlock (server PIN auth)
    $("#lock-user")?.addEventListener("change", (e) => { selectedUser = e.target.value; setErr("#lock-err", ""); armBackoff(); $("#lock-pin")?.focus(); });
    $("#lock-pin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedUser) { setErr("#lock-err", t("lock.errPickUser")); return; }
      const pin = $("#lock-pin").value;
      const btn = $("#lock-submit"); btn.disabled = true; btn.textContent = t("lock.checking");
      try {
        const r = await Session.unlock(selectedUser, pin);
        if (r?.mustChangePin) {
          // temp PIN → the forced new PIN before the app opens
          $("#lock-pin").value = "";
          const who = $("#newpin-user"); if (who) who.textContent = `${r.user.name} · ${roleLabel(r.user.role)}`;
          setErr("#newpin-err", ""); showPane("newpin"); $("#newpin-pin")?.focus(); // synchronous — no deferred focus steals keystrokes
        }
        // success → session:unlocked handler closes the screen
      } catch (err) {
        $("#lock-pin").value = "";
        if (err.code === "pin-format") setErr("#lock-err", t("lock.errPinFormat"));
        else if (err.code === "backoff" || err.code === "wrong-pin") armBackoff();
        else setErr("#lock-err", err.message || t("lock.errUnlock"));
      } finally { btn.textContent = t("lock.unlockBtn"); if (pane === "unlock") armBackoff(); /* re-enables unless the user is in backoff */ }
    });
    // Forced new PIN after a temp-PIN login
    $("#lock-newpin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pin = $("#newpin-pin").value, pin2 = $("#newpin-pin2").value;
      if (pin !== pin2) { setErr("#newpin-err", t("lock.errPinMismatch")); return; }
      const btn = $("#newpin-submit"); btn.disabled = true; btn.textContent = t("lock.checking");
      try { await Session.completePinChange(pin); }
      catch (err) { $("#newpin-pin").value = ""; $("#newpin-pin2").value = ""; setErr("#newpin-err", errText(err, "lock.errUnlock")); }
      finally { btn.disabled = false; btn.textContent = t("lock.newpinBtn"); }
    });
    $("#newpin-cancel")?.addEventListener("click", () => { Session.cancelPending(); $("#newpin-pin").value = ""; $("#newpin-pin2").value = ""; showPane("unlock"); renderUsers(); armBackoff(); });
    // Offline → retry
    $("#offline-retry")?.addEventListener("click", () => decidePane());
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
      if (!confirm(t("lock.restoreConfirm"))) return;
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

    EventBus.on("session:unlocked", async (p) => {
      await Store.whenUnlocked();
      try { await purgeExpired(); } catch (e) { console.warn("purge", e); }
      close();
      armIdle();
      const u = Session.user();
      if (booted) Toast.show({ tag: "system", html: t("lock.unlockedToast", { name: esc(u.name), role: esc(roleLabel(u.role)) }) });
      if (!booted) { booted = true; readyResolve(u); }
      // A resumed session (IndexedDB record, no PIN typed) is logged as such — the audit trail must show it.
      ActivityLog.add({ tag: "system", action: t(p?.resumed ? "lock.logResume" : "lock.logUnlock"), meta: { silent: true } });
    });
    EventBus.on("session:locked", (why) => open(why));
    EventBus.on("session:users", () => { if (scrim()?.classList.contains("open") && pane === "unlock") { renderUsers(); renderHint(); } updateChip(); });
    // Language toggle while the lock screen is up: static copy is already swapped by applyStatic; redo the
    // dynamic parts (title, reason line, user roles, restore meta, any backoff countdown).
    onLangChange(() => {
      if (!scrim()?.classList.contains("open")) return;
      showPane(pane); renderReason();
      if (pane === "unlock") { renderUsers(); armBackoff(); }
      if (pane === "setup") renderLegacy();
      if (pane === "restore") renderRestoreMeta();
      if (pane === "offline") { setErr("#offline-err", t(lastProbeErr && /sri|sdk/.test(lastProbeErr.message || "") ? "cloud.errSdk" : "cloud.errOffline", { s: lastProbeErr?.status || 0 })); }
      if (pane === "none") setBusy(t("lock.connecting"));
    });
  }

  function openRestore() {
    if (Session.isUnlocked()) Session.lock("restore");
    const sc = scrim(); if (sc && !sc.classList.contains("open")) open("restore");
    probeSeq++; // the pane below wins over a probe in flight
    setBusy("");
    showPane("restore");
    $("#restore-step2").hidden = true; setErr("#restore-err", "");
    const f = $("#restore-file"); if (f) f.value = "";
    restoreBk = null;
  }

  function init() {
    wire();
    Session.setReauthPrompt(reauth);
    // Cover the shell now, decide the pane after Session.restore(): a resumed session closes the scrim from the
    // session:unlocked handler and never sees a PIN pane (nor the server); anything else asks the server.
    const sc = scrim();
    if (sc) {
      document.body.classList.add("locked");
      const shell = $(".frame.shell"); if (shell) shell.inert = true;
      sc.classList.add("open");
      showPane("none");
      setBusy(t("lock.connecting"));
    }
    Session.restore().then((resumed) => { if (!resumed) open(); }).catch((e) => { console.warn("session restore", e); open(); });
    return ready;
  }
  return { init, ready: () => ready, lock, open, openRestore, armIdle, reauth, justCreated: () => created, pane: () => pane };
})();

/* topbar user chip — tooltip carries the absolute session expiry ("세션 만료 HH:MM"). */
function updateChip() {
  const chip = $("#topbar-user"); if (!chip) return;
  const u = Session.user();
  chip.style.display = u ? "inline-flex" : "none";
  const tt = $("#topbar-user-text"); if (tt && u) tt.textContent = `${u.name} · ${roleLabel(u.role)}`;
  const at = Session.expiresAt();
  chip.title = t("shell.userChipTitle") + (u && at ? ` · ${t("shell.userChipExpiry", { t: new Date(at).toLocaleTimeString(getLang() === "en" ? "en-GB" : "ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) })}` : "");
}

/* ─────────────────────────── 사용자 panel ───────────────────────────
   The server DIRECTORY (Session.users()) joined with the local roster (core/entities.js Staff) by staffId. Rows show the
   system role (원장·행정·원무) next to the job when this device has the roster row; "로그인 해제" = Staff.revokeLogin /
   Session.removeUser (the person stays in the roster, the server login goes). Issuing a login = a TEMP PIN the owner
   hands over; the new user sets their own PIN at first login (mustChangePin). 원장 only. */
const UsersPanel = (() => {
  const scrim = () => $("#users-scrim");
  const msg = (text, kind = "") => { const el = $("#users-msg"); if (!el) return; el.textContent = text || ""; el.className = "sec-msg " + kind; el.hidden = !text; };
  // Audit subject for a login row: the pseudonymised staff reference ("한의사 윤○○"), never the name.
  const subj = (s, u) => (s ? Staff.ref(s) : (u ? roleLabel(u.role) : null));
  function render() {
    const me = Session.user(); if (!me) return;
    const owner = Session.isOwner();
    $("#users-me").innerHTML = `<strong>${esc(me.name)}</strong> · ${esc(roleLabel(me.role))}${owner ? ` <span class="sec-tag">${esc(t("users.adminTag"))}</span>` : ""}`;
    const cloud = $("#users-cloud");
    if (cloud) { const ws = Session.workspace(); cloud.textContent = t(Session.isAuthed() ? "users.cloudLine" : "users.cloudLineOffline", { name: ws?.name || "—", host: Cloud.url().replace(/^https?:\/\//, ""), n: Session.users().length }); }
    $("#users-autolock").value = String(Session.autolockMin());
    const sessSel = $("#users-session"); if (sessSel) { sessSel.value = Session.sessionMode(); sessSel.disabled = !owner; sessSel.title = owner ? "" : t("common.ownerRequired"); }
    const staff = Staff.list();
    const rows = Session.users().map(u => ({ u, s: staff.find(x => x.id === u.staffId) || staff.find(x => x.userId === u.id) || null }));
    $("#users-list").innerHTML = rows.map(({ u, s }) => `
      <div class="sec-row" data-user="${esc(u.id)}">
        <span class="sec-name">${esc(u.name)}${u.role === "원장" ? ` <span class="sec-tag">${esc(t("users.ownerTag"))}</span>` : ""}${u.id === me.id ? ` <span class="lic-me">${esc(t("license.meTag"))}</span>` : ""}</span>
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
      const s = staff.find(x => x.id === u?.staffId) || staff.find(x => x.userId === id) || null;
      const who = { name: u?.name || "", role: roleLabel(u?.role) };
      b.disabled = true;
      try {
        if (b.dataset.act === "reset") {
          const pin = prompt(t("users.promptTempPin", who)); if (pin == null) return;
          await Session.resetPin(id, pin.trim());
          ActivityLog.add({ tag: "system", action: t("users.logReset", { role: who.role }), subject: subj(s, u) });
          msg(t("users.msgReset"), "ok");
        } else if (b.dataset.act === "remove") {
          if (!confirm(t("users.confirmRevokeLogin", who))) return;
          if (s) await Staff.revokeLogin(s.id); else await Session.removeUser(id);
          ActivityLog.add({ tag: "system", action: t("users.logRevokeLogin", { role: who.role }), subject: subj(s, u) });
          msg(t("users.msgLoginRevoked"), "ok");
        } else if (b.dataset.act === "revoke") {
          Session.updateUser(id, { aiConsent: null });
          ActivityLog.add({ tag: "system", action: t("users.logRevoke", { role: who.role }), subject: subj(s, u) });
          msg(t("users.msgRevoked"), "ok");
        }
      } catch (err) { msg(err.message || String(err), "err"); }
      finally { b.disabled = false; }
      render();
    }));
  }
  /* Add = find the roster row with that exact name and no login (link it) or create one, then issue the login (temp PIN). */
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
    const modeLabel = (v) => v === "tab" ? t("users.sessionTab") : t("lock.hours", { h: parseInt(v, 10) });
    $("#users-session")?.addEventListener("change", async (e) => {
      const v = e.target.value;
      try {
        await Session.setSessionMode(v);
        Lock.armIdle(); updateChip();
        ActivityLog.add({ tag: "system", action: t("users.logSession", { v: modeLabel(v) }), meta: { silent: true } });
        msg(t("users.msgSession", { v: modeLabel(v) }), "ok");
      } catch (err) { msg(err.message || String(err), "err"); render(); }
    });
    $("#users-add-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#users-add-name").value.trim(), role = $("#users-add-role").value, pin = $("#users-add-pin").value;
      const btn = $("#users-add-btn"); btn.disabled = true;
      try {
        const { user: u, row } = await addLogin({ name, role, pin });
        ActivityLog.add({ tag: "system", action: t("users.logAdd", { role: roleLabel(u.role) }), subject: Staff.ref(row) });
        $("#users-add-name").value = ""; $("#users-add-pin").value = "";
        msg(t("users.msgAdded", { name: u.name }), "ok"); render();
      } catch (err) { msg(err.message || String(err), "err"); }
      finally { btn.disabled = !Session.isOwner(); }
    });
    $("#users-open-roster")?.addEventListener("click", () => { close(); activateTab("tab-license"); });
    Staff.onChange(() => { if (Dialog.isOpen(scrim())) render(); });
    $("#users-pin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#users-pin-form button[type=submit]"); if (btn) btn.disabled = true;
      try {
        await Session.changeOwnPin($("#users-old-pin").value, $("#users-new-pin").value);
        ActivityLog.add({ tag: "system", action: t("users.logPinChanged") });
        $("#users-old-pin").value = ""; $("#users-new-pin").value = "";
        msg(t("users.msgPinChanged"), "ok");
      } catch (err) { msg(err.message || String(err), "err"); }
      finally { if (btn) btn.disabled = false; }
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
  const NO_DESTROY = new Set(["__lock", "__internal", "session", "cloud.directory", "cloud.password", "cloud.token"]);
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
      <tr class="${r.present ? "" : "absent"}${r.unregistered ? " unregistered" : ""}${r.server ? " server" : ""}">
        <td>${NO_DESTROY.has(r.id) ? "" : `<input type="checkbox" data-destroy="${esc(r.id)}" ${r.present ? "" : "disabled"} aria-label="${esc(t("privacy.destroyAria", { label: r.label }))}">`}</td>
        <td><strong>${esc(r.label)}</strong><div class="sec-detail">${esc(r.detail || "")} · <code>${esc(r.store || (r.keys.length ? r.keys.join(", ") : "—"))}</code></div></td>
        <td>${esc(r.purpose)}<div class="sec-detail">${esc(r.basis)}</div></td>
        <td class="${r.encrypted === true ? "enc-yes" : ""}">${esc(encLabel(r.encrypted))}</td>
        <td>${esc(r.retention)}</td>
        <td class="num">${r.count}</td>
        <td class="when">${r.lastModified ? relTime(r.lastModified) : "—"}</td>
      </tr>`).join("");
    const n = ActivityLog.all().length;
    $("#privacy-audit-count").textContent = t("privacy.auditCount", { n, t: n ? relTime(ActivityLog.all()[0].at) : "—" });
    const ws = $("#privacy-wsid"); if (ws) ws.textContent = (Session.workspaceName() || "—") + " @ " + Cloud.url().replace(/^https?:\/\//, "");
  }
  function open(tab = "status") { if (!Session.isUnlocked()) return; msg(""); selectTab(tab); activateTab("tab-privacy", { section: tab }); }
  function close() { /* a panel has nothing to close — kept for callers */ }
  function wire() {
    // The info-modal link is inside a data-i18n-html block and is re-created on every language swap → delegate.
    $("#info-scrim")?.addEventListener("click", (e) => { if (e.target.closest?.("#info-privacy-link")) { e.preventDefault(); Dialog.close($("#info-scrim")); open("legal"); } });
    $("#poc-banner-link")?.addEventListener("click", (e) => { e.preventDefault(); open("legal"); });
    EventBus.on("tab:activated", (p) => { if (p?.id !== "tab-privacy") return; if (p.ctx?.section) selectTab(p.ctx.section); render(); });
    EventBus.on("lifecycle:purged", () => { if (isActive()) render(); });
    EventBus.on("session:users", () => { if (isActive()) render(); });
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
