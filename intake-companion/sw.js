/* intake-companion — minimal offline shell SW */
const CACHE = "vibe-intake-companion-v6";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  // Watercolor herb vignettes (small WebP) that float in the page margins.
  "./herb-ginseng.webp",
  "./herb-mugwort.webp",
  // Five most-common 본초 watercolors precached for the formula expansion.
  // Remaining 15 lazy-load on demand (cache-first via the fetch handler below).
  "./herbs/insam.jpg",
  "./herbs/hwanggi.jpg",
  "./herbs/baekchul.jpg",
  "./herbs/bokryeong.jpg",
  "./herbs/gamcho.jpg"
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
  // Skip Anthropic API — never cache live calls.
  if (new URL(req.url).hostname === "api.anthropic.com") return;
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
