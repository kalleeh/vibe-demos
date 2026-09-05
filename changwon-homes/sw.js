/* changwon-homes — offline shell SW.
   - HTML: network-first, cache fallback.
   - data.json: network-first, cache fallback (see note below).
   - everything else in SHELL (vendored Leaflet/MarkerCluster, icon, manifest): cache-first.
   Bump CACHE whenever any shell file changes — that is the only invalidation. */
const CACHE = "vibe-changwon-homes-v9";
/* data.json is precached so the app is fully usable offline, BUT it is served network-first by the
   fetch handler below — a cache-first precache would make index.html's fetch(…,{cache:"no-cache"})
   meaningless (it would always get the install-time copy). Cross-origin (OSM tiles, fonts) is never
   intercepted, so the basemap itself is only available offline as far as the browser's HTTP cache goes. */
const NETWORK_FIRST = ["/data.json"];
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./data.json",
  "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css",
  "./vendor/leaflet/images/marker-icon.png", "./vendor/leaflet/images/marker-icon-2x.png",
  "./vendor/leaflet/images/marker-shadow.png", "./vendor/leaflet/images/layers.png", "./vendor/leaflet/images/layers-2x.png",
  "./vendor/leaflet.markercluster/leaflet.markercluster.js", "./vendor/leaflet.markercluster/MarkerCluster.css",
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

function networkFirst(req) {
  return fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never intercept cross-origin (OSM tiles, Google Fonts, AI proxy) — straight to network.
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(networkFirst(req).then(m => m || caches.match("./index.html")));
    return;
  }
  if (NETWORK_FIRST.some(p => url.pathname.endsWith(p))) {
    e.respondWith(networkFirst(req));
    return;
  }

  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});
