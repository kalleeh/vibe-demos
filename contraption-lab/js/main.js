import { OFFICIAL_LEVELS } from "./levels/official.js";
import { Sim } from "./engine.js";
import { drawWorld, resizeCanvas } from "./render.js";
import { tokens, applyTheme, loadTheme, THEMES } from "./theme.js";
import { PARTS, makePart } from "./parts.js";
import { PlacementController } from "./input.js";
import { recordSolve, isSolved } from "./progress.js";

// optional self-test
if (new URLSearchParams(location.search).has("test")) {
  import("./level.test.js").then(async m => {
    m.runTests([ ...(await m.levelCases()), ...(await m.officialCases()), ...(await m.progressCases()) ]);
  });
}

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
let transform, sim, controller, selected = null, remaining = {}, current = null;

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
    onPlaced: () => buildPalette(),       // place: refresh counts from sim.placed
    onCountsChanged: () => buildPalette(), // delete: refund counts from sim.placed
    onChange: () => draw(),
  });
}
function resize(){ const r = resizeCanvas(canvas); transform = r.transform; draw(); }
function draw(){ drawWorld(ctx, sim, transform, tokens(), { ghost: controller && controller.ghost ? ghostVerts(controller.ghost) : null }); }
function ghostVerts(g){ try { const {bodies}=makePart(g.type,{x:g.x,y:g.y}); return { vertices: bodies[0].vertices || [{x:g.x-10,y:g.y-10},{x:g.x+10,y:g.y-10},{x:g.x+10,y:g.y+10},{x:g.x-10,y:g.y+10}], valid:g.valid }; } catch { return null; } }

let last = 0, raf = 0;
function tick(ts){ const dt = last ? ts-last : 16; last = ts;
  if (sim.state === "running") { const s = sim.step(dt); draw();
    if (s === "won") { onWin(); } else if (s === "lost") { onLost(); } }
  raf = requestAnimationFrame(tick);
}
function onWin(){ const banner=document.getElementById("banner"); banner.textContent="Solved! ✓ "+sim.partsUsed()+" parts";
  banner.hidden=false; recordSolve(current.id, sim.partsUsed(), Math.round(sim.elapsed));
  document.getElementById("levelTitle").textContent = current.title + " ✓"; }
function onLost(){ const banner=document.getElementById("banner"); banner.textContent="Time's up — Reset and retry"; banner.hidden=false; }

document.getElementById("runBtn").onclick = () => { if (sim.state==="build"){ sim.run(); document.getElementById("banner").hidden=true; } };
document.getElementById("resetBtn").onclick = () => { sim.reset(); buildPalette(); document.getElementById("banner").hidden=true; draw(); };

function buildMenu(){ const dlg=document.getElementById("levelMenu");
  dlg.innerHTML = `<h3>Levels</h3>` + OFFICIAL_LEVELS.map((l,i)=>`<button data-id="${l.id}">${String(i+1).padStart(2,"0")} · ${l.title} ${isSolved(l.id)?"✓":""}</button>`).join("") + `<button data-close>Close</button>`;
  dlg.querySelectorAll("button").forEach(b=>b.onclick=()=>{ if(b.dataset.close!==undefined){dlg.close();return;} const lvl=OFFICIAL_LEVELS.find(l=>l.id===b.dataset.id); dlg.close(); location.hash="#/play/"+lvl.id; });
}
document.getElementById("menuBtn").onclick = () => { buildMenu(); document.getElementById("levelMenu").showModal(); };

function route(){ const m = location.hash.match(/#\/play\/(.+)/);
  const lvl = (m && OFFICIAL_LEVELS.find(l=>l.id===m[1])) || OFFICIAL_LEVELS[0];
  loadLevel(lvl); }
window.addEventListener("hashchange", route);
window.addEventListener("resize", resize);

applyTheme(loadTheme()); fillThemeSelect();
new MutationObserver(()=>draw()).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
route();
raf = requestAnimationFrame(tick);

// register SW
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
