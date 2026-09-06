/* clinic-admin — Tab 07 · AI 코딩 어시스트 (UI). Hardened in the security pass:
   · default source = 예시 모드 (canned, nothing leaves the browser)
   · 라이브 requires (a) an unlocked session, (b) a per-USER consent stored on the user record
     (js/security/session.js → aiConsent), collected through #ai-consent-scrim, (c) an automatic
     redaction pass (js/security/redact.js) and (d) a preview of exactly what will be sent
     (#ai-preview-scrim) with an explicit "이 내용으로 전송" button.
   · voice dictation is OFF by default behind a toggle whose label discloses inline that it uses
     the browser vendor's cloud speech service.
   The pill/busy/error convention (라이브 · Claude / 예시 결과 · 실시간 연결 실패 / 예시 모드) is unchanged.
   Live transport + canned rule engine live in core/ai-client.js (not this file).
   Cross-tab: ctx { prefill, pid?, stmt?, append? } fills the note (01/02/06 hand-offs; the pid/명세서 show as a chip
   and travel on to 02); every result offers "이 코드로 자보 케이스 채우기" → activateTab("tab-jabo", { dx (EDI),
   items, pid }) and a per-row "검색에서 확인" → 06. The system prompt carries the Org (기관명·종별 → 병원급 rules) and
   the clinic's 비급여 단가표 as <clinic_tariff>.
   i18n: code NAMES are domain data (KOICD standard Korean names, Korean model output). In the English view a
   bundled English name is shown first with the Korean in parentheses when the code is in the bundled tables
   (data/*.json name_en); unknown codes keep the name as returned. Everything else re-renders from state. */
import { $, $$, esc, Voice, Dialog, Toast, roleLabel } from "../core/ui.js";
import { t, tOr, isEn, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { getAiSource, setAiSource, cannedFor, requestRecommendation } from "../core/ai-client.js";
import { Masters, toEdi } from "../core/masters.js";
import { Session } from "../security/session.js";
import { redactNote } from "../security/redact.js";
import { buildSystemPrompt } from "./tab7-prompt.js";
import { activateTab, Org, Patients } from "./_entities-shim.js"; // TODO(integrator): ../core/nav.js + ../core/entities.js
import { tariffRows } from "./claims-shared.js";

const CONSENT_VERSION = 1;
// The sample note is P-2026-0142's (한솔한방병원 · 교통사고 2026-08-03) — Korean clinical text on purpose: it is what
// the canned rule engine (and Claude) read.
const SAMPLE_NOTE = "60세 남자, 3주 전 추돌사고 후 경부·요부 통증 호소. 회전 시 우측 어깨로 방사통. SLR 양성. 침술·부항·추나·약침 시술 예정.";
const SAMPLE_CTX = { pid: "P-2026-0142", stmt: "M2608-0001" };

let seedFn = null;
export function seed() { return seedFn ? seedFn() : Promise.resolve(); }

/* ─────────────────────────────────────────────────────────
   Tab 7 — AI 코딩 어시스트
   Pastes 진료 메모 → 상병(KCD) + U코드 + 행위 + 비급여 추천 with
   citations. Proxy-only live mode via Bedrock Opus.
   Non-streaming (structured JSON brief).
   ───────────────────────────────────────────────────────── */
export function initTab7(ctx = {}) {
  const { DATA } = ctx;
  // Shared AI-state pill (the one next to the result header) — exactly three
  // visible states; hidden while there is no result to label (idle, busy, error).
  const PILL_CLS = { live: "live", fallback: "fallback", canned: "" };
  let pillState = null;
  const setPill = (state) => {
    pillState = state;
    const pill = $("#ai-mode-pill");
    pill.classList.remove("live", "fallback");
    pill.hidden = !state;
    if (!state) return;
    pill.textContent = t("ai.pill." + state);
    if (PILL_CLS[state]) pill.classList.add(PILL_CLS[state]);
  };
  setPill(null); // nothing has been sent yet

  // Source toggle. DEFAULT IS 예시 (canned): ai-client's module-level default is "live", but that
  // value was read before the unlock; re-derive it here from the (now decrypted) setting, and treat
  // "unset" as canned.
  setAiSource(Store.get("ai.source") === "live" ? "live" : "canned");
  const syncSourceUI = () => {
    $$("#ai-source button").forEach(b => b.classList.toggle("active", b.dataset.source === getAiSource()));
    const priv = $("#ai-privacy");
    if (priv) priv.innerHTML = t(getAiSource() === "live" ? "ai.privacyLive" : "ai.privacyCanned");
  };
  $$("#ai-source button").forEach(b => b.addEventListener("click", () => {
    setAiSource(b.dataset.source); syncSourceUI();
  }));
  syncSourceUI();

  // The note may contain clinical text — it is never persisted. Purge any
  // draft an earlier build left in localStorage.
  Store.remove("ai.draft");

  /* ── note context (where the note came from: a 환자번호 / 명세서 handed over by 01·02·06 or the board) ── */
  let noteCtx = null; // { pid, stmt }
  const renderCtx = () => {
    const el = $("#ai-ctx"); if (!el) return;
    if (!noteCtx || (!noteCtx.pid && !noteCtx.stmt)) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    const parts = [];
    if (noteCtx.pid) parts.push(t("ai.ctxPatient", { who: Patients.alias(noteCtx.pid) }));
    if (noteCtx.stmt) parts.push(t("ai.ctxStmt", { stmt: noteCtx.stmt }));
    el.innerHTML = `<span class="pill info">${esc(parts.join(" · "))}</span><button type="button" class="ghost" id="ai-ctx-clear" aria-label="${esc(t("ai.ctxClear"))}" title="${esc(t("ai.ctxClear"))}">×</button>`;
    $("#ai-ctx-clear").addEventListener("click", () => { noteCtx = null; renderCtx(); });
  };
  const applyCtx = (c) => {
    const ta = $("#ai-input");
    if (c.prefill) {
      const cur = ta.value.trim();
      ta.value = c.append && cur ? `${cur}\n${c.prefill}` : c.prefill;
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    if (c.pid || c.stmt) { noteCtx = { pid: c.pid || noteCtx?.pid || "", stmt: c.stmt || "" }; renderCtx(); }
    if (c.pid) Patients.ensure(c.pid, { tags: ["ai"] });
  };
  EventBus.on("tab:activated", (p) => {
    const id = typeof p === "string" ? p : p?.id; const c = typeof p === "string" ? null : p?.ctx;
    if (id !== "tab-ai" || !c) return;
    if (c.prefill || c.pid || c.stmt) applyCtx(c);
  });

  // English view: prefer a bundled English name when the code is one of ours; the Korean standard name stays visible.
  const displayName = (k, group) => {
    if (!isEn()) return k.name;
    let en = "";
    if (group === "kcd" || group === "uCode") en = Masters.kcdIndex().get(toEdi(k.code))?.name_en || "";
    else if (group === "jabo") en = Masters.fee().rows.find(r => r.code === k.code)?.name_en || "";
    else if (group === "bigeup") en = (DATA?.bigeup?.items || []).find(r => r.code === k.code)?.name_en || "";
    return en ? `${en} (${k.name})` : k.name;
  };
  const rowHTML = (group) => (k) => `
      <div class="row">
        <code>${esc(k.code)}</code>
        <div>${esc(displayName(k, group))}<div class="citation">${esc(k.ref)} <button type="button" class="row-act mini" data-check="${esc(k.code)}" title="${esc(t("ai.checkSearchTitle"))}">${esc(t("ai.checkSearch"))}</button></div></div>
        <span class="conf">${Math.round((Number(k.conf) || 0) * 100)}%</span>
      </div>`;
  const emptyRow = () => `<div class="row"><code>—</code><div>${esc(t("ai.noRec"))}</div><span class="conf"></span></div>`;

  let lastRec = null, lastSource = null, lastError = null; // what the output area currently shows
  const renderActions = (rec) => {
    const el = $("#ai-actions"); if (!el) return;
    if (!rec) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = `<button type="button" class="btn secondary" id="ai-fill-jabo">${esc(t("ai.fillJabo"))} <span class="arrow">→</span></button>
      <span class="ai-actions-hint">${esc(t("ai.fillJaboHint", { dx: toEdi(rec.kcd[0]?.code || ""), n: rec.jabo.length }))}</span>`;
    $("#ai-fill-jabo").addEventListener("click", () => {
      const payload = { dx: toEdi(rec.kcd[0]?.code || ""), items: rec.jabo.map(k => k.code), pid: noteCtx?.pid || "" };
      ActivityLog.push("ai", t("ai.logFillJabo", { dx: payload.dx, n: payload.items.length }), noteCtx?.pid ? { pid: noteCtx.pid } : {});
      activateTab("tab-jabo", payload);
    });
  };
  const renderRecommendation = (rec, opts = {}) => {
    const lines = [];
    // Every result is labelled with its source — canned output must never read as live.
    const src = opts.source || "canned";
    lastRec = rec; lastSource = src; lastError = null;
    lines.push(src === "live"     ? `<div class="ai-note live">${esc(t("ai.noteLive"))}</div>`
             : src === "fallback" ? `<div class="ai-note fallback">${esc(t("ai.noteFallback"))}</div>`
             :                      `<div class="ai-note">${esc(t("ai.noteCanned"))}</div>`);
    lines.push(`<h5>${esc(t("ai.hKcd"))}</h5>`);
    lines.push(`<div class="code-list">${rec.kcd.map(rowHTML("kcd")).join("")}</div>`);
    lines.push(`<h5>${esc(t("ai.hU"))}</h5>`);
    lines.push(`<div class="code-list">${rowHTML("uCode")(rec.uCode)}</div>`);
    lines.push(`<h5>${esc(t("ai.hJabo"))}</h5>`);
    lines.push(`<div class="code-list">${rec.jabo.map(rowHTML("jabo")).join("") || emptyRow()}</div>`);
    lines.push(`<h5>${esc(t("ai.hBigeup"))}</h5>`);
    lines.push(`<div class="code-list">${rec.bigeup.map(rowHTML("bigeup")).join("") || emptyRow()}</div>`);
    $("#ai-output").innerHTML = lines.join("");
    $("#ai-output").querySelectorAll("button[data-check]").forEach(b => b.addEventListener("click", () => activateTab("tab-search", { query: b.dataset.check })));
    renderActions(rec);
    setPill(src);
  };

  const SHIMMER = `<div class="ai-shimmer"></div><div class="ai-shimmer" style="width:80%"></div><div class="ai-shimmer" style="width:60%"></div>`;
  const runBtn = $("#ai-run");
  let aiBusy = false, aiAbort = null;
  const paintBusy = () => { runBtn.innerHTML = aiBusy ? `${esc(t("ai.busy"))} <span class="arrow">⋯</span>` : t("ai.runBtn"); };
  const setBusy = (on) => {
    aiBusy = on;
    runBtn.disabled = on;
    paintBusy();
  };

  // source: "canned" (user chose 예시) | "fallback" (live failed, user asked for the example)
  const runCanned = (note, source = "canned") => {
    if (aiBusy) return Promise.resolve();
    setBusy(true);
    setPill(null); renderActions(null);
    $("#ai-output").innerHTML = SHIMMER;
    return new Promise((res) => setTimeout(() => {
      const rec = cannedFor(note);
      renderRecommendation(rec, { source });
      ActivityLog.push("ai", t(source === "fallback" ? "ai.logCannedFallback" : "ai.logCanned"), { len: note.length });
      setBusy(false);
      res();
    }, 700));
  };

  // Live failure: hide the pill, say what happened, and offer retry or the
  // canned result as explicit buttons — never silently swap the example in.
  const showLiveError = (code, note) => {
    setPill(null); renderActions(null);
    lastRec = null; lastError = { code, note };
    $("#ai-output").innerHTML = `<div class="placeholder ai-error">${esc(t("ai.errLine", { code }))}
      <div class="ai-error-actions">
        <button type="button" class="btn secondary" id="ai-retry">${esc(t("common.retry"))}</button>
        <button type="button" class="btn secondary" id="ai-fallback">${esc(t("ai.viewCanned"))}</button>
      </div></div>`;
    $("#ai-retry")?.addEventListener("click", () => runLive(note));
    $("#ai-fallback")?.addEventListener("click", () => runCanned(note, "fallback"));
  };

  // Our 비급여 단가표 (tab 04) with names from the bundled 비급여 items → <clinic_tariff> in the system prompt.
  const bigeupName = (code) => (DATA?.bigeup?.items || []).find(r => r.code === code)?.name || "";

  // `note` here is ALWAYS the redacted text confirmed in the preview.
  const runLive = async (note) => {
    if (aiBusy) return;
    if (!Session.isUnlocked()) { showLiveError(t("ai.errLocked"), note); return; }
    setBusy(true);
    setPill(null); renderActions(null); // "라이브 · Claude" only once a live answer is actually rendered
    $("#ai-output").innerHTML = SHIMMER;
    aiAbort = new AbortController();
    const { signal } = aiAbort;
    const timeout = setTimeout(() => aiAbort?.abort(), 60000);
    try {
      const rec = await requestRecommendation({ system: buildSystemPrompt(Org.get()), note, signal, tariff: tariffRows(bigeupName) });
      renderRecommendation(rec, { source: "live" });
      ActivityLog.push("ai", t("ai.logLive"), { len: note.length });
    } catch (err) {
      // (NNN) is the proxy status; non-HTTP failures get a short label instead.
      const code = err.name === "AbortError" ? t("ai.errTimeout")
                 : err.status ? String(err.status)
                 : err.code || (err.message === "pow-timeout" ? "PoW" : t("ai.errConn"));
      if (err.name !== "AbortError") console.error(err);
      showLiveError(code, note);
    } finally {
      clearTimeout(timeout);
      aiAbort = null;
      setBusy(false);
    }
  };

  /* ── per-user consent dialog ── */
  const hasConsent = () => {
    const me = Session.user(); if (!me) return false;
    const u = Session.users().find(x => x.id === me.id);
    return !!(u?.aiConsent && u.aiConsent.version === CONSENT_VERSION);
  };
  const askConsent = () => new Promise((resolve) => {
    const sc = $("#ai-consent-scrim");
    const me = Session.user();
    $("#ai-consent-user").textContent = me ? `${me.name} · ${roleLabel(me.role)}` : "—";
    const chk = $("#ai-consent-check"); chk.checked = false;
    const ok = $("#ai-consent-accept"); ok.disabled = true;
    const done = (v) => { Dialog.close(sc); cleanup(); resolve(v); };
    const onChk = () => { ok.disabled = !chk.checked; };
    const onOk = () => {
      Session.updateUser(me.id, { aiConsent: { at: Date.now(), version: CONSENT_VERSION } });
      ActivityLog.push("ai", t("ai.logConsent"));
      done(true);
    };
    const onNo = () => done(false);
    const onScrim = (e) => { if (e.target.id === "ai-consent-scrim") done(false); };
    function cleanup() { chk.removeEventListener("change", onChk); ok.removeEventListener("click", onOk); $("#ai-consent-decline").removeEventListener("click", onNo); $("#ai-consent-close").removeEventListener("click", onNo); sc.removeEventListener("click", onScrim); }
    chk.addEventListener("change", onChk); ok.addEventListener("click", onOk);
    $("#ai-consent-decline").addEventListener("click", onNo); $("#ai-consent-close").addEventListener("click", onNo); sc.addEventListener("click", onScrim);
    Dialog.open(sc, "#ai-consent-check");
  });

  /* ── redaction preview ("전송될 내용") ── */
  const kindLabel = (k) => tOr("ai.kind." + k, k);
  const showPreview = (rawNote) => new Promise((resolve) => {
    const sc = $("#ai-preview-scrim");
    const r = redactNote(rawNote);
    $("#ai-preview-text").innerHTML = r.html || `<span class="ai-preview-empty">${esc(t("ai.previewEmpty"))}</span>`;
    const parts = Object.entries(r.counts).map(([k, n]) => `${kindLabel(k)} ${n}`).join(" · ");
    $("#ai-preview-summary").innerHTML = r.replacements.length
      ? t("ai.previewMasked", { n: r.replacements.length, parts: esc(parts) })
      : t("ai.previewNone");
    $("#ai-preview-original").textContent = rawNote;
    $("#ai-preview-original-wrap").open = false;
    const done = (v) => { Dialog.close(sc); cleanup(); resolve(v); };
    const onSend = () => done(r.text);
    const onCancel = () => done(null);
    const onScrim = (e) => { if (e.target.id === "ai-preview-scrim") done(null); };
    function cleanup() { $("#ai-preview-send").removeEventListener("click", onSend); $("#ai-preview-cancel").removeEventListener("click", onCancel); $("#ai-preview-close").removeEventListener("click", onCancel); sc.removeEventListener("click", onScrim); }
    $("#ai-preview-send").addEventListener("click", onSend); $("#ai-preview-cancel").addEventListener("click", onCancel); $("#ai-preview-close").addEventListener("click", onCancel); sc.addEventListener("click", onScrim);
    Dialog.open(sc, "#ai-preview-send");
  });

  $("#ai-run").addEventListener("click", async () => {
    if (aiBusy) return;
    const note = $("#ai-input").value.trim();
    if (!note) {
      $("#ai-output").innerHTML = `<div class="placeholder">${esc(t("ai.enterNote"))}</div>`;
      return;
    }
    if (getAiSource() === "canned") { runCanned(note); return; }
    // 라이브: unlocked session → per-user consent → redaction preview → send.
    if (!Session.isUnlocked()) { Toast.show({ tag: "ai", html: esc(t("ai.lockedToast")) }); return; }
    if (!hasConsent() && !(await askConsent())) return;
    const redacted = await showPreview(note);
    if (redacted == null) return;
    runLive(redacted);
  });

  seedFn = () => {
    $("#ai-input").value = SAMPLE_NOTE;
    noteCtx = { ...SAMPLE_CTX }; renderCtx();
    return runCanned(SAMPLE_NOTE);
  };
  $('[data-action="run-ai"]').addEventListener("click", () => { seedFn(); });

  /* ── Voice dictation — OFF by default, behind a toggle with an inline disclosure ── */
  const micBtn = $("#ai-mic");
  let voiceWrap = null;
  const paintVoice = () => {
    if (!voiceWrap) return;
    voiceWrap.querySelector(".ai-voice-toggle span").textContent = t("ai.voiceToggle");
    voiceWrap.querySelector(".ai-voice-disclosure").innerHTML = t("ai.voiceDisclosure");
  };
  if (micBtn) {
    micBtn.hidden = true;
    if (Voice.supported()) {
      voiceWrap = document.createElement("div");
      voiceWrap.className = "ai-voice-opt";
      voiceWrap.innerHTML = `
        <label class="ai-voice-toggle"><input type="checkbox" id="ai-voice-toggle">
          <span></span></label>
        <span class="ai-voice-disclosure"></span>`;
      paintVoice();
      $("#ai-source")?.parentElement?.insertAdjacentElement("afterend", voiceWrap);
      $("#ai-voice-toggle").addEventListener("change", (e) => {
        micBtn.hidden = !e.target.checked;
        if (e.target.checked) ActivityLog.push("ai", t("ai.logVoiceOn"));
      });
      micBtn.addEventListener("click", () => Voice.toggle($("#ai-input"), micBtn));
    }
  }

  onLangChange(() => {
    syncSourceUI(); paintBusy(); paintVoice(); renderCtx();
    if (aiBusy) return; // shimmer stays; the result paints in the new language when it lands
    if (lastRec) renderRecommendation(lastRec, { source: lastSource });
    else if (lastError) showLiveError(lastError.code, lastError.note);
    else setPill(pillState);
  });
}
