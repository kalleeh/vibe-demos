// contraption-lab/assets/make-sprite.mjs
// Deterministic sprite processor: trim transparent margins to the alpha bbox,
// downscale so the longest side <= maxpx, write a web-sized transparent PNG.
// Uses the Playwright Chromium canvas (PIL/numpy are not installed). No repo deps.
import fs from "fs";
import path from "path";
import pw from "/tmp/pw/node_modules/playwright/index.js";

const [input, partType, maxArg] = process.argv.slice(2);
if (!input || !partType) { console.error("usage: make-sprite.mjs <input.png> <partType> [maxpx]"); process.exit(2); }
const maxpx = parseInt(maxArg || "256", 10);
const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "parts");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, partType + ".png");

const b64 = fs.readFileSync(input).toString("base64");
const { chromium } = pw;
const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async ({ b64, maxpx }) => {
  const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
  const c0 = document.createElement("canvas"); c0.width = img.width; c0.height = img.height;
  const x0 = c0.getContext("2d"); x0.drawImage(img, 0, 0);
  const d = x0.getImageData(0, 0, c0.width, c0.height).data;
  let minx = c0.width, miny = c0.height, maxx = 0, maxy = 0, any = false;
  for (let y = 0; y < c0.height; y++) for (let x = 0; x < c0.width; x++) {
    if (d[(y * c0.width + x) * 4 + 3] > 16) { any = true; if (x<minx)minx=x; if (x>maxx)maxx=x; if (y<miny)miny=y; if (y>maxy)maxy=y; }
  }
  if (!any) return { empty: true };
  const cw = maxx - minx + 1, ch = maxy - miny + 1;
  const scale = Math.min(1, maxpx / Math.max(cw, ch));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(cw * scale)); c.height = Math.max(1, Math.round(ch * scale));
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high";
  x.drawImage(img, minx, miny, cw, ch, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL("image/png"), w: c.width, h: c.height };
}, { b64, maxpx });
await browser.close();
if (out.empty) { console.error("ERROR: input has no opaque pixels"); process.exit(1); }
fs.writeFileSync(outPath, Buffer.from(out.dataUrl.split(",")[1], "base64"));
console.log(`wrote ${outPath} ${out.w}x${out.h} ${fs.statSync(outPath).size} bytes`);
