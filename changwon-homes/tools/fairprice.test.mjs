#!/usr/bin/env node
/* Unit test for the DOM-free scoring functions in ../index.html.
   The page marks the pure block with `==PURE-BEGIN==` / `==PURE-END==` comments; we extract it,
   evaluate it in a bare function scope, and exercise clamp / priceScore / fairPrice.
   Run:  node changwon-homes/tools/fairprice.test.mjs   (exit 0 = pass, no deps) */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");
const m = html.match(/==PURE-BEGIN==[^\n]*\n([\s\S]*?)\/\* ==PURE-END== \*\//);
assert.ok(m, "PURE markers not found in index.html");
// bandFactors (inside the block) references bandPPP only when called — stub it so definition is harmless
const { clamp, priceScore, fairPrice, bandFactors } = new Function(
  "bandPPP", m[1] + "\nreturn { clamp, priceScore, fairPrice, bandFactors };"
)(() => null);

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("clamp bounds default to 0.5..9.8", () => {
  assert.equal(clamp(-4), 0.5); assert.equal(clamp(42), 9.8); assert.equal(clamp(5), 5);
  assert.equal(clamp(11, 0, 10), 10);
});

t("priceScore: cheaper → higher; ±30% saturates; null → neutral 5", () => {
  assert.equal(priceScore(0), 5);
  assert.equal(priceScore(null), 5);
  assert.ok(priceScore(-10) > 5 && priceScore(10) < 5);
  assert.equal(priceScore(-30), 9.5);
  assert.equal(priceScore(30), 0.5);
  assert.equal(priceScore(-100), 9.8);     // clamped
  assert.equal(priceScore(100), 0.5);      // clamped
});

const H = { agePerYear: -0.040, distCorePerKm: -0.073, brand: 0.134, floorLow: -0.036, floorTop: -0.089 };
const peerOf = (h) => ({ h, b: { pyeong: 26 } });
const base = { dcore: 1.0, built: 2016, brand: false, maxFloor: 20 };

t("fairPrice: null without coefficients / peers / baseline", () => {
  const peers = [peerOf(base)];
  assert.equal(fairPrice(base, { avgPPP: 1000, ppp: 1000, peers, b: { floor: 10 } }, null), null);
  assert.equal(fairPrice(base, { avgPPP: 1000, ppp: 1000, peers: [], b: { floor: 10 } }, H), null);
  assert.equal(fairPrice(base, { avgPPP: null, ppp: 1000, peers, b: { floor: 10 } }, H), null);
});

t("fairPrice: identical attributes → predicted = baseline, delta 0, 2-row ledger", () => {
  const f = fairPrice(base, { avgPPP: 1000, ppp: 1000, peers: [peerOf(base)], b: { floor: 10 } }, H);
  assert.ok(Math.abs(f.predPPP - 1000) < 1e-9);
  assert.ok(Math.abs(f.deltaPct) < 1e-9);
  assert.equal(f.ledger.length, 2);
  assert.ok(f.lowPPP < f.predPPP && f.highPPP > f.predPPP);
});

t("fairPrice: 10 years older than peers → lower fair price → same ask reads OVER", () => {
  const h = { ...base, built: 2006 };
  const f = fairPrice(h, { avgPPP: 1000, ppp: 1000, peers: [peerOf(base)], b: { floor: 10 } }, H);
  assert.ok(Math.abs(f.predPPP - 1000 * Math.exp(H.agePerYear * 10)) < 1e-6);
  assert.ok(f.deltaPct > 0);
  assert.ok(f.ledger.some(l => /년식/.test(l.label)));
});

t("fairPrice: brand vs non-brand peers → higher fair price → same ask reads UNDER", () => {
  const h = { ...base, brand: true };
  const f = fairPrice(h, { avgPPP: 1000, ppp: 1000, peers: [peerOf(base)], b: { floor: 10 } }, H);
  assert.ok(Math.abs(f.predPPP - 1000 * Math.exp(H.brand)) < 1e-6);
  assert.ok(f.deltaPct < 0);
});

t("fairPrice: low floor and top floor penalties apply once each", () => {
  const lo = fairPrice(base, { avgPPP: 1000, ppp: 1000, peers: [peerOf(base)], b: { floor: 1 } }, H);
  const top = fairPrice(base, { avgPPP: 1000, ppp: 1000, peers: [peerOf(base)], b: { floor: 20 } }, H);
  assert.ok(Math.abs(lo.predPPP - 1000 * Math.exp(H.floorLow)) < 1e-6);
  assert.ok(Math.abs(top.predPPP - 1000 * Math.exp(H.floorTop)) < 1e-6);
});

t("fairPrice: farther from the 신도시 core than peers → cheaper fair price", () => {
  const h = { ...base, dcore: 3.0 };
  const f = fairPrice(h, { avgPPP: 1000, ppp: 1000, peers: [peerOf(base)], b: { floor: 10 } }, H);
  assert.ok(Math.abs(f.predPPP - 1000 * Math.exp(H.distCorePerKm * 2)) < 1e-6);
});

t("bandFactors is defined (smoke)", () => { assert.equal(typeof bandFactors, "function"); });

console.log(`\n${n} tests passed`);
