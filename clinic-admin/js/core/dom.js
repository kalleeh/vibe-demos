/* clinic-admin — pure DOM / formatting helpers (no app state). Re-exported by ./ui.js
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const fmtKRW = (n) => new Intl.NumberFormat("ko-KR").format(Math.round(n || 0));
const todayISO = () => new Date().toISOString().slice(0, 10);
// Escape untrusted strings before they go through innerHTML (model output, file cells).
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function setStatus(el, kind, text) {
  if (!el) return;
  el.style.display = "flex";
  el.className = "status-line" + (kind ? " " + kind : "");
  el.innerHTML = `<span class="dot"></span><span>${text}</span>`;
}

// 한글 초성 추출
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
function extractCho(str) {
  let out = "";
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const idx = Math.floor((code - 0xAC00) / 588);
      out += CHO[idx];
    } else {
      out += ch;
    }
  }
  return out;
}

function fuzzyMatch(haystack, needle) {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h.includes(n)) return true;
  // 초성 검색 시도
  if (/^[ㄱ-ㅎ]+$/.test(needle)) {
    return extractCho(haystack).includes(needle);
  }
  return false;
}

function relTime(ts) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "방금";
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
  return `${Math.floor(diff/86400)}일 전`;
}

function daysUntil(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO + (dateISO.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return null;
  const ms = d - new Date();
  return Math.ceil(ms / 86400000);
}

function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* Pseudonymised subject reference for every user-visible surface that is NOT the record
   itself — toasts, the ⌘K palette, the dashboard feed, the activity log.
     redactSubject({ name, pid }) → string
       pid  "2026-0142" → "****0142"   (last 4 characters of the 환자번호, digits/letters)
       name only        → "[환자]"      (a name is never shown, not even an initial)
       nothing          → "—"
   Names are not partially masked ("홍*동") on purpose: with a 3-character Korean name that
   still identifies the person inside a clinic. */
function redactSubject({ name, pid } = {}) {
  const p = String(pid ?? "").replace(/\s+/g, "");
  if (p) return "****" + p.slice(-4);
  if (name && String(name).trim()) return "[환자]";
  return "—";
}
/* Staff (면허 명부) reference for the same surfaces — role + surname initial: "한의사 윤○○".
   Staff are not patients, so the role is the useful part; the initial only disambiguates two
   people with the same role. Never the full name. */
function redactStaff({ role, name } = {}) {
  const n = String(name ?? "").trim();
  const initial = n ? n[0] + "○".repeat(Math.min(Math.max(n.length - 1, 1), 3)) : "—";
  return [String(role ?? "").trim(), initial].filter(Boolean).join(" ");
}
export { $, $$, fmtKRW, todayISO, esc, setStatus, CHO, extractCho, fuzzyMatch, relTime, daysUntil, debounce, redactSubject, redactStaff };
