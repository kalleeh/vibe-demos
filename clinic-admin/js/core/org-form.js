/* clinic-admin — 기관 프로필 editor (core/entities.js Org), rendered into any container.
   Used twice: the compact block in the ⓘ 정보 modal (always editable) and the first-run step right after a
   workspace is created ("기관 정보 — 나중에 입력 가능", with a skip button). Same fields, same validation.
   Position: ui → entities → ORG-FORM → shell (never imported by tabs). */
import { $, esc, Toast, Haptic } from "./ui.js";
import { t, onLangChange } from "./i18n.js";
import { ActivityLog } from "./store.js";
import { Org } from "./entities.js";

const FIELDS = [
  { f: "name",  type: "text", maxlength: 40, ph: "org.phName" },
  { f: "ykiho", type: "text", maxlength: 8,  ph: "org.phYkiho", inputmode: "numeric", pattern: "\\d{8}" },
  { f: "biz",   type: "text", maxlength: 12, ph: "org.phBiz", inputmode: "numeric", pattern: "\\d{3}-\\d{2}-\\d{5}" },
  { f: "kind",  type: "select" },
  { f: "rep",   type: "text", maxlength: 20, ph: "org.phRep" }
];

/* renderOrgForm(container, { prefix, skippable, onSaved, onSkip }) → { fill, destroy }
   `prefix` keeps ids unique when two forms are mounted; `skippable` adds the "나중에 입력" button. */
export function renderOrgForm(container, { prefix = "org", skippable = false, onSaved, onSkip } = {}) {
  if (!container) return null;
  const id = (f) => `${prefix}-${f}`;
  const field = (d) => {
    if (d.type === "select") return `<div class="field"><label for="${id(d.f)}">${esc(t("org.f." + d.f))}</label>
      <select id="${id(d.f)}">${Org.KINDS.map(k => `<option value="${esc(k)}">${esc(t("org.kind." + k))}</option>`).join("")}</select></div>`;
    return `<div class="field"><label for="${id(d.f)}">${esc(t("org.f." + d.f))}</label>
      <input id="${id(d.f)}" type="text" maxlength="${d.maxlength}" placeholder="${esc(t(d.ph))}" autocomplete="off" ${d.inputmode ? `inputmode="${d.inputmode}"` : ""}></div>`;
  };
  const render = () => {
    container.innerHTML = `
      <form class="org-form" id="${id("form")}" autocomplete="off" novalidate>
        <div class="org-grid">${FIELDS.map(field).join("")}</div>
        <p class="sec-msg" id="${id("msg")}" hidden></p>
        <div class="actions">
          <button type="submit" class="btn" id="${id("save")}">${esc(t("common.save"))}</button>
          ${skippable ? `<button type="button" class="btn secondary" id="${id("skip")}">${esc(t("org.skipBtn"))}</button>` : ""}
          <span class="org-status" id="${id("status")}"></span>
        </div>
      </form>`;
    fill();
    $(`#${id("form")}`, container).addEventListener("submit", (e) => { e.preventDefault(); save(); });
    $(`#${id("skip")}`, container)?.addEventListener("click", () => { onSkip?.(); });
  };
  const msg = (text, kind = "") => { const el = $(`#${id("msg")}`, container); if (!el) return; el.textContent = text || ""; el.className = "sec-msg " + kind; el.hidden = !text; };
  const status = () => { const el = $(`#${id("status")}`, container); if (el) el.textContent = Org.isComplete() ? t("org.statusComplete") : t("org.statusIncomplete"); };
  function fill() {
    const o = Org.get();
    for (const d of FIELDS) { const el = $(`#${id(d.f)}`, container); if (el && document.activeElement !== el) el.value = o[d.f] || (d.f === "kind" ? "병원" : ""); }
    status();
  }
  function save() {
    const patch = {};
    for (const d of FIELDS) patch[d.f] = $(`#${id(d.f)}`, container)?.value ?? "";
    patch.name = patch.name.trim(); patch.rep = patch.rep.trim();
    patch.ykiho = patch.ykiho.replace(/\D/g, "");
    const bizDigits = patch.biz.replace(/\D/g, "");
    patch.biz = bizDigits.length === 10 ? `${bizDigits.slice(0, 3)}-${bizDigits.slice(3, 5)}-${bizDigits.slice(5)}` : patch.biz.trim();
    if (patch.ykiho && patch.ykiho.length !== 8) { msg(t("org.errYkiho"), "err"); Haptic.warn(); return; }
    if (patch.biz && !/^\d{3}-\d{2}-\d{5}$/.test(patch.biz)) { msg(t("org.errBiz"), "err"); Haptic.warn(); return; }
    Org.set(patch);
    ActivityLog.add({ tag: "system", action: t("org.logSaved"), meta: { silent: true } });
    Toast.show({ tag: "system", html: esc(t("org.savedToast", { name: patch.name || "—" })) });
    Haptic.save();
    msg(t("org.msgSaved"), "ok");
    fill();
    onSaved?.(Org.get());
  }
  render();
  Org.onChange(fill);
  onLangChange(render);
  return { fill, destroy() { container.innerHTML = ""; } };
}
