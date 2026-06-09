const CACHE = "vibe-korean-mbti-v17";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  // Canned-demo portraits (women set, the default) so the showcase flow is
  // instant offline. Other types + the men set are picked up by the runtime
  // cache on first view.
  "./portraits/women/infj.jpg",
  "./portraits/women/entj.jpg",
  "./portraits/women/enfp.jpg",
  "./portraits/women/isfj.jpg"
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
  // Never intercept cross-origin requests — the live Anthropic API, the
  // PocketBase type-distribution backend, and the PocketBase CDN ESM module all
  // must hit the network untouched so data is always fresh.
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
