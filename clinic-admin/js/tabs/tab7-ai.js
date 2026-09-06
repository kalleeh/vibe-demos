/* clinic-admin — Tab 07
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, $$, esc, Voice } from "../core/ui.js";
import { Store, ActivityLog } from "../core/store.js";
import { LIVE_ACK_KEY, getAiSource, setAiSource, cannedFor, requestRecommendation } from "../core/ai-client.js";
import { SYSTEM_PROMPT } from "./tab7-prompt.js";

/* ─────────────────────────────────────────────────────────
   Tab 7 — AI 코딩 어시스트
   Pastes 진료 메모 → KCD-8 + 자보 + 비급여 추천 with
   citations. Proxy-only live mode via Bedrock Opus.
   Non-streaming (structured JSON brief).
   ───────────────────────────────────────────────────────── */
export function initTab7() {
  // (CLAUDE_PROXY + solveProxyPoW live in core/ai-client.js)
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

  // Source toggle — 라이브 (default) POSTs the note to the proxy; 예시 never leaves the browser.
  // (aiSource state + LIVE_ACK_KEY live in core/ai-client.js)
  const syncSourceUI = () => $$("#ai-source button").forEach(b => b.classList.toggle("active", b.dataset.source === getAiSource()));
  $$("#ai-source button").forEach(b => b.addEventListener("click", () => {
    setAiSource(b.dataset.source); syncSourceUI();
  }));
  syncSourceUI();

  // The note may contain clinical text — it is never persisted. Purge any
  // draft an earlier build left in localStorage.
  Store.remove("ai.draft");

  // (cannedFor / normItem / validateRec live in core/ai-client.js)
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
    lines.push(src === "live"     ? `<div class="ai-note live">라이브 · Claude 응답</div>`
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

  // System prompt lives in ./tab7-prompt.js (see its PROVENANCE note).
  const runLive = async (note) => {
    if (aiBusy) return;
    setBusy(true);
    setPill(null); // "라이브 · Claude" only once a live answer is actually rendered
    $("#ai-output").innerHTML = SHIMMER;
    aiAbort = new AbortController();
    const { signal } = aiAbort;
    const timeout = setTimeout(() => aiAbort?.abort(), 60000);
    try {
      const rec = await requestRecommendation({ system: SYSTEM_PROMPT, note, signal });
      renderRecommendation(rec, { source: "live" });
      ActivityLog.push("ai", "AI 라이브 코드 추천 (Opus / 프록시)", {});
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

  $("#ai-run").addEventListener("click", () => {
    if (aiBusy) return;
    const note = $("#ai-input").value.trim();
    if (!note) {
      $("#ai-output").innerHTML = `<div class="placeholder">진료 메모를 입력해주세요.</div>`;
      return;
    }
    if (getAiSource() === "canned") { runCanned(note); return; }
    if (!Store.get(LIVE_ACK_KEY)) {
      if (!confirm("이 메모는 외부 AI 서버로 전송됩니다. 실제 환자 정보는 입력하지 마세요.\n\n(ai.pb.gurum.se — 서버에 저장되지 않습니다. 이 안내는 한 번만 표시됩니다.)\n\n계속하시겠습니까?")) return;
      Store.set(LIVE_ACK_KEY, true);
    }
    runLive(note);
  });

  $('[data-action="run-ai"]').addEventListener("click", () => {
    const sample = "60세 남자, 3주 전 추돌사고 후 경부·요부 통증 호소. 회전 시 우측 어깨로 방사통. SLR 양성. 침술·부항·추나·약침 시술 예정.";
    $("#ai-input").value = sample;
    runCanned(sample);
  });

  // Voice dictation (ko-KR) — fills textarea live as 행정원장 dictates
  const micBtn = $("#ai-mic");
  if (micBtn) {
    if (!Voice.supported()) {
      micBtn.style.display = "none";
    } else {
      micBtn.addEventListener("click", () => Voice.toggle($("#ai-input"), micBtn));
    }
  }
}
