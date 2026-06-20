// contraption-lab/js/editor.js
// Level editor: build, test, publish community levels.

import { validateLevel, serializeLevel, cloneLevel, buildWorld } from "./level.js";
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
    this.savePending = false;
    this.saveTimer = null;
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

    // Angle slider (only affects fixed parts with angle)
    const angleSlider = document.getElementById("angleSlider");
    if (angleSlider) {
      angleSlider.addEventListener("input", (e) => {
        // TODO: implement angle adjustment for selected fixed part
      });
    }

    // Canvas pointer events for placement
    this.canvas.addEventListener("pointerdown", this._onPointerDown.bind(this));
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

  _addInventoryPart(type) {
    const existing = this.level.inventory.find(i => i.type === type);
    if (existing) {
      existing.count++;
    } else {
      this.level.inventory.push({ type, count: 1 });
    }
    this._scheduleSave();
    this._rebuild();
  }

  _onPointerDown(e) {
    if (this.testState !== "idle") return;

    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 1280;
    const y = (e.clientY - rect.top) / rect.height * 720;

    if (this.tool === "fixed") {
      this.level.fixed.push({ type: this.selectedType, x, y, angle: 0 });
      this._scheduleSave();
      this._rebuild();
    } else if (this.tool === "start") {
      const tag = this.selectedType === "ball" ? "ball" : null;
      this.level.start.push({ type: this.selectedType, x, y, tag });
      this._scheduleSave();
      this._rebuild();
    } else if (this.tool === "goal") {
      // Drag to set goal zone (for now, just set center)
      this.level.goal.zone.x = x;
      this.level.goal.zone.y = y;
      this._scheduleSave();
    }
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

    const result = await publishLevel({ title, data: stripLevel(this.level) });
    if (result.ok) {
      if (this.onPublished) this.onPublished(result.id);
      alert("Published!");
    } else {
      alert("Publish failed: " + result.error);
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
  }
}
