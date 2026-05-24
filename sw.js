/* vibe-studio root landing — minimal offline shell SW.
   Tight scope: only caches the root landing, never demo subpaths
   (each demo registers its own SW under its own scope). */
const CACHE = "vibe-root-v4";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  // Landing-page imagery — hero band, 7 hover thumbs, paper texture, divider.
  "./thumbs/hero-band.jpg",
  "./thumbs/paper-texture.jpg",
  "./thumbs/divider.jpg",
  "./thumbs/sweden.jpg",
  "./thumbs/molecule.jpg",
  "./thumbs/globe.jpg",
  "./thumbs/intake.jpg",
  "./thumbs/mbti.jpg",
  "./thumbs/resonans.jpg",
  "./thumbs/clinic-admin.jpg"
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
  const url = new URL(req.url);
  // Only handle same-origin requests targeting the root scope.
  // Demo subpaths (e.g. /live-globe/) have their own SWs — skip them
  // so we don't shadow their offline shells.
  if (url.origin !== location.origin) return;
  const root = new URL(self.registration.scope);
  const path = url.pathname.slice(root.pathname.length);
  // Anything in a demo subfolder belongs to that demo's SW — except for
  // `thumbs/`, which is the landing's own asset folder.
  if (path.includes("/") && !path.startsWith("thumbs/")) return;

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
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return r;
    }).catch(() => m))
  );
});
