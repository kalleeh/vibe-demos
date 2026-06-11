/* kids-bookshelf — offline shell SW (network-first HTML, cache-first assets) */
const CACHE = "vibe-kids-bookshelf-v7";
const SHELL = [
  "./", "./index.html", "./app.js", "./catalog.js", "./manifest.webmanifest", "./icon.svg",
  // crayon chip icons — precached so an installed PWA shows them offline first-open
  "./icons/gongryong.png", "./icons/uju.png", "./icons/dongmul.png", "./icons/gongju.png",
  "./icons/jadongcha.png", "./icons/talgeot.png", "./icons/geurim.png", "./icons/jamjari.png",
  "./icons/jayeon.png", "./icons/eumsik.png", "./icons/gajok.png", "./icons/chingu.png",
  "./icons/gamjeong.png", "./icons/ilsang.png", "./icons/hwansang.png", "./icons/moheom.png",
  "./icons/sutja.png", "./icons/yumeo.png",
  "./icons/mood-ttaseuthan.png", "./icons/mood-hakseup.png", "./icons/mood-janjan.png"
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
  // Never intercept cross-origin — skips the AI proxy (ai.pb.gurum.se) and
  // Open Library covers (covers.openlibrary.org) from caching; straight to network.
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
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});
