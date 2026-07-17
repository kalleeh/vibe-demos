import { OFFICIAL_LEVELS } from "./levels/official.js";
import { Sim } from "./engine.js";
import { drawWorld, resizeCanvas } from "./render.js";
import { tokens, applyTheme, loadTheme, THEMES } from "./theme.js";
import { PARTS, makePart } from "./parts.js";
import { PlacementController } from "./input.js";
import { recordSolve, isSolved, getProgress } from "./progress.js";
import { init as cloudInit, cloud, user as cloudUser, pushProgress, pullProgress, leaderboard } from "./cloud.js";
import { mountAccountUI, setIndicator } from "./auth-ui.js";
import { preloadSprites, resolveSprite } from "./sprites.js";
import { iconSVG, hasIcon } from "./part-icons.js";
import { sfx, setMuted, isMuted } from "./sound.js";
import { Fx, impactIntensity } from "./fx.js";

// optional self-test
if (new URLSearchParams(location.search).has("test")) {
  import("./level.test.js").then(async m => {
    const cloudMod = await import("./cloud.test.js");
    const spriteMod = await import("./sprites.test.js");
    const editorMod = await import("./editor.test.js");
    const soundMod = await import("./sound.test.js");
    const fxMod = await import("./fx.test.js");
    m.runTests([ ...(await m.levelCases()), ...(await m.officialCases()), ...(await m.progressCases()),
                 ...(await m.progressShapeCases()), ...(await cloudMod.cloudCases()), ...(await spriteMod.spriteCases()),
                 ...(await m.trackCCases()), ...(await m.trackCEngineCases()), ...(await editorMod.editorCases()),
                 ...(await soundMod.soundCases()), ...(await fxMod.fxCases()), ...(await m.newPartsCases()), ...(await m.newPartsDCases()),
                 ...(await m.geomRayCases()), ...(await m.buttonGateCases()), ...(await m.portalCases()) ]);
  });
}

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
let transform, sim, controller, selected = null, remaining = {}, current = null;
const fx = new Fx({ reducedMotion: false }); // reducedMotion synced below

// Phase 3: screen router (play, editor, browse)
let editorInstance = null;
const screens = {
  play: { container: document.querySelector(".stagewrap"), dock: document.querySelector(".dock"), objective: document.querySelector(".objective") },
  editor: document.getElementById("editorScreen"),
  browse: document.getElementById("browseScreen"),
};

function fillThemeSelect() {
  const sel = document.getElementById("themeSel");
  sel.innerHTML = THEMES.map(t=>`<option value="${t.id}">${t.label}</option>`).join("");
  sel.value = loadTheme();
  sel.onchange = () => applyTheme(sel.value);
}
// remaining[] is DERIVED from sim.placed — the sim is the single source of truth,
// so placing and deleting parts always keep the palette counts correct (no drift).
function recomputeRemaining() {
  remaining = {};
  current.inventory.forEach(i => remaining[i.type] = i.count);
  sim.placed.forEach(s => { if (s.type in remaining) remaining[s.type]--; });
}
// Inventory tray as thumbnail tiles: each part shows its sprite, label, and a
// remaining-count badge — far more legible (and game-like) than a text button.
// Falls back to a glyph if the sprite art isn't resolvable. Built with safe DOM
// nodes (no innerHTML interpolation of part data).
function buildPalette() {
  recomputeRemaining();
  const pal = document.getElementById("palette");
  pal.innerHTML = "";
  const themeId = document.documentElement.dataset.theme;
  const countEl = document.getElementById("trayCount");
  if (countEl) countEl.textContent = `· ${current.inventory.length} TYPE${current.inventory.length === 1 ? "" : "S"}`;
  for (const inv of current.inventory) {
    const def = PARTS[inv.type];
    const left = remaining[inv.type];
    const b = document.createElement("button");
    b.className = "parttile";
    b.dataset.type = inv.type;
    b.disabled = left <= 0;
    if (inv.type === selected) b.classList.add("sel");
    b.title = def ? def.label : inv.type;
    b.setAttribute("aria-label", `${def ? def.label : inv.type}, ${left} left`);

    const thumb = document.createElement("span");
    thumb.className = "ptthumb";
    // Prefer the hand-shaded gradient SVG icon (code-generated, no user data);
    // fall back to the PNG sprite, then a 2-letter glyph.
    if (hasIcon(inv.type)) {
      thumb.innerHTML = iconSVG(inv.type);
    } else {
      const spr = resolveSprite(inv.type, themeId);
      if (spr && spr.src) {
        const img = document.createElement("img");
        img.src = spr.src; img.alt = ""; img.draggable = false; img.loading = "lazy";
        thumb.appendChild(img);
      } else {
        thumb.textContent = (def ? def.label : inv.type).slice(0, 2);
      }
    }

    const name = document.createElement("span");
    name.className = "ptname";
    name.textContent = def ? def.label : inv.type;

    const badge = document.createElement("span");
    badge.className = "ptbadge";
    badge.textContent = `×${left}`;

    b.append(thumb, name, badge);
    b.onclick = () => { selected = inv.type; [...pal.children].forEach(c=>c.classList.remove("sel")); b.classList.add("sel"); };
    pal.appendChild(b);
  }
}
// Objective bar: level number, what to do, and the parts on hand. Keeps the
// player oriented ("what level am I on, what am I trying to do") without reading code.
function updateObjective(level) {
  const i = OFFICIAL_LEVELS.findIndex(l => l.id === level.id);
  const numEl = document.getElementById("objNum");
  const hintEl = document.getElementById("objHint");
  if (numEl) numEl.textContent = i >= 0 ? String(i + 1).padStart(2, "0") : "★";
  if (hintEl) {
    const parts = (level.inventory || []).map(inv => {
      const def = PARTS[inv.type];
      const label = def ? def.label : inv.type;
      return inv.count > 1 ? `${label}×${inv.count}` : label;
    });
    hintEl.textContent = parts.length
      ? `Place ${parts.join(", ")} → press Run`
      : "Press Run to solve.";
  }
}
// Pure: stars earned for solving `level` in `parts` placed parts. Stars are awarded
// against the level's `par.parts`: ≤par = ★★★, ≤par+2 = ★★☆, solved = ★☆☆. Community
// levels (no par) always read as 1 star solved (parts/time still shown separately).
function starsForParts(level, parts) {
  const par = level.par && typeof level.par.parts === "number" ? level.par.parts : null;
  if (par == null) return 1;
  return parts <= par ? 3 : parts <= par + 2 ? 2 : 1;
}
const starGlyphs = (stars) => "★★★☆☆".slice(3 - stars, 6 - stars);

// Best-stats line + star rating in the controls panel. Pure read from progress.js.
function updateStats(level) {
  const statEl = document.getElementById("bestStat");
  const starEl = document.getElementById("starRating");
  if (!statEl || !starEl) return;
  const rec = getProgress()[level.id];
  if (!rec || !rec.solved) {
    statEl.innerHTML = "No solve yet";
    starEl.textContent = "☆☆☆";
    return;
  }
  const secs = (rec.bestMs / 1000).toFixed(1);
  statEl.innerHTML = `BEST · <b>${rec.bestParts} PART${rec.bestParts === 1 ? "" : "S"}</b> · <b>${secs}s</b>`;
  starEl.textContent = starGlyphs(starsForParts(level, rec.bestParts));
}

function loadLevel(level) {
  current = level;
  document.getElementById("levelTitle").textContent = level.title + (isSolved(level.id) ? " ✓" : "");
  updateObjective(level);
  updateStats(level);
  selected = null;
  sim = new Sim(level);
  sim.onEvent = handleSimEvent;  // drives both sound and visual fx
  fx.clear();
  if (controller) controller.setSim(sim); else controller = makeController();
  buildPalette();
  document.getElementById("banner").hidden = true;
  syncRunButton();
  resize();
}
// RUN/STOP is one button whose icon+label+color reflect sim.state, so it's always
// clear whether the contraption is currently running (fixes: no way to tell/stop).
const RUN_ICON = '<path d="M7 5v14l12-7z"/>';
const STOP_ICON = '<path d="M6 6h12v12H6z"/>';
function syncRunButton() {
  const btn = document.getElementById("runBtn");
  const icon = document.getElementById("runBtnIcon");
  const label = document.getElementById("runBtnLabel");
  if (!btn || !sim) return;
  const running = sim.state === "running";
  btn.classList.toggle("running", running);
  icon.innerHTML = running ? STOP_ICON : RUN_ICON;
  label.textContent = running ? "STOP" : "RUN";
}
// Central sim-event handler: every physics event drives sound AND visual juice.
// fx is render-only, so this never affects the simulation. Particle colors read
// the live theme tokens so juice stays on-palette across all four themes.
function handleSimEvent(name, data = {}) {
  sfx(name);
  const tk = tokens();
  if (name === "bounce") {
    const i = impactIntensity(data.speed || 0);
    if (i <= 0) return;
    fx.addTrauma(0.12 + i * 0.22);
    if (typeof data.x === "number") {
      fx.burst(data.x, data.y, {
        count: 3 + Math.round(i * 9), color: tk.accent || "#fff",
        speed: 120 + i * 260, size: 2 + i * 2, life: 320 + i * 200, spread: Math.PI * 2,
      });
    }
    if (data.idA != null) fx.flash(data.idA, 90 + i * 80);
    if (data.idB != null) fx.flash(data.idB, 90 + i * 80);
  } else if (name === "explode") {
    fx.addTrauma(0.85);
    if (typeof data.x === "number") {
      fx.burst(data.x, data.y, { count: 36, color: tk.accent || "#ff8c42", speed: 460, size: 3.2, life: 620, spread: Math.PI * 2, gravity: 600 });
      fx.burst(data.x, data.y, { count: 18, color: "#ffd166", speed: 300, size: 2.4, life: 460, spread: Math.PI * 2, gravity: 500 });
    }
  } else if (name === "cut") {
    fx.addTrauma(0.18);
    if (typeof data.x === "number") {
      fx.burst(data.x, data.y, { count: 10, color: "#eef3f7", speed: 220, size: 1.8, life: 260, spread: Math.PI * 2, gravity: 300 });
    }
  }
}

function makeController() {
  return new PlacementController(canvas, sim, {
    getTransform: () => transform,
    getSelectedType: () => selected,
    remaining: (t) => remaining[t] ?? 0,
    onPlaced: () => {                                        // place: refresh counts + sound + confirm spark
      buildPalette(); sfx("place");
      const last = sim.placed[sim.placed.length - 1];
      if (last) { const tk = tokens(); fx.burst(last.x, last.y, { count: 7, color: tk.accent || "#fff", speed: 130, size: 2, life: 300, gravity: 200 }); }
    },
    onCountsChanged: () => buildPalette(), // delete: refund counts from sim.placed
    onChange: () => draw(),
  });
}
function resize(){ const r = resizeCanvas(canvas); transform = r.transform; draw(); }
// Compute prefers-reduced-motion ONCE (not per frame); keep it live via a change listener.
let reducedMotion = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ?? false;
fx.setReducedMotion(reducedMotion);
if (window.matchMedia) {
  try { window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", e => { reducedMotion = e.matches; fx.setReducedMotion(reducedMotion); }); } catch {}
}
function draw(nowTs){
  // dwell progress (0..1) toward the in-zone win — drives the goal's brighten/pulse.
  const dwell = sim && sim.state === "running" && current && current.goal
    ? Math.min(1, (sim.dwell || 0) / (current.goal.ms || 500)) : 0;
  // nowTs may be absent or, when draw is used as a .then() callback, a non-number
  // (the promise's resolution value) — coerce to a real timestamp so downstream
  // time-based math (goal pulse, spin) never sees NaN.
  const now = typeof nowTs === "number" ? nowTs : performance.now();
  drawWorld(ctx, sim, transform, tokens(), {
    ghost: controller && controller.ghost ? ghostVerts(controller.ghost) : null,
    themeId: document.documentElement.dataset.theme,
    now,
    running: sim && sim.state === "running",
    reducedMotion, fx, dwell
  });
}
function ghostVerts(g){ try { const {bodies}=makePart(g.type,{x:g.x,y:g.y}); return { vertices: bodies[0].vertices || [{x:g.x-10,y:g.y-10},{x:g.x+10,y:g.y-10},{x:g.x+10,y:g.y+10},{x:g.x-10,y:g.y+10}], valid:g.valid, partType:g.type, body:bodies[0] }; } catch { return null; } }

let last = 0, raf = 0;
function tick(ts){ const dt = last ? ts-last : 16; last = ts;
  fx.update(dt);   // advance shake/particles/flash every frame (build + run)
  // This loop keeps running even while the editor/browse screen is active (only
  // the DOM is hidden), and `sim` isn't created until a level has loaded — guard
  // both so switching screens before any #/play/<id> route never throws.
  if (sim) {
    if (sim.state === "running") { const s = sim.step(dt); draw(ts);
      if (s === "won") { onWin(); } else if (s === "lost") { onLost(); } }
    else { draw(ts); }
  }
  raf = requestAnimationFrame(tick);
}
function showBanner(big, small, lost){
  const banner=document.getElementById("banner");
  banner.innerHTML="";
  const b=document.createElement("div"); b.className="big"+(lost?" lose":""); b.textContent=big;
  const s=document.createElement("div"); s.className="small"; s.textContent=small;
  banner.append(b,s); banner.hidden=false;
}
// The official level immediately after `level` in the arc, or null at the end/for
// community levels (which aren't in OFFICIAL_LEVELS).
function nextOfficialLevel(level) {
  const i = OFFICIAL_LEVELS.findIndex(l => l.id === level.id);
  return i >= 0 && i + 1 < OFFICIAL_LEVELS.length ? OFFICIAL_LEVELS[i + 1] : null;
}
function onWin(){
  const used = sim.partsUsed();
  const ms = Math.round(sim.elapsed);
  recordSolve(current.id, used, ms);
  // Choreographed climax: confetti fountain from the goal + a quick screen flash,
  // then the banner pops in. The emotional peak gets the most juice.
  const tk = tokens();
  const colors = [tk.goal || "#52e0a3", tk.accent || "#ffd166", tk.partFill || "#3a6bb8", "#ffffff"];
  if (current.goal && current.goal.zone) fx.confetti(current.goal.zone.x, current.goal.zone.y, colors);
  fx.addTrauma(0.4);
  flashScreen();

  const stars = starsForParts(current, used);
  const banner = document.getElementById("banner");
  banner.innerHTML = "";
  const big = document.createElement("div"); big.className = "big"; big.textContent = "Solved!";
  const starsEl = document.createElement("div"); starsEl.className = "banner-stars"; starsEl.textContent = starGlyphs(stars);
  const small = document.createElement("div"); small.className = "small";
  small.textContent = `${used} part${used === 1 ? "" : "s"} used · ${(ms / 1000).toFixed(1)}s`;
  banner.append(big, starsEl, small);

  const next = nextOfficialLevel(current);
  if (next) {
    const btn = document.createElement("button");
    btn.className = "bannerNextBtn"; btn.type = "button";
    btn.textContent = `Next: ${next.title} →`;
    btn.onclick = () => { location.hash = "#/play/" + next.id; };
    banner.append(btn);
  } else {
    const done = document.createElement("div"); done.className = "small";
    done.textContent = "That's the last level — tap a level to replay.";
    banner.append(done);
  }
  banner.hidden = false;

  document.getElementById("levelTitle").textContent = current.title + " ✓";
  updateStats(current);
  syncRunButton();
  sfx("win");
  import("./progress.js").then(p => pushProgress(p.getProgress())); }
function onLost(){ fx.addTrauma(0.3); showBanner("Time's up", "Press Reset and try a different setup", true); syncRunButton(); }

// Quick full-screen white flash via a CSS-animated overlay (auto-removed). Honors
// reduced motion by skipping entirely.
function flashScreen(){
  if (reducedMotion) return;
  const el = document.createElement("div");
  el.className = "screenflash";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
  // safety net if animationend never fires
  setTimeout(() => el.remove(), 600);
}

document.getElementById("runBtn").onclick = () => {
  if (sim.state === "build") { sim.run(); sfx("run"); document.getElementById("banner").hidden = true; }
  else if (sim.state === "running") { sim.reset(); buildPalette(); document.getElementById("banner").hidden = true; draw(); }
  syncRunButton();
};
document.getElementById("resetBtn").onclick = () => { sim.reset(); buildPalette(); document.getElementById("banner").hidden=true; draw(); syncRunButton(); };

// Difficulty bands across the 20-level arc (by 1-based level number).
const LEVEL_BANDS = [
  { name: "Basics", from: 1, to: 5 },
  { name: "Mechanics", from: 6, to: 12 },
  { name: "Chains", from: 13, to: 18 },
  { name: "Finale", from: 19, to: 20 },
];
function buildMenu(){ const dlg=document.getElementById("levelMenu");
  const solvedCount = OFFICIAL_LEVELS.filter(l=>isSolved(l.id)).length;
  let html = `<h3>Levels <span style="font-weight:400;font-size:.7em;color:var(--muted)">${solvedCount}/${OFFICIAL_LEVELS.length} solved</span></h3>`;
  for (const band of LEVEL_BANDS) {
    const cells = OFFICIAL_LEVELS
      .map((l,i)=>({l,n:i+1}))
      .filter(({n})=> n>=band.from && n<=band.to);
    if (!cells.length) continue;
    html += `<div class="lvlband">${band.name}</div><div class="lvlgrid">`;
    html += cells.map(({l,n})=>{
      const solved = isSolved(l.id);
      return `<button data-id="${l.id}" class="${solved?"solved":""}"><span class="n">${String(n).padStart(2,"0")}</span><span class="nm"></span>${solved?'<span class="tick">✓</span>':""}</button>`;
    }).join("");
    html += `</div>`;
  }
  html += `<menu><button data-close>Close</button></menu>`;
  dlg.innerHTML = html;
  // Set level names via textContent (defensive — titles are first-party, but keep the habit).
  dlg.querySelectorAll("button[data-id]").forEach(b=>{
    const lvl=OFFICIAL_LEVELS.find(l=>l.id===b.dataset.id);
    b.querySelector(".nm").textContent = lvl.title;
  });
  dlg.querySelectorAll("button").forEach(b=>b.onclick=()=>{ if(b.dataset.close!==undefined){dlg.close();return;} const lvl=OFFICIAL_LEVELS.find(l=>l.id===b.dataset.id); dlg.close(); showScreen("play"); location.hash="#/play/"+lvl.id; });
}
function refreshMenuMarks(){ document.getElementById("levelTitle").textContent = current ? (current.title + (isSolved(current.id) ? " ✓" : "")) : ""; }
document.getElementById("menuBtn").onclick = () => { buildMenu(); document.getElementById("levelMenu").showModal(); };

function showScreen(name) {
  // Hide all screens
  if (screens.editor) screens.editor.hidden = true;
  if (screens.browse) screens.browse.hidden = true;
  if (screens.play.container) screens.play.container.hidden = (name !== "play");
  if (screens.play.dock) screens.play.dock.hidden = (name !== "play");
  if (screens.play.objective) screens.play.objective.hidden = (name !== "play");

  // The community Like button only applies to a community play; hide it on every
  // screen switch — the #/play/community route re-shows it for that level.
  const likeBtn = document.getElementById("communityLikeBtn");
  if (likeBtn) likeBtn.hidden = true;
  // Leaderboards are per-official-level; show the button by default, the community
  // route hides it (community levels have likes, not a parts/time leaderboard).
  const lbBtn = document.getElementById("lbBtn");
  if (lbBtn) lbBtn.hidden = false;

  // Show requested screen
  if (name === "editor" && screens.editor) screens.editor.hidden = false;
  else if (name === "browse" && screens.browse) screens.browse.hidden = false;

  // Unmount editor when leaving it
  if (name !== "editor" && editorInstance && editorInstance.mounted) {
    editorInstance.unmount();
  }
}

async function route() {
  const hash = location.hash || "#/play";

  // #/editor — lazy-load is async; a load failure must not break navigation.
  if (hash === "#/editor") {
    showScreen("editor");
    try {
      if (!editorInstance) {
        const { Editor } = await import("./editor.js");
        const editorCanvas = document.getElementById("editorCanvas");
        editorInstance = new Editor(editorCanvas, {
          onPublished: (id) => { location.hash = `#/play/community/${id}`; }
        });
      }
      if (!editorInstance.mounted) editorInstance.mount();
    } catch { /* editor failed to load — stay on the editor screen, no crash */ }
    return;
  }

  // #/browse or #/browse/<tab> — renderBrowse fetches from PocketBase; guard it.
  const browseMatch = hash.match(/#\/browse(?:\/(.+))?/);
  if (browseMatch) {
    showScreen("browse");
    const tab = browseMatch[1] || "recent";
    try {
      const { renderBrowse } = await import("./browse.js");
      const grid = document.getElementById("browseGrid");
      document.querySelectorAll("[data-tab]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tab);
        btn.onclick = () => { location.hash = `#/browse/${btn.dataset.tab}`; };
      });
      await renderBrowse(grid, tab);
    } catch { /* browse fetch failed (offline/timeout) — renderBrowse shows its own message */ }
    return;
  }

  // #/play/community/<id>
  const communityMatch = hash.match(/#\/play\/community\/(.+)/);
  if (communityMatch) {
    showScreen("play");
    const levelId = communityMatch[1];
    const { getLevel, recordPlay } = await import("./cloud.js");
    const { validateLevel } = await import("./level.js");

    try {
      const rec = await getLevel(levelId);
      if (!rec) {
        document.getElementById("banner").textContent = "Level not found";
        document.getElementById("banner").hidden = false;
        return;
      }

      const validation = validateLevel(rec.data);
      if (!validation.ok) {
        document.getElementById("banner").textContent = "This level needs a newer version of the game";
        document.getElementById("banner").hidden = false;
        return;
      }

      // Load the community level
      loadLevel({
        ...rec.data,
        id: `community-${levelId}`,
        title: rec.title || "Community Level"
      });

      // Record play (best-effort, non-blocking)
      recordPlay(levelId).catch(() => {});

      // Community levels use likes, not a per-level leaderboard — hide the LB button here.
      const lb = document.getElementById("lbBtn");
      if (lb) lb.hidden = true;

      // Show + wire the community Like button for this level
      try {
        const likeBtn = document.getElementById("communityLikeBtn");
        if (likeBtn) {
          likeBtn.hidden = false;
          const { mountLikeButton } = await import("./browse.js");
          mountLikeButton(likeBtn, levelId);
        }
      } catch { /* like is optional — never block play */ }

    } catch (err) {
      document.getElementById("banner").textContent = "Failed to load level";
      document.getElementById("banner").hidden = false;
    }
    return;
  }

  // #/play/<id> or default
  showScreen("play");
  const playMatch = hash.match(/#\/play\/(.+)/);
  const lvl = (playMatch && OFFICIAL_LEVELS.find(l => l.id === playMatch[1])) || OFFICIAL_LEVELS[0];
  loadLevel(lvl);
}
window.addEventListener("hashchange", route);
window.addEventListener("resize", resize);

applyTheme(loadTheme()); fillThemeSelect();

// Mute button — toggles a visual state class (keeps the SVG icon intact).
function updateMuteButton() {
  const btn = document.getElementById("muteBtn");
  const muted = isMuted();
  btn.classList.toggle("muted", muted);
  btn.title = muted ? "Sound off" : "Sound on";
  btn.setAttribute("aria-pressed", muted ? "true" : "false");
}
document.getElementById("muteBtn").onclick = () => {
  setMuted(!isMuted());
  updateMuteButton();
};
updateMuteButton();

new MutationObserver(()=>{ const newTheme = document.documentElement.dataset.theme; preloadSprites(newTheme).then(draw); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
preloadSprites(loadTheme()).then(() => {
  route();
  raf = requestAnimationFrame(tick);
});

// First-run onboarding coach-mark (shown once; dismissal persisted).
(function initCoach(){
  const COACH_KEY = "cl.coachSeen";
  const coach = document.getElementById("coach");
  if (!coach) return;
  let seen = false;
  try { seen = localStorage.getItem(COACH_KEY) === "1"; } catch {}
  const dismiss = () => {
    coach.hidden = true;
    try { localStorage.setItem(COACH_KEY, "1"); } catch {}
  };
  if (!seen) coach.hidden = false;
  document.getElementById("coachDismiss").onclick = dismiss;
  coach.addEventListener("click", (e) => { if (e.target === coach) dismiss(); });
})();

// register SW
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});

// --- Phase 2: optional cloud (never blocks the game) ---
// Every cloud touchpoint is wrapped so a backend failure can never break play.
mountAccountUI({ onAuthChange: async () => {
  try { await pullProgress(); } catch {}
  refreshMenuMarks(); setIndicator();
  // rebuild the level menu if it's open so ✓ marks reflect the new auth state
  if (document.getElementById("levelMenu").open) buildMenu();
} });
cloudInit().then(async () => {
  setIndicator();
  if (cloudUser()) { await pullProgress(); refreshMenuMarks(); }
}).catch(() => {});  // truly non-blocking — game already runs regardless
document.getElementById("lbBtn").onclick = async () => {
  const body = document.getElementById("lbBody");
  body.innerHTML = ""; // safe: we rebuild with textContent below
  const h = document.createElement("h3"); h.textContent = "Leaderboard — " + (current ? current.title : ""); body.appendChild(h);
  if (!cloud.available) { const p=document.createElement("p"); p.className="hint"; p.textContent="Offline — leaderboards need a connection."; body.appendChild(p); }
  else {
    const rows = await leaderboard(current.id);
    if (!rows.length) { const p=document.createElement("p"); p.className="hint"; p.textContent="No solves yet. Be the first!"; body.appendChild(p); }
    else {
      const ol = document.createElement("ol");
      rows.forEach(r => { const li=document.createElement("li");
        li.textContent = `${r.name} — ${r.parts} part${r.parts===1?"":"s"}, ${(r.ms/1000).toFixed(1)}s`;
        if (r.isMe) li.style.fontWeight = "700"; ol.appendChild(li); });
      body.appendChild(ol);
    }
  }
  document.getElementById("lbDlg").showModal();
};
