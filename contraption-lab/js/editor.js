// contraption-lab/js/editor.js
// Level editor: build, test, publish community levels.

import { validateLevel, serializeLevel, cloneLevel } from "./level.js";
import { fitTransform, screenToWorld } from "./geom.js";
import { Sim } from "./engine.js";
import { drawWorld, resizeCanvas } from "./render.js";
import { tokens } from "./theme.js";
import { PARTS, PALETTE_TYPES } from "./parts.js";
import { publishLevel } from "./cloud.js";
import { user } from "./cloud.js";

const DRAFT_KEY = "cl.draft";

// Pure helper: can this level be published?
export function canPublish(level, solvedInTest) {
  const val = validateLevel(level);
  return val.ok && solvedInTest === true && Array.isArray(level.inventory) && level.inventory.length > 0;
}

// Pure helper: fresh working level for a new editor session.
export function emptyLevel() {
  return {
    schema: 1,
    world: { w: 1280, h: 720, gravity: 1 },
    goal: { type: "dwell", object: "ball", zone: { x: 1040, y: 560, w: 160, h: 140 }, ms: 500 },
    fixed: [],
    start: [],
    inventory: [],
  };
}

// Pure helper: clone level and strip editor-only fields.
export function stripLevel(level) {
  const c = cloneLevel(level);
  delete c._solvedInTest;
  return c;
}

// Editor controller: manages the level-building UI + test sim + publish flow.
export class Editor {
  constructor(canvas, { onPublished }) {
    this.canvas = canvas;
    this.onPublished = onPublished;
    this.level = null;
    this.tool = "fixed";  // fixed|start|goal|inventory
    this.selectedType = "wall";
    this.sim = null;
    this.testSim = null;  // separate sim for Test mode
    this.testState = null; // "idle"|"running"|"won"|"lost"
    this.mounted = false;
    this.rafId = null;
    this.saveTimer = null;
    this.selectedFixed = null;
    this._dragMode = null;
    this._dragIdx = -1;
    this._movedFar = false;
  }

  mount() {
    // Load draft or start fresh
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        this.level = JSON.parse(saved);
        const v = validateLevel(this.level);
        if (!v.ok) this.level = emptyLevel();
      } catch {
        this.level = emptyLevel();
      }
    } else {
      this.level = emptyLevel();
    }

    this.mounted = true;
    this.sim = new Sim(this.level);
    this.testState = "idle";
    this._wireUI();
    this._startRenderLoop();
  }

  _wireUI() {
    // Tool buttons
    document.querySelectorAll("[data-tool]").forEach(btn => {
      btn.addEventListener("click", () => this.setTool(btn.dataset.tool));
    });

    // Palette for inventory tool
    const palette = document.getElementById("editorPalette") || document.getElementById("palette");
    if (palette) {
      palette.innerHTML = "";
      PALETTE_TYPES.forEach(type => {
        const def = PARTS[type];
        const btn = document.createElement("button");
        btn.className = "partbtn";
        btn.textContent = def.label;
        btn.dataset.type = type;
        btn.addEventListener("click", () => {
          if (this.tool === "inventory") {
            this._addInventoryPart(type);
          } else {
            this.setSelectedType(type);
          }
        });
        palette.appendChild(btn);
      });
    }

    // Test button
    const testBtn = document.getElementById("testBtn");
    if (testBtn) testBtn.addEventListener("click", () => this.test());

    // Publish button
    const publishBtn = document.getElementById("publishBtn");
    if (publishBtn) publishBtn.addEventListener("click", () => {
      const dlg = document.getElementById("publishDlg");
      if (dlg) dlg.showModal();
    });

    // Publish dialog
    const publishDlg = document.getElementById("publishDlg");
    if (publishDlg) {
      const publishForm = publishDlg.querySelector("form");
      if (publishForm) {
        publishForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const titleInput = document.getElementById("publishTitle");
          const title = titleInput ? titleInput.value.trim() : "Untitled";
          await this.publish(title);
          publishDlg.close();
        });
      }
    }

    // Clear button
    const clearBtn = document.getElementById("clearBtn");
    if (clearBtn) clearBtn.addEventListener("click", () => this.clear());

    // Angle slider rotates the currently-selected fixed part (radians).
    const angleSlider = document.getElementById("angleSlider");
    if (angleSlider) {
      angleSlider.addEventListener("input", (e) => {
        if (this.selectedFixed) {
          this.selectedFixed.angle = parseFloat(e.target.value) || 0;
          this._scheduleSave();
          this._rebuild();
        }
      });
    }

    // Canvas pointer events: down to place/select/delete, move to drag goal/part.
    this._down = this._onPointerDown.bind(this);
    this._move = this._onPointerMove.bind(this);
    this._up = this._onPointerUp.bind(this);
    this.canvas.addEventListener("pointerdown", this._down);
    this.canvas.addEventListener("pointermove", this._move);
    this.canvas.addEventListener("pointerup", this._up);
  }

  // proximity hit-test against a placed-spec array; returns index or -1 (80 world-unit radius)
  _nearestIn(arr, x, y) {
    let idx = -1, best = 80 * 80;
    arr.forEach((s, i) => { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < best) { best = d; idx = i; } });
    return idx;
  }

  setTool(mode) {
    this.tool = mode;
    // Update UI active state
    document.querySelectorAll("[data-tool]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tool === mode);
    });
  }

  setSelectedType(type) {
    this.selectedType = type;
  }

  // Any change to the level's structure invalidates a prior Test solve — you must
  // re-solve the edited level before it can be published.
  _markDirty() {
    if (this.level._solvedInTest) { delete this.level._solvedInTest; this._updateTestUI && this._updateTestUI(); }
  }

  _addInventoryPart(type) {
    const existing = this.level.inventory.find(i => i.type === type);
    if (existing) {
      existing.count++;
    } else {
      this.level.inventory.push({ type, count: 1 });
    }
    this._markDirty();
    this._scheduleSave();
    this._rebuild();
  }

  // Map a pointer event to world coords using the SAME letterbox transform the renderer
  // uses (canvas.width/height are dpr-scaled backing pixels), matching input.js in play mode.
  _evXY(e) {
    const r = this.canvas.getBoundingClientRect();
    const t = fitTransform(1280, 720, this.canvas.width, this.canvas.height);
    return screenToWorld((e.clientX - r.left) * this.canvas.width / r.width,
                         (e.clientY - r.top) * this.canvas.height / r.height, t);
  }

  _onPointerDown(e) {
    if (this.testState !== "idle") return;
    const { x, y } = this._evXY(e);
    this._dragMode = null;

    if (this.tool === "goal") {
      // Begin dragging the goal-zone center.
      this._dragMode = "goal";
      this.level.goal.zone.x = x; this.level.goal.zone.y = y;
      this._markDirty(); this._scheduleSave();
      return;
    }

    if (this.tool === "fixed") {
      // tap an existing fixed part → select it (for the angle slider) and start dragging;
      // a quick tap with no move deletes it on pointerup. tap empty → place.
      const hit = this._nearestIn(this.level.fixed, x, y);
      if (hit >= 0) { this.selectedFixed = this.level.fixed[hit]; this._dragMode = "movefixed"; this._dragIdx = hit; this._movedFar = false; this._reflectAngle(); return; }
      const spec = { type: this.selectedType, x, y, angle: 0 };
      this.level.fixed.push(spec); this.selectedFixed = spec; this._reflectAngle();
      this._markDirty(); this._scheduleSave(); this._rebuild();
      return;
    }

    if (this.tool === "start") {
      const hit = this._nearestIn(this.level.start, x, y);
      if (hit >= 0) { this._dragMode = "movestart"; this._dragIdx = hit; this._movedFar = false; return; }
      const tag = this.selectedType === "ball" ? "ball" : null;
      this.level.start.push({ type: this.selectedType, x, y, tag });
      this._markDirty(); this._scheduleSave(); this._rebuild();
    }
  }

  _onPointerMove(e) {
    if (!this._dragMode || this.testState !== "idle") return;
    const { x, y } = this._evXY(e);
    if (this._dragMode === "goal") { this.level.goal.zone.x = x; this.level.goal.zone.y = y; }
    else if (this._dragMode === "movefixed") { const s = this.level.fixed[this._dragIdx]; if (s) { s.x = x; s.y = y; this._movedFar = true; this._markDirty(); this._rebuild(); } }
    else if (this._dragMode === "movestart") { const s = this.level.start[this._dragIdx]; if (s) { s.x = x; s.y = y; this._movedFar = true; this._markDirty(); this._rebuild(); } }
  }

  _onPointerUp(e) {
    if (!this._dragMode) return;
    // A fixed/start part tapped without dragging = delete it.
    if (!this._movedFar && (this._dragMode === "movefixed" || this._dragMode === "movestart")) {
      const arr = this._dragMode === "movefixed" ? this.level.fixed : this.level.start;
      if (this._dragIdx >= 0 && this._dragIdx < arr.length) {   // bounds-guard the splice
        arr.splice(this._dragIdx, 1);
        if (this._dragMode === "movefixed") this.selectedFixed = null;
        this._markDirty(); this._rebuild();
      }
    }
    this._scheduleSave();
    this._dragMode = null;
  }

  // sync the angle slider position to the selected fixed part
  _reflectAngle() {
    const slider = document.getElementById("angleSlider");
    if (slider && this.selectedFixed) slider.value = this.selectedFixed.angle || 0;
  }

  _rebuild() {
    if (this.testState === "idle") {
      this.sim = new Sim(this.level);
    }
  }

  _scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, serializeLevel(this.level));
    }, 500);
  }

  test() {
    const v = validateLevel(this.level);
    if (!v.ok) {
      alert("Level invalid: " + v.reason);
      return;
    }

    if (this.testState === "idle") {
      // Start test
      this.testSim = new Sim(this.level);
      this.testSim.run();
      this.testState = "running";
      this._updateTestUI();
    } else if (this.testState === "running") {
      // Reset test
      this.testSim = null;
      this.testState = "idle";
      this._updateTestUI();
    } else {
      // Reset from won/lost
      this.testSim = null;
      this.testState = "idle";
      this._updateTestUI();
    }
  }

  _updateTestUI() {
    const testBtn = document.getElementById("testBtn");
    if (!testBtn) return;
    if (this.testState === "idle") {
      testBtn.textContent = "▶ Test";
    } else if (this.testState === "running") {
      testBtn.textContent = "↺ Reset";
    } else if (this.testState === "won") {
      testBtn.textContent = "✓ Solved!";
      this.level._solvedInTest = true;
      this._scheduleSave();
    } else if (this.testState === "lost") {
      testBtn.textContent = "✗ Failed";
    }
  }

  async publish(title) {
    const u = user();
    if (!u) {
      alert("Sign in to publish");
      return;
    }

    if (!canPublish(this.level, this.level._solvedInTest)) {
      alert("Cannot publish: level must be valid, solved in test, and have inventory");
      return;
    }

    try {
      const result = await publishLevel({ title, data: stripLevel(this.level) });
      if (result.ok) {
        if (this.onPublished) this.onPublished(result.id);
        alert("Published!");
      } else {
        alert("Publish failed: " + result.error);
      }
    } catch (err) {
      // local-first: a publish failure must never break the editor
      alert("Publish failed: " + (err && err.message ? err.message : "connection error"));
    }
  }

  clear() {
    if (confirm("Clear the current level and start fresh?")) {
      this.level = emptyLevel();
      this.testState = "idle";
      this.testSim = null;
      this._scheduleSave();
      this._rebuild();
    }
  }

  _startRenderLoop() {
    const loop = () => {
      if (!this.mounted) return;

      const { transform } = resizeCanvas(this.canvas);
      const ctx = this.canvas.getContext("2d");
      const theme = tokens(document.documentElement.dataset.theme);

      if (this.testState === "running" && this.testSim) {
        this.testSim.step(16);
        const state = this.testSim.state;
        if (state === "won") {
          this.testState = "won";
          this._updateTestUI();
        } else if (state === "lost") {
          this.testState = "lost";
          this._updateTestUI();
        }
        drawWorld(ctx, this.testSim, transform, theme);
      } else {
        drawWorld(ctx, this.sim, transform, theme);
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  unmount() {
    this.mounted = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this._down) {
      this.canvas.removeEventListener("pointerdown", this._down);
      this.canvas.removeEventListener("pointermove", this._move);
      this.canvas.removeEventListener("pointerup", this._up);
    }
  }
}
