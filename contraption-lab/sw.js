/* Contraption Lab — minimal offline shell SW */
const CACHE = "vibe-contraption-lab-v1";
const SHELL = [
  "./","./index.html","./style.css","./manifest.webmanifest","./icon.svg",
  "./vendor/matter.min.js",
  "./js/main.js","./js/engine.js","./js/parts.js","./js/level.js","./js/levels/official.js",
  "./js/render.js","./js/input.js","./js/progress.js","./js/theme.js","./js/geom.js",
];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("vibe-contraption-lab-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method!=="GET") return;
  if (new URL(req.url).origin !== self.location.origin) return; // never touch cross-origin (Phase 2 PB)
  if (req.mode==="navigate" || (req.headers.get("accept")||"").includes("text/html")) {
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));return r;}).catch(()=>caches.match(req).then(m=>m||caches.match("./index.html")))); return;
  }
  e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>{ if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));} return r; }).catch(()=>m)));
});
