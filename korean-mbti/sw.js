const CACHE = "vibe-korean-mbti-v6";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  // Canned-demo portraits so the showcase flow is instant offline.
  // The other 12 types are picked up by the runtime cache on first view.
  "./portraits/infj.jpg",
  "./portraits/entj.jpg",
  "./portraits/enfp.jpg",
  "./portraits/isfj.jpg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Never cache the live Anthropic API.
  if (req.url.includes("api.anthropic.com")) return;
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
