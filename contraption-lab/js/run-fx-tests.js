#!/usr/bin/env node
// Headless test runner for fx.test.js (Node-safe — pure helpers + Fx logic only).

import { fxCases } from "./fx.test.js";

async function run() {
  console.log("Running fx tests...");
  const cases = await fxCases();
  let passed = 0, failed = 0;
  for (const c of cases) {
    try {
      c.fn();
      passed++;
      console.log("✓", c.name);
    } catch (e) {
      failed++;
      console.error("✗", c.name, "—", e.message);
    }
  }
  console.log(`\nFx tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
