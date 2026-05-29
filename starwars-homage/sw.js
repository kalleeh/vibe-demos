const CACHE = "vibe-starwars-homage-v10";
const SHELL = [
  "./",
  "./index.html",
  "./icon.svg",
  "./manifest.webmanifest",
  "./poster.jpg"
  // NOTE: film.mp4 is intentionally NOT precached. Serving a video from the
  // Cache API returns a full 200 to byte-range (206) requests, which breaks
  // seeking/scrubbing in iOS Safari. The fetch handler skips it too.
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith(CACHE.replace(/-v\d+$/, "-")) && k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Let the browser handle the video directly so byte-range (206) requests
  // work — never intercept or cache it.
  if (url.pathname.endsWith(".mp4")) return;

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
