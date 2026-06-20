#!/usr/bin/env node
// Headless test runner for sound.test.js (Node-safe, no AudioContext)

import { soundCases } from "./sound.test.js";

async function run() {
  console.log("Running sound tests...");
  const cases = await soundCases();
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
  console.log(`\nSound tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
