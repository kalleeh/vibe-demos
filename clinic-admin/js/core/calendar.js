/* clinic-admin — statutory reporting calendar shared by 00 오늘, 04 비급여, 08 면허 and the topbar due chip.
   Sits in core so shell.js and the tabs read ONE set of dates. Labels are resolved through t() at call time so a
   language toggle re-renders them.
   Every item carries `ctx` for activateTab(link, ctx): { refMonth } for a 비급여 window, { taxYear } for 연말정산,
   { staffId } for the per-person licence items produced from the shared Staff roster (core/entities.js).
   EXTERNAL SOURCES (Phase 3): the calendar cannot import tabs, so tab modules that own dated items (이의신청 기한 in
   tab-appeal.js, 지불보증 만료 in tab-guarantee.js) register a producer at load with registerDeadlineSource(fn, opts) —
   see the contract above that function. allDeadlines() then carries them like every statutory item, so 00's D-day list,
   the todo rows, the topbar chip and the .ics export all include appeals and guarantee expiries. */
import { t } from "./i18n.js";
import { daysUntil } from "./dom.js";
import { Org, Staff } from "./entities.js";

/* 비급여 보고 (의료법 §45조의2 · 고시 「비급여 진료비용 등의 보고 및 공개에 관한 기준」):
   reference months March / September, submission windows April / October.
   Confidence: medium — 병원급 reports twice a year (의원급 once, March data only);
   exact open/close days are set by the annual 심평원 notice, hence "확인 필요" in the UI. */
export const BIGEUP_WINDOWS = [
  { key: "bigeup-h1", refMonth: 3, month: 4,  get label() { return t("today.dl.bigeupH1"); } },
  { key: "bigeup-h2", refMonth: 9, month: 10, get label() { return t("today.dl.bigeupH2"); } }
];

/* 연말정산 간소화 의료비 자료 제출 — 소득세법 시행령 §216조의3: 다음 연도 1월 13일까지.
   Confidence: medium-high on the law text; 국세청 publishes the practical window each year
   (간소화 서비스 opens 1월 15일, 수정·추가 제출 window follows), hence "확인 필요". */
export const YEAREND_DEADLINE = { key: "yearend", month: 1, day: 13, get label() { return t("today.dl.yearend"); } };

// Last day of a month as yyyy-mm-dd.
export function monthEndISO(y, m) {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

// Next occurrence (today inclusive) of a recurring month/day; `day` null → month end.
export function nextOccurrence(month, day, now = new Date()) {
  const y = now.getFullYear();
  const iso = (yy) => day ? `${yy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : monthEndISO(yy, month);
  const todayISO = `${y}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return iso(y) >= todayISO ? iso(y) : iso(y + 1);
}

// The 비급여 windows this institution reports in: 병원급 both (March + September data), 의원급 March only.
export function bigeupWindows() {
  return Org.get().kind === "의원" ? BIGEUP_WINDOWS.filter(w => w.refMonth === 3) : BIGEUP_WINDOWS;
}

// The recurring statutory deadlines as { key, title, date, link, source, ctx } for the next 12 months.
export function statutoryDeadlines(now = new Date()) {
  const bigeup = bigeupWindows().map(w => {
    const date = nextOccurrence(w.month, null, now);
    return {
      key: w.key, title: w.label, date, link: "tab-bigeup", source: t("today.dl.bigeupSource", { m: w.refMonth }),
      ctx: { refMonth: `${date.slice(0, 4)}-${String(w.refMonth).padStart(2, "0")}` }
    };
  });
  const yeDate = nextOccurrence(YEAREND_DEADLINE.month, YEAREND_DEADLINE.day, now);
  const yearend = {
    key: YEAREND_DEADLINE.key, title: YEAREND_DEADLINE.label, date: yeDate, link: "tab-yearend",
    source: t("today.dl.yearendSource"), ctx: { taxYear: +yeDate.slice(0, 4) - 1 }
  };
  return [...bigeup, yearend];
}

/* Per-person items from the roster: 면허신고 기한 (jobs with a 신고 duty only — 원무·행정·기타 never get a D-day)
   and 보수교육 마감. `basis` tells "acquired" (신고 이력 미확인) from "reported". Unfiltered by distance — callers
   window them (00 오늘 shows −30 … +365 days, the topbar chip 0 … 14). Empty while the workspace is locked. */
export function staffDeadlines() {
  const out = [];
  for (const s of Staff.list()) {
    const who = Staff.ref(s);
    if (s.expiry && Staff.hasDuty(s.job)) out.push({
      key: `lic-${s.id}-exp`, title: t(s.basis === "acquired" ? "today.dl.licReportUnverified" : "today.dl.licReport", { who }),
      date: s.expiry, link: "tab-license", source: t(s.basis === "acquired" ? "today.dl.licSourceAcquired" : "today.dl.licSourceReported"),
      ctx: { staffId: s.id }, basis: s.basis, kind: "report"
    });
    if (s.cme) out.push({
      key: `lic-${s.id}-cme`, title: t("today.dl.cme", { who }), date: s.cme, link: "tab-license",
      source: t("today.dl.cmeSource"), ctx: { staffId: s.id }, kind: "cme"
    });
  }
  return out;
}

/* ── external deadline sources (registered by tab modules — the calendar never imports a tab) ──
   registerDeadlineSource(fn, { link, kind, source? })
     fn()   → [{ key, label|title, due|date, link?, source?, ctx }]   (the producer's native shape is accepted as is:
              tab-appeal.appealDeadlines() → { key, label, due, ctx:{ appealId } }; tab-guarantee.guaranteeDeadlines() →
              { key, label, due, ctx:{ guaranteeId } })
     link   panel id opened with the item's ctx when the row is clicked (item.link wins when present)
     kind   "appeal" | "guarantee" | … — resolves the default source text through t("today.dl." + kind + "Source")
     source optional fixed source text (item.source wins, then this, then the kind key)
   Registering the same fn twice is a no-op; items whose key already exists are dropped (dedupe by key), so a module
   registering at load while the shim also registers is harmless. Producers that throw are skipped (console.warn). */
const SOURCES = new Map(); // fn → opts
export function registerDeadlineSource(fn, opts = {}) {
  if (typeof fn !== "function") return () => {};
  SOURCES.set(fn, opts || {});
  return () => { SOURCES.delete(fn); };
}
export function externalDeadlines() {
  const out = [];
  for (const [fn, opts] of SOURCES) {
    let items = [];
    try { items = fn() || []; } catch (e) { console.warn("deadline source", e); continue; }
    for (const it of items) {
      if (!it) continue;
      const date = String(it.due ?? it.date ?? "").slice(0, 10);
      const key = String(it.key ?? "");
      if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      out.push({
        key, title: String(it.label ?? it.title ?? key), date,
        link: it.link ?? opts.link ?? null,
        source: it.source ?? opts.source ?? (opts.kind ? t(`today.dl.${opts.kind}Source`) : ""),
        ctx: it.ctx ?? null, kind: opts.kind || "external"
      });
    }
  }
  return out;
}

// Everything, with daysLeft; sorted soonest first, past-due last. Keys are unique (first producer wins).
export function allDeadlines(now = new Date()) {
  const seen = new Set();
  const list = [...statutoryDeadlines(now), ...staffDeadlines(), ...externalDeadlines()].filter(d => { if (seen.has(d.key)) return false; seen.add(d.key); return true; });
  for (const d of list) d.daysLeft = daysUntil(d.date);
  list.sort((a, b) => {
    if (a.daysLeft < 0 && b.daysLeft >= 0) return 1;
    if (b.daysLeft < 0 && a.daysLeft >= 0) return -1;
    return Math.abs(a.daysLeft) - Math.abs(b.daysLeft);
  });
  return list;
}
