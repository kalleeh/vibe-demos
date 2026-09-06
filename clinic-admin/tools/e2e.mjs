#!/usr/bin/env node
/* clinic-admin — integrated end-to-end run (headless Chrome via Playwright).
   Serves the repo root on :8501, blocks every external host (PocketBase, jsdelivr, Google Fonts),
   mocks the Claude proxy with a forced tool_use answer, then drives the whole app once:
   first-run workspace → 기관 정보 step → welcome deck (five areas + two utilities) → sample seed (shared entities + every
   tool; lands on 홈 with the todo list populated) → the CONNECTED STORY across the one fictional clinic (심사결과 대조 cuts
   on ****0142 → 상병 정비 focused on a 명세서 → AI DRAWER prefilled from a 상병 row / a 대조 row → drawer fills a 자보 case →
   SEARCH OVERLAY checks a code, shows 우리 단가, inserts an item → 청구 배치 landing: batch card + 3 steps → 연말정산
   cross-check → 비급여 org read-only + cadence + 고지문 → 보존 aliases → 인증 derived badges → 홈 todo/KPIs/deadline ctx/
   accred deep link) → IA chrome: area switching + breadcrumb, `[` `]` + digit keys, bottom bar / sub-nav on the phone,
   tab-search {query} / {section:"masters"} routing → 2nd user → master upload (조직 › 마스터) → AI canned + live
   (consent → redaction preview → mocked tool_use) → roster add/OCR/.ics → accred toggle → 환자 › 접수 보드 pid picker →
   조직 › 데이터 처리 현황 panel (zero 미등록) → no plaintext names in localStorage/IndexedDB → lock/unlock as a SEEDED
   login (정수아 · PIN 0000) → audit log shape → encrypted backup v2 → 전체 파기 → restore → reload persistence →
   legacy-key migration + activateTab ctx + Batches cap + v1 backup restore.
   Then an ENGLISH pass on a fresh profile: i18n coverage gate (tools/i18n-extract.mjs → 0 missing keys), toggle EN on
   the lock screen before setup, every panel + the overlay + the drawer free of Hangul in headings/buttons/table headers/
   labels/pills/caveats (glosses in parentheses and sample values excepted), KO round-trip keeps the result tables, EN
   export headers + watermark, reload persists EN, `?lang=en` boots a fresh profile in English.
   Zero page errors + zero console errors (blocked-host resource failures excepted) is asserted.

   Run:  node clinic-admin/tools/e2e.mjs            (desktop 1280×900)
         node clinic-admin/tools/e2e.mjs --mobile   (390×844 smoke: same flow via bottom bar / sub-nav / ⋯ sheet + no horizontal overflow)
   Needs a Playwright install: set PLAYWRIGHT_DIR, or it looks for one under ~/.npm/_npx. */
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const MOBILE = process.argv.includes("--mobile");
const PORT = 8501;
const BASE = `http://localhost:${PORT}/clinic-admin/`;

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
const SEED_PIN = "0000"; // every seeded login (윤지훈 · 정수아 · 한지우)
// Plaintext-by-design keys excluded from the "no names" scans: the keyring (__ws — login names, needed while locked)
// and the institution profile (org.profile — the 대표자 is public 사업자등록 data, plain tier per the entities contract).
const WS_KEY = "vibe.clinic-admin.__ws";
const PLAIN_OK = new Set([WS_KEY, "vibe.clinic-admin.org.profile"]);
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
const context = await browser.newContext({ ...VIEW, locale: "ko-KR" });
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
// Area of every panel — mirrors js/core/nav.js TABS (the chrome the user actually clicks: area → panel).
const AREA_OF = { "tab-today": "home", "tab-board": "patients", "tab-claims": "claims", "tab-kcd": "claims", "tab-jabo": "claims", "tab-yearend": "records", "tab-bigeup": "records", "tab-retention": "records", "tab-org": "org", "tab-license": "org", "tab-accred": "org", "tab-privacy": "org", "tab-masters": "org" };
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
const expandLater = async () => { await page.evaluate(() => { const d = document.querySelector("#home-deadlines"); if (d) d.open = true; }); const m = $("#dday-more"); if (await m.count() && (await m.getAttribute("aria-expanded")) === "false") { await m.click(); await wait(100); } };
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

  /* 1 · first run → workspace */
  at("first run: lock screen shows setup, create workspace (원장)");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open");
  ok(await $("#lock-setup").isVisible(), "setup pane visible on first run");
  if (MOBILE) await noOverflow("lock screen (setup)");
  await $("#setup-name").fill("홍 원장"); await $("#setup-role").selectOption("원장");
  await $("#setup-pin").fill("1234"); await $("#setup-pin2").fill("1234");
  await $("#setup-submit").click();
  await page.waitForSelector("body:not(.locked)", { timeout: 20000 });

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

  /* 2 · seed */
  at("샘플 데이터로 둘러보기 (seed-all → shared entities + every tab, awaited in order)");
  await $("#welcome-seed").click();
  await closed("#welcome-scrim");
  await page.waitForFunction(() => { const p = document.querySelector("#ai-mode-pill"); return p && !p.hidden; }, null, { timeout: 25000 }); // 07 is the slowest seed (700 ms canned timer)
  await page.waitForFunction(() => document.querySelector("#jabo-recon-toolbar")?.style.display === "flex", null, { timeout: 15000 });
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || "{}").users?.length === 4, WS_KEY, { timeout: 20000 }); // 3 seeded logins (PBKDF2 each)
  await wait(900); // debounced persists (tariff burst, drafts)
  ok((await $("#lic-list .lic").count()) === 8, "seed → 7 clinic staff + the workspace creator = 8 roster rows");
  ok(await page.evaluate(() => document.querySelector("#tab-today")?.classList.contains("active") && document.body.dataset.area === "home"), "seed lands on 홈 (area home)");
  const todo0 = await page.evaluate(() => Array.from(document.querySelectorAll("#todo-list .todo")).map(el => ({ key: el.dataset.key, link: el.dataset.link, ctx: el.dataset.ctx })));
  ok(todo0.length >= 1 && todo0.every(x => x.key && x.link && x.ctx !== undefined) && todo0.some(x => x.key.startsWith("dl:lic-")), `홈 todo list populated by the seed (${todo0.length} rows: ${todo0.map(x => x.key).slice(0, 4).join(", ")}…)`);
  ok(!(await $("#tab-today .intake-board").count()) && (await $("#tab-board .intake-board").count()) === 1, "접수 보드 moved out of 홈 into 환자 › 접수 보드");
  const seeded = await ent(page, (E) => ({ staff: E.Staff.list().map(s => [s.name, s.job, !!s.userId]), patients: E.Patients.list().map(p => p.pid), tags: E.Patients.get("P-2026-0142")?.tags, insurer: E.Insurers.lastUsed(), alias: E.Patients.alias("P-2026-0142"), batches: E.Batches.list().map(b => [b.kind, b.source, b.count]) }));
  ok(seeded.staff.filter(([, , login]) => login).length === 4 && seeded.staff.some(([n, j, l]) => n === "윤지훈" && j === "한의사" && l) && seeded.staff.some(([n, j]) => n === "정수아" && j === "행정"), `roster: ${seeded.staff.map(([n, j, l]) => `${j} ${n}${l ? "🔑" : ""}`).join(", ")}`);
  ok(seeded.patients.length === 5 && PIDS.every(p => seeded.patients.includes(p)) && seeded.tags?.includes("자보") && seeded.alias === "환자 ****0142", `patients: ${seeded.patients.join(", ")} · alias "${seeded.alias}"`);
  ok(seeded.insurer === "삼성", "Insurers.lastUsed = 삼성 (an insurer value; label 삼성화재)");
  const kinds = seeded.batches.map(b => b[0]).sort().join(",");
  ok(kinds === "claims,retention,review,yearend" && seeded.batches.find(b => b[0] === "claims")[2] === 12 && seeded.batches.find(b => b[0] === "review")[2] === 42, `one batch per kind after the seed: ${seeded.batches.map(b => `${b[0]}(${b[2]})`).join(" · ")}`);
  const chip = await $("#topbar-due-text").innerText().catch(() => "");
  ok(!ALL_NAMES.some(n => chip.includes(n)), `topbar due chip carries no name (“${chip}”)`);

  /* 2b · the connected story, part 1 — 00 오늘 right after the seed */
  at("홈 — KPIs from the seeded reconciliation, no nudges, resume cards, deadlines carry ctx, todo rows deep-link");
  ok(await page.evaluate(() => document.querySelector("#today-nudges")?.style.display === "none"), "no nudges (org complete · roster filled)");
  ok(await page.evaluate(() => document.querySelector("#kpi-empty")?.style.display === "none"), "KPI empty-state hidden");
  const kpi = { n: await $("#ins-jabo").innerText(), sub: await $("#ins-jabo-sub").innerText(), cut: await $("#ins-cut").innerText(), cutSub: await $("#ins-cut-sub").innerText(), reason: await $("#ins-reason").innerText(), ins: await $("#ins-insurer").innerText(), insSub: await $("#ins-insurer-sub").innerText() };
  ok(/^1 건/.test(kpi.n.replace(/\s+/g, " ")) && /청구 [\d,]+원 → 인정 [\d,]+원/.test(kpi.sub) && !/청구 0원/.test(kpi.sub), `청구 vs 인정 from the seeded batch (${kpi.n.replace(/\s+/g, " ")} · ${kpi.sub})`);
  ok(parseFloat(kpi.cut) > 0 && /삭감 [1-9][\d,]*원/.test(kpi.cutSub), `조정률 ${kpi.cut.replace(/\s+/g, " ")} · ${kpi.cutSub}`);
  ok(kpi.reason !== "—" && HANGUL.test(kpi.reason), `top 조정사유 from the recon history byReason (${kpi.reason})`);
  ok(kpi.ins === "삼성화재" && /1개사/.test(kpi.insSub), `top insurer label resolved from the value (${kpi.ins} · ${kpi.insSub})`);
  const resume = await $("#resume-list .resume[data-tab]").allInnerTexts();
  ok(resume.length >= 3 && resume.some(x => /미수록/.test(x)) && resume.some(x => /만료 초과/.test(x)) && resume.some(x => /오류/.test(x)), `resume cards: kcd · retention · yearend (${resume.length})`);
  await expandLater();
  const ddays = await page.evaluate(() => Array.from(document.querySelectorAll("#dday-list .dday")).map(el => ({ key: el.dataset.key, ctx: el.dataset.ctx ? JSON.parse(el.dataset.ctx) : null })));
  ok(ddays.some(d => d.key.startsWith("bigeup") && /^\d{4}-\d{2}$/.test(d.ctx?.refMonth)) && ddays.some(d => d.key === "yearend" && Number.isInteger(d.ctx?.taxYear)) && ddays.some(d => d.key.startsWith("lic-") && d.ctx?.staffId), `dashboard deadlines carry ctx (${ddays.length} rows: refMonth / taxYear / staffId)`);
  ok(/자동 판정 미충족/.test(await $("#ins-accred-sub").innerText()), "accred tile names failing auto-judged items");
  ok(await page.evaluate(() => { const b = document.querySelector("#todo-list .todo[data-key^=\"batch:\"]"); return !b; }), "both claim steps done after the seed → no batch todo row");
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
  await $("#users-add-name").fill("행정 김"); await $("#users-add-role").selectOption("행정"); await $("#users-add-pin").fill("5678");
  await $("#users-add-btn").click();
  await page.waitForFunction(() => document.querySelectorAll("#users-list .sec-row").length === 5);
  ok(true, "users panel lists 5 logins (creator + 3 seeded + 행정 김)");
  await $("#users-close").click(); await closed("#users-scrim");
  ok((await $("#lic-list .lic").count()) === 9, "adding a user added a roster row (9)");

  /* 4 · the connected story, part 2 — claims tabs on the ONE shared batch */
  at("02 자보 — reconciliation of the shared 2026-08 batch: cuts on ****0142, insurer on the history entry");
  await goTab("tab-jabo");
  ok((await $("#crumb-section").innerText()) === "청구" && (await $("#crumb-tab").innerText()) === "심사결과 대조", "crumb shows area › panel labels");
  const strip02 = (await $("#jabo-batch-strip").innerText()).replace(/\s+/g, " ");
  ok(/청구 배치/.test(strip02) && /명세서 12건/.test(strip02) && /환자 5명/.test(strip02) && /2026-08/.test(strip02) && /샘플/.test(strip02), `compact batch strip: 12 명세서 · 5 환자 · 2026-08 · 샘플 (${strip02.slice(0, 100)})`);
  ok((await $("#jabo-batch-strip .batch-strip.compact [data-batch-open]").count()) === 1 && (await $("#jabo-batch-strip [data-batch-new]").count()) === 0, "strip collapsed to one line linking back to 청구 배치 (no 새 파일 here)");
  ok(/12건/.test(await $("#jabo-recon-summary").innerText()), "summary: 12 명세서");
  const reconRows = await $("#jabo-recon-result tbody tr").count();
  ok(reconRows === 42 && (await $("#jabo-recon-result tr.orphan").count()) === 1, `41 lines + 1 orphan review line (${reconRows})`);
  ok((await $("#jabo-recon-groups table").count()) === 2, "조정사유별 + 월별 group tables");
  const cuts0142 = await page.evaluate(() => Array.from(document.querySelectorAll("#jabo-recon-result tbody tr:not(.orphan)")).filter(tr => tr.children[1].textContent.trim() === "P-2026-0142" && tr.children[7].textContent.trim().startsWith("−")).map(tr => `${tr.children[0].textContent.trim()}/${tr.children[3].textContent.trim()}`));
  ok(cuts0142.length === 5 && cuts0142.includes("M2608-0001/예시-13") && cuts0142.filter(x => x.startsWith("M2608-0005")).length === 3, `cuts on ****0142: ${cuts0142.join(", ")}`);
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

  at("청구 › 청구 배치 — landing: full strip, batch card, 3 steps derived from kcd.lastSummary / recon history");
  await goTab("tab-kcd");
  await $("#kcd-batch-strip [data-batch-open]").click();
  await page.waitForSelector("#tab-claims.active");
  ok((await $("#claims-batch-strip [data-batch-new]").count()) === 1, "compact strip → landing; the landing's strip is the full one (새 파일)");
  const steps = await page.evaluate(() => Array.from(document.querySelectorAll("#claims-steps .claims-step")).map(li => ({ key: li.dataset.step, state: [...li.classList].find(c => ["idle", "todo", "need", "done", "soon"].includes(c)), disabled: li.querySelector("button").disabled })));
  ok(steps.length === 3 && steps[0].key === "kcd" && steps[0].state === "done" && steps[1].key === "recon" && steps[1].state === "done" && steps[2].key === "appeal" && steps[2].state === "soon" && steps[2].disabled, `steps: ${steps.map(s => `${s.key}=${s.state}`).join(" · ")}`);
  const card = (await $("#claims-batch-card").innerText()).replace(/\s+/g, " ");
  ok(/12/.test(card) && /2026-08/.test(card) && /심사결과 연결/.test(card), `batch card: 12 명세서 · 2026-08 · review linked (${card.slice(0, 80)})`);
  await page.evaluate(() => document.querySelector('#claims-steps [data-step-go="recon"]').click());
  await page.waitForSelector("#tab-jabo.active");
  ok(true, "step button → 심사결과 대조");
  if (MOBILE) { await goTab("tab-claims"); await noOverflow("청구 배치 landing"); }

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
  ok(xc.counts[0] === 7 && xc.counts[1] === 1 && /12건 중 5건 일치/.test(xc.meta), `cross-check: 5 matched · 7 claims-only · 1 file-only (${xc.meta})`);
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
  await $("#lic-login-role").selectOption("원무"); await $("#lic-login-pin").fill("4321");
  await $("#lic-login-ok").click();
  await page.waitForFunction(() => document.querySelector("#lic-login-form")?.hidden === true, null, { timeout: 15000 });
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || "{}").users?.length === 6, WS_KEY);
  const linked = await ent(page, (E, Session) => { const s = E.Staff.list().find(x => x.name === "오하늬"); const u = Session.users().find(x => x.id === s?.userId); return { userId: s?.userId, role: u?.role, staffId: u?.staffId, sid: s?.id, byUser: E.Staff.byUser(u?.id)?.name }; });
  ok(linked.userId && linked.role === "원무" && linked.staffId === linked.sid && linked.byUser === "오하늬", `issueLogin → keyring user (${linked.role}) ↔ staff row linked both ways`);
  ok(/로그인 · 원무/.test(await rowOf("오하늬").innerText()), "row shows the login badge");
  page.once("dialog", d => d.accept());
  await rowOf("오하늬").locator('[data-act="revoke"]').click();
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || "{}").users?.length === 5, WS_KEY);
  ok((await rowOf("오하늬").locator('[data-act="login"]').count()) === 1, "revokeLogin → user gone from the keyring, row offers 발급 again, row itself kept");
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
  ok(/\bbad\b/.test(auto.mr1.cls) && /\bwarn\b/.test(auto.mr3.cls), `mr1 ✗ (records past retention) · mr3 △ (1 classification error) (${auto.mr1.txt} / ${auto.mr3.txt})`);
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

  at("IA chrome — area switching remembers the last panel, breadcrumb, `[` `]` cycle, digit keys jump areas");
  await goTab("tab-license"); await goTab("tab-jabo");
  await (MOBILE ? $('#bottombar .area-btn[data-area="org"]') : $('#rail-areas .area-btn[data-area="org"]')).click();
  await page.waitForSelector("#tab-license.active");
  ok((await $("#crumb-section").innerText()) === "조직" && (await $("#crumb-tab").innerText()) === "직원 명부", "area 조직 → returns to its last-visited panel (직원 명부)");
  await (MOBILE ? $('#bottombar .area-btn[data-area="claims"]') : $('#rail-areas .area-btn[data-area="claims"]')).click();
  await page.waitForSelector("#tab-jabo.active");
  ok(await page.evaluate(() => document.body.dataset.area === "claims" && document.querySelector('#rail-areas .area-panels[data-area="claims"]').classList.contains("active") && !document.querySelector('#rail-areas .area-panels[data-area="org"]').classList.contains("active")), "area 청구 → last panel (심사결과 대조); only the active area's panel list is expanded");
  await (MOBILE ? $('#bottombar .area-btn[data-area="patients"]') : $('#rail-areas .area-btn[data-area="patients"]')).click();
  await page.waitForSelector("#tab-board.active");
  ok((await $("#crumb-tab").innerText()) === "접수 보드", "a never-visited area opens its first panel");
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
    ok(await page.evaluate(() => document.body.classList.contains("more-open") && document.querySelector("#rail-lock").offsetHeight > 0 && document.querySelector(".rail-foot .lang-toggle").offsetHeight > 0), "phone: ⋯ sheet shows lock/users/privacy/language");
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
  if (MOBILE) { await noOverflow("shell (board)"); await goTab("tab-today"); await noOverflow("shell (home)"); }

  /* 6 · privacy panel */
  at("조직 › 데이터 처리 현황 — a panel now; zero 미등록 after using every tool");
  await railClick("#rail-privacy");
  await page.waitForSelector("#tab-privacy.active");
  ok((await $("#crumb-tab").innerText()) === "데이터 처리 현황" && !(await $("#privacy-scrim").count()), "privacy register opened as the 조직 › 데이터 처리 현황 panel (modal retired)");
  await page.evaluate(() => document.querySelector("#poc-banner-link").click());
  ok(await page.evaluate(() => document.querySelector('#tab-privacy [data-privacy-pane="legal"]').classList.contains("active")), "PoC banner link → legal pane of the panel");
  await page.evaluate(() => document.querySelector('#tab-privacy [data-privacy-tab="status"]').click());
  await page.waitForFunction(() => document.querySelectorAll("#privacy-table tr").length > 5);
  const unreg = await $("#privacy-table tr.unregistered").count();
  ok(unreg === 0, `0 미등록 rows (got ${unreg}: ${(await $("#privacy-table tr.unregistered").allInnerTexts()).join(" | ")})`);
  const regText = await $("#privacy-table").innerText();
  ok(regText.includes("업로드 마스터") && regText.includes("직원 명부") && regText.includes("기관 프로필") && regText.includes("가명 환자 대장") && regText.includes("업로드 배치"), "register lists masters + the entity rows (org · staff · patients · batches)");
  const bk = await download(() => $("#privacy-backup").click());
  ok(/_PoC\.json$/.test(bk.name), `backup filename watermarked (${bk.name})`);
  const bkJ = JSON.parse(bk.text);
  ok(bkJ.v === 2 && bkJ.keyring.users.every(u => u.staffId) && Object.keys(bkJ.sensitive).includes("staff.list") && Object.keys(bkJ.sensitive).includes("patients.register") && Object.keys(bkJ.sensitive).some(k => k.startsWith("claims.batch.")), "backup is v2: keyring users carry staffId, staff.list + patients.register + claims.batch.* envelopes included");
  ok(!ALL_NAMES.some(n => JSON.stringify({ ...bkJ, keyring: null }).includes(n)), "backup file has no plaintext names outside the keyring (org.profile travels inside the encrypted `plain` bundle)");
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
  ok(Object.keys(snap.idb).includes("vibe-clinic-admin-masters"), "masters DB exists before wipe");

  /* 8 · lock / unlock as a SEEDED login */
  at("lock → locked state → unlock as 정수아 (seeded 행정 · PIN 0000)");
  await railClick("#rail-lock");
  await page.waitForSelector("body.locked");
  ok(await page.evaluate(() => getComputedStyle(document.querySelector(".frame.shell")).visibility === "hidden" && document.querySelector(".frame.shell").inert === true), "shell hidden + inert while locked");
  ok(await ent(page, (E, S, Store) => E.Staff.list().length === 0 && E.Patients.list().length === 0 && E.Batches.list().length === 0 && Store.get("jabo.history", []).length === 0), "Staff / Patients / Batches / sensitive keys read empty while locked");
  if (MOBILE) await noOverflow("lock screen (unlock)");
  await page.locator(".lock-user", { hasText: "정수아" }).click();
  await $("#lock-pin").fill(SEED_PIN); await $("#lock-submit").click();
  await page.waitForSelector("body:not(.locked)", { timeout: 20000 });
  ok((await $("#topbar-user-text").innerText()).includes("정수아"), "topbar chip = 정수아 (seeded login, PIN 0000)");
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10);
  ok(true, "roster re-rendered after re-unlock (10 rows)");
  ok((await $("#lic-list .lic-link").count()) === 0, "non-owner (행정) sees no 로그인 발급/해제 actions");
  await goTab("tab-jabo");
  ok((await $("#jabo-recon-result tbody tr").count()) === 42, "02 reconciliation re-derived from the shared batch after re-unlock");

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

  /* 9 · 전체 파기 */
  at("전체 파기 (typed 「파기」) → clean first-run state, masters DB gone");
  page.once("dialog", d => d.accept("파기"));
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), railClick("#wipe-all")]);
  await page.waitForSelector("#lock-scrim.open");
  ok(await $("#lock-setup").isVisible(), "setup pane again (no workspace)");
  const after = await page.evaluate(async () => ({ ls: Object.keys(localStorage).filter(k => k.startsWith("vibe.clinic-admin")), dbs: (await indexedDB.databases()).map(d => d.name) }));
  // The fresh boot immediately re-creates the tab-restore state (ui.activeTab + its mtime/lastSave) —
  // non-personal, registered under ui/__internal. Nothing else may survive, above all not the key ring.
  const BOOT_KEYS = new Set(["vibe.clinic-admin.__mtime", "vibe.clinic-admin.__lastSave", "vibe.clinic-admin.ui.activeTab"]);
  ok(after.ls.every(k => BOOT_KEYS.has(k)), `localStorage cleared except boot UI state (${after.ls.join(",") || "empty"})`);
  ok(!after.ls.includes("vibe.clinic-admin.__ws"), "key ring (__ws) gone");
  ok(!after.dbs.includes("vibe-clinic-admin-masters") && !after.dbs.includes("vibe-clinic-admin"), `IndexedDB cleared (${after.dbs.join(",") || "empty"})`);

  /* 10 · restore */
  at("restore encrypted backup (v2) with PIN → data back");
  await $("#lock-goto-restore").click();
  await page.waitForSelector("#lock-restore:not([hidden])");
  await $("#restore-file").setInputFiles({ name: bk.name, mimeType: "application/json", buffer: bk.buf });
  await page.waitForSelector("#restore-step2:not([hidden])");
  await $("#restore-user").selectOption({ label: "홍 원장 · 원장" });
  await $("#restore-pin").fill("1234");
  await $("#restore-submit").click();
  await page.waitForSelector("body:not(.locked)", { timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10, null, { timeout: 15000 });
  ok(true, "10 roster rows restored");
  ok((await $("#topbar-org-text").innerText()) === ORG.name, "org profile restored (topbar chip)");
  ok(/건/.test(await $("#ins-jabo").innerText()), "jabo history restored (dashboard insight)");
  await wait(600); // the first-run welcome would open 350 ms after app:ready — it must not, ui.welcomed came back with the backup
  ok(!(await $("#welcome-scrim").evaluate(el => el.classList.contains("open"))), "welcome tour does not reopen after a restore");
  await goTab("tab-kcd");
  ok(/최근 정비/.test(await $("#kcd-status").innerText()) && (await $("#kcd-result tbody tr").count()) === 21, "kcd.lastSummary + the current claims batch restored (21 rows re-derived)");

  /* 11 · reload persistence */
  at("reload → unlock → data persists");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#lock-scrim.open");
  ok(await $("#lock-unlock").isVisible(), "unlock pane after reload");
  await page.locator(".lock-user", { hasText: "홍 원장" }).click();
  await $("#lock-pin").fill("1234"); await $("#lock-submit").click();
  await page.waitForSelector("body:not(.locked)", { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10, null, { timeout: 15000 });
  ok(true, "roster persists across reload");
  ok(!(await $("#welcome-scrim").evaluate(el => el.classList.contains("open"))), "welcome does not reopen (ui.welcomed restored)");
  if (MOBILE) await noOverflow("shell (after reload)");

  /* 12 · LEGACY → ENTITIES: fresh profile with pre-entities keys, activateTab ctx payload, v1 backup restore */
  at("legacy: fresh workspace + pre-entities keys (license.list / yearend.* / bigeup.*) → unlock migrates them");
  const ctxL = await browser.newContext({ ...VIEW, locale: "ko-KR" });
  const pL = await ctxL.newPage();
  shotPage = pL;
  watch(pL, "[legacy] ");
  await blockAll(pL);
  const $L = (sel) => pL.locator(sel);
  await pL.goto(BASE, { waitUntil: "domcontentloaded" });
  await pL.waitForSelector("#lock-scrim.open");
  await $L("#setup-name").fill("홍 원장"); await $L("#setup-role").selectOption("원장"); await $L("#setup-pin").fill("1234"); await $L("#setup-pin2").fill("1234");
  await $L("#setup-submit").click();
  await pL.waitForSelector("#org-scrim.open", { timeout: 20000 });
  await $L("#orgstep-skip").click(); // "나중에 입력"
  await pL.waitForSelector("#welcome-scrim.open", { timeout: 15000 });
  ok((await $L("#topbar-org-text").innerText()).length > 0 && (await ent(pL, (E) => E.Org.isComplete())) === false, "org step skipped → Org.isComplete() false, chip nudges");
  await $L("#welcome-blank").click();
  await pL.waitForFunction(() => !document.querySelector("#welcome-scrim")?.classList.contains("open"));
  ok((await $L('#today-nudges .nudge[data-nudge="org"]').count()) === 1 && (await $L('#today-nudges .nudge[data-nudge="staff"]').count()) === 0, "00 nudges: 기관 정보 미완료 shown, 직원 명부 not (creator row exists)");
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
  await pL.locator(".lock-user", { hasText: "홍 원장" }).click();
  await $L("#lock-pin").fill("1234"); await $L("#lock-submit").click();
  await pL.waitForSelector("body:not(.locked)", { timeout: 20000 });
  const mig = await ent(pL, (E, Session) => ({
    staff: E.Staff.list().map(s => [s.name, s.job, s.id, !!s.userId]), org: E.Org.get(), tariff: E.Tariff.all(), date: E.Tariff.effectiveDate(),
    me: Session.user(), byUser: E.Staff.byUser(Session.user().id)?.name,
    legacyLeft: Object.keys(localStorage).filter(k => /vibe\.clinic-admin\.(license\.list|yearend\.ye-biz|yearend\.ye-clinic|bigeup\.profile\.|bigeup\.tariff)/.test(k))
  }));
  ok(mig.staff.some(([n, j, id]) => n === LEGACY_STAFF[0] && j === "한의사" && id === "lic-legacy-01") && mig.staff.some(([n, j]) => n === LEGACY_STAFF[1] && j === "원무"), `license.list → Staff (ids kept): ${mig.staff.map(([n, j]) => `${j} ${n}`).join(", ")}`);
  ok(mig.org.biz === "987-65-43210" && mig.org.name === "옛 한방병원" && mig.org.ykiho === "22000456", `yearend.* + bigeup.profile.* → Org ${JSON.stringify(mig.org)}`);
  ok(mig.tariff["예시-01"]?.min === "10000" && mig.date === "2026-03-01", "bigeup.tariff + bg-date → Tariff");
  ok(mig.legacyLeft.length === 0, `legacy keys deleted after migration (${mig.legacyLeft.join(", ") || "none left"})`);
  ok(mig.me.staffId && mig.byUser === "홍 원장", "creator user linked to its roster row (staffId)");
  ok((await $L("#lic-list .lic").count()) === 3, "roster renders 3 rows (creator + 2 migrated)");
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

  at("v1 backup (pre-entities keys) → restore → migrated on the unlock that follows");
  const v1 = await ent(pL, async (E, Session, Store, EventBus, activateTab, C) => {
    const key = Session.key();
    const rows = [{ id: "lic-v1-01", role: "간호사", name: "백업간호", licenseNo: "555", acquired: "2015-05-05", reported: "2025-02-02", cme: "", expiry: "2028-02-02", basis: "reported" }];
    return JSON.stringify({
      format: "vibe.clinic-admin.backup", v: 1, exportedAt: new Date().toISOString(), poc: "PoC — 실제 제출 불가 · 데모 데이터",
      keyring: Session.exportKeyring(),
      sensitive: { "license.list": await C.encryptJSON(key, rows), "yearend.ye-biz": await C.encryptJSON(key, "111-22-33333"), "bigeup.profile.bg-ykiho": await C.encryptJSON(key, "33000789") },
      plain: await C.encryptJSON(key, { "bigeup.tariff": { "예시-02": { min: "5000", max: "9000", med: "", freq: "3" } }, "ui.welcomed": true }),
      attachments: []
    });
  });
  await pL.evaluate(() => { const b = document.querySelector("#rail-privacy"); b && b.click(); });
  await pL.waitForSelector("#tab-privacy.active");
  await $L("#privacy-restore").click();
  await pL.waitForSelector("#lock-restore:not([hidden])");
  await $L("#restore-file").setInputFiles({ name: "clinic-admin_backup_v1.json", mimeType: "application/json", buffer: Buffer.from(v1) });
  await pL.waitForSelector("#restore-step2:not([hidden])");
  await $L("#restore-user").selectOption({ label: "홍 원장 · 원장" });
  await $L("#restore-pin").fill("1234");
  pL.once("dialog", d => d.accept());
  await Promise.all([pL.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }), $L("#restore-submit").click()]); // booted → reload after restore
  await pL.waitForSelector("#lock-scrim.open");
  await pL.locator(".lock-user", { hasText: "홍 원장" }).click();
  await $L("#lock-pin").fill("1234"); await $L("#lock-submit").click();
  await pL.waitForSelector("body:not(.locked)", { timeout: 20000 });
  const afterV1 = await ent(pL, (E) => ({ staff: E.Staff.list().map(s => [s.name, s.job]), org: E.Org.get(), tariff: E.Tariff.all(), legacyLeft: Object.keys(localStorage).filter(k => /vibe\.clinic-admin\.(license\.list|yearend\.ye-biz|bigeup\.profile\.|bigeup\.tariff)/.test(k)) }));
  ok(afterV1.staff.some(([n, j]) => n === "백업간호" && j === "간호사") && afterV1.staff.some(([n]) => n === "홍 원장") && !afterV1.staff.some(([n]) => n === LEGACY_STAFF[0]), `v1 restore replaced the roster (${afterV1.staff.map(([n, j]) => `${j} ${n}`).join(", ")})`);
  ok(afterV1.org.biz === "111-22-33333" && afterV1.org.ykiho === "33000789" && afterV1.tariff["예시-02"]?.max === "9000" && afterV1.legacyLeft.length === 0, `v1 keys migrated to Org/Tariff, legacy keys gone (${JSON.stringify(afterV1.org)})`);
  await ctxL.close();

  /* 13 · ENGLISH pass — fresh profile */
  at("EN: fresh profile → EN toggle on the lock screen → setup pane is English");
  const ctx2 = await browser.newContext({ ...VIEW, locale: "en-GB" });
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
  ok((await p2.evaluate(() => document.documentElement.lang)) === "ko", "fresh profile boots in Korean");
  await $2('#lock-scrim .lang-toggle button[data-lang="en"]').click();
  await p2.waitForFunction(() => document.documentElement.lang === "en");
  ok((await $2('#lock-scrim .lang-toggle button[data-lang="en"]').getAttribute("aria-pressed")) === "true" && (await $2('#lock-scrim .lang-toggle button[data-lang="ko"]').getAttribute("aria-pressed")) === "false", "lock-screen toggle aria-pressed reflects EN");
  const setupTxt = await $2("#lock-setup").innerText();
  ok(/Create workspace/.test(setupTxt) && leftoverHangul([setupTxt]).length === 0, `setup pane is English (${leftoverHangul([setupTxt]).join(" | ") || "no Hangul"})`);
  ok((await p2.title()).startsWith("Clinic Admin Toolkit"), `document.title in English (${await p2.title()})`);
  if (MOBILE) await noOverflow2("lock screen (setup)");
  await $2("#setup-name").fill("KW"); await $2("#setup-role").selectOption("원장");
  await $2("#setup-pin").fill("1234"); await $2("#setup-pin2").fill("1234");
  await $2("#setup-submit").click();
  await p2.waitForSelector("body:not(.locked)", { timeout: 20000 });
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
  await p2.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || "{}").users?.length === 4, WS_KEY, { timeout: 20000 });
  await p2.waitForTimeout(900);
  ok((await $2("#topbar-org-text").innerText()) === ORG.name, "EN: seed filled the skipped org profile (chip = 한솔한방병원)");
  const crumb2 = await p2.evaluate(() => [document.querySelector("#crumb-section")?.textContent, document.querySelector("#crumb-tab")?.textContent]);
  ok(crumb2[0] === "Home" && crumb2[1] === "Today", `crumb in English (${crumb2.join(" › ")})`);
  const chromeEn = await p2.evaluate(() => [...document.querySelectorAll("#rail-areas .area-label, #rail-areas [data-panel], #bottombar span, #topbar-search, #topbar-ai, #rail-foot .rail-btn, .rail-foot .rail-btn")].map(e => e.textContent));
  ok(leftoverHangul(chromeEn).length === 0, `EN: navigation chrome (areas · panels · bottom bar · topbar buttons · ⋯ sheet) free of Hangul (${leftoverHangul(chromeEn).slice(0, 4).join(" | ") || "none"})`);
  ok((await $2("#topbar-user-text").innerText()) === "KW · Director", `topbar user chip role in English (${await $2("#topbar-user-text").innerText()})`);
  const PANELS = ["tab-today", "tab-board", "tab-claims", "tab-kcd", "tab-jabo", "tab-yearend", "tab-bigeup", "tab-retention", "tab-org", "tab-license", "tab-accred", "tab-privacy", "tab-masters"];
  for (const panel of PANELS) {
    await goTab2(panel);
    if (panel === "tab-today") { await p2.evaluate(() => document.querySelectorAll("#tab-today details").forEach(d => { d.open = true; })); if (await $2("#dday-more").count()) await $2("#dday-more").click(); }
    if (panel === "tab-privacy") await p2.waitForFunction(() => document.querySelectorAll("#privacy-table tr").length > 5);
    const left = leftoverHangul(await panelTexts(panel));
    ok(left.length === 0, `${panel}: English only (leftovers: ${left.slice(0, 5).join(" | ") || "none"})`);
    if (MOBILE) await noOverflow2(panel);
  }
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
  ok(/Switch to Korean/.test(await $2("#search-nav-results").innerText()) && /Open AI coding assist/.test(await $2("#search-nav-results").innerText()), "overlay lists the language command + the AI utility");
  await p2.keyboard.press("Escape");

  at("EN: reload persists the choice (lock screen in English)");
  await p2.reload({ waitUntil: "domcontentloaded" });
  await p2.waitForSelector("#lock-scrim.open");
  ok((await p2.evaluate(() => document.documentElement.lang)) === "en", "<html lang> = en after reload");
  const unlockTxt = await $2("#lock-unlock").innerText();
  ok(/Unlock/.test(unlockTxt) && /Director/.test(unlockTxt) && leftoverHangul([unlockTxt]).length === 0, `unlock pane in English (${leftoverHangul([unlockTxt]).join(" | ") || "no Hangul"})`);
  ok((await p2.evaluate(() => localStorage.getItem("vibe.clinic-admin.ui.lang"))) === "en", "persisted under vibe.clinic-admin.ui.lang (plain, works while locked)");
  if (MOBILE) await noOverflow2("lock screen (unlock)");
  await ctx2.close();

  at("EN: ?lang=en boots a fresh profile in English");
  const ctx3 = await browser.newContext({ ...VIEW, locale: "ko-KR" });
  const p3 = await ctx3.newPage();
  shotPage = p3;
  p3.on("pageerror", e => pageErrors.push("[EN?lang] " + String(e && e.stack || e)));
  await blockAll(p3);
  await p3.goto(BASE + "?lang=en", { waitUntil: "domcontentloaded" });
  await p3.waitForSelector("#lock-scrim.open");
  ok((await p3.evaluate(() => document.documentElement.lang)) === "en", "?lang=en → <html lang> = en");
  const setup3 = await p3.locator("#lock-setup").innerText();
  ok(/Create workspace/.test(setup3) && leftoverHangul([setup3]).length === 0, "?lang=en → setup pane English on a fresh profile");
  ok((await p3.evaluate(() => localStorage.getItem("vibe.clinic-admin.ui.lang"))) === "en", "?lang=en persisted");
  await ctx3.close();

  /* 14 · errors */
  at("zero page errors / console errors");
  ok(pageErrors.length === 0, `page errors: ${pageErrors.length}${pageErrors.length ? "\n" + pageErrors.join("\n") : ""}`);
  ok(consoleErrors.length === 0, `console errors: ${consoleErrors.length}${consoleErrors.length ? "\n" + consoleErrors.join("\n") : ""}`);

  console.log(`\nPASS — ${checks.length} assertions (${MOBILE ? "mobile" : "desktop"})`);
} catch (err) {
  console.error("\nFAIL:", err.message);
  if (pageErrors.length) console.error("page errors:\n" + pageErrors.join("\n"));
  if (consoleErrors.length) console.error("console errors:\n" + consoleErrors.join("\n"));
  try { await shotPage.screenshot({ path: `/tmp/clinic-admin-e2e-fail-${MOBILE ? "mobile" : "desktop"}.png`, fullPage: false }); console.error("screenshot: /tmp/clinic-admin-e2e-fail-*.png"); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
