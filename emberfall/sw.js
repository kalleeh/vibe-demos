/* Emberfall service worker. The build (pwa/vite-plugin.ts) fills in the precache list and version stamps.
   Shell (hashed bundle, index, manifest, icons): precached, cache-first.
   Assets (textures, models, audio, generated art under assets/ and art/): cached on first use, cache-first, under a
   cache keyed on the asset manifests so a deploy that changes them starts a fresh cache.
   Navigations: network-first with the cached index as the offline fallback. */
const SHELL_VERSION = '4abc9f61e3';
const ASSET_VERSION = '21091a2236';
const SHELL = `emberfall-shell-${SHELL_VERSION}`;
const RUNTIME = `emberfall-assets-${ASSET_VERSION}`;
const PRECACHE = ["./","assets/cinzel-latin-400-normal-DnUIPmzd.woff2","assets/cinzel-latin-700-normal-Dkw14w9r.woff2","assets/cinzel-latin-900-normal-BI3z7Tow.woff2","assets/cinzel-latin-ext-400-normal-XQK_CSAr.woff2","assets/cinzel-latin-ext-700-normal-C24KFjuG.woff2","assets/cinzel-latin-ext-900-normal-CWXxiu5r.woff2","assets/eb-garamond-latin-400-italic-DSEbMgZu.woff2","assets/eb-garamond-latin-400-normal-BCNrxLz_.woff2","assets/eb-garamond-latin-500-normal-DehAIUv0.woff2","assets/eb-garamond-latin-ext-400-italic-V7s3nWfX.woff2","assets/eb-garamond-latin-ext-400-normal-o4A__6QZ.woff2","assets/eb-garamond-latin-ext-500-normal-BFuc0jzo.woff2","assets/game-B0rnbx6H.js","assets/index-ByNYpBHW.js","assets/index-CKuFiSUy.css","assets/input-R5QaKl6g.js","assets/lookdev-vY6blzBM.js","assets/worker-DZtU7lgA.js","icon.svg","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest"];
const scopeUrl = new URL(self.registration.scope);
const PRECACHE_SET = new Set(PRECACHE.map((p) => new URL(p, scopeUrl).pathname));

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('emberfall-') && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'emberfall:version' && e.source) e.source.postMessage({ shell: SHELL_VERSION, assets: ASSET_VERSION });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;
  // byte-range requests (media seeking) cannot be answered from the Cache API
  if (req.headers.has('range')) return;

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(SHELL).then((c) => c.put('./index.html', r.clone()));
          return r;
        })
        .catch(() => caches.match('./index.html', { cacheName: SHELL, ignoreVary: true }).then((m) => m || Response.error())),
    );
    return;
  }

  // static hosts answer with `Vary: Origin`; `crossorigin` script/style requests would otherwise never match the precache
  const cacheName = PRECACHE_SET.has(url.pathname) ? SHELL : RUNTIME;
  e.respondWith(
    caches.match(req, { cacheName, ignoreVary: true, ignoreSearch: cacheName === RUNTIME }).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok && r.type === 'basic') caches.open(cacheName).then((c) => c.put(req, r.clone()));
          return r;
        }),
    ),
  );
});
