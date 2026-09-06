/* clinic-admin — Toast (+withUndo), Dialog focus management, Lightbox, Haptic, Camera, Voice, Share, drop-zone + camera-button wiring
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */
import { $, $$, esc } from "./dom.js";
import { EventBus, ActivityLog } from "./store.js";
import { TAB_BY_ID, activateTab } from "./nav.js";

export * from "./dom.js";

/* drop-zone wiring */
function bindDrop(zoneId, onFile) {
  const zone = $("#" + zoneId);
  const input = $("input[type=file]", zone);
  zone.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") return;
    input.click();
  });
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", (e) => {
    if (e.target.files[0]) onFile(e.target.files[0]);
  });
}

/* ─────────────────────────────────────────────────────────
   Toast tray — surfaces ActivityLog as transient notifications
   so cross-tab activity is felt, not hunted for.
   ───────────────────────────────────────────────────────── */
const Toast = (() => {
  const tray = $("#toast-tray");
  const TAG_LABEL = {
    kcd: "KCD", jabo: "자보", yearend: "연말", bigeup: "비급여",
    retention: "보존", search: "검색", ai: "AI",
    license: "면허", accred: "인증", system: "시스템"
  };
  function show({ tag, html, link, ttl = 4500, action }) {
    if (!tray) return;
    const el = document.createElement("div");
    el.className = "toast";
    const goBtn = link ? `<button class="go" data-link="${link}">보기 →</button>`
                : action ? `<button class="go">${esc(action.label)}</button>` : "";
    el.innerHTML = `<span class="tag">${TAG_LABEL[tag] || tag || "·"}</span><span class="text">${html}</span>${goBtn}`;
    tray.appendChild(el);
    const remove = () => { el.style.transition = "opacity .25s, transform .25s"; el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); };
    const t = ttl > 0 ? setTimeout(remove, ttl) : null; // ttl 0 → stays until acted on
    if (link) el.querySelector(".go").addEventListener("click", () => { clearTimeout(t); remove(); activateTab(link); });
    else if (action) el.querySelector(".go").addEventListener("click", () => { clearTimeout(t); remove(); action.fn(); });
  }
  // Undo for destructive actions — a 6 s toast whose only button runs
  // restoreFn, which must put the exact record back (same id, same position).
  // Callers log the delete with { silent: true } so this is the only toast.
  function withUndo(label, restoreFn, tag = "system") {
    show({
      tag, html: esc(label), ttl: 6000,
      action: { label: "되돌리기", fn: () => { Promise.resolve().then(restoreFn).then(() => Haptic.tap()).catch(e => console.error(e)); } }
    });
  }
  // Subscribe to ActivityLog events (skip noisy ones)
  EventBus.on("activity:push", entry => {
    if (!entry) return;
    if (entry.tag === "system" && entry.text === "전체 초기화") return;
    if (entry.meta?.silent) return; // the caller shows its own (undo) toast
    const meta = TAB_BY_ID[`tab-${entry.tag}`];
    const link = meta ? meta.id : null;
    show({ tag: entry.tag, html: entry.text, link });
  });
  return { show, withUndo };
})();

/* Patch ActivityLog.push to emit so toasts hear it.
   (ActivityLog is defined earlier; this wrap stays compatible.) */
(function patchActivity() {
  const orig = ActivityLog.push;
  ActivityLog.push = function (tag, text, ctx) {
    const entry = orig.call(this, tag, text, ctx);
    EventBus.emit("activity:push", entry || { tag, text, at: Date.now() });
    return entry;
  };
})();

/* ─────────────────────────────────────────────────────────
   Mobile features — camera, OCR, voice, share, haptics, lightbox.
   Phone is the actual UX target for a 행정원장 walking the
   hospital floor. Files (license photos, accident photos)
   go into IndexedDB so they don't blow the 5MB localStorage cap.
   ───────────────────────────────────────────────────────── */

// ── Haptic feedback (Android Chrome / supported devices) ──
const Haptic = {
  tap()  { try { navigator.vibrate?.(8); } catch {} },
  save() { try { navigator.vibrate?.([6, 30, 12]); } catch {} },
  warn() { try { navigator.vibrate?.([18, 50, 18, 50, 18]); } catch {} },
  del()  { try { navigator.vibrate?.(20); } catch {} }
};

// ── Camera capture: file → downscaled JPEG dataURL (≤800px, q=0.6) ──
const Camera = {
  async capture(file) {
    if (!file) return null;
    const blob = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = blob;
    });
    const max = 800;
    let { width: w, height: h } = img;
    if (w > max || h > max) {
      const k = Math.min(max / w, max / h);
      w = Math.round(w * k); h = Math.round(h * k);
    }
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.6);
  }
};

// ── Lightbox ──
const Lightbox = {
  open(src) {
    const sc = $("#lightbox");
    const im = $("#lightbox-img");
    if (!sc || !im) return;
    im.src = src;
    Dialog.open(sc, "#lightbox-close");
  },
  close() { Dialog.close($("#lightbox")); }
};
$("#lightbox-close")?.addEventListener("click", Lightbox.close);
$("#lightbox")?.addEventListener("click", e => {
  if (e.target.id === "lightbox") Lightbox.close();
});

// ── Voice dictation (webkitSpeechRecognition · ko-KR) ──
const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let active = null;
  function supported() { return !!SR; }
  function toggle(textarea, btn) {
    if (!SR) {
      alert("이 브라우저는 음성 입력을 지원하지 않습니다 (Chrome/Edge 권장).");
      return;
    }
    if (active) { active.stop(); return; }
    const r = new SR();
    r.lang = "ko-KR";
    r.interimResults = true;
    r.continuous = true;
    const baseValue = textarea.value;
    const baseLen = baseValue.length;
    const sep = baseValue && !/\s$/.test(baseValue) ? " " : "";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tx = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += tx;
        else interim += tx;
      }
      textarea.value = baseValue + sep + finalText + interim;
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      // Trigger input event for persistence binding
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    };
    r.onerror = (e) => {
      console.warn("Voice err", e.error);
      const MSG = {
        "not-allowed":         "마이크 권한이 거부되었습니다 — 브라우저 주소창의 자물쇠/설정에서 마이크를 허용해주세요.",
        "service-not-allowed": "이 브라우저에서 음성 인식 서비스가 허용되지 않았습니다.",
        "audio-capture":       "마이크를 찾을 수 없습니다 — 연결 상태를 확인해주세요.",
        "network":             "음성 인식 서버에 연결할 수 없습니다 — 네트워크를 확인해주세요.",
        "no-speech":           "음성이 감지되지 않았습니다 — 다시 눌러 말해주세요."
      };
      if (e.error !== "aborted") Toast.show({ tag: "ai", html: MSG[e.error] || `음성 입력 오류 — ${esc(e.error || "unknown")}` });
      stop();
    };
    r.onend = () => stop();
    function stop() {
      active = null;
      btn?.classList.remove("recording");
      btn?.setAttribute("aria-label", "음성 입력 시작");
      Haptic.tap();
    }
    active = r;
    btn?.classList.add("recording");
    btn?.setAttribute("aria-label", "음성 입력 중지");
    Haptic.tap();
    try { r.start(); } catch {}
  }
  return { toggle, supported };
})();

// ── Share API with clipboard fallback ──
const Share = (() => {
  async function send({ title, text, url, file }) {
    const data = {};
    if (title) data.title = title;
    if (text)  data.text  = text;
    if (url)   data.url   = url;
    if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
    if (navigator.share) {
      try {
        await navigator.share(data);
        Haptic.tap();
        return { ok: true, via: "share" };
      } catch (err) {
        if (err.name === "AbortError") return { ok: false, via: "share", aborted: true };
      }
    }
    // Clipboard fallback
    const composed = [title, text, url].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(composed);
      Toast.show({ tag: "system", html: "클립보드에 복사되었습니다." });
      Haptic.tap();
      return { ok: true, via: "clipboard" };
    } catch {
      Toast.show({ tag: "system", html: "공유에 실패했습니다." });
      return { ok: false, via: "none" };
    }
  }
  return { send };
})();

// ── Generic camera-button factory (license rows etc.) ──
function bindCameraButton(btn, onCaptured) {
  const input = btn.querySelector("input[type=file]");
  if (!input) return;
  input.addEventListener("change", async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await Camera.capture(f);
      await onCaptured(dataUrl, f);
    } catch (err) {
      console.error(err);
      Toast.show({ tag: "system", html: `사진 처리 실패 — ${err.message}` });
    }
    input.value = "";
  });
}

/* ─────────────────────────────────────────────────────────
   Dialog focus management — every modal scrim goes through
   here: focus moves into the dialog on open, returns to the
   opener on close, the app shell is `inert` while any dialog
   is up, and Tab is trapped inside the top-most dialog.
   ───────────────────────────────────────────────────────── */
const Dialog = (() => {
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const stack = [];
  const shell = () => $(".frame.shell");
  const visible = (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
  function open(scrim, initial) {
    if (!scrim || scrim.classList.contains("open")) return;
    stack.push({ scrim, prev: document.activeElement });
    scrim.classList.add("open");
    const sh = shell(); if (sh) sh.inert = true;
    const target = (typeof initial === "string" ? $(initial, scrim) : initial)
                || $$(FOCUSABLE, scrim).find(visible) || scrim;
    setTimeout(() => { try { target.focus({ preventScroll: true }); } catch {} }, 30);
  }
  function close(scrim) {
    if (!scrim || !scrim.classList.contains("open")) return;
    scrim.classList.remove("open");
    const i = stack.findIndex(e => e.scrim === scrim);
    const entry = i >= 0 ? stack.splice(i, 1)[0] : null;
    if (!stack.length) { const sh = shell(); if (sh) sh.inert = false; }
    const prev = entry?.prev;
    if (prev && prev.isConnected && prev !== document.body) {
      try { prev.focus({ preventScroll: true }); } catch {}
    }
  }
  const isOpen = (scrim) => !!scrim && scrim.classList.contains("open");
  document.addEventListener("keydown", e => {
    if (e.key !== "Tab" || !stack.length) return;
    const top = stack[stack.length - 1].scrim;
    const els = $$(FOCUSABLE, top).filter(visible);
    if (!els.length) { e.preventDefault(); return; }
    const first = els[0], last = els[els.length - 1];
    if (!top.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  return { open, close, isOpen };
})();
export { bindDrop, Toast, Haptic, Camera, Lightbox, Voice, Share, bindCameraButton, Dialog };
