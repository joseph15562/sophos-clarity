#!/usr/bin/env node
/**
 * Fails CI if any single JS asset exceeds a ceiling (guards accidental pdf/chart regressions).
 * Run after `npm run build`. Tune limits in MAX_BYTES_BY_PATTERN when chunks legitimately grow.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "dist", "assets");

const DEFAULT_MAX = 1_600_000; // ~1.6 MB raw — pdfmake+vfs can be large; tighten over time
const MAX_BYTES_BY_PATTERN = [
  [/vendor-pdfmake/i, 1_200_000],
  [/vfs_fonts/i, 950_000],
  [/Index-/i, 900_000],
];

function maxForFile(name) {
  for (const [re, max] of MAX_BYTES_BY_PATTERN) {
    if (re.test(name)) return max;
  }
  return DEFAULT_MAX;
}

if (!fs.existsSync(assetsDir)) {
  console.error("assert-bundle-budget: dist/assets missing — run npm run build first");
  process.exit(1);
}

const failures = [];
for (const name of fs.readdirSync(assetsDir)) {
  if (!name.endsWith(".js")) continue;
  const p = path.join(assetsDir, name);
  const st = fs.statSync(p);
  const max = maxForFile(name);
  if (st.size > max) {
    failures.push(`${name}: ${st.size} bytes (max ${max})`);
  }
}

if (failures.length) {
  console.error("assert-bundle-budget: limit exceeded:\n", failures.join("\n"));
  process.exit(1);
}
console.log("assert-bundle-budget: ok");
