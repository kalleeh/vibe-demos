/* clinic-admin — Tesseract.js wrapper (lazy CDN load) + Korean expiry-date heuristics
   Extracted verbatim from the former single-file index.html; behaviour unchanged. */

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
  // Korean expiry-date heuristics — pull "YYYY-MM-DD", "YYYY.MM.DD",
  // "YYYY년 M월 D일", or labeled "유효기간 …".
  function extractExpiry(text) {
    if (!text) return null;
    const norm = text.replace(/\s+/g, " ").replace(/[ㆍ·]/g, ".");
    const candidates = [];
    const reAny = /(20\d{2})[.\-/년]\s?(\d{1,2})[.\-/월]\s?(\d{1,2})/g;
    let m;
    while ((m = reAny.exec(norm)) !== null) {
      const [_, y, mo, d] = m;
      const ymd = `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      candidates.push({ date: ymd, score: 0, src: m[0] });
    }
    for (const c of candidates) {
      const idx = norm.indexOf(c.src);
      const ctx = norm.slice(Math.max(0, idx - 14), idx).toLowerCase();
      if (/유효|만료|신고|expir|valid/.test(ctx)) c.score += 10;
      if (/발급|issue/.test(ctx)) c.score -= 4;
      // Prefer future dates over past
      if (new Date(c.date) > new Date()) c.score += 1;
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.date || null;
  }
  async function run(dataUrl, onProgress) {
    const T = await load();
    const { data } = await T.recognize(dataUrl, "kor+eng", {
      logger: m => onProgress?.(m)
    });
    return { text: data.text || "", expiry: extractExpiry(data.text) };
  }
  return { run, extractExpiry };
})();
export { OCR };
