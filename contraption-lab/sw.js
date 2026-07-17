/* Contraption Lab — minimal offline shell SW */
const CACHE = "vibe-contraption-lab-v19";
const SHELL = [
  "./","./index.html","./style.css","./manifest.webmanifest","./icon.svg",
  "./vendor/matter.min.js",
  "./js/main.js","./js/engine.js","./js/parts.js","./js/level.js","./js/levels/official.js",
  "./js/render.js","./js/input.js","./js/progress.js","./js/theme.js","./js/geom.js",
  "./js/cloud.js","./js/auth-ui.js","./js/editor.js","./js/browse.js","./js/fx.js","./js/sound.js","./js/part-icons.js",
  "./assets/parts/ball.png","./assets/parts/balloon.png","./assets/parts/bowlingpin.png",
  "./assets/parts/bucket.png","./assets/parts/conveyor.png","./assets/parts/crate.png",
  "./assets/parts/domino.png","./assets/parts/fan.png","./assets/parts/gear.png",
  "./assets/parts/gears.png","./assets/parts/pinwheel.png",
  "./assets/parts/pipe.png","./assets/parts/platform.png","./assets/parts/ramp.png",
  "./assets/parts/rope.png","./assets/parts/seesaw.png","./assets/parts/spring.png",
  "./assets/parts/tnt.png","./assets/parts/trampoline.png","./assets/parts/wall.png",
  "./assets/parts/wedge.png","./assets/parts/weight.png",
  "./assets/parts/neon/ball.png","./assets/parts/neon/fan.png",
  "./assets/parts/blueprint/ball.png","./assets/parts/blueprint/fan.png",
  "./assets/parts/magnet.png","./assets/parts/accelerator.png","./assets/parts/vortex.png",
  "./assets/parts/ice.png","./assets/parts/sticky.png","./assets/parts/bumper.png",
  "./assets/parts/portal.png","./assets/parts/button.png","./assets/parts/gate.png",
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
