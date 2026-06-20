// contraption-lab/js/sprites.js
// Registry mapping partType → sprite art + how it maps onto the collision body.
// fit: "circle" (square ⌀×⌀), "box" (oriented w×h), "plank" (long thin side-profile bar),
//      "compound" (covers a multi-body part's union AABB). scale: sprite size × body bbox.
// overflow: extra fraction drawn beyond the bbox (DECORATION ONLY — never affects collision).
const P = (src, fit, opt = {}) => ({ src, fit, scale: opt.scale ?? 1, overflow: opt.overflow ?? 0, themeOverrides: opt.themeOverrides ?? {} });

export const SPRITES = {
  // existing 10 (Track A)
  ball:     P("./assets/parts/ball.png",     "circle"),
  wall:     P("./assets/parts/wall.png",     "box"),
  ramp:     P("./assets/parts/ramp.png",     "plank"),
  domino:   P("./assets/parts/domino.png",   "box"),
  balloon:  P("./assets/parts/balloon.png",  "circle", { overflow: 0.5 }),  // string hangs below
  bucket:   P("./assets/parts/bucket.png",   "compound"),
  fan:      P("./assets/parts/fan.png",      "box",    { overflow: 0.25 }), // blade tips
  conveyor: P("./assets/parts/conveyor.png", "plank"),
  seesaw:   P("./assets/parts/seesaw.png",   "plank"),
  goal:     P("./assets/parts/goal.png",     "box"),
  // Track B + C entries are added by their tasks (6, 7).
};

const cache = new Map();

export function resolveSprite(partType, themeId) {
  const e = SPRITES[partType];
  if (!e) return null;
  const src = (e.themeOverrides && e.themeOverrides[themeId]) || e.src;
  return { src, fit: e.fit, scale: e.scale, overflow: e.overflow };
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
