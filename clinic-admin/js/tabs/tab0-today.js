/* clinic-admin — Tab 00 · 오늘 dashboard */
import { $, $$, esc, won, todayISO, relTime, daysUntil, debounce, Share, redactSubject, tagLabel } from "../core/ui.js";
import { t, pick, getLang, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { downloadText, pocMark } from "../core/files.js";
import { allDeadlines } from "../core/calendar.js";
import { activateTab } from "../core/nav.js";
import { Org, Staff, Batches, Tariff, Insurers } from "../core/entities.js";
import { accredProgress } from "./tab9-accred.js";
import { claimsSteps } from "./claims-landing.js";
import { onClaimsChange } from "./claims-shared.js";

/* ─────────────────────────────────────────────────────────
   홈 › 오늘 — task-first home
   Backend-free orchestrator: it reads the Store / entities every other tool writes and computes the todo list,
   deadlines, KPIs and resume cards live, re-rendering on any store change.
   · 지금 할 일 (#todo-list .todo[data-key][data-ctx]): deadlines within 30 days (allDeadlines), the current claim
     batch's open step (claims-landing.claimsSteps), an unfinished 자보 수기 case — one deep-linking button per row.
     The setup nudges (#today-nudges: 기관 정보 · 직원 명부) sit in the same section.
   · Deadlines come from core/calendar.js allDeadlines() (statutory + per-person from the Staff roster — the same
     list the topbar chip uses); rows carry a ctx ({ refMonth } · { taxYear } · { staffId }) and open the target
     tab with it. Per-person items are windowed to −30 … +365 days here.
   · Nudges: 기관 정보 미완료 (Org.isComplete() false) and 직원 명부 비어 있음 (Staff.list() empty).
   · { openOrg: true } on tab:activated → EventBus "shell:openInfo" { section: "org" } — the shell routes it to
     조직 › 기관 프로필; this tab only asks for it.
   · KPI tiles (first cut): this month's 청구 vs 인정 · 조정률 · top 조정사유 · 보험사별 조정 from jabo.history
     reconciliation entries + Batches.list("review"). Skeleton shimmer until the first render.
   ───────────────────────────────────────────────────────── */
export function seed() { /* 00 derives everything from the other tabs' state — nothing to seed */ }

export function init(ctx) {
  const { DATA } = ctx;
  const NOW = new Date();
  const Y = NOW.getFullYear();
  const REASONS = DATA?.jabo?.adjustment_reasons || [];
  const reasonLabel = (k) => { const r = REASONS.find(x => x.key === k); return r ? pick(r, "label") : String(k ?? ""); };
  const insurerLabel = (v) => { const i = Insurers.list().find(x => x.value === v); return i ? pick(i, "label") : String(v ?? ""); };
  const openOrg = () => EventBus.emitLocal("shell:openInfo", { section: "org" });

  // ── deadlines ── statutory (next 12 months, 의원급 drops the September window — core/calendar.js decides)
  // + per-person licence items windowed to −30 … +365 days; already sorted soonest first, past-due last.
  const loadDeadlines = () => allDeadlines(NOW).filter(d => !d.key.startsWith("lic-") || (d.daysLeft != null && d.daysLeft <= 365 && d.daysLeft >= -30));

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
        <div class="dday ${cls}" data-key="${esc(d.key)}" data-link="${esc(d.link)}"${d.ctx ? ` data-ctx='${esc(JSON.stringify(d.ctx))}'` : ""} role="button" tabindex="0">
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
    $("#dday-list").innerHTML = html || `<div class="empty-state">${esc(t("today.noDeadlines"))}</div>`;
    $$("#dday-list .dday").forEach(el => {
      const go = () => { let c; try { c = el.dataset.ctx ? JSON.parse(el.dataset.ctx) : undefined; } catch {} activateTab(el.dataset.link, c); };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    $("#dday-more")?.addEventListener("click", () => { showLater = !showLater; renderDeadlines(); });
  }

  // ── 지금 할 일 ──
  const ddayLabel = (days) => days == null ? "—" : days < 0 ? t("today.overdue", { n: -days }) : days === 0 ? t("today.todayLabel") : t("today.daysLeft", { n: days });
  const ddayCls = (days) => days == null ? "" : days < 0 ? "over" : days <= 7 ? "urgent" : "warn";
  function todoItems() {
    const items = [];
    // Anything due within 30 days — and anything overdue in the past year: an expired 면허신고 is still a to-do.
    for (const d of allDeadlines(NOW)) {
      if (d.daysLeft == null || d.daysLeft > 30 || d.daysLeft < -365) continue;
      items.push({ key: `dl:${d.key}`, cls: ddayCls(d.daysLeft), when: ddayLabel(d.daysLeft), title: d.title, meta: `${d.date} · ${d.source}`, link: d.link, ctx: d.ctx || null, btn: t("home.todo.open"), order: d.daysLeft < 0 ? -1000 + d.daysLeft : d.daysLeft });
    }
    for (const s of claimsSteps()) {
      if (s.state !== "todo" && s.state !== "need") continue;
      items.push({ key: `batch:${s.key}`, cls: "step", when: t("home.todo.step"), title: s.title, meta: s.detail, link: s.link, ctx: s.ctx, btn: s.btn, order: 100 });
    }
    const draft = Store.get("jabo.draft.items");
    if (Array.isArray(draft) && draft.length) {
      const pid = Store.get("jabo.draft.jabo-pid");
      items.push({ key: "jabo-manual", cls: "step", when: t("home.todo.resume"), title: t("home.todo.manualCase", { who: pid ? redactSubject({ pid }) : t("today.resume.noPatient") }), meta: t("today.resume.nProcs", { n: draft.length }), link: "tab-jabo", ctx: { focus: "manual" }, btn: t("home.todo.resumeBtn"), order: 200 });
    }
    return items.sort((a, b) => a.order - b.order);
  }
  function renderTodo() {
    const el = $("#todo-list"); if (!el) return;
    const items = todoItems();
    const count = $("#todo-count");
    if (count) { count.hidden = !items.length; count.textContent = items.length ? t("home.todo.count", { n: items.length }) : ""; }
    if (!items.length) { el.innerHTML = `<div class="todo-empty">${esc(t("home.todo.empty"))}</div>`; return; }
    el.innerHTML = items.map(it => `
      <div class="todo ${it.cls}" role="listitem" data-key="${esc(it.key)}" data-link="${esc(it.link || "")}" data-ctx='${esc(JSON.stringify(it.ctx || {}))}'>
        <span class="todo-when">${it.when}</span>
        <div class="todo-body"><div class="todo-title">${esc(it.title)}</div><div class="todo-meta">${esc(it.meta)}</div></div>
        <button type="button" class="btn secondary sm" data-todo-go>${esc(it.btn)} <span class="arrow">→</span></button>
      </div>`).join("");
    $$("#todo-list .todo").forEach(row => {
      const go = () => { let c; try { c = JSON.parse(row.dataset.ctx || "{}"); } catch { c = {}; } if (row.dataset.link) activateTab(row.dataset.link, Object.keys(c).length ? c : undefined); };
      row.querySelector("[data-todo-go]").addEventListener("click", (e) => { e.stopPropagation(); go(); });
      row.addEventListener("click", go);
    });
  }

  // ── nudges (기관 정보 · 직원 명부) ──
  function renderNudges() {
    const el = $("#today-nudges"); if (!el) return;
    const items = [];
    if (!Org.isComplete()) items.push({ id: "org", text: t("today.nudge.org"), btn: t("today.nudge.orgBtn"), run: openOrg });
    if (!Staff.list().length) items.push({ id: "staff", text: t("today.nudge.staff"), btn: t("today.nudge.staffBtn"), run: () => activateTab("tab-license") });
    el.innerHTML = items.map(n => `<div class="nudge" data-nudge="${n.id}"><span class="nudge-dot"></span><span class="nudge-text">${esc(n.text)}</span><button type="button" class="btn secondary" data-nudge-go="${n.id}">${esc(n.btn)}</button></div>`).join("");
    el.style.display = items.length ? "" : "none";
    for (const n of items) el.querySelector(`[data-nudge-go="${n.id}"]`)?.addEventListener("click", n.run);
  }

  // ── KPI tiles ──
  const monthKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  function kpiData() {
    const history = (Store.get("jabo.history", []) || []).filter(h => h && typeof h.at === "number" && (h.claimed != null));
    const reviews = Batches.list("review") || [];
    if (!history.length && !reviews.length) return null;
    const thisM = monthKey(Date.now());
    let month = thisM;
    let entries = history.filter(h => monthKey(h.at) === thisM);
    if (!entries.length && history.length) { month = monthKey(history[0].at); entries = history.filter(h => monthKey(h.at) === month); }
    const claimed = entries.reduce((s, h) => s + (+h.claimed || 0), 0);
    const cut = entries.reduce((s, h) => s + (+h.cut || 0), 0);
    const approved = entries.reduce((s, h) => s + (h.paid != null ? +h.paid : h.approved != null ? +h.approved : (+h.claimed || 0) - (+h.cut || 0)), 0);
    const rate = claimed ? Math.round((cut / claimed) * 1000) / 10 : 0;
    // top 조정사유 — recon entries may carry byReason [{ reason|key, cut, lines }]; else count review-batch rows with a reason.
    const byReason = new Map();
    for (const h of entries) for (const g of h.byReason || []) {
      const k = g.key || g.reason || ""; if (!k) continue;
      const cur = byReason.get(k) || { cut: 0, lines: 0 }; cur.cut += +g.cut || 0; cur.lines += +g.lines || 0; byReason.set(k, cur);
    }
    if (!byReason.size) {
      for (const b of reviews.filter(b => monthKey(b.createdAt) === month || month === thisM)) for (const r of b.rows || []) {
        const k = r.reasonKey || r.reason || r.reasonText || ""; if (!k) continue;
        const cur = byReason.get(k) || { cut: 0, lines: 0 }; cur.lines++; cur.cut += Math.max(0, (+r.claimed || 0) - (+r.approved || 0)); byReason.set(k, cur);
      }
    }
    const topReason = [...byReason.entries()].sort((a, b) => (b[1].cut - a[1].cut) || (b[1].lines - a[1].lines))[0] || null;
    // 보험사별 — entries carrying `insurer` (F2 stores it on recon history).
    const byIns = new Map();
    for (const h of entries) { if (!h.insurer) continue; const cur = byIns.get(h.insurer) || { cut: 0, claimed: 0, n: 0 }; cur.cut += +h.cut || 0; cur.claimed += +h.claimed || 0; cur.n++; byIns.set(h.insurer, cur); }
    const insurers = [...byIns.entries()].sort((a, b) => b[1].cut - a[1].cut);
    return { month, n: entries.length, claimed, approved, cut, rate, topReason, insurers, reviews: reviews.length };
  }
  function renderKpis() {
    const tiles = $$("#today-insights .insight.kpi");
    const k = kpiData();
    const empty = $("#kpi-empty");
    tiles.forEach(el => el.classList.remove("kpi-loading"));
    if (!k) {
      $("#ins-jabo").innerHTML = t("today.insJaboEmpty");
      $("#ins-jabo-sub").textContent = t("today.insJaboSub");
      $("#ins-cut").innerHTML = "— <em>%</em>"; $("#ins-cut-sub").textContent = t("today.insCutSub");
      $("#ins-reason").textContent = "—"; $("#ins-reason-sub").textContent = t("today.kpi.reasonSub");
      $("#ins-insurer").textContent = "—"; $("#ins-insurer-sub").textContent = t("today.kpi.insurerSub");
      ["#ins-cut-card", "#ins-reason-card", "#ins-insurer-card"].forEach(s => $(s)?.classList.remove("warn", "err"));
      if (empty) { empty.style.display = ""; empty.textContent = t("today.kpi.empty"); }
      return;
    }
    if (empty) empty.style.display = "none";
    $("#ins-jabo").innerHTML = t("today.insCount", { n: k.n });
    $("#ins-jabo-sub").textContent = t("today.kpi.claimVsApproved", { c: won(k.claimed), a: won(k.approved), m: k.month });
    $("#ins-cut").innerHTML = `${k.rate} <em>%</em>`;
    $("#ins-cut-sub").textContent = t("today.insCutAmt", { amt: won(k.cut) });
    const cutCard = $("#ins-cut-card"); cutCard.classList.remove("warn", "err");
    if (k.rate > 15) cutCard.classList.add("err"); else if (k.rate > 8) cutCard.classList.add("warn");
    const rEl = $("#ins-reason"), rSub = $("#ins-reason-sub"), rCard = $("#ins-reason-card");
    rCard.classList.remove("warn", "err");
    if (k.topReason) {
      const [key, g] = k.topReason;
      rEl.textContent = reasonLabel(key);
      rSub.textContent = g.cut ? t("today.kpi.reasonCut", { amt: won(g.cut), n: g.lines }) : t("today.kpi.reasonLines", { n: g.lines });
      rCard.classList.add("warn");
    } else { rEl.textContent = "—"; rSub.textContent = t("today.kpi.reasonNone"); }
    const iEl = $("#ins-insurer"), iSub = $("#ins-insurer-sub"), iCard = $("#ins-insurer-card");
    iCard.classList.remove("warn", "err");
    if (k.insurers.length) {
      const [ins, g] = k.insurers[0];
      iEl.textContent = insurerLabel(ins);
      iSub.textContent = t("today.kpi.insurerTop", { amt: won(g.cut), k: k.insurers.length });
      if (g.claimed && g.cut / g.claimed > 0.15) iCard.classList.add("err"); else if (g.cut > 0) iCard.classList.add("warn");
    } else { iEl.textContent = "—"; iSub.textContent = t("today.kpi.insurerNone"); }
    tiles.forEach(el => { el.classList.remove("kpi-in"); void el.offsetWidth; el.classList.add("kpi-in"); });
  }

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
      $("#resume-list").innerHTML = `<div class="resume"><span class="empty">${esc(t("today.resumeEmpty"))}</span></div>`;
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
    // Retention
    const retCard = $("#ins-ret-card"); retCard.classList.remove("warn", "err");
    const lastRet = Store.get("retention.lastAudit");
    if (lastRet) {
      $("#ins-ret").textContent = lastRet.over;
      $("#ins-ret-sub").textContent = t("today.insRetSub2", { t: relTime(lastRet.at), n: lastRet.soon });
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

  function renderAll() {
    const date = new Date();
    const wk = date.toLocaleDateString(getLang() === "en" ? "en-GB" : "ko-KR", { weekday: "short" });
    $("#today-date").textContent = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")} (${wk})`;
    renderNudges();
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
    // Every deadline in the window — not just the ones expanded on screen.
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
  ["activity", "jabo.history", "retention.lastAudit", "kcd.lastSummary", "accred.checked", "jabo.draft.items"]
    .forEach(k => EventBus.on(`store:${k}`, renderSoon));
  for (const E of [Org, Staff, Batches, Tariff]) E.onChange(renderSoon);
  onClaimsChange(renderSoon);
  EventBus.on("store:ui.claimsBatch", renderSoon);
  EventBus.on("store:jabo.draft.jabo-pid", renderSoon);
  EventBus.on("tab:activated", (p) => {
    if (p?.id !== "tab-today") return;
    renderAll();
    if (p.ctx?.openOrg) openOrg();
  });
  onLangChange(renderAll);

  // Refresh relative times every 30s
  setInterval(renderAll, 30000);
}
