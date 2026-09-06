/* clinic-admin — code masters (상병 마스터 / 행위·수가 마스터)
   A clinic may upload the real KOICD 상병마스터 and the 심평원 행위·수가 마스터
   (xlsx) so tabs 01/02/06/07 work against the real tables instead of the bundled
   발췌. Masters are PUBLIC reference tables (no personal data), so they live in a
   plain IndexedDB store. Separate DB from `attachments` (vibe-clinic-admin, v1) so
   the two never fight over schema versions. Sits at the files/ai-client layer of the
   import graph: dom → store → (masters) → tabs. Never imports shell.js. */
import { todayISO } from "./dom.js";
import { EventBus } from "./store.js";

const DB = "vibe-clinic-admin-masters";
const STORE = "masters";
const EV = "masters:changed";

// Header aliases per master kind. `required` fields must be mapped before save.
const FIELDS = {
  kcd: {
    label: "상병 마스터 (KOICD)",
    required: ["code", "name"],
    fields: {
      code:     { label: "상병기호",   aliases: ["상병기호", "상병코드", "코드", "kcd", "kcd코드", "질병코드", "code", "진단코드"] },
      name:     { label: "한글명",     aliases: ["한글명", "한글명칭", "상병명", "상병명(한글)", "질병명", "name", "명칭", "한글 명칭"] },
      name_en:  { label: "영문명",     aliases: ["영문명", "영문명칭", "english", "name_en", "영문 명칭"] },
      complete: { label: "완전코드구분", aliases: ["완전코드구분", "완전코드", "완전코드여부", "complete", "최하위코드"] }
    }
  },
  fee: {
    label: "행위·수가 마스터 (심평원)",
    required: ["code", "name"],
    fields: {
      code:     { label: "수가코드",   aliases: ["수가코드", "행위코드", "코드", "code", "청구코드", "edi코드", "edi 코드", "항목코드"] },
      name:     { label: "한글명",     aliases: ["한글명", "한글명칭", "행위명", "항목명", "명칭", "name", "수가명"] },
      price:    { label: "단가(금액)", aliases: ["단가", "금액", "수가", "가격", "price", "상대가치금액", "병원급 단가", "의원급 단가", "한방병원", "한의원"] },
      category: { label: "분류",       aliases: ["분류", "분류번호", "장", "대분류", "category", "산정명칭", "분류명"] },
      coverage: { label: "급여구분",   aliases: ["급여구분", "급여여부", "급여/비급여", "coverage", "보험구분", "급여"] },
      jabo:     { label: "자보구분",   aliases: ["자보구분", "자보", "자동차보험", "자보적용", "jabo", "자보여부"] },
      unit:     { label: "단위",       aliases: ["단위", "unit"] }
    }
  }
};

// ── IndexedDB ──
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    let r;
    try { r = indexedDB.open(DB, 1); } catch (e) { return rej(e); }
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idb(mode, fn) {
  const db = await open();
  const s = db.transaction(STORE, mode).objectStore(STORE);
  return new Promise((res, rej) => {
    const r = fn(s);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// ── In-memory cache (loaded once at boot, kept in sync on put/clear) ──
const cache = { kcd: null, fee: null };
let bundled = { kcd: null, jabo: null };
let loaded = null;

function init(DATA) {
  bundled = { kcd: DATA?.kcd || null, jabo: DATA?.jabo || null };
  if (!loaded) {
    loaded = Promise.all(["kcd", "fee"].map(k => idb("readonly", s => s.get(k)).then(rec => { cache[k] = rec || null; }).catch(() => { cache[k] = null; })))
      .then(() => { EventBus.emit(EV, { kind: "all" }); });
  }
  return loaded;
}
const ready = () => loaded || Promise.resolve();

// ── Header mapping ──
const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s_()\-·/]/g, "");
function suggestMapping(kind, headers) {
  const spec = FIELDS[kind];
  const out = {};
  const used = new Set();
  for (const [field, def] of Object.entries(spec.fields)) {
    const wanted = def.aliases.map(norm);
    // exact alias first, then "header contains alias"
    let hit = headers.find(h => !used.has(h) && wanted.includes(norm(h)));
    if (!hit) hit = headers.find(h => !used.has(h) && wanted.some(a => a.length >= 2 && norm(h).includes(a)));
    if (hit) { out[field] = hit; used.add(hit); }
  }
  return out;
}

// KOICD/EDI code normalisation: strip dots + spaces, upper-case. `M54.5` → `M545`.
const toEdi = (c) => String(c ?? "").toUpperCase().replace(/[.\s]/g, "");
// Display form: reinsert the dot after the 3rd character (KOICD notation). `M545` → `M54.5`.
const toDotted = (c) => { const e = toEdi(c); return e.length > 3 ? e.slice(0, 3) + "." + e.slice(3) : e; };

const truthy = (v) => /^(y|yes|1|true|o|급여|자보|예|해당)/i.test(String(v ?? "").trim());

// Turn raw sheet rows into the normalised master shape; drops rows without a code.
function normalizeRows(kind, rawRows, mapping) {
  const pick = (row, f) => mapping[f] ? row[mapping[f]] : undefined;
  const out = [];
  for (const row of rawRows) {
    const code = String(pick(row, "code") ?? "").trim();
    if (!code) continue;
    const name = String(pick(row, "name") ?? "").trim();
    if (kind === "kcd") {
      const edi = toEdi(code);
      if (!/^[A-Z]\d{2}[A-Z0-9]{0,4}$/.test(edi)) continue; // not a KCD code cell (title rows etc.)
      const comp = pick(row, "complete");
      out.push({
        code: toDotted(edi), edi, name,
        name_en: String(pick(row, "name_en") ?? "").trim(),
        complete: comp == null || comp === "" ? null : truthy(comp)
      });
    } else {
      const priceRaw = pick(row, "price");
      const price = priceRaw == null || priceRaw === "" ? null : Number(String(priceRaw).replace(/[^\d.]/g, ""));
      const cov = pick(row, "coverage");
      const jb = pick(row, "jabo");
      out.push({
        code, name,
        price: Number.isFinite(price) ? price : null,
        category: String(pick(row, "category") ?? "").trim(),
        unit: String(pick(row, "unit") ?? "").trim(),
        coverage: cov == null || cov === "" ? "" : /비급여/.test(String(cov)) ? "비급여" : /급여|y|1|true/i.test(String(cov)) ? "급여" : String(cov).trim(),
        jabo: jb == null || jb === "" ? null : truthy(jb)
      });
    }
  }
  return out;
}

async function put(kind, rows, meta = {}) {
  const rec = { id: kind, rows, count: rows.length, uploadedAt: todayISO(), fileName: meta.fileName || "", mapping: meta.mapping || {} };
  await idb("readwrite", s => s.put(rec));
  cache[kind] = rec;
  EventBus.emit(EV, { kind });
  return rec;
}
async function clear(kind) {
  await idb("readwrite", s => s.delete(kind));
  cache[kind] = null;
  EventBus.emit(EV, { kind });
}
const get = (kind) => cache[kind];
const onChange = (fn) => EventBus.on(EV, fn);

// ── Unified accessors — uploaded master if present, else the bundled 발췌/예시 ──
function kcd() {
  const m = cache.kcd;
  if (m) return { source: "master", rows: m.rows, count: m.count, date: m.uploadedAt, label: `마스터: 업로드본 (${m.count.toLocaleString("ko-KR")}행, ${m.uploadedAt})` };
  const rows = bundled.kcd?.codes || [];
  return { source: "bundled", rows, count: rows.length, date: bundled.kcd?.basis_date || "", label: `마스터: 데모 발췌본 ${rows.length}행` };
}
function fee() {
  const m = cache.fee;
  if (m) return { source: "master", rows: m.rows, count: m.count, date: m.uploadedAt, label: `마스터: 업로드본 (${m.count.toLocaleString("ko-KR")}행, ${m.uploadedAt})` };
  const rows = (bundled.jabo?.items || []).map(it => ({ ...it, coverage: "", jabo: true }));
  return { source: "bundled", rows, count: rows.length, date: bundled.jabo?.basis_date || "", label: `마스터: 데모 예시표 ${rows.length}행` };
}
// EDI-keyed lookup map for the current KCD source (rebuilt lazily per source change).
let kcdIdx = null, kcdIdxSrc = null;
function kcdIndex() {
  const cur = kcd();
  const key = cur.source + ":" + cur.count + ":" + cur.date;
  if (kcdIdx && kcdIdxSrc === key) return kcdIdx;
  kcdIdx = new Map();
  for (const r of cur.rows) kcdIdx.set(r.edi || toEdi(r.code), r);
  kcdIdxSrc = key;
  return kcdIdx;
}

// System-prompt context for the AI tab: the top-N master rows whose names share a
// token with the note. Only emitted when a real master is uploaded — otherwise the
// prompt's own "예시 목록" blocks stand.
function contextFor(note, n = 12) {
  const parts = [];
  const words = String(note || "").split(/[\s,.·;:/()\[\]]+/).map(w => w.trim()).filter(w => w.length >= 2);
  const score = (name) => words.reduce((s, w) => s + (name.includes(w) ? 1 : 0), 0);
  const top = (rows, fmt) => rows.map(r => [score(r.name || ""), r]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, r]) => fmt(r));
  if (cache.kcd) {
    const hits = top(cache.kcd.rows, r => `${r.code}(${r.name})`);
    parts.push(`<master_kcd source="업로드 상병마스터 ${cache.kcd.uploadedAt}" rows="${cache.kcd.count}">\n${hits.length ? hits.join(" · ") : "(메모와 겹치는 상병명 없음 — 마스터 미수록 코드는 추천하지 말 것)"}\n</master_kcd>`);
  }
  if (cache.fee) {
    const hits = top(cache.fee.rows, r => `${r.code}(${r.name}${r.coverage ? "," + r.coverage : ""})`);
    parts.push(`<master_fee source="업로드 행위·수가 마스터 ${cache.fee.uploadedAt}" rows="${cache.fee.count}">\n${hits.length ? hits.join(" · ") : "(메모와 겹치는 행위명 없음)"}\n</master_fee>`);
  }
  if (!parts.length) return "";
  return `\n\n<master_context>\n업로드된 실제 마스터가 있습니다. 아래 행에 있는 코드만 추천하고, 위 예시 목록의 코드는 마스터에 없으면 사용하지 마십시오.\n${parts.join("\n")}\n</master_context>`;
}

const Masters = { FIELDS, init, ready, get, put, clear, onChange, suggestMapping, normalizeRows, kcd, fee, kcdIndex, contextFor, toEdi, toDotted };
export { Masters, toEdi, toDotted };
