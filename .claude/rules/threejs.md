---
paths:
  - "molecule-journey/**"
  - "live-globe/**"
  - "hangul-particles/**"
---

# Three.js fidelity stack

> Scoped to the demos that import Three.js at runtime. Adding a NEW Three.js demo? Add its folder to the `paths:` glob above. (`starwars-homage/` is NOT here — it ships a pre-rendered MP4 and uses no Three.js.) `hangul-particles/` is a `Points` + custom `ShaderMaterial` piece: only the renderer setup below applies to it — no PBR materials, GLBs, or `paintKenney` involved.

The difference between "looks like clay" and "looks like a real object" is the rendering setup, NOT polygon count. Polycount only matters for silhouettes that visibly facet (spheres, tori, cylinders); flat-shaded boxes don't get more real with more triangles. Get the four-step setup in place before reaching for higher mesh density.

Reference implementation: `molecule-journey/index.html` — env-map setup, `GLTFLoader` integration, `paintKenney()`, and density-tuned hand-modeled scenes end-to-end.

## The setup that does the heavy lifting

```js
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const renderer = new THREE.WebGLRenderer({
  antialias: true, alpha: true, powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// Environment map gives PBR materials something to reflect.
// (No `compileEquirectangularShader()` — it only pre-warms the equirect path
// and is a no-op for `fromScene(RoomEnvironment)`.)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
```

Why each line: `outputColorSpace = SRGBColorSpace` (else PBR colors render linear and wash out); `ACESFilmicToneMapping` (proper highlight rolloff, else bright spots clip to flat white); `setPixelRatio(min(dpr, 3))` (2 is visibly soft on retina); `RoomEnvironment` PMREM (the single biggest win — without an env map, metallic/shiny surfaces read matte gray). Skip the env map entirely when a demo has no PBR materials — `live-globe` and `hangul-particles` are pure `ShaderMaterial`/`PointsMaterial` scenes and dropped PMREM for that reason.

Importmap needs the addons path:

```html
<script type="importmap">
  {
    "imports": {
      "three":          "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/":  "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
</script>
```

## Polygon count rules

- **Hero-scale silhouettes** (the object the camera is on — planet, molecule, storage tank): spheres `64-128` segments, tori `24-96` radial × `96-384` tubular, cylinders `48-96` radial (molecule-journey's tank uses 144).
- **Small props** (pipe fittings, valve handles, distant details) stay at `24-36` — molecule-journey's small cylinders are 36 and read fine. Density that isn't visible is just vertices.
- Flat primitives (`Box`, flat `Plane`) gain nothing from subdivision — don't waste vertices.
- Worked example: `molecule-journey/index.html` density bump (commit 3776015).

## Real CC0 assets — don't hand-model what exists

For ships/kitchens/vehicles/props use Kenney CC0 packs (`https://kenney.nl/assets/`); Quaternius and Khronos glTF samples also work. Always verify CC0 — CC-BY needs an attribution panel and is rarely worth it. Kenney ships only as zips: download once, extract, commit individual GLBs into `<slug>/assets/`, load via `GLTFLoader`, and precache them in the demo's SW SHELL list. Auto-fit each GLB to scene units with `fitGLB(root, { targetSize, anchor: "bottom"|"top", x, y, z })` in `molecule-journey/index.html` (`Box3` → scale by the larger of x/z extent → re-anchor at the given point). Copy that function; ship, stove and pot all go through it.

## Painting Kenney assets — the gotcha

Kenney exports default to `metalness: 0, roughness: 1` with named material slots (`metal`, `metalDark`, `wood`, `glass`, `carpetWhite`). With a bright env map those defaults wash out to flat gray. **Recolor by material name** to match the pipeline — see `paintKenney(root, opts = {})` in `molecule-journey/index.html` for the full tone table (per-slot `metalness`/`roughness`/`envMapIntensity`/`hex`, and setting `m.map.colorSpace = THREE.SRGBColorSpace` on any texture). Per-demo overrides: `opts.override = { metalness, roughness, env, hex? }` applies one tone to every mesh regardless of slot name (used for the stew pot, whose slot names carry no meaning) and `opts.boost` multiplies `envMapIntensity`. The default tone table is still hardcoded inside the function — copy it and edit the `tones` map for a different palette.
