// contraption-lab/js/sprites.js
// Registry mapping partType → sprite art + how it maps onto the collision body.
// fit: "circle" (square ⌀×⌀), "box" (oriented w×h), "plank" (long thin side-profile bar),
//      "compound" (covers a multi-body part's union AABB). scale: sprite size × body bbox.
// overflow: extra fraction drawn beyond the bbox (DECORATION ONLY — never affects collision).
// spin: rotation speed in radians/sec (RENDER-ONLY, never affects physics).
const P = (src, fit, opt = {}) => ({ src, fit, scale: opt.scale ?? 1, overflow: opt.overflow ?? 0, spin: opt.spin ?? 0, themeOverrides: opt.themeOverrides ?? {} });

export const SPRITES = {
  // existing 10 (Track A)
  // Hero parts (ball, fan) carry per-theme override art for Neon + Blueprint
  // (showcase of the themeOverrides hook); other themes/parts use the shared sprite.
  // (goal has no sprite entry — render.js's drawGoal() draws a procedural bullseye
  // sized to the actual win zone instead; a fixed-size PNG couldn't match every
  // level's differently-sized zone.)
  ball:     P("./assets/parts/ball.png",     "circle", { themeOverrides: { neon: "./assets/parts/neon/ball.png", blueprint: "./assets/parts/blueprint/ball.png" } }),
  wall:     P("./assets/parts/wall.png",     "box"),
  ramp:     P("./assets/parts/ramp.png",     "plank"),
  domino:   P("./assets/parts/domino.png",   "box"),
  balloon:  P("./assets/parts/balloon.png",  "circle", { overflow: 0.5 }),  // string hangs below
  bucket:   P("./assets/parts/bucket.png",   "compound"),
  fan:      P("./assets/parts/fan.png",      "box",    { overflow: 0.25, spin: 6, themeOverrides: { neon: "./assets/parts/neon/fan.png", blueprint: "./assets/parts/blueprint/fan.png" } }), // blade tips
  conveyor: P("./assets/parts/conveyor.png", "plank"),
  seesaw:   P("./assets/parts/seesaw.png",   "plank"),
  // Track B (Task 6)
  trampoline: P("./assets/parts/trampoline.png","box"),
  gear:       P("./assets/parts/gear.png","circle"),
  crate:      P("./assets/parts/crate.png","box"),
  pipe:       P("./assets/parts/pipe.png","plank"),
  pinwheel:   P("./assets/parts/pinwheel.png","box", { spin: 4 }),
  spring:     P("./assets/parts/spring.png","box"),
  wedge:      P("./assets/parts/wedge.png","box"),
  platform:   P("./assets/parts/platform.png","plank"),
  bowlingpin: P("./assets/parts/bowlingpin.png","box"),
  weight:     P("./assets/parts/weight.png","box"),
  // Track C (Task 7) — new physics
  rope:  P("./assets/parts/rope.png","box",  { overflow: 0.5 }), // segments hang past bbox
  gears: P("./assets/parts/gears.png","circle"),
  tnt:   P("./assets/parts/tnt.png","box"),
  // Levels-v2 new mechanics
  ice:         P("./assets/parts/ice.png","plank"),
  sticky:      P("./assets/parts/sticky.png","plank"),
  bumper:      P("./assets/parts/bumper.png","circle"),
  magnet:      P("./assets/parts/magnet.png","box"),
  accelerator: P("./assets/parts/accelerator.png","plank"),
  vortex:      P("./assets/parts/vortex.png","circle"),
  portal:      P("./assets/parts/portal.png","circle"),
  button:      P("./assets/parts/button.png","box"),
  gate:        P("./assets/parts/gate.png","box"),
};

import { canvasEmblem, spriteDataURI } from "./part-icons.js";

const cache = new Map();

export function resolveSprite(partType, themeId) {
  const e = SPRITES[partType];
  if (!e) return null;
  // Square-bodied parts use the hand-shaded gradient emblem (matches the tray);
  // elongated/plank parts keep their tiling PNG so they don't distort. Render-only.
  if (canvasEmblem(partType)) {
    return { src: spriteDataURI(partType), fit: e.fit, scale: e.scale, overflow: e.overflow, spin: e.spin };
  }
  const src = (e.themeOverrides && e.themeOverrides[themeId]) || e.src;
  return { src, fit: e.fit, scale: e.scale, overflow: e.overflow, spin: e.spin };
}

export function getImage(src) {
  const img = cache.get(src);
  return img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null;
}

export function preloadSprites(themeId) {
  const srcs = new Set();
  for (const t of Object.keys(SPRITES)) { const r = resolveSprite(t, themeId); if (r) srcs.add(r.src); }
  return Promise.all([...srcs].map(src => new Promise(res => {
    if (cache.has(src)) return res();
    const img = new Image(); cache.set(src, img);
    img.onload = () => res(); img.onerror = () => res(); // settle either way — never reject
    img.src = src;
  })));
}
