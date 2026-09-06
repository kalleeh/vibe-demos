/* clinic-admin — Tab 07 · AI 코딩 어시스트 (UI). Hardened in the security pass:
   · default source = 예시 모드 (canned, nothing leaves the browser)
   · 라이브 requires (a) an unlocked session, (b) a per-USER consent stored on the user record
     (js/security/session.js → aiConsent), collected through #ai-consent-scrim, (c) an automatic
     redaction pass (js/security/redact.js) and (d) a preview of exactly what will be sent
     (#ai-preview-scrim) with an explicit "이 내용으로 전송" button.
   · voice dictation is OFF by default behind a toggle whose label discloses inline that it uses
     the browser vendor's cloud speech service.
   The pill/busy/error convention (라이브 · Claude / 예시 결과 · 실시간 연결 실패 / 예시 모드) is unchanged.
   Live transport + canned rule engine live in core/ai-client.js (not this file). */
import { $, $$, esc, Voice, Dialog, Toast } from "../core/ui.js";
import { Store, ActivityLog } from "../core/store.js";
import { getAiSource, setAiSource, cannedFor, requestRecommendation } from "../core/ai-client.js";
import { Session } from "../security/session.js";
import { redactNote } from "../security/redact.js";
import { SYSTEM_PROMPT } from "./tab7-prompt.js";

const CONSENT_VERSION = 1;

/* ─────────────────────────────────────────────────────────
   Tab 7 — AI 코딩 어시스트
   Pastes 진료 메모 → KCD-8 + 자보 + 비급여 추천 with
   citations. Proxy-only live mode via Bedrock Opus.
   Non-streaming (structured JSON brief).
   ───────────────────────────────────────────────────────── */
export function initTab7() {
  // Shared AI-state pill (the one next to the result header) — exactly three
  // visible states; hidden while there is no result to label (idle, busy, error).
  const PILL = {
    live:     { text: "라이브 · Claude",             cls: "live" },
    fallback: { text: "예시 결과 · 실시간 연결 실패", cls: "fallback" },
    canned:   { text: "예시 모드",                   cls: "" }
  };
  const setPill = (state) => {
    const pill = $("#ai-mode-pill");
    pill.classList.remove("live", "fallback");
    pill.hidden = !state;
    if (!state) return;
    pill.textContent = PILL[state].text;
    if (PILL[state].cls) pill.classList.add(PILL[state].cls);
  };
  setPill(null); // nothing has been sent yet

  // Source toggle. DEFAULT IS 예시 (canned): ai-client's module-level default is "live", but that
  // value was read before the unlock; re-derive it here from the (now decrypted) setting, and treat
  // "unset" as canned.
  setAiSource(Store.get("ai.source") === "live" ? "live" : "canned");
  const syncSourceUI = () => {
    $$("#ai-source button").forEach(b => b.classList.toggle("active", b.dataset.source === getAiSource()));
    const priv = $("#ai-privacy");
    if (priv) priv.innerHTML = getAiSource() === "live"
      ? `<strong>라이브:</strong> 전송 전 자동 마스킹 → 전송 내용 미리보기 → 확인 후에만 <code>ai.pb.gurum.se</code>(Amazon Bedrock, 스톡홀름)로 전송됩니다. 서버에 저장되지 않습니다. <strong>실제 환자 정보는 입력하지 마세요.</strong>`
      : `<strong>예시 모드:</strong> 아무것도 전송하지 않습니다 — 브라우저 안의 규칙 기반 예시 결과입니다. 라이브로 바꾸면 전송 전에 마스킹 미리보기와 사용자별 동의를 거칩니다.`;
  };
  $$("#ai-source button").forEach(b => b.addEventListener("click", () => {
    setAiSource(b.dataset.source); syncSourceUI();
  }));
  syncSourceUI();

  // The note may contain clinical text — it is never persisted. Purge any
  // draft an earlier build left in localStorage.
  Store.remove("ai.draft");

  const rowHTML = (k) => `
      <div class="row">
        <code>${esc(k.code)}</code>
        <div>${esc(k.name)}<div class="citation">${esc(k.ref)}</div></div>
        <span class="conf">${Math.round((Number(k.conf) || 0) * 100)}%</span>
      </div>`;
  const EMPTY_ROW = `<div class="row"><code>—</code><div>추천 없음</div><span class="conf"></span></div>`;

  const renderRecommendation = (rec, opts = {}) => {
    const lines = [];
    // Every result is labelled with its source — canned output must never read as live.
    const src = opts.source || "canned";
    lines.push(src === "live"     ? `<div class="ai-note live">라이브 · Claude 응답 — 마스킹된 메모 기준</div>`
             : src === "fallback" ? `<div class="ai-note fallback">예시 결과 · 실시간 연결 실패 — 규칙 기반 데모, 실제 AI 응답이 아닙니다</div>`
             :                      `<div class="ai-note">예시 결과 — 규칙 기반 데모, 실제 AI 응답이 아닙니다</div>`);
    lines.push(`<h5>KCD-8 진단</h5>`);
    lines.push(`<div class="code-list">${rec.kcd.map(rowHTML).join("")}</div>`);
    lines.push(`<h5>한의 변증 (U-code) — 양방 진단과 함께 청구</h5>`);
    lines.push(`<div class="code-list">${rowHTML(rec.uCode)}</div>`);
    lines.push(`<h5>자보 수가</h5>`);
    lines.push(`<div class="code-list">${rec.jabo.map(rowHTML).join("") || EMPTY_ROW}</div>`);
    lines.push(`<h5>비급여 (병원 자체 산정)</h5>`);
    lines.push(`<div class="code-list">${rec.bigeup.map(rowHTML).join("") || EMPTY_ROW}</div>`);
    $("#ai-output").innerHTML = lines.join("");
    setPill(src);
  };

  const SHIMMER = `<div class="ai-shimmer"></div><div class="ai-shimmer" style="width:80%"></div><div class="ai-shimmer" style="width:60%"></div>`;
  const runBtn = $("#ai-run");
  let aiBusy = false, aiAbort = null;
  const setBusy = (on) => {
    aiBusy = on;
    runBtn.disabled = on;
    runBtn.innerHTML = on ? `분석 중… <span class="arrow">⋯</span>` : `코드 추천 <span class="arrow">→</span>`;
  };

  // source: "canned" (user chose 예시) | "fallback" (live failed, user asked for the example)
  const runCanned = (note, source = "canned") => {
    if (aiBusy) return;
    setBusy(true);
    setPill(null);
    $("#ai-output").innerHTML = SHIMMER;
    setTimeout(() => {
      const rec = cannedFor(note);
      renderRecommendation(rec, { source });
      ActivityLog.push("ai", source === "fallback" ? "AI 예시 코드 추천 (라이브 실패 → 규칙 기반)" : "AI 예시 코드 추천 (규칙 기반)", { len: note.length });
      setBusy(false);
    }, 700);
  };

  // Live failure: hide the pill, say what happened, and offer retry or the
  // canned result as explicit buttons — never silently swap the example in.
  const showLiveError = (code, note) => {
    setPill(null);
    $("#ai-output").innerHTML = `<div class="placeholder ai-error">라이브 서버가 잠시 바쁩니다 (${esc(code)}) — 다시 시도하거나 예시 결과를 볼 수 있어요
      <div class="ai-error-actions">
        <button type="button" class="btn secondary" id="ai-retry">다시 시도</button>
        <button type="button" class="btn secondary" id="ai-fallback">예시 결과 보기</button>
      </div></div>`;
    $("#ai-retry")?.addEventListener("click", () => runLive(note));
    $("#ai-fallback")?.addEventListener("click", () => runCanned(note, "fallback"));
  };

  // `note` here is ALWAYS the redacted text confirmed in the preview.
  const runLive = async (note) => {
    if (aiBusy) return;
    if (!Session.isUnlocked()) { showLiveError("잠금", note); return; }
    setBusy(true);
    setPill(null); // "라이브 · Claude" only once a live answer is actually rendered
    $("#ai-output").innerHTML = SHIMMER;
    aiAbort = new AbortController();
    const { signal } = aiAbort;
    const timeout = setTimeout(() => aiAbort?.abort(), 60000);
    try {
      const rec = await requestRecommendation({ system: SYSTEM_PROMPT, note, signal });
      renderRecommendation(rec, { source: "live" });
      ActivityLog.push("ai", "AI 라이브 코드 추천 (Opus / 프록시, 마스킹 후 전송)", { len: note.length });
    } catch (err) {
      // (NNN) is the proxy status; non-HTTP failures get a short label instead.
      const code = err.name === "AbortError" ? "시간 초과"
                 : err.status ? String(err.status)
                 : err.code || (err.message === "pow-timeout" ? "PoW" : "연결 오류");
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
    $("#ai-consent-user").textContent = me ? `${me.name} · ${me.role}` : "—";
    const chk = $("#ai-consent-check"); chk.checked = false;
    const ok = $("#ai-consent-accept"); ok.disabled = true;
    const done = (v) => { Dialog.close(sc); cleanup(); resolve(v); };
    const onChk = () => { ok.disabled = !chk.checked; };
    const onOk = () => {
      Session.updateUser(me.id, { aiConsent: { at: Date.now(), version: CONSENT_VERSION } });
      ActivityLog.push("ai", "AI 전송 동의 (사용자별) — ai.pb.gurum.se → Bedrock eu-north-1");
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
  const showPreview = (rawNote) => new Promise((resolve) => {
    const sc = $("#ai-preview-scrim");
    const r = redactNote(rawNote);
    $("#ai-preview-text").innerHTML = r.html || `<span class="ai-preview-empty">(빈 메모)</span>`;
    const parts = Object.entries(r.counts).map(([k, n]) => `${k} ${n}`).join(" · ");
    $("#ai-preview-summary").innerHTML = r.replacements.length
      ? `<strong>${r.replacements.length}곳</strong> 마스킹 — ${esc(parts)}. 표시된 <mark class="redact">항목</mark>만 바뀌었고, 나머지는 원문 그대로 전송됩니다.`
      : `마스킹된 항목이 없습니다 — 아래 내용이 <strong>그대로</strong> 전송됩니다. 이름·번호·날짜가 남아 있지 않은지 확인하세요.`;
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
      $("#ai-output").innerHTML = `<div class="placeholder">진료 메모를 입력해주세요.</div>`;
      return;
    }
    if (getAiSource() === "canned") { runCanned(note); return; }
    // 라이브: unlocked session → per-user consent → redaction preview → send.
    if (!Session.isUnlocked()) { Toast.show({ tag: "ai", html: "잠금 해제 후 라이브 모드를 사용할 수 있습니다." }); return; }
    if (!hasConsent() && !(await askConsent())) return;
    const redacted = await showPreview(note);
    if (redacted == null) return;
    runLive(redacted);
  });

  $('[data-action="run-ai"]').addEventListener("click", () => {
    const sample = "60세 남자, 3주 전 추돌사고 후 경부·요부 통증 호소. 회전 시 우측 어깨로 방사통. SLR 양성. 침술·부항·추나·약침 시술 예정.";
    $("#ai-input").value = sample;
    runCanned(sample);
  });

  /* ── Voice dictation — OFF by default, behind a toggle with an inline disclosure ── */
  const micBtn = $("#ai-mic");
  if (micBtn) {
    micBtn.hidden = true;
    if (Voice.supported()) {
      const wrap = document.createElement("div");
      wrap.className = "ai-voice-opt";
      wrap.innerHTML = `
        <label class="ai-voice-toggle"><input type="checkbox" id="ai-voice-toggle">
          <span>음성 받아쓰기 켜기</span></label>
        <span class="ai-voice-disclosure">음성 입력은 <strong>브라우저 제조사의 클라우드 음성인식 서비스</strong>(Chrome → Google, Edge → Microsoft)로 오디오를 전송해 텍스트로 바꿉니다. 이 앱은 그 서비스와 위탁계약이 없으며, 마스킹은 텍스트가 된 뒤에만 적용됩니다. 실제 환자 정보는 말하지 마세요.</span>`;
      $("#ai-source")?.parentElement?.insertAdjacentElement("afterend", wrap);
      $("#ai-voice-toggle").addEventListener("change", (e) => {
        micBtn.hidden = !e.target.checked;
        if (e.target.checked) ActivityLog.push("ai", "음성 받아쓰기 켬 (브라우저 클라우드 STT)");
      });
      micBtn.addEventListener("click", () => Voice.toggle($("#ai-input"), micBtn));
    }
  }
}
