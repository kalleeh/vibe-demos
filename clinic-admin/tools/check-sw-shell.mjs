#!/usr/bin/env node
/* clinic-admin — verify sw.js SHELL against the tree.
   1. every SHELL entry exists on disk;
   2. every same-origin file the page loads (index.html <link>/<script>, the ES-module import graph
      under js/, fetch("./data/*.json") calls, manifest + icon) is listed in SHELL.
   Run: node clinic-admin/tools/check-sw-shell.mjs   (exit 1 on any drift) */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sw = readFileSync(join(root, "sw.js"), "utf8");
const shell = [...sw.matchAll(/"(\.\/[^"]+)"/g)].map(m => m[1]).filter(p => p !== "./");
const shellSet = new Set(shell.map(p => p.replace(/^\.\//, "")));

const missingOnDisk = shell.filter(p => !existsSync(join(root, p)));

// Files the page actually loads.
const loaded = new Set(["index.html", "manifest.webmanifest", "icon.svg"]);
const html = readFileSync(join(root, "index.html"), "utf8");
for (const m of html.matchAll(/(?:href|src)="\.\/([^"]+)"/g)) loaded.add(m[1]);
for (const m of html.matchAll(/href="((?!https?:|\.\/|\.\.\/|#)[^"]+\.(?:svg|webmanifest|css|js))"/g)) loaded.add(m[1]);

// ES-module import graph from js/main.js + sw registration.
const seen = new Set();
const walk = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  loaded.add(file);
  const src = readFileSync(join(root, file), "utf8");
  for (const m of src.matchAll(/\bfrom\s+"(\.{1,2}\/[^"]+)"/g)) walk(relative(root, resolve(join(root, dirname(file)), m[1])));
  for (const m of src.matchAll(/\bimport\s+"(\.{1,2}\/[^"]+)"/g)) walk(relative(root, resolve(join(root, dirname(file)), m[1])));
  for (const m of src.matchAll(/loadJSON\(\s*"\.\/([^"]+)"/g)) loaded.add(m[1]);
  for (const m of src.matchAll(/fetch\(\s*"\.\/([^"]+)"/g)) loaded.add(m[1]);
};
walk("js/main.js");

const notInShell = [...loaded].filter(f => !shellSet.has(f));
const notLoaded = [...shellSet].filter(f => !loaded.has(f)); // listed but never referenced — stale entry?

// Any js/** file on disk that is neither loaded nor listed is dead weight — report, do not fail.
const jsFiles = [];
const list = (dir) => { for (const e of readdirSync(dir)) { const p = join(dir, e); statSync(p).isDirectory() ? list(p) : p.endsWith(".js") && jsFiles.push(relative(root, p)); } };
list(join(root, "js"));
const orphans = jsFiles.filter(f => !loaded.has(f));

console.log(`SHELL entries: ${shellSet.size} · files the page loads: ${loaded.size}`);
if (missingOnDisk.length) console.log("MISSING ON DISK:", missingOnDisk);
if (notInShell.length) console.log("LOADED BUT NOT IN SHELL:", notInShell);
if (notLoaded.length) console.log("in SHELL but not referenced by the page:", notLoaded);
if (orphans.length) console.log("js files never imported (orphans):", orphans);
if (missingOnDisk.length || notInShell.length) { process.exitCode = 1; } else console.log("OK — sw.js SHELL matches the tree.");
