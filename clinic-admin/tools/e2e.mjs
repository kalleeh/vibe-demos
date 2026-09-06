#!/usr/bin/env node
/* clinic-admin — integrated end-to-end run (headless Chrome via Playwright).
   Serves the repo root on :8501, starts a FRESH local PocketBase 0.40.2 (tools/pb-local.mjs: this demo's migrations +
   hooks on 127.0.0.1:8095, wiped on every start) and points every browser context at it via
   localStorage["vibe.clinic-admin.pbUrl"]; still blocks the production hosts (*.pb.gurum.se, jsdelivr, Google Fonts),
   mocks the Claude proxy with a forced tool_use answer, then drives the whole app once:
   SHARED IDENTITY (step A): fresh instance → bootstrap (clinic name · first 원장 · 6-digit PIN) → seed creates the 3 sample
   logins ON THE SERVER (PIN 000000) → a second browser context ("phone", fresh profile) sees the same user dropdown, logs in as
   한지우, sees the board card in realtime and adds one the first context receives; non-owner hook calls 403; unauthenticated
   intake_card list is empty while the workspace row is public; temp-PIN login → forced new PIN; owner create/reset/delete
   through the hook; own PIN change re-authenticates; wrong PIN → local backoff + server 400; legacy device workspace →
   bootstrap-from-legacy on a reset server (same master key, local data still decrypts); storage scan: no raw key, no PIN,
   server token only sealed inside the IndexedDB session record. Then the pre-existing story:
   bootstrap → 기관 정보 step → welcome deck (five areas + two utilities) → sample seed (shared entities + every
   tool; lands on 홈 with the todo list populated) → the CONNECTED STORY across the one fictional clinic (심사결과 대조 cuts
   on ****0142 → 상병 정비 focused on a 명세서 → AI DRAWER prefilled from a 상병 row / a 대조 row → drawer fills a 자보 case →
   SEARCH OVERLAY checks a code, shows 우리 단가, inserts an item → 청구 배치 landing: batch card + 3 steps → 연말정산
   cross-check → 비급여 org read-only + cadence + 고지문 → 보존 aliases → 인증 derived badges → 홈 todo/KPIs/deadline ctx/
   accred deep link) → IA chrome: area switching + breadcrumb, `[` `]` + digit keys, bottom bar / sub-nav on the phone,
   tab-search {query} / {section:"masters"} routing → 2nd user → master upload (조직 › 마스터) → AI canned + live
   (consent → redaction preview → mocked tool_use) → roster add/OCR/.ics → accred toggle → 환자 › 접수 보드 pid picker →
   PHASE 3 (one connected block, same clinic): 홈 todo carries the overdue 이의신청 + the expiring / expired 지불보증 with ctx →
   환자: board card ⋯ hand-offs → 자보 지불보증 (연장 요청 · create · strip · export · { guaranteeId } ctx) → 서류 발급 대장
   (issuer validation · 대리인 guard · monthly print) → 비급여 설명·동의 (tariff-priced items · print · 자보 hand-off adds a
   비급여 line from the Tariff code space) → 청구: landing with two payer cards → 건보 심사결과 대조 → 이의신청 준비 → status
   transitions → overdue badge · filters · export · draft → hand-offs → 홈 KPIs by payer + 원장 보고용 요약 → 보고·기록: 파기
   대장 · tariff history + website CSV · yearend pid lookup → docs hand-off → 조직: accred mr3 turns ✓ from the ledger →
   조직 › 데이터 처리 현황 panel (zero 미등록, every Phase-3 key registered + encrypted) → no plaintext names in
   localStorage/IndexedDB → lock/unlock as a SEEDED login (정수아 · PIN 0000; trackers read empty while locked) → audit log
   shape → encrypted backup v2 (Phase-3 envelopes included) → 전체 파기 (session DB gone too) → restore (tracker counts back,
   no session record) → reload asks the PIN → SESSION PERSISTENCE (non-extractable CryptoKey in IndexedDB: record shape + no
   raw key bytes anywhere · reload resumes without a PIN, one resume audit entry · login issue after a resume → PIN 재확인
   with backoff · PIN change/reset drop the record · explicit lock → PIN pane · second tab resumes / locks together /
   탭을 닫으면 잠금 nonce · fake-clock idle lock + 8 h absolute expiry · stale record not resumed) →
   legacy-key migration + activateTab ctx + Batches cap + v1 backup restore.
   Then an ENGLISH pass on a fresh profile: i18n coverage gate (tools/i18n-extract.mjs → 0 missing keys), toggle EN on
   the lock screen before setup, all 18 panels + the overlay + the drawer free of Hangul in headings/buttons/table headers/
   labels/pills/caveats (glosses in parentheses and sample values excepted), KO round-trip keeps the result tables, EN
   export headers + watermark, reload persists EN, `?lang=en` boots a fresh profile in English.
   ENTITY SYNC (step B, 3.1.0-poc): the phone (fresh profile) receives the WHOLE clinic on login — a sha256 digest of every
   syncable Store key (registry minus LOCAL_ONLY, minus the union-merged activity log) is identical on both devices within
   5 s, roster / picker / KPI tiles match; B edits a tracker row + adds an appeal → A sees them live; the activity log is
   unioned by id; A goes OFFLINE (context.setOffline) → edits wait in the encrypted __outbox, chip "오프라인 · N건 대기" →
   back online → flushed, B receives; the same key edited on both sides while A was offline → last write (server time)
   wins, A's losing value lands in __conflicts + an audit entry, "충돌 1" chip, 되살리기 from the register; a licence photo
   added on A opens on B (sync_file), its removal propagates; the server DB (read as the throw-away superuser) holds
   envelopes only — no names / pids / PINs / tokens, no ui.* / __* keys; 원장 전체 파기 with "서버 데이터도 파기" tombstones
   every row and empties a still-logged-in device; a restore wins over the tombstones and re-pushes; the legacy device
   (data + empty server) pushes everything on its first sync.
   Zero page errors + zero console errors (blocked-host resource failures excepted) is asserted.

   Run:  node clinic-admin/tools/e2e.mjs            (desktop 1280×900)
         node clinic-admin/tools/e2e.mjs --mobile   (390×844 smoke: same flow via bottom bar / sub-nav / ⋯ sheet + no horizontal overflow)
   Needs a Playwright install: set PLAYWRIGHT_DIR, or it looks for one under ~/.npm/_npx. Downloads PocketBase once into
   /tmp/pb-clinic-test/ (curl + unzip). */
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { startLocalPB } from "./pb-local.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const MOBILE = process.argv.includes("--mobile");
const PORT = 8501;
const BASE = `http://localhost:${PORT}/clinic-admin/`;
const pbLocal = await startLocalPB();
const PB_LOCAL = pbLocal.url;

/* ── locate playwright ─────────────────────────────────────────────── */
function findPlaywright() {
  if (process.env.PLAYWRIGHT_DIR) return process.env.PLAYWRIGHT_DIR;
  const npx = join(homedir(), ".npm", "_npx");
  let best = null;
  for (const d of existsSync(npx) ? readdirSync(npx) : []) {
    const p = join(npx, d, "node_modules", "playwright");
    if (!existsSync(join(p, "index.mjs"))) continue;
    const v = JSON.parse(readFileSync(join(p, "package.json"), "utf8")).version;
    if (/alpha|beta/.test(v)) continue;
    if (!best || v.localeCompare(best.v, undefined, { numeric: true }) > 0) best = { p, v };
  }
  if (!best) throw new Error("playwright not found — set PLAYWRIGHT_DIR");
  return best.p;
}
const { chromium } = await import(pathToFileURL(join(findPlaywright(), "index.mjs")).href);

/* ── static server ─────────────────────────────────────────────────── */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = join(repoRoot, p);
  if (!file.startsWith(repoRoot) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));

/* ── tiny assertion kit ────────────────────────────────────────────── */
let step = "boot";
const checks = [];
const ok = (cond, msg) => { checks.push({ ok: !!cond, msg: `[${step}] ${msg}` }); if (!cond) throw new Error(`ASSERT [${step}] ${msg}`); };
const at = (s) => { step = s; console.log("  ·", s); };

/* ── fixtures — ONE fictional clinic, shared by every seed ─────────── */
const PATIENTS = ["김민지", "박지훈", "이서윤", "최다은", "정하늘"];                          // tab3 sample (names live only in that file)
const PIDS = ["P-2026-0142", "P-2026-0233", "P-2026-0301", "P-2026-0418", "P-2026-0509"];   // the shared pseudonymous register
const STAFF = ["윤지훈", "박서연", "김도현", "이하은", "최민준", "정수아", "한지우", "오하늬"]; // shared clinic roster (shell SEED) + the one we add
const LEGACY_STAFF = ["정민재", "송하린"];                                                    // pre-entities license.list rows (migration test)
const BOARD = ["김민서", "이준호", "정우진"];                                                 // the OLD board seed names — must never reappear
const ALL_NAMES = [...PATIENTS, ...STAFF, ...LEGACY_STAFF, ...BOARD];
const RRN = "880314-2123458", PHONE = "010-1234-5678", PNAME = "김민지";
const ORG = { name: "한솔한방병원", ykiho: "11000123", biz: "123-45-67890", rep: "윤지훈" };
const SEED_PIN = "000000"; // every seeded login (윤지훈 · 정수아 · 한지우) — 6-digit policy since the shared-identity pass
const OWNER_PIN = "123456", OWNER_PIN2 = "654321"; // the bootstrapping 원장 (홍 원장) and the PIN it changes to later
const TEMP_PIN = "567890", KIM_PIN = "778899";      // 행정 김's temp PIN (issued by the owner) and the PIN she sets herself
// Plaintext-by-design keys excluded from the "no names" scans: only the institution profile (org.profile — the 대표자 is
// public 사업자등록 data, plain tier per the entities contract). The pre-cloud keyring (__ws) is gone: users live on the server.
const PLAIN_OK = new Set(["vibe.clinic-admin.org.profile"]);
const PB_URL_KEY = "vibe.clinic-admin.pbUrl";
// A PocketBase auth token is a JWT: three dotted base64url segments starting with the {"alg"…} header. (A bare "eyJ" would
// also match random base64 ciphertext.)
const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/;
// EN pass: anything Korean left in a heading/button/header/label/pill/caveat must be a parenthesised gloss or one of
// these sample values (fictional names, sample codes, the demo search terms, the typed 파기 confirmation word).
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const SAMPLE_TOKENS = [...ALL_NAMES, ORG.name, "예시-NN", "요통", "추나", "ㅇㅈㅍ", "ㅇㅈ", "ㅇㅌ", "파기"];
const stripParens = (s) => { let prev; do { prev = s; s = s.replace(/\([^()]*\)/g, ""); } while (s !== prev); return s; };
const leftoverHangul = (texts) => texts.map(x => { let s = stripParens(String(x || "")); for (const tok of SAMPLE_TOKENS) s = s.split(tok).join(""); s = s.replace(/예시-\d+/g, ""); return s.replace(/\s+/g, " ").trim(); }).filter(s => HANGUL.test(s));
const EN_SELECTOR = (panel) => ["h1", "h2", "h3", "button", "th", "label", ".pill", ".caveat"].map(s => `#${panel} ${s}`).join(", ");
const LIVE_NOTE = `환자명: ${PNAME} (${RRN}, ${PHONE}) 3주 전 추돌사고 후 경부·요부 통증. 침·부항·추나 예정.`;
const TOOL_ANSWER = {
  id: "msg_mock", type: "message", role: "assistant", model: "mock", stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "tu_1", name: "recommend_codes", input: {
    kcd: [{ code: "S13.4", name: "경추의 염좌 및 긴장", conf: 0.94, ref: "KCD / 손상편" }, { code: "S33.5", name: "요추의 염좌 및 긴장", conf: 0.88, ref: "KCD / 손상편" }],
    uCode: { code: "U6x.x", name: "어혈(瘀血) 계열 병증 — 예시", conf: 0.6, ref: "예시 · 마스터에서 확정" },
    jabo: [{ code: "예시-01", name: "한방 초진 진찰료", conf: 0.92, ref: "행위 급여목록(예시) · 초진" }, { code: "예시-03", name: "경혈침술", conf: 0.95, ref: "행위 급여목록(예시)" }],
    bigeup: []
  } }]
};

/* ── browser ───────────────────────────────────────────────────────── */
const browser = await chromium.launch({ channel: "chrome", headless: true });
const VIEW = { viewport: MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: MOBILE, hasTouch: MOBILE, acceptDownloads: true };
// Every context talks to the local PocketBase (the app reads the dev override before its first server call).
const newCtx = async (opts) => { const c = await browser.newContext(opts); await c.addInitScript(([k, u]) => { try { localStorage.setItem(k, u); } catch {} }, [PB_URL_KEY, PB_LOCAL]); return c; };
const context = await newCtx({ ...VIEW, locale: "ko-KR" });
const page = await context.newPage();
let shotPage = page; // the page the failure screenshot is taken from (switches to the later contexts)

const BLOCKED = /(^|\.)pb\.gurum\.se$|cdn\.jsdelivr\.net$|fonts\.g(oogleapis|static)\.com$/;
const pageErrors = [], consoleErrors = [];
function safeHost(u) { try { return new URL(u).hostname; } catch { return ""; } }
function watch(p, tag) {
  p.on("pageerror", e => pageErrors.push(`${tag}${String(e && e.stack || e)}`));
  p.on("console", m => {
    if (m.type() !== "error") return;
    const loc = m.location()?.url || "";
    if (BLOCKED.test(safeHost(loc))) return; // intentional: blocked CDN / PocketBase hosts
    // Chrome logs every non-2xx fetch as a console error. Expected API answers from the local PocketBase (wrong PIN → 400,
    // no workspace yet → 404, non-owner hook call → 403, revoked token → 401) are part of the flows under test.
    if (loc.startsWith(PB_LOCAL) && /Failed to load resource: .* (400|401|403|404)|net::ERR_FAILED|net::ERR_INTERNET_DISCONNECTED/.test(m.text())) return; // ERR_FAILED / DISCONNECTED: the offline tests abort requests on purpose
    consoleErrors.push(`${tag}${m.text()} @ ${loc}`);
  });
}
watch(page, "");

let liveRequest = null;
await page.route(/.*/, (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === "ai.pb.gurum.se") {
    if (url.pathname === "/api/claude-challenge") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ nonce: "n0", exp: Date.now() + 120000, sig: "sig", difficulty: 1 }) });
    if (url.pathname === "/api/claude") { liveRequest = { headers: route.request().headers(), body: JSON.parse(route.request().postData() || "{}") }; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TOOL_ANSWER) }); }
  }
  if (BLOCKED.test(url.hostname)) return route.abort("failed");
  return route.continue();
});
const blockAll = (p) => p.route(/.*/, (route) => { const url = new URL(route.request().url()); if (url.hostname === "ai.pb.gurum.se" || BLOCKED.test(url.hostname)) return route.abort("failed"); return route.continue(); });

/* ── helpers ───────────────────────────────────────────────────────── */
const $ = (sel) => page.locator(sel);
const wait = (ms) => page.waitForTimeout(ms);
const closed = (sel) => page.waitForFunction((s) => !document.querySelector(s)?.classList.contains("open"), sel);
// The demo CTAs are what seedAll() drives; click them programmatically like it does.
const runDemo = (action) => page.evaluate((a) => { const b = document.querySelector(`[data-action="${a}"]`); if (!b) throw new Error("no demo CTA " + a); b.click(); }, action);
// Click a row-level button inside a (possibly horizontally scrolling) result table by matching its <tr>'s first cell.
const clickRowBtn = (table, firstCell, btnSel) => page.evaluate(([table, firstCell, btnSel]) => {
  const tr = Array.from(document.querySelectorAll(`${table} tbody tr`)).find(tr => tr.children[0]?.textContent.trim() === firstCell && tr.querySelector(btnSel));
  if (!tr) throw new Error(`no row ${firstCell} with ${btnSel} in ${table}`);
  tr.querySelector(btnSel).click();
}, [table, firstCell, btnSel]);
const ent = (p, fn) => p.evaluate(async (src) => {
  const E = await import("./js/core/entities.js"); const { Session } = await import("./js/security/session.js"); const { Store, EventBus, ActivityLog } = await import("./js/core/store.js");
  const { activateTab } = await import("./js/core/nav.js"); const C = await import("./js/security/crypto.js"); const cal = await import("./js/core/calendar.js");
  return (new Function("E", "Session", "Store", "EventBus", "activateTab", "C", "cal", "ActivityLog", `return (${src})(E, Session, Store, EventBus, activateTab, C, cal, ActivityLog)`))(E, Session, Store, EventBus, activateTab, C, cal, ActivityLog);
}, fn.toString());
// Every app module a step may need, imported once inside the page: M(({ CS, P, Store, … }) => …).
const mods = (p, fn) => p.evaluate(async (src) => {
  const E = await import("./js/core/entities.js"); const { Session } = await import("./js/security/session.js"); const { Store, EventBus, ActivityLog } = await import("./js/core/store.js");
  const { activateTab } = await import("./js/core/nav.js"); const C = await import("./js/security/crypto.js"); const cal = await import("./js/core/calendar.js"); const life = await import("./js/security/lifecycle.js");
  const CS = await import("./js/tabs/claims-shared.js"); const CL = await import("./js/tabs/claims-landing.js"); const AP = await import("./js/tabs/tab-appeal.js");
  const P = await import("./js/tabs/patients-shared.js"); const G = await import("./js/tabs/tab-guarantee.js"); const D = await import("./js/tabs/tab-docs.js"); const CT = await import("./js/tabs/tab-consent.js"); const ret = await import("./js/tabs/tab5-retention.js");
  return (new Function("M", `return (${src})(M)`))({ E, Session, Store, EventBus, ActivityLog, activateTab, C, cal, life, CS, CL, AP, P, G, D, CT, ret });
}, fn.toString());
const M = (fn) => mods(page, fn);
// Area of every panel — mirrors js/core/nav.js TABS (the chrome the user actually clicks: area → panel).
const AREA_OF = { "tab-today": "home", "tab-board": "patients", "tab-guarantee": "patients", "tab-docs": "patients", "tab-consent": "patients",
  "tab-claims": "claims", "tab-kcd": "claims", "tab-jabo": "claims", "tab-nhis": "claims", "tab-appeal": "claims",
  "tab-yearend": "records", "tab-bigeup": "records", "tab-retention": "records", "tab-org": "org", "tab-license": "org", "tab-accred": "org", "tab-privacy": "org", "tab-masters": "org" };
const PANELS = Object.keys(AREA_OF); // all 18
/* Rail-foot buttons (lock · users · privacy · info · wipe · language). Phone: they live in the ⋯ sheet opened from the bottom bar. */
async function railClick(id, p = page) {
  if (MOBILE) { await p.locator("#bottombar-more").click(); await p.waitForTimeout(350); } // sheet slides up over .25s
  await p.locator(id).click();
  if (MOBILE) await p.evaluate(() => document.body.classList.remove("more-open"));
}
/* Panel navigation through the real chrome: desktop = rail area button → panel button inside the expanded area;
   phone = bottom-bar area → sub-nav segment. Any open utility (drawer / overlay) is closed first, as a user would. */
async function goTab(panel, p = page) {
  if (await p.locator("#search-scrim.open").count()) { await p.keyboard.press("Escape"); await p.waitForFunction(() => !document.querySelector("#search-scrim")?.classList.contains("open")); }
  if (await p.locator("#ai-drawer.open").count()) { await p.locator("#ai-drawer-close").click(); await p.waitForFunction(() => !document.querySelector("#ai-drawer")?.classList.contains("open")); }
  const area = AREA_OF[panel];
  if (MOBILE) {
    await p.locator(`#bottombar .area-btn[data-area="${area}"]`).click();
    const seg = p.locator(`#subnav [data-panel="${panel}"]`);
    if (await seg.count()) await seg.click();
  } else {
    await p.locator(`#rail-areas .area-btn[data-area="${area}"]`).click();
    const btn = p.locator(`#rail-areas .area-panels[data-area="${area}"] [data-panel="${panel}"]`);
    if (await btn.count()) await btn.click();
  }
  await p.waitForSelector(`#${panel}.active`);
}
/* The two utilities. */
async function openAi(p = page) {
  if (!(await p.locator("#ai-drawer.open").count())) await p.locator("#topbar-ai").click();
  await p.waitForSelector("#ai-drawer.open");
}
async function openSearch(query, p = page) {
  if (!(await p.locator("#search-scrim.open").count())) await p.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await p.waitForSelector("#search-scrim.open");
  if (query != null) { await p.locator("#search-input").fill(query); await p.waitForTimeout(200); }
}
async function download(action) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), action()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), text: path ? readFileSync(path, "utf8") : "", buf: path ? readFileSync(path) : null };
}
async function noOverflow(label, p = page) {
  const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    shell: (() => { const s = document.querySelector(".frame.shell"); return s ? s.scrollWidth : 0; })(),
    work: (() => { const w = document.querySelector("#work-scroll"); return w ? w.scrollWidth : 0; })(),
    lock: (() => { const l = document.querySelector("#lock-scrim"); return l ? l.scrollWidth : 0; })(),
    sheet: (() => { const g = document.querySelector("#search-scrim.open .gsearch, #ai-drawer.open"); return g ? g.scrollWidth : 0; })() }));
  ok(r.sw <= r.iw + 1 && r.shell <= r.iw + 1 && r.work <= r.iw + 1 && r.lock <= r.iw + 1 && r.sheet <= r.iw + 1, `${label}: no horizontal overflow (doc ${r.sw} / shell ${r.shell} / work ${r.work} / lock ${r.lock} / sheet ${r.sheet} ≤ ${r.iw})`);
}
/* i18n leak guard — no visible text node may be a bare dictionary key (`nav.today`, `claims.p3.stepsH`). Storage keys in the
   processing register sit in <code>, URLs in <a>; hostnames (ai.pb.gurum.se) are excluded by TLD. */
const KEY_RE = /^[a-z]+(\.[a-zA-Z0-9_]+){1,4}$/;
const leakedKeys = (p, scope) => p.evaluate(([sel, re]) => {
  const rx = new RegExp(re), out = [];
  for (const root of document.querySelectorAll(sel)) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const s = n.textContent.trim(); if (!s || !rx.test(s) || /\.(kr|se|com|org|net|io)$/.test(s) || n.parentElement.closest("code, .code, a, kbd, script, style")) continue; out.push(s); }
  }
  return out;
}, [scope, KEY_RE.source]);
const CHROME_SCOPE = "#topbar, #rail, #subnav, #bottombar, #toast-tray";
async function noKeys(label, scope, p = page) { const l = await leakedKeys(p, scope); ok(l.length === 0, `${label}: no raw i18n keys in the visible text (${l.slice(0, 4).join(", ") || "none"})`); }
/* Rail foot / ⋯ sheet contract: exactly install · lock · users · info · demo (+ the KO|EN toggle), no duplicates of the topbar utilities. */
const RAIL_FOOT = ["rail-install", "rail-lock", "rail-users", "rail-info", "rail-demo"];
const expandLater = async () => { await page.evaluate(() => { const d = document.querySelector("#home-deadlines"); if (d) d.open = true; }); const m = $("#dday-more"); if (await m.count() && (await m.getAttribute("aria-expanded")) === "false") { await m.click(); await wait(100); } };
/* Session record in IndexedDB (vibe-clinic-admin-session / session / "current") WITHOUT trusting the app's own accessor:
   raw IDB read, CryptoKey shape, and a real exportKey() attempt (must throw InvalidAccessError). Waits a beat first — the
   app deletes the record from a non-awaited lock path. */
const sessionRec = async (p = page) => { await p.waitForTimeout(250); return p.evaluate(async () => {
  const dbs = (await indexedDB.databases()).map(d => d.name);
  if (!dbs.includes("vibe-clinic-admin-session")) return { db: false, rec: null };
  const db = await new Promise((res, rej) => { const r = indexedDB.open("vibe-clinic-admin-session"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  if (!db.objectStoreNames.contains("session")) { db.close(); return { db: true, rec: null }; }
  const rec = await new Promise((res, rej) => { const r = db.transaction("session").objectStore("session").get("current"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  db.close();
  if (!rec) return { db: true, rec: null };
  let exportErr = null;
  if (rec.key) { try { await crypto.subtle.exportKey("raw", rec.key); exportErr = "EXPORTED"; } catch (e) { exportErr = e.name; } }
  return { db: true, rec: { userId: rec.userId, mode: rec.mode, unlockedAt: rec.unlockedAt, expiresAt: rec.expiresAt, lastActiveAt: rec.lastActiveAt, nonce: rec.nonce ?? null,
    keyType: rec.key instanceof CryptoKey ? "CryptoKey" : typeof rec.key, extractable: rec.key?.extractable, alg: rec.key?.algorithm?.name, usages: rec.key?.usages, exportErr } };
}); };
// Key management may ask for the PIN again (raw-key grant lapsed) — answer it when the dialog is up.
const answerReauth = async (pin, p = page) => { await p.waitForTimeout(300); if (await p.locator("#reauth-scrim.open").count()) { await p.locator("#reauth-pin").fill(pin); await p.locator("#reauth-submit").click(); await p.waitForFunction(() => !document.querySelector("#reauth-scrim")?.classList.contains("open")); } };
// Lock screen: the server directory is a <select> (name · role) — pick by name, then type the PIN.
const pickUser = async (name, p = page) => {
  await p.waitForSelector("#lock-unlock:not([hidden])", { timeout: 20000 });
  try { await p.waitForFunction((n) => Array.from(document.querySelectorAll("#lock-user option")).some(o => o.textContent.startsWith(n)), name, { timeout: 20000 }); }
  catch { throw new Error(`pickUser: no option for ${name} (have: ${(await p.evaluate(() => Array.from(document.querySelectorAll("#lock-user option")).map(o => o.textContent))).join(" | ")})`); }
  const v = await p.evaluate((n) => Array.from(document.querySelectorAll("#lock-user option")).find(o => o.textContent.startsWith(n)).value, name);
  await p.locator("#lock-user").selectOption(v);
};
const unlockAs = async (name, pin, p = page) => { await pickUser(name, p); await p.locator("#lock-pin").fill(pin); await p.locator("#lock-submit").click(); };
// A fresh profile opens the welcome deck ~350 ms after app:ready — close it before clicking the chrome.
const dismissWelcome = async (p) => { try { await p.waitForSelector("#welcome-scrim.open", { timeout: 3000 }); } catch { return; } await p.locator("#welcome-blank").click(); await p.waitForFunction(() => !document.querySelector("#welcome-scrim")?.classList.contains("open")); };
// Server directory size as the app sees it (Session.users()).
// NOTE: page.waitForFunction does NOT await an async predicate (a returned Promise is truthy → it resolves at once — verified
// with Playwright 1.61). Predicates that need `await import(...)` therefore poll through page.evaluate instead.
const waitFor = async (p, fn, arg, timeout = 10000) => { const t0 = Date.now(); for (;;) { if (await p.evaluate(fn, arg)) return true; if (Date.now() - t0 > timeout) return false; await p.waitForTimeout(150); } };
const waitUsers = async (n, p = page, timeout = 30000) => { if (!(await waitFor(p, async (n) => (await import("./js/security/session.js")).Session.users().length === n, n, timeout))) throw new Error(`waitUsers: directory did not reach ${n}`); };
/* ── entity sync helpers ── */
const syncState = (p) => p.evaluate(async () => (await import("./js/core/sync.js")).Sync.state());
// Nothing pending, nothing in flight, server reachable (throws on timeout like a waitForFunction would).
const settled = async (p, timeout = 10000) => { if (!(await waitFor(p, async () => { const { Sync } = await import("./js/core/sync.js"); const s = Sync.state(); return s.online && !s.syncing && s.pending === 0; }, null, timeout))) throw new Error(`settled: ${JSON.stringify(await syncState(p))}`); };
// sha256 over every syncable key (the registry-listed data minus LOCAL_ONLY; `activity` is unioned, not identical, so it is left out).
const digest = (p) => p.evaluate(async () => {
  const { Store } = await import("./js/core/store.js"); const { Sync } = await import("./js/core/sync.js"); const C = await import("./js/security/crypto.js");
  const keys = Store.keys().filter(k => Sync.isSyncable(k) && k !== "activity").sort();
  const obj = {}; for (const k of keys) obj[k] = Store.get(k);
  return { keys, hash: await C.sha256hex(JSON.stringify(obj)) };
});
// The server side as the e2e superuser (pb-local hands the throw-away credentials back; never printed).
let suTok = null;
const superToken = async () => {
  if (suTok) return suTok;
  const r = await (await fetch(PB_LOCAL + "/api/collections/_superusers/auth-with-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identity: pbLocal.superuser.email, password: pbLocal.superuser.password }) })).json();
  if (!r.token) throw new Error("superuser auth failed: " + JSON.stringify(r).slice(0, 120));
  suTok = r.token; return suTok;
};
const serverRows = async (col) => { const r = await (await fetch(`${PB_LOCAL}/api/collections/${col}/records?perPage=500&sort=key`, { headers: { Authorization: await superToken() } })).json(); if (!Array.isArray(r.items)) throw new Error(`${col} list failed: ${JSON.stringify(r).slice(0, 120)}`); return r.items; };
const resetPB = async () => { await pbLocal.reset(); suTok = null; };
const isEnv = (x) => !!x && x.v === 1 && typeof x.iv === "string" && typeof x.ct === "string";
const NO_SYNC_RE = /^ui\.|^__|^pbUrl$|^player-id$|^ai\.draft$/;
const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const storeSnapshot = () => page.evaluate(async () => {
  const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  const idb = {};
  for (const { name } of await indexedDB.databases()) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    idb[name] = {};
    for (const s of db.objectStoreNames) idb[name][s] = await new Promise((res, rej) => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
  }
  return { ls, idb };
});

try {
  console.log(`clinic-admin e2e — ${MOBILE ? "mobile 390×844" : "desktop 1280×900"}`);
  /* 0 · i18n coverage gate */
  at("i18n: every referenced key exists in ko.* and en.* (no duplicate keys across files)");
  const cov = spawnSync(process.execPath, [join(here, "i18n-extract.mjs"), "--json"], { encoding: "utf8" });
  const covJ = (() => { try { return JSON.parse(cov.stdout.trim().split("\n").pop()); } catch { return null; } })();
  ok(covJ && covJ.missingKo.length === 0 && covJ.missingEn.length === 0 && covJ.dupes.length === 0, `0 missing keys, 0 dupes (referenced ${covJ?.total}, ko ${covJ?.koEntries}, en ${covJ?.enEntries}; missing ko: ${covJ?.missingKo.join(",") || "none"} · en: ${covJ?.missingEn.join(",") || "none"} · dupes: ${covJ?.dupes.join(",") || "none"})`);

  /* 1 · first run → bootstrap the instance on the (fresh) server */
  at("first run: fresh server → lock screen shows the bootstrap pane, create the clinic + first 원장 (6-digit PIN)");
  const wsBefore = await (await fetch(PB_LOCAL + "/api/collections/workspace/records")).json();
  ok(wsBefore.totalItems === 0, "local PocketBase is fresh: no workspace row yet");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open");
  await page.waitForSelector("#lock-setup:not([hidden])", { timeout: 20000 });
  ok(await $("#lock-setup").isVisible() && (await $("#setup-legacy").isHidden()), "bootstrap pane visible on a fresh instance (no legacy offer on a fresh profile)");
  ok(await page.evaluate(() => document.querySelector("#lock-busy").hidden && document.querySelector("#lock-unlock").hidden && document.querySelector("#lock-offline").hidden), "probe finished: busy line gone, unlock/offline panes hidden");
  await noKeys("lock screen (bootstrap)", "#lock-scrim");
  if (MOBILE) await noOverflow("lock screen (setup)");
  await $("#setup-name").fill("홍 원장");
  await $("#setup-pin").fill("1234"); await $("#setup-pin2").fill("1234");
  ok(!(await page.evaluate(() => document.querySelector("#lock-setup").checkValidity())) && (await page.evaluate(() => document.querySelector("#setup-pin").validity.tooShort || document.querySelector("#setup-pin").validity.patternMismatch)), "4-digit PIN refused by the form (policy is 6–8 digits: minlength + pattern)");
  const pinPolicy = await ent(page, (E, S) => { try { S.PIN_RE.test("1234"); return { re: S.PIN_RE.source, four: S.PIN_RE.test("1234"), six: S.PIN_RE.test("123456"), nine: S.PIN_RE.test("123456789") }; } catch (e) { return { err: String(e) }; } });
  ok(pinPolicy.four === false && pinPolicy.six === true && pinPolicy.nine === false, `Session.PIN_RE = /${pinPolicy.re}/ (6–8 digits)`);
  await $("#setup-clinic").fill(ORG.name);
  await $("#setup-pin").fill(OWNER_PIN); await $("#setup-pin2").fill(OWNER_PIN);
  await $("#setup-submit").click();
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });
  const wsAfter = await (await fetch(PB_LOCAL + "/api/collections/workspace/records")).json();
  ok(wsAfter.totalItems === 1 && wsAfter.items[0].bootstrapped === true && wsAfter.items[0].name === ORG.name && wsAfter.items[0].directory.length === 1 && wsAfter.items[0].directory[0].name === "홍 원장" && wsAfter.items[0].directory[0].role === "원장" && !("wrapped" in wsAfter.items[0].directory[0]), `server: workspace bootstrapped (${wsAfter.items[0].name}), directory = [홍 원장 · 원장], public read, no key material`);
  const cloud0 = await ent(page, (E, S) => ({ authed: S.isAuthed(), ws: S.workspace(), me: S.user(), users: S.users().map(u => u.name) }));
  ok(cloud0.authed && cloud0.ws?.bootstrapped && cloud0.ws.name === ORG.name && cloud0.me.role === "원장" && cloud0.users.join() === "홍 원장", `app: authenticated as 홍 원장 · 원장, workspace ${cloud0.ws?.name}`);
  ok(await page.evaluate((re) => Object.keys(localStorage).every(k => !/pb_auth|pocketbase/i.test(k)) && !Object.values(localStorage).some(v => new RegExp(re).test(v) || /"token"/.test(v)), JWT_RE.source), "no PocketBase token in localStorage (the auth store is memory + the sealed session record)");

  /* 1b · first-run 기관 정보 step (before the welcome tour) */
  at("first run: 기관 정보 step → fill → welcome");
  await page.waitForSelector("#org-scrim.open", { timeout: 15000 });
  ok(!(await $("#welcome-scrim").evaluate(el => el.classList.contains("open"))), "org step opens BEFORE the welcome tour");
  if (MOBILE) await noOverflow("org step");
  const creator = await ent(page, (E, Session) => { const u = Session.user(); return { staffId: u.staffId, row: E.Staff.byUser(u.id) }; });
  ok(creator.staffId && creator.row && creator.row.name === "홍 원장" && creator.row.job === "한의사", `workspace creator got a roster row (${creator.row?.job} ${creator.row?.name}) linked via staffId`);
  await $("#orgstep-name").fill(ORG.name); await $("#orgstep-ykiho").fill(ORG.ykiho); await $("#orgstep-biz").fill("1234567890"); await $("#orgstep-rep").fill(ORG.rep);
  await $("#orgstep-save").click();
  await closed("#org-scrim");
  await page.waitForSelector("#welcome-scrim.open", { timeout: 15000 });
  ok(true, "org saved → welcome overlay on first run");
  const orgNow = await ent(page, (E) => E.Org.get());
  ok(orgNow.name === ORG.name && orgNow.ykiho === ORG.ykiho && orgNow.biz === ORG.biz && orgNow.rep === ORG.rep && orgNow.kind === "병원", `Org.get() = ${JSON.stringify(orgNow)} (biz auto-hyphenated)`);
  ok((await $("#topbar-org-text").innerText()) === ORG.name, "topbar org chip shows the institution name");
  const welcomeKo = await $("#welcome-scrim").innerText();
  ok(welcomeKo.includes("마스터"), "welcome deck mentions 마스터 업로드");
  ok(/다섯 영역/.test(welcomeKo) && ["홈", "환자", "청구", "보고·기록", "조직", "검색", "AI 어시스트"].every(w => welcomeKo.includes(w)) && !/10개 탭|\b0\d\b/.test(welcomeKo), "first-run deck describes the five areas + two utilities, no tab numbers");
  ok((await $("#rail-areas .area-btn").count()) === 5 && (await $("#rail-areas [data-panel]").count()) === 18 && (await $("#rail-areas .num").count()) === 0, "rail: 5 areas · 18 panels · no numbers");
  ok(/PIN/.test(welcomeKo) && /기관 정보/.test(welcomeKo) && /KO \| EN/.test(welcomeKo) && /PoC/.test(welcomeKo) && /샘플 데이터로 둘러보기/.test(welcomeKo) && /▶ 시연/.test(welcomeKo) && !/다음 단계에서|둘러보기 다시 열기/.test(welcomeKo), "deck covers PIN + 기관 정보 first-run, the sample-data button, KO|EN, PoC rules, the ▶ 시연 menu entry");
  ok((await $("#welcome-tour").count()) === 1, "deck offers the 7-step walkthrough link");
  const foot = await page.evaluate(() => [...document.querySelectorAll(".rail-foot .rail-btn")].map(b => b.id));
  ok(foot.join(",") === RAIL_FOOT.join(",") && new Set(foot).size === foot.length && (await $(".rail-foot .lang-toggle").count()) === 1, `rail foot = ${foot.join(" · ")} + KO|EN (no search / AI / privacy / wipe duplicates)`);
  ok((await $("#topbar-search, #topbar-ai, #topbar-user, #topbar-org, #topbar-sync, .topbar .lang-toggle").count()) === 6 && (await $("#rail-cmdk, #rail-ai, #rail-privacy, #wipe-all").count()) === 0, "topbar = org · user · sync · KO|EN · 🔍 · ✦; those actions are not repeated in the rail foot");
  const railLabels = await page.evaluate(() => [...document.querySelectorAll(".rail-foot .rail-btn")].map(b => b.textContent.trim()));
  ok(railLabels.every(l => l.length > 1 && !/^[a-z]+\./.test(l)), `rail foot labels are real labels (${railLabels.join(" · ")})`);
  await noKeys("welcome deck + chrome", "#welcome-scrim, " + CHROME_SCOPE);

  /* 2 · seed */
  at("샘플 데이터로 둘러보기 (seed-all → shared entities + every tab, awaited in order)");
  await $("#welcome-seed").click();
  await closed("#welcome-scrim");
  await page.waitForFunction(() => { const p = document.querySelector("#ai-mode-pill"); return p && !p.hidden; }, null, { timeout: 25000 }); // 07 is the slowest seed (700 ms canned timer)
  await page.waitForFunction(() => document.querySelector("#jabo-recon-toolbar")?.style.display === "flex", null, { timeout: 15000 });
  await waitUsers(4); // 3 seeded logins created ON THE SERVER (PBKDF2 + hook each)
  await wait(900); // debounced persists (tariff burst, drafts)
  ok((await $("#lic-list .lic").count()) === 8, "seed → 7 clinic staff + the workspace creator = 8 roster rows");
  const dirSeed = await (await fetch(PB_LOCAL + "/api/collections/workspace/records")).json();
  const dirNames = dirSeed.items[0].directory.map(d => `${d.name}/${d.role}`).sort().join(",");
  ok(dirNames === "윤지훈/원장,정수아/행정,한지우/원무,홍 원장/원장" && dirSeed.items[0].directory.every(d => d.staffId && d.id.length === 15), `server directory after the seed: ${dirNames} (each with a staffId)`);
  const seedUsers = await ent(page, (E, S) => S.users().map(u => ({ name: u.name, role: u.role, row: E.Staff.list().find(s => s.id === u.staffId)?.name })));
  ok(seedUsers.every(u => u.row === u.name), "every server login's staffId points at its own roster row on this device");
  ok(await page.evaluate(() => document.querySelector("#tab-today")?.classList.contains("active") && document.body.dataset.area === "home"), "seed lands on 홈 (area home)");
  const todo0 = await page.evaluate(() => Array.from(document.querySelectorAll("#todo-list .todo")).map(el => ({ key: el.dataset.key, link: el.dataset.link, ctx: el.dataset.ctx })));
  ok(todo0.length >= 1 && todo0.every(x => x.key && x.link && x.ctx !== undefined) && todo0.some(x => x.key.startsWith("dl:lic-")), `홈 todo list populated by the seed (${todo0.length} rows: ${todo0.map(x => x.key).slice(0, 4).join(", ")}…)`);
  ok(!(await $("#tab-today .intake-board").count()) && (await $("#tab-board .intake-board").count()) === 1, "접수 보드 moved out of 홈 into 환자 › 접수 보드");
  const seeded = await ent(page, (E) => ({ staff: E.Staff.list().map(s => [s.name, s.job, !!s.userId]), patients: E.Patients.list().map(p => p.pid), tags: E.Patients.get("P-2026-0142")?.tags, insurer: E.Insurers.lastUsed(), alias: E.Patients.alias("P-2026-0142"), batches: E.Batches.list().map(b => [b.kind, b.source, b.count]) }));
  ok(seeded.staff.filter(([, , login]) => login).length === 4 && seeded.staff.some(([n, j, l]) => n === "윤지훈" && j === "한의사" && l) && seeded.staff.some(([n, j]) => n === "정수아" && j === "행정"), `roster: ${seeded.staff.map(([n, j, l]) => `${j} ${n}${l ? "🔑" : ""}`).join(", ")}`);
  ok(seeded.patients.length === 5 && PIDS.every(p => seeded.patients.includes(p)) && seeded.tags?.includes("자보") && seeded.alias === "환자 ****0142", `patients: ${seeded.patients.join(", ")} · alias "${seeded.alias}"`);
  ok(seeded.insurer === "삼성", "Insurers.lastUsed = 삼성 (an insurer value; label 삼성화재)");
  const kinds = seeded.batches.map(b => b[0]).sort().join(",");
  const counts = seeded.batches.map(b => b[2]);
  ok(kinds === "claims,claims,retention,review,review,yearend" && counts.includes(12) && counts.includes(10) && counts.includes(42) && counts.includes(33), `batches after the seed — 자보 (12 + 42 review) · 건보 (10 + 33 review) · retention · yearend: ${seeded.batches.map(b => `${b[0]}(${b[2]})`).join(" · ")}`);
  const seededP3 = await M(({ CS, Store, P, E }) => ({
    batches: E.Batches.list("claims").map(b => [b.meta?.sample, b.meta?.payer, b.count]), globalCur: CS.currentClaimsBatch()?.meta?.sample, auto: CS.currentClaimsBatch("auto")?.meta?.sample, nhis: CS.currentClaimsBatch("nhis")?.meta?.sample,
    appeals: CS.Appeals.list().map(a => [a.payer, a.stmt, a.code, a.status, a.result, a.cutAmount]), sensitive: ["appeals.list", "nhis.history", "guarantee.list", "docs.list", "consent.list", "retention.disposals"].every(k => Store.isSensitive(k)),
    g: (Store.get("guarantee.list", []) || []).map(r => [r.id, r.pid, r.status]), d: (Store.get("docs.list", []) || []).map(r => [r.no, r.pid, r.docType]), c: (Store.get("consent.list", []) || []).map(r => [r.id, r.pid, r.items.length]),
    pids: E.Patients.list().map(p => p.pid), stats: CS.appealStats(), gd: P.guaranteeDeadlines().map(d => [d.key, d.state, d.daysLeft])
  }));
  ok(seededP3.batches.some(b => b[0] === "hansol-2026-08" && b[1] === "auto" && b[2] === 12) && seededP3.batches.some(b => b[0] === "hansol-nhis-2026-08" && b[1] === "nhis" && b[2] === 10), `two claims batches with payers: ${JSON.stringify(seededP3.batches)}`);
  ok(seededP3.globalCur === "hansol-2026-08" && seededP3.auto === "hansol-2026-08" && seededP3.nhis === "hansol-nhis-2026-08", `payer-scoped current batches (global=${seededP3.globalCur} · auto=${seededP3.auto} · nhis=${seededP3.nhis}) — the 건보 seed did not hijack the global current`);
  ok(seededP3.appeals.length === 3 && seededP3.appeals.some(a => a[0] === "nhis" && a[1] === "N2608-0005" && a[3] === "prep" && a[5] === 78000) && seededP3.appeals.some(a => a[0] === "auto" && a[1] === "M2608-0010" && a[3] === "submitted") && seededP3.appeals.some(a => a[0] === "nhis" && a[1] === "N2608-0007" && a[3] === "result" && a[4] === "partial"), `3 seeded appeals (overdue prep · submitted · 일부인정): ${JSON.stringify(seededP3.appeals.map(a => a.slice(0, 5)))}`);
  ok(seededP3.stats.open === 1 && seededP3.stats.submitted === 1 && seededP3.stats.resolved === 1 && seededP3.stats.overdue === 1 && seededP3.stats.recovered === 4250 && seededP3.stats.appealed === 78000 + 19400, `appealStats() = ${JSON.stringify(seededP3.stats)}`);
  ok(seededP3.sensitive, "appeals.list · nhis.history · guarantee.list · docs.list · consent.list · retention.disposals are on the encrypted tier (store.js SENSITIVE_KEYS)");
  ok(seededP3.g.length === 2 && seededP3.g.some(([id, pid, st]) => id === "seed-gu-0142" && pid === "P-2026-0142" && st === "연장요청") && seededP3.g.some(([id, , st]) => id === "seed-gu-0418" && st === "만료"), `seed: 2 guarantees (${seededP3.g.map(x => x.join("/")).join(" · ")})`);
  ok(seededP3.d.length === 4 && seededP3.d.map(x => x[0]).sort().join(",") === "2026-0001,2026-0002,2026-0003,2026-0004" && seededP3.c.length === 3 && seededP3.c.every(x => x[2] >= 1), `seed: 4 documents (sequential no.) · 3 consents`);
  ok(seededP3.pids.length === 5, "the trackers' seeds added no pid beyond the shared five");
  ok(seededP3.gd.length === 2 && seededP3.gd.some(([k, st]) => k === "guar-seed-gu-0142" && st === "expiring") && seededP3.gd.some(([k, st, d]) => k === "guar-seed-gu-0418" && st === "expired" && d < 0), `guaranteeDeadlines(): ${seededP3.gd.map(x => x.join(":")).join(" · ")}`);
  const chip = await $("#topbar-due-text").innerText().catch(() => "");
  ok(!ALL_NAMES.some(n => chip.includes(n)), `topbar due chip carries no name (“${chip}”)`);
  const toasts = await page.evaluate(() => [...document.querySelectorAll("#toast-tray .toast")].map(t => t.textContent.replace(/\s+/g, " ").trim()));
  ok(toasts.filter(x => /샘플 데이터가 채워졌습니다/.test(x)).length === 1 && toasts.every(x => /샘플 데이터가 채워졌습니다|기관 정보 저장/.test(x)), `seed shows ONE summary toast, per-tool toasts muted (${toasts.length} on screen)`);

  /* 2a · every panel (KO): no raw i18n key anywhere, rail label = crumb = panel head, no horizontal overflow on the phone */
  at("KO: 18 panels — no key leaks, consistent labels (rail · crumb · panel head), phone: no horizontal overflow");
  const stripParen = (s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();
  for (const panel of PANELS) {
    await goTab(panel);
    if (panel === "tab-privacy") await page.waitForFunction(() => document.querySelectorAll("#privacy-table tr").length > 5);
    if (panel === "tab-today") await page.evaluate(() => document.querySelectorAll("#tab-today details").forEach(d => { d.open = true; }));
    const lab = await page.evaluate((id) => ({ rail: document.querySelector(`#rail-areas [data-panel="${id}"]`)?.textContent.trim(), crumb: document.querySelector("#crumb-tab")?.textContent.trim(), area: document.querySelector("#crumb-section")?.textContent.trim(), num: document.querySelector(`#${id} .panel-num`)?.textContent.trim(), sub: document.querySelector(`#subnav [data-panel="${id}"]`)?.textContent.trim() }), panel);
    ok(lab.rail && lab.rail === lab.crumb && (!MOBILE || lab.sub == null || lab.sub === lab.rail) && stripParen(lab.num) === `${lab.area} · ${lab.rail}`, `${panel}: rail “${lab.rail}” = crumb = sub-nav, panel head “${lab.num}” = area · panel`); // 홈 has one panel → no sub-nav segment
    await noKeys(panel, `#${panel}, ${CHROME_SCOPE}`);
    if (MOBILE) await noOverflow(panel);
  }
  await goTab("tab-today");

  /* 2b · the connected story, part 1 — 00 오늘 right after the seed */
  at("홈 — KPIs by payer from the seeded reconciliations, no nudges, resume cards, deadlines carry ctx, todo rows deep-link");
  ok(await page.evaluate(() => document.querySelector("#today-nudges")?.style.display === "none"), "no nudges (org complete · roster filled)");
  ok(await page.evaluate(() => document.querySelector("#kpi-empty")?.style.display === "none"), "KPI empty-state hidden");
  ok(await page.evaluate(() => document.querySelectorAll("#today-insights .insight.kpi").length === 9 && !document.querySelector("#today-insights .kpi-loading")), "9 KPI tiles, skeleton removed");
  const g = (s) => page.evaluate((sel) => document.querySelector(sel)?.innerText.replace(/\s+/g, " ").trim(), s);
  const kpi = { month: await $("#kpi-month").inputValue(), n: await g("#ins-jabo"), sub: await g("#ins-jabo-sub"), nhis: await g("#ins-nhis"), nhisSub: await g("#ins-nhis-sub"), cut: await g("#ins-cut"), cutSub: await g("#ins-cut-sub"), reason: await g("#ins-reason"), reasonSub: await g("#ins-reason-sub"), ins: await g("#ins-insurer"), insSub: await g("#ins-insurer-sub"), appeal: await g("#ins-appeal"), appealSub: await g("#ins-appeal-sub"), ar: await g("#ins-ar"), arSub: await g("#ins-ar-sub"), nonpay: await g("#ins-nonpay"), nonpaySub: await g("#ins-nonpay-sub"), guar: await g("#ins-guar"), guarSub: await g("#ins-guar-sub") };
  ok(kpi.month === "2026-08", `KPI month defaults to the latest month with reconciliation data (${kpi.month})`);
  ok(/^1 건/.test(kpi.n) && /청구 [\d,]+원 → 인정 [\d,]+원 · 2026-08/.test(kpi.sub) && !/청구 0원/.test(kpi.sub), `자보: 청구 vs 인정 from the seeded batch (${kpi.n} · ${kpi.sub})`);
  ok(/^1 건/.test(kpi.nhis) && /청구 [\d,]+원 → 인정 [\d,]+원 · 2026-08/.test(kpi.nhisSub) && /건보 [\d.]+%/.test(kpi.cutSub), `건보: tile from nhis.history (${kpi.nhis} · ${kpi.nhisSub} · ${kpi.cutSub})`);
  ok(parseFloat(kpi.cut) > 0 && /삭감 [1-9][\d,]*원/.test(kpi.cutSub), `조정률 ${kpi.cut} · ${kpi.cutSub}`);
  ok(kpi.reason !== "—" && HANGUL.test(kpi.reason) && /자보|건보/.test(kpi.reasonSub), `top 조정사유 from the recon byReason keys, payer named (${kpi.reason} · ${kpi.reasonSub})`);
  ok(kpi.ins === "삼성화재" && /1개사/.test(kpi.insSub), `top insurer label resolved from the value (${kpi.ins} · ${kpi.insSub})`);
  ok(/^2 건/.test(kpi.appeal) && /지연 1건 · 회수 4,250원/.test(kpi.appealSub), `이의신청 tile = open + submitted, overdue + recovered (${kpi.appeal} · ${kpi.appealSub})`);
  ok(/^[1-9][\d,]*원$/.test(kpi.ar) && /조정 [\d,]+원 − 이의신청 97,400원/.test(kpi.arSub), `미수금 = 조정 − 이의신청 (open cut 78,000 + 19,400) (${kpi.ar} · ${kpi.arSub})`);
  const nonpayExp = await M(({ CS }) => CS.tariffPrice("예시-07") * 14 + CS.tariffPrice("예시-03") * 2);
  ok(kpi.nonpay === `${nonpayExp.toLocaleString("ko-KR")}원` && /동의 2건 · 16개 항목 · 2026-08/.test(kpi.nonpaySub), `비급여 매출 추정 = the two August consents × Tariff (${kpi.nonpay} · ${kpi.nonpaySub})`);
  ok(/^1 건/.test(kpi.guar) && /이미 만료 1건/.test(kpi.guarSub), `지불보증 tile: 1 expiring · 1 expired (${kpi.guar} · ${kpi.guarSub})`);
  const resume = await $("#resume-list .resume[data-tab]").allInnerTexts();
  ok(resume.length >= 3 && resume.some(x => /미수록/.test(x)) && resume.some(x => /만료 초과/.test(x)) && resume.some(x => /오류/.test(x)), `resume cards: kcd · retention · yearend (${resume.length})`);
  await expandLater();
  const ddays = await page.evaluate(() => Array.from(document.querySelectorAll("#dday-list .dday")).map(el => ({ key: el.dataset.key, link: el.dataset.link, ctx: el.dataset.ctx ? JSON.parse(el.dataset.ctx) : null })));
  ok(ddays.some(d => d.key.startsWith("bigeup") && /^\d{4}-\d{2}$/.test(d.ctx?.refMonth)) && ddays.some(d => d.key === "yearend" && Number.isInteger(d.ctx?.taxYear)) && ddays.some(d => d.key.startsWith("lic-") && d.ctx?.staffId), `dashboard deadlines carry ctx (${ddays.length} rows: refMonth / taxYear / staffId)`);
  ok(ddays.filter(d => d.key.startsWith("appeal-ap-") && d.link === "tab-appeal" && d.ctx?.appealId).length === 2 && ddays.some(d => d.key === "guar-seed-gu-0142" && d.link === "tab-guarantee" && d.ctx?.guaranteeId === "seed-gu-0142") && ddays.some(d => d.key === "guar-seed-gu-0418"), "D-day list carries the 2 open appeals + the 2 guarantees from the registered deadline sources");
  ok(/자동 판정 미충족/.test(await $("#ins-accred-sub").innerText()), "accred tile names failing auto-judged items");
  if (await $("#todo-more").count()) await $("#todo-more").click();
  const todoAll = await page.evaluate(() => Array.from(document.querySelectorAll("#todo-list .todo")).map(el => ({ key: el.dataset.key, link: el.dataset.link, group: el.dataset.group, ctx: JSON.parse(el.dataset.ctx || "{}") })));
  const TODO_ORDER = ["over", "today", "week", "month"];
  ok(todoAll.every((r, i) => i === 0 || TODO_ORDER.indexOf(todoAll[i - 1].group) <= TODO_ORDER.indexOf(r.group)), `todo grouped 지연 → 오늘 → 이번 주 → 이번 달 (${todoAll.map(r => r.group).join(",")})`);
  const batchTodos = todoAll.filter(r => r.key.startsWith("batch:")).map(r => r.key);
  ok(batchTodos.join(",") === "batch:auto:appeal,batch:nhis:kcd,batch:nhis:appeal" || (batchTodos.length === 3 && ["batch:auto:appeal", "batch:nhis:kcd", "batch:nhis:appeal"].every(k => batchTodos.includes(k))), `open claim steps per payer, keys unique per payer (${batchTodos.join(", ")})`);
  const apTodo = todoAll.find(r => r.key.startsWith("dl:appeal-ap-"));
  ok(apTodo && apTodo.group === "over" && apTodo.link === "tab-appeal" && apTodo.ctx.appealId && todoAll.filter(r => r.key.startsWith("dl:appeal-")).length === 1, `the overdue 건보 appeal is a 지연 todo with ctx (${apTodo?.key})`);
  ok(todoAll.some(r => r.key === "dl:guar-seed-gu-0418" && r.group === "over") && todoAll.some(r => r.key === "dl:guar-seed-gu-0142" && r.group === "week" && r.ctx.guaranteeId === "seed-gu-0142"), "expired guarantee → 지연, expiring one → 이번 주, both with { guaranteeId }");
  if (await $("#todo-more").count()) await $("#todo-more").click();
  const licTodo = await page.evaluate(() => { const el = document.querySelector("#todo-list .todo[data-key^=\"dl:lic-\"]"); if (!el) return null; const ctx = JSON.parse(el.dataset.ctx); el.querySelector("[data-todo-go]").click(); return { link: el.dataset.link, ctx }; });
  ok(licTodo && licTodo.link === "tab-license" && licTodo.ctx.staffId, `todo row carries link + ctx (${JSON.stringify(licTodo)})`);
  await page.waitForSelector("#tab-license.active");
  ok((await $(`#lic-list .lic.highlight[data-id="${licTodo.ctx.staffId}"]`).count()) === 1 && (await $("#crumb-section").innerText()) === "조직" && (await $("#crumb-tab").innerText()) === "직원 명부", "todo → 조직 › 직원 명부 with the row highlighted; crumb = area › panel");
  await goTab("tab-today");

  /* 3 · second user — the 사용자 panel is a view over roster logins */
  at("add 2nd user (행정) via the users panel → linked roster row");
  await railClick("#rail-users");
  await page.waitForSelector("#users-scrim.open");
  await page.waitForFunction(() => document.querySelectorAll("#users-list .sec-row").length === 4);
  ok(/한의사/.test(await $("#users-list").innerText()), "users panel shows the job next to the system role (view over Staff)");
  await noKeys("users modal", "#users-scrim");
  ok(/연결됨/.test(await $("#users-cloud").innerText()) && (await $("#users-cloud").innerText()).includes(ORG.name), `users panel shows the server line (${await $("#users-cloud").innerText()})`);
  await $("#users-add-name").fill("행정 김"); await $("#users-add-role").selectOption("행정"); await $("#users-add-pin").fill(TEMP_PIN);
  await $("#users-add-btn").click();
  await answerReauth(OWNER_PIN);
  await page.waitForFunction(() => document.querySelectorAll("#users-list .sec-row").length === 5, null, { timeout: 20000 });
  ok(true, "users panel lists 5 logins (creator + 3 seeded + 행정 김)");
  ok(/로그인을 발급/.test(await $("#users-msg").innerText()), "issue message shown");
  const kimSrv = (await (await fetch(PB_LOCAL + "/api/collections/workspace/records")).json()).items[0].directory.find(d => d.name === "행정 김");
  ok(kimSrv && kimSrv.role === "행정", "행정 김 is in the SERVER directory (created through POST /api/clinic/users)");
  await $("#users-close").click(); await closed("#users-scrim");
  ok((await $("#lic-list .lic").count()) === 9, "adding a user added a roster row (9)");

  /* 4 · the connected story, part 2 — claims tabs on the ONE shared batch */
  at("02 자보 — reconciliation of the shared 2026-08 batch: cuts on ****0142, insurer on the history entry");
  await goTab("tab-jabo");
  ok((await $("#crumb-section").innerText()) === "청구" && (await $("#crumb-tab").innerText()) === "자보 심사결과 대조", "crumb shows area › panel labels");
  const strip02 = (await $("#jabo-batch-strip").innerText()).replace(/\s+/g, " ");
  ok(/청구 배치/.test(strip02) && /명세서 12건/.test(strip02) && /환자 5명/.test(strip02) && /2026-08/.test(strip02) && /샘플/.test(strip02), `compact batch strip: 12 명세서 · 5 환자 · 2026-08 · 샘플 (${strip02.slice(0, 100)})`);
  ok((await $("#jabo-batch-strip .batch-strip.compact [data-batch-open]").count()) === 1 && (await $("#jabo-batch-strip [data-batch-new]").count()) === 0, "strip collapsed to one line linking back to 청구 배치 (no 새 파일 here)");
  ok(/12건/.test(await $("#jabo-recon-summary").innerText()), "summary: 12 명세서");
  const reconRows = await $("#jabo-recon-result tbody tr").count();
  ok(reconRows === 42 && (await $("#jabo-recon-result tr.orphan").count()) === 1, `41 lines + 1 orphan review line (${reconRows})`);
  ok((await $("#jabo-recon-groups table").count()) === 2, "조정사유별 + 월별 group tables");
  const cuts0142 = await page.evaluate(() => Array.from(document.querySelectorAll("#jabo-recon-result tbody tr:not(.orphan)")).filter(tr => tr.children[1].textContent.trim() === "환자 ****0142" && tr.children[7].textContent.trim().startsWith("−")).map(tr => `${tr.children[0].textContent.trim()}/${tr.children[3].textContent.trim()}`));
  ok(cuts0142.length === 5 && cuts0142.includes("M2608-0001/예시-13") && cuts0142.filter(x => x.startsWith("M2608-0005")).length === 3, `cuts on ****0142 (alias in the patient column): ${cuts0142.join(", ")}`);
  ok(!/P-2026-0142/.test(await $("#jabo-recon-result").innerText()), "recon table never shows a raw 환자번호");
  ok((await $('#jabo-recon-result button[data-act="appeal"]').count()) >= 7 && (await $('#jabo-recon-result button[data-act="appeal-open"]').count()) === 1, "cut rows offer 이의신청 준비; the seeded submitted appeal (M2608-0010) shows 이의신청 · 제출");
  ok((await $("#jabo-recon-insurer").inputValue()) === "삼성", "batch insurer select = 삼성 (Insurers.lastUsed)");
  const hist = await ent(page, (E, S, Store) => Store.get("jabo.history", []));
  ok(hist.length === 1 && hist[0].kind === "recon" && hist[0].insurer === "삼성" && hist[0].batchId && hist[0].stmts === 12 && Array.isArray(hist[0].byReason) && hist[0].byReason.some(g => g.key === "site_mismatch" && g.cut > 0), `recon history: insurer + batchId + byReason (${hist[0]?.byReason?.map(g => g.key).join(",")})`);
  ok(/청구명세서/.test(await $("#jabo-file-claims").innerText()) && /심사결과통보/.test(await $("#jabo-file-review").innerText()), "file slots show both sample files");
  const reconDl = await download(() => $("#jabo-recon-download").click());
  ok(/_PoC\.xlsx$/.test(reconDl.name), `reconciliation xlsx watermarked (${reconDl.name})`);

  at("02 row (명세서 M2608-0005) → 01 focused on that 명세서");
  await clickRowBtn("#jabo-recon-result", "M2608-0005", 'button[data-act="kcd"]');
  await page.waitForSelector("#tab-kcd.active");
  await page.waitForFunction(() => !document.querySelector("#kcd-filter")?.hidden);
  ok(/M2608-0005/.test(await $("#kcd-filter").innerText()), "focus chip names the 명세서");
  ok((await $("#kcd-result tbody tr").count()) === 2 && (await $("#kcd-result tr.focus").count()) === 2, "01 table filtered to the 2 codes of M2608-0005, highlighted");
  await $("#kcd-filter-all").click();
  await page.waitForFunction(() => document.querySelectorAll("#kcd-result tbody tr").length === 21);
  ok(true, "전체 보기 restores all 21 rows");

  at("01 상병코드 정비 — same batch, 21 rows, verdicts, a 미수록 row → 07 prefilled");
  const strip01 = (await $("#kcd-batch-strip").innerText()).replace(/\s+/g, " ");
  ok(/명세서 12건/.test(strip01) && /2026-08/.test(strip01), "01 strip shows the same batch as 02");
  ok(/21건/.test(await $("#kcd-summary").innerText()), "21 상병 rows reviewed");
  const kcdText = await $("#kcd-result").innerText();
  ok(kcdText.includes("U코드 단독") && kcdText.includes("중복") && kcdText.includes("형식정리") && kcdText.includes("미수록"), "U코드 단독 / 중복 / 형식정리 / 미수록 verdicts rendered");
  ok(!kcdText.includes("주/부상병 컬럼이 없어"), "no 'missing rank column' warning when 주/부상병 present");
  ok((await $("#kcd-master-badge .src-pill.demo").count()) === 1, "master badge = 데모 발췌본");
  const kcdDl = await download(() => $("#kcd-download").click());
  ok(/_PoC\.xlsx$/.test(kcdDl.name), `xlsx filename watermarked (${kcdDl.name})`);
  const missingRow = await page.evaluate(() => {
    const tr = Array.from(document.querySelectorAll("#kcd-result tbody tr")).find(tr => tr.querySelector(".pill")?.textContent.trim() === "미수록");
    if (!tr) return null;
    const r = { stmt: tr.children[0].textContent.trim(), pid: tr.children[1].textContent.trim(), input: tr.children[5].textContent.trim() };
    tr.querySelector("button[data-ask]").click();
    return r;
  });
  ok(missingRow && /^P-2026-/.test(missingRow.pid), `clicked AI에게 묻기 on a 미수록 row (${missingRow?.stmt} · ${missingRow?.input})`);
  await page.waitForSelector("#ai-drawer.open");
  ok((await $("#tab-kcd.active").count()) === 1 && await page.evaluate(() => document.body.classList.contains("ai-open") && document.querySelector("#topbar-ai")?.getAttribute("aria-expanded") === "true"), "AI opens as a DRAWER over 상병 정비 (panel stays active, topbar ✦ expanded)");
  const note1 = await $("#ai-input").inputValue();
  ok(note1.includes(missingRow.input) && note1.includes(missingRow.stmt) && !note1.includes(missingRow.pid), "07 note carries code + 명세서, alias instead of the raw pid");
  const ctx1 = await $("#ai-ctx").innerText();
  ok(!(await page.evaluate(() => document.querySelector("#ai-ctx").hidden)) && ctx1.includes("****" + missingRow.pid.slice(-4)) && ctx1.includes(missingRow.stmt), `07 ctx chip: ${ctx1.replace(/\s+/g, " ")}`);

  at("대조 row (site_mismatch) → AI drawer prefilled with ctx → canned run → 이 코드로 자보 케이스 채우기 → manual case");
  await goTab("tab-jabo");
  ok(!(await $("#ai-drawer.open").count()), "navigating through the chrome closed the drawer");
  ok((await $('#jabo-recon-result button[data-act="ask"]').count()) === 2, "AI에게 묻기 only on site_mismatch / dup_same_site rows (2)");
  await clickRowBtn("#jabo-recon-result", "M2608-0001", 'button[data-act="ask"]');
  await page.waitForSelector("#ai-drawer.open");
  const note2 = await $("#ai-input").inputValue();
  ok(/M2608-0001/.test(note2) && /예시-13/.test(note2) && /S13\.4/.test(note2) && /부위 불일치/.test(note2) && !/P-2026-0142/.test(note2), `prefill carries 명세서 · dx · code · reason (${note2.slice(0, 70)}…)`);
  ok(/\*\*\*\*0142/.test(await $("#ai-ctx").innerText()) && /M2608-0001/.test(await $("#ai-ctx").innerText()), "ctx chip: ****0142 · M2608-0001");
  await $("#ai-run").click();
  await page.waitForFunction(() => { const p = document.querySelector("#ai-mode-pill"); return p && !p.hidden && /예시 모드/.test(p.textContent); }, null, { timeout: 8000 });
  const aiOut = await $("#ai-output").innerText();
  ok(/S13\.4/.test(aiOut) && /예시-13/.test(aiOut) && !/BC0001/.test(aiOut), "canned engine read the codes in the prefill (accident branch, 예시-NN scheme)");
  ok(!(await page.evaluate(() => document.querySelector("#ai-actions").hidden)) && (await $("#ai-output button[data-check]").count()) >= 5, "fill-jabo action + per-row 검색에서 확인 rendered");
  await $("#ai-fill-jabo").click();
  await page.waitForSelector("#tab-jabo.active");
  await page.waitForFunction(() => document.querySelectorAll("#jabo-items .item-row").length >= 3);
  const itemCodes = await page.evaluate(() => Array.from(document.querySelectorAll("#jabo-items .item-row .code-tag")).map(e => e.textContent));
  ok((await $("#jabo-dx").inputValue()) === "S134" && itemCodes.includes("예시-01") && itemCodes.includes("예시-03") && itemCodes.includes("예시-13"), `02 case: dx S134 · items ${itemCodes.join(",")}`);
  ok((await $("#jabo-pid").inputValue()) === "P-2026-0142" && (await $("#jabo-insurer").inputValue()) === "삼성", "pid from the note ctx, insurer defaulted to Insurers.lastUsed");
  ok(/케이스 채움/.test(await $("#jabo-status").innerText()), "manual status confirms the hand-off");

  at("AI row → 검색에서 확인 opens the ⌘K overlay prefilled · 우리 단가 from the seeded Tariff · insert → 자보 item");
  await openAi();
  ok((await $("#ai-input").inputValue()).length > 0 && /\*\*\*\*0142/.test(await $("#ai-ctx").innerText()), "reopening the drawer from the topbar keeps the note + ctx (workbench, not a dialog)");
  await page.evaluate(() => document.querySelector("#ai-output button[data-check]").click());
  await page.waitForSelector("#search-scrim.open");
  await page.waitForSelector("#search-result table");
  ok((await $("#search-input").inputValue()) === "S13.4" && /경추의 염좌/.test(await $("#search-result").innerText()), "overlay searched the code");
  ok((await $("#search-nav-results .palette-item, #search-nav-results .palette-empty").count()) >= 1 && /코드/.test(await $(".gsearch-codes-head .palette-section-label").innerText()), "overlay groups: 이동·명령 list (empty for a bare code) + 코드 table");
  await noKeys("search overlay", "#search-scrim");
  if (MOBILE) await noOverflow("search overlay (phone sheet)");
  await $("#search-input").fill("약침"); await wait(250);
  await page.waitForSelector("#search-result table");
  const tariffCells = await page.evaluate(() => Array.from(document.querySelectorAll("#search-result td.tariff strong")).map(e => e.textContent));
  ok(tariffCells.length > 0 && tariffCells.every(v => /[1-9][\d,]*원/.test(v)), `우리 단가 column filled from the seeded 04 tariff (${tariffCells.slice(0, 3).join(" | ")})`);
  const feeRowTariff = await page.evaluate(() => Array.from(document.querySelectorAll("#search-result tbody tr")).filter(tr => tr.querySelector("td:first-child .pill.warn")).map(tr => tr.querySelector("td.tariff")?.textContent.trim()));
  ok(feeRowTariff.length > 0 && feeRowTariff.every(v => v === "—"), `행위 rows do not borrow the 비급여 tariff (${feeRowTariff.length} rows)`);
  await $("#search-input").fill("전기침술"); await wait(250);
  await page.waitForFunction(() => /예시-04/.test(document.querySelector("#search-result")?.textContent || ""));
  await page.evaluate(() => document.querySelector("#search-result button[data-insert]").click());
  await page.waitForSelector("#search-result tr.insert-row");
  const insTxt = await $("#search-result tr.insert-row").innerText();
  ok(/자보 케이스/.test(insTxt) && /AI 메모/.test(insTxt) && /클립보드/.test(insTxt), "insert popover: 자보 케이스 · AI 메모 · 클립보드");
  const before = await $("#jabo-items .item-row").count();
  await page.evaluate(() => document.querySelector('#search-result tr.insert-row button[data-ins="jabo-item"]').click());
  await page.waitForSelector("#tab-jabo.active");
  await page.waitForFunction((n) => document.querySelectorAll("#jabo-items .item-row").length === n + 1, before);
  ok(!(await $("#search-scrim.open").count()), `overlay insert added 예시-04 to the 자보 case and closed itself (${before} → ${before + 1})`);
  const sa = await page.evaluate(async () => { const { searchAll } = await import("./js/tabs/tab6-search.js"); const r = searchAll("요통"); return { n: r.length, keys: Object.keys(r[0] || {}), kcd: r.some(x => x.source === "kcd" && x.edi === "M545") }; });
  ok(sa.n > 0 && sa.kcd && ["source", "origin", "code", "edi", "name", "flags", "tariff"].every(k => sa.keys.includes(k)), `searchAll("요통") → ${sa.n} rows, shape ok`);

  at("02 manual — 수기 샘플 (M2608-0001), typing keeps focus, 새 케이스 ▾ same accident");
  await runDemo("run-jabo-manual");
  await page.waitForSelector("#jabo-items .item-row");
  ok((await $("#jabo-pid").inputValue()) === "P-2026-0142" && (await $("#jabo-claim").inputValue()) === "SS-2026-77812" && (await $("#jabo-insurer").inputValue()) === "삼성", "manual sample = ****0142 · 삼성화재 · SS-2026-77812");
  const paid = $("#jabo-items .item-row").first().locator(".paid-unit");
  await paid.click(); await paid.fill(""); await paid.pressSequentially("1234", { delay: 40 });
  ok(await page.evaluate(() => document.activeElement?.classList.contains("paid-unit")), "focus stays in the 인정단가 input while typing");
  ok((await paid.inputValue()) === "1234", "typed value retained");
  ok((await $("#jabo-fee-badge .src-pill.demo").count()) === 1, "fee badge = 데모 예시표");
  const jaboDl = await download(() => $("#jabo-download").click());
  ok(/_PoC\.xlsx$/.test(jaboDl.name), `manual 정산표 filename watermarked (${jaboDl.name})`);
  await $("#jabo-new").click();
  await page.waitForFunction(() => !document.querySelector("#jabo-new-menu").hidden);
  await $("#jabo-new-same").click();
  await page.waitForFunction(() => document.querySelectorAll("#jabo-items .item-row").length === 0);
  ok((await $("#jabo-pid").inputValue()) === "P-2026-0142" && (await $("#jabo-dx").inputValue()) === "S134", "same-accident: pid + dx kept, items cleared");

  at("청구 › 청구 배치 — landing: full strip, two payer cards, 3 live steps each derived from kcd.lastSummary / recon history / appeals");
  await goTab("tab-kcd");
  await $("#kcd-batch-strip [data-batch-open]").click();
  await page.waitForSelector("#tab-claims.active");
  ok((await $("#claims-batch-strip [data-batch-new]").count()) === 1, "compact strip → landing; the landing's strip is the full one (새 파일)");
  const stepsOf = (sel) => page.evaluate((s) => Array.from(document.querySelectorAll(`${s} .claims-step`)).map(li => ({ key: li.dataset.step, payer: li.dataset.payer, state: [...li.classList].find(c => ["idle", "todo", "need", "done", "soon"].includes(c)), disabled: li.querySelector("button").disabled, text: li.textContent.replace(/\s+/g, " ").trim() })), sel);
  const steps = await stepsOf("#claims-steps"), stepsN = await stepsOf("#claims-steps-nhis");
  ok(steps.length === 3 && steps.map(s => s.state).join(",") === "done,done,todo" && !steps.some(s => s.disabled) && steps[2].payer === "auto", `자보 steps: kcd done · recon done · appeal todo (submitted one open), all enabled (${steps.map(s => `${s.key}=${s.state}`).join(" · ")})`);
  ok(stepsN.length === 3 && stepsN.map(s => s.state).join(",") === "todo,done,need" && !stepsN.some(s => s.disabled) && /기한 초과 1건/.test(stepsN[2].text) && /확인 필요/.test(stepsN[2].text), `건보 steps: kcd todo · recon done · appeal need (overdue) (${stepsN.map(s => `${s.key}=${s.state}`).join(" · ")})`);
  ok((await $("#tab-claims .claims-step.soon").count()) === 0 && (await $("#tab-claims .claims-payer").count()) === 2, "the 이의신청 step is live for both payers (no 'soon' placeholder)");
  const card = (await $("#claims-batch-card").innerText()).replace(/\s+/g, " ");
  ok(/12/.test(card) && /2026-08/.test(card) && /심사결과 연결/.test(card), `자보 batch card: 12 명세서 · 2026-08 · review linked (${card.slice(0, 80)})`);
  const cardN = (await $("#claims-batch-card-nhis").innerText()).replace(/\s+/g, " ");
  ok(/10/.test(cardN) && /2026-08/.test(cardN) && /심사결과 연결/.test(cardN) && /105,900/.test(cardN) && /이의신청/.test(cardN), `건보 card: 10 명세서 · 2026-08 · review linked · 조정 105,900원 · appeals (${cardN.slice(0, 90)})`);
  await page.evaluate(() => document.querySelector('#claims-batch-strip [data-batch-pick]').click());
  ok((await $("#claims-batch-strip .batch-picker .batch-row").count()) === 2 && (await $("#claims-batch-strip .batch-picker .pill.payer").allInnerTexts()).sort().join(",") === "건보,자보", "batch picker lists both batches with payer pills");
  ok(await $("#claims-payer-ask").isHidden(), "no 보험유형 ask while the current batch has a payer");
  // Layout: the progress section is its own full-width block (not squeezed into the 2-column .work grid); a step row keeps its
  // title on one line and its button beside it on desktop, and nothing overflows the phone.
  const landing = await page.evaluate(() => {
    const prog = document.querySelector("#claims-progress"), up = document.querySelector("#tab-claims .claims-upload");
    const titles = [...document.querySelectorAll("#tab-claims .cs-title")].map(e => e.getBoundingClientRect().height);
    const pills = [...document.querySelectorAll("#tab-claims .claims-payer-h .pill")].map(e => e.getBoundingClientRect().height);
    return { progW: prog.getBoundingClientRect().width, upW: up.getBoundingClientRect().width, payers: document.querySelectorAll("#claims-progress .claims-payer").length, steps: document.querySelectorAll("#claims-progress .claims-step").length, btns: document.querySelectorAll("#claims-progress .claims-step > button").length, maxTitle: Math.max(...titles), maxPill: Math.max(...pills), stateChips: [...document.querySelectorAll("#claims-progress .cs-state")].map(e => e.textContent.trim()) };
  });
  ok(Math.abs(landing.progW - landing.upW) < 2 && landing.payers === 2 && landing.steps === 6 && landing.btns === 6 && landing.stateChips.every(s => s && !/^[a-z]+\./.test(s)), `landing: upload card and progress section share the full width, 2 payer columns × 3 step rows, one action each, real state chips (${[...new Set(landing.stateChips)].join(" · ")})`);
  ok(landing.maxPill < 30 && (MOBILE || landing.maxTitle < 44), `landing: payer pill on one line (${landing.maxPill}px), step titles not wrapped char-by-char (${landing.maxTitle}px)`);
  await page.evaluate(() => document.querySelector('#claims-steps [data-step-go="recon"]').click());
  await page.waitForSelector("#tab-jabo.active");
  ok(true, "step button → 자보 심사결과 대조");
  if (MOBILE) { await goTab("tab-claims"); await noOverflow("청구 배치 landing"); }

  at("guided tour — ▶ 시연 deck → 화면 안내 7단계: each step lands on its panel with the target ringed, reaches 완료");
  await railClick("#rail-demo");
  await page.waitForSelector("#welcome-scrim.open");
  await $("#welcome-tour").click();
  await closed("#welcome-scrim");
  await page.waitForSelector("#tour-card:not([hidden])");
  const TOUR = [["seed", "tab-today"], ["todo", "tab-today"], ["claims", "tab-claims"], ["recon", "tab-jabo"], ["appeal", "tab-appeal"], ["patients", "tab-guarantee"], ["org", "tab-license"]];
  ok((await $("#tour-card").getAttribute("data-step")) === "1" && (await $("#tour-n").innerText()) === "1 / 7" && (await $("#tour-seed").isDisabled()) && /채워져/.test(await $("#tour-seed").innerText()), "step 1: seeded workspace → the seed button reads 채워져 있습니다 and is disabled");
  for (let i = 0; i < TOUR.length; i++) {
    const [key, panel] = TOUR[i];
    await page.waitForSelector(`#${panel}.active`);
    const st = await page.evaluate(() => ({ step: document.querySelector("#tour-card").dataset.step, key: document.querySelector("#tour-card").dataset.key, title: document.querySelector("#tour-title").textContent, body: document.querySelector("#tour-body").textContent, ring: document.querySelectorAll(".tour-target").length, ringInPanel: !!document.querySelector(".panel.active .tour-target"), next: document.querySelector("#tour-next").textContent.trim() }));
    ok(st.step === String(i + 1) && st.key === key && st.title.length > 3 && st.body.length > 40 && !KEY_RE.test(st.title) && st.ring === 1 && st.ringInPanel, `tour ${st.step}/7 “${st.title}” → ${panel}, target ringed`);
    if (MOBILE) await noOverflow(`tour step ${i + 1}`);
    if (i < TOUR.length - 1) { ok(st.next === "다음 →", "next button"); await $("#tour-next").click(); }
    else { ok(st.next === "완료", "final step offers 완료"); await $("#tour-next").click(); }
  }
  await page.waitForSelector("#tour-card[hidden]", { state: "attached" });
  ok((await $(".tour-target").count()) === 0 && !(await page.evaluate(() => document.body.classList.contains("tour-open"))), "tour closed on 완료 — ring and body flag removed");
  await openSearch("화면 안내");
  ok(/화면 안내 시작/.test(await $("#search-nav-results").innerText()), "⌘K lists the walkthrough command");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#tour-card:not([hidden])");
  ok((await $("#tour-card").getAttribute("data-step")) === "1" && !(await $("#search-scrim.open").count()), "command palette starts the tour at step 1");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#tour-card[hidden]", { state: "attached" });
  ok(true, "Esc closes the tour card");

  /* 5 · the connected story, part 3 — reporting tabs on the same entities */
  at("03 연말정산 — org read-only, cross-check against the shared claims batch, 3 issues, batch without names");
  await goTab("tab-yearend");
  const yeOrg = await $("#ye-org").innerText();
  ok(/한솔한방병원/.test(yeOrg) && /123-45-67890/.test(yeOrg) && /11000123/.test(yeOrg) && /병원/.test(yeOrg) && /윤지훈/.test(yeOrg), "03 shows the Org profile read-only");
  ok((await $("#ye-biz, #ye-clinic").count()) === 0, "03 no longer has 기관 inputs");
  ok((await $("#ye-year").inputValue()) === "2026", "seed aligned the tax year to the claims batch (2026)");
  await runDemo("run-ye");
  await page.waitForSelector("#ye-xcheck");
  ok((await $("#ye-result .ye-issues tbody tr").count()) === 3 && /오류 2/.test(await $("#ye-summary").innerText()), "3 issues / 오류 2");
  ok(!(await $("#ye-result").innerText()).includes("2123458") && (await $("#ye-result").innerText()).includes("P-2026-0142"), "RRN masked, 환자번호 shown");
  const xc = await page.evaluate(() => ({ counts: Array.from(document.querySelectorAll("#ye-xcheck .xcheck-col h6 strong")).map(e => +e.textContent), meta: document.querySelector("#ye-xcheck .xcheck-meta")?.textContent }));
  // Expected from the data: pid+date visits over BOTH claims batches (자보 12 + 건보 10, Phase 3) vs the 7-row sample file.
  const xcExp = await ent(page, (E) => { const key = (p, d) => `${p}|${d}`; const cl = new Set(E.Batches.list("claims").flatMap(b => b.rows).filter(r => r.pid && /^2026-/.test(r.date)).map(r => key(r.pid, r.date))); const fl = new Set((E.Batches.latest("yearend")?.rows || []).filter(r => r.pid && /^2026-\d{2}-\d{2}$/.test(r.date)).map(r => key(r.pid, r.date))); return { visits: cl.size, matched: [...fl].filter(k => cl.has(k)).length, onlyClaims: [...cl].filter(k => !fl.has(k)).length, onlyFile: [...fl].filter(k => !cl.has(k)).length }; });
  ok(xcExp.visits > 12 && xc.counts[0] === xcExp.onlyClaims && xc.counts[1] === xcExp.onlyFile && new RegExp(`${xcExp.visits}건 중 ${xcExp.matched}건 일치`).test(xc.meta) && xcExp.matched >= 5 && xcExp.onlyFile === 1, `cross-check over both payers' batches: ${xcExp.matched} matched · ${xcExp.onlyClaims} claims-only · ${xcExp.onlyFile} file-only of ${xcExp.visits} visits (${xc.meta})`);
  ok(/\*\*\*\*0142/.test(await $("#ye-xcheck").innerText()) && !ALL_NAMES.some(n => /xcheck/.test(n)), "cross-check lists Patients.alias(pid)");
  const yeBatch = await ent(page, (E) => { const b = E.Batches.latest("yearend"); return { n: b.rows.length, rows: JSON.stringify(b.rows), keys: Object.keys(b.rows[0]), taxYear: b.meta?.taxYear, errors: b.meta?.errors }; });
  ok(yeBatch.n === 7 && !/김민지|박지훈|이서윤|최다은|정하늘|2123458|masked|name/.test(yeBatch.rows) && yeBatch.taxYear === 2026 && yeBatch.errors === 2, `yearend batch: 7 rows, no names / RRNs (row keys ${yeBatch.keys.join(",")}), meta taxYear ${yeBatch.taxYear} · errors ${yeBatch.errors}`);
  ok(await $("#ye-recent").isVisible(), "03 recent-batch strip shown");
  await $("#ye-recent-open").click();
  await page.waitForFunction(() => /다시 열었습니다/.test(document.querySelector("#ye-status")?.textContent || ""));
  ok(/\*\*\*\*0142/.test(await $("#ye-result").innerText()) && !/김민지/.test(await $("#ye-result").innerText()), "re-opened batch renders aliases, no names");
  const yeDl = await download(() => $("#ye-download").click());
  ok(/_PoC\.csv$/.test(yeDl.name) && yeDl.text.includes("PoC — 실제 제출 불가") && yeDl.text.includes(ORG.ykiho), "CSV watermark row + filename + org header columns");
  await page.evaluate(() => document.querySelector("#ye-org [data-org-edit]").click());
  await page.waitForSelector("#tab-org.active");
  ok((await $("#orgpanel-name").inputValue()) === ORG.name, "「기관 정보 수정」 → 조직 › 기관 프로필 panel with the profile loaded");
  await ent(page, (E, S, St, EventBus) => EventBus.emitLocal("shell:openInfo", { section: "org" }));
  ok((await $("#tab-org.active").count()) === 1, "shell:openInfo (legacy event) still routes to the org panel");
  await railClick("#rail-info");
  await page.waitForSelector("#info-scrim.open");
  ok(/한솔한방병원/.test(await $("#info-org").innerText()) && (await $("#info-org input").count()) === 0 && (await $("#info-org [data-org-edit]").count()) === 1, "ⓘ modal keeps a READ-ONLY org summary + link (no editor)");
  const infoTxt = await $("#info-scrim").innerText();
  ok(/앱 v3\.1\.0-poc/.test(infoTxt) && infoTxt.includes(`워크스페이스 ${ORG.name}`) && /▶ 시연/.test(infoTxt) && /AI 어시스트/.test(infoTxt) && !/AI 코딩|다음 단계에서|둘러보기 다시/.test(infoTxt), "info modal: current version line names the server workspace, ▶ 시연 pointer, no stale wording");
  await noKeys("info modal", "#info-scrim");
  await $("#info-close").click(); await closed("#info-scrim");
  await goTab("tab-yearend");

  at("04 비급여 — org read-only, cadence from Org.kind, 28 rows filled by the seed, 가격 고지문");
  await goTab("tab-bigeup");
  const bgOrg = await $("#bg-org").innerText();
  ok(/한솔한방병원/.test(bgOrg) && /11000123/.test(bgOrg) && (await $("#bg-ykiho, #bg-clinic").count()) === 0, "04 shows the Org profile read-only, no 기관 inputs");
  const bgN = Number(await $("[data-bg-count]").first().innerText());
  ok(bgN === 28 && (await $("#bg-tbody tr").count()) === 28 && (await $("#bg-done").innerText()) === "28", `28 예시 rows, all priced by the seed`);
  ok((await $("#bg-tbody .bg-freq").first().inputValue()) !== "" && !(await $("#bg-download").isDisabled()), "실시빈도 filled · download enabled (org ykiho present)");
  ok(/확인 필요/.test(await $("#bg-window").innerText()) && /병원급/.test(await $("#bg-rule").innerText()) && (await $("#bg-refmonth option").count()) === 2, "병원급 → 2 reference months, window copy from the shared calendar");
  ok((await $("#bg-notice table tbody tr").count()) === 28 && /한솔한방병원/.test(await $("#bg-notice").innerText()) && /PoC/.test(await $("#bg-notice").innerText()) && !(await $("#bg-notice-print").isDisabled()), "가격 고지문: 28 priced rows, org name, PoC mark, print enabled");
  const tariffEnt = await ent(page, (E) => ({ n: Object.keys(E.Tariff.all()).length, date: E.Tariff.effectiveDate(), price: E.Tariff.get("예시-01") }));
  ok(tariffEnt.n === 28 && /^\d{4}-\d{2}-\d{2}$/.test(tariffEnt.date) && tariffEnt.price?.min !== "", `Tariff entity: 28 items · 적용일 ${tariffEnt.date}`);
  await ent(page, (E) => E.Org.set({ kind: "의원" }));
  await page.waitForFunction(() => document.querySelectorAll("#bg-refmonth option").length === 1);
  ok(/의원급/.test(await $("#bg-rule").innerText()), "Org.kind 의원 → March only");
  ok(!(await ent(page, (E, S, St, Ev, a, C, cal) => cal.allDeadlines().some(d => d.key === "bigeup-h2"))), "calendar drops the September window for 의원급 (00 + topbar chip share it)");
  await ent(page, (E) => E.Org.set({ kind: "병원" }));
  await page.waitForFunction(() => document.querySelectorAll("#bg-refmonth option").length === 2);
  const bgDl = await download(() => $("#bg-download").click());
  ok(/_PoC\.xlsx$/.test(bgDl.name) && bgDl.name.includes(ORG.ykiho), `비급여 xlsx named by ykiho + watermarked (${bgDl.name})`);

  at("05 보존 — aliases in the table, 작성일자 warning, retention batch with pids");
  await goTab("tab-retention");
  ok((await $("#ret-result tbody tr").count()) === 9 && (await $("#ret-result .basis-warn").count()) === 2, "9 rows · 2 flagged 작성일자 기준");
  ok(/작성일자 기준/.test(await $("#ret-summary").innerText()), "summary mentions fallback count");
  ok(/\*\*\*\*0142/.test(await $("#ret-result").innerText()) && !/P-2026-0142/.test(await $("#ret-result").innerText()), "05 table shows Patients.alias(pid), never the raw pid");
  ok(await $("#ret-recent").isVisible(), "05 recent-batch strip shown");
  const retB = await ent(page, (E, S, Store) => { const b = E.Batches.latest("retention"); const a = Store.get("retention.lastAudit"); return { n: b?.rows.length, pid: b?.rows[0]?.pid, over: a?.over, bad: a?.bad }; });
  ok(retB.n === 9 && retB.pid === "P-2026-0142" && retB.over > 0 && retB.bad === 1, `retention batch stored with pids · audit over=${retB.over} bad=${retB.bad}`);

  at("검색 overlay — demo CTA '요통' with source badge · ⌘K toggles · Esc closes");
  await runDemo("run-search");
  await page.waitForSelector("#search-scrim.open");
  await page.waitForSelector("#search-result table");
  ok((await $("#search-result tbody tr").count()) > 0 && (await $("#search-result .src-pill.demo").count()) > 0, "results with 데모 발췌 badge");
  ok((await $("#search-source-badge .src-pill.demo").count()) === 2, "masters panel source badge: 상병 + 행위 both 데모");
  await page.keyboard.press("Escape"); await closed("#search-scrim");
  await openSearch();
  ok((await $("#search-input").inputValue()) === "" && (await $("#search-nav-results .palette-item").count()) >= 13, "⌘K opens an empty overlay listing every panel + commands");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K"); await closed("#search-scrim");
  ok(true, "⌘K again closes it");
  const routed = await ent(page, (E, S, St, Ev, activateTab) => { activateTab("tab-search", { query: "추나" }); return document.querySelector("#search-scrim").classList.contains("open") && document.querySelector("#search-input").value; });
  ok(routed === "추나", `activateTab("tab-search", { query }) opens the overlay prefilled (${routed})`);
  await page.waitForSelector("#search-result table");
  await page.keyboard.press("Escape"); await closed("#search-scrim");
  await ent(page, (E, S, St, Ev, activateTab) => activateTab("tab-search", { section: "masters" }));
  await page.waitForSelector("#tab-masters.active");
  await page.waitForSelector("#tab-masters .master-upload.flash");
  ok((await $("#crumb-section").innerText()) === "조직" && (await $("#crumb-tab").innerText()) === "마스터 업로드", "activateTab('tab-search', { section: 'masters' }) is routed to 조직 › 마스터 업로드");

  at("조직 › 마스터 업로드 — tiny KOICD-shaped xlsx → badge flips in 상병 정비 + masters panel");
  const xlsxBytes = await page.evaluate(() => {
    const rows = [{ 상병기호: "M545", 한글명: "요통", 영문명: "Low back pain", 완전코드구분: "Y" }, { 상병기호: "M542", 한글명: "경부통", 영문명: "Cervicalgia", 완전코드구분: "Y" }, { 상병기호: "S134", 한글명: "경추의 염좌 및 긴장", 영문명: "", 완전코드구분: "Y" }, { 상병기호: "M75", 한글명: "어깨병변", 영문명: "", 완전코드구분: "N" }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "KOICD");
    return Array.from(new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })));
  });
  await $("#master-file-kcd").setInputFiles({ name: "koicd_master.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(xlsxBytes) });
  await page.waitForSelector("#master-map-kcd:not([hidden])");
  ok((await $('#master-map-kcd select[data-field="code"]').inputValue()) === "상병기호", "header mapping auto-suggested");
  await $('[data-map-save="kcd"]').click();
  await page.waitForSelector("#master-status-kcd .src-pill.master");
  ok((await $("#search-source-badge .src-pill.master").count()) === 1, "search badge flipped to 업로드 마스터 for 상병");
  await goTab("tab-kcd");
  ok((await $("#kcd-master-badge .src-pill.master").count()) === 1, "tab 01 badge flipped to 업로드본");
  await runDemo("run-kcd");
  await page.waitForFunction(() => (document.querySelector("#kcd-result")?.textContent || "").includes("업로드 마스터 미수록"));
  ok(true, "re-run compares against the uploaded master (미수록 wording)");
  await page.evaluate(() => document.querySelector("#kcd-master-badge [data-masters]").click());
  await page.waitForSelector("#tab-masters.active");
  await page.waitForSelector("#tab-masters .master-upload.flash");
  ok(true, "상병 정비 source badge → 조직 › 마스터 업로드 (flashed)");

  at("AI drawer — canned run → 예시 모드 pill, seed ctx ****0142 · M2608-0001");
  await openAi();
  if (MOBILE) await noOverflow("AI drawer (phone sheet)");
  ok(await page.evaluate(() => document.querySelector('#ai-source button[data-source="canned"]').classList.contains("active")), "default source is 예시");
  await runDemo("run-ai");
  await page.waitForFunction(() => { const p = document.querySelector("#ai-mode-pill"); return p && !p.hidden && p.textContent.includes("예시 모드"); }, null, { timeout: 8000 });
  ok(/\*\*\*\*0142/.test(await $("#ai-ctx").innerText()) && /M2608-0001/.test(await $("#ai-ctx").innerText()), "07 sample note is ****0142's (M2608-0001)");
  await noKeys("AI drawer", "#ai-drawer");

  at("AI drawer — live: consent → redaction preview → mocked tool_use → 라이브 pill · system prompt carries Org + tariff");
  await $('#ai-source button[data-source="live"]').click();
  await $("#ai-input").fill(LIVE_NOTE);
  await $("#ai-run").click();
  await page.waitForSelector("#ai-consent-scrim.open");
  ok((await $("#ai-consent-user").innerText()).includes("홍 원장"), "consent dialog names the current user");
  await $("#ai-consent-check").check();
  await $("#ai-consent-accept").click();
  await page.waitForSelector("#ai-preview-scrim.open");
  const preview = await $("#ai-preview-text").innerText();
  ok(preview.includes("[주민번호]") && preview.includes("[연락처]") && preview.includes("[환자]"), "preview masks RRN, phone, name");
  ok(!preview.includes("2123458") && !preview.includes("1234-5678") && !preview.includes(PNAME), "preview contains none of the raw identifiers");
  await $("#ai-preview-send").click();
  await page.waitForFunction(() => { const p = document.querySelector("#ai-mode-pill"); return p && !p.hidden && p.textContent.includes("라이브"); }, null, { timeout: 20000 });
  ok(!!liveRequest, "proxy received the request");
  ok(liveRequest.headers["x-pow-nonce"] === "n0", "PoW headers attached");
  ok(liveRequest.body.tool_choice?.name === "recommend_codes" && Array.isArray(liveRequest.body.tools), "forced tool_use in the body");
  const sent = JSON.stringify(liveRequest.body.messages);
  ok(!sent.includes("2123458") && !sent.includes("1234-5678") && !sent.includes(PNAME), "nothing raw left the browser");
  const sys = typeof liveRequest.body.system === "string" ? liveRequest.body.system : JSON.stringify(liveRequest.body.system);
  ok(sys.includes(ORG.name) && sys.includes("한방병원 (병원급)") && sys.includes("<clinic_tariff") && sys.includes("예시-01"), "system prompt carries the Org (종별 병원급) and the clinic tariff");
  ok((await $("#ai-output").innerText()).includes("S13.4"), "mocked tool_use parsed + rendered");

  at("조직 › 직원 명부 — add staff, login issue/revoke round trip, OCR unit, .ics with _PoC");
  await goTab("tab-license");
  ok(!(await $("#ai-drawer.open").count()), "opening a panel from the chrome closes the drawer");
  await $("#lic-role").selectOption("간호사"); await $("#lic-name").fill("오하늬"); await $("#lic-acquired").fill("2020-01-01");
  await $("#lic-add-btn").click();
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10);
  ok((await $("#lic-list").innerText()).includes("신고 이력 미확인"), "acquired-only row flagged");
  ok(/원장 권한/.test(await $("#lic-list").innerText()) && (await $("#lic-list .lic-login .sec-tag").count()) === 5, "login column: 5 badges, the workspace owner marked 원장 권한");
  const rowOf = (name) => page.locator("#lic-list .lic", { hasText: name });
  await rowOf("오하늬").locator('[data-act="login"]').click();
  await page.waitForSelector("#lic-login-form:not([hidden])");
  ok((await $("#lic-login-who").innerText()).includes("오하늬"), "login form names the row");
  await $("#lic-login-role").selectOption("원무"); await $("#lic-login-pin").fill("432100");
  await $("#lic-login-ok").click();
  await answerReauth(OWNER_PIN);
  await page.waitForFunction(() => document.querySelector("#lic-login-form")?.hidden === true, null, { timeout: 20000 });
  await waitUsers(6);
  const linked = await ent(page, (E, Session) => { const s = E.Staff.list().find(x => x.name === "오하늬"); const u = Session.users().find(x => x.id === s?.userId); return { userId: s?.userId, role: u?.role, staffId: u?.staffId, sid: s?.id, byUser: E.Staff.byUser(u?.id)?.name }; });
  ok(linked.userId && linked.role === "원무" && linked.staffId === linked.sid && linked.byUser === "오하늬", `issueLogin → server user (${linked.role}) ↔ staff row linked both ways (staffId travelled to the server)`);
  ok(/로그인 · 원무/.test(await rowOf("오하늬").innerText()), "row shows the login badge");
  page.once("dialog", d => d.accept());
  await rowOf("오하늬").locator('[data-act="revoke"]').click();
  await waitUsers(5);
  await rowOf("오하늬").locator('[data-act="login"]').waitFor({ timeout: 10000 });
  ok((await rowOf("오하늬").locator('[data-act="login"]').count()) === 1, "revokeLogin → user deleted on the server (DELETE /api/clinic/users/{id}), row offers 발급 again, row itself kept");
  ok(!(await (await fetch(PB_LOCAL + "/api/collections/workspace/records")).json()).items[0].directory.some(d => d.name === "오하늬"), "server directory no longer lists 오하늬");
  const ocr = await page.evaluate(async () => { const { OCR } = await import("./js/core/ocr.js"); const t = "한 의 사 면 허 증 면허번호 제 12345 호 성명 윤지훈 생년월일 1980.01.02 취득일 2009년 2월 27일"; return { issued: OCR.extractIssued(t), no: OCR.extractLicenseNo(t) }; });
  ok(ocr.issued === "2009-02-27" && ocr.no === "12345", `OCR heuristics: 취득일 ${ocr.issued} · 면허번호 ${ocr.no}`);
  const ics = await download(() => $("#lic-ics").click());
  ok(/_PoC\.ics$/.test(ics.name) && ics.text.includes("X-POC-NOTICE:PoC") && ics.text.includes("DESCRIPTION:PoC"), `license .ics watermarked (${ics.name})`);
  ok(!/UID:[^\r\n]*(윤지훈|박서연|김도현)/.test(ics.text), "ics UIDs are opaque ids (no names)");
  const staffCtx = await ent(page, (E, S, St, Ev, activateTab) => { const s = E.Staff.list().find(x => x.name === "김도현"); activateTab("tab-today"); activateTab("tab-license", { staffId: s.id }); return s.id; });
  ok((await $(`#lic-list .lic.highlight[data-id="${staffCtx}"]`).count()) === 1, "activateTab('tab-license', { staffId }) highlights that row");

  at("조직 › 인증 자체점검 — derived badges judge the seeded roster / tariff / audits; toggle one manual item");
  await goTab("tab-accred");
  ok((await $(".accred-item.derived").count()) === 5, "5 derived items");
  const auto = await page.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll(".accred-item.derived")).map(el => [el.dataset.id, { cls: el.querySelector(".accred-auto").className, txt: el.querySelector(".accred-auto").textContent.replace(/\s+/g, " ").trim() }])));
  ok(/\bwarn\b/.test(auto.hr1.cls) && /미확인 3\/7명/.test(auto.hr1.txt), `hr1 △ — 박서연 + the creator + 오하늬 (added in 08) have no 신고일 (${auto.hr1.txt})`);
  ok(/\bok\b/.test(auto.pr2.cls) && /28/.test(auto.pr2.txt), `pr2 ✓ — 28 priced items + 적용일 (${auto.pr2.txt})`);
  ok(/\bbad\b/.test(auto.mr1.cls) && /\bwarn\b/.test(auto.mr3.cls) && /분류 오류 1건/.test(auto.mr3.txt), `mr1 ✗ (records past retention) · mr3 △ (1 classification error, no 파기 대장 yet) (${auto.mr1.txt} / ${auto.mr3.txt})`);
  ok(/\bwarn\b/.test(auto.mr4.cls) && /미수록/.test(auto.mr4.txt), `mr4 △ — open KCD items from the seeded run (${auto.mr4.txt})`);
  ok((await $(".accred-item.done:not(.derived)").count()) === 9, "tab9 seed ticked 9 manual items");
  const before9 = await $("#accred-summary strong").innerText();
  await $(".accred-item:not(.tool):not(.derived)").first().click();
  await page.waitForFunction((b) => document.querySelector("#accred-summary strong")?.textContent !== b, before9);
  ok(true, `accred count changed (${before9} → ${await $("#accred-summary strong").innerText()})`);

  at("홈 — deadline rows open 비급여/연말정산 with ctx, accred tile deep-links, .ics with _PoC, feed carries no names");
  await goTab("tab-today");
  await expandLater();
  const bg = ddays.find(d => d.key.startsWith("bigeup"));
  await page.evaluate((k) => document.querySelector(`#dday-list .dday[data-key="${k}"]`).click(), bg.key);
  await page.waitForSelector("#tab-bigeup.active");
  await page.waitForFunction((m) => document.querySelector("#bg-refmonth")?.value === m, String(+bg.ctx.refMonth.slice(-2)));
  ok(true, `deadline ${bg.key} → 04 참고월 = ${+bg.ctx.refMonth.slice(-2)}`);
  await goTab("tab-today"); await expandLater();
  const ye = ddays.find(d => d.key === "yearend");
  await page.evaluate(() => document.querySelector('#dday-list .dday[data-key="yearend"]').click());
  await page.waitForSelector("#tab-yearend.active");
  ok((await $("#ye-year").inputValue()) === String(ye.ctx.taxYear), `yearend deadline → 03 tax year ${ye.ctx.taxYear}`);
  await goTab("tab-today");
  await $("#ins-accred-card").click();
  await page.waitForSelector("#tab-accred.active");
  await page.waitForSelector(".accred-item.hl");
  ok(true, `accred tile → tab-accred { itemId } highlighted ${await $(".accred-item.hl").getAttribute("data-id")}`);
  await goTab("tab-today");
  const dd = await download(() => $("#dday-ics").click());
  ok(/_PoC\.ics$/.test(dd.name) && dd.text.includes("X-POC-NOTICE:PoC"), `deadline .ics watermarked (${dd.name})`);
  await expandLater();
  await page.evaluate(() => { const d = document.querySelector("#home-activity"); if (d) d.open = true; });
  const dashText = await $("#dday-list").innerText() + await $("#act-feed").innerText();
  ok(!ALL_NAMES.some(n => dashText.includes(n)), "dashboard deadlines + activity feed contain no full names");
  ok(/한의사 윤○○|간호사 김○○|물리치료사 이○○/.test(dashText), "dashboard uses job + initial for staff (calendar.staffDeadlines over Staff)");

  /* ═══════════ PHASE 3 — the connected story continues on the same clinic ═══════════ */
  const rows3 = (panel) => page.evaluate((p) => Array.from(document.querySelectorAll(`#${p} .p3-table tbody tr`)).map(tr => ({ id: tr.dataset.id, cls: tr.className, text: tr.innerText.replace(/\s+/g, " ") })), panel);
  const listText = (panel) => page.evaluate((p) => document.querySelector(`#${p} [data-list]`)?.innerText || "", panel);
  const stubPrint = () => page.evaluate(() => { window.open = () => null; window.print = () => {}; }); // print → #p3-print-fallback (readable)
  const openAppealRow = (id) => page.evaluate((id) => { const tr = document.querySelector(`#appeal-list tr.appeal-row[data-id="${id}"]`); if (tr && !tr.classList.contains("open")) tr.click(); }, id);
  const todayISO = () => new Date().toISOString().slice(0, 10); // same UTC date as js/core/dom.js todayISO (a local-date copy flaked between 00:00 and 02:00 CEST)
  const plusDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  at("P3 홈 — the overdue appeal todo → 이의신청 drawer; the expiring guarantee todo → 지불보증 editor; .ics carries both");
  await goTab("tab-today");
  if (await $("#todo-more").count()) await $("#todo-more").click();
  const apCtx = await page.evaluate(() => { const el = document.querySelector('#todo-list .todo[data-key^="dl:appeal-"]'); const c = JSON.parse(el.dataset.ctx); el.querySelector("[data-todo-go]").click(); return c; });
  await page.waitForSelector("#tab-appeal.active");
  await page.waitForSelector(`#appeal-list tr.appeal-edit[data-id="${apCtx.appealId}"]`);
  ok(/N2608-0005/.test(await $("#appeal-draft").innerText()) && (await $("#crumb-tab").innerText()) === "이의신청", "todo → 청구 › 이의신청 with that appeal's drawer + draft open");
  if (MOBILE) await noOverflow("이의신청");
  await goTab("tab-today");
  if (await $("#todo-more").count()) await $("#todo-more").click();
  await page.evaluate(() => document.querySelector('#todo-list .todo[data-key="dl:guar-seed-gu-0142"] [data-todo-go]').click());
  await page.waitForSelector("#tab-guarantee.active");
  await page.waitForSelector("#tab-guarantee [data-editor]:not([hidden])");
  ok((await $('#tab-guarantee [data-editor] [data-e="guaranteeNo"]').inputValue()) === "SG-26-08-0142" && (await $('#tab-guarantee tr[data-id="seed-gu-0142"].highlight').count()) === 1, "todo → 환자 › 자보 지불보증 { guaranteeId }: row highlighted, editor open");
  await $("#tab-guarantee [data-editor] [data-cancel]").click();
  await goTab("tab-today");
  const ics3 = await download(() => $("#dday-ics").click());
  ok(/SUMMARY:이의신청 기한/.test(ics3.text) && /SUMMARY:자보 지불보증 만료/.test(ics3.text) && !/P-2026-/.test(ics3.text), ".ics carries the appeal deadline + guarantee expiries (aliases only)");

  /* ── 환자 ── */
  at("P3 환자 › 접수 보드 — card ⋯ menu: 지불보증 only for a 자보 pid; hand-offs open the trackers with { pid, create }");
  await goTab("tab-board");
  await page.waitForSelector("#intake-col-대기 .intake-card");
  const menus = await page.evaluate(() => Array.from(document.querySelectorAll(".intake-card")).map(c => ({ name: c.querySelector(".pc-name span").textContent, items: Array.from(c.querySelectorAll(".pc-menu [data-menu]")).map(b => b.dataset.menu) })));
  const m0142 = menus.find(m => /0142/.test(m.name)), m0301 = menus.find(m => /0301/.test(m.name));
  const tags0301 = await ent(page, (E) => E.Patients.get("P-2026-0301")?.tags || []);
  ok(m0142 && m0142.items.join(",") === "guarantee,docs,consent,ai" && m0301 && m0301.items.join(",") === "guarantee,docs,consent,ai" && tags0301.includes("자보"), `menus: every seeded card offers 지불보증 — all five pids appear in the 자보 claims batch, so the register tags them 자보 (****0301 tags: ${tags0301.join(",")})`);
  // (the 자보-only rule is checked on the untagged 새 가명 환자 card in the 접수 보드 step below)
  ok((await $(".intake-card .pc-menu:not([hidden])").count()) === 0, "menus closed by default");
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll(".intake-card")).find(c => /0142/.test(c.textContent)); c.querySelector(".pc-more").click(); });
  ok((await $(".intake-card .pc-menu:not([hidden])").count()) === 1, "⋯ opens one menu");
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll(".intake-card")).find(c => /0142/.test(c.textContent)); c.querySelector('.pc-menu [data-menu="guarantee"]').click(); });
  await page.waitForSelector("#tab-guarantee.active");
  await page.waitForSelector("#tab-guarantee [data-editor]:not([hidden])");
  ok((await $('#tab-guarantee [data-editor] [data-e="pid"]').inputValue()) === "P-2026-0142" && /새 지불보증/.test(await $("#tab-guarantee [data-editor] h5").innerText()) && (await $("#tab-guarantee [data-f-pid]").inputValue()) === "P-2026-0142", "card ⋯ → 지불보증: editor prefilled with the pid, list filtered on it");
  await $("#tab-guarantee [data-editor] [data-cancel]").click();
  await goTab("tab-board");
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll(".intake-card")).find(c => /0233/.test(c.textContent)); c.querySelector(".pc-more").click(); c.querySelector('.pc-menu [data-menu="docs"]').click(); });
  await page.waitForSelector("#tab-docs.active");
  await page.waitForSelector("#tab-docs [data-editor]:not([hidden])");
  ok((await $('#tab-docs [data-editor] [data-e="pid"]').inputValue()) === "P-2026-0233", "card ⋯ → 서류 발급: editor prefilled");
  await $("#tab-docs [data-editor] [data-cancel]").click();
  await goTab("tab-board");
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll(".intake-card")).find(c => /0301/.test(c.textContent)); c.querySelector(".pc-more").click(); c.querySelector('.pc-menu [data-menu="consent"]').click(); });
  await page.waitForSelector("#tab-consent.active");
  await page.waitForSelector("#tab-consent [data-editor]:not([hidden])");
  ok((await $('#tab-consent [data-editor] [data-e="pid"]').inputValue()) === "P-2026-0301", "card ⋯ → 비급여 동의: editor prefilled");
  await $("#tab-consent [data-editor] [data-cancel]").click();
  await goTab("tab-board");
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll(".intake-card")).find(c => /0233/.test(c.textContent)); c.querySelector(".pc-more").click(); c.querySelector('.pc-menu [data-menu="ai"]').click(); });
  await page.waitForSelector("#ai-drawer.open");
  ok(/\*\*\*\*0233/.test(await $("#ai-ctx").innerText()) && /요통/.test(await $("#ai-input").inputValue()), "card ⋯ → AI 메모: drawer open with the pid chip and the card summary as the note");
  await $("#ai-drawer-close").click();

  at("P3 환자 › 자보 지불보증 — seeded rows, aliases only, expiring + expired badges, 연장 요청, create → edit → 보증, chips, strip");
  await goTab("tab-guarantee");
  await $("#tab-guarantee [data-f-pid]").selectOption("");
  ok((await $("#crumb-section").innerText()) === "환자" && (await $("#crumb-tab").innerText()) === "자보 지불보증" && (await $("#tab-guarantee .p3-badges .badge").count()) === 2, "crumb = 환자 › 자보 지불보증 · intro badges inside the slot");
  let gRows = await rows3("tab-guarantee");
  const gText = await listText("tab-guarantee");
  ok(gRows.length === 2 && /\*\*\*\*0142/.test(gText) && !/P-2026-/.test(gText) && !ALL_NAMES.some(n => gText.includes(n)), "2 rows — Patients.alias() only, no raw pid, no names");
  const r0142 = gRows.find(r => r.id === "seed-gu-0142"), r0418 = gRows.find(r => r.id === "seed-gu-0418");
  ok(/expiring/.test(r0142.cls) && /만료 임박 D-\d/.test(r0142.text) && /삼성화재/.test(r0142.text) && /SS-2026-77812/.test(r0142.text) && /기록 3건/.test(r0142.text), `****0142: expiring badge · 삼성화재 · claim no. · 3 log entries`);
  ok(/expired/.test(r0418.cls) && /DB손해보험/.test(r0418.text) && /만료 임박 1/.test(await $("#tab-guarantee [data-summary]").innerText()) && /만료 1/.test(await $("#tab-guarantee [data-summary]").innerText()), "****0418: expired badge · DB손해보험 · summary counts");
  if (MOBILE) await noOverflow("자보 지불보증");
  await page.evaluate(() => document.querySelector('#tab-guarantee tr[data-id="seed-gu-0418"] [data-act="extend"]').click());
  await page.waitForFunction(() => /연장 요청/.test(document.querySelector('#tab-guarantee tr[data-id="seed-gu-0418"]')?.innerText || ""));
  const ext = await M(({ G }) => { const r = G.get("seed-gu-0418"); return { status: r.status, logs: r.log.length, last: r.log[r.log.length - 1] }; });
  ok(ext.status === "연장요청" && ext.logs === 3 && ext.last.kind === "전화" && ext.last.actor, "연장 요청 → status 연장요청, log +1 (전화, actor = staffId)");
  await $("#tab-guarantee [data-new]").click();
  await page.waitForSelector("#tab-guarantee [data-editor]:not([hidden])");
  await $('#tab-guarantee [data-editor] [data-e="pid"]').selectOption("P-2026-0233");
  await $('#tab-guarantee [data-editor] [data-e="insurer"]').selectOption("현대");
  await $('#tab-guarantee [data-editor] [data-e="claimNo"]').fill("HD-2026-0001");
  await $('#tab-guarantee [data-editor] [data-e="to"]').fill(plusDays(todayISO(), 3));
  await $('#tab-guarantee [data-editor] [data-scope="inp"]').check();
  await $("#tab-guarantee [data-log-text]").fill("접수 — 보증서 요청"); await $("#tab-guarantee [data-log-add]").click();
  await page.waitForFunction(() => document.querySelectorAll("#tab-guarantee [data-log] li").length === 1 && !/아직 기록/.test(document.querySelector("#tab-guarantee [data-log]").innerText));
  await $("#tab-guarantee [data-editor] [data-save]").click();
  await page.waitForFunction(() => document.querySelectorAll("#tab-guarantee .p3-table tbody tr").length === 3);
  gRows = await rows3("tab-guarantee");
  const gNew = gRows.find(r => /\*\*\*\*0233/.test(r.text));
  ok(gNew && /highlight/.test(gNew.cls) && /요청중/.test(gNew.text) && /현대해상/.test(gNew.text) && /외래 · 입원/.test(gNew.text) && !/expiring/.test(gNew.cls), "new guarantee saved (요청중 — no expiry badge while only requested), highlighted, scope 외래 · 입원");
  ok((await ent(page, (E) => E.Patients.get("P-2026-0233")?.tags)).includes("자보"), "saving a guarantee tags the pid 자보 in the register");
  await page.evaluate((id) => document.querySelector(`#tab-guarantee tr[data-id="${id}"] [data-act="edit"]`).click(), gNew.id);
  await page.waitForSelector("#tab-guarantee [data-editor]:not([hidden])");
  await $('#tab-guarantee [data-editor] [data-e="status"]').selectOption("보증");
  await $("#tab-guarantee [data-editor] [data-save]").click();
  await page.waitForFunction((id) => /expiring/.test(document.querySelector(`#tab-guarantee tr[data-id="${id}"]`)?.className || ""), gNew.id);
  ok(/만료 임박 2/.test(await $("#tab-guarantee [data-summary]").innerText()), "status → 보증 with an end date in 3 days → expiring badge, summary 만료 임박 2");
  await page.evaluate(() => document.querySelector('#tab-guarantee [data-chip="soon"]').click());
  await page.waitForFunction(() => document.querySelectorAll("#tab-guarantee .p3-table tbody tr").length === 2);
  await page.evaluate(() => document.querySelector('#tab-guarantee [data-chip=""]').click());
  await $("#tab-guarantee [data-f-pid]").selectOption("P-2026-0142");
  await page.waitForFunction(() => document.querySelectorAll("#tab-guarantee .p3-table tbody tr").length === 1);
  const strip3 = await $("#tab-guarantee [data-strip]").innerText();
  ok(/환자 \*\*\*\*0142/.test(strip3) && /지불보증 1/.test(strip3) && /발급 1/.test(strip3) && /동의 1/.test(strip3), `patient strip: alias · tags · counts (${strip3.replace(/\s+/g, " ")})`);
  const counts3 = await M(({ P }) => P.patientCounts("P-2026-0142"));
  ok(counts3.guarantees === 1 && counts3.docs === 1 && counts3.consents === 1, `patientCounts(pid) → ${JSON.stringify(counts3)}`);
  await page.evaluate(() => document.querySelector('#tab-guarantee [data-strip] [data-strip-go="tab-docs"]').click());
  await page.waitForSelector("#tab-docs.active");
  ok((await $("#tab-docs [data-f-pid]").inputValue()) === "P-2026-0142" && (await $("#tab-docs .p3-table tbody tr").count()) === 1, "strip count → 발급 대장 filtered on the same pid");
  await goTab("tab-guarantee");
  await page.evaluate(() => document.querySelector('#tab-guarantee tr[data-id="seed-gu-0142"] [data-act="case"]').click());
  await page.waitForSelector("#tab-jabo.active");
  ok((await $("#jabo-pid").inputValue()) === "P-2026-0142" && (await $("#jabo-insurer").inputValue()) === "삼성" && (await $("#jabo-claim").inputValue()) === "SS-2026-77812" && (await $("#jabo-accident").inputValue()) === "2026-08-03", "자보 케이스 열기 → tab-jabo { pid, insurer, claim, accident, focus: manual }");
  await goTab("tab-guarantee");
  await $("#tab-guarantee [data-f-pid]").selectOption("");
  const gDl = await download(() => $("#tab-guarantee [data-export]").click());
  ok(/^지불보증대장_\d{4}-\d{2}-\d{2}_PoC\.xlsx$/.test(gDl.name), `지불보증 대장 xlsx watermarked (${gDl.name})`);
  const gd3 = await M(({ P }) => P.guaranteeDeadlines());
  ok(gd3.length === 3 && gd3.every(d => /^guar-/.test(d.key) && d.ctx?.guaranteeId && d.link === "tab-guarantee") && gd3[0].daysLeft <= gd3[1].daysLeft && !ALL_NAMES.some(n => JSON.stringify(gd3).includes(n)), `guaranteeDeadlines(): ${gd3.length} items, sorted, alias + insurer only`);

  at("P3 환자 › 서류 발급 대장 — seeded rows · 발급번호 · 대리인 checks · 연말정산 hint · issuer validation · fee hint · print");
  await goTab("tab-docs");
  await $("#tab-docs [data-f-pid]").selectOption("");
  let dRows = await rows3("tab-docs");
  ok(dRows.length === 4 && dRows.map(r => r.text.slice(0, 9)).join(",") === "2026-0004,2026-0003,2026-0002,2026-0001", `4 documents, newest first`);
  const dText = await listText("tab-docs");
  ok(/\*\*\*\*0142/.test(dText) && !/P-2026-/.test(dText) && !ALL_NAMES.some(n => dText.includes(n)) && /한의사 윤○○/.test(dText) && /원무 한○○/.test(dText), "aliases only, issuers via Staff.ref()");
  const dProxy = dRows.find(r => /소견서/.test(r.text));
  ok(dProxy && /대리인/.test(dProxy.text) && /위임장 ✓/.test(dProxy.text) && /신분증 ✓/.test(dProxy.text) && !/warn/.test(dProxy.cls), "소견서 row: 대리인 with 위임장 ✓ · 신분증 ✓");
  ok((await $('#tab-docs tr[data-id="seed-doc-0301"] [data-act="yearend"]').count()) === 1 && (await $('#tab-docs tr[data-id="seed-doc-0142"] [data-act="yearend"]').count()) === 0, "「연말정산 자료 안내」 hint only on the January 영수증 재발급 row");
  if (MOBILE) await noOverflow("서류 발급 대장");
  const staffIds = await ent(page, (E) => Object.fromEntries(E.Staff.list().map(s => [s.name, s.id])));
  await $("#tab-docs [data-new]").click();
  await page.waitForSelector("#tab-docs [data-editor]:not([hidden])");
  ok(/2026-0005/.test(await $("#tab-docs [data-editor] h5").innerText()), "new editor previews the next issue no. 2026-0005");
  await $('#tab-docs [data-editor] [data-e="pid"]').selectOption("P-2026-0509");
  await $('#tab-docs [data-editor] [data-e="docType"]').selectOption("진단서");
  ok(/수기 입력/.test(await $("#tab-docs [data-fee-hint]").innerText()) && /한의사만/.test(await $("#tab-docs [data-issuer-hint]").innerText()), "fee hint: no certificate item in the tariff → manual; issuer hint: 한의사 only");
  await $('#tab-docs [data-editor] [data-e="fee"]').fill("20000");
  await $('#tab-docs [data-editor] [data-e="issuedBy"]').selectOption(staffIds["한지우"]);
  await $("#tab-docs [data-editor] [data-save]").click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("#toast-tray .toast")).some(t => /한의사만 발급/.test(t.textContent)));
  ok((await $("#tab-docs .p3-table tbody tr").count()) === 4, "진단서 by 원무 refused (toast), still 4 rows");
  await $('#tab-docs [data-editor] [data-e="issuedBy"]').selectOption(staffIds["윤지훈"]);
  await $("#tab-docs [data-editor] [data-save]").click();
  await page.waitForFunction(() => document.querySelectorAll("#tab-docs .p3-table tbody tr").length === 5);
  dRows = await rows3("tab-docs");
  ok(/^2026-0005/.test(dRows[0].text) && /highlight/.test(dRows[0].cls) && /\*\*\*\*0509/.test(dRows[0].text) && /한의사 윤○○/.test(dRows[0].text) && /20,000원/.test(dRows[0].text), "saved as 2026-0005 by 한의사 윤○○, fee 20,000원");
  const feeUnit = await M(({ D }) => ({ hit: D.docFee("진단서", [{ code: "X-1", name: "진단서 발급", price: 20000 }]), miss: D.docFee("진단서", []), receipt: D.docFee("영수증 재발급", []), next: D.nextDocNo("2026"), next2027: D.nextDocNo("2027") }));
  ok(feeUnit.hit?.fee === 20000 && feeUnit.miss === null && feeUnit.receipt?.fee === 0 && feeUnit.next === "2026-0006" && feeUnit.next2027 === "2027-0001", `docFee() / nextDocNo() (${feeUnit.next} · ${feeUnit.next2027})`);
  await page.evaluate(() => document.querySelector('#tab-docs tr[data-id] [data-act="edit"]').click());
  await page.waitForSelector("#tab-docs [data-editor]:not([hidden])");
  await $('#tab-docs [data-editor] [data-e="recipient"]').selectOption("대리인");
  await page.waitForFunction(() => !document.querySelector("#tab-docs [data-proxy-row]").hidden);
  await $("#tab-docs [data-editor] [data-save]").click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("#toast-tray .toast")).some(t => /위임장/.test(t.textContent)));
  await $('#tab-docs [data-proxy="poa"]').check(); await $('#tab-docs [data-proxy="idChecked"]').check();
  await $("#tab-docs [data-editor] [data-save]").click();
  await page.waitForFunction(() => document.querySelector("#tab-docs [data-editor]").hidden);
  ok(/대리인/.test((await rows3("tab-docs"))[0].text) && /위임장 ✓/.test((await rows3("tab-docs"))[0].text), "대리인 without checks refused (toast); with both checks the row saves");
  const dDl = await download(() => $("#tab-docs [data-export]").click());
  ok(/^발급대장_\d{4}-\d{2}-\d{2}_PoC\.xlsx$/.test(dDl.name), `발급 대장 xlsx watermarked (${dDl.name})`);
  await stubPrint();
  await $("#tab-docs [data-print-month]").selectOption("2026-08");
  await $("#tab-docs [data-print]").click();
  await page.waitForSelector("#p3-print-fallback", { state: "attached" });
  const monthly = await page.evaluate(() => document.querySelector("#p3-print-fallback").innerText);
  ok(/진단서 등 발급 대장 — 2026-08/.test(monthly) && monthly.includes(ORG.name) && /2026-0002/.test(monthly) && /2026-0004/.test(monthly) && !/2026-0001/.test(monthly) && /PoC/.test(monthly) && !ALL_NAMES.some(n => monthly.includes(n)), "printable monthly 대장: org · the 3 August rows · PoC mark · no names");

  at("P3 환자 › 비급여 설명·동의 — tariff-priced seeded rows · create with items · 동의서 print · 자보 hand-off adds a 비급여 line (Tariff code space)");
  await goTab("tab-consent");
  await $("#tab-consent [data-f-pid]").selectOption("");
  let cRows = await rows3("tab-consent");
  ok(cRows.length === 3 && (await $("#tab-consent [data-tariff-empty]").count()) === 0, "3 consents · no empty-tariff notice (04 seeded the tariff)");
  const price07 = await M(({ CS }) => CS.tariffPrice("예시-07"));
  const c0301 = cRows.find(r => r.id === "seed-cs-0301");
  ok(price07 > 0 && c0301 && c0301.text.includes(`${price07.toLocaleString("ko-KR")}원 × 14`) && /예시-07/.test(c0301.text), `****0301 첩약: 14 × 우리 단가 ${price07} (Tariff entity)`);
  const cText = await listText("tab-consent");
  ok(!/P-2026-/.test(cText) && !ALL_NAMES.some(n => cText.includes(n)) && /한의사 박○○/.test(cText) && /warn/.test(cRows.find(r => r.id === "seed-cs-0418").cls), "aliases + Staff.ref only; the unsigned 추나 초과분 row is a warn row");
  if (MOBILE) await noOverflow("비급여 설명·동의");
  await $("#tab-consent [data-new]").click();
  await page.waitForSelector("#tab-consent [data-editor]:not([hidden])");
  await $('#tab-consent [data-editor] [data-e="pid"]').selectOption("P-2026-0233");
  await $("#tab-consent [data-item-code]").selectOption("예시-01"); await $("#tab-consent [data-item-qty]").fill("2"); await $("#tab-consent [data-item-add]").click();
  await page.waitForFunction(() => document.querySelectorAll("#tab-consent [data-items] li [data-qty]").length === 1);
  await $("#tab-consent [data-item-code]").selectOption("예시-16"); await $("#tab-consent [data-item-add]").click();
  await page.waitForFunction(() => document.querySelectorAll("#tab-consent [data-items] li [data-qty]").length === 2);
  const price0116 = await M(({ CS }) => [CS.tariffPrice("예시-01"), CS.tariffPrice("예시-16")]);
  ok((await $("#tab-consent [data-total]").innerText()) === `${(price0116[0] * 2 + price0116[1]).toLocaleString("ko-KR")}원`, "editor total = 2 × 예시-01 + 예시-16");
  await $("#tab-consent [data-editor] [data-save]").click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("#toast-tray .toast")).some(t => /설명한 직원/.test(t.textContent)));
  await $('#tab-consent [data-editor] [data-e="explainedBy"]').selectOption(staffIds["윤지훈"]);
  await $("#tab-consent [data-signed]").check();
  await $("#tab-consent [data-editor] [data-save]").click();
  await page.waitForFunction(() => document.querySelectorAll("#tab-consent .p3-table tbody tr").length === 4);
  cRows = await rows3("tab-consent");
  ok(/highlight/.test(cRows[0].cls) && /\*\*\*\*0233/.test(cRows[0].text) && /× 2/.test(cRows[0].text) && /서명 완료/.test(cRows[0].text), "consent saved with 2 item lines, signed (explainer required first)");
  const savedC = await M(({ CT }) => CT.list().find(r => r.pid === "P-2026-0233"));
  ok(savedC.items[0].code === "예시-01" && savedC.items[0].qty === 2 && savedC.items[0].price === price0116[0] && savedC.items[0].name && savedC.explainedBy === staffIds["윤지훈"] && savedC.signed === true, "record stores Tariff code · snapshotted name · price · qty · staffId");
  await stubPrint();
  await page.evaluate(() => document.querySelector('#tab-consent tr[data-id="seed-cs-0142"] [data-act="print"]').click());
  await page.waitForFunction(() => /동의서/.test(document.querySelector("#p3-print-fallback")?.innerText || ""));
  const consentDraft = await page.evaluate(() => document.querySelector("#p3-print-fallback").innerText);
  ok(/비급여 진료 사전 설명·동의서 \(초안\)/.test(consentDraft) && consentDraft.includes(ORG.name) && /\*\*\*\*0142/.test(consentDraft) && /예시-03/.test(consentDraft) && /PoC — 실제 서식은 병원 양식 기준/.test(consentDraft), "동의서 초안: org · alias · items · PoC");
  await page.evaluate(() => document.querySelector('#tab-consent tr[data-id="seed-cs-0142"] [data-act="jabo"]').click());
  await page.waitForSelector("#tab-jabo.active");
  await page.waitForSelector("#jabo-items .item-row.bigeup");
  const bgLine = await page.evaluate(() => { const r = document.querySelector("#jabo-items .item-row.bigeup"); return { code: r.querySelector(".code-tag").textContent, name: r.querySelector(".name").textContent.replace(/\s+/g, " "), rows: document.querySelectorAll("#jabo-items .item-row").length, preview: document.querySelector("#jabo-preview").innerText, status: document.querySelector("#jabo-status").innerText }; });
  const tariff03 = await M(({ CS }) => CS.tariffPrice("예시-03"));
  ok((await $("#jabo-pid").inputValue()) === "P-2026-0142" && bgLine.rows === 1 && bgLine.code === "예시-03" && /팔강 약침/.test(bgLine.name) && !/경혈침술/.test(bgLine.name) && /비급여/.test(bgLine.name), `자보 케이스에 항목 추가 → ONE 비급여 line 예시-03 「팔강 약침」 from the Tariff code space — not the fee list's 예시-03 경혈침술 (${bgLine.name})`);
  ok(/팔강 약침/.test(bgLine.preview) && bgLine.preview.includes(tariff03.toLocaleString("ko-KR")) && /비급여 1개 항목/.test(bgLine.status) && /케이스 채움/.test(bgLine.status), `preview prices the 비급여 line at the clinic's 단가 ${tariff03} · status names the hand-off`);
  await $("#jabo-new").click(); await page.waitForFunction(() => !document.querySelector("#jabo-new-menu").hidden); await $("#jabo-new-fresh").click();
  await page.waitForFunction(() => document.querySelectorAll("#jabo-items .item-row").length === 0);
  await goTab("tab-consent");
  const cDl = await download(() => $("#tab-consent [data-export]").click());
  ok(/^비급여동의기록_\d{4}-\d{2}-\d{2}_PoC\.xlsx$/.test(cDl.name), `동의 기록 xlsx watermarked (${cDl.name})`);
  const tariffSnap = await ent(page, (E) => { const all = E.Tariff.all(); E.Tariff.replaceAll({}); return all; });
  await page.waitForSelector("#tab-consent [data-tariff-empty]");
  ok(/조직 › 비급여 단가표에서 가격을 먼저 입력하세요/.test(await $("#tab-consent [data-tariff-empty]").innerText()), "empty tariff → notice with link");
  await page.evaluate((snap) => import("./js/core/entities.js").then(({ Tariff }) => Tariff.replaceAll(snap)), tariffSnap);
  await page.waitForFunction(() => !document.querySelector("#tab-consent [data-tariff-empty]"));
  ok(true, "tariff restored → notice gone (Tariff.onChange re-mounts)");

  /* ── 청구 ── */
  at("P3 청구 › 건보 심사결과 대조 — same tables as 자보, 건보 reasons, aliases, no insurer select, 이의신청 buttons, nhis.history");
  await goTab("tab-claims");
  await page.evaluate(() => document.querySelector('#claims-steps-nhis [data-step-go="recon"]').click());
  await page.waitForSelector("#tab-nhis.active");
  ok((await $("#crumb-section").innerText()) === "청구" && (await $("#crumb-tab").innerText()) === "건보 심사결과 대조", "건보 recon step button → 청구 › 건보 심사결과 대조");
  const stripN = (await $("#nhis-batch-strip").innerText()).replace(/\s+/g, " ");
  ok(/명세서 10건/.test(stripN) && /환자 3명/.test(stripN) && /건보/.test(stripN) && (await $("#nhis-batch-strip [data-batch-open]").count()) === 1, `compact 건보 strip: 10 명세서 · 3 환자 · 건보 pill`);
  ok(/10건/.test(await $("#nhis-recon-summary").innerText()) && /105,900/.test(await $("#nhis-recon-summary").innerText()) && (await $("#nhis-recon-result tbody tr").count()) === 33 && (await $("#nhis-recon-result tr.orphan").count()) === 0 && (await $("#nhis-recon-groups table").count()) === 2, "summary 10 명세서 · 조정 105,900 · 33 lines · 2 group tables");
  const reasonsN = await $("#nhis-recon-groups .recon-group:first-child tbody tr td:first-child").allInnerTexts();
  ok(reasonsN.length === 3 && reasonsN.includes("처방·시행 일수 초과") && reasonsN.includes("서류 미비 (자료 보완 미회신)"), `건보 reason classes: ${reasonsN.join(" · ")}`);
  ok((await $("#tab-nhis select").count()) === 0, "no 보험사 select in the 건보 panel");
  const pidsN = await $("#nhis-recon-result tbody tr td:nth-child(2)").allInnerTexts();
  ok(pidsN.every(p => /^환자 \*\*\*\*\d{4}$/.test(p)) && new Set(pidsN).size === 3, `patient column shows aliases only (${[...new Set(pidsN)].join(", ")})`);
  const cutRowsN = await page.evaluate(() => Array.from(document.querySelectorAll("#nhis-recon-result tbody tr")).filter(tr => tr.children[7].textContent.trim().startsWith("−")).map(tr => `${tr.children[0].textContent.trim()}/${tr.children[3].textContent.trim()}:${tr.querySelector('[data-act^="appeal"]')?.textContent.trim()}`));
  ok(cutRowsN.length === 3 && cutRowsN.includes("N2608-0005/예시-16:이의신청 · 준비중") && cutRowsN.includes("N2608-0007/예시-03:이의신청 · 결과") && cutRowsN.includes("N2608-0002/예시-11:이의신청 준비"), `cut rows carry the appeal action state (${cutRowsN.join(" · ")})`);
  const nextN = (await $("#nhis-next").innerText()).replace(/\s+/g, " ");
  ok(/조정 줄 3/.test(nextN) && /이의신청 2/.test(nextN) && /기한 초과 1/.test(nextN), `next-step card: 3 cuts · 2 appeals · 1 overdue`);
  const nhisHist = await M(({ CS }) => CS.nhisHistory());
  ok(nhisHist.length === 1 && nhisHist[0].kind === "recon" && nhisHist[0].payer === "nhis" && nhisHist[0].stmts === 10 && nhisHist[0].cut === 105900 && nhisHist[0].byReason.some(g => g.key === "days_exceeded" && g.cut === 78000) && !("pid" in nhisHist[0]), `nhis.history entry (payer nhis, no pid) byReason ${nhisHist[0]?.byReason?.map(g => g.key).join(",")}`);
  const nhisDl = await download(() => $("#nhis-recon-download").click());
  ok(/_PoC\.xlsx$/.test(nhisDl.name) && /건보/.test(nhisDl.name), `건보 대조표 xlsx watermarked (${nhisDl.name})`);
  if (MOBILE) await noOverflow("건보 심사결과 대조");

  at("P3 대조 row → 이의신청 준비 → appeal with the line's facts; idempotent per line; status transitions · 통보일 → 기한(+90) · result");
  await clickRowBtn("#nhis-recon-result", "N2608-0002", 'button[data-act="appeal"]');
  await page.waitForSelector("#tab-appeal.active");
  await page.waitForSelector("#appeal-list tr.appeal-edit");
  const created = await M(({ CS }) => CS.Appeals.list().find(a => a.stmt === "N2608-0002"));
  ok(created && created.payer === "nhis" && created.code === "예시-11" && created.reasonKey === "docs_missing" && created.cutAmount === 19400 && created.approved === 0 && created.pid === "P-2026-0233" && created.month === "2026-08" && created.status === "prep" && created.dx.includes("M54.5") && created.batchId, `appeal facts: ${JSON.stringify({ payer: created.payer, code: created.code, reasonKey: created.reasonKey, cut: created.cutAmount, dx: created.dx })}`);
  ok((await $(`#appeal-list tr.appeal-edit[data-id="${created.id}"]`).count()) === 1 && (await $("#appeal-list tr.appeal-row").count()) === 4 && /N2608-0002/.test(await $("#appeal-status").innerText()), "drawer opened on the new appeal; register lists 4; status line names it");
  ok(!/P-2026-0233/.test(await $("#appeal-list").innerText()) && /환자 \*\*\*\*0233/.test(await $("#appeal-list").innerText()), "register shows the alias, never the raw 환자번호");
  await goTab("tab-nhis");
  ok((await page.evaluate(() => Array.from(document.querySelectorAll("#nhis-recon-result tbody tr")).find(tr => tr.children[0].textContent.trim() === "N2608-0002" && tr.children[3].textContent.trim() === "예시-11")?.querySelector('[data-act="appeal-open"]')?.textContent.trim())) === "이의신청 · 준비중", "the 대조 row flipped to '이의신청 · 준비중'");
  await clickRowBtn("#nhis-recon-result", "N2608-0002", 'button[data-act="appeal-open"]');
  await page.waitForSelector("#tab-appeal.active");
  ok((await M(({ CS }) => CS.Appeals.list().length)) === 4, "opening the existing appeal does not duplicate it");
  const drawer = `#appeal-list tr.appeal-edit[data-id="${created.id}"]`;
  await page.waitForSelector(drawer);
  await $(`${drawer} [data-f="noticeDate"]`).fill(todayISO());
  await $(`${drawer} [data-f="noticeDate"]`).dispatchEvent("change");
  await page.waitForFunction((id) => document.querySelector(`#appeal-list tr.appeal-edit[data-id="${id}"] [data-f="dueDate"]`)?.value, created.id);
  let a1 = await M(({ CS }) => CS.Appeals.list().find(a => a.stmt === "N2608-0002"));
  ok(a1.noticeDate === todayISO() && a1.dueDate === plusDays(todayISO(), 90) && (await $(`${drawer.replace(".appeal-edit", ".appeal-row")} .pill.dday`).innerText()) === "D-90", `통보일 → 기한 +90d (${a1.dueDate}), row badge D-90`);
  await $(`${drawer} [data-status="submitted"]`).click();
  await page.waitForFunction((id) => document.querySelector(`#appeal-list .appeal-group[data-status="submitted"] tr.appeal-row[data-id="${id}"]`), created.id);
  a1 = await M(({ CS }) => CS.Appeals.list().find(a => a.stmt === "N2608-0002"));
  ok(a1.status === "submitted" && a1.submittedDate === todayISO(), `준비중 → 제출 (제출일 ${a1.submittedDate})`);
  await $(`${drawer} [data-status="result"]`).click();
  await page.waitForFunction((id) => document.querySelector(`#appeal-list .appeal-group[data-status="result"] tr.appeal-row[data-id="${id}"]`), created.id);
  await $(`${drawer} [data-f="result"]`).selectOption("partial");
  await page.waitForFunction((id) => document.querySelector(`#appeal-list tr.appeal-edit[data-id="${id}"] [data-f="result"]`)?.value === "partial", created.id);
  await $(`${drawer} [data-f="resultAmount"]`).fill("9700"); await $(`${drawer} [data-f="resultAmount"]`).dispatchEvent("change");
  await wait(150);
  a1 = await M(({ CS }) => CS.Appeals.list().find(a => a.stmt === "N2608-0002"));
  ok(a1.status === "result" && a1.result === "partial" && a1.resultDate === todayISO() && a1.resultAmount === 9700 && (await $(`${drawer.replace(".appeal-edit", ".appeal-row")} .pill`).first().innerText()) === "일부인정", `제출 → 결과 일부인정 · 결과금액 9,700`);
  await $(`${drawer} [data-status="prep"]`).click();
  await page.waitForFunction((id) => document.querySelector(`#appeal-list .appeal-group[data-status="prep"] tr.appeal-row[data-id="${id}"]`), created.id);
  a1 = await M(({ CS }) => CS.Appeals.list().find(a => a.stmt === "N2608-0002"));
  ok(a1.status === "prep" && a1.result === null, "back to 준비중 clears the result");
  const dlNow = await M(({ AP }) => AP.appealDeadlines().map(d => d.daysLeft));
  ok(dlNow.length === 3 && dlNow[0] === -10 && dlNow.includes(90), `appealDeadlines() now 3 open items (${dlNow.join(",")})`);

  at("P3 이의신청 — overdue badge · filters · summary · export · 초안 · hand-offs (대조로 보기 · 상병 정비 · AI · 자보 row)");
  const overdue = await M(({ CS }) => CS.Appeals.list().find(a => a.stmt === "N2608-0005"));
  const ovRow = `#appeal-list tr.appeal-row[data-id="${overdue.id}"]`;
  ok((await $(`${ovRow} .pill.err.dday.over`).count()) === 1 && (await $(`${ovRow} .pill.dday`).innerText()) === "D+10 초과" && /기한 초과 1/.test(await $('#appeal-list .appeal-group[data-status="prep"] h5').innerText()), "seeded overdue appeal: red D+10 초과 badge, 준비중 header counts it");
  const sum3 = (await $("#appeal-summary").innerText()).replace(/\s+/g, " ");
  ok(/이의신청 4건/.test(sum3) && /기한 초과 1/.test(sum3) && /회수 4,250원/.test(sum3), `summary strip (${sum3.slice(0, 120)})`);
  await $("#appeal-f-status").selectOption("overdue");
  await page.waitForFunction(() => document.querySelectorAll("#appeal-list tr.appeal-row").length === 1);
  ok((await $("#appeal-list tr.appeal-row td:nth-child(4)").innerText()) === "N2608-0005", "status filter 기한 초과 → only the overdue one");
  await $("#appeal-f-status").selectOption("all"); await $("#appeal-f-payer").selectOption("auto");
  await page.waitForFunction(() => document.querySelectorAll("#appeal-list tr.appeal-row").length === 1);
  ok((await $("#appeal-list tr.appeal-row td:nth-child(4)").innerText()) === "M2608-0010" && (await $("#appeal-candidates tbody tr").count()) === 7, "payer filter 자보 → the submitted 자보 appeal · 7 adjusted 자보 lines without an appeal as candidates");
  await $("#appeal-f-payer").selectOption("all");
  await page.waitForFunction(() => document.querySelectorAll("#appeal-list tr.appeal-row").length === 4);
  const exp3 = await download(() => $("#appeal-export").click());
  ok(/^이의신청_대장_\d{4}-\d{2}-\d{2}_PoC\.xlsx$/.test(exp3.name), `이의신청 대장 xlsx watermarked (${exp3.name})`);
  await openAppealRow(created.id);
  await page.waitForSelector(drawer);
  await $(`${drawer} [data-act="draft"]`).click();
  await page.waitForSelector("#appeal-draft pre.appeal-draft-text");
  const draft3 = await $("#appeal-draft pre").innerText();
  ok(/이의신청서 \(초안\)/.test(draft3) && /PoC — 실제 제출 불가/.test(draft3) && /양식은 심평원 서식 기준 — 확인 필요/.test(draft3) && /N2608-0002/.test(draft3) && /환자 \*\*\*\*0233/.test(draft3) && !/P-2026-0233/.test(draft3) && /19,400원/.test(draft3) && /서류 미비/.test(draft3) && /한솔한방병원/.test(draft3) && /통보일 \+ 90일 — 확인 필요/.test(draft3), "draft: title · PoC · 서식 확인 필요 · facts (stmt · alias · cut · reason · org · +90d)");
  await $(`${drawer} [data-f="att-records"]`).check();
  await page.waitForFunction(() => /\[x\] 진료기록 사본/.test(document.querySelector("#appeal-draft pre")?.textContent || ""));
  ok(!(await $("#appeal-draft-print").isDisabled()), "attachment checkbox → draft re-rendered with [x]; print enabled");
  await page.evaluate((id) => document.querySelector(`#appeal-list tr.appeal-edit[data-id="${id}"] [data-act="recon"]`).click(), created.id);
  await page.waitForSelector("#tab-nhis.active");
  ok((await $('#nhis-recon-result tr.focus[data-stmt="N2608-0002"]').count()) === 4, "대조로 보기 → 건보 대조 with the 명세서's 4 lines highlighted");
  await goTab("tab-appeal");
  await openAppealRow(created.id); await page.waitForSelector(drawer);
  await page.evaluate((id) => document.querySelector(`#appeal-list tr.appeal-edit[data-id="${id}"] [data-act="kcd"]`).click(), created.id);
  await page.waitForSelector("#tab-kcd.active");
  await page.waitForFunction(() => !document.querySelector("#kcd-filter")?.hidden);
  ok(/N2608-0002/.test(await $("#kcd-filter").innerText()) && (await $("#kcd-result tbody tr").count()) === 2, "상병 정비 switched to the 건보 batch (ctx batchId) focused on N2608-0002");
  ok((await M(({ CS }) => [CS.currentClaimsBatch()?.meta?.payer, CS.currentClaimsBatch("auto")?.meta?.sample])).join("|") === "nhis|hansol-2026-08", "global current is now the 건보 batch; the 자보 current is untouched");
  await goTab("tab-jabo");
  ok((await $("#jabo-recon-result tbody tr").count()) === 42, "자보 대조 unaffected by the global switch (payer-scoped)");
  await goTab("tab-appeal");
  await openAppealRow(created.id); await page.waitForSelector(drawer);
  await page.evaluate((id) => document.querySelector(`#appeal-list tr.appeal-edit[data-id="${id}"] [data-act="ai"]`).click(), created.id);
  await page.waitForSelector("#ai-drawer.open");
  const aiVal = await $("#ai-input").inputValue();
  ok(/N2608-0002/.test(aiVal) && /환자 \*\*\*\*0233/.test(aiVal) && /서류 미비/.test(aiVal) && /19,400원/.test(aiVal), `AI drawer prefilled with the cut facts`);
  await $("#ai-drawer-close").click(); await closed("#ai-drawer");
  await goTab("tab-jabo");
  await clickRowBtn("#jabo-recon-result", "M2608-0001", 'button[data-act="appeal"]');
  await page.waitForSelector("#tab-appeal.active");
  const autoAp = await M(({ CS }) => CS.Appeals.list().find(a => a.stmt === "M2608-0001"));
  ok(autoAp && autoAp.payer === "auto" && autoAp.code === "예시-13" && autoAp.reasonKey === "site_mismatch" && autoAp.cutAmount === 12600 && autoAp.insurer === "삼성" && autoAp.pid === "P-2026-0142" && /삼성화재/.test(await $(`#appeal-list tr.appeal-edit[data-id="${autoAp.id}"]`).innerText()), `자보 row → appeal with insurer 삼성 (drawer shows 삼성화재)`);
  await page.evaluate((id) => document.querySelector(`#appeal-list tr.appeal-edit[data-id="${id}"] [data-act="recon"]`).click(), autoAp.id);
  await page.waitForSelector("#tab-jabo.active");
  ok((await $('#jabo-recon-result tr.focus[data-stmt="M2608-0001"]').count()) === 5, "대조로 보기 → 자보 대조 with M2608-0001 highlighted (5 lines)");
  const st2 = await M(({ CL }) => CL.claimsStepsByPayer());
  ok(st2.auto[2].state === "todo" && /진행 중 2건/.test(st2.auto[2].detail) && st2.nhis[2].state === "need", `landing derives the new states — 자보 appeal todo (2 open) · 건보 need (${st2.auto[2].detail})`);
  await M(({ CS, activateTab }) => activateTab("tab-appeal", { filter: { payer: "nhis", month: "2026-08", status: "result" } }));
  await page.waitForFunction(() => document.querySelectorAll("#appeal-list tr.appeal-row").length === 1);
  ok((await $("#appeal-f-payer").inputValue()) === "nhis" && (await $("#appeal-list tr.appeal-row td:nth-child(4)").innerText()) === "N2608-0007", "ctx { filter } sets the selects and filters the list");
  await $("#appeal-f-status").selectOption("all"); await $("#appeal-f-payer").selectOption("all"); await $("#appeal-f-month").selectOption("all");

  /* ── 홈 numbers ── */
  at("P3 홈 — KPI tiles follow the trackers (appeals · guarantees · consents); month selector; 원장 보고용 요약 with the PoC line, no names");
  await goTab("tab-today");
  const st3 = await M(({ CS, P }) => ({ ap: CS.appealStats(), gd: P.guaranteeDeadlines().map(d => d.state) }));
  const k3 = { appeal: await g("#ins-appeal"), appealSub: await g("#ins-appeal-sub"), guar: await g("#ins-guar"), guarSub: await g("#ins-guar-sub"), arSub: await g("#ins-ar-sub"), nonpaySub: await g("#ins-nonpay-sub") };
  ok(st3.ap.open === 3 && st3.ap.submitted === 1 && st3.ap.overdue === 1 && /^4 건/.test(k3.appeal) && /지연 1건 · 회수 4,250원/.test(k3.appealSub), `이의신청 tile = ${k3.appeal} (open 3 + submitted 1) · ${k3.appealSub}`);
  ok(k3.arSub.includes(`이의신청 ${st3.ap.appealed.toLocaleString("ko-KR")}원`), `미수금 subtracts the open appeals' cut (${k3.arSub})`);
  ok(st3.gd.filter(s => s === "expiring").length === 2 && st3.gd.filter(s => s === "expired").length === 1 && /^2 건/.test(k3.guar) && /이미 만료 1건/.test(k3.guarSub), `지불보증 tile: 2 expiring · 1 expired (${k3.guar} · ${k3.guarSub})`);
  ok(/동의 2건 · 16개 항목 · 2026-08/.test(k3.nonpaySub), `비급여 매출 stays on the August consents (the new one is this month) (${k3.nonpaySub})`);
  await ent(page, (E, S, Store) => { const h = Store.get("jabo.history", []) || []; const recon = h.find(x => x.kind === "recon"); h.unshift({ ...recon, at: Date.now(), payer: "auto", claimed: 500000, paid: 450000, cut: 50000, month: "2026-07", byReason: [], sim: true }); Store.set("jabo.history", h); });
  await wait(200);
  ok((await page.evaluate(() => [...document.querySelectorAll("#kpi-month option")].map(o => o.value).join(","))) === "2026-08,2026-07", "months with data listed newest first");
  await $("#kpi-month").selectOption("2026-07"); await wait(100);
  ok(/500,000원 → 인정 450,000원 · 2026-07/.test(await g("#ins-jabo-sub")) && /^— 건/.test(await g("#ins-nhis")), "month 2026-07 selected → 자보 500,000 / 건보 empty");
  await $("#kpi-month").selectOption("2026-08");
  await ent(page, (E, S, Store) => Store.set("jabo.history", (Store.get("jabo.history", []) || []).filter(x => !x.sim)));
  await wait(150);
  await $("#kpi-summary-copy").click(); await wait(200);
  const sumTxt = await page.evaluate(() => { const o = document.querySelector("#kpi-summary-out"); return { hidden: o.hidden, text: o.textContent }; });
  ok(!sumTxt.hidden && /\[한솔한방병원\] 2026-08/.test(sumTxt.text) && /자보: 2건/.test(sumTxt.text) && /건보: 1건/.test(sumTxt.text) && /이의신청: 진행 3건 · 제출 1건 · 지연 1건 · 회수 4,250원/.test(sumTxt.text) && /지불보증 만료 임박\(7일\): 2건 · 이미 만료 1건/.test(sumTxt.text) && /파기 대장 0건/.test(sumTxt.text), "summary: org + month + both payers + appeals + guarantees + 보존 line");
  ok(/PoC — 실제 제출 불가 · 데모 데이터/.test(sumTxt.text) && !ALL_NAMES.some(n => sumTxt.text.includes(n)) && !/홍 원장/.test(sumTxt.text), "summary ends with the PoC line and carries no person name (not even the 대표자)");
  ok(await page.evaluate(() => /요약 복사/.test(document.querySelector("#act-feed")?.textContent || "")), "summary copy logged");

  /* ── 보고·기록 ── */
  at("P3 보고·기록 › 보존 — 6 파기 대상 → 파기 대장 (encrypted retention.disposals · XLSX _PoC · ledger · retentionStats)");
  await goTab("tab-retention");
  const disp = await page.evaluate(() => ({ count: document.querySelector("#ret-dispose-count")?.innerText, pending: document.querySelectorAll("#ret-dispose tbody tr:not(.disposed)").length, btn: document.querySelector("#ret-dispose-btn")?.disabled, officer: document.querySelector(".ret-dispose-officer")?.innerText, approvers: document.querySelectorAll("#ret-dispose-approver option").length, ids: [...document.querySelectorAll("#ret-dispose tbody tr td:first-child")].map(td => td.innerText) }));
  ok(disp.count === "6" && disp.pending === 6 && disp.btn === false && disp.ids.every(id => /^\*+-\*+-\d{4}$/.test(id)) && /홍 원장/.test(disp.officer) && disp.approvers >= 2, `6 expired rows as disposal candidates, ids pseudonymised (${disp.ids[0]}), officer = login, ${disp.approvers} approvers`);
  await $("#ret-dispose-method").selectOption("erase");
  const ledger = await download(() => $("#ret-dispose-btn").click());
  ok(/파기대장_.*_PoC\.xlsx$/.test(ledger.name) && ledger.buf && ledger.buf.length > 2000, `파기 대장 XLSX downloaded (${ledger.name})`);
  const stored3 = await M(({ Store, ret, life }) => { const rows = Store.get("retention.disposals", []); const raw = JSON.parse(localStorage.getItem("vibe.clinic-admin.retention.disposals") || "null"); return { n: rows.length, sample: rows[0], envelope: !!(raw && raw.ct && raw.iv), stats: ret.retentionStats(), reg: life.REGISTRY.filter(r => r.id === "retention.disposals" || r.id === "tariff.history").map(r => [r.id, r.encrypted]) }; });
  ok(stored3.n === 6 && stored3.sample.method === "erase" && stored3.sample.staffName === "홍 원장" && stored3.sample.approverName && stored3.envelope, `retention.disposals: 6 rows · erase · officer snapshot · approver ${stored3.sample.approverName} · AES-GCM envelope on disk`);
  ok(stored3.stats.disposals === 6 && stored3.stats.lastDisposalAt && stored3.reg.length === 2 && stored3.reg.find(r => r[0] === "retention.disposals")[1] === true && stored3.reg.find(r => r[0] === "tariff.history")[1] === false, `retentionStats() + registerRows({ key }) rows (${stored3.reg.map(r => r.join(":")).join(", ")})`);
  await wait(600);
  const after3 = await page.evaluate(() => ({ pending: document.querySelectorAll("#ret-dispose tbody tr:not(.disposed)").length, ledgerRows: document.querySelectorAll("#ret-ledger tbody tr").length, status: document.querySelector("#ret-status")?.innerText }));
  ok(after3.pending === 0 && after3.ledgerRows === 6 && /파기 대장 6건/.test(after3.status), `after: 0 pending, ledger table 6 rows`);
  if (MOBILE) await noOverflow("보존 (파기 대장)");

  at("P3 보고·기록 › 비급여 — tariff history from the seed prefill, a price edit appends a row, website CSV + history CSV _PoC");
  await goTab("tab-bigeup");
  const h0 = await page.evaluate(() => ({ count: +document.querySelector("#bg-history-count").innerText, first: document.querySelector("#bg-history tbody tr")?.innerText || "" }));
  ok(h0.count === 1 && /28/.test(h0.first), `seed prefill → one history entry with 28 changes`);
  const firstMin = $("#bg-tbody tr:first-child .bg-min");
  await firstMin.fill("9999"); await firstMin.dispatchEvent("input");
  await wait(700);
  const h1 = await page.evaluate(() => ({ count: +document.querySelector("#bg-history-count").innerText, stored: JSON.parse(localStorage.getItem("vibe.clinic-admin.tariff.history") || "[]") }));
  ok(h1.count === 2 && h1.stored[0].changes.length === 1 && h1.stored[0].changes[0].code === "예시-01" && String(h1.stored[0].changes[0].to.min) === "9999" && h1.stored[0].staffId && !("staffName" in h1.stored[0]), "price edit → history row (예시-01 → 9999) · staffId only, plaintext key");
  const web = await download(() => $("#bg-web-csv").click());
  const webLines = web.text.trim().split("\n");
  ok(/홈페이지_고지_.*_PoC\.csv$/.test(web.name) && /항목,분류,단위,가격\(원\),적용일/.test(webLines[0]) && /PoC/.test(webLines[1]) && webLines.length === 2 + 28, `website CSV: header + watermark + 28 rows (${web.name})`);
  const histDl = await download(() => $("#bg-history-csv").click());
  ok(/변경이력_.*_PoC\.csv$/.test(histDl.name) && histDl.text.split("\n").length >= 30, `history CSV (${histDl.name})`);

  at("P3 보고·기록 › 연말정산 — pid lookup finds ****0142; hand-off → 환자 › 발급 대장 editor prefilled (영수증 재발급)");
  await goTab("tab-yearend");
  ok((await $("#ye-lookup-list option").count()) === 5, "datalist offers the 5 pseudonymous patients");
  await $("#ye-lookup-pid").fill("P-2026-0142"); await $("#ye-lookup-btn").click();
  const lk = await page.evaluate(() => { const c = document.querySelector("#ye-lookup-out .ye-lookup-card"); return { cls: c?.className, text: c?.innerText, ctx: document.querySelector("#ye-lookup-docs")?.dataset.ctx }; });
  ok(/found/.test(lk.cls) && /\*\*\*\*0142/.test(lk.text) && !/P-2026-0142/.test(lk.text) && /포함/.test(lk.text) && !/\d{6}-\d/.test(lk.text), `found card shows the alias only`);
  const ctxJ = JSON.parse(lk.ctx);
  ok(ctxJ.pid === "P-2026-0142" && ctxJ.create === true && ctxJ.docType === "영수증 재발급", `hand-off ctx ${lk.ctx}`);
  await $("#ye-lookup-docs").click();
  await page.waitForSelector("#tab-docs.active");
  await page.waitForSelector("#tab-docs [data-editor]:not([hidden])");
  ok((await $('#tab-docs [data-editor] [data-e="pid"]').inputValue()) === "P-2026-0142" && (await $('#tab-docs [data-editor] [data-e="docType"]').inputValue()) === "영수증 재발급" && (await ent(page, (E) => E.Patients.get("P-2026-0142")?.tags.includes("연말정산"))), "→ 발급 대장 editor prefilled with pid + 영수증 재발급; patient tagged 연말정산");
  await $("#tab-docs [data-editor] [data-cancel]").click();
  await goTab("tab-yearend");
  await $("#ye-lookup-pid").fill("P-2026-9999"); await $("#ye-lookup-btn").click();
  ok(/missing/.test(await page.evaluate(() => document.querySelector("#ye-lookup-out .ye-lookup-card")?.className)) && /가명 환자 대장에 없음/.test(await $("#ye-lookup-out").innerText()), "unknown pid → missing card + unknown-pid pill");

  /* ── 조직 ── */
  at("P3 조직 › 인증 자체점검 — mr3 turns ✓ from the 파기 대장 (disposal-review evidence)");
  await goTab("tab-accred");
  const mr3 = await page.evaluate(() => { const el = document.querySelector('.accred-item[data-id="mr3"] .accred-auto'); return { cls: el.className, txt: el.textContent.replace(/\s+/g, " ").trim() }; });
  ok(/\bok\b/.test(mr3.cls) && /파기 대장 6건/.test(mr3.txt), `mr3 ✓ — ${mr3.txt}`);
  await goTab("tab-today");
  ok(/파기 대장 6건/.test(await $("#ins-ret-sub").innerText()), "홈 retention tile sub line counts the ledger");

  at("IA chrome — area switching remembers the last panel, breadcrumb, `[` `]` cycle, digit keys jump areas");
  await goTab("tab-license"); await goTab("tab-jabo");
  await (MOBILE ? $('#bottombar .area-btn[data-area="org"]') : $('#rail-areas .area-btn[data-area="org"]')).click();
  await page.waitForSelector("#tab-license.active");
  ok((await $("#crumb-section").innerText()) === "조직" && (await $("#crumb-tab").innerText()) === "직원 명부", "area 조직 → returns to its last-visited panel (직원 명부)");
  await (MOBILE ? $('#bottombar .area-btn[data-area="claims"]') : $('#rail-areas .area-btn[data-area="claims"]')).click();
  await page.waitForSelector("#tab-jabo.active");
  ok(await page.evaluate(() => document.body.dataset.area === "claims" && document.querySelector('#rail-areas .area-panels[data-area="claims"]').classList.contains("active") && !document.querySelector('#rail-areas .area-panels[data-area="org"]').classList.contains("active")), "area 청구 → last panel (심사결과 대조); only the active area's panel list is expanded");
  await (MOBILE ? $('#bottombar .area-btn[data-area="patients"]') : $('#rail-areas .area-btn[data-area="patients"]')).click();
  await page.waitForSelector("#tab-docs.active"); // the Phase-3 block left 환자 on 서류 발급 대장 (yearend hand-off)
  ok((await $("#crumb-section").innerText()) === "환자" && (await $("#crumb-tab").innerText()) === "서류 발급 대장", "area 환자 → its last-visited panel (서류 발급 대장 from the yearend hand-off)");
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("3"); await page.waitForSelector("#tab-jabo.active");
  await page.keyboard.press("]"); await page.waitForSelector("#tab-nhis.active");
  await page.keyboard.press("]"); await page.waitForSelector("#tab-appeal.active");
  await page.keyboard.press("["); await page.waitForSelector("#tab-nhis.active");
  await page.keyboard.press("1"); await page.waitForSelector("#tab-today.active");
  ok(true, "keys: 3 → 청구 (last panel), ] ] [ cycle within the area, 1 → 홈");
  await goTab("tab-jabo"); await $("#jabo-pid").fill("P-2026-0142"); await $("#jabo-pid").press("]"); await $("#jabo-pid").press("5");
  ok((await $("#tab-jabo.active").count()) === 1 && (await $("#jabo-pid").inputValue()) === "P-2026-0142]5", "shortcuts are inert while typing in an input");
  await $("#jabo-pid").fill("P-2026-0142");
  if (MOBILE) {
    ok(await page.evaluate(() => { const b = document.querySelector("#bottombar"); return b && getComputedStyle(b).display !== "none" && b.querySelectorAll(".area-btn").length === 5 && getComputedStyle(document.querySelector("#rail")).transform !== "none"; }), "phone: bottom bar with 5 areas + ⋯; the rail is off-screen (⋯ sheet)");
    ok(await page.evaluate(() => { const s = document.querySelector("#subnav"); return s && !s.hidden && s.querySelectorAll(".subnav-btn").length === 5 && s.querySelector(".subnav-btn.active")?.dataset.panel === "tab-jabo"; }), "phone: sub-nav segmented control lists the 5 청구 panels with the active one marked");
    await goTab("tab-today");
    ok(await page.evaluate(() => document.querySelector("#subnav").hidden), "phone: sub-nav hidden for a single-panel area (홈)");
    await $("#bottombar-more").click(); await wait(350);
    const sheet = await page.evaluate(() => ({ open: document.body.classList.contains("more-open"), lang: document.querySelector(".rail-foot .lang-toggle").offsetHeight > 0, visible: [...document.querySelectorAll(".rail-foot .rail-btn")].filter(b => b.offsetHeight > 0).map(b => b.id), areasHidden: document.querySelector("#rail-areas").offsetHeight === 0 }));
    ok(sheet.open && sheet.lang && sheet.areasHidden && sheet.visible.join(",") === RAIL_FOOT.filter(id => id !== "rail-install" || sheet.visible.includes("rail-install")).join(","), `phone: ⋯ sheet = KO|EN + ${sheet.visible.join(" · ")} (the rail foot, nothing else)`);
    await noKeys("⋯ sheet", "#rail");
    await noOverflow("⋯ sheet");
    await $("#more-scrim").click({ position: { x: 20, y: 20 } }); await page.waitForFunction(() => !document.body.classList.contains("more-open")); // tap above the sheet
  } else {
    ok(await page.evaluate(() => getComputedStyle(document.querySelector("#bottombar")).display === "none" && getComputedStyle(document.querySelector("#subnav")).display === "none"), "desktop: no bottom bar / sub-nav");
  }

  at("환자 › 접수 보드 — pid picker over Patients, alias labels, no names");
  await goTab("tab-board");
  ok((await $("#crumb-section").innerText()) === "환자" && (await $("#tab-board .panel-num").innerText()).includes("환자"), "board panel sits under 환자");
  const opts = await page.evaluate(() => Array.from(document.querySelectorAll("#intake-name option")).map(o => [o.value, o.textContent]));
  ok(opts.length === 6 && opts.some(([v, l]) => v === "P-2026-0142" && l.includes("****0142") && l.includes("자보")) && opts.at(-1)[0] === "__new", `picker: ${opts.length} options (5 patients + 새 가명 환자)`);
  await $("#intake-name").selectOption("P-2026-0418"); await $("#intake-summary").fill("경추 통증 · 자보 접수");
  await $("#intake-add-btn").click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("#intake-col-대기 .intake-card .pc-name")).some(n => n.textContent.includes("****0418")));
  const boardText = await page.evaluate(() => document.querySelector(".intake-board")?.innerText || document.querySelector("#tab-today").innerText);
  ok(/환자 \*\*\*\*0142/.test(boardText) && !ALL_NAMES.some(n => boardText.includes(n)), "board cards are labelled with Patients.alias(), no names anywhere");
  await $("#intake-name").selectOption("__new"); await $("#intake-add-btn").click();
  await page.waitForFunction(() => document.querySelectorAll("#intake-name option").length === 7);
  ok(true, "새 가명 환자 → a fresh P-YYYY-NNNN registered (picker now 7 options)");
  await page.waitForFunction(() => Array.from(document.querySelectorAll("#intake-col-대기 .intake-card")).some(c => !/0142|0233|0301|0418|0509/.test(c.querySelector(".pc-name span").textContent)), null, { timeout: 20000 }); // live board: the card comes back through realtime
  const newMenu = await page.evaluate(() => { const cards = Array.from(document.querySelectorAll("#intake-col-대기 .intake-card")); const c = cards.find(c => !/0142|0233|0301|0418|0509/.test(c.querySelector(".pc-name span").textContent)); return c ? Array.from(c.querySelectorAll(".pc-menu [data-menu]")).map(b => b.dataset.menu).join(",") : null; });
  ok(newMenu === "docs,consent,ai", `the untagged new pid's card ⋯ menu has no 지불보증 (자보-only rule): ${newMenu}`);
  ok(await page.evaluate(() => window.__intake.online) && /실시간 동기화 중/.test(await $("#intake-sync-text").innerText()), "board is LIVE against the local PocketBase (authenticated client)");
  const srvCards = await (await fetch(PB_LOCAL + "/api/collections/intake_card/records")).json();
  ok(srvCards.totalItems === 0 && srvCards.items.length === 0, "unauthenticated intake_card list → empty (rule @request.auth.id != \"\")");
  const srvCardsAuthed = await page.evaluate(async () => { const { Cloud } = await import("./js/security/cloud.js"); const c = await Cloud.getPB(); const rows = await c.collection("intake_card").getFullList(); return { n: rows.length, ws: rows.map(r => r.ws).filter(Boolean).length, plain: rows.some(r => JSON.stringify(r.payload).includes("P-2026") || JSON.stringify(r).includes("경추 통증")) }; });
  ok(srvCardsAuthed.n === 5 && srvCardsAuthed.ws === 0 && !srvCardsAuthed.plain, `authenticated list → ${srvCardsAuthed.n} cards (3 seed + 2 added), no ws hash written, payloads are ciphertext`);
  if (MOBILE) { await noOverflow("shell (board)"); await goTab("tab-today"); await noOverflow("shell (home)"); }

  /* 5b · SHARED IDENTITY — a second device ("phone", fresh profile) */
  at("cloud: second browser context → dropdown lists the server users, login 한지우/000000, same board in realtime both ways");
  const ctxP = await newCtx({ ...VIEW, locale: "ko-KR" });
  const pP = await ctxP.newPage(); watch(pP, "[phone] "); await blockAll(pP);
  const $P = (sel) => pP.locator(sel);
  await pP.goto(BASE, { waitUntil: "domcontentloaded" });
  await pP.waitForSelector("#lock-unlock:not([hidden])", { timeout: 20000 });
  const optsP = await pP.evaluate(() => Array.from(document.querySelectorAll("#lock-user option")).map(o => o.textContent));
  ok(optsP.length === 5 && optsP.some(o => o.startsWith("한지우") && /원무/.test(o)) && optsP.some(o => o.startsWith("홍 원장")) && optsP.some(o => o.startsWith("행정 김")), `phone (fresh profile): dropdown lists the ${optsP.length} server users before any login (${optsP.join(" | ")})`);
  ok((await $P("#lock-clinic").innerText()).includes(ORG.name) && (await $P("#lock-setup").isHidden()), "phone: clinic name shown, no bootstrap pane (instance exists)");
  await noKeys("phone lock screen", "#lock-scrim", pP);
  if (MOBILE) await noOverflow("phone lock screen", pP);
  await unlockAs("한지우", "999999", pP);
  await pP.waitForFunction(() => { const e = document.querySelector("#lock-err"); return e && !e.hidden && /초 후/.test(e.textContent); });
  ok(await $P("#lock-submit").isDisabled() && /PIN이 틀렸습니다/.test(await $P("#lock-err").innerText()), "phone: wrong PIN → server 400 → local backoff countdown (submit disabled)");
  await pP.waitForFunction(() => !document.querySelector("#lock-submit").disabled, null, { timeout: 5000 });
  await unlockAs("한지우", SEED_PIN, pP);
  await pP.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok((await $P("#topbar-user-text").innerText()).includes("한지우"), "phone: unlocked as 한지우 · 원무 with the seeded PIN");
  await dismissWelcome(pP);

  /* ── ENTITY SYNC (step B): the fresh device receives the whole clinic ── */
  at("sync: fresh device receives the whole clinic (registry keys minus LOCAL_ONLY) within 5 s · roster · KPIs · counts identical");
  await settled(page).catch(() => {});
  const tSync0 = Date.now();
  let dA = await digest(page), dB = await digest(pP);
  while (dB.hash !== dA.hash && Date.now() - tSync0 < 5000) { await pP.waitForTimeout(250); dA = await digest(page); dB = await digest(pP); }
  const onlyA = dA.keys.filter(k => !dB.keys.includes(k)), onlyB = dB.keys.filter(k => !dA.keys.includes(k));
  ok(dB.hash === dA.hash && dA.keys.length >= 20, `digest of ${dA.keys.length} syncable keys identical on both devices after ${Date.now() - tSync0} ms (A-only: ${onlyA.join(",") || "none"} · B-only: ${onlyB.join(",") || "none"})`);
  ok(dA.keys.every(k => !NO_SYNC_RE.test(k)) && ["staff.list", "patients.register", "org.profile", "tariff.items", "appeals.list", "guarantee.list", "docs.list", "consent.list", "nhis.history", "jabo.history", "retention.disposals", "accred.checked", "kcd.lastSummary", "retention.lastAudit", "insurers.lastUsed"].every(k => dA.keys.includes(k)) && dA.keys.some(k => k.startsWith("claims.batch.")), `synced key set covers every entity + tracker + setting (${dA.keys.length} keys), none device-local`);
  await settled(pP).catch(() => {}); // its own unlock audit entry is unioned into `activity` and pushed right after the pull
  const stB = await syncState(pP);
  ok(stB.enabled && stB.online && stB.pending === 0 && stB.conflicts === 0 && stB.serverKeys >= 20 && stB.lastOkAt > 0 && stB.undecryptable === 0, `phone Sync.state(): online · 0 pending · 0 conflicts · ${stB.serverKeys} server keys · 0 undecryptable (${JSON.stringify(stB)})`);
  ok(/동기화됨 \d{2}:\d{2}/.test(await $P("#sync-msg").innerText()), `phone topbar chip: "${await $P("#sync-msg").innerText()}"`);
  const rosterA = await $("#lic-list .lic").count();
  ok(await waitFor(pP, (n) => document.querySelectorAll("#lic-list .lic").length === n, rosterA, 5000) && (await pP.locator("#lic-list .lic-link").count()) === 0, `phone: roster = the clinic's ${rosterA} rows (synced, not the 5 directory stubs), no owner actions for 원무`);
  await goTab("tab-today", pP); await goTab("tab-today");
  await pP.waitForFunction(() => !document.querySelector("#tab-today .kpi.kpi-loading"), null, { timeout: 10000 });
  const kpiSel = "#ins-jabo-card, #ins-nhis-card, #ins-cut-card, #ins-reason-card";
  const kpiOf = (p) => p.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(e => e.innerText.replace(/\s+/g, " ").trim()).join(" | "), kpiSel);
  const kpiA = await kpiOf(page), kpiB = await kpiOf(pP);
  ok(kpiA.length > 20 && kpiA === kpiB, `홈 KPI tiles identical on both devices ("${kpiA.slice(0, 70)}…")`);
  const countsOf = ({ CS, E, Store }) => ({ ap: CS.Appeals.list().length, g: Store.get("guarantee.list", []).length, d: Store.get("docs.list", []).length, c: Store.get("consent.list", []).length, disp: Store.get("retention.disposals", []).length, b: E.Batches.list().length, tariff: Object.keys(E.Tariff.all()).length, tdate: E.Tariff.effectiveDate(), org: E.Org.get().name, pts: E.Patients.list().length, staff: E.Staff.list().length });
  const cntB = await mods(pP, countsOf), cntA = await M(countsOf);
  ok(JSON.stringify(cntB) === JSON.stringify(cntA) && cntB.org === ORG.name && cntB.ap >= 3 && cntB.b >= 6 && cntB.tariff > 10 && cntB.g === 3, `phone counts = desktop counts: ${JSON.stringify(cntB)}`);
  await goTab("tab-board", pP);
  await pP.waitForFunction(() => Array.from(document.querySelectorAll("#intake-col-대기 .intake-card .pc-name")).some(n => n.textContent.includes("****0418")), null, { timeout: 20000 });
  ok(await pP.evaluate(() => window.__intake.online && window.__intake.foreign === 0), "phone: board live, every card decrypts under the shared clinic key (0 foreign)");
  // The pseudonymous register is still per device in step A: the phone mints a fresh pid ("새 가명 환자"); the desktop labels
  // the card from the pid inside the decrypted payload (Patients.alias works without a register row).
  ok((await $P("#intake-name option").count()) === cntB.pts + 1, `phone: picker lists the synced pseudonymous register (${cntB.pts} pids + 새 가명 환자)`);
  await $P("#intake-name").selectOption("__new"); await $P("#intake-summary").fill("휴대폰에서 추가 · 요통");
  await $P("#intake-add-btn").click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll("#intake-col-대기 .intake-card")).some(c => /휴대폰에서 추가/.test(c.textContent)), null, { timeout: 20000 });
  ok(await page.evaluate(() => { const c = Array.from(document.querySelectorAll("#intake-col-대기 .intake-card")).find(c => /휴대폰에서 추가/.test(c.textContent)); return /환자 \*\*\*\*\d{4}/.test(c.querySelector(".pc-name span").textContent); }), "first context received the phone's card in realtime (decrypted: summary readable, alias from the pid)");
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll("#intake-col-대기 .intake-card")).find(c => /휴대폰에서 추가/.test(c.textContent)); c.querySelector(".pc-btn.advance").click(); });
  await pP.waitForFunction(() => Array.from(document.querySelectorAll("#intake-col-진료중 .intake-card")).some(c => /휴대폰에서 추가/.test(c.textContent)), null, { timeout: 20000 });
  ok(true, "status advanced on the desktop → the phone's column moved in realtime");

  at("sync: B edits a tracker row + adds an appeal → A sees them live; the activity log is unioned by id");
  const bEdit = await mods(pP, ({ CS, P, Store, ActivityLog }) => {
    const G = P.collection("guarantee.list"); const row = G.list()[0]; G.upsert({ ...row, note: "phone-edit-지불보증" });
    const a = CS.Appeals.create({ payer: "auto", batchId: "phone-batch", stmt: "PH-0001", code: "예시-03", pid: "P-2026-0233", cutAmount: 12345, reason: "phone appeal" });
    ActivityLog.add({ tag: "system", action: "phone-e2e-entry" });
    return { gid: row.id, aid: a.id, ap: CS.Appeals.list().length };
  });
  ok(await waitFor(page, async ([gid, aid]) => { const CS = await import("./js/tabs/claims-shared.js"); const { Store } = await import("./js/core/store.js"); return !!CS.Appeals.get(aid) && (Store.get("guarantee.list", []) || []).some(r => r.id === gid && r.note === "phone-edit-지불보증"); }, [bEdit.gid, bEdit.aid]), "desktop received the phone's guarantee edit + new appeal live (decrypted under the shared clinic key)");
  await goTab("tab-appeal");
  const traceOf = (p) => p.evaluate(async () => (await import("./js/core/sync.js")).Sync.trace().slice(-60).map(e => `${new Date(e.t).toISOString().slice(11, 23)} ${e.ev} ${JSON.stringify({ ...e, t: undefined, ev: undefined })}`));
  const apDiag = async () => JSON.stringify({ A: await M(({ CS }) => ({ n: CS.Appeals.list().length })), Astate: await syncState(page), Bstate: await syncState(pP), server: (await serverRows("sync_blob")).filter(r => r.key === "appeals.list").map(r => ({ rev: r.rev, by: r.updatedBy, updated: r.updated })), traceA: await traceOf(page), traceB: await traceOf(pP) }, null, 1);
  ok((await $("#appeal-list tr.appeal-row").count()) === bEdit.ap, `desktop 이의신청 register re-rendered from the remote change (${bEdit.ap} rows) — diag ${(await $("#appeal-list tr.appeal-row").count()) === bEdit.ap ? "" : await apDiag()}`);
  ok(await waitFor(page, async () => (await import("./js/core/store.js")).ActivityLog.all().some(e => e.action === "phone-e2e-entry")), "activity log: B's entry reached A (union by id, not last-write-wins)");
  const actB = await pP.evaluate(async () => { const { ActivityLog } = await import("./js/core/store.js"); const all = ActivityLog.all(); return { n: all.length, hasOwner: all.some(e => e.actor === "홍 원장"), hasPhone: all.some(e => e.action === "phone-e2e-entry"), ids: all.every(e => e.id), dupes: all.length - new Set(all.map(e => e.id)).size, sorted: all.every((e, i) => i === 0 || all[i - 1].at >= e.at) }; });
  ok(actB.hasOwner && actB.hasPhone && actB.dupes === 0 && actB.ids && actB.sorted && actB.n > 15, `phone activity log holds both devices' entries (${actB.n}, every entry has an id, no duplicates, sorted by at)`);

  at("sync: A offline → edits wait in the encrypted outbox (chip 오프라인 · N건 대기) → back online → flushed, B receives; same key edited on both → LWW, losing value kept");
  await settled(page); await settled(pP);
  await context.setOffline(true);
  await wait(300);
  await ent(page, (E) => { E.Org.set({ rep: "오프라인-대표" }); E.Tariff.setEffectiveDate("2026-01-15"); });
  await page.waitForFunction(() => /오프라인 · \d+건 대기/.test(document.querySelector("#sync-msg").textContent), null, { timeout: 10000 });
  const off = await page.evaluate(async () => { const { Store } = await import("./js/core/store.js"); const { Sync } = await import("./js/core/sync.js"); const ob = Store.get("__outbox"); let raw = null; try { raw = JSON.parse(localStorage.getItem("vibe.clinic-admin.__outbox")); } catch {} return { chip: document.querySelector("#sync-msg").textContent, st: Sync.state(), keys: Object.keys(ob?.blobs || {}).sort(), env: !!(raw && raw.v === 1 && raw.iv && raw.ct), led: document.querySelector("#sync-led").className }; });
  ok(!off.st.online && off.st.pending === 2 && off.keys.join() === "org.profile,tariff.effectiveDate" && off.env && /warn/.test(off.led), `offline: 2 edits wait in __outbox (an AES-GCM envelope on disk), chip "${off.chip}"`);
  // Meanwhile the phone (online) edits the SAME key a moment later → the server's newer write must win when A reconnects.
  await ent(pP, (E) => E.Org.set({ rep: "온라인-대표" }));
  await settled(pP);
  ok((await ent(pP, (E) => E.Org.get().rep)) === "온라인-대표", "phone: its org edit is on the server while A is offline");
  await context.setOffline(false);
  await page.waitForFunction(() => /동기화됨|충돌/.test(document.querySelector("#sync-msg").textContent), null, { timeout: 30000 });
  await settled(page, 15000);
  const afterOff = await ent(page, (E, S, Store) => ({ rep: E.Org.get().rep, date: E.Tariff.effectiveDate(), conflicts: Store.get("__conflicts", []), chip: document.querySelector("#sync-msg").textContent, outbox: localStorage.getItem("vibe.clinic-admin.__outbox") }));
  ok(afterOff.rep === "온라인-대표" && afterOff.conflicts.length === 1 && afterOff.conflicts[0].key === "org.profile" && afterOff.conflicts[0].losing?.rep === "오프라인-대표" && /^st-/.test(afterOff.conflicts[0].by), `LWW: the phone's later write won org.profile; A's losing value sits in __conflicts (${afterOff.conflicts[0]?.key} · overwritten by ${afterOff.conflicts[0]?.by})`);
  ok(/충돌 1/.test(afterOff.chip), `chip flags the conflict: "${afterOff.chip}"`);
  ok(await ent(page, (E, S, St, Ev, a, C, cal, ActivityLog) => ActivityLog.all().some(e => /동기화 충돌 — 서버 값 적용/.test(e.action) && /org\.profile/.test(e.action))), "audit entry 「동기화 충돌 — 서버 값 적용 (org.profile)」 written on A");
  ok(afterOff.date === "2026-01-15" && afterOff.outbox === null, "A's other offline edit (tariff.effectiveDate) was flushed, not lost; outbox emptied");
  ok(await waitFor(pP, async () => (await import("./js/core/entities.js")).Tariff.effectiveDate() === "2026-01-15"), "…and reached the phone");

  at("sync: A adds a licence photo → B can open it; the server file is ciphertext; A removes it → B's copy goes");
  const attA = await page.evaluate(async (png) => { const { Attachments } = await import("./js/core/attachments.js"); const E = await import("./js/core/entities.js"); const owner = (E.Staff.list().find(s => s.job === "간호사") || E.Staff.list()[0]).id; await Attachments.put({ id: "att-e2e-sync-1", owner, kind: "license", at: Date.now(), data: png }); return { owner }; }, PNG_1PX);
  await settled(page);
  ok(await waitFor(pP, async ([owner, png]) => { const { Attachments } = await import("./js/core/attachments.js"); return (await Attachments.getByOwner(owner)).some(a => a.id === "att-e2e-sync-1" && a.data === png); }, [attA.owner, PNG_1PX], 15000), "phone opened the photo (sync_file → IndexedDB, decrypted under the clinic key)");
  const sf = await serverRows("sync_file");
  ok(sf.length === 1 && sf[0].key === "att-e2e-sync-1" && sf[0].blob && sf[0].deleted === false && /^st-/.test(sf[0].updatedBy) && sf[0].id.length === 15, `server sync_file: 1 row, file present, updatedBy = staffId`);
  const sfBody = await (await fetch(`${PB_LOCAL}/api/files/sync_file/${sf[0].id}/${sf[0].blob}`)).text();
  ok(!sfBody.includes("data:image") && !sfBody.includes(attA.owner) && isEnv(JSON.parse(sfBody)), "the uploaded file is one AES-GCM envelope (no data URL, no owner id in clear)");
  await page.evaluate(async () => { const { Attachments } = await import("./js/core/attachments.js"); await Attachments.del("att-e2e-sync-1"); });
  await settled(page);
  ok(await waitFor(pP, async (owner) => { const { Attachments } = await import("./js/core/attachments.js"); return (await Attachments.getByOwner(owner)).length === 0; }, attA.owner, 15000), "phone dropped the photo after A removed it (soft-delete propagated)");
  const sf2 = await serverRows("sync_file");
  ok(sf2.length === 1 && sf2[0].deleted === true && !sf2[0].blob, "server row soft-deleted, file cleared");

  at("sync: server holds ciphertext only — every sync_blob payload is an envelope, no names / pids / PINs / tokens, no device-local keys");
  const blobs = await serverRows("sync_blob");
  const badBlobs = blobs.filter(r => r.deleted ? !(r.payload == null || isEnv(r.payload)) : !isEnv(r.payload));
  ok(blobs.length >= 20 && badBlobs.length === 0, `${blobs.length} sync_blob rows, every payload an envelope (bad: ${badBlobs.map(r => r.key).join(",") || "none"})`);
  const blobText = JSON.stringify(blobs);
  ok(!ALL_NAMES.some(n => blobText.includes(n)) && !blobText.includes("P-2026-") && !blobText.includes("2123458") && !/"(123456|000000|567890|778899)"/.test(blobText) && !JWT_RE.test(blobText) && !blobText.includes(ORG.name) && !blobText.includes("오프라인-대표") && !blobText.includes("온라인-대표"), "server DB: no plaintext names, pids, RRN, PINs, tokens, institution name or edited values");
  ok(blobs.every(r => /^[A-Za-z0-9._-]+$/.test(r.key) && !NO_SYNC_RE.test(r.key)) && blobs.every(r => /^st-/.test(r.updatedBy) && r.rev >= 1), "server keys are the syncable Store keys only (no ui.* / __* / pbUrl / player-id / ai.draft); updatedBy = staffId, rev ≥ 1");
  ok(blobs.every(r => r.id.length === 15) && new Set(blobs.map(r => r.key)).size === blobs.length && blobs.some(r => r.key === "staff.list") && blobs.some(r => r.key === "activity"), "one row per key with a 15-char deterministic id (staff.list · activity · …)");
  const unauthBlobs = await (await fetch(PB_LOCAL + "/api/collections/sync_blob/records")).json();
  ok(unauthBlobs.totalItems === 0 && unauthBlobs.items.length === 0, "unauthenticated sync_blob list → empty (rule @request.auth.id != \"\")");
  const delTry = await pP.evaluate(async (id) => { const { Cloud } = await import("./js/security/cloud.js"); const c = await Cloud.getPB(); try { await c.collection("sync_blob").delete(id); return "deleted"; } catch (e) { return e.status; } }, blobs[0].id);
  ok(delTry === 403 || delTry === 404, `hard delete refused for members (deleteRule null → ${delTry}); removal is soft-delete only`);
  const hook403 = await pP.evaluate(async () => { const { Cloud } = await import("./js/security/cloud.js"); const out = {}; try { await Cloud.createUser({ name: "x", role: "원무", staffId: "", pin: "111111", wrapped: { salt: "AAAAAAAAAAAAAAAAAAAAAA==", iterations: 310000, wrapped: { v: 1, iv: "AAAAAAAAAAAAAAAA", ct: "A".repeat(64) } } }); out.create = "ok"; } catch (e) { out.create = e.status; } try { await Cloud.deleteUser("aaaaaaaaaaaaaaa"); out.del = "ok"; } catch (e) { out.del = e.status; } try { await Cloud.resetPin("aaaaaaaaaaaaaaa", "111111", { salt: "AAAAAAAAAAAAAAAAAAAAAA==", iterations: 310000, wrapped: { v: 1, iv: "AAAAAAAAAAAAAAAA", ct: "A".repeat(64) } }); out.reset = "ok"; } catch (e) { out.reset = e.status; } return out; });
  ok(hook403.create === 403 && hook403.del === 403 && hook403.reset === 403, `phone (원무): hook routes refuse a non-owner (${JSON.stringify(hook403)})`);
  const pubWs = await (await fetch(PB_LOCAL + "/api/collections/workspace/records")).json();
  ok(pubWs.items[0].directory.length === 5 && !JSON.stringify(pubWs).includes("wrapped") && pubWs.items[0].salt.length >= 20, "workspace row is publicly readable (directory + salt), carries no wrapped keys");
  const keysUnauth = await (await fetch(PB_LOCAL + "/api/collections/staff_keys/records")).json();
  const usersUnauth = await (await fetch(PB_LOCAL + "/api/collections/staff_users/records")).json();
  ok(keysUnauth.status === 403 || keysUnauth.code === 403, `staff_keys cannot be listed at all (${keysUnauth.status || keysUnauth.code})`);
  ok(usersUnauth.totalItems === 0, "staff_users list is empty without a login");
  const keyLeak = await pP.evaluate(async (ownerId) => { const { Cloud } = await import("./js/security/cloud.js"); const c = await Cloud.getPB(); const out = {}; try { const me = await c.collection("staff_keys").getOne(c.authStore.record.id); out.mine = !!me.wrapped; } catch (e) { out.mine = e.status; } try { await c.collection("staff_keys").getOne(ownerId); out.other = "LEAK"; } catch (e) { out.other = e.status; } try { const l = await c.collection("staff_users").getFullList(); out.usersHaveWrapped = l.some(u => "wrapped" in u); out.users = l.length; } catch (e) { out.users = e.status; } return out; }, cloud0.me.id);
  ok(keyLeak.mine === true && keyLeak.other === 404 && keyLeak.users === 5 && keyLeak.usersHaveWrapped === false, `a member reads only ITS wrapped key; a colleague's key row is 404; the auth records carry no key material (${JSON.stringify(keyLeak)})`);
  await railClick("#rail-lock", pP); await pP.waitForSelector("body.locked");
  await ctxP.close();

  at("cloud: temp-PIN login (행정 김) → forced 새 PIN 설정 → app opens; the new PIN works, the temp PIN no longer does");
  const ctxK = await newCtx({ ...VIEW, locale: "ko-KR" });
  const pK = await ctxK.newPage(); watch(pK, "[kim] "); await blockAll(pK);
  shotPage = pK;
  const $K = (sel) => pK.locator(sel);
  await pK.goto(BASE, { waitUntil: "domcontentloaded" });
  await unlockAs("행정 김", TEMP_PIN, pK);
  await pK.waitForSelector("#lock-newpin:not([hidden])", { timeout: 30000 });
  ok(await pK.evaluate(() => document.body.classList.contains("locked")) && (await $K("#newpin-user").innerText()).includes("행정 김"), "temp PIN accepted → the forced new-PIN pane, app still covered");
  await noKeys("new PIN pane", "#lock-scrim", pK);
  if (MOBILE) await noOverflow("new PIN pane", pK);
  await $K("#newpin-pin").fill(TEMP_PIN); await $K("#newpin-pin2").fill(TEMP_PIN); await $K("#newpin-submit").click();
  await pK.waitForFunction(() => { const e = document.querySelector("#newpin-err"); return e && !e.hidden; }, null, { timeout: 15000 });
  ok(/다른 PIN/.test(await $K("#newpin-err").innerText()), "the temp PIN itself is refused as the new PIN");
  await $K("#newpin-pin").fill(KIM_PIN); await $K("#newpin-pin2").fill(KIM_PIN); await $K("#newpin-submit").click();
  await pK.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok((await $K("#topbar-user-text").innerText()).includes("행정 김"), "new PIN set (POST /api/clinic/me/pin + re-auth) → unlocked as 행정 김");
  await dismissWelcome(pK);
  ok(await pK.evaluate(async () => { const { Cloud } = await import("./js/security/cloud.js"); const me = (await Cloud.getPB()).authStore.record; return me && me.mustChangePin === false; }), "server record: mustChangePin cleared");
  await railClick("#rail-lock", pK); await pK.waitForSelector("body.locked");
  await unlockAs("행정 김", TEMP_PIN, pK);
  await pK.waitForFunction(() => { const e = document.querySelector("#lock-err"); return e && !e.hidden; }, null, { timeout: 12000 });
  ok(/PIN이 틀렸습니다/.test(await $K("#lock-err").innerText()), "the temp PIN no longer opens the login");
  await pK.waitForFunction(() => !document.querySelector("#lock-submit").disabled, null, { timeout: 5000 });
  await unlockAs("행정 김", KIM_PIN, pK);
  await pK.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok(true, "the self-chosen PIN opens it");
  await ctxK.close();
  shotPage = page;

  /* 6 · privacy panel */
  at("조직 › 데이터 처리 현황 — a panel now; zero 미등록 after using every tool");
  await openSearch("데이터 처리");
  await page.keyboard.press("Enter"); // the ⌘K command (the rail foot no longer duplicates the 조직 panel)
  await page.waitForSelector("#tab-privacy.active");
  ok((await $("#crumb-tab").innerText()) === "데이터 처리 현황" && !(await $("#privacy-scrim").count()) && !(await $("#search-scrim.open").count()), "privacy register opened as the 조직 › 데이터 처리 현황 panel via ⌘K (modal retired, no rail duplicate)");
  await page.evaluate(() => document.querySelector("#poc-banner-link").click());
  ok(await page.evaluate(() => document.querySelector('#tab-privacy [data-privacy-pane="legal"]').classList.contains("active")), "PoC banner link → legal pane of the panel");
  await page.evaluate(() => document.querySelector('#tab-privacy [data-privacy-tab="status"]').click());
  await page.waitForFunction(() => document.querySelectorAll("#privacy-table tr").length > 5);
  const unreg = await $("#privacy-table tr.unregistered").count();
  ok(unreg === 0, `0 미등록 rows after using every panel (got ${unreg}: ${(await $("#privacy-table tr.unregistered").allInnerTexts()).join(" | ")})`);
  const regText = await $("#privacy-table").innerText();
  ok(regText.includes("업로드 마스터") && regText.includes("직원 명부") && regText.includes("기관 프로필") && regText.includes("가명 환자 대장") && regText.includes("업로드 배치"), "register lists masters + the entity rows (org · staff · patients · batches)");
  const reg3 = await page.evaluate(() => Array.from(document.querySelectorAll("#privacy-table tr")).map(tr => ({ text: tr.innerText.replace(/\s+/g, " "), enc: !!tr.querySelector("td.enc-yes") })));
  const regRow = (label) => reg3.find(r => r.text.includes(label));
  ok(["이의신청 대장", "건보 대조 기록", "자보 지불보증 대장", "진단서 등 발급 대장", "비급여 사전 설명·동의 기록", "의무기록 파기 대장"].every(l => regRow(l)?.enc) && regRow("비급여 가격표 변경 이력") && !regRow("비급여 가격표 변경 이력").enc, "Phase-3 register rows present: six encrypted trackers/ledgers + the plaintext tariff history");
  ok(/보증 종료 후 1년/.test(regRow("자보 지불보증 대장").text) && /3년/.test(regRow("진단서 등 발급 대장").text) && /5년 \(확인 필요\)/.test(regRow("비급여 사전 설명·동의 기록").text) && /1년/.test(regRow("이의신청 대장").text), "retention wording: 1년 · 3년 · 5년 (확인 필요) · 1년");
  const inv3 = await M(async ({ life }) => { const rows = await life.inventory(); const sess = rows.find(r => r.id === "session"); return { th: rows.filter(r => r.keys.includes("tariff.history")).map(r => r.id), ti: rows.filter(r => r.keys.includes("tariff.items")).map(r => r.id), unreg: rows.filter(r => r.unregistered).map(r => r.id), sess: sess ? { count: sess.count, present: sess.present, keys: sess.keys, enc: sess.encrypted, ret: sess.retention } : null }; });
  ok(inv3.th.join() === "tariff.history" && inv3.ti.join() === "tariff" && inv3.unreg.length === 0, `inventory: tariff.history listed once (${inv3.th}), tariff.items under the tariff row, 0 unregistered`);
  const sessRow = regRow("세션 키 (추출 불가 CryptoKey)");
  ok(sessRow && /IndexedDB/.test(sessRow.text) && /만료 시 삭제/.test(sessRow.text) && /봉인/.test(sessRow.text) && !sessRow.enc, "register lists the session store: 세션 키 (추출 불가 CryptoKey) · IndexedDB · 만료 시 삭제 · sealed server token");
  // The roster step revoked another user's login a moment ago — the keyring is server-side now, so the owner's own session
  // record survives key management for OTHER users (only its own PIN change drops it).
  ok(inv3.sess && inv3.sess.present && inv3.sess.count === 1 && inv3.sess.keys.join() === "vibe-clinic-admin-session/session" && inv3.sess.enc === "추출 불가 CryptoKey", `inventory: session row present and live after issuing/revoking other logins (${JSON.stringify(inv3.sess)})`);
  ok(await page.evaluate(() => !document.querySelector('#privacy-table input[data-destroy="session"]')), "session row has no 파기 checkbox (removed by 잠금 / expiry, not from the table)");
  const cloudRows = ["서버 사용자 디렉터리", "PIN 파생 비밀번호", "서버 세션 토큰"].map(l => regRow(l));
  ok(cloudRows.every(Boolean) && /공개 읽기/.test(cloudRows[0].text) && /6자리 이상/.test(cloudRows[1].text) && /IndexedDB/.test(cloudRows[2].text) && cloudRows.every(r => !r.enc), "register lists the three server rows (directory · PIN-derived password · sealed token) and states the public-read trade-off");
  ok(await page.evaluate(() => !document.querySelector('#privacy-table input[data-destroy="cloud.directory"]') && !document.querySelector('#privacy-table input[data-destroy="__lock"]')), "server rows and the lock settings have no 파기 checkbox");
  const syncRows = ["동기화 메타", "동기화 대기 변경", "동기화 충돌 기록", "서버 동기화 블롭", "서버 동기화 첨부"].map(l => regRow(l));
  ok(syncRows.every(Boolean) && /soft-delete/.test(syncRows[3].text) && /회원만/.test(syncRows[3].text) && /E2E/.test(syncRows[3].text) && syncRows[1].enc && syncRows[2].enc && !syncRows[0].enc, "register lists the sync rows: __sync (plain, key names only) · __outbox + __conflicts (encrypted) · sync_blob (E2E 암호문 · 회원만 · soft-delete) · sync_file");
  ok(/\d+/.test(syncRows[3].text) && await page.evaluate(() => !document.querySelector('#privacy-table input[data-destroy="sync_blob"]') && !document.querySelector('#privacy-table input[data-destroy="__sync"]') && !document.querySelector('#privacy-table input[data-destroy="__outbox"]') && !!document.querySelector('#privacy-table input[data-destroy="__conflicts"]')), "sync_blob / __sync / __outbox have no 파기 checkbox; the conflicts ring does");
  const syncLine = await $("#privacy-sync-line").innerText();
  ok(/연결됨/.test(syncLine) && /서버 항목 \d+개/.test(syncLine) && /충돌 1건/.test(syncLine) && /대기 0건/.test(syncLine), `동기화 section status line: "${syncLine}"`);
  const confTbl = await $("#privacy-sync-conflicts").innerText();
  ok((await $("#privacy-sync-conflicts tr[data-conflict]").count()) === 1 && /기관 프로필/.test(confTbl) && /오프라인-대표/.test(confTbl) && /org\.profile/.test(confTbl) && !/온라인-대표/.test(confTbl), "conflicts table shows the org.profile conflict with this device's losing value, the overwriting user as a pseudonym");
  await $("#privacy-sync-conflicts [data-restore-conflict]").click();
  await page.waitForFunction(() => document.querySelectorAll("#privacy-sync-conflicts tr[data-conflict]").length === 0);
  ok((await ent(page, (E) => E.Org.get().rep)) === "오프라인-대표" && (await syncState(page)).conflicts === 0, "되살리기 → this device's value is back (queued for the server), ring emptied, audit entry");
  await settled(page);
  ok(/동기화됨 \d{2}:\d{2}/.test(await $("#sync-msg").innerText()), `chip back to 동기화됨 HH:MM ("${await $("#sync-msg").innerText()}")`);
  const restoredBlob = (await serverRows("sync_blob")).find(r => r.key === "org.profile");
  ok(restoredBlob && !restoredBlob.deleted && isEnv(restoredBlob.payload) && restoredBlob.rev >= 3, `server org.profile row rewritten by the restore (rev ${restoredBlob?.rev}, still an envelope)`);
  await $("#privacy-sync-now").click();
  await page.waitForFunction(() => /동기화했습니다/.test(document.querySelector("#privacy-msg")?.textContent || ""), null, { timeout: 15000 });
  ok(true, "지금 동기화 → 동기화했습니다");
  ok(await $("#privacy-destroy-server").isChecked() && !(await $("#privacy-destroy-server").isDisabled()), "원장: 「이 클리닉의 서버 데이터도 파기」 checkbox present, default on");
  await page.evaluate(() => document.querySelector("#topbar-sync").click());
  await page.waitForSelector("#tab-privacy.active");
  ok(true, "topbar sync chip → 데이터 처리 현황 (동기화 section)");
  ok(/서버가 보는 것과 보지 못하는 것/.test(await $("#tab-privacy").innerText()) && /URL을 아는 누구나/.test(await $("#tab-privacy").innerText()), "status pane carries the honest server-visibility paragraph");
  ok((await $("#privacy-wsid").innerText()).includes(ORG.name) && (await $("#privacy-wsid").innerText()).includes("127.0.0.1"), `status line names the workspace + server host (${await $("#privacy-wsid").innerText()})`);
  const rawEnv = await page.evaluate(() => Object.fromEntries(["appeals.list", "nhis.history", "guarantee.list", "docs.list", "consent.list", "retention.disposals"].map(k => { let j = null; try { j = JSON.parse(localStorage.getItem("vibe.clinic-admin." + k)); } catch {} return [k, !!(j && j.v === 1 && j.iv && j.ct)]; })));
  ok(Object.values(rawEnv).every(Boolean), `all six Phase-3 keys stored as AES-GCM envelopes (${JSON.stringify(rawEnv)})`);
  const preBackup = await M(({ CS, Store }) => ({ ap: CS.Appeals.list().length, nh: CS.nhisHistory().length, g: Store.get("guarantee.list", []).length, d: Store.get("docs.list", []).length, c: Store.get("consent.list", []).length, disp: Store.get("retention.disposals", []).length, th: Store.get("tariff.history", []).length }));
  const bk = await download(() => $("#privacy-backup").click());
  ok(/_PoC\.json$/.test(bk.name), `backup filename watermarked (${bk.name})`);
  const bkJ = JSON.parse(bk.text);
  ok(bkJ.v === 4 && typeof bkJ.lastSyncAt === "string" && bkJ.keyring.v === 3 && bkJ.keyring.users.length === 1 && bkJ.keyring.users[0].name === "홍 원장" && bkJ.keyring.users[0].staffId && bkJ.keyring.users[0].wrapped?.ct && bkJ.keyring.workspace?.name === ORG.name && Object.keys(bkJ.sensitive).includes("staff.list") && Object.keys(bkJ.sensitive).includes("patients.register") && Object.keys(bkJ.sensitive).some(k => k.startsWith("claims.batch.")) && !Object.keys(bkJ.sensitive).some(k => k.startsWith("__")), "backup is v4: lastSyncAt recorded, keyring = the exporting user's wrapped clinic key only (+ workspace name), staff.list + patients.register + claims.batch.* envelopes included, no __outbox / __conflicts");
  ok(["appeals.list", "nhis.history", "guarantee.list", "docs.list", "consent.list", "retention.disposals"].every(k => Object.keys(bkJ.sensitive).includes(k)), "backup carries the six Phase-3 envelopes");
  ok(!ALL_NAMES.some(n => JSON.stringify({ ...bkJ, keyring: null }).includes(n)) && !JWT_RE.test(bk.text), "backup file has no plaintext names outside the keyring and no server token (org.profile travels inside the encrypted `plain` bundle)");
  if (MOBILE) await noOverflow("privacy panel");

  /* 7 · storage has no plaintext */
  at("localStorage / IndexedDB contain no plaintext names, no legacy keys");
  await wait(700); // let the encrypted write chains flush
  const snap = await storeSnapshot();
  const appKeys = Object.keys(snap.ls).filter(k => k.startsWith("vibe.clinic-admin.")).map(k => k.slice(18));
  ok(!appKeys.some(k => /^(license\.list|yearend\.ye-biz|yearend\.ye-clinic|bigeup\.profile\.|bigeup\.tariff|bigeup\.tariffMeta|batches\.|jabo\.draft\.entities|ui\.insurer)/.test(k)), `no legacy / shim keys written (${appKeys.join(", ")})`);
  ok(appKeys.includes("ui.claimsBatch") && appKeys.includes("tariff.items") && appKeys.includes("insurers.lastUsed"), "entity + claims keys present (ui.claimsBatch · tariff.items · insurers.lastUsed)");
  const lsText = JSON.stringify(Object.fromEntries(Object.entries(snap.ls).filter(([k]) => !PLAIN_OK.has(k)))), idbText = JSON.stringify(snap.idb);
  const leakedLs = ALL_NAMES.filter(n => lsText.includes(n)), leakedIdb = ALL_NAMES.filter(n => idbText.includes(n));
  ok(!leakedLs.length, `localStorage: no names (leaked: ${leakedLs.join(",") || "none"})`);
  ok(!leakedIdb.length, `IndexedDB: no names (leaked: ${leakedIdb.join(",") || "none"})`);
  ok(!lsText.includes("2123458"), "no RRN digits persisted");
  ok(!lsText.includes("P-2026-0142") && !lsText.includes("SS-2026-77812") && !lsText.includes("N2608-0005"), "no plaintext 환자번호 / claim no. / 명세서번호 persisted (trackers + appeals are envelopes)");
  ok(Object.keys(snap.idb).includes("vibe-clinic-admin-masters"), "masters DB exists before wipe");
  const allStore = JSON.stringify(snap.ls) + idbText;
  ok(!appKeys.includes("__ws") && appKeys.includes("__lock") && !/"(123456|000000|567890|778899|432100)"/.test(allStore), "no legacy keyring (__ws), lock settings present (__lock), no PIN string anywhere in storage");
  ok(!JWT_RE.test(JSON.stringify(snap.ls)) && !JWT_RE.test(idbText), "no server token (JWT) in localStorage or in any IndexedDB value — it is sealed inside the session record");
  const sessRaw = snap.idb["vibe-clinic-admin-session"]?.session?.[0];
  ok(sessRaw && sessRaw.sealed && sessRaw.sealed.v === 1 && sessRaw.sealed.iv && sessRaw.sealed.ct && !("pbAuth" in sessRaw) && !("name" in sessRaw), "session record: token · name · role · wrapped key live only inside the `sealed` AES-GCM envelope");
  ok(await ent(page, (E, S) => S.isAuthed()), "…and the app is authenticated (the token is in memory)");

  /* 8 · lock / unlock as a SEEDED login */
  at("lock → locked state → unlock as 정수아 (seeded 행정 · PIN 000000, server auth)");
  await railClick("#rail-lock");
  await page.waitForSelector("body.locked");
  await page.waitForSelector("#lock-unlock:not([hidden])");
  await noKeys("lock screen", "#lock-scrim");
  ok(await page.evaluate(() => getComputedStyle(document.querySelector(".frame.shell")).visibility === "hidden" && document.querySelector(".frame.shell").inert === true), "shell hidden + inert while locked");
  ok(await ent(page, (E, S, Store) => E.Staff.list().length === 0 && E.Patients.list().length === 0 && E.Batches.list().length === 0 && Store.get("jabo.history", []).length === 0), "Staff / Patients / Batches / sensitive keys read empty while locked");
  ok(await M(({ CS, P, Store }) => CS.Appeals.list().length === 0 && CS.appealStats().open === 0 && P.guaranteeDeadlines().length === 0 && Store.get("consent.list", []).length === 0 && Store.get("retention.disposals", []).length === 0), "appeals · guarantees · consents · disposals read empty while locked (producers are lock-safe)");
  ok(await ent(page, (E, S) => !S.isAuthed()), "locking also drops the server token");
  if (MOBILE) await noOverflow("lock screen (unlock)");
  await unlockAs("정수아", SEED_PIN);
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok((await $("#topbar-user-text").innerText()).includes("정수아"), "topbar chip = 정수아 (seeded login, PIN 000000)");
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10);
  ok(true, "roster re-rendered after re-unlock (10 rows)");
  ok((await $("#lic-list .lic-link").count()) === 0, "non-owner (행정) sees no 로그인 발급/해제 actions");
  await goTab("tab-jabo");
  ok((await $("#jabo-recon-result tbody tr").count()) === 42, "02 reconciliation re-derived from the shared batch after re-unlock");
  await goTab("tab-appeal");
  ok((await $("#appeal-list tr.appeal-row").count()) === 6, "이의신청 register re-rendered after re-unlock (3 seeded + 2 created + 1 from the phone)");
  await goTab("tab-guarantee");
  ok((await $("#tab-guarantee .p3-table tbody tr").count()) === 3, "지불보증 list re-rendered after re-unlock (3 rows)");

  at("audit log entries carry actor + staffId + role and no names outside the actor field");
  const audit = await ent(page, (E, S, St, Ev, a, C, cal, ActivityLog) => ActivityLog.all());
  ok(audit.length > 15, `${audit.length} audit entries`);
  ok(audit.every(e => e.actor && e.role && typeof e.action === "string"), "every entry has actor + role + action");
  ok(audit.every(e => e.staffId), "every entry links the actor to a roster row (staffId)");
  const auditText = JSON.stringify(audit.map(({ actor, ...e }) => e));
  ok(!ALL_NAMES.some(n => auditText.includes(n)), `audit log has no patient/staff names in action/subject/meta`);
  ok(audit.some(e => e.subject && /○○/.test(e.subject)), "staff subjects are role + initial");
  ok(audit.some(e => e.subject && /^\*\*\*\*/.test(e.subject)), "patient subjects are ****NNNN");
  ok(audit.some(e => e.actor === "정수아") && audit.some(e => e.actor === "홍 원장"), "both users appear as actors");

  /* 9 · 전체 파기 — lives in 조직 › 데이터 처리 현황 and is 원장-only: 정수아 (행정) sees it disabled, 홍 원장 runs it */
  at("전체 파기 (typed 「파기」, 원장 only, from 조직 › 데이터 처리 현황) → clean first-run state, masters DB gone");
  await goTab("tab-privacy");
  ok(await $("#privacy-destroy-all").isDisabled(), "행정 user: 전체 파기 disabled (Director permission)");
  await railClick("#rail-lock");
  await page.waitForSelector("body.locked");
  await unlockAs("홍 원장", OWNER_PIN);
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });
  await goTab("tab-privacy");
  await page.waitForFunction(() => document.querySelector("#privacy-destroy-all") && !document.querySelector("#privacy-destroy-all").disabled);
  const preWipe = await sessionRec();
  ok(preWipe.db && preWipe.rec && preWipe.rec.keyType === "CryptoKey", "session DB + record present before 전체 파기 (PIN unlock persisted it)");
  // A second device stays logged in to observe the SERVER side of the wipe (checkbox "이 클리닉의 서버 데이터도 파기" is on by default).
  const ctxW = await newCtx({ ...VIEW, locale: "ko-KR" }); const pW = await ctxW.newPage(); watch(pW, "[wipe-observer] "); await blockAll(pW);
  await pW.goto(BASE, { waitUntil: "domcontentloaded" }); await unlockAs("한지우", SEED_PIN, pW); await pW.waitForSelector("body:not(.locked)", { timeout: 30000 }); await dismissWelcome(pW);
  await settled(pW, 15000);
  ok((await pW.evaluate(async () => (await import("./js/core/entities.js")).Staff.list().length)) === 10 && (await serverRows("sync_blob")).filter(r => !r.deleted).length >= 20, "observer device synced the roster (10 rows); server rows live before the wipe");
  ok(await $("#privacy-destroy-server").isChecked(), "server-wipe checkbox is on");
  page.once("dialog", d => d.accept("파기"));
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), $("#privacy-destroy-all").click()]);
  await page.waitForSelector("#lock-scrim.open");
  await page.waitForSelector("#lock-unlock:not([hidden])", { timeout: 20000 });
  ok(await $("#lock-unlock").isVisible() && (await $("#lock-setup").isHidden()), "after 전체 파기 the device is clean but the CLINIC still exists on the server → unlock pane (not setup)");
  ok((await page.evaluate(() => document.querySelectorAll("#lock-user option").length)) === 5, "dropdown still lists the 5 server users (전체 파기 is device-local)");
  const after = await page.evaluate(async () => ({ ls: Object.keys(localStorage).filter(k => k.startsWith("vibe.clinic-admin")), dbs: (await indexedDB.databases()).map(d => d.name) }));
  // The fresh boot immediately re-creates the tab-restore state (ui.activeTab + its mtime/lastSave) —
  // non-personal, registered under ui/__internal — and the e2e's own server override. Nothing else may survive.
  const BOOT_KEYS = new Set(["vibe.clinic-admin.__mtime", "vibe.clinic-admin.__lastSave", "vibe.clinic-admin.ui.activeTab", PB_URL_KEY]);
  ok(after.ls.every(k => BOOT_KEYS.has(k)), `localStorage cleared except boot UI state (${after.ls.join(",") || "empty"})`);
  ok(!after.ls.includes("vibe.clinic-admin.__lock") && !after.ls.includes("vibe.clinic-admin.__ws"), "lock settings (__lock) gone, no legacy keyring");
  ok(!after.dbs.includes("vibe-clinic-admin-masters") && !after.dbs.includes("vibe-clinic-admin") && !after.dbs.includes("vibe-clinic-admin-session"), `IndexedDB cleared incl. the session store (${after.dbs.join(",") || "empty"})`);
  ok(await waitFor(pW, async () => { const E = await import("./js/core/entities.js"); const { Store } = await import("./js/core/store.js"); return E.Staff.list().length === 0 && E.Patients.list().length === 0 && E.Batches.list().length === 0 && (Store.get("appeals.list", []) || []).length === 0 && !E.Org.get().name && Object.keys(E.Tariff.all()).length === 0; }, null, 20000), "observer device emptied itself (tombstones via realtime: roster · patients · batches · appeals · org · tariff)");
  ok((await pW.evaluate(async () => (await import("./js/security/session.js")).Session.isUnlocked())), "…while its login stays valid (accounts are the clinic's; the data is gone)");
  const tomb = await serverRows("sync_blob");
  ok(tomb.length >= 20 && tomb.every(r => r.deleted === true && r.payload == null), `server: every sync_blob row tombstoned with the payload blanked (${tomb.length} rows)`);
  ok((await serverRows("sync_file")).every(r => r.deleted === true && !r.blob), "server: every sync_file row tombstoned, file cleared");
  await ctxW.close();

  /* 10 · restore */
  at("restore encrypted backup (v3) with PIN → verified against the server key → data back");
  await $("#lock-goto-restore2").click();
  await page.waitForSelector("#lock-restore:not([hidden])");
  await $("#restore-file").setInputFiles({ name: bk.name, mimeType: "application/json", buffer: bk.buf });
  await page.waitForSelector("#restore-step2:not([hidden])");
  ok((await $("#restore-user option").count()) === 1 && /홍 원장 · 원장/.test(await $("#restore-user").innerText()), "restore lists the backup's single keyring user (the exporter)");
  await $("#restore-user").selectOption({ label: "홍 원장 · 원장" });
  await $("#restore-pin").fill("111111");
  page.once("dialog", d => d.accept());
  await $("#restore-submit").click();
  await page.waitForFunction(() => { const e = document.querySelector("#restore-err"); return e && !e.hidden; });
  ok(/PIN이 틀렸/.test(await $("#restore-err").innerText()), "wrong PIN → refused before anything is touched");
  await $("#restore-pin").fill(OWNER_PIN);
  page.once("dialog", d => d.accept());
  await $("#restore-submit").click();
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok(await ent(page, (E, S) => S.isAuthed() && S.user().name === "홍 원장"), "restore logged in on the server too (key verified byte-for-byte against the server copy)");
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10, null, { timeout: 15000 });
  ok(true, "10 roster rows restored");
  ok((await $("#topbar-org-text").innerText()) === ORG.name, "org profile restored (topbar chip)");
  ok(/건/.test(await $("#ins-jabo").innerText()), "jabo history restored (dashboard insight)");
  const postRestore = await M(({ CS, Store }) => ({ ap: CS.Appeals.list().length, nh: CS.nhisHistory().length, g: Store.get("guarantee.list", []).length, d: Store.get("docs.list", []).length, c: Store.get("consent.list", []).length, disp: Store.get("retention.disposals", []).length, th: Store.get("tariff.history", []).length }));
  ok(JSON.stringify(postRestore) === JSON.stringify(preBackup) && postRestore.ap === 6 && postRestore.g === 3 && postRestore.d === 5 && postRestore.c === 4 && postRestore.disp === 6, `Phase-3 data round-tripped through backup → wipe → restore (${JSON.stringify(postRestore)})`);
  await wait(600); // the first-run welcome would open 350 ms after app:ready — it must not, ui.welcomed came back with the backup
  ok(!(await $("#welcome-scrim").evaluate(el => el.classList.contains("open"))), "welcome tour does not reopen after a restore");
  ok(!(await sessionRec()).rec, "(h) restore required the PIN and left NO session record — the adopted key lives in this page only");
  await settled(page, 20000);
  const reborn = (await serverRows("sync_blob")).filter(r => !r.deleted);
  ok(reborn.length >= 20 && reborn.some(r => r.key === "staff.list") && reborn.some(r => r.key === "appeals.list") && reborn.every(r => isEnv(r.payload)), `restore → full pull + push reconciliation: ${reborn.length} server rows live again (the restored values won over the tombstones)`);
  await goTab("tab-kcd");
  const curKcd = await M(({ CS }) => { const b = CS.currentClaimsBatch(); return { payer: b?.meta?.payer, lines: b?.meta?.kcdLines }; });
  ok(/최근 정비/.test(await $("#kcd-status").innerText()) && curKcd.payer === "nhis" && (await $("#kcd-result tbody tr").count()) === curKcd.lines, `kcd.lastSummary + the current claims batch restored — the 건보 batch the appeal hand-off selected (${curKcd.lines} rows re-derived)`);

  /* 11 · reload after a restore → PIN pane (restore never persists a session) */
  at("reload after restore → PIN pane → unlock → data persists");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open");
  await page.waitForSelector("#lock-unlock:not([hidden])");
  ok(await $("#lock-unlock").isVisible(), "unlock pane after reload (no session record to resume)");
  await unlockAs("홍 원장", OWNER_PIN);
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10, null, { timeout: 15000 });
  ok(true, "roster persists across reload");
  ok(!(await $("#welcome-scrim").evaluate(el => el.classList.contains("open"))), "welcome does not reopen (ui.welcomed restored)");
  if (MOBILE) await noOverflow("shell (after reload)");

  /* 11b · SESSION PERSISTENCE — non-extractable session key in IndexedDB */
  at("session (i): record = non-extractable AES-GCM CryptoKey (exportKey throws), 8h default, no raw key bytes in any storage");
  const rawKey = await ent(page, async (E, S, St, Ev, a, C) => { const u = S.exportKeyring().users[0]; const raw = await C.unwrapMaster(u, "123456"); return { b64: C.b64(raw), hex: Array.from(raw).map(b => b.toString(16).padStart(2, "0")).join(""), arr: JSON.stringify(Array.from(raw)) }; });
  const sess0 = await sessionRec();
  ok(sess0.rec && sess0.rec.keyType === "CryptoKey" && sess0.rec.extractable === false && sess0.rec.alg === "AES-GCM" && sess0.rec.exportErr === "InvalidAccessError" && (sess0.rec.usages || []).join() === "encrypt,decrypt", `vibe-clinic-admin-session/session/current holds a non-extractable AES-GCM CryptoKey (exportKey → ${sess0.rec?.exportErr}, usages ${sess0.rec?.usages})`);
  ok(sess0.rec.mode === "8h" && sess0.rec.expiresAt - sess0.rec.unlockedAt === 8 * 3600000 && sess0.rec.nonce === null && typeof sess0.rec.lastActiveAt === "number", "default mode 8h: expiresAt = unlockedAt + 8 h, no tab nonce, lastActiveAt set");
  const snapS = await storeSnapshot();
  const allText = JSON.stringify(snapS.ls) + JSON.stringify(snapS.idb) + (await page.evaluate(() => JSON.stringify(Object.entries(sessionStorage))));
  ok(rawKey.b64.length === 44 && !allText.includes(rawKey.b64) && !allText.includes(rawKey.hex) && !allText.includes(rawKey.arr), "no raw master-key bytes (b64 / hex / byte array) in localStorage, sessionStorage or any IndexedDB value");
  ok(await page.evaluate(() => sessionStorage.getItem("vibe.clinic-admin.session-nonce") === null), "8h mode: no tab nonce in sessionStorage");
  ok(await M(async ({ life }) => { const r = (await life.inventory()).find(x => x.id === "session"); return r && r.present && r.count === 1 && r.lastModified > 0; }), "processing register: session row now counts the live record (1)");

  at("session (a): reload → still unlocked, PIN pane never shown, data visible, exactly one 세션 이어가기 audit entry");
  const t0 = await page.evaluate(() => Date.now());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("body:not(.locked)", { timeout: 20000 });
  ok(!(await page.evaluate(() => document.querySelector("#lock-scrim").classList.contains("open"))), "lock scrim closed after the reload without a PIN");
  ok(await page.evaluate(() => document.querySelector("#lock-unlock").hidden && document.querySelector("#lock-setup").hidden), "unlock + setup panes still hidden — no PIN pane flashed");
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10, null, { timeout: 15000 });
  ok(true, "roster (10 rows) visible — the resumed session decrypted the Store");
  ok((await $("#topbar-user-text").innerText()).includes("홍 원장"), "topbar chip = 홍 원장 (resumed user)");
  const chipTitle = await $("#topbar-user").getAttribute("title");
  ok(/세션 만료 \d\d:\d\d/.test(chipTitle), `chip tooltip carries the expiry (${chipTitle})`);
  const resumeLog = await page.evaluate(async (t) => { const { ActivityLog } = await import("./js/core/store.js"); return ActivityLog.all().filter(e => e.at >= t).map(e => e.action); }, t0);
  ok(resumeLog.filter(a => a === "잠금 해제 (세션 이어가기 · PIN 없이)").length === 1 && !resumeLog.includes("잠금 해제"), `audit since the reload: one 세션 이어가기 entry, no PIN unlock entry (${resumeLog.join(" | ")})`);
  ok(await ent(page, (E, S) => S.isUnlocked() && !S.hasRawGrant()), "resumed session has NO raw-key grant — key management must re-auth");
  ok(!(await $("#welcome-scrim").evaluate(el => el.classList.contains("open"))), "welcome does not reopen on a resumed session");
  ok(await ent(page, (E, S, Store) => E.Staff.list().length === 10 && Store.get("jabo.history", []).length > 0), "Staff + encrypted history readable through the resumed (non-extractable) key");
  if (MOBILE) await noOverflow("shell (resumed session)");

  at("session (f): login issue after a resume → PIN 재확인; wrong PIN → backoff; right PIN → issued; PIN reset rides the grant");
  await railClick("#rail-users");
  await page.waitForSelector("#users-scrim.open");
  ok((await $("#users-session").inputValue()) === "8h" && !(await $("#users-session").isDisabled()), "users panel: session length select = 8h, enabled for 원장");
  await noKeys("users modal (session section)", "#users-scrim");
  await $("#users-add-name").fill("신유진"); await $("#users-add-role").selectOption("원무"); await $("#users-add-pin").fill("246800");
  await $("#users-add-btn").click();
  await page.waitForSelector("#reauth-scrim.open");
  ok((await $("#reauth-title").innerText()) === "PIN 재확인" && (await $("#reauth-user").innerText()).includes("홍 원장"), "PIN 재확인 dialog opened for the current user (no PIN was typed this page load)");
  await noKeys("re-auth dialog", "#reauth-scrim");
  if (MOBILE) await noOverflow("re-auth dialog");
  await $("#reauth-pin").fill("999999"); await $("#reauth-submit").click();
  await page.waitForFunction(() => { const e = document.querySelector("#reauth-err"); return e && !e.hidden && /초 후/.test(e.textContent); });
  ok(await $("#reauth-submit").isDisabled() && /PIN이 틀렸습니다/.test(await $("#reauth-err").innerText()), "wrong PIN → the lock screen's backoff (submit disabled, countdown) — checked OFFLINE against the sealed wrapped key");
  ok(await ent(page, (E, S) => { const u = S.users().find(x => x.name === "홍 원장"); return u.fails === 1 && u.lockedUntil > Date.now() - 5000; }), "backoff persisted per user id on this device (fails = 1)");
  await page.waitForFunction(() => !document.querySelector("#reauth-submit").disabled, null, { timeout: 5000 });
  await $("#reauth-pin").fill(OWNER_PIN); await $("#reauth-submit").click();
  await closed("#reauth-scrim");
  await page.waitForFunction(() => /신유진/.test(document.querySelector("#users-msg")?.textContent || ""), null, { timeout: 20000 });
  ok(/로그인을 발급/.test(await $("#users-msg").innerText()) && (await $("#users-list .sec-row").count()) === 6, "right PIN → login issued on the server (6 logins)");
  ok(await ent(page, (E, S) => S.hasRawGrant() && S.users().find(x => x.name === "홍 원장").fails === 0), "successful re-auth opened a raw-key grant and reset the fail counter");
  ok(!!(await sessionRec()).rec, "issuing a login keeps this tab's session record");
  // 신유진 logs in on another device with the temp PIN (forced change pane), then the owner resets her PIN → that session dies.
  const ctxY = await newCtx({ ...VIEW, locale: "ko-KR" });
  const pY = await ctxY.newPage(); watch(pY, "[yujin] "); await blockAll(pY);
  await pY.goto(BASE, { waitUntil: "domcontentloaded" });
  await unlockAs("신유진", "246800", pY);
  await pY.waitForSelector("#lock-newpin:not([hidden])", { timeout: 30000 });
  await pY.locator("#newpin-pin").fill("135790"); await pY.locator("#newpin-pin2").fill("135790"); await pY.locator("#newpin-submit").click();
  await pY.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok((await pY.locator("#topbar-user-text").innerText()).includes("신유진"), "신유진: temp PIN → own PIN → unlocked on her device");
  await dismissWelcome(pY);
  page.once("dialog", d => d.accept("135700"));
  await page.locator("#users-list .sec-row", { hasText: "신유진" }).locator('[data-act="reset"]').click();
  await page.waitForFunction(() => /PIN을 재설정/.test(document.querySelector("#users-msg")?.textContent || ""), null, { timeout: 20000 });
  ok(!(await $("#reauth-scrim.open").count()), "PIN reset within the grant window → no second PIN prompt");
  ok(!!(await sessionRec()).rec && (await ent(page, (E, S) => S.isUnlocked())), "resetting ANOTHER user's PIN keeps the owner's own session record (the keyring is server-side now)");
  await pY.reload({ waitUntil: "domcontentloaded" });
  await pY.waitForSelector("#lock-unlock:not([hidden])", { timeout: 30000 });
  ok(/PIN이 재설정되었거나 로그인이 해제/.test(await pY.locator("#lock-reason").innerText()), "신유진's resumed session was REVOKED by the server (token invalidated by the reset) → lock screen with the reason");
  await unlockAs("신유진", "135700", pY);
  await pY.waitForSelector("#lock-newpin:not([hidden])", { timeout: 30000 });
  ok(true, "the reset PIN is a temp PIN again → forced new PIN pane");
  await ctxY.close();
  await ent(page, (E, S) => S.forgetRaw());
  ok(await ent(page, (E, S) => !S.hasRawGrant()), "forgetRaw() drops the grant");

  at("session (f): change own PIN — wrong current PIN rejected (backoff), right one re-wraps + re-authenticates and drops the record → reload asks PIN");
  await $("#users-old-pin").fill("000000"); await $("#users-new-pin").fill(OWNER_PIN2); await page.locator("#users-pin-form button[type=submit]").click();
  await page.waitForFunction(() => /현재 PIN이 틀렸습니다/.test(document.querySelector("#users-msg")?.textContent || ""));
  ok(true, "wrong current PIN → 현재 PIN이 틀렸습니다");
  await wait(1100); // 1 s backoff
  await $("#users-old-pin").fill(OWNER_PIN); await $("#users-new-pin").fill(OWNER_PIN2); await page.locator("#users-pin-form button[type=submit]").click();
  await page.waitForFunction(() => /PIN을 변경했습니다/.test(document.querySelector("#users-msg")?.textContent || ""), null, { timeout: 20000 });
  await $("#users-close").click(); await closed("#users-scrim");
  ok(!(await sessionRec()).rec, "own PIN change deletes the session record");
  ok(await ent(page, (E, S) => S.isUnlocked() && S.isAuthed()), "…this tab stays unlocked AND authenticated (re-auth with the new password after the atomic change)");
  const PIN2 = OWNER_PIN2;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open"); await page.waitForSelector("#lock-unlock:not([hidden])");
  ok(true, "reload after a PIN change → PIN pane");
  const hint = await $("#lock-persist-hint").innerText();
  ok(/이 기기에서는 다시 열어도 잠기지 않아요 · 8시간 또는 10분 미사용 시 잠금/.test(hint), `unlock pane hint reflects the settings (${hint})`);
  await noKeys("lock screen (with hint)", "#lock-scrim");
  await unlockAs("홍 원장", OWNER_PIN);
  await page.waitForFunction(() => { const e = document.querySelector("#lock-err"); return e && !e.hidden; });
  ok(/PIN이 틀렸습니다/.test(await $("#lock-err").innerText()), "old PIN no longer opens the workspace (server 400 → backoff)");
  await page.waitForFunction(() => !document.querySelector("#lock-submit").disabled, null, { timeout: 5000 });
  await $("#lock-pin").fill(PIN2); await $("#lock-submit").click();
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok(!!(await sessionRec()).rec, "new PIN unlocks and persists a fresh record");

  at("session (c): explicit 잠금 → record deleted → reload → PIN pane");
  await railClick("#rail-lock");
  await page.waitForSelector("body.locked");
  ok(/잠금 버튼/.test(await $("#lock-reason").innerText()), "reason line: manual lock");
  ok(!(await sessionRec()).rec, "manual lock deleted the session record");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open"); await page.waitForSelector("#lock-unlock:not([hidden])");
  ok(true, "reload after an explicit lock → PIN pane");
  await unlockAs("홍 원장", PIN2);
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });

  at("session (d): 8h → a second tab resumes; locking there locks this tab; unlocking there resumes it; 탭을 닫으면 잠금 → new tab asks PIN");
  const pT = await context.newPage(); watch(pT, "[tab2] "); await blockAll(pT);
  await pT.goto(BASE, { waitUntil: "domcontentloaded" });
  await pT.waitForSelector("body:not(.locked)", { timeout: 20000 });
  ok(await pT.evaluate(() => !document.querySelector("#lock-scrim").classList.contains("open") && document.querySelector("#lock-unlock").hidden), "second tab resumes from the IndexedDB record — no PIN pane");
  await pT.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 11, null, { timeout: 15000 });
  ok(true, "second tab shows the decrypted roster (11 rows incl. 신유진)");
  await railClick("#rail-lock", pT);
  await pT.waitForSelector("body.locked");
  await page.waitForSelector("body.locked", { timeout: 5000 });
  ok(/다른 탭에서 잠겼습니다/.test(await $("#lock-reason").innerText()), "locking in tab 2 locks tab 1 (BroadcastChannel · reason 다른 탭)");
  ok(!(await sessionRec()).rec, "session record gone after the cross-tab lock");
  await unlockAs("홍 원장", PIN2, pT);
  await pT.waitForSelector("body:not(.locked)", { timeout: 30000 });
  await page.waitForSelector("body:not(.locked)", { timeout: 10000 });
  ok(await ent(page, (E, S) => S.isUnlocked() && !S.hasRawGrant()), "unlocking in tab 2 resumes tab 1 from the new record (no grant there — it typed no PIN)");
  await pT.close();
  await railClick("#rail-users"); await page.waitForSelector("#users-scrim.open");
  await $("#users-session").selectOption("tab");
  await page.waitForFunction(() => /세션 유지: 탭을 닫으면 잠금/.test(document.querySelector("#users-msg")?.textContent || ""));
  await $("#users-close").click(); await closed("#users-scrim");
  const sessTab = await sessionRec();
  ok(sessTab.rec?.mode === "tab" && typeof sessTab.rec.nonce === "string" && sessTab.rec.nonce.length === 32 && (await page.evaluate(() => sessionStorage.getItem("vibe.clinic-admin.session-nonce"))) === sessTab.rec.nonce, "tab mode: record re-persisted with a nonce that matches this tab's sessionStorage");
  ok(/세션 만료/.test(await $("#topbar-user").getAttribute("title")), "chip tooltip still shows an expiry (tab mode is capped at 8 h)");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("body:not(.locked)", { timeout: 20000 });
  ok(await page.evaluate(() => document.querySelector("#lock-unlock").hidden), "tab mode: a reload of the SAME tab still resumes (sessionStorage survives a reload)");
  const pT2 = await context.newPage(); watch(pT2, "[tab3] "); await blockAll(pT2);
  await pT2.goto(BASE, { waitUntil: "domcontentloaded" });
  await pT2.waitForSelector("#lock-scrim.open"); await pT2.waitForSelector("#lock-unlock:not([hidden])");
  const hintTab = await pT2.locator("#lock-persist-hint").innerText();
  ok(/새로 고침해도 잠기지 않아요 · 탭을 닫거나 10분 미사용 시 잠금/.test(hintTab), `tab mode: a NEW tab (no nonce) gets the PIN pane; hint says 탭을 닫거나 (${hintTab})`);
  await pT2.close();
  ok(!(await sessionRec()).rec && (await ent(page, (E, S) => S.isUnlocked())), "the new tab's failed restore dropped the stale record; this tab stays unlocked in memory");
  await railClick("#rail-users"); await page.waitForSelector("#users-scrim.open");
  await $("#users-session").selectOption("8h");
  await page.waitForFunction(() => /세션 유지: 8시간/.test(document.querySelector("#users-msg")?.textContent || ""));
  await $("#users-close").click(); await closed("#users-scrim");
  ok((await sessionRec()).rec?.mode === "8h" && (await page.evaluate(() => sessionStorage.getItem("vibe.clinic-admin.session-nonce"))) !== null, "back to 8h: record re-persisted (the old nonce string may stay in sessionStorage — it is not consulted)");

  at("session: a record older than the idle window (browser closed for 11 min) is not resumed");
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("vibe-clinic-admin-session"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const st = db.transaction("session", "readwrite").objectStore("session");
    const rec = await new Promise((res, rej) => { const r = st.get("current"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    rec.lastActiveAt = Date.now() - 11 * 60000;
    await new Promise((res, rej) => { const r = st.put(rec, "current"); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
    db.close();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open"); await page.waitForSelector("#lock-unlock:not([hidden])");
  ok(!(await sessionRec()).rec, "stale record (lastActiveAt 11 min ago > 10 min idle) → PIN pane, record deleted");
  await unlockAs("홍 원장", PIN2);
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });

  at("session (b): idle auto-lock under fake timers (10 min) → record deleted → reload → PIN pane");
  await page.clock.install();
  await wait(1100); // past the 1 s activity throttle
  await page.keyboard.press("Shift"); // activity → the idle timer is re-armed on the fake clock
  await page.evaluate(async () => (await import("./js/security/lockscreen.js")).Lock.armIdle()); // and explicitly, in case the throttle still held
  await wait(100);
  await page.clock.runFor(10 * 60000 + 2000);
  await page.waitForSelector("body.locked", { timeout: 5000 });
  ok(/10분 동안 활동이 없어/.test(await $("#lock-reason").innerText()), "idle lock fired (reason: 10분 무활동)");
  ok(!(await sessionRec()).rec, "idle lock deleted the session record");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open"); await page.waitForSelector("#lock-unlock:not([hidden])");
  ok(true, "reload after the idle lock → PIN pane");

  at("session (e): absolute expiry (fake Date.now +8 h) → lock → reload → PIN pane");
  await unlockAs("홍 원장", PIN2);
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok(!!(await sessionRec()).rec, "PIN unlock persisted a fresh record");
  // Jump the clock 8 h in 9-minute hops with activity between them: the idle timer keeps being re-armed, so the only
  // timer that can fire is the absolute expiry (a single 8 h jump would trip the due idle timer first — also correct).
  let hops = 0;
  while (hops < 60 && !(await page.evaluate(() => document.body.classList.contains("locked")))) { await page.clock.fastForward(9 * 60000); await page.keyboard.press("Shift"); hops++; }
  await page.waitForSelector("body.locked", { timeout: 5000 });
  ok(hops >= 53 && hops <= 55 && /세션 시간\(8시간\)이 지나/.test(await $("#lock-reason").innerText()), `absolute-expiry lock fired after ${hops} × 9 min with activity in between (reason: 세션 시간 8시간)`);
  ok(!(await sessionRec()).rec, "expiry deleted the session record");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open"); await page.waitForSelector("#lock-unlock:not([hidden])");
  ok(true, "reload after expiry → PIN pane");
  const auditWhy = await page.evaluate(async (pin) => { const { Session } = await import("./js/security/session.js"); await Session.unlock(Session.users().find(u => u.name === "홍 원장").id, pin); const { Store, ActivityLog } = await import("./js/core/store.js"); await Store.whenUnlocked(); return ActivityLog.all().slice(0, 40).map(e => e.action); }, PIN2);
  ok(auditWhy.includes("잠금 (자동 · 세션 만료)") && auditWhy.includes("잠금 (자동 · 무활동)") && auditWhy.some(a => /세션 유지 설정 변경/.test(a)), `audit carries 세션 만료 · 무활동 locks + the session-length change (${auditWhy.filter(a => /잠금|세션/.test(a)).slice(0, 8).join(" | ")})`);
  await page.waitForSelector("body:not(.locked)", { timeout: 30000 });

  /* 12 · LEGACY DEVICE WORKSPACE → SERVER (reset instance), then LEGACY KEYS → ENTITIES, activateTab ctx, Batches cap, v1 backup */
  at("legacy: reset server + a device with a pre-cloud __ws keyring and data encrypted under ITS key → bootstrap-from-legacy keeps the data readable");
  await page.goto("about:blank"); // the desktop story is done — drop its realtime stream before the server restarts
  await resetPB();
  const ctxL = await newCtx({ ...VIEW, locale: "ko-KR" });
  const pL = await ctxL.newPage();
  shotPage = pL;
  watch(pL, "[legacy] ");
  await blockAll(pL);
  const $L = (sel) => pL.locator(sel);
  await pL.goto(BASE, { waitUntil: "domcontentloaded" });
  await pL.waitForSelector("#lock-setup:not([hidden])", { timeout: 20000 });
  ok(await $L("#setup-legacy").isHidden(), "fresh server + clean profile: no legacy offer");
  // Plant what the previous build left behind: the device keyring (2 users, 4-digit PINs) + staff.list encrypted under its master key.
  const legacyIds = await pL.evaluate(async ([names]) => {
    const C = await import("./js/security/crypto.js");
    const raw = C.generateMasterRaw();
    const owner = { id: "u-legacy01", name: "홍 원장", role: "원장", staffId: "st-legacy-owner", created: Date.now(), ...(await C.wrapMaster(raw, "1234")), aiConsent: null, fails: 0, lockedUntil: 0 };
    const other = { id: "u-legacy02", name: "박서연", role: "행정", staffId: null, created: Date.now(), ...(await C.wrapMaster(raw, "9876")), aiConsent: null, fails: 0, lockedUntil: 0 };
    localStorage.setItem("vibe.clinic-admin.__ws", JSON.stringify({ v: 1, id: "ws-legacy-0123456789abcdef", created: Date.now(), autolockMin: 30, sessionMode: "4h", users: [owner, other] }));
    const key = await C.importSessionKey(raw);
    const rows = [{ id: "st-legacy-owner", name: "홍 원장", job: "한의사", licenseNo: "10101", acquired: "2005-01-10", reported: "2024-01-10", cme: "", note: "", userId: "u-legacy01", created: Date.now() },
      { id: "st-legacy-01", name: names[0], job: "간호사", licenseNo: "40404", acquired: "2012-03-02", reported: "2024-05-15", cme: "", note: "", userId: null, created: Date.now() }];
    localStorage.setItem("vibe.clinic-admin.staff.list", JSON.stringify(await C.encryptJSON(key, rows)));
    localStorage.setItem("vibe.clinic-admin.patients.register", JSON.stringify(await C.encryptJSON(key, { "P-2026-0142": { pid: "P-2026-0142", tags: ["자보"], firstSeen: "2026-08-01", lastSeen: "2026-08-03" } })));
    localStorage.setItem("vibe.clinic-admin.org.profile", JSON.stringify({ name: "옛 한방병원", ykiho: "22000456", biz: "987-65-43210", kind: "병원", rep: "홍 원장" }));
    return { rawB64: C.b64(raw) };
  }, [["고은별"]]);
  await pL.reload({ waitUntil: "domcontentloaded" });
  await pL.waitForSelector("#setup-legacy:not([hidden])", { timeout: 20000 });
  ok(await $L("#lock-setup").isVisible() && (await $L("#legacy-user option").count()) === 1 && /홍 원장 · 원장/.test(await $L("#legacy-user").innerText()) && /사용자 2명/.test(await $L("#legacy-note").innerText()), "setup pane now offers 「이 기기의 워크스페이스를 서버로 올리기」 listing the legacy 원장 (the 행정 user cannot be moved)");
  ok((await $L("#setup-clinic").inputValue()) === "옛 한방병원", "clinic name prefilled from the device's org profile");
  await noKeys("legacy offer", "#lock-scrim", pL);
  if (MOBILE) await noOverflow("lock screen (legacy offer)", pL);
  await $L("#legacy-old-pin").fill("1234"); await $L("#legacy-new-pin").fill(""); await $L("#legacy-new-pin2").fill("");
  await $L("#legacy-submit").click();
  await pL.waitForFunction(() => { const e = document.querySelector("#legacy-err"); return e && !e.hidden; });
  ok(/6~8자리/.test(await $L("#legacy-err").innerText()), "a 4-digit legacy PIN cannot be kept — a new 6–8 digit PIN is required");
  await $L("#legacy-old-pin").fill("1111"); await $L("#legacy-new-pin").fill(OWNER_PIN); await $L("#legacy-new-pin2").fill(OWNER_PIN);
  await $L("#legacy-submit").click();
  await pL.waitForFunction(() => /기존 워크스페이스의 PIN/.test(document.querySelector("#legacy-err")?.textContent || ""));
  ok(true, "wrong legacy PIN → refused (nothing created on the server)");
  ok((await (await fetch(PB_LOCAL + "/api/collections/workspace/records")).json()).totalItems === 0, "server still has no workspace after the failed attempt");
  await $L("#legacy-old-pin").fill("1234"); await $L("#legacy-new-pin").fill(OWNER_PIN); await $L("#legacy-new-pin2").fill(OWNER_PIN);
  await $L("#legacy-submit").click();
  await pL.waitForSelector("body:not(.locked)", { timeout: 30000 });
  const mig0 = await ent(pL, async (E, S, St, Ev, a, C) => ({ users: S.users().map(u => [u.name, u.role, u.staffId]), ws: S.workspace(), wsKey: localStorage.getItem("vibe.clinic-admin.__ws"), lock: JSON.parse(localStorage.getItem("vibe.clinic-admin.__lock") || "{}"), staff: E.Staff.list().map(s => [s.name, s.id, s.userId]), patients: E.Patients.list().map(p => p.pid), me: S.user(), raw: C.b64(await C.unwrapMaster(S.exportKeyring().users[0], "123456")) }));
  ok(mig0.ws?.bootstrapped && mig0.ws.name === "옛 한방병원" && mig0.users.length === 1 && mig0.users[0][0] === "홍 원장" && mig0.users[0][2] === "st-legacy-owner", `server bootstrapped from the legacy keyring: workspace ${mig0.ws?.name}, one user 홍 원장 with the legacy staffId`);
  ok(mig0.raw === legacyIds.rawB64, "the SAME master key travelled to the server (unwrapping the server copy yields the legacy raw key)");
  ok(mig0.staff.some(([n, id]) => n === "고은별" && id === "st-legacy-01") && mig0.staff.some(([n, id, uid]) => n === "홍 원장" && id === "st-legacy-owner" && uid === mig0.me.id) && mig0.patients.includes("P-2026-0142"), `existing encrypted local data still decrypts (roster ${mig0.staff.map(s => s[0]).join(", ")} · patients ${mig0.patients.join(", ")}) and the creator row now links the server login`);
  ok(mig0.wsKey === null && mig0.lock.autolockMin === 30 && mig0.lock.sessionMode === "4h", "legacy keyring (__ws) deleted; its lock settings carried over to __lock");
  await settled(pL, 15000);
  const legacyBlobs = await serverRows("sync_blob");
  ok(legacyBlobs.some(r => r.key === "staff.list" && isEnv(r.payload)) && legacyBlobs.some(r => r.key === "patients.register") && legacyBlobs.some(r => r.key === "org.profile") && legacyBlobs.every(r => !r.deleted), `first device with existing local data + EMPTY server → everything pushed on the first sync (${legacyBlobs.length} rows: ${legacyBlobs.map(r => r.key).join(", ")})`);
  ok(await pL.evaluate(() => Array.from(document.querySelectorAll("#toast-tray .toast")).some(t => /서버로 올렸습니다/.test(t.textContent) && /1명/.test(t.textContent))), "toast: moved to the server, 1 user not migrated (re-issue)");
  ok(!(await $L("#org-scrim").evaluate(el => el.classList.contains("open"))), "no first-run 기관 정보 step (the device already had a complete profile)");
  await pL.waitForSelector("#welcome-scrim.open", { timeout: 15000 });
  await $L("#welcome-blank").click();
  await pL.waitForFunction(() => !document.querySelector("#welcome-scrim")?.classList.contains("open"));

  at("legacy: pre-entities keys (license.list / yearend.* / bigeup.*) → unlock migrates them");
  await ent(pL, (E) => E.Org.set({ name: "", ykiho: "", biz: "", rep: "" })); // empty the profile so the legacy org keys have something to fill
  ok((await ent(pL, (E) => E.Org.isComplete())) === false, "org profile emptied for the migration check");
  // Plant the pre-entities keys as plaintext (what an older build left behind), then lock → unlock.
  await pL.evaluate(([names]) => {
    const NS = "vibe.clinic-admin.";
    localStorage.setItem(NS + "license.list", JSON.stringify([
      { id: "lic-legacy-01", role: "한의사", name: names[0], licenseNo: "77777", acquired: "2010-03-02", reported: "2024-01-15", cme: "", expiry: "2027-01-15", basis: "reported" },
      { id: "lic-legacy-02", role: "원무",   name: names[1], licenseNo: "", acquired: "", reported: "", cme: "", expiry: "", basis: "none" }
    ]));
    localStorage.setItem(NS + "yearend.ye-biz", JSON.stringify("987-65-43210"));
    localStorage.setItem(NS + "yearend.ye-clinic", JSON.stringify("옛 한방병원"));
    localStorage.setItem(NS + "bigeup.profile.bg-ykiho", JSON.stringify("22000456"));
    localStorage.setItem(NS + "bigeup.profile.bg-clinic", JSON.stringify("옛 한방병원"));
    localStorage.setItem(NS + "bigeup.profile.bg-date", JSON.stringify("2026-03-01"));
    localStorage.setItem(NS + "bigeup.tariff", JSON.stringify({ "예시-01": { min: "10000", max: "20000", med: "15000", freq: "12" } }));
  }, [LEGACY_STAFF]);
  await railClick("#rail-lock", pL);
  await pL.waitForSelector("body.locked");
  await unlockAs("홍 원장", OWNER_PIN, pL);
  await pL.waitForSelector("body:not(.locked)", { timeout: 30000 });
  const mig = await ent(pL, (E, Session) => ({
    staff: E.Staff.list().map(s => [s.name, s.job, s.id, !!s.userId]), org: E.Org.get(), tariff: E.Tariff.all(), date: E.Tariff.effectiveDate(),
    me: Session.user(), byUser: E.Staff.byUser(Session.user().id)?.name,
    legacyLeft: Object.keys(localStorage).filter(k => /vibe\.clinic-admin\.(license\.list|yearend\.ye-biz|yearend\.ye-clinic|bigeup\.profile\.|bigeup\.tariff)/.test(k))
  }));
  ok(mig.staff.some(([n, j, id]) => n === LEGACY_STAFF[0] && j === "한의사" && id === "lic-legacy-01") && mig.staff.some(([n, j]) => n === LEGACY_STAFF[1] && j === "원무") && mig.staff.some(([n]) => n === "고은별"), `license.list → Staff (ids kept, the legacy-encrypted 고은별 row still there): ${mig.staff.map(([n, j]) => `${j} ${n}`).join(", ")}`);
  ok(mig.org.biz === "987-65-43210" && mig.org.name === "옛 한방병원" && mig.org.ykiho === "22000456", `yearend.* + bigeup.profile.* → Org ${JSON.stringify(mig.org)}`);
  ok(mig.tariff["예시-01"]?.min === "10000" && mig.date === "2026-03-01", "bigeup.tariff + bg-date → Tariff");
  ok(mig.legacyLeft.length === 0, `legacy keys deleted after migration (${mig.legacyLeft.join(", ") || "none left"})`);
  ok(mig.me.staffId === "st-legacy-owner" && mig.byUser === "홍 원장", "creator user linked to its roster row (staffId)");
  ok((await $L("#lic-list .lic").count()) === 4, "roster renders 4 rows (creator + 고은별 + 정민재 + 송하린)");
  ok(/987-65-43210/.test(await $L("#ye-org").innerText()) && /22000456/.test(await $L("#bg-org").innerText()) && (await $L("#bg-tbody .bg-min").first().inputValue()) === "10000", "03/04 render the migrated Org read-only; 04 table shows the migrated tariff (no Store aliases involved)");

  at("activateTab(id, ctx) emits tab:activated { id, ctx } exactly once");
  const payload = await ent(pL, (E, Session, Store, EventBus, activateTab) => new Promise(res => { const got = []; EventBus.on("tab:activated", p => { if (p?.id === "tab-yearend") got.push(p); }); activateTab("tab-yearend", { taxYear: 2025 }); setTimeout(() => res(got), 50); }));
  ok(payload.length === 1 && payload[0].ctx?.taxYear === 2025, `one payload ${JSON.stringify(payload)}`);
  const payload2 = await ent(pL, (E, Session, Store, EventBus, activateTab) => new Promise(res => { EventBus.on("tab:activated", p => { if (p?.id === "tab-kcd") res(p); }); activateTab("tab-kcd"); }));
  ok(payload2.id === "tab-kcd" && payload2.ctx === null, "no ctx → ctx: null");
  const util = await ent(pL, (E, Session, Store, EventBus, activateTab) => new Promise(res => { EventBus.on("tab:activated", p => { if (p?.id === "tab-ai") res({ p, open: document.querySelector("#ai-drawer").classList.contains("open"), panel: document.querySelector(".panel.active")?.id, note: document.querySelector("#ai-input").value }); }); activateTab("tab-ai", { prefill: "M54.5 요통", append: true }); }));
  ok(util.p.ctx?.prefill === "M54.5 요통" && util.open && util.panel === "tab-kcd" && util.note.includes("M54.5"), `activateTab("tab-ai", ctx) opens the drawer, emits tab:activated { id: "tab-ai", ctx }, leaves the panel (${util.panel}), fills the note`);
  await $L("#ai-drawer-close").click();

  at("Batches: create / list / latest / cap 20 / remove — encrypted claims.batch.* keys");
  const bt = await ent(pL, (E) => {
    const ids = [];
    for (let i = 0; i < 22; i++) ids.push(E.Batches.create({ kind: i % 2 ? "claims" : "review", source: `f${i}.xlsx`, rows: [{ stmt: "S" + i, pid: "P-2026-0142", date: "2026-09-01" }], meta: { i } }));
    const all = E.Batches.list();
    const latest = E.Batches.latest("claims");
    const rec = E.Batches.get(ids[21]);
    E.Batches.remove(ids[21]);
    return { n: all.length, latestSrc: latest?.source, first: ids[0], firstGone: !E.Batches.get(ids[0]), count: rec?.count, by: rec?.createdBy, enc: Object.keys(localStorage).filter(k => k.includes(".claims.batch.")).every(k => JSON.parse(localStorage.getItem(k)).ct), after: E.Batches.list().length, kinds: E.Batches.list("review").every(b => b.kind === "review") };
  });
  ok(bt.n === 20 && bt.firstGone && bt.latestSrc === "f21.xlsx" && bt.count === 1 && bt.by?.staffId && bt.by?.name === "홍 원장", `cap 20 (oldest evicted), latest(kind), createdBy {staffId,name} · n=${bt.n} firstGone=${bt.firstGone} latest=${bt.latestSrc} count=${bt.count} by=${JSON.stringify(bt.by)}`);
  ok(bt.enc && bt.after === 19 && bt.kinds, "batches stored as AES-GCM envelopes; remove() works; list(kind) filters");

  at("v1/v2 backups (device-local keyring) are refused with the migration hint; a v3 backup under a FOREIGN key is refused after the server check");
  const v1 = await ent(pL, async (E, Session, Store, EventBus, activateTab, C) => {
    const key = Session.key();
    return JSON.stringify({
      format: "vibe.clinic-admin.backup", v: 1, exportedAt: new Date().toISOString(), poc: "PoC — 실제 제출 불가 · 데모 데이터",
      keyring: { v: 1, id: "x", users: [{ id: "u-old", name: "홍 원장", role: "원장" }] },
      sensitive: { "license.list": await C.encryptJSON(key, []) }, plain: await C.encryptJSON(key, { "ui.welcomed": true }), attachments: []
    });
  });
  // A v3 file made under ANOTHER clinic's key (built while still unlocked): the PIN opens the file, but the server comparison fails → nothing touched.
  const foreign = await pL.evaluate(async () => {
    const C = await import("./js/security/crypto.js");
    const raw = C.generateMasterRaw(); const key = await C.importSessionKey(raw);
    const { Session } = await import("./js/security/session.js"); const me = Session.user();
    return JSON.stringify({ format: "vibe.clinic-admin.backup", v: 3, exportedAt: new Date().toISOString(), poc: "PoC", keyring: { v: 3, workspace: { slug: "default", name: "다른 병원" }, users: [{ id: me.id, name: me.name, role: me.role, staffId: me.staffId, ...(await C.wrapMaster(raw, "123456")) }] }, sensitive: {}, plain: await C.encryptJSON(key, { "ui.welcomed": true }), attachments: [] });
  });
  await goTab("tab-privacy", pL);
  await $L("#privacy-restore").click();
  await pL.waitForSelector("#lock-restore:not([hidden])");
  await $L("#restore-file").setInputFiles({ name: "clinic-admin_backup_v1.json", mimeType: "application/json", buffer: Buffer.from(v1) });
  await pL.waitForFunction(() => { const e = document.querySelector("#restore-err"); return e && !e.hidden; });
  ok(/v1 백업/.test(await $L("#restore-err").innerText()) && /서버로 올리기/.test(await $L("#restore-err").innerText()) && (await $L("#restore-step2").isHidden()), "v1 file → refused with the 「서버로 올리기」 hint, no user/PIN step");
  await $L("#restore-file").setInputFiles({ name: "clinic-admin_backup_foreign.json", mimeType: "application/json", buffer: Buffer.from(foreign) });
  await pL.waitForSelector("#restore-step2:not([hidden])");
  await $L("#restore-pin").fill(OWNER_PIN);
  pL.once("dialog", d => d.accept());
  await $L("#restore-submit").click();
  await pL.waitForFunction(() => /다른 워크스페이스 키/.test(document.querySelector("#restore-err")?.textContent || ""), null, { timeout: 20000 });
  ok(await pL.evaluate(() => { const s = JSON.parse(localStorage.getItem("vibe.clinic-admin.staff.list") || "null"); return !!(s && s.iv && s.ct) && JSON.parse(localStorage.getItem("vibe.clinic-admin.org.profile")).name === "옛 한방병원"; }), "foreign-key backup refused after the server comparison — local data untouched on disk (staff envelope + org intact)");
  await $L("#restore-back").click();
  await pL.waitForSelector("#lock-unlock:not([hidden])", { timeout: 20000 });
  await unlockAs("홍 원장", OWNER_PIN, pL);
  await pL.waitForSelector("body:not(.locked)", { timeout: 30000 });
  ok((await ent(pL, (E) => E.Staff.list().length)) === 4 && (await ent(pL, (E) => E.Org.get().name)) === "옛 한방병원", "…and it still decrypts after the unlock (roster 4, org intact)");
  await ctxL.close();

  /* 13 · ENGLISH pass — fresh profile on a reset server */
  at("EN: fresh profile → EN toggle on the lock screen → bootstrap pane is English");
  await resetPB();
  const ctx2 = await newCtx({ ...VIEW, locale: "en-GB" });
  const p2 = await ctx2.newPage();
  shotPage = p2;
  watch(p2, "[EN] ");
  await blockAll(p2);
  const $2 = (sel) => p2.locator(sel);
  const goTab2 = (panel) => goTab(panel, p2);
  // Desktop: topbar toggle. Phone: the topbar toggle is hidden, the ⋯ sheet (rail foot) carries it.
  const setLang2 = async (lang) => {
    if (MOBILE) { await $2("#bottombar-more").click(); await p2.waitForTimeout(350); await $2(`.rail-foot .lang-toggle button[data-lang="${lang}"]`).click(); await p2.evaluate(() => document.body.classList.remove("more-open")); }
    else await $2(`.topbar .lang-toggle button[data-lang="${lang}"]`).click();
    await p2.waitForFunction((l) => document.documentElement.lang === l, lang);
  };
  const download2 = async (action) => { const [dl] = await Promise.all([p2.waitForEvent("download", { timeout: 15000 }), action()]); const path = await dl.path(); return { name: dl.suggestedFilename(), text: path ? readFileSync(path, "utf8") : "" }; };
  const panelTexts = (panel) => p2.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(e => e.textContent), EN_SELECTOR(panel));
  const noOverflow2 = (label) => noOverflow(`[EN] ${label}`, p2);

  await p2.goto(BASE, { waitUntil: "domcontentloaded" });
  await p2.waitForSelector("#lock-scrim.open");
  await p2.waitForSelector("#lock-setup:not([hidden])", { timeout: 20000 });
  ok((await p2.evaluate(() => document.documentElement.lang)) === "ko", "fresh profile boots in Korean");
  await $2('#lock-scrim .lang-toggle button[data-lang="en"]').click();
  await p2.waitForFunction(() => document.documentElement.lang === "en");
  ok((await $2('#lock-scrim .lang-toggle button[data-lang="en"]').getAttribute("aria-pressed")) === "true" && (await $2('#lock-scrim .lang-toggle button[data-lang="ko"]').getAttribute("aria-pressed")) === "false", "lock-screen toggle aria-pressed reflects EN");
  const setupTxt = await $2("#lock-setup").innerText();
  ok(/Create workspace on the server/.test(setupTxt) && /institution name/i.test(setupTxt) && leftoverHangul([setupTxt]).length === 0, `bootstrap pane is English (${leftoverHangul([setupTxt]).join(" | ") || "no Hangul"})`); // labels are CSS-uppercased → innerText is upper-case
  ok((await p2.title()).startsWith("Clinic Admin Toolkit"), `document.title in English (${await p2.title()})`);
  if (MOBILE) await noOverflow2("lock screen (setup)");
  await $2("#setup-clinic").fill("Hansol KM Hospital"); await $2("#setup-name").fill("KW");
  await $2("#setup-pin").fill(OWNER_PIN); await $2("#setup-pin2").fill(OWNER_PIN);
  await $2("#setup-submit").click();
  await p2.waitForSelector("body:not(.locked)", { timeout: 30000 });
  await p2.waitForSelector("#org-scrim.open", { timeout: 15000 });
  const orgTxt = await $2("#org-scrim .welcome").innerText();
  ok(/Fill in later/.test(orgTxt) && leftoverHangul([orgTxt]).length === 0, `EN: org step is English (${leftoverHangul([orgTxt]).join(" | ") || "no Hangul"})`);
  if (MOBILE) await noOverflow2("org step");
  await $2("#orgstep-skip").click();
  await p2.waitForSelector("#welcome-scrim.open", { timeout: 15000 });
  const welcomeTxt = await $2("#welcome-scrim .welcome").innerText();
  ok(leftoverHangul([welcomeTxt]).length === 0 && /Tour with sample data/.test(welcomeTxt), `welcome overlay is English (${leftoverHangul([welcomeTxt]).join(" | ") || "no Hangul"})`);
  ok(/five areas/i.test(welcomeTxt) && /Home · Patients · Claims/.test(welcomeTxt) && /Search/.test(welcomeTxt) && /AI assist/.test(welcomeTxt), "EN deck names the five areas + two utilities");

  at("EN: seed → every tab free of Hangul in headings/buttons/headers/labels/pills/caveats");
  await $2("#welcome-seed").click();
  await p2.waitForFunction(() => !document.querySelector("#welcome-scrim")?.classList.contains("open"));
  await p2.waitForFunction(() => { const p = document.querySelector("#ai-mode-pill"); return p && !p.hidden; }, null, { timeout: 25000 });
  await p2.waitForFunction(() => document.querySelector("#jabo-recon-toolbar")?.style.display === "flex", null, { timeout: 15000 });
  await waitUsers(4, p2);
  await p2.waitForTimeout(900);
  ok((await $2("#topbar-org-text").innerText()) === ORG.name, "EN: seed filled the skipped org profile (chip = 한솔한방병원)");
  const crumb2 = await p2.evaluate(() => [document.querySelector("#crumb-section")?.textContent, document.querySelector("#crumb-tab")?.textContent]);
  ok(crumb2[0] === "Home" && crumb2[1] === "Today", `crumb in English (${crumb2.join(" › ")})`);
  const chromeEn = await p2.evaluate(() => [...document.querySelectorAll("#rail-areas .area-label, #rail-areas [data-panel], #bottombar span, #topbar-search, #topbar-ai, #rail-foot .rail-btn, .rail-foot .rail-btn")].map(e => e.textContent));
  ok(leftoverHangul(chromeEn).length === 0, `EN: navigation chrome (areas · panels · bottom bar · topbar buttons · ⋯ sheet) free of Hangul (${leftoverHangul(chromeEn).slice(0, 4).join(" | ") || "none"})`);
  ok((await $2("#topbar-user-text").innerText()) === "KW · Director", `topbar user chip role in English (${await $2("#topbar-user-text").innerText()})`);
  const EN_SELECTOR2 = (panel) => EN_SELECTOR(panel) + `, #${panel} .todo-group-label, #${panel} .insight .label, #${panel} h4, #${panel} h5`;
  const panelTexts2 = (panel) => p2.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(e => e.textContent), EN_SELECTOR2(panel));
  for (const panel of PANELS) { // all 18
    await goTab2(panel);
    if (panel === "tab-today") { await p2.evaluate(() => document.querySelectorAll("#tab-today details").forEach(d => { d.open = true; })); if (await $2("#dday-more").count()) await $2("#dday-more").click(); if (await $2("#todo-more").count()) await $2("#todo-more").click(); }
    if (panel === "tab-privacy") await p2.waitForFunction(() => document.querySelectorAll("#privacy-table tr").length > 5);
    if (panel === "tab-appeal") { await p2.evaluate(() => document.querySelector("#appeal-list tr.appeal-row")?.click()); await p2.waitForSelector("#appeal-list tr.appeal-edit"); }
    if (["tab-guarantee", "tab-docs", "tab-consent"].includes(panel)) { await $2(`#${panel} [data-new]`).click(); await p2.waitForSelector(`#${panel} [data-editor]:not([hidden])`); }
    const left = leftoverHangul(await panelTexts2(panel));
    ok(left.length === 0, `${panel}: English only (leftovers: ${left.slice(0, 5).join(" | ") || "none"})`);
    await noKeys(`[EN] ${panel}`, `#${panel}, ${CHROME_SCOPE}`, p2);
    const labEn = await p2.evaluate((id) => ({ rail: document.querySelector(`#rail-areas [data-panel="${id}"]`)?.textContent.trim(), crumb: document.querySelector("#crumb-tab")?.textContent.trim(), area: document.querySelector("#crumb-section")?.textContent.trim(), num: document.querySelector(`#${id} .panel-num`)?.textContent.trim() }), panel);
    ok(labEn.rail === labEn.crumb && labEn.num.replace(/\s*\([^)]*\)\s*$/, "") === `${labEn.area} · ${labEn.rail}`, `[EN] ${panel}: rail “${labEn.rail}” = crumb, head “${labEn.num}”`);
    if (MOBILE) await noOverflow2(panel);
    if (["tab-guarantee", "tab-docs", "tab-consent"].includes(panel)) await $2(`#${panel} [data-editor] [data-cancel]`).click();
  }
  ok(/Prescription \/ treatment days exceeded/.test(await $2("#nhis-reason-list").innerText()), "EN: 건보 reason glossary translated");
  await goTab2("tab-appeal");
  ok(/preparing|submitted|result/i.test(await $2("#appeal-list").innerText()) && /D\+10 overdue/i.test(await $2("#appeal-list").innerText()) && /attention/i.test(await $2("#claims-steps-nhis").innerText()), "EN: appeal statuses + overdue badge + landing 'needs attention' state translated");
  await goTab2("tab-guarantee");
  ok(/Extension requested/i.test(await $2("#tab-guarantee [data-list]").innerText()) && /Samsung Fire/.test(await $2("#tab-guarantee [data-list]").innerText()) && /Expiring D-/i.test(await $2("#tab-guarantee [data-list]").innerText()) && /^auto-insurance guarantees$/i.test(await $2("#crumb-tab").innerText()), "EN: guarantee statuses · insurer labels · badges · crumb");
  ok((await mods(p2, ({ P }) => P.guaranteeDeadlines().map(d => d.label))).every(l => /Auto-insurance guarantee/.test(l) && /Patient \*\*\*\*/.test(l)), "EN: deadline labels follow the language");
  await goTab2("tab-docs");
  const docsEn = await download2(() => $2("#tab-docs [data-export]").click());
  ok(/^document_log_\d{4}-\d{2}-\d{2}_PoC\.xlsx$/.test(docsEn.name), `EN: 발급 대장 export filename (${docsEn.name})`);
  await goTab2("tab-today");
  const enTiles = await p2.evaluate(() => ({ nhis: document.querySelector("#ins-nhis-card .label").innerText, ar: document.querySelector("#ins-ar-card .label").innerText, groups: [...document.querySelectorAll("#todo-list .todo-group-label")].map(e => e.innerText), copy: document.querySelector("#kpi-summary-copy").innerText }));
  ok(/NHIS/i.test(enTiles.nhis) && /Outstanding/i.test(enTiles.ar) && enTiles.groups.some(g => /Overdue/i.test(g)) && /director/i.test(enTiles.copy), `EN: KPI tile labels + todo groups (${enTiles.nhis} · ${enTiles.ar} · ${enTiles.groups.join(", ")})`);
  await $2("#kpi-summary-copy").click(); await p2.waitForTimeout(100);
  const sumEn = await p2.evaluate(() => document.querySelector("#kpi-summary-out").textContent);
  ok(/administration summary/.test(sumEn) && /PoC — not for real submission/.test(sumEn), "EN: summary text + EN PoC line");
  // the two utilities
  await openSearch("약침", p2);
  await p2.waitForSelector("#search-result table");
  const leftSearch = leftoverHangul(await panelTexts("search-scrim"));
  ok(leftSearch.length === 0, `search overlay: English only (leftovers: ${leftSearch.slice(0, 5).join(" | ") || "none"})`);
  ok(/Low back pain/.test(await $2("#search-result").innerText()) || /Pharmacopuncture/.test(await $2("#search-result").innerText()), "EN: search results show bundled English names");
  if (MOBILE) await noOverflow2("search overlay");
  await p2.keyboard.press("Escape");
  await openAi(p2);
  const leftAi = leftoverHangul(await panelTexts("ai-drawer"));
  ok(leftAi.length === 0, `AI drawer: English only (leftovers: ${leftAi.slice(0, 5).join(" | ") || "none"})`);
  ok(/Sprain and strain of cervical spine \(경추의 염좌 및 긴장\)/.test(await $2("#ai-output").innerText()), "EN: AI result shows English name with the Korean standard name in parentheses");
  if (MOBILE) await noOverflow2("AI drawer");
  await $2("#ai-drawer-close").click();
  ok((await $2("#kcd-result tbody tr").count()) === 21 && (await $2("#kcd-result .pill").first().innerText()).length > 0, "EN: KCD result table rendered (21 rows)");
  ok(/rows.*reviewed/.test(await $2("#kcd-summary").innerText()), `EN: KCD summary in English (${await $2("#kcd-summary").innerText()})`);
  ok(/Claim batch/.test(await $2("#jabo-batch-strip").innerText()) && /12 statements/.test(await $2("#jabo-batch-strip").innerText()), "EN: batch strip");
  ok((await $2("#bg-tbody .pill").first().innerText()) === "Pharmacopuncture", "EN: non-covered category pill translated");
  ok(/Institution code/.test(await $2("#bg-org").innerText()) && /Hospital level/.test(await $2("#bg-rule").innerText()), "EN: 04 org block + cadence rule");
  ok(/KM doctor|Nurse/.test(await $2("#lic-list").innerText()) && !/한의사 /.test(await $2("#lic-list .lic-role").first().innerText()), "EN: staff roles in English, names untouched");
  ok(/done|to do/.test(await $2("#claims-steps").innerText()) && !HANGUL.test(stripParens(await $2("#claims-steps .cs-state").first().innerText())), "EN: claims landing step states translated");
  ok(/auto-judged/.test(await $2('.accred-item[data-id="pr2"] .accred-auto').innerText()), "EN: 09 derived badge");
  await goTab2("tab-today");
  const kpiEn = { label: await $2("#ins-cut-card .label").innerText(), ins: await $2("#ins-insurer").innerText(), sub: await $2("#ins-jabo-sub").innerText() };
  ok(/adjustment rate/i.test(kpiEn.label) && kpiEn.ins === "Samsung Fire & Marine", `EN: 00 KPI labels + insurer label (${JSON.stringify(kpiEn)})`);

  at("EN: KO round-trip keeps the result tables, then back to EN");
  await goTab2("tab-kcd");
  const kcdRows = await $2("#kcd-result tbody tr").count();
  await setLang2("ko");
  ok((await $2("#kcd-result tbody tr").count()) === kcdRows && /건/.test(await $2("#kcd-summary").innerText()) && (await p2.evaluate(() => document.querySelector("#crumb-tab")?.textContent)) === "상병 정비", "toggle → KO: table kept, summary + crumb Korean");
  ok((await $2("#tab-kcd h3").innerText()).includes("EDI 표준형"), "toggle → KO: static heading restored");
  await goTab2("tab-jabo");
  ok((await $2("#jabo-recon-result tbody tr").count()) === 42 && /명세서/.test(await $2("#jabo-recon-summary").innerText()), "toggle → KO: reconciliation table kept");
  await setLang2("en");
  ok((await $2("#jabo-recon-result tbody tr").count()) === 42 && /statements/.test(await $2("#jabo-recon-summary").innerText()), "toggle → EN again: reconciliation table kept, summary English");
  ok((await $2(MOBILE ? '.rail-foot .lang-toggle button[data-lang="en"]' : '.topbar .lang-toggle button[data-lang="en"]').getAttribute("aria-pressed")) === "true", "toggle aria-pressed = EN");

  at("EN: exports carry English headers + watermark; ⌘K overlay offers the language switch");
  await goTab2("tab-kcd");
  const kcdEn = await download2(() => $2("#kcd-download").click());
  ok(/^diagnosis_codes_.*_PoC\.xlsx$/.test(kcdEn.name), `EN xlsx filename (${kcdEn.name})`);
  await goTab2("tab-yearend");
  const yeEn = await download2(() => $2("#ye-download").click());
  const [yeHead, yeMark] = yeEn.text.split("\n");
  ok(/Patient name/.test(yeHead) && /RRN \(masked\)/.test(yeHead) && !HANGUL.test(yeHead), `EN CSV headers (${yeHead.slice(0, 80)}…)`);
  ok(/PoC — not for real submission/.test(yeMark), "EN CSV watermark row in English");
  await openSearch(null, p2);
  ok(/Switch to Korean/.test(await $2("#search-nav-results").innerText()) && /Open AI assist/.test(await $2("#search-nav-results").innerText()), "overlay lists the language command + the AI utility");
  await noKeys("[EN] search overlay", "#search-scrim", p2);
  await p2.keyboard.press("Escape");
  await mods(p2, ({ activateTab }) => activateTab("tab-ai"));
  await p2.waitForSelector("#ai-drawer.open");
  await noKeys("[EN] AI drawer", "#ai-drawer", p2);
  await $2("#ai-drawer-close").click();
  await railClick("#rail-info", p2); await p2.waitForSelector("#info-scrim.open");
  await noKeys("[EN] info modal", "#info-scrim", p2); await $2("#info-close").click();
  await railClick("#rail-users", p2); await p2.waitForSelector("#users-scrim.open");
  await noKeys("[EN] users modal", "#users-scrim", p2);
  const usersEn = await $2("#users-scrim .welcome").innerText();
  ok(/server user directory/i.test(usersEn) && /temporary pin/i.test(usersEn) && /connected/i.test(await $2("#users-cloud").innerText()) && leftoverHangul([usersEn.replace(/Hansol KM Hospital|KW/g, "")]).length === 0, `[EN] users panel: directory heading, temp-PIN label, server line (${leftoverHangul([usersEn]).slice(0, 3).join(" | ") || "no Hangul"})`);
  await $2("#users-close").click();
  await goTab2("tab-privacy");
  const privEn = await p2.evaluate(() => Array.from(document.querySelectorAll("#privacy-table tr")).map(tr => tr.innerText.replace(/\s+/g, " ")));
  ok(privEn.some(r => /Server user directory/.test(r)) && privEn.some(r => /PIN-derived password/.test(r)) && privEn.some(r => /Server session token/.test(r)) && privEn.some(r => /Lock settings/.test(r)) && /What the server can and cannot see/.test(await $2("#tab-privacy").innerText()), "[EN] register rows for the server identity + the server-visibility paragraph are English");
  await railClick("#rail-demo", p2); await p2.waitForSelector("#welcome-scrim.open");
  await noKeys("[EN] welcome deck", "#welcome-scrim", p2);
  await $2("#welcome-tour").click(); await p2.waitForSelector("#tour-card:not([hidden])");
  for (let i = 1; i < 7; i++) await $2("#tour-next").click();
  const tourEn = await p2.evaluate(() => ({ step: document.querySelector("#tour-card").dataset.step, next: document.querySelector("#tour-next").textContent.trim(), title: document.querySelector("#tour-title").textContent }));
  ok(tourEn.step === "7" && tourEn.next === "Done" && /Organisation/.test(tourEn.title) && (await $2("#tab-license.active").count()) === 1, `[EN] tour reaches step 7 (“${tourEn.title}” · ${tourEn.next})`);
  await noKeys("[EN] tour card", "#tour-card", p2);
  await $2("#tour-next").click(); await p2.waitForSelector("#tour-card[hidden]", { state: "attached" });

  at("EN: resumed session after reload, then lock → lock screen in English (hint line + reason)");
  await p2.reload({ waitUntil: "domcontentloaded" });
  await p2.waitForSelector("body:not(.locked)", { timeout: 20000 });
  ok((await p2.evaluate(() => document.documentElement.lang)) === "en" && !(await p2.evaluate(() => document.querySelector("#lock-scrim").classList.contains("open"))), "<html lang> = en after reload; the session resumed without a PIN pane");
  await railClick("#rail-lock", p2);
  await p2.waitForSelector("body.locked");
  await p2.waitForSelector("#lock-unlock:not([hidden])");
  ok(/Stays unlocked on this device across reloads · locks after 8 h or 10 min idle/.test(await $2("#lock-persist-hint").innerText()), "EN hint line on the unlock pane");
  const unlockTxt = await $2("#lock-unlock").innerText();
  ok(/Unlock/.test(unlockTxt) && /Director/.test(unlockTxt) && leftoverHangul([unlockTxt]).length === 0, `unlock pane in English (${leftoverHangul([unlockTxt]).join(" | ") || "no Hangul"})`);
  ok((await p2.evaluate(() => localStorage.getItem("vibe.clinic-admin.ui.lang"))) === "en", "persisted under vibe.clinic-admin.ui.lang (plain, works while locked)");
  if (MOBILE) await noOverflow2("lock screen (unlock)");
  await ctx2.close();

  at("EN: ?lang=en boots a fresh profile in English (instance exists → unlock pane with the server directory)");
  const ctx3 = await newCtx({ ...VIEW, locale: "ko-KR" });
  const p3 = await ctx3.newPage();
  shotPage = p3;
  p3.on("pageerror", e => pageErrors.push("[EN?lang] " + String(e && e.stack || e)));
  await blockAll(p3);
  await p3.goto(BASE + "?lang=en", { waitUntil: "domcontentloaded" });
  await p3.waitForSelector("#lock-scrim.open");
  await p3.waitForSelector("#lock-unlock:not([hidden])", { timeout: 20000 });
  ok((await p3.evaluate(() => document.documentElement.lang)) === "en", "?lang=en → <html lang> = en");
  const unlock3 = await p3.locator("#lock-unlock").innerText();
  ok(/Unlock/.test(unlock3) && /Director/.test(unlock3) && leftoverHangul([unlock3.replace(/KW|윤지훈|정수아|한지우/g, "")]).length === 0 && (await p3.locator("#lock-user option").count()) === 4, "?lang=en → unlock pane English on a fresh profile, dropdown = the 4 server users");
  ok((await p3.evaluate(() => localStorage.getItem("vibe.clinic-admin.ui.lang"))) === "en", "?lang=en persisted");
  await ctx3.close();

  at("offline: server unreachable + nothing to resume → offline pane with retry (no local workspace creation)");
  const ctx4 = await newCtx({ ...VIEW, locale: "ko-KR" });
  const p4 = await ctx4.newPage();
  shotPage = p4;
  watch(p4, "[offline] ");
  await p4.route(/.*/, (route) => { const u = new URL(route.request().url()); if (u.hostname === "127.0.0.1" && u.port === "8095") return route.abort("failed"); if (u.hostname === "ai.pb.gurum.se" || BLOCKED.test(u.hostname)) return route.abort("failed"); return route.continue(); });
  await p4.goto(BASE, { waitUntil: "domcontentloaded" });
  await p4.waitForSelector("#lock-offline:not([hidden])", { timeout: 20000 });
  const offTxt = await p4.locator("#lock-offline").innerText();
  ok(/서버에 연결할 수 없어요/.test(offTxt) && /마지막으로 로그인한 기기/.test(offTxt) && (await p4.locator("#lock-setup").isHidden()) && (await p4.locator("#lock-unlock").isHidden()), "offline pane: message + retry, no setup (no local-only workspace any more), no unlock");
  await noKeys("offline pane", "#lock-scrim", p4);
  if (MOBILE) await noOverflow("offline pane", p4);
  await p4.unroute(/.*/); await blockAll(p4);
  await p4.locator("#offline-retry").click();
  await p4.waitForSelector("#lock-unlock:not([hidden])", { timeout: 20000 });
  ok((await p4.locator("#lock-user option").count()) === 4, "retry once the server is reachable → unlock pane with the directory");
  await ctx4.close();

  /* 14 · errors */
  at("zero page errors / console errors");
  ok(pageErrors.length === 0, `page errors: ${pageErrors.length}${pageErrors.length ? "\n" + pageErrors.join("\n") : ""}`);
  ok(consoleErrors.length === 0, `console errors: ${consoleErrors.length}${consoleErrors.length ? "\n" + consoleErrors.join("\n") : ""}`);

  console.log(`\nPASS — ${checks.length} assertions (${MOBILE ? "mobile" : "desktop"})`);
} catch (err) {
  console.error("\nFAIL:", err.message);
  if (pageErrors.length) console.error("page errors:\n" + pageErrors.join("\n"));
  if (consoleErrors.length) console.error("console errors:\n" + consoleErrors.join("\n"));
  console.error("pocketbase log (tail):\n" + pbLocal.log().split("\n").slice(-15).join("\n"));
  try { await shotPage.screenshot({ path: `/tmp/clinic-admin-e2e-fail-${MOBILE ? "mobile" : "desktop"}.png`, fullPage: false }); console.error("screenshot: /tmp/clinic-admin-e2e-fail-*.png"); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
  await pbLocal.stop();
}
