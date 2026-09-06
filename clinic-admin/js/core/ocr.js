/* clinic-admin — Tesseract.js wrapper (lazy CDN load) + 면허증 field heuristics (면허번호 · 취득일) */

// ── OCR via Tesseract.js (lazy-loaded from CDN) ──
const OCR = (() => {
  let loadingP = null;
  function load() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    // Tesseract (~2MB + language data) stays on the CDN and is never precached.
    if (navigator.onLine === false) return Promise.reject(new Error("오프라인에서는 OCR을 사용할 수 없습니다"));
    if (loadingP) return loadingP;
    loadingP = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      s.onload  = () => res(window.Tesseract);
      s.onerror = () => { loadingP = null; rej(new Error("OCR 엔진(Tesseract.js) 로드 실패 — 네트워크 확인")); };
      document.head.appendChild(s);
    });
    return loadingP;
  }
  const normalize = (text) => String(text || "").replace(/\s+/g, " ").replace(/[ㆍ·]/g, ".");

  // A 면허증 prints 면허번호 · 성명 · 생년월일 · 취득일(면허일) — never a 신고일.
  // Returns the best 취득일 candidate as yyyy-mm-dd: "YYYY-MM-DD", "YYYY.MM.DD", "YYYY년 M월 D일",
  // 19xx and 20xx alike. Dates labelled 생년월일 are demoted; 취득/면허/발급 labels are promoted.
  function extractIssued(text) {
    if (!text) return null;
    const norm = normalize(text);
    const candidates = [];
    const reAny = /((?:19|20)\d{2})[.\-/년]\s?(\d{1,2})[.\-/월]\s?(\d{1,2})/g;
    let m;
    while ((m = reAny.exec(norm)) !== null) {
      const [, y, mo, d] = m;
      if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) continue;
      const ymd = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      candidates.push({ date: ymd, score: 0, idx: m.index, src: m[0] });
    }
    const todayISO = new Date().toISOString().slice(0, 10);
    for (const c of candidates) {
      const ctx = norm.slice(Math.max(0, c.idx - 16), c.idx).toLowerCase();
      if (/취득|면허일|자격일|발급|교부|issue|licen/.test(ctx)) c.score += 10;
      if (/생년월일|출생|birth|born/.test(ctx)) c.score -= 10;
      if (c.date > todayISO) c.score -= 5; // a 취득일 can't be in the future
      c.score += c.idx / 1e6;             // tie-break: later on the card (dates follow the header)
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.date || null;
  }
  // Kept for callers/tests that still use the old name — same result as extractIssued.
  const extractExpiry = extractIssued;

  // 면허번호: digits after "면허번호", "면허 번호", "번호", or "제 … 호" (3–7 digits).
  function extractLicenseNo(text) {
    if (!text) return null;
    const norm = normalize(text);
    const labelled = norm.match(/(?:면허\s?번호|자격\s?번호|번호|licen[cs]e\s?no\.?|no\.)\s*[:：.]?\s*(?:제\s?)?(\d{3,7})\s*호?/i);
    if (labelled) return labelled[1];
    const je = norm.match(/제\s?(\d{3,7})\s?호/);
    return je ? je[1] : null;
  }

  async function run(dataUrl, onProgress) {
    const T = await load();
    const { data } = await T.recognize(dataUrl, "kor+eng", {
      logger: m => onProgress?.(m)
    });
    const text = data.text || "";
    return { text, issued: extractIssued(text), licenseNo: extractLicenseNo(text) };
  }
  return { run, extractIssued, extractExpiry, extractLicenseNo };
})();
export { OCR };
