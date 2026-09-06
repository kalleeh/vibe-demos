/* clinic-admin — guided tour: a small fixed card that walks the connected story in 7 steps
     샘플 데이터 → 홈 › 지금 할 일 → 청구 › 청구 배치 → 청구 › 자보 심사결과 대조 → 청구 › 이의신청 → 환자 › 추적기 → 조직 › 직원 명부
   Each step activates a panel (core/nav.js activateTab) and rings its target element (.tour-target). Started from the welcome
   deck's "화면 안내" link, the ⌘K command or the rail foot ▶ 시연 deck; Esc / × / 완료 close it. Step 1 offers seedAll() while
   the workspace has no claim batch (shell.js passes it in). Copy lives under tour.* in *.ia.js; the card markup is in index.html. */
import { $, $$ } from "./core/dom.js";
import { t, onLangChange } from "./core/i18n.js";
import { EventBus } from "./core/store.js";
import { activateTab } from "./core/nav.js";
import { Batches } from "./core/entities.js";

const STEPS = [
  { key: "seed",     panel: "tab-today",     target: "#home-todo" },
  { key: "todo",     panel: "tab-today",     target: "#home-todo" },
  { key: "claims",   panel: "tab-claims",    target: "#claims-progress" },
  { key: "recon",    panel: "tab-jabo",      target: "#jabo-recon-card" },
  { key: "appeal",   panel: "tab-appeal",    target: "#appeal-register-card" },
  { key: "patients", panel: "tab-guarantee", target: "#tab-guarantee .panel-body" },
  { key: "org",      panel: "tab-license",   target: "#tab-license .card" }
];

const Tour = (() => {
  let i = -1, seedFn = null, closeLayers = null, seeding = false;
  const card = () => $("#tour-card");
  const isOpen = () => !!card() && !card().hidden;
  const seeded = () => Batches.list("claims").length > 0;

  function clearRing() { $$(".tour-target").forEach(el => el.classList.remove("tour-target")); }
  function render() {
    const el = card(); if (!el || i < 0) return;
    const s = STEPS[i], last = i === STEPS.length - 1;
    el.dataset.step = String(i + 1);
    el.dataset.key = s.key;
    $("#tour-n").textContent = t("tour.n", { i: i + 1, n: STEPS.length });
    $("#tour-title").textContent = t(`tour.${s.key}.title`);
    $("#tour-body").textContent = t(`tour.${s.key}.body`);
    const seedBtn = $("#tour-seed");
    seedBtn.hidden = s.key !== "seed";
    if (s.key === "seed") { const done = seeded(); seedBtn.disabled = done || seeding; seedBtn.textContent = seeding ? "…" : t(done ? "tour.seeded" : "tour.seedBtn"); }
    $("#tour-prev").disabled = i === 0;
    $("#tour-next").textContent = t(last ? "tour.done" : "tour.next");
    clearRing();
    const target = $(s.target);
    if (target) {
      target.classList.add("tour-target");
      setTimeout(() => target.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
    }
  }
  function go(n) {
    if (n < 0 || n >= STEPS.length) return;
    i = n;
    closeLayers?.();
    const s = STEPS[i];
    if ($(".panel.active")?.id !== s.panel) activateTab(s.panel);
    const el = card(); if (el) { el.hidden = false; document.body.classList.add("tour-open"); }
    render();
  }
  function start() { go(0); }
  function close() {
    const el = card(); if (!el || el.hidden) return;
    el.hidden = true; i = -1; clearRing();
    document.body.classList.remove("tour-open");
  }
  function init({ seed, closeLayers: cl } = {}) {
    seedFn = seed || null; closeLayers = cl || null;
    $("#tour-close")?.addEventListener("click", close);
    $("#tour-prev")?.addEventListener("click", () => go(i - 1));
    $("#tour-next")?.addEventListener("click", () => (i === STEPS.length - 1 ? close() : go(i + 1)));
    $("#tour-seed")?.addEventListener("click", async () => {
      if (!seedFn || seeded() || seeding) return;
      seeding = true; render();
      try { await seedFn(); } finally { seeding = false; }
      if (isOpen()) go(i); // seedAll() lands on 홈 — re-ring the target and refresh the button
    });
    EventBus.on("session:locked", close);
    onLangChange(() => { if (isOpen()) render(); });
  }
  return { init, start, close, isOpen, go, step: () => i + 1, length: STEPS.length };
})();

export { Tour, STEPS as TOUR_STEPS };
