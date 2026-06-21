import { OFFICIAL_LEVELS } from "./levels/official.js";
import { Sim } from "./engine.js";
import { drawWorld, resizeCanvas } from "./render.js";
import { tokens, applyTheme, loadTheme, THEMES } from "./theme.js";
import { PARTS, makePart } from "./parts.js";
import { PlacementController } from "./input.js";
import { recordSolve, isSolved } from "./progress.js";
import { init as cloudInit, cloud, user as cloudUser, pushProgress, pullProgress, leaderboard } from "./cloud.js";
import { mountAccountUI, setIndicator } from "./auth-ui.js";
import { preloadSprites } from "./sprites.js";
import { sfx, setMuted, isMuted } from "./sound.js";

// optional self-test
if (new URLSearchParams(location.search).has("test")) {
  import("./level.test.js").then(async m => {
    const cloudMod = await import("./cloud.test.js");
    const spriteMod = await import("./sprites.test.js");
    const editorMod = await import("./editor.test.js");
    const soundMod = await import("./sound.test.js");
    m.runTests([ ...(await m.levelCases()), ...(await m.officialCases()), ...(await m.progressCases()),
                 ...(await m.progressShapeCases()), ...(await cloudMod.cloudCases()), ...(await spriteMod.spriteCases()),
                 ...(await m.trackCCases()), ...(await m.trackCEngineCases()), ...(await editorMod.editorCases()),
                 ...(await soundMod.soundCases()), ...(await m.newPartsCases()), ...(await m.portalCases()) ]);
  });
}

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
let transform, sim, controller, selected = null, remaining = {}, current = null;

// Phase 3: screen router (play, editor, browse)
let editorInstance = null;
const screens = {
  play: { container: document.querySelector(".stagewrap"), palette: document.getElementById("palette"), controls: document.querySelector(".controls") },
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
function buildPalette() {
  recomputeRemaining();
  const pal = document.getElementById("palette");
  pal.innerHTML = "";
  for (const inv of current.inventory) {
    const b = document.createElement("button");
    b.textContent = `${PARTS[inv.type].label} ×${remaining[inv.type]}`;
    b.disabled = remaining[inv.type] <= 0;
    if (inv.type === selected) b.classList.add("sel");
    b.onclick = () => { selected = inv.type; [...pal.children].forEach(c=>c.classList.remove("sel")); b.classList.add("sel"); };
    b.dataset.type = inv.type;
    pal.appendChild(b);
  }
}
function loadLevel(level) {
  current = level;
  document.getElementById("levelTitle").textContent = level.title + (isSolved(level.id) ? " ✓" : "");
  selected = null;
  sim = new Sim(level);
  sim.onEvent = (name) => sfx(name);  // Wire sound events
  if (controller) controller.setSim(sim); else controller = makeController();
  buildPalette();
  document.getElementById("banner").hidden = true;
  resize();
}
function makeController() {
  return new PlacementController(canvas, sim, {
    getTransform: () => transform,
    getSelectedType: () => selected,
    remaining: (t) => remaining[t] ?? 0,
    onPlaced: () => { buildPalette(); sfx("place"); },       // place: refresh counts + sound
    onCountsChanged: () => buildPalette(), // delete: refund counts from sim.placed
    onChange: () => draw(),
  });
}
function resize(){ const r = resizeCanvas(canvas); transform = r.transform; draw(); }
// Compute prefers-reduced-motion ONCE (not per frame); keep it live via a change listener.
let reducedMotion = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ?? false;
if (window.matchMedia) {
  try { window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", e => { reducedMotion = e.matches; }); } catch {}
}
function draw(nowTs){
  drawWorld(ctx, sim, transform, tokens(), {
    ghost: controller && controller.ghost ? ghostVerts(controller.ghost) : null,
    themeId: document.documentElement.dataset.theme,
    now: nowTs ?? performance.now(),
    running: sim && sim.state === "running",
    reducedMotion
  });
}
function ghostVerts(g){ try { const {bodies}=makePart(g.type,{x:g.x,y:g.y}); return { vertices: bodies[0].vertices || [{x:g.x-10,y:g.y-10},{x:g.x+10,y:g.y-10},{x:g.x+10,y:g.y+10},{x:g.x-10,y:g.y+10}], valid:g.valid, partType:g.type, body:bodies[0] }; } catch { return null; } }

let last = 0, raf = 0;
function tick(ts){ const dt = last ? ts-last : 16; last = ts;
  if (sim.state === "running") { const s = sim.step(dt); draw(ts);
    if (s === "won") { onWin(); } else if (s === "lost") { onLost(); } }
  else { draw(ts); }
  raf = requestAnimationFrame(tick);
}
function onWin(){ const banner=document.getElementById("banner"); banner.textContent="Solved! ✓ "+sim.partsUsed()+" parts";
  banner.hidden=false; recordSolve(current.id, sim.partsUsed(), Math.round(sim.elapsed));
  document.getElementById("levelTitle").textContent = current.title + " ✓";
  sfx("win");
  import("./progress.js").then(p => pushProgress(p.getProgress())); }
function onLost(){ const banner=document.getElementById("banner"); banner.textContent="Time's up — Reset and retry"; banner.hidden=false; }

document.getElementById("runBtn").onclick = () => { if (sim.state==="build"){ sim.run(); sfx("run"); document.getElementById("banner").hidden=true; } };
document.getElementById("resetBtn").onclick = () => { sim.reset(); buildPalette(); document.getElementById("banner").hidden=true; draw(); };

function buildMenu(){ const dlg=document.getElementById("levelMenu");
  dlg.innerHTML = `<h3>Levels</h3>` + OFFICIAL_LEVELS.map((l,i)=>`<button data-id="${l.id}">${String(i+1).padStart(2,"0")} · ${l.title} ${isSolved(l.id)?"✓":""}</button>`).join("") + `<button data-close>Close</button>`;
  dlg.querySelectorAll("button").forEach(b=>b.onclick=()=>{ if(b.dataset.close!==undefined){dlg.close();return;} const lvl=OFFICIAL_LEVELS.find(l=>l.id===b.dataset.id); dlg.close(); showScreen("play"); location.hash="#/play/"+lvl.id; });
}
function refreshMenuMarks(){ document.getElementById("levelTitle").textContent = current ? (current.title + (isSolved(current.id) ? " ✓" : "")) : ""; }
document.getElementById("menuBtn").onclick = () => { buildMenu(); document.getElementById("levelMenu").showModal(); };

function showScreen(name) {
  // Hide all screens
  if (screens.editor) screens.editor.hidden = true;
  if (screens.browse) screens.browse.hidden = true;
  if (screens.play.container) screens.play.container.hidden = (name !== "play");
  if (screens.play.palette) screens.play.palette.hidden = (name !== "play");
  if (screens.play.controls) screens.play.controls.hidden = (name !== "play");

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

// Mute button
function updateMuteButton() {
  const btn = document.getElementById("muteBtn");
  btn.textContent = isMuted() ? "🔇" : "🔊";
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
