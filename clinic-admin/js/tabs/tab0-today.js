/* clinic-admin — Tab 00 · 오늘 dashboard */
import { $, $$, esc, won, todayISO, relTime, daysUntil, debounce, Share, Toast, redactSubject, tagLabel } from "../core/ui.js";
import { t, pick, getLang, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { downloadText, pocMark } from "../core/files.js";
import { allDeadlines } from "../core/calendar.js";
import { activateTab } from "../core/nav.js";
import { Org, Staff, Batches, Tariff, Insurers } from "../core/entities.js";
import { accredProgress } from "./tab9-accred.js";
import { claimsSteps } from "./claims-landing.js";
import { onClaimsChange, appealStats, nhisHistory, nhisReasonLabel } from "./claims-shared.js";
import { guaranteeDeadlines } from "./patients-shared.js";
import { entryMonth, payerOf, monthKeyOf } from "./reporting-shared.js";
import { retentionStats } from "./tab5-retention.js";
/* Sibling imports: 홈 is the one panel that reads every other area's derivations — the shared producers live in the
   area-level shared modules (claims-shared · patients-shared · reporting-shared) or are exported by the owning tab
   (tab9 accredProgress · tab5 retentionStats), never the other way round, so there is no import cycle. The deadline
   sources (appealDeadlines · guaranteeDeadlines) reach 홈 through core/calendar.js — tab-appeal.js / tab-guarantee.js
   register them at load; 홈 only calls allDeadlines(). */

/* ─────────────────────────────────────────────────────────
   홈 › 오늘 — task-first home
   Backend-free orchestrator: it reads the Store / entities every other tool writes and computes the todo list,
   deadlines, KPIs and resume cards live, re-rendering on any store change.
   · 지금 할 일 (#todo-list .todo[data-key][data-ctx]) — ONE merged, urgency-sorted list: setup nudges (기관 정보 · 직원
     명부), every deadline within 30 days / overdue in the past year (core/calendar.js allDeadlines — statutory + roster +
     the external sources tab-appeal / tab-guarantee register), the open step of the current claim batch per payer
     (claims-landing.claimsSteps({ payer })), an unfinished 자보 수기 case. Grouped 지연 / 오늘 / 이번 주 / 이번 달, at most
     8 rows, the rest behind 더 보기. Every row is one deep link: activateTab(link, ctx).
   · 다가오는 마감 (#dday-list) — the full 12-month list (statutory + per-person, windowed −30 … +365 days) plus the
     external sources; the .ics export takes the same list.
   · 이번 달 숫자 (#today-insights .insight.kpi) — the management KPIs a 행정원장 reviews with the 원장, for ONE month
     (#kpi-month: default = the latest month that has reconciliation data — the seeded batch is 2026-08):
       자보 / 건보 청구 vs 인정 (jabo.history + nhis.history recon rows, split by `payer`; missing → 자보)  confidence: high
       조정률 per payer, 최다 조정사유 (both payers, byReason keys), 보험사별 조정                 high
       이의신청 현황 open / overdue / 회수 (claims-shared appealStats over appeals.list)             high
       지불보증 만료 임박 (patients-shared guaranteeDeadlines: expiring ≤7일 → soon, 만료 → over)   high
       비급여 매출 추정 = Σ consent items × price, this month (consent.list rows { at: "yyyy-mm-dd",
         items:[{ code, qty, price }] } — price snapshotted at consent time, Tariff as fallback)    medium
       미수금 지표 = Σ(청구 − 인정) of the month − 이의신청 금액 already filed (global, not per month)   low
     Skeleton shimmer until the first render; "원장 보고용 요약 복사" renders the same numbers as plain text (clipboard +
     on-screen <pre>), watermarked with the PoC line, no person names.
   ───────────────────────────────────────────────────────── */
let api = null;
export function seed() { api?.seed(); }

const PAYERS = ["auto", "nhis"];

export function init(ctx) {
  const { DATA } = ctx;
  const NOW = new Date();
  const Y = NOW.getFullYear();
  const REASONS = DATA?.jabo?.adjustment_reasons || [];
  // 조정사유 label across both vocabularies: 자보 classes (data/jabo.json) → 건보 classes (nhis.reason.*) → the stored text.
  const reasonLabel = (k) => { const r = REASONS.find(x => x.key === k); return r ? pick(r, "label") : (nhisReasonLabel(k) || String(k ?? "")); };
  const insurerLabel = (v) => { const i = Insurers.list().find(x => x.value === v); return i ? pick(i, "label") : String(v ?? ""); };
  const payerLabel = (p) => t("today.payer." + p);
  const openOrg = () => activateTab("tab-org");

  // ── deadlines ── statutory (next 12 months, 의원급 drops the September window — core/calendar.js decides)
  // + per-person licence items windowed to −30 … +365 days + external sources (same window); sorted soonest first, past-due last.
  const windowed = (d) => d.daysLeft == null || (d.daysLeft <= 365 && d.daysLeft >= -30);
  const loadDeadlines = () => allDeadlines(NOW).filter(d => (!d.key.startsWith("lic-") && !d.kind) || windowed(d));

  // Group: 초과 / 이번 달 / 다음 달 / 이후 — 이후 is collapsed behind "더 보기".
  const groupOf = (d) => {
    if (d.daysLeft == null) return "later";
    if (d.daysLeft < 0) return "over";
    const dt = new Date(d.date + "T00:00:00");
    const m = (dt.getFullYear() - Y) * 12 + dt.getMonth() - NOW.getMonth();
    return m <= 0 ? "this" : m === 1 ? "next" : "later";
  };
  const groupLabel = (g) => t("today.group." + g);
  let showLater = false;

  function renderDeadlines() {
    const list = loadDeadlines();
    const groups = { over: [], this: [], next: [], later: [] };
    for (const d of list) groups[groupOf(d)].push(d);
    const item = (d) => {
      const days = d.daysLeft;
      let cls = "", label = "";
      if (days == null) { cls = ""; label = "—"; }
      else if (days < 0) { cls = "over"; label = t("today.overdue", { n: -days }); }
      else if (days === 0) { cls = "urgent"; label = t("today.todayLabel"); }
      else if (days <= 14) { cls = "urgent"; label = t("today.daysLeft", { n: days }); }
      else if (days <= 60) { cls = "warn"; label = t("today.daysLeft", { n: days }); }
      else { cls = ""; label = t("today.daysLeft", { n: days }); }
      return `
        <div class="dday ${cls}" data-key="${esc(d.key)}" data-link="${esc(d.link || "")}"${d.ctx ? ` data-ctx='${esc(JSON.stringify(d.ctx))}'` : ""} role="button" tabindex="0">
          <div class="dnum">${label}</div>
          <div class="dbody">
            <div class="dtitle">${esc(d.title)}</div>
            <div class="dmeta">${esc(d.date)} · ${esc(d.source)}</div>
          </div>
          <div class="arrow">→</div>
        </div>`;
    };
    let html = "";
    for (const g of ["over", "this", "next"]) {
      if (!groups[g].length) continue;
      html += `<div class="dday-group"><div class="dday-group-label">${esc(groupLabel(g))} · ${groups[g].length}</div>${groups[g].map(item).join("")}</div>`;
    }
    if (groups.later.length) {
      html += `<div class="dday-group">
        <button type="button" class="dday-more" id="dday-more" aria-expanded="${showLater}">${esc(showLater ? t("today.less") : t("today.more"))} — ${esc(groupLabel("later"))} ${esc(t("common.nItems", { n: groups.later.length }))} ${showLater ? "↑" : "↓"}</button>
        ${showLater ? groups.later.map(item).join("") : ""}
      </div>`;
    }
    $("#dday-list").innerHTML = html || `<div class="empty">${esc(t("today.noDeadlines"))}</div>`;
    $$("#dday-list .dday").forEach(el => {
      const go = () => { let c; try { c = el.dataset.ctx ? JSON.parse(el.dataset.ctx) : undefined; } catch {} if (el.dataset.link) activateTab(el.dataset.link, c); };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    $("#dday-more")?.addEventListener("click", () => { showLater = !showLater; renderDeadlines(); });
  }

  // ── 지금 할 일 ──
  const ddayLabel = (days) => days == null ? "—" : days < 0 ? t("today.overdue", { n: -days }) : days === 0 ? t("today.todayLabel") : t("today.daysLeft", { n: days });
  const ddayCls = (days) => days == null ? "" : days < 0 ? "over" : days <= 7 ? "urgent" : "warn";
  // Urgency bucket: 지연 (overdue) → 오늘 (due today + everything actionable now: nudges, open claim steps, the manual
  // case) → 이번 주 (≤7 days) → 이번 달 (≤30 days).
  const TODO_GROUPS = ["over", "today", "week", "month"];
  const todoGroup = (days) => days == null ? "today" : days < 0 ? "over" : days === 0 ? "today" : days <= 7 ? "week" : "month";
  // claimsSteps(payer) — the 3 steps of that payer's current batch (claims-landing.js); every step carries `payer` + `batchId`.
  const stepsByPayer = () => PAYERS.flatMap(p => { try { return (claimsSteps(p) || []).filter(Boolean); } catch { return []; } });
  function todoItems() {
    const items = [];
    // Setup nudges — blocking, so they sit first in 오늘.
    if (!Org.isComplete()) items.push({ key: "nudge:org", cls: "nudge", when: `<span class="nudge-dot"></span>${esc(t("today.todo.setup"))}`, title: t("today.nudge.org"), meta: t("today.nudge.orgMeta"), link: "tab-org", ctx: null, btn: t("today.nudge.orgBtn"), days: null, order: -20 });
    if (!Staff.list().length) items.push({ key: "nudge:staff", cls: "nudge", when: `<span class="nudge-dot"></span>${esc(t("today.todo.setup"))}`, title: t("today.nudge.staff"), meta: t("today.nudge.staffMeta"), link: "tab-license", ctx: null, btn: t("today.nudge.staffBtn"), days: null, order: -10 });
    // Anything due within 30 days — and anything overdue in the past year: an expired 면허신고 is still a to-do.
    for (const d of allDeadlines(NOW)) {
      if (d.daysLeft == null || d.daysLeft > 30 || d.daysLeft < -365) continue;
      items.push({ key: `dl:${d.key}`, cls: ddayCls(d.daysLeft), when: ddayLabel(d.daysLeft), title: d.title, meta: `${d.date} · ${d.source}`, link: d.link, ctx: d.ctx || null, btn: t("home.todo.open"), days: d.daysLeft, order: 0 });
    }
    for (const s of stepsByPayer()) {
      if (s.state !== "todo" && s.state !== "need") continue;
      items.push({ key: `batch:${s.payer}:${s.key}`, cls: "step", when: esc(payerLabel(s.payer)), title: s.title, meta: s.detail, link: s.link, ctx: s.ctx, btn: s.btn, days: null, order: 100 }); // key unique per payer
    }
    const draft = Store.get("jabo.draft.items");
    if (Array.isArray(draft) && draft.length) {
      const pid = Store.get("jabo.draft.jabo-pid");
      items.push({ key: "jabo-manual", cls: "step", when: esc(t("home.todo.resume")), title: t("home.todo.manualCase", { who: pid ? redactSubject({ pid }) : t("today.resume.noPatient") }), meta: t("today.resume.nProcs", { n: draft.length }), link: "tab-jabo", ctx: { focus: "manual" }, btn: t("home.todo.resumeBtn"), days: null, order: 200 });
    }
    for (const it of items) it.group = todoGroup(it.days);
    const rank = (it) => TODO_GROUPS.indexOf(it.group);
    return items.sort((a, b) => rank(a) - rank(b) || (a.days ?? 0) - (b.days ?? 0) || a.order - b.order);
  }
  const TODO_MAX = 8;
  let todoExpanded = false;
  // One merged list in one section: the setup nudges render first (always visible, blocking) into #today-nudges as
  // .todo.nudge[data-nudge] rows; dated items + claim steps + the manual case follow in #todo-list, capped at 8 + 더 보기.
  function renderTodo() {
    const el = $("#todo-list"); if (!el) return;
    const all = todoItems();
    const nudgeItems = all.filter(it => it.cls === "nudge"), items = all.filter(it => it.cls !== "nudge");
    const count = $("#todo-count");
    if (count) { count.hidden = !all.length; count.textContent = all.length ? t("home.todo.count", { n: all.length }) : ""; }
    const row = (it) => `
      <div class="todo ${it.cls}" role="listitem" data-key="${esc(it.key)}"${it.cls === "nudge" ? ` data-nudge="${esc(it.key.slice(6))}"` : ""} data-link="${esc(it.link || "")}" data-ctx='${esc(JSON.stringify(it.ctx || {}))}' data-group="${it.group}">
        <span class="todo-when">${it.when}</span>
        <div class="todo-body"><div class="todo-title">${esc(it.title)}</div><div class="todo-meta">${esc(it.meta)}</div></div>
        <button type="button" class="btn secondary sm" data-todo-go>${esc(it.btn)} <span class="arrow">→</span></button>
      </div>`;
    const wire = (root) => $$(".todo", root).forEach(r => {
      const go = () => { let c; try { c = JSON.parse(r.dataset.ctx || "{}"); } catch { c = {}; } if (r.dataset.link) activateTab(r.dataset.link, Object.keys(c).length ? c : undefined); };
      r.querySelector("[data-todo-go]").addEventListener("click", (e) => { e.stopPropagation(); go(); });
      r.addEventListener("click", go);
    });
    const nudges = $("#today-nudges");
    if (nudges) {
      nudges.innerHTML = nudgeItems.length ? `<div class="todo-group-label" data-group="setup">${esc(t("today.todo.setup"))} · ${nudgeItems.length}</div>` + nudgeItems.map(row).join("") : "";
      nudges.style.display = nudgeItems.length ? "" : "none";
      wire(nudges);
    }
    if (!items.length) { el.innerHTML = nudgeItems.length ? "" : `<div class="todo-empty">${esc(t("home.todo.empty"))}</div>`; return; }
    const shown = todoExpanded ? items : items.slice(0, TODO_MAX);
    let html = "", g = null;
    for (const it of shown) {
      if (it.group !== g) { g = it.group; html += `<div class="todo-group-label" data-group="${g}">${esc(t("today.todo.group." + g))} · ${items.filter(x => x.group === g).length}</div>`; }
      html += row(it);
    }
    if (items.length > TODO_MAX) html += `<button type="button" class="todo-more" id="todo-more" aria-expanded="${todoExpanded}">${esc(todoExpanded ? t("today.less") : t("today.todo.more", { n: items.length - TODO_MAX }))} ${todoExpanded ? "↑" : "↓"}</button>`;
    el.innerHTML = html;
    wire(el);
    $("#todo-more")?.addEventListener("click", () => { todoExpanded = !todoExpanded; renderTodo(); });
  }

  // ── KPI tiles ──
  let kpiMonth = null; // null → the latest month with reconciliation data (falls back to the current month)
  // 자보 rows (jabo.history — recon + manual) and 건보 rows (nhis.history, stamped payer:"nhis" by 건보 대조) in one list.
  const history = () => [...(Store.get("jabo.history", []) || []), ...(nhisHistory() || [])].filter(h => h && typeof h.at === "number" && h.claimed != null);
  const monthsWithData = () => [...new Set(history().map(entryMonth))].sort().reverse();
  const currentMonth = () => { const ms = monthsWithData(); if (kpiMonth && ms.includes(kpiMonth)) return kpiMonth; return ms[0] || monthKeyOf(Date.now()); };
  const sum = (arr, f) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
  const approvedOf = (h) => h.paid != null ? +h.paid : h.approved != null ? +h.approved : (+h.claimed || 0) - (+h.cut || 0);
  // Tariff price of a 비급여 item for the 매출 추정: the stored 중간값, else the midpoint of 최저·최고.
  const tariffPrice = (code) => { const e = Tariff.get(code); if (!e) return 0; const med = +e.med; if (med) return med; const a = +e.min, b = +e.max; return a || b ? Math.round(((a || b) + (b || a)) / 2) : 0; };
  function kpiData() {
    const all = history();
    const month = currentMonth();
    const entries = all.filter(h => entryMonth(h) === month);
    const byPayer = {};
    for (const p of PAYERS) {
      const rows = entries.filter(h => payerOf(h) === p);
      const claimed = sum(rows, h => h.claimed), cut = sum(rows, h => h.cut), approved = sum(rows, approvedOf);
      byPayer[p] = { n: rows.length, claimed, approved, cut, rate: claimed ? Math.round((cut / claimed) * 1000) / 10 : 0 };
    }
    const claimed = sum(entries, h => h.claimed), cut = sum(entries, h => h.cut);
    // 조정사유 — both payers, by the stable reason key P3/F2 store on recon rows.
    const byReason = new Map();
    for (const h of entries) for (const g of h.byReason || []) {
      const k = g.key || g.reason || ""; if (!k) continue;
      const cur = byReason.get(k) || { cut: 0, lines: 0, payers: new Set() }; cur.cut += +g.cut || 0; cur.lines += +g.lines || 0; cur.payers.add(payerOf(h)); byReason.set(k, cur);
    }
    if (!byReason.size) {
      for (const b of (Batches.list("review") || []).filter(b => monthKeyOf(b.createdAt) === month)) for (const r of b.rows || []) {
        const k = r.reasonKey || r.reason || r.reasonText || ""; if (!k) continue;
        const cur = byReason.get(k) || { cut: 0, lines: 0, payers: new Set(["auto"]) }; cur.lines++; cur.cut += Math.max(0, (+r.claimed || 0) - (+r.approved || 0)); byReason.set(k, cur);
      }
    }
    const reasons = [...byReason.entries()].sort((a, b) => (b[1].cut - a[1].cut) || (b[1].lines - a[1].lines));
    // 보험사별 — 자보 rows carrying `insurer`.
    const byIns = new Map();
    for (const h of entries) { if (!h.insurer || payerOf(h) !== "auto") continue; const cur = byIns.get(h.insurer) || { cut: 0, claimed: 0, n: 0 }; cur.cut += +h.cut || 0; cur.claimed += +h.claimed || 0; cur.n++; byIns.set(h.insurer, cur); }
    const insurers = [...byIns.entries()].sort((a, b) => b[1].cut - a[1].cut);
    // 이의신청 — the tracker's global status (its rows are not month-scoped in the contract).
    let appeals = { open: 0, overdue: 0, submitted: 0, resolved: 0, recovered: 0, appealed: 0 };
    try { appeals = { ...appeals, ...(appealStats() || {}) }; } catch {}
    // 미수금 = this month's (청구 − 인정) minus what is already under appeal. Confidence: low — `appealed` is global.
    const outstanding = Math.max(0, cut - (+appeals.appealed || 0));
    // 지불보증 — the tracker's feed: `state` "expiring" (active, ends ≤ 7 days) → soon · "expired" (past its end, no decision) → over.
    const guar = { soon: 0, over: 0 };
    try { for (const g of guaranteeDeadlines() || []) { if (g.state === "expired") guar.over++; else guar.soon++; } } catch {}
    // 비급여 매출 추정 — consent rows of the month × price (snapshotted on the row, Tariff as fallback). null → no consent stored yet.
    const consents = Store.get("consent.list", null);
    let nonpay = null;
    if (Array.isArray(consents)) {
      nonpay = { amount: 0, n: 0, items: 0 };
      for (const c of consents) {
        if (!c) continue;
        const when = c.at ?? c.date;
        const m = typeof when === "string" ? when.slice(0, 7) : typeof when === "number" ? monthKeyOf(when) : "";
        if (m !== month) continue;
        nonpay.n++;
        for (const it of c.items || []) { const q = +it.qty || 1; const p = it.price != null ? +it.price : tariffPrice(it.code); nonpay.amount += q * (p || 0); nonpay.items += q; }
      }
    }
    const hasData = entries.length > 0 || all.length > 0;
    return { month, months: monthsWithData(), hasData, n: entries.length, claimed, cut, byPayer, reasons, insurers, appeals, outstanding, guar, nonpay };
  }
  const fillMonthSelect = (k) => {
    const sel = $("#kpi-month"); if (!sel) return;
    const opts = [...new Set([k.month, ...k.months])].sort().reverse();
    sel.innerHTML = opts.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
    sel.value = k.month;
    sel.disabled = opts.length <= 1;
  };
  const setCard = (id, cls) => { const c = $(id); if (!c) return; c.classList.remove("warn", "err"); if (cls) c.classList.add(cls); };
  function renderKpis() {
    const tiles = $$("#today-insights .insight.kpi");
    const k = kpiData();
    const empty = $("#kpi-empty");
    tiles.forEach(el => el.classList.remove("kpi-loading"));
    fillMonthSelect(k);
    const sub = (id, text) => { const el = $(id); if (el) el.textContent = text; };
    const num = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
    if (!k.hasData) {
      num("#ins-jabo", t("today.insJaboEmpty")); sub("#ins-jabo-sub", t("today.insJaboSub"));
      num("#ins-nhis", t("today.insJaboEmpty")); sub("#ins-nhis-sub", t("today.kpi.nhisNone"));
      num("#ins-cut", "— <em>%</em>"); sub("#ins-cut-sub", t("today.insCutSub"));
      num("#ins-reason", "—"); sub("#ins-reason-sub", t("today.kpi.reasonSub"));
      num("#ins-insurer", "—"); sub("#ins-insurer-sub", t("today.kpi.insurerSub"));
      num("#ins-ar", "—"); sub("#ins-ar-sub", t("today.kpi.arSub"));
      ["#ins-cut-card", "#ins-reason-card", "#ins-insurer-card", "#ins-ar-card", "#ins-nhis-card"].forEach(s => setCard(s, null));
      if (empty) { empty.style.display = ""; empty.textContent = t("today.kpi.empty"); }
    } else {
      if (empty) empty.style.display = "none";
      const a = k.byPayer.auto, n = k.byPayer.nhis;
      num("#ins-jabo", t("today.insCount", { n: a.n }));
      sub("#ins-jabo-sub", t("today.kpi.claimVsApproved", { c: won(a.claimed), a: won(a.approved), m: k.month }));
      if (n.n) { num("#ins-nhis", t("today.insCount", { n: n.n })); sub("#ins-nhis-sub", t("today.kpi.claimVsApproved", { c: won(n.claimed), a: won(n.approved), m: k.month })); setCard("#ins-nhis-card", n.rate > 15 ? "err" : n.rate > 8 ? "warn" : null); }
      else { num("#ins-nhis", t("today.insJaboEmpty")); sub("#ins-nhis-sub", t("today.kpi.nhisNone")); setCard("#ins-nhis-card", null); }
      num("#ins-cut", `${a.rate} <em>%</em>`);
      sub("#ins-cut-sub", t("today.insCutAmt", { amt: won(a.cut) }) + (n.n ? ` · ${t("today.kpi.nhisRate", { r: n.rate })}` : ""));
      setCard("#ins-cut-card", a.rate > 15 ? "err" : a.rate > 8 ? "warn" : null);
      if (k.reasons.length) {
        const [key, g] = k.reasons[0];
        num("#ins-reason", esc(reasonLabel(key)));
        sub("#ins-reason-sub", (g.cut ? t("today.kpi.reasonCut", { amt: won(g.cut), n: g.lines }) : t("today.kpi.reasonLines", { n: g.lines })) + ` · ${[...g.payers].map(payerLabel).join("/")}`);
        setCard("#ins-reason-card", "warn");
      } else { num("#ins-reason", "—"); sub("#ins-reason-sub", t("today.kpi.reasonNone")); setCard("#ins-reason-card", null); }
      if (k.insurers.length) {
        const [ins, g] = k.insurers[0];
        num("#ins-insurer", esc(insurerLabel(ins)));
        sub("#ins-insurer-sub", t("today.kpi.insurerTop", { amt: won(g.cut), k: k.insurers.length }));
        setCard("#ins-insurer-card", g.claimed && g.cut / g.claimed > 0.15 ? "err" : g.cut > 0 ? "warn" : null);
      } else { num("#ins-insurer", "—"); sub("#ins-insurer-sub", t("today.kpi.insurerNone")); setCard("#ins-insurer-card", null); }
      num("#ins-ar", esc(won(k.outstanding)));
      sub("#ins-ar-sub", t("today.kpi.arDetail", { cut: won(k.cut), ap: won(k.appeals.appealed || 0) }));
      setCard("#ins-ar-card", k.outstanding > 0 ? "warn" : null);
    }
    // Tiles independent of the reconciliation data
    const ap = k.appeals;
    num("#ins-appeal", t("today.insCount", { n: ap.open + ap.submitted }));
    sub("#ins-appeal-sub", t("today.kpi.appealDetail", { o: ap.overdue, r: won(ap.recovered) }));
    setCard("#ins-appeal-card", ap.overdue > 0 ? "err" : ap.open + ap.submitted > 0 ? "warn" : null);
    num("#ins-guar", t("today.insCount", { n: k.guar.soon }));
    sub("#ins-guar-sub", k.guar.over ? t("today.kpi.guarOver", { n: k.guar.over }) : t("today.kpi.guarSub"));
    setCard("#ins-guar-card", k.guar.over > 0 ? "err" : k.guar.soon > 0 ? "warn" : null);
    if (k.nonpay) { num("#ins-nonpay", esc(won(k.nonpay.amount))); sub("#ins-nonpay-sub", t("today.kpi.nonpayDetail", { n: k.nonpay.n, i: k.nonpay.items, m: k.month })); }
    else { num("#ins-nonpay", "—"); sub("#ins-nonpay-sub", t("today.kpi.nonpayNone")); }
    tiles.forEach(el => { el.classList.remove("kpi-in"); void el.offsetWidth; el.classList.add("kpi-in"); });
  }
  $("#kpi-month")?.addEventListener("change", (e) => { kpiMonth = e.target.value || null; renderKpis(); });

  // 원장 보고용 요약 — plain text, institution + numbers only (no person names), PoC line last.
  function summaryText() {
    const k = kpiData();
    const o = Org.get();
    const a = k.byPayer.auto, n = k.byPayer.nhis;
    const L = [];
    L.push(t("today.sum.title", { org: o.name || t("reporting.org.missing"), m: k.month }));
    L.push(t("today.sum.auto", { n: a.n, c: won(a.claimed), a: won(a.approved), cut: won(a.cut), r: a.rate }));
    L.push(n.n ? t("today.sum.nhis", { n: n.n, c: won(n.claimed), a: won(n.approved), cut: won(n.cut), r: n.rate }) : t("today.sum.nhisNone"));
    L.push(k.reasons.length ? t("today.sum.reason", { list: k.reasons.slice(0, 3).map(([key, g]) => `${reasonLabel(key)} ${won(g.cut)}`).join(" · ") }) : t("today.sum.reasonNone"));
    L.push(k.insurers.length ? t("today.sum.insurers", { list: k.insurers.map(([ins, g]) => `${insurerLabel(ins)} ${won(g.cut)}`).join(" · ") }) : t("today.sum.insurersNone"));
    L.push(t("today.sum.appeals", { o: k.appeals.open, s: k.appeals.submitted, d: k.appeals.overdue, r: won(k.appeals.recovered) }));
    L.push(t("today.sum.ar", { amt: won(k.outstanding) }));
    L.push(k.nonpay ? t("today.sum.nonpay", { amt: won(k.nonpay.amount), n: k.nonpay.n }) : t("today.sum.nonpayNone"));
    L.push(t("today.sum.guar", { n: k.guar.soon, o: k.guar.over }));
    const ret = Store.get("retention.lastAudit");
    const rs = retentionStats();
    L.push(ret ? t("today.sum.retention", { o: ret.over, d: rs.disposals }) : t("today.sum.retentionNone"));
    L.push("");
    L.push(t("today.sum.foot", { date: todayISO(), poc: pocMark() }));
    return L.join("\n");
  }
  $("#kpi-summary-copy")?.addEventListener("click", async () => {
    const text = summaryText();
    const out = $("#kpi-summary-out");
    if (out) { out.textContent = text; out.hidden = false; }
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch {}
    if (!copied) { try { const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); copied = document.execCommand("copy"); ta.remove(); } catch {} }
    Toast.show({ tag: "system", html: esc(copied ? t("common.copied") : t("today.sum.copyFallback")) });
    ActivityLog.push("system", t("today.sum.log", { m: currentMonth() }), {});
  });

  function renderResume() {
    const cards = [];
    const jabo = Store.get("jabo.draft.items");
    if (Array.isArray(jabo) && jabo.length) {
      const pid = Store.get("jabo.draft.jabo-pid");
      const who = pid ? redactSubject({ pid }) : t("today.resume.noPatient");
      cards.push({ tab: "tab-jabo", label: t("nav.jabo"), who: who + ` · ${t("today.resume.nProcs", { n: jabo.length })}`, when: "" });
    }
    const tariffCount = Object.keys(Tariff.all()).length;
    if (tariffCount > 0 && tariffCount < (DATA?.bigeup?.items?.length || Infinity)) {
      cards.push({ tab: "tab-bigeup", label: t("nav.bigeup"), who: t("today.resume.tariff", { n: tariffCount }), when: "" });
    }
    const lastKcd = Store.get("kcd.lastSummary");
    if (lastKcd && (lastKcd.missing > 0 || lastKcd.review > 0)) {
      cards.push({ tab: "tab-kcd", label: t("today.resume.kcd"), who: t("today.resume.kcdLeft", { m: lastKcd.missing, r: lastKcd.review }), when: relTime(lastKcd.at) });
    }
    const lastRet = Store.get("retention.lastAudit");
    if (lastRet && (lastRet.over > 0 || lastRet.bad > 0)) {
      cards.push({ tab: "tab-retention", label: t("nav.retention"), who: t("today.resume.retLeft", { o: lastRet.over, b: lastRet.bad }), when: relTime(lastRet.at) });
    }
    const ye = Batches.latest("yearend");
    if (ye && (ye.meta?.errors || 0) > 0) {
      cards.push({ tab: "tab-yearend", label: t("nav.yearend"), who: t("today.resume.yeLeft", { e: ye.meta.errors, y: ye.meta.taxYear || "" }), when: relTime(ye.createdAt) });
    }
    if (!cards.length) {
      $("#resume-list").innerHTML = `<div class="resume"><span class="resume-empty">${esc(t("today.resumeEmpty"))}</span></div>`;
      return;
    }
    $("#resume-list").innerHTML = cards.map(c => `
      <div class="resume" data-tab="${esc(c.tab)}">
        <span><span class="label">${esc(c.label)}</span></span>
        <span class="who">${esc(c.who)}</span>
        <span class="when">${esc(c.when || "→")}</span>
      </div>`).join("");
    $$("#resume-list .resume").forEach(el => {
      el.addEventListener("click", () => activateTab(el.dataset.tab));
    });
  }

  function renderActivity() {
    const items = ActivityLog.recent(15);
    if (!items.length) {
      $("#act-feed").innerHTML = `<div class="act-empty">${esc(t("today.activityEmpty"))}</div>`;
      return;
    }
    // entry.subject is already pseudonymised by ActivityLog (store.js) — never a raw name.
    const feedText = (it) => esc(it.action || it.text || "") + (it.subject ? ` <span class="act-subject">${esc(it.subject)}</span>` : "");
    $("#act-feed").innerHTML = items.map(it => `
      <div class="act-row">
        <span class="act-when">${relTime(it.at)}</span>
        <span class="act-text">${feedText(it)}</span>
        <span class="act-tag">${esc(tagLabel(it.tag))}</span>
      </div>`).join("");
  }

  function renderInsights() {
    // Retention — 초과 rows of the last audit; the sub line adds the 파기 대장 count once disposals exist.
    const retCard = $("#ins-ret-card"); retCard.classList.remove("warn", "err");
    const lastRet = Store.get("retention.lastAudit");
    const rs = retentionStats();
    if (lastRet) {
      $("#ins-ret").textContent = lastRet.over;
      $("#ins-ret-sub").textContent = t("today.insRetSub2", { t: relTime(lastRet.at), n: lastRet.soon }) + (rs.disposals ? ` · ${t("today.insRetDisposed", { n: rs.disposals })}` : "");
      if (lastRet.over > 0) retCard.classList.add("err");
      else if (lastRet.soon > 0) retCard.classList.add("warn");
    } else { $("#ins-ret").textContent = "—"; $("#ins-ret-sub").textContent = t("today.insRetSub"); }

    // Accreditation progress — manual checks + derived (자동 판정) items that pass
    const prog = accredProgress();
    const accCard = $("#ins-accred-card"); accCard.classList.remove("warn", "err");
    if (prog.total) {
      const pct = Math.round((prog.done / prog.total) * 100);
      $("#ins-accred").innerHTML = `${pct} <em>%</em>`;
      const sub = $("#ins-accred-sub");
      if (prog.failing.length) { sub.textContent = t("today.insAccredAuto", { n: prog.failing.length }); accCard.dataset.itemId = prog.failing[0].id; }
      else { sub.textContent = t("today.insAccredSub"); delete accCard.dataset.itemId; }
      if (pct < 50) accCard.classList.add("warn");
      if (pct < 25) accCard.classList.add("err");
    }
  }
  $("#ins-accred-card")?.addEventListener("click", () => {
    const id = $("#ins-accred-card").dataset.itemId;
    activateTab("tab-accred", id ? { itemId: id } : undefined);
  });
  $("#ins-ret-card")?.addEventListener("click", () => activateTab("tab-retention"));

  function renderAll() {
    const date = new Date();
    const wk = date.toLocaleDateString(getLang() === "en" ? "en-GB" : "ko-KR", { weekday: "short" });
    $("#today-date").textContent = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")} (${wk})`;
    renderTodo();
    renderDeadlines();
    renderKpis();
    renderResume();
    renderActivity();
    renderInsights();
  }
  renderAll();

  // .ics export — clever no-backend trick: render an iCalendar
  // file from the deadlines so it can be imported into any
  // calendar app (Google, Apple, Outlook, Naver) directly.
  $("#dday-ics").addEventListener("click", () => {
    const list = loadDeadlines();
    const pad = n => String(n).padStart(2, "0");
    const fmt = d => {
      const dt = new Date(d + "T09:00:00");
      return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T090000`;
    };
    const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/[,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
    // PoC watermark: a calendar-level notice line + every DESCRIPTION opens with the mark (UI language).
    const mark = pocMark();
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//Vibe Studio//Clinic Admin//${getLang().toUpperCase()}`,
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-POC-NOTICE:${icsText(mark)}`
    ];
    // Every deadline in the window — not just the ones expanded on screen (appeals + guarantee expiries included).
    for (const d of list) {
      ics.push(
        "BEGIN:VEVENT",
        `UID:${d.key}-${d.date}@vibe-clinic-admin`,
        `DTSTAMP:${fmt(todayISO())}Z`,
        `DTSTART:${fmt(d.date)}`,
        `DTEND:${fmt(d.date).slice(0,11)}5959`,
        `SUMMARY:${icsText(d.title)}`,
        `DESCRIPTION:${icsText(mark + " · " + d.source)}`,
        "BEGIN:VALARM", "TRIGGER:-P14D", "ACTION:DISPLAY", `DESCRIPTION:${icsText(d.title)}`, "END:VALARM",
        "END:VEVENT"
      );
    }
    ics.push("END:VCALENDAR");
    downloadText(ics.join("\r\n"), `clinic_admin_deadlines_${todayISO()}.ics`, "text/calendar;charset=utf-8"); // filename → _PoC
    ActivityLog.push("system", t("today.icsLog"), {});
  });

  // Share dashboard summary — text snapshot of upcoming deadlines
  $("#dday-share")?.addEventListener("click", async () => {
    const list = loadDeadlines();
    const lines = list.map(d => {
      const ds = daysUntil(d.date);
      const tag = ds < 0 ? `D+${-ds}` : `D-${ds}`;
      return `• ${tag} · ${d.date} · ${d.title}`;
    });
    const text = t("today.shareText", { lines: lines.join("\n"), date: todayISO() });
    await Share.send({ title: t("today.shareTitle"), text });
    ActivityLog.push("system", t("today.shareLog"), {});
  });

  // Live re-render when any tab updates state (debounced — a prefill writes 28 tariff rows in one burst)
  const renderSoon = debounce(renderAll, 60);
  ["activity", "jabo.history", "nhis.history", "retention.lastAudit", "retention.disposals", "kcd.lastSummary", "accred.checked", "jabo.draft.items",
   "appeals.list", "guarantee.list", "consent.list", "docs.list", "ui.claimsBatch", "ui.claimsBatch.auto", "ui.claimsBatch.nhis", "jabo.draft.jabo-pid"]
    .forEach(k => EventBus.on(`store:${k}`, renderSoon));
  for (const E of [Org, Staff, Batches, Tariff]) E.onChange(renderSoon);
  onClaimsChange(renderSoon);
  EventBus.on("session:unlocked", renderSoon);
  EventBus.on("tab:activated", (p) => {
    if (p?.id !== "tab-today") return;
    renderAll();
    if (p.ctx?.openOrg) openOrg();
  });
  onLangChange(renderAll);

  // Refresh relative times every 30s
  setInterval(renderAll, 30000);

  // seed(): 홈 derives everything from the other tabs' state — it only resets the KPI month to "latest with data"
  // (the seeded reconciliation is 2026-08) and hides the summary preview so the tour lands on fresh tiles.
  api = { seed: () => { kpiMonth = null; todoExpanded = false; const out = $("#kpi-summary-out"); if (out) out.hidden = true; renderAll(); } };
}
