#!/usr/bin/env node
/* clinic-admin — i18n coverage check.
   Collects every key the app can ask for — data-i18n / data-i18n-html / data-i18n-attr in index.html plus every
   literal t("…") / tOr("…") call under js/ — and reports keys missing from js/i18n/ko.js or js/i18n/en.js.
   Also lists EN values that still carry Hangul outside parentheses (glosses are allowed) as a warning.
     node clinic-admin/tools/i18n-extract.mjs            → exit 1 on any missing key
     node clinic-admin/tools/i18n-extract.mjs --emit-ko  → print a JS object literal of the static (index.html)
                                                           keys with their current Korean content, for keys not yet
                                                           in ko.js (paste into ko.js — the HTML is the source of truth)
     node clinic-admin/tools/i18n-extract.mjs --json     → machine-readable summary (used by tools/e2e.mjs) */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EMIT = process.argv.includes("--emit-ko");
const JSON_OUT = process.argv.includes("--json");

/* Dictionaries are split by owner (ko.js · ko.entities.js · ko.claims.js · ko.reporting.js and the en.* twins) and
   merged flat by core/i18n.js. Load every js/i18n/<lang>*.js the same way; a key defined in two files is a drift
   bug (the later import silently wins at runtime) and is reported. */
const dictFiles = (lang) => readdirSync(join(root, "js/i18n")).filter(f => f === `${lang}.js` || (f.startsWith(`${lang}.`) && f.endsWith(".js"))).sort();
async function loadDict(lang) {
  const merged = {}, owner = {}, dupes = [];
  for (const f of dictFiles(lang)) {
    const d = (await import(pathToFileURL(join(root, "js/i18n", f)).href)).default || {};
    for (const [k, v] of Object.entries(d)) { if (k in merged) dupes.push(`${k} (${owner[k]} + ${f})`); merged[k] = v; owner[k] = f; }
  }
  return { dict: merged, dupes, files: dictFiles(lang) };
}
const koL = await loadDict("ko"), enL = await loadDict("en");
const ko = koL.dict, en = enL.dict;
const dupes = [...koL.dupes.map(d => "ko: " + d), ...enL.dupes.map(d => "en: " + d)];

/* ── static keys from index.html (with the current Korean content for --emit-ko) ── */
const html = readFileSync(join(root, "index.html"), "utf8");
const staticKeys = new Map(); // key → { kind, content }
// Match an opening tag carrying data-i18n / data-i18n-html and capture its inner content up to the matching close.
const tagRe = /<([a-zA-Z0-9]+)\b([^>]*?)\sdata-i18n(-html)?="([^"]+)"([^>]*)>/g;
let m;
while ((m = tagRe.exec(html)) !== null) {
  const [, tag, , isHtml, key] = m;
  const start = tagRe.lastIndex;
  const close = `</${tag}>`;
  // innermost match: walk forward counting nested same-name tags
  let depth = 1, i = start;
  const openRe = new RegExp(`<${tag}\\b`, "g"), closeRe = new RegExp(`</${tag}>`, "g");
  while (depth > 0 && i < html.length) {
    openRe.lastIndex = i; closeRe.lastIndex = i;
    const o = openRe.exec(html), c = closeRe.exec(html);
    if (!c) { i = html.length; break; }
    if (o && o.index < c.index) { depth++; i = o.index + 1; } else { depth--; i = c.index + (depth === 0 ? 0 : close.length); }
  }
  const inner = html.slice(start, i);
  const content = isHtml ? inner.replace(/\s+/g, " ").trim() : inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  staticKeys.set(key, { kind: isHtml ? "html" : "text", content });
}
for (const mm of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
  const attrs = mm[1];
  // find the attribute values on the same tag for --emit-ko
  const tagStart = html.lastIndexOf("<", mm.index);
  const tagEnd = html.indexOf(">", mm.index);
  const tag = html.slice(tagStart, tagEnd + 1);
  for (const pair of attrs.split(";")) {
    const idx = pair.indexOf(":"); if (idx < 0) continue;
    const attr = pair.slice(0, idx).trim(), key = pair.slice(idx + 1).trim();
    const v = tag.match(new RegExp(`\\s${attr}="([^"]*)"`));
    if (!staticKeys.has(key)) staticKeys.set(key, { kind: "attr", content: v ? v[1] : "" });
  }
}

/* ── dynamic keys: literal t("…") / tOr("…") calls under js/ ── */
const jsKeys = new Map(); // key → file
const walk = (dir) => { for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".js") && !p.includes("/i18n/")) scan(p); } };
const scan = (file) => {
  const src = readFileSync(file, "utf8");
  for (const mm of src.matchAll(/\bt(?:Or)?\(\s*(["'])([^"'`]+?)\1/g)) if (!jsKeys.has(mm[2])) jsKeys.set(mm[2], relative(root, file));
  // `key: "x.y"` maps used with t(...) are not literal calls — only flag keys that look namespaced when used in t()
};
walk(join(root, "js"));

// A literal that ends in "." is a prefix (`t("board.status." + st)`): require at least one concrete key
// with that prefix in each dictionary instead of the prefix itself.
const isPrefix = (k) => k.endsWith(".");
const hasPrefix = (dict, p) => Object.keys(dict).some(k => k.startsWith(p));
const all = new Set([...staticKeys.keys(), ...jsKeys.keys()]);
const missingKo = [...all].filter(k => isPrefix(k) ? !hasPrefix(ko, k) : ko[k] == null);
const missingEn = [...all].filter(k => isPrefix(k) ? !hasPrefix(en, k) : en[k] == null);
const hangul = /[ㄱ-ㆎ가-힣]/;
const stripParens = (s) => { let prev; do { prev = s; s = s.replace(/\([^()]*\)/g, ""); } while (s !== prev); return s; };
const enWithHangul = Object.entries(en).filter(([, v]) => hangul.test(stripParens(String(v)))).map(([k]) => k);
const perNs = {};
for (const k of Object.keys(en)) { const ns = k.split(".")[0]; perNs[ns] = (perNs[ns] || 0) + 1; }

if (EMIT) {
  const out = [];
  for (const [k, { content }] of staticKeys) if (ko[k] == null) out.push(`  ${JSON.stringify(k)}: ${JSON.stringify(content)},`);
  console.log(out.join("\n"));
  process.exit(0);
}
// Keys present in one language but not the other (the EN set must mirror KO exactly).
// (lifecycle.reg.* is EN-only by design: the Korean registry text lives on the REGISTRY rows in security/lifecycle.js.)
const koOnly = Object.keys(ko).filter(k => !(k in en)), enOnly = Object.keys(en).filter(k => !(k in ko) && !k.startsWith("lifecycle.reg."));
const bad = missingKo.length || missingEn.length || dupes.length || koOnly.length;
if (JSON_OUT) {
  console.log(JSON.stringify({ total: all.size, static: staticKeys.size, dynamic: jsKeys.size, koEntries: Object.keys(ko).length, enEntries: Object.keys(en).length, missingKo, missingEn, dupes, koOnly, enOnly, enWithHangul, perNs, files: { ko: koL.files, en: enL.files } }));
  process.exit(bad ? 1 : 0);
}
console.log(`keys referenced: ${all.size} (static ${staticKeys.size} · dynamic ${jsKeys.size}) · ko ${Object.keys(ko).length} [${koL.files.join(" ")}] · en ${Object.keys(en).length} [${enL.files.join(" ")}]`);
console.log("per namespace (en):", Object.entries(perNs).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · "));
if (missingKo.length) console.log(`MISSING IN ko (${missingKo.length}):`, missingKo.join(", "));
if (missingEn.length) console.log(`MISSING IN en (${missingEn.length}):`, missingEn.join(", "));
if (dupes.length) console.log(`DUPLICATE KEYS across dictionary files (${dupes.length}):`, dupes.join(", "));
if (koOnly.length) console.log(`KO keys without an EN entry (${koOnly.length}):`, koOnly.join(", "));
if (enOnly.length) console.log(`en keys without a KO entry — stale? (${enOnly.length}):`, enOnly.join(", "));
if (enWithHangul.length) console.log(`en values with Hangul outside parentheses (${enWithHangul.length}):`, enWithHangul.join(", "));
if (bad) { process.exitCode = 1; } else console.log("OK — every referenced key exists in both dictionaries, no duplicates across files.");
