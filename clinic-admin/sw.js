/* clinic-admin — minimal offline shell SW */
const CACHE = "vibe-clinic-admin-v23";
// Every same-origin file the page loads. Verified against the tree by tools/check-sw-shell.mjs.
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  "./styles.css",
  "./styles-security.css",
  "./styles-claims.css",
  "./styles-reporting.css",
  "./js/main.js", "./js/shell.js", "./js/board.js",
  "./js/core/dom.js", "./js/core/attachments.js", "./js/core/store.js", "./js/core/nav.js",
  "./js/core/ui.js", "./js/core/files.js", "./js/core/ocr.js", "./js/core/ai-client.js",
  "./js/core/masters.js", "./js/core/calendar.js", "./js/core/i18n.js",
  "./js/core/entities.js", "./js/core/org-form.js",
  "./js/i18n/ko.js", "./js/i18n/en.js",
  "./js/i18n/ko.entities.js", "./js/i18n/en.entities.js",
  "./js/i18n/ko.claims.js", "./js/i18n/en.claims.js",
  "./js/i18n/ko.reporting.js", "./js/i18n/en.reporting.js",
  "./js/security/crypto.js", "./js/security/session.js", "./js/security/redact.js",
  "./js/security/lifecycle.js", "./js/security/lockscreen.js",
  "./js/tabs/reporting-shared.js",
  "./js/tabs/tab0-today.js", "./js/tabs/tab1-kcd.js", "./js/tabs/tab2-jabo.js",
  "./js/tabs/tab3-yearend.js", "./js/tabs/tab4-bigeup.js", "./js/tabs/tab5-retention.js",
  "./js/tabs/tab6-search.js", "./js/tabs/tab7-ai.js", "./js/tabs/tab7-prompt.js",
  "./js/tabs/tab8-license.js", "./js/tabs/tab9-accred.js",
  "./vendor/xlsx.full.min.js",
  "./data/kcd9.json",
  "./data/jabo.json",
  "./data/jabo-sample-claims.json",
  "./data/jabo-sample-review.json",
  "./data/bigeup.json",
  "./data/retention.json"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith(CACHE.replace(/-v\d+$/, "-")) && k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Never intercept cross-origin requests — PocketBase API/realtime
  // (clinic-admin.pb.gurum.se), the PB SDK ESM (jsdelivr), Tesseract.js
  // (jsdelivr, too large to precache — OCR is online-only), the Claude
  // proxy (ai.pb.gurum.se), etc. Let them hit the network untouched so the
  // live intake board and AI calls are always fresh and the SW never caches
  // stale data. SheetJS is vendored (./vendor) and precached above.
  if (new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req).then(m => m || caches.match("./index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      if (r.ok && new URL(req.url).origin === location.origin) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return r;
    }).catch(() => m))
  );
});
