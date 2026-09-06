/* clinic-admin — client-side redaction pass (pure functions, imports nothing).

   redactNote(text) → { text, html, replacements, counts }
     text          the redacted note (what actually leaves the browser)
     html          escaped redacted text with each substitution wrapped in
                   <mark class="redact" data-kind="…" title="원문 유형">…</mark>
     replacements  [{ kind, from, to }] in document order
     counts        { 주민번호: n, 연락처: n, 날짜: n, 환자: n, 주소: n, 차량: n }

   Masks: 주민등록번호 (13 digits, with/without hyphen) → [주민번호]
          phone numbers → [연락처]
          차량번호 → [차량]
          dates (YYYY-MM-DD / YYYY.MM.DD / YYYY년 M월 D일 / YYYYMMDD / YYMMDD)
              → relative ("3주 전") or month-only ("2025년 3월")
          Korean names after 환자/성명/이름 labels, before 님/씨, or before 환자 → [환자]
          addresses (시/구/동 … 번지/호) → [주소]

   scrubIdentifiers(text) — RRN + phone only; used by ActivityLog so an action
   label can never carry a 번호 even if a caller pastes one in.

   Heuristic by design: it lowers exposure, it does not guarantee anonymity —
   the preview step exists so a human confirms what is sent. */

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const NOT_NAMES = new Set(["남자", "여자", "남성", "여성", "신규", "초진", "재진", "외래", "입원", "소아", "성인", "노인",
  "해당", "동일", "선생", "원장", "사장", "부장", "과장", "부모", "어머", "아버", "할머", "할아버", "고객", "회원", "직원", "보호자", "기존", "자보", "교통사고", "사고", "산재", "건보", "일반", "예시", "실제", "가상", "담당", "주치", "협진",
  "내원", "방문", "치료", "진료", "상기", "위의", "본원", "타원", "당일", "다음", "이전", "오늘", "내일", "어제"]);

function relDate(y, mo, d, now = new Date()) {
  const Y = Number(y), M = Number(mo), D = Number(d);
  if (!(M >= 1 && M <= 12 && D >= 1 && D <= 31)) return null;
  const t = new Date(Y, M - 1, D);
  if (isNaN(t)) return null;
  const days = Math.round((now.setHours(0, 0, 0, 0) - t.getTime()) / 86400000);
  if (days === 0) return "오늘";
  if (days > 0 && days < 7) return `${days}일 전`;
  if (days >= 7 && days < 56) return `${Math.round(days / 7)}주 전`;
  if (days >= 56 && days < 730) return `${Math.round(days / 30.4)}개월 전`;
  if (days < 0 && days > -56) return `${Math.abs(days)}일 후`;
  return `${Y}년 ${M}월`;
}

// Order matters: identifiers first (so a phone is never half-eaten by a date rule),
// vehicle plates before dates, then addresses, then names.
const RULES = [
  { kind: "주민번호", re: /(?<!\d)\d{6}\s?-?\s?[1-4]\d{6}(?!\d)/g, to: () => "[주민번호]" },
  { kind: "연락처", re: /(?<!\d)(?:\+82[-\s]?|0)1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g, to: () => "[연락처]" },
  { kind: "연락처", re: /(?<!\d)0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}(?!\d)/g, to: () => "[연락처]" },
  { kind: "차량", re: /(?<!\d)\d{2,3}\s?[가-힣]\s?\d{4}(?!\d)/g, to: () => "[차량]" },
  { kind: "날짜", re: /(?<!\d)((?:19|20)\d{2})\s?[.\-/년]\s?(\d{1,2})\s?[.\-/월]\s?(\d{1,2})(?:\s?일)?(?!\d)/g,
    to: (m, y, mo, d) => relDate(y, mo, d) },
  { kind: "날짜", re: /(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)/g, to: (m, y, mo, d) => relDate(y, mo, d) },
  { kind: "날짜", re: /(?<![\d-])(\d{2})(\d{2})(\d{2})(?![\d-])/g,
    to: (m, y, mo, d) => relDate(Number(y) > 30 ? `19${y}` : `20${y}`, mo, d) },
  { kind: "주소", re: /(?:[가-힣]{2,}(?:특별시|광역시|특별자치시|특별자치도|시|도)\s*)?[가-힣]{1,}(?:구|군)\s*[가-힣0-9]{1,}(?:동|읍|면|로|길)(?:\s*\d+(?:-\d+)?(?:번지|호|번|층)?)*(?:\s*\d+(?:동|호))*/g,
    to: () => "[주소]" },
  { kind: "환자", re: /(환자명|환자|성명|이름)\s*[:：]\s*([가-힣]{2,4})(?![가-힣])/g, to: (m, label) => `${label}: [환자]` },
  { kind: "환자", re: /(환자명|성명|이름)\s+([가-힣]{2,4})(?![가-힣])/g, to: (m, label) => `${label} [환자]` },
  { kind: "환자", re: /(?<![가-힣])([가-힣]{2,4})\s?(님|씨)(?![가-힣])/g,
    to: (m, name, suf) => NOT_NAMES.has(name) ? null : `[환자]${suf}` },
  { kind: "환자", re: /(?<![가-힣])([가-힣]{2,3})\s?환자(?![가-힣])/g,
    to: (m, name) => NOT_NAMES.has(name) ? null : "[환자] 환자" }
];

const T0 = "\uE000", T1 = "\uE001"; // private-use sentinels: never digits or 한글, so later rules skip them
const idxToken = (i) => { let s = ""; do { s = String.fromCharCode(97 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0); return s; };
const tokenRe = /\uE000([a-z]+)\uE001/g;
const tokenToIdx = (s) => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 97 + 1); return n - 1; };

function redactNote(input) {
  const src = String(input ?? "");
  const replacements = [];
  let work = src;
  for (const rule of RULES) {
    work = work.replace(rule.re, (...args) => {
      const m = args[0];
      if (m.includes(T0)) return m; // already contains a token — leave it
      const to = rule.to(...args);
      if (to == null) return m;
      const idx = replacements.push({ kind: rule.kind, from: m, to }) - 1;
      return T0 + idxToken(idx) + T1;
    });
  }
  const text = work.replace(tokenRe, (_, t) => replacements[tokenToIdx(t)].to);
  const html = esc(work).replace(tokenRe, (_, t) => {
    const r = replacements[tokenToIdx(t)];
    return `<mark class="redact" data-kind="${esc(r.kind)}" title="${esc(r.kind)} 마스킹">${esc(r.to)}</mark>`;
  });
  const counts = {};
  for (const r of replacements) counts[r.kind] = (counts[r.kind] || 0) + 1;
  return { text, html, replacements, counts };
}

function scrubIdentifiers(input) {
  let s = String(input ?? "");
  for (const rule of RULES.slice(0, 3)) s = s.replace(rule.re, rule.to());
  return s;
}

export { redactNote, scrubIdentifiers, relDate };
