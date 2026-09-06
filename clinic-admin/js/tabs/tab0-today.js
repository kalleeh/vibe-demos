/* clinic-admin — Tab 00 · 오늘 dashboard */
import { $, $$, esc, fmtKRW, todayISO, relTime, daysUntil, Share } from "../core/ui.js";
import { Store, EventBus, ActivityLog } from "../core/store.js";
import { activateTab } from "../core/nav.js";
import { ACCRED_ITEMS } from "./tab9-accred.js";
import { hasDuty } from "./tab8-license.js";
import { redactSubject, BIGEUP_WINDOWS, YEAREND_DEADLINE, nextOccurrence } from "./reporting-shared.js";

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
  const fixedDeadlines = () => [
    ...BIGEUP_WINDOWS.map(w => ({
      key: w.key, title: w.label, date: nextOccurrence(w.month, null, NOW),
      link: "tab-bigeup", source: `${w.refMonth}월 진료분 · 의료법 §45조의2 · 비급여 보고 고시`
    })),
    { key: YEAREND_DEADLINE.key, title: YEAREND_DEADLINE.label,
      date: nextOccurrence(YEAREND_DEADLINE.month, YEAREND_DEADLINE.day, NOW),
      link: "tab-yearend", source: "소득세법 시행령 §216조의3 · 홈택스" }
  ];

  // All deadlines in the window (recurring: next 12 months; per-person: −30 … +365 days).
  function loadDeadlines() {
    const list = fixedDeadlines();
    const licenses = Store.get("license.list", []);
    for (const lic of licenses) {
      const who = `${lic.role} ${redactSubject({ name: lic.name })}`;
      // 원무·기타 carry no 신고 duty — never a D-day, even for legacy records with an expiry.
      if (lic.expiry && hasDuty(lic.role)) {
        const d = daysUntil(lic.expiry);
        if (d != null && d <= 365 && d >= -30) {
          list.push({
            key: `lic-${lic.id}-exp`, title: `${who} — 면허신고 기한${lic.basis === "acquired" ? " (신고 이력 미확인)" : ""}`,
            date: lic.expiry, link: "tab-license",
            source: lic.basis === "acquired" ? "의료법 §25 (취득일 + 3년 · 협회 포털 확인)" : "의료법 §25 (신고일 + 3년)"
          });
        }
      }
      if (lic.cme) {
        const d = daysUntil(lic.cme);
        if (d != null && d <= 365 && d >= -30) {
          list.push({
            key: `lic-${lic.id}-cme`, title: `${who} — 보수교육 마감`,
            date: lic.cme, link: "tab-license", source: "보수교육 의무"
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
  const GROUP_LABEL = { over: "기한 초과", this: "이번 달", next: "다음 달", later: "이후" };
  let showLater = false;

  function renderDeadlines() {
    const list = loadDeadlines();
    const groups = { over: [], this: [], next: [], later: [] };
    for (const d of list) groups[groupOf(d)].push(d);
    const item = (d) => {
      const days = d.daysLeft;
      let cls = "", label = "";
      if (days == null) { cls = ""; label = "—"; }
      else if (days < 0) { cls = "over"; label = `<em>+${-days}일 초과</em>`; }
      else if (days === 0) { cls = "urgent"; label = "<em>오늘</em>"; }
      else if (days <= 14) { cls = "urgent"; label = `${days}<em>일</em>`; }
      else if (days <= 60) { cls = "warn"; label = `${days}<em>일</em>`; }
      else { cls = ""; label = `${days}<em>일</em>`; }
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
      html += `<div class="dday-group"><div class="dday-group-label">${GROUP_LABEL[g]} · ${groups[g].length}</div>${groups[g].map(item).join("")}</div>`;
    }
    if (groups.later.length) {
      html += `<div class="dday-group">
        <button type="button" class="dday-more" id="dday-more" aria-expanded="${showLater}">${showLater ? "접기" : "더 보기"} — ${GROUP_LABEL.later} ${groups.later.length}건 ${showLater ? "↑" : "↓"}</button>
        ${showLater ? groups.later.map(item).join("") : ""}
      </div>`;
    }
    $("#dday-list").innerHTML = html || `<div class="empty-state">다가오는 마감이 없습니다.</div>`;
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
      const who = (name || pid) ? redactSubject({ name, pid }) : "환자 미입력";
      cards.push({ tab: "tab-jabo", label: "자보 정산", who: who + ` · ${jabo.length}개 행위`, when: "" });
    }
    const tariff = Store.get("bigeup.tariff", {});
    const tariffCount = Object.keys(tariff).length;
    if (tariffCount > 0 && tariffCount < (DATA?.bigeup?.items?.length || Infinity)) {
      cards.push({ tab: "tab-bigeup", label: "비급여 반기보고", who: `${tariffCount}개 항목 단가 입력 중`, when: "" });
    }
    const lastKcd = Store.get("kcd.lastSummary");
    if (lastKcd && (lastKcd.missing > 0 || lastKcd.review > 0)) {
      cards.push({ tab: "tab-kcd", label: "KCD 정비", who: `미수록 ${lastKcd.missing}건 · 검토 ${lastKcd.review}건 남음`, when: relTime(lastKcd.at) });
    }
    const lastRet = Store.get("retention.lastAudit");
    if (lastRet && (lastRet.over > 0 || lastRet.bad > 0)) {
      cards.push({ tab: "tab-retention", label: "보존 감사", who: `만료 초과 ${lastRet.over}건 · 분류 오류 ${lastRet.bad}건`, when: relTime(lastRet.at) });
    }
    if (!cards.length) {
      $("#resume-list").innerHTML = `<div class="resume"><span class="empty">아직 진행 중인 작업이 없습니다.</span></div>`;
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

  const TAG_LABELS = {
    kcd: "KCD", jabo: "자보", yearend: "연말정산", bigeup: "비급여",
    retention: "보존", search: "검색", ai: "AI", license: "면허", accred: "인증", system: "시스템"
  };

  function renderActivity() {
    const items = ActivityLog.recent(15);
    if (!items.length) {
      $("#act-feed").innerHTML = `<div class="act-empty">최근 활동이 없습니다.</div>`;
      return;
    }
    // Entries carrying meta.subject get the redacted label appended; the legacy 자보 line
    // format ("자보 정산표 — <name> · …") is redacted in place so no raw name reaches the feed.
    const feedText = (it) => {
      let text = String(it.text ?? "");
      if (it.tag === "jabo") text = text.replace(/^(자보 정산표 — )(.+?)( · )/, (_, a, who, b) => a + redactSubject({ name: who }) + b);
      let out = esc(text);
      if (it.meta?.subject) out += ` <span class="act-subject">${esc(redactSubject(it.meta.subject))}</span>`;
      return out;
    };
    $("#act-feed").innerHTML = items.map(it => `
      <div class="act-row">
        <span class="act-when">${relTime(it.at)}</span>
        <span class="act-text">${feedText(it)}</span>
        <span class="act-tag">${esc(TAG_LABELS[it.tag] || it.tag)}</span>
      </div>`).join("");
  }

  function renderInsights() {
    // Jabo insights: this quarter's reconciliation
    const history = Store.get("jabo.history", []);
    const qStart = new Date(Y, Math.floor(NOW.getMonth()/3)*3, 1).getTime();
    const thisQ = history.filter(h => h.at >= qStart);
    if (thisQ.length) {
      $("#ins-jabo").innerHTML = `${thisQ.length} <em>건</em>`;
      const totalClaim = thisQ.reduce((s,h) => s + (h.claimed||0), 0);
      const totalCut = thisQ.reduce((s,h) => s + (h.cut||0), 0);
      const cutPct = totalClaim ? Math.round((totalCut / totalClaim) * 1000) / 10 : 0;
      $("#ins-jabo-sub").textContent = `청구 ${fmtKRW(totalClaim)}원`;
      $("#ins-cut").innerHTML = `${cutPct} <em>%</em>`;
      $("#ins-cut-sub").textContent = `삭감 ${fmtKRW(totalCut)}원`;
      if (cutPct > 15) $("#ins-cut-card").classList.add("err");
      else if (cutPct > 8) $("#ins-cut-card").classList.add("warn");
    }

    // Retention insights
    const lastRet = Store.get("retention.lastAudit");
    if (lastRet) {
      $("#ins-ret").textContent = lastRet.over;
      $("#ins-ret-sub").textContent = `${relTime(lastRet.at)} 기준 · 임박 ${lastRet.soon}`;
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
    const wk = ["일","월","화","수","목","금","토"][date.getDay()];
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
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vibe Studio//Clinic Admin//KO",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH"
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
        `DESCRIPTION:${icsText(d.source)}`,
        "BEGIN:VALARM", "TRIGGER:-P14D", "ACTION:DISPLAY", `DESCRIPTION:${icsText(d.title)}`, "END:VALARM",
        "END:VEVENT"
      );
    }
    ics.push("END:VCALENDAR");
    const blob = new Blob([ics.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clinic_admin_deadlines_${todayISO()}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ActivityLog.push("system", "마감 캘린더 .ics 내려받음", {});
  });

  // Share dashboard summary — text snapshot of upcoming deadlines
  $("#dday-share")?.addEventListener("click", async () => {
    const list = loadDeadlines();
    const lines = list.map(d => {
      const ds = daysUntil(d.date);
      const tag = ds < 0 ? `D+${-ds}` : `D-${ds}`;
      return `• ${tag} · ${d.date} · ${d.title}`;
    });
    const text = `[한방병원 행정] 다가오는 마감\n${lines.join("\n")}\n\n— ${todayISO()} 기준`;
    await Share.send({ title: "행정 마감 — 다가오는 일정", text });
    ActivityLog.push("system", "다가오는 마감 공유", {});
  });

  // Live re-render when any tab updates state
  ["activity", "jabo.history", "retention.lastAudit", "kcd.lastSummary",
   "license.list", "accred.checked", "bigeup.tariff", "jabo.draft.items"
  ].forEach(k => EventBus.on(`store:${k}`, renderAll));
  EventBus.on("tab:activated", (id) => { if (id === "tab-today") renderAll(); });

  // Refresh relative times every 30s
  setInterval(renderAll, 30000);
}
