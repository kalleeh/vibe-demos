/* clinic-admin — helpers shared by the reporting tabs (00 · 03 · 04 · 05 · 09).
   Sits in the `tabs` layer of the import graph (dom → … → files → tabs); never imports shell.js.
   i18n: everything user-visible resolves through t(); the org block re-renders on Org.onChange + language swap. */
import { esc } from "../core/dom.js";
import { t } from "../core/i18n.js";

/* 주민등록번호 — 13 digits + weighted checksum (2,3,4,5,6,7,8,9,2,3,4,5 mod 11).
   Confidence: high on the historical algorithm. Since 2020-10 new numbers carry random
   trailing digits with NO checksum, and 외국인등록번호 use a different rule — so a checksum
   miss is a WARNING, only a wrong length is an error. */
// Returns { digits, level, msg, msgKey, vars } — msgKey/vars let the caller re-translate on a language swap.
export function checkRRN(raw) {
  const d = String(raw ?? "").replace(/[^0-9]/g, "");
  const out = (level, msgKey, vars) => ({ digits: d, level, msgKey, vars, msg: msgKey ? t(msgKey, vars) : "" });
  if (d.length !== 13) return out("error", "yearend.rrnLen", { n: d.length });
  const mm = +d.slice(2, 4), dd = +d.slice(4, 6);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return out("error", "yearend.rrnMmdd");
  const W = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  const sum = W.reduce((s, w, i) => s + w * +d[i], 0);
  const check = (11 - (sum % 11)) % 10;
  if (check !== +d[12]) return out("warn", "yearend.rrnChecksum");
  return out("ok", null);
}

// 880314-2123456 → 880314-2******  (never render more than the first 7 digits)
export function maskRRN(raw) {
  const d = String(raw ?? "").replace(/[^0-9]/g, "");
  if (!d) return "";
  return d.slice(0, 6) + "-" + (d[6] || "") + "******";
}

/* ── Shared fictional clinic (the ONLY institution the demos know) ── */
export const DEMO_ORG = { name: "한솔한방병원", ykiho: "11000123", bizNo: "123-45-67890", kind: "병원급", rep: "윤지훈" };

/* Canonical org view. F1's Org.get() shape is { name, ykiho, bizNo, kind, rep }; the aliases only cushion
   an integration drift and cost nothing. `clinicLevel` = 의원급 (reports 비급여 once a year, March data). */
export function orgView(o) {
  const v = o || {};
  const kind = v.kind ?? v.type ?? "";
  return {
    name: v.name ?? v.clinic ?? "",
    ykiho: v.ykiho ?? v.code ?? "",
    bizNo: v.bizNo ?? v.biz ?? "",
    kind,
    rep: v.rep ?? v.director ?? "",
    clinicLevel: /의원/.test(String(kind))
  };
}

// Fill missing org fields from DEMO_ORG (used by the tabs' seed()/샘플 시연 so the demo is coherent); never overwrites.
export function ensureDemoOrg(Org) {
  const cur = Org.get() || {};
  const patch = Object.fromEntries(Object.entries(DEMO_ORG).filter(([k]) => !cur[k]));
  if (Object.keys(patch).length) Org.set(patch);
}

/* `tab:activated` payload — the contract shape is { id, ctx }; the legacy nav emits a bare id string. */
export function normTabEvent(p) {
  if (p && typeof p === "object") return { id: p.id, ctx: p.ctx || null };
  return { id: p, ctx: null };
}

/* Read-only institution block for 03/04 ("Org profile everywhere"). `onEdit` is wired by the caller to
   activateTab("tab-today", { openOrg: true }). Rows with no value show "미입력" so the gap is visible. */
export function renderOrgReadOnly(el, org, { onEdit } = {}) {
  if (!el) return;
  const v = orgView(org);
  const cell = (labelKey, val) => `<div class="org-cell"><span class="org-k">${esc(t(labelKey))}</span><span class="org-v${val ? "" : " missing"}">${esc(val || t("reporting.org.missing"))}</span></div>`;
  el.innerHTML = `
    <div class="org-ro" role="group" aria-label="${esc(t("common.clinicInfo"))}">
      ${cell("common.clinicName", v.name)}
      ${cell("reporting.org.ykiho", v.ykiho)}
      ${cell("reporting.org.bizNo", v.bizNo)}
      ${cell("reporting.org.kind", v.kind)}
      ${cell("reporting.org.rep", v.rep)}
      <button type="button" class="org-edit small-link" data-org-edit>${esc(t("reporting.org.edit"))}</button>
    </div>`;
  el.querySelector("[data-org-edit]")?.addEventListener("click", (e) => { e.preventDefault(); onEdit?.(); });
}

// Export header pairs (headerKey, value) for the sheet writers — same institution columns in every reporting file.
export function orgHeaderPairs(org) {
  const v = orgView(org);
  return [["reporting.col.ykiho", v.ykiho], ["reporting.col.clinic", v.name], ["reporting.col.bizNo", v.bizNo]];
}
