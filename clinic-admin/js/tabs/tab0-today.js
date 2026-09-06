/* clinic-admin — Tab 00 · 오늘 dashboard */
import { $, $$, esc, won, todayISO, relTime, daysUntil, Share, redactSubject, redactStaff, tagLabel } from "../core/ui.js";
import { t, getLang, onLangChange } from "../core/i18n.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { activateTab } from "../core/nav.js";
import { downloadText, pocMark } from "../core/files.js";
import { statutoryDeadlines } from "../core/calendar.js";
import { ACCRED_ITEMS } from "./tab9-accred.js";
import { hasDuty } from "./tab8-license.js";

/* ─────────────────────────────────────────────────────────
   Tab 0 — 오늘 / Today dashboard
   Backend-free orchestrator: it reads localStorage from
   every other tab and computes deadlines + resume cards
   + insights live, and re-renders on any store change.
   ───────────────────────────────────────────────────────── */
export function initTab0(ctx) {
  const { DATA } = ctx;
  // Compliance deadlines — Korean Traditional Hospital admin calendar.
  // Recurring statutory dates are computed as the NEXT occurrence (today inclusive), so
  // e.g. the January 연말정산 deadline is visible during January instead of a year away.
  // Per-person 면허신고 deadlines come from the license tracker (의료법 §25 · 3-year cycle).
  const NOW = new Date();
  const Y = NOW.getFullYear();

  // All deadlines in the window (recurring: next 12 months; per-person: −30 … +365 days).
  function loadDeadlines() {
    const list = statutoryDeadlines(NOW);
    const licenses = Store.get("license.list", []);
    for (const lic of licenses) {
      const who = redactStaff(lic);
      // 원무·기타 carry no 신고 duty — never a D-day, even for legacy records with an expiry.
      if (lic.expiry && hasDuty(lic.role)) {
        const d = daysUntil(lic.expiry);
        if (d != null && d <= 365 && d >= -30) {
          list.push({
            key: `lic-${lic.id}-exp`, title: t(lic.basis === "acquired" ? "today.dl.licReportUnverified" : "today.dl.licReport", { who }),
            date: lic.expiry, link: "tab-license",
            source: t(lic.basis === "acquired" ? "today.dl.licSourceAcquired" : "today.dl.licSourceReported")
          });
        }
      }
      if (lic.cme) {
        const d = daysUntil(lic.cme);
        if (d != null && d <= 365 && d >= -30) {
          list.push({
            key: `lic-${lic.id}-cme`, title: t("today.dl.cme", { who }),
            date: lic.cme, link: "tab-license", source: t("today.dl.cmeSource")
          });
        }
      }
    }
    // Sort: smallest |days| first, but past-due last
    list.forEach(d => d.daysLeft = daysUntil(d.date));
    list.sort((a, b) => {
      if (a.daysLeft < 0 && b.daysLeft >= 0) return 1;
      if (b.daysLeft < 0 && a.daysLeft >= 0) return -1;
      return Math.abs(a.daysLeft) - Math.abs(b.daysLeft);
    });
    return list;
  }

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
        <div class="dday ${cls}" data-link="${esc(d.link)}">
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
      el.addEventListener("click", () => activateTab(el.dataset.link));
    });
    $("#dday-more")?.addEventListener("click", () => { showLater = !showLater; renderDeadlines(); });
  }

  function renderResume() {
    const cards = [];
    const jabo = Store.get("jabo.draft.items");
    if (Array.isArray(jabo) && jabo.length) {
      const name = Store.get("jabo.draft.jabo-name"), pid = Store.get("jabo.draft.jabo-pid");
      const who = (name || pid) ? redactSubject({ name, pid }) : t("today.resume.noPatient");
      cards.push({ tab: "tab-jabo", label: t("nav.jabo"), who: who + ` · ${t("today.resume.nProcs", { n: jabo.length })}`, when: "" });
    }
    const tariff = Store.get("bigeup.tariff", {});
    const tariffCount = Object.keys(tariff).length;
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
    // Jabo insights: this quarter's reconciliation
    const history = Store.get("jabo.history", []);
    const qStart = new Date(Y, Math.floor(NOW.getMonth()/3)*3, 1).getTime();
    const thisQ = history.filter(h => h.at >= qStart);
    if (thisQ.length) {
      $("#ins-jabo").innerHTML = t("today.insCount", { n: thisQ.length });
      const totalClaim = thisQ.reduce((s,h) => s + (h.claimed||0), 0);
      const totalCut = thisQ.reduce((s,h) => s + (h.cut||0), 0);
      const cutPct = totalClaim ? Math.round((totalCut / totalClaim) * 1000) / 10 : 0;
      $("#ins-jabo-sub").textContent = t("today.insClaimed", { amt: won(totalClaim) });
      $("#ins-cut").innerHTML = `${cutPct} <em>%</em>`;
      $("#ins-cut-sub").textContent = t("today.insCutAmt", { amt: won(totalCut) });
      if (cutPct > 15) $("#ins-cut-card").classList.add("err");
      else if (cutPct > 8) $("#ins-cut-card").classList.add("warn");
    }

    // Retention insights
    const lastRet = Store.get("retention.lastAudit");
    if (lastRet) {
      $("#ins-ret").textContent = lastRet.over;
      $("#ins-ret-sub").textContent = t("today.insRetSub2", { t: relTime(lastRet.at), n: lastRet.soon });
      if (lastRet.over > 0) $("#ins-ret-card").classList.add("err");
      else if (lastRet.soon > 0) $("#ins-ret-card").classList.add("warn");
    }

    // Accreditation progress
    const accred = Store.get("accred.checked", {});
    const all = ACCRED_ITEMS.map(c => c.items).flat();
    if (all.length) {
      const done = all.filter(it => accred[it.id]).length;
      const pct = Math.round((done / all.length) * 100);
      $("#ins-accred").innerHTML = `${pct} <em>%</em>`;
      if (pct < 50) $("#ins-accred-card").classList.add("warn");
      if (pct < 25) $("#ins-accred-card").classList.add("err");
    }
  }

  function renderAll() {
    const date = new Date();
    const wk = date.toLocaleDateString(getLang() === "en" ? "en-GB" : "ko-KR", { weekday: "short" });
    $("#today-date").textContent = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")} (${wk})`;
    renderDeadlines();
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

  // Live re-render when any tab updates state
  ["activity", "jabo.history", "retention.lastAudit", "kcd.lastSummary",
   "license.list", "accred.checked", "bigeup.tariff", "jabo.draft.items"
  ].forEach(k => EventBus.on(`store:${k}`, renderAll));
  EventBus.on("tab:activated", (id) => { if (id === "tab-today") renderAll(); });
  onLangChange(renderAll);

  // Refresh relative times every 30s
  setInterval(renderAll, 30000);
}
