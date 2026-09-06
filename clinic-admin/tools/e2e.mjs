#!/usr/bin/env node
/* clinic-admin — integrated end-to-end run (headless Chrome via Playwright).
   Serves the repo root on :8501, blocks every external host (PocketBase, jsdelivr, Google Fonts),
   mocks the Claude proxy with a forced tool_use answer, then drives the whole app once:
   first-run workspace → 2 users → sample seed → every tab's core action → master upload → AI canned
   + live (consent → redaction preview → mocked tool_use) → license add/OCR/.ics → accred toggle →
   데이터 처리 현황 (zero 미등록) → no plaintext names in localStorage/IndexedDB → lock/unlock as 행정 →
   audit log shape → encrypted backup → 전체 파기 → restore → reload persistence.
   Then an ENGLISH pass on a fresh profile: i18n coverage gate (tools/i18n-extract.mjs → 0 missing keys), toggle EN on
   the lock screen before setup, every tab's headings/buttons/table headers/labels/pills/caveats free of Hangul (glosses
   in parentheses and sample values excepted), KO round-trip keeps the result tables, EN export headers + watermark,
   reload persists EN, `?lang=en` boots a fresh profile in English.
   Zero page errors + zero console errors (blocked-host resource failures excepted) is asserted.

   Run:  node clinic-admin/tools/e2e.mjs            (desktop 1280×900)
         node clinic-admin/tools/e2e.mjs --mobile   (390×844 smoke: same flow + no horizontal overflow)
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

/* ── fixtures ──────────────────────────────────────────────────────── */
const PATIENTS = ["김민지", "박지훈", "이서윤", "최다은"];                                   // tab3 sample
const STAFF = ["윤지훈", "박서연", "김도현", "이하은", "최민준", "정수아", "한지우", "오하늬"]; // shared clinic roster (shell SEED) + the one we add
const LEGACY_STAFF = ["정민재", "송하린"];                                                    // pre-entities license.list rows (migration test)
const BOARD = ["김민서", "이준호", "정우진"];                                                 // the OLD board seed names — must never reappear
const ALL_NAMES = [...PATIENTS, ...STAFF, ...LEGACY_STAFF, ...BOARD];
const RRN = "880314-2123458", PHONE = "010-1234-5678", PNAME = "김민지";
const ORG = { name: "한솔한방병원", ykiho: "11000123", biz: "123-45-67890", rep: "윤지훈" };
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
const context = await browser.newContext({
  viewport: MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  isMobile: MOBILE, hasTouch: MOBILE, acceptDownloads: true, locale: "ko-KR"
});
const page = await context.newPage();
let shotPage = page; // the page the failure screenshot is taken from (switches to the EN-pass context later)

const BLOCKED = /(^|\.)pb\.gurum\.se$|cdn\.jsdelivr\.net$|fonts\.g(oogleapis|static)\.com$/;
const pageErrors = [], consoleErrors = [];
page.on("pageerror", e => pageErrors.push(String(e && e.stack || e)));
page.on("console", m => {
  if (m.type() !== "error") return;
  const loc = m.location()?.url || "";
  if (BLOCKED.test(safeHost(loc))) return; // intentional: blocked CDN / PocketBase hosts
  consoleErrors.push(`${m.text()} @ ${loc}`);
});
function safeHost(u) { try { return new URL(u).hostname; } catch { return ""; } }

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

/* ── helpers ───────────────────────────────────────────────────────── */
const $ = (sel) => page.locator(sel);
const wait = (ms) => page.waitForTimeout(ms);
const closed = (sel) => page.waitForFunction((s) => !document.querySelector(s)?.classList.contains("open"), sel);
// The .demo-strip CTAs are display:none in the shell-v2 layout (seedAll clicks them programmatically) — do the same.
const runDemo = (action) => page.evaluate((a) => { const b = document.querySelector(`[data-action="${a}"]`); if (!b) throw new Error("no demo CTA " + a); b.click(); }, action);
async function closeModals() { await page.evaluate(() => document.querySelectorAll(".welcome-scrim.open").forEach(s => s.classList.remove("open"))); await page.evaluate(() => { const sh = document.querySelector(".frame.shell"); if (sh) sh.inert = false; }); }
async function railClick(id) {
  if (MOBILE) { await $("#hamburger").click(); await wait(350); } // drawer slides in over .25s — click only once it has settled
  await $(id).click();
  if (MOBILE) await page.evaluate(() => document.body.classList.remove("rail-open"));
}
async function goTab(panel) {
  await railClick(`.rail-btn[data-panel="${panel}"]`);
  await page.waitForSelector(`#${panel}.active`);
}
async function download(action) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), action()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), text: path ? readFileSync(path, "utf8") : "", buf: path ? readFileSync(path) : null };
}
async function noOverflow(label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth,
    shell: (() => { const s = document.querySelector(".frame.shell"); return s ? s.scrollWidth : 0; })(),
    lock: (() => { const l = document.querySelector("#lock-scrim"); return l ? l.scrollWidth : 0; })() }));
  ok(r.sw <= r.iw + 1 && r.shell <= r.iw + 1 && r.lock <= r.iw + 1, `${label}: no horizontal overflow (doc ${r.sw} / shell ${r.shell} / lock ${r.lock} ≤ ${r.iw})`);
}
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
  at("i18n: every referenced key exists in ko.js and en.js");
  const cov = spawnSync(process.execPath, [join(here, "i18n-extract.mjs"), "--json"], { encoding: "utf8" });
  const covJ = (() => { try { return JSON.parse(cov.stdout.trim().split("\n").pop()); } catch { return null; } })();
  ok(covJ && covJ.missingKo.length === 0 && covJ.missingEn.length === 0, `0 missing keys (referenced ${covJ?.total}, ko ${covJ?.koEntries}, en ${covJ?.enEntries}; missing ko: ${covJ?.missingKo.join(",") || "none"} · en: ${covJ?.missingEn.join(",") || "none"})`);

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
  const creator = await page.evaluate(async () => { const { Staff } = await import("./js/core/entities.js"); const { Session } = await import("./js/security/session.js"); const u = Session.user(); return { staffId: u.staffId, row: Staff.byUser(u.id) }; });
  ok(creator.staffId && creator.row && creator.row.name === "홍 원장" && creator.row.job === "한의사", `workspace creator got a roster row (${creator.row?.job} ${creator.row?.name}) linked via staffId`);
  await $("#orgstep-name").fill(ORG.name); await $("#orgstep-ykiho").fill(ORG.ykiho); await $("#orgstep-biz").fill("1234567890"); await $("#orgstep-rep").fill(ORG.rep);
  await $("#orgstep-save").click();
  await closed("#org-scrim");
  await page.waitForSelector("#welcome-scrim.open", { timeout: 15000 });
  ok(true, "org saved → welcome overlay on first run");
  const orgNow = await page.evaluate(async () => (await import("./js/core/entities.js")).Org.get());
  ok(orgNow.name === ORG.name && orgNow.ykiho === ORG.ykiho && orgNow.biz === ORG.biz && orgNow.rep === ORG.rep && orgNow.kind === "병원", `Org.get() = ${JSON.stringify(orgNow)} (biz auto-hyphenated)`);
  ok((await $("#topbar-org-text").innerText()) === ORG.name, "topbar org chip shows the institution name");
  ok((await $("#welcome-scrim").innerText()).includes("마스터"), "welcome deck mentions 마스터 업로드");

  /* 2 · seed */
  at("샘플 데이터로 둘러보기 (seed-all → shared entities + every tab)");
  await $("#welcome-seed").click();
  await closed("#welcome-scrim");
  await page.waitForFunction(() => document.querySelector("#jabo-recon-toolbar")?.style.display === "flex", null, { timeout: 15000 });
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || "{}").users?.length === 4, WS_KEY, { timeout: 20000 }); // 3 seeded logins (PBKDF2 each)
  await wait(900); // canned AI timer + debounced persists
  ok((await $("#lic-list .lic").count()) === 8, "seed → 7 clinic staff + the workspace creator = 8 roster rows");
  const seeded = await page.evaluate(async () => { const { Staff, Patients, Insurers } = await import("./js/core/entities.js"); return { staff: Staff.list().map(s => [s.name, s.job, !!s.userId]), patients: Patients.list().map(p => p.pid), tags: Patients.get("P-2026-0142")?.tags, insurer: Insurers.lastUsed(), alias: Patients.alias("P-2026-0142") }; });
  ok(seeded.staff.filter(([, , login]) => login).length === 4 && seeded.staff.some(([n, j, l]) => n === "윤지훈" && j === "한의사" && l) && seeded.staff.some(([n, j]) => n === "정수아" && j === "행정"), `roster: ${seeded.staff.map(([n, j, l]) => `${j} ${n}${l ? "🔑" : ""}`).join(", ")}`);
  ok(seeded.patients.length === 5 && seeded.tags?.includes("자보") && seeded.alias === "환자 ****0142", `patients: ${seeded.patients.join(", ")} · alias "${seeded.alias}"`);
  ok(seeded.insurer === "삼성화재", "Insurers.lastUsed = 삼성화재");
  ok(/건/.test(await $("#ins-jabo").innerText()), "seed → dashboard jabo insight populated");
  const chip = await $("#topbar-due-text").innerText().catch(() => "");
  ok(!ALL_NAMES.some(n => chip.includes(n)), `topbar due chip carries no name (“${chip}”)`);

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

  /* 4 · tabs */
  at("01 상병코드 정비 — sample run with 주/부상병");
  await goTab("tab-kcd");
  ok((await $("#crumb-tab").innerText()) === "상병코드 정비", "crumb shows the new nav label");
  await runDemo("run-kcd");
  await page.waitForSelector("#kcd-result table");
  const kcdText = await $("#kcd-result").innerText();
  ok(/10건/.test(await $("#kcd-summary").innerText()), "10 rows reviewed");
  ok(kcdText.includes("U코드 단독") && kcdText.includes("중복") && kcdText.includes("형식정리"), "U코드 단독 / 중복 / 형식정리 verdicts rendered");
  ok(!kcdText.includes("주/부상병 컬럼이 없어"), "no 'missing rank column' warning when 주/부상병 present");
  ok((await $("#kcd-master-badge .src-pill.demo").count()) === 1, "master badge = 데모 발췌본");
  const kcdDl = await download(() => $("#kcd-download").click());
  ok(/_PoC\.xlsx$/.test(kcdDl.name), `xlsx filename watermarked (${kcdDl.name})`);

  at("02 자보 — two-file reconciliation + manual typing keeps focus");
  await goTab("tab-jabo");
  await runDemo("run-jabo");
  await page.waitForFunction(() => /명세서/.test(document.querySelector("#jabo-recon-summary")?.textContent || ""));
  ok((await $("#jabo-recon-result tbody tr").count()) >= 18, "reconciliation table has ≥18 lines");
  ok((await $("#jabo-recon-groups table").count()) === 2, "조정사유별 + 월별 group tables");
  await runDemo("run-jabo-manual");
  await page.waitForSelector("#jabo-items .item-row");
  const paid = $("#jabo-items .item-row").first().locator(".paid-unit");
  await paid.click(); await paid.fill(""); await paid.pressSequentially("1234", { delay: 40 });
  ok(await page.evaluate(() => document.activeElement?.classList.contains("paid-unit")), "focus stays in the 인정단가 input while typing");
  ok((await paid.inputValue()) === "1234", "typed value retained");
  ok((await $("#jabo-fee-badge .src-pill.demo").count()) === 1, "fee badge = 데모 예시표");
  const jaboDl = await download(() => $("#jabo-download").click());
  ok(/_PoC\.xlsx$/.test(jaboDl.name), `manual 정산표 filename watermarked (${jaboDl.name})`);

  at("03 연말정산 — sample → 3 issues");
  await goTab("tab-yearend");
  await runDemo("run-ye");
  await page.waitForSelector("#ye-result .ye-issues");
  ok((await $("#ye-result .ye-issues tbody tr").count()) === 3, "issue table has 3 rows");
  ok(/오류 2/.test(await $("#ye-summary").innerText()), "summary: 오류 2");
  ok(!(await $("#ye-result").innerText()).includes("2123458"), "RRN masked in the table");
  const yeDl = await download(() => $("#ye-download").click());
  ok(/_PoC\.csv$/.test(yeDl.name) && yeDl.text.includes("PoC — 실제 제출 불가"), "CSV watermark row + filename");

  at("04 비급여 — 28 rows + 실시빈도");
  await goTab("tab-bigeup");
  const bgN = Number(await $("[data-bg-count]").first().innerText());
  ok(bgN === 28 && (await $("#bg-tbody tr").count()) === 28, `28 예시 rows (${bgN})`);
  await runDemo("run-bigeup");
  await page.waitForFunction(() => document.querySelector("#bg-done")?.textContent === "28");
  ok((await $("#bg-tbody .bg-freq").first().inputValue()) !== "", "실시빈도 filled");
  ok(!(await $("#bg-download").isDisabled()), "download enabled");
  ok(/확인 필요/.test(await $("#bg-window").innerText()), "deadline copy from shared calendar");

  at("05 보존 — 작성일자 warning");
  await goTab("tab-retention");
  await runDemo("run-ret");
  await page.waitForSelector("#ret-result table");
  ok((await $("#ret-result .basis-warn").count()) === 2, "2 rows flagged 작성일자 기준");
  ok(/작성일자 기준/.test(await $("#ret-summary").innerText()), "summary mentions fallback count");

  at("06 검색 — '요통' with source badge");
  await goTab("tab-search");
  await runDemo("run-search");
  await page.waitForSelector("#search-result table");
  ok((await $("#search-result tbody tr").count()) > 0 && (await $("#search-result .src-pill.demo").count()) > 0, "results with 데모 발췌 badge");
  ok((await $("#search-source-badge .src-pill.demo").count()) === 2, "source badge: 상병 + 행위 both 데모");

  at("06 master upload — tiny KOICD-shaped xlsx → badge flips in tabs 1/6");
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

  at("07 AI — canned run → 예시 모드 pill");
  await goTab("tab-ai");
  ok(await page.evaluate(() => document.querySelector('#ai-source button[data-source="canned"]').classList.contains("active")), "default source is 예시");
  await runDemo("run-ai");
  await page.waitForFunction(() => { const p = document.querySelector("#ai-mode-pill"); return p && !p.hidden && p.textContent.includes("예시 모드"); }, null, { timeout: 8000 });
  ok(true, "pill = 예시 모드");

  at("07 AI — live: consent → redaction preview → mocked tool_use → 라이브 pill");
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
  ok((await $("#ai-output").innerText()).includes("S13.4"), "mocked tool_use parsed + rendered");

  at("08 명부 — add staff, login issue/revoke round trip, OCR unit, .ics with _PoC");
  await goTab("tab-license");
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
  const linked = await page.evaluate(async () => { const { Staff } = await import("./js/core/entities.js"); const { Session } = await import("./js/security/session.js"); const s = Staff.list().find(x => x.name === "오하늬"); const u = Session.users().find(x => x.id === s?.userId); return { userId: s?.userId, role: u?.role, staffId: u?.staffId, sid: s?.id, byUser: Staff.byUser(u?.id)?.name }; });
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
  const staffCtx = await page.evaluate(async () => { const { Staff } = await import("./js/core/entities.js"); const { activateTab } = await import("./js/core/nav.js"); const s = Staff.list().find(x => x.name === "김도현"); activateTab("tab-today"); activateTab("tab-license", { staffId: s.id }); return s.id; });
  ok((await $(`#lic-list .lic.highlight[data-id="${staffCtx}"]`).count()) === 1, "activateTab('tab-license', { staffId }) highlights that row");

  at("09 인증 — toggle one item");
  await goTab("tab-accred");
  const before = await $("#accred-summary strong").innerText();
  await $(".accred-item:not(.tool)").first().click();
  await page.waitForFunction((b) => document.querySelector("#accred-summary strong")?.textContent !== b, before);
  ok(true, `accred count changed (${before} → ${await $("#accred-summary strong").innerText()})`);

  at("00 오늘 — deadlines .ics with _PoC, feed carries no names");
  await goTab("tab-today");
  const dd = await download(() => $("#dday-ics").click());
  ok(/_PoC\.ics$/.test(dd.name) && dd.text.includes("X-POC-NOTICE:PoC"), `deadline .ics watermarked (${dd.name})`);
  if (await $("#dday-more").count()) { await $("#dday-more").click(); await wait(100); } // expand 이후 (staff deadlines are months out)
  const dashText = await $("#dday-list").innerText() + await $("#act-feed").innerText();
  ok(!ALL_NAMES.some(n => dashText.includes(n)), "dashboard deadlines + activity feed contain no full names");
  ok(/한의사 윤○○|간호사 김○○|물리치료사 이○○/.test(dashText), "dashboard uses job + initial for staff (legacy license.list alias over Staff)");
  const dl = await page.evaluate(async () => { const { allDeadlines } = await import("./js/core/calendar.js"); return allDeadlines().map(d => ({ key: d.key, ctx: d.ctx })); });
  ok(dl.some(d => d.key.startsWith("bigeup") && /^\d{4}-\d{2}$/.test(d.ctx?.refMonth)) && dl.some(d => d.key === "yearend" && Number.isInteger(d.ctx?.taxYear)) && dl.some(d => d.key.startsWith("lic-") && d.ctx?.staffId), `calendar items carry ctx (${dl.length} items: refMonth / taxYear / staffId)`);
  at("접수 보드 — pid picker over Patients, alias labels, no names");
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
  if (MOBILE) await noOverflow("shell (today)");

  /* 5 · privacy panel */
  at("데이터 처리 현황 — zero 미등록");
  await railClick("#rail-privacy");
  await page.waitForSelector("#privacy-scrim.open");
  await page.waitForFunction(() => document.querySelectorAll("#privacy-table tr").length > 5);
  const unreg = await $("#privacy-table tr.unregistered").count();
  ok(unreg === 0, `0 미등록 rows (got ${unreg}: ${(await $("#privacy-table tr.unregistered").allInnerTexts()).join(" | ")})`);
  const regText = await $("#privacy-table").innerText();
  ok(regText.includes("업로드 마스터") && regText.includes("직원 명부") && regText.includes("기관 프로필") && regText.includes("가명 환자 대장"), "register lists masters + the entity rows (org · staff · patients)");
  const bk = await download(() => $("#privacy-backup").click());
  ok(/_PoC\.json$/.test(bk.name), `backup filename watermarked (${bk.name})`);
  const bkJ = JSON.parse(bk.text);
  ok(bkJ.v === 2 && bkJ.keyring.users.every(u => u.staffId) && Object.keys(bkJ.sensitive).includes("staff.list") && Object.keys(bkJ.sensitive).includes("patients.register"), "backup is v2: keyring users carry staffId, staff.list + patients.register envelopes included");
  ok(!ALL_NAMES.some(n => JSON.stringify({ ...bkJ, keyring: null }).includes(n)), "backup file has no plaintext names outside the keyring (org.profile travels inside the encrypted `plain` bundle)");
  await $("#privacy-close").click(); await closed("#privacy-scrim");

  /* 6 · storage has no plaintext */
  at("localStorage / IndexedDB contain no plaintext names");
  await wait(700); // let the encrypted write chains flush
  const snap = await storeSnapshot();
  ok(!Object.keys(snap.ls).some(k => /\.(license\.list|yearend\.ye-biz|yearend\.ye-clinic|bigeup\.profile\.|bigeup\.tariff)/.test(k)), `no legacy keys written by the compat aliases (${Object.keys(snap.ls).filter(k => k.startsWith("vibe.clinic-admin.")).map(k => k.slice(18)).join(", ")})`);
  const lsText = JSON.stringify(Object.fromEntries(Object.entries(snap.ls).filter(([k]) => !PLAIN_OK.has(k)))), idbText = JSON.stringify(snap.idb);
  const leakedLs = ALL_NAMES.filter(n => lsText.includes(n)), leakedIdb = ALL_NAMES.filter(n => idbText.includes(n));
  ok(!leakedLs.length, `localStorage: no names (leaked: ${leakedLs.join(",") || "none"})`);
  ok(!leakedIdb.length, `IndexedDB: no names (leaked: ${leakedIdb.join(",") || "none"})`);
  ok(!lsText.includes("2123458"), "no RRN digits persisted");
  ok(Object.keys(snap.idb).includes("vibe-clinic-admin-masters"), "masters DB exists before wipe");

  /* 7 · lock / unlock as 행정 */
  at("lock → locked state → unlock as 행정");
  await railClick("#rail-lock");
  await page.waitForSelector("body.locked");
  ok(await page.evaluate(() => getComputedStyle(document.querySelector(".frame.shell")).visibility === "hidden" && document.querySelector(".frame.shell").inert === true), "shell hidden + inert while locked");
  ok(await page.evaluate(async () => { const { Store } = await import("./js/core/store.js"); const { Staff } = await import("./js/core/entities.js"); return Store.get("license.list", []).length === 0 && Staff.list().length === 0 && !localStorage.getItem("vibe.clinic-admin.staff.list")?.includes("오하늬"); }), "Store / Staff return empty for sensitive keys while locked");
  if (MOBILE) await noOverflow("lock screen (unlock)");
  await page.locator(".lock-user", { hasText: "행정 김" }).click();
  await $("#lock-pin").fill("5678"); await $("#lock-submit").click();
  await page.waitForSelector("body:not(.locked)", { timeout: 20000 });
  ok((await $("#topbar-user-text").innerText()).includes("행정 김"), "topbar chip = 행정 김");
  await page.waitForFunction(() => document.querySelectorAll("#lic-list .lic").length === 10);
  ok(true, "roster re-rendered after re-unlock (10 rows)");
  ok((await $("#lic-list .lic-link").count()) === 0, "non-owner (행정) sees no 로그인 발급/해제 actions");

  at("audit log entries carry actor + staffId + role and no names");
  const audit = await page.evaluate(async () => { const { ActivityLog } = await import("./js/core/store.js"); return ActivityLog.all(); });
  ok(audit.length > 15, `${audit.length} audit entries`);
  ok(audit.every(e => e.actor && e.role && typeof e.action === "string"), "every entry has actor + role + action");
  ok(audit.every(e => e.staffId), "every entry links the actor to a roster row (staffId)");
  const auditText = JSON.stringify(audit);
  ok(!ALL_NAMES.some(n => auditText.includes(n)), `audit log has no patient/staff names`);
  ok(audit.some(e => e.subject && /○○/.test(e.subject)), "staff subjects are role + initial");
  ok(audit.some(e => e.subject && /^\*\*\*\*/.test(e.subject)), "patient subjects are ****NNNN");
  ok(audit.some(e => e.actor === "행정 김") && audit.some(e => e.actor === "홍 원장"), "both users appear as actors");

  /* 8 · 전체 파기 */
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

  /* 9 · restore */
  at("restore encrypted backup with PIN → data back");
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
  ok(/최근 정비/.test(await $("#kcd-status").innerText()), "kcd.lastSummary restored");

  /* 10 · reload persistence */
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

  /* 10a · LEGACY → ENTITIES: fresh profile with pre-entities keys, activateTab ctx payload, v1 backup restore */
  at("legacy: fresh workspace + pre-entities keys (license.list / yearend.* / bigeup.*) → unlock migrates them");
  const ctxL = await browser.newContext({ viewport: MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: MOBILE, hasTouch: MOBILE, acceptDownloads: true, locale: "ko-KR" });
  const pL = await ctxL.newPage();
  shotPage = pL;
  pL.on("pageerror", e => pageErrors.push("[legacy] " + String(e && e.stack || e)));
  pL.on("console", m => { if (m.type() !== "error") return; const loc = m.location()?.url || ""; if (BLOCKED.test(safeHost(loc))) return; consoleErrors.push(`[legacy] ${m.text()} @ ${loc}`); });
  await pL.route(/.*/, (route) => { const url = new URL(route.request().url()); if (url.hostname === "ai.pb.gurum.se" || BLOCKED.test(url.hostname)) return route.abort("failed"); return route.continue(); });
  const $L = (sel) => pL.locator(sel);
  const ent = (fn) => pL.evaluate(async (src) => { const E = await import("./js/core/entities.js"); const { Session } = await import("./js/security/session.js"); const { Store, EventBus } = await import("./js/core/store.js"); const { activateTab } = await import("./js/core/nav.js"); const C = await import("./js/security/crypto.js"); return (new Function("E", "Session", "Store", "EventBus", "activateTab", "C", `return (${src})(E, Session, Store, EventBus, activateTab, C)`))(E, Session, Store, EventBus, activateTab, C); }, fn.toString());
  await pL.goto(BASE, { waitUntil: "domcontentloaded" });
  await pL.waitForSelector("#lock-scrim.open");
  await $L("#setup-name").fill("홍 원장"); await $L("#setup-role").selectOption("원장"); await $L("#setup-pin").fill("1234"); await $L("#setup-pin2").fill("1234");
  await $L("#setup-submit").click();
  await pL.waitForSelector("#org-scrim.open", { timeout: 20000 });
  await $L("#orgstep-skip").click(); // "나중에 입력"
  await pL.waitForSelector("#welcome-scrim.open", { timeout: 15000 });
  ok((await $L("#topbar-org-text").innerText()).length > 0 && (await pL.evaluate(async () => (await import("./js/core/entities.js")).Org.isComplete())) === false, "org step skipped → Org.isComplete() false, chip nudges");
  await $L("#welcome-blank").click();
  await pL.waitForFunction(() => !document.querySelector("#welcome-scrim")?.classList.contains("open"));
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
  await $L("#rail-lock").click().catch(async () => { if (MOBILE) { await $L("#hamburger").click(); await pL.waitForTimeout(350); await $L("#rail-lock").click(); } });
  await pL.waitForSelector("body.locked");
  await pL.locator(".lock-user", { hasText: "홍 원장" }).click();
  await $L("#lock-pin").fill("1234"); await $L("#lock-submit").click();
  await pL.waitForSelector("body:not(.locked)", { timeout: 20000 });
  const mig = await ent((E, Session) => ({
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
  ok((await pL.evaluate(() => document.querySelector("#ye-biz")?.value)) === "987-65-43210" && (await pL.evaluate(() => document.querySelector("#bg-ykiho")?.value)) === "22000456", "legacy bindPersist inputs (tab3/tab4) read through the Store aliases");

  at("activateTab(id, ctx) emits tab:activated { id, ctx }");
  const payload = await ent((E, Session, Store, EventBus, activateTab) => new Promise(res => { EventBus.on("tab:activated", p => { if (p?.id === "tab-yearend") res(p); }); activateTab("tab-yearend", { taxYear: 2025 }); }));
  ok(payload.id === "tab-yearend" && payload.ctx?.taxYear === 2025, `payload ${JSON.stringify(payload)}`);
  const payload2 = await ent((E, Session, Store, EventBus, activateTab) => new Promise(res => { EventBus.on("tab:activated", p => { if (p?.id === "tab-kcd") res(p); }); activateTab("tab-kcd"); }));
  ok(payload2.id === "tab-kcd" && payload2.ctx === null, "no ctx → ctx: null");

  at("Batches: create / list / latest / cap 20 / remove — encrypted claims.batch.* keys");
  const bt = await ent((E, Session, Store) => {
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
  const v1 = await ent(async (E, Session, Store, EventBus, activateTab, C) => {
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
  await pL.waitForSelector("#privacy-scrim.open");
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
  const afterV1 = await ent((E) => ({ staff: E.Staff.list().map(s => [s.name, s.job]), org: E.Org.get(), tariff: E.Tariff.all(), legacyLeft: Object.keys(localStorage).filter(k => /vibe\.clinic-admin\.(license\.list|yearend\.ye-biz|bigeup\.profile\.|bigeup\.tariff)/.test(k)) }));
  ok(afterV1.staff.some(([n, j]) => n === "백업간호" && j === "간호사") && afterV1.staff.some(([n]) => n === "홍 원장") && !afterV1.staff.some(([n]) => n === LEGACY_STAFF[0]), `v1 restore replaced the roster (${afterV1.staff.map(([n, j]) => `${j} ${n}`).join(", ")})`);
  ok(afterV1.org.biz === "111-22-33333" && afterV1.org.ykiho === "33000789" && afterV1.tariff["예시-02"]?.max === "9000" && afterV1.legacyLeft.length === 0, `v1 keys migrated to Org/Tariff, legacy keys gone (${JSON.stringify(afterV1.org)})`);
  await ctxL.close();

  /* 10b · ENGLISH pass — fresh profile */
  at("EN: fresh profile → EN toggle on the lock screen → setup pane is English");
  const ctx2 = await browser.newContext({ viewport: MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: MOBILE, hasTouch: MOBILE, acceptDownloads: true, locale: "en-GB" });
  const p2 = await ctx2.newPage();
  shotPage = p2;
  p2.on("pageerror", e => pageErrors.push("[EN] " + String(e && e.stack || e)));
  p2.on("console", m => { if (m.type() !== "error") return; const loc = m.location()?.url || ""; if (BLOCKED.test(safeHost(loc))) return; consoleErrors.push(`[EN] ${m.text()} @ ${loc}`); });
  await p2.route(/.*/, (route) => { const url = new URL(route.request().url()); if (url.hostname === "ai.pb.gurum.se" || BLOCKED.test(url.hostname)) return route.abort("failed"); return route.continue(); });
  const $2 = (sel) => p2.locator(sel);
  const railClick2 = async (id) => { if (MOBILE) { await $2("#hamburger").click(); await p2.waitForTimeout(350); } await $2(id).click(); if (MOBILE) await p2.evaluate(() => document.body.classList.remove("rail-open")); };
  const goTab2 = async (panel) => { await railClick2(`.rail-btn[data-panel="${panel}"]`); await p2.waitForSelector(`#${panel}.active`); };
  // Desktop: topbar toggle. Phone: the topbar toggle is hidden, the drawer foot carries it.
  const setLang2 = async (lang) => {
    if (MOBILE) { await $2("#hamburger").click(); await p2.waitForTimeout(350); await $2(`.rail-foot .lang-toggle button[data-lang="${lang}"]`).click(); await p2.evaluate(() => document.body.classList.remove("rail-open")); }
    else await $2(`.topbar .lang-toggle button[data-lang="${lang}"]`).click();
    await p2.waitForFunction((l) => document.documentElement.lang === l, lang);
  };
  const download2 = async (action) => { const [dl] = await Promise.all([p2.waitForEvent("download", { timeout: 15000 }), action()]); const path = await dl.path(); return { name: dl.suggestedFilename(), text: path ? readFileSync(path, "utf8") : "" }; };
  const panelTexts = (panel) => p2.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(e => e.textContent), EN_SELECTOR(panel));
  const noOverflow2 = async (label) => { const r = await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, shell: document.querySelector(".frame.shell")?.scrollWidth || 0, lock: document.querySelector("#lock-scrim")?.scrollWidth || 0 })); ok(r.sw <= r.iw + 1 && r.shell <= r.iw + 1 && r.lock <= r.iw + 1, `[EN] ${label}: no horizontal overflow (doc ${r.sw} / shell ${r.shell} / lock ${r.lock} ≤ ${r.iw})`); };

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

  at("EN: seed → every tab free of Hangul in headings/buttons/headers/labels/pills/caveats");
  await $2("#welcome-seed").click();
  await p2.waitForFunction(() => !document.querySelector("#welcome-scrim")?.classList.contains("open"));
  await p2.waitForFunction(() => document.querySelector("#jabo-recon-toolbar")?.style.display === "flex", null, { timeout: 15000 });
  await p2.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || "{}").users?.length === 4, WS_KEY, { timeout: 20000 });
  await p2.waitForTimeout(900);
  ok((await $2("#topbar-org-text").innerText()) === ORG.name, "EN: seed filled the skipped org profile (chip = 한솔한방병원)");
  const crumb2 = await p2.evaluate(() => [document.querySelector("#crumb-section")?.textContent, document.querySelector("#crumb-tab")?.textContent]);
  ok(crumb2[0] === "Start" && crumb2[1] === "Today", `crumb in English (${crumb2.join(" · ")})`);
  ok((await $2("#topbar-user-text").innerText()) === "KW · Director", `topbar user chip role in English (${await $2("#topbar-user-text").innerText()})`);
  const PANELS = ["tab-today", "tab-kcd", "tab-jabo", "tab-yearend", "tab-bigeup", "tab-retention", "tab-search", "tab-ai", "tab-license", "tab-accred"];
  for (const panel of PANELS) {
    await goTab2(panel);
    if (panel === "tab-today" && await $2("#dday-more").count()) await $2("#dday-more").click();
    const left = leftoverHangul(await panelTexts(panel));
    ok(left.length === 0, `${panel}: English only (leftovers: ${left.slice(0, 5).join(" | ") || "none"})`);
    if (MOBILE) await noOverflow2(panel);
  }
  ok((await $2("#kcd-result tbody tr").count()) === 10 && (await $2("#kcd-result .pill").first().innerText()).length > 0, "EN: KCD result table rendered (10 rows)");
  ok(/rows.*reviewed/.test(await $2("#kcd-summary").innerText()), `EN: KCD summary in English (${await $2("#kcd-summary").innerText()})`);
  ok((await $2("#bg-tbody .pill").first().innerText()) === "Pharmacopuncture", "EN: non-covered category pill translated");
  ok(/Low back pain/.test(await $2("#search-result").innerText()), "EN: search results show bundled English names");
  ok(/KM doctor|Nurse/.test(await $2("#lic-list").innerText()) && !/한의사 /.test(await $2("#lic-list .lic-role").first().innerText()), "EN: staff roles in English, names untouched");
  ok(/Sprain and strain of cervical spine \(경추의 염좌 및 긴장\)/.test(await $2("#ai-output").innerText()), "EN: AI result shows English name with the Korean standard name in parentheses");

  at("EN: KO round-trip keeps the result tables, then back to EN");
  await goTab2("tab-kcd");
  const kcdRows = await $2("#kcd-result tbody tr").count();
  await setLang2("ko");
  ok((await $2("#kcd-result tbody tr").count()) === kcdRows && /건/.test(await $2("#kcd-summary").innerText()) && (await p2.evaluate(() => document.querySelector("#crumb-tab")?.textContent)) === "상병코드 정비", "toggle → KO: table kept, summary + crumb Korean");
  ok((await $2("#tab-kcd h3").innerText()).includes("EDI 표준형"), "toggle → KO: static heading restored");
  await goTab2("tab-jabo");
  ok((await $2("#jabo-recon-result tbody tr").count()) >= 18 && /명세서/.test(await $2("#jabo-recon-summary").innerText()), "toggle → KO: reconciliation table kept");
  await setLang2("en");
  ok((await $2("#jabo-recon-result tbody tr").count()) >= 18 && /statements/.test(await $2("#jabo-recon-summary").innerText()), "toggle → EN again: reconciliation table kept, summary English");
  ok((await $2(MOBILE ? '.rail-foot .lang-toggle button[data-lang="en"]' : '.topbar .lang-toggle button[data-lang="en"]').getAttribute("aria-pressed")) === "true", "toggle aria-pressed = EN");

  at("EN: exports carry English headers + watermark; palette offers the language switch");
  await goTab2("tab-kcd");
  const kcdEn = await download2(() => $2("#kcd-download").click());
  ok(/^diagnosis_codes_.*_PoC\.xlsx$/.test(kcdEn.name), `EN xlsx filename (${kcdEn.name})`);
  await goTab2("tab-yearend");
  const yeEn = await download2(() => $2("#ye-download").click());
  const [yeHead, yeMark] = yeEn.text.split("\n");
  ok(/Patient name/.test(yeHead) && /RRN \(masked\)/.test(yeHead) && !HANGUL.test(yeHead), `EN CSV headers (${yeHead.slice(0, 80)}…)`);
  ok(/PoC — not for real submission/.test(yeMark), "EN CSV watermark row in English");
  await p2.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await p2.waitForSelector("#palette-scrim.open");
  ok(/Switch to Korean/.test(await $2("#palette-results").innerText()), "palette lists the language command");
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
  const ctx3 = await browser.newContext({ viewport: MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: MOBILE, hasTouch: MOBILE, locale: "ko-KR" });
  const p3 = await ctx3.newPage();
  shotPage = p3;
  p3.on("pageerror", e => pageErrors.push("[EN?lang] " + String(e && e.stack || e)));
  await p3.route(/.*/, (route) => { const url = new URL(route.request().url()); if (url.hostname === "ai.pb.gurum.se" || BLOCKED.test(url.hostname)) return route.abort("failed"); return route.continue(); });
  await p3.goto(BASE + "?lang=en", { waitUntil: "domcontentloaded" });
  await p3.waitForSelector("#lock-scrim.open");
  ok((await p3.evaluate(() => document.documentElement.lang)) === "en", "?lang=en → <html lang> = en");
  const setup3 = await p3.locator("#lock-setup").innerText();
  ok(/Create workspace/.test(setup3) && leftoverHangul([setup3]).length === 0, "?lang=en → setup pane English on a fresh profile");
  ok((await p3.evaluate(() => localStorage.getItem("vibe.clinic-admin.ui.lang"))) === "en", "?lang=en persisted");
  await ctx3.close();

  /* 11 · errors */
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
