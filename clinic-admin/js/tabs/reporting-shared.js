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

/* Canonical org view over core/entities.js Org.get() = { name, ykiho, biz, kind: "병원"|"의원", rep }.
   `clinicLevel` = 의원급 (reports 비급여 once a year, March data); `kindLabel` follows the UI language. */
export function orgView(o) {
  const v = o || {};
  const kind = v.kind === "의원" ? "의원" : "병원";
  return { name: v.name || "", ykiho: v.ykiho || "", biz: v.biz || "", kind, kindLabel: t("org.kind." + kind), rep: v.rep || "", clinicLevel: kind === "의원" };
}

/* Read-only institution block for 03/04 ("Org profile everywhere"). `onEdit` is wired by the caller to
   EventBus "shell:openInfo" (the shell owns the editor). Rows with no value show "미입력" so the gap is visible. */
export function renderOrgReadOnly(el, org, { onEdit } = {}) {
  if (!el) return;
  const v = orgView(org);
  const cell = (labelKey, val) => `<div class="org-cell"><span class="org-k">${esc(t(labelKey))}</span><span class="org-v${val ? "" : " missing"}">${esc(val || t("reporting.org.missing"))}</span></div>`;
  el.innerHTML = `
    <div class="org-ro" role="group" aria-label="${esc(t("common.clinicInfo"))}">
      ${cell("common.clinicName", v.name)}
      ${cell("reporting.org.ykiho", v.ykiho)}
      ${cell("reporting.org.bizNo", v.biz)}
      ${cell("reporting.org.kind", v.kindLabel)}
      ${cell("reporting.org.rep", v.rep)}
      <button type="button" class="org-edit small-link" data-org-edit>${esc(t("reporting.org.edit"))}</button>
    </div>`;
  el.querySelector("[data-org-edit]")?.addEventListener("click", (e) => { e.preventDefault(); onEdit?.(); });
}

// Export header pairs (headerKey, value) for the sheet writers — same institution columns in every reporting file.
export function orgHeaderPairs(org) {
  const v = orgView(org);
  return [["reporting.col.ykiho", v.ykiho], ["reporting.col.clinic", v.name], ["reporting.col.bizNo", v.biz]];
}
