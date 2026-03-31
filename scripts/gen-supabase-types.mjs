#!/usr/bin/env node
/**
 * Regenerates src/integrations/supabase/types.ts via Supabase CLI.
 * Requires SUPABASE_PROJECT_REF or SUPABASE_PROJECT_ID (Dashboard → Settings → General).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "src/integrations/supabase/types.ts");

const projectId = (process.env.SUPABASE_PROJECT_REF || process.env.SUPABASE_PROJECT_ID || "").trim();
if (!projectId) {
  console.error(
    "gen-supabase-types: Set SUPABASE_PROJECT_REF or SUPABASE_PROJECT_ID to your Supabase project ref.",
  );
  console.error('  Example: SUPABASE_PROJECT_REF="your-ref" npm run types:supabase');
  process.exit(1);
}

try {
  const types = execFileSync("supabase", ["gen", "types", "typescript", "--project-id", projectId], {
    cwd: root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  writeFileSync(outPath, types, "utf-8");
  console.error(`Wrote ${outPath}`);
} catch (e) {
  const code = e && typeof e === "object" && "status" in e ? e.status : 1;
  console.error("gen-supabase-types: supabase CLI failed (install CLI and run supabase login if needed).");
  process.exit(typeof code === "number" ? code : 1);
}
