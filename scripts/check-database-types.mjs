#!/usr/bin/env node

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const projectId = process.env.SUPABASE_PROJECT_ID;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectId || !accessToken) {
  console.log("Database type drift check skipped: SUPABASE_PROJECT_ID and SUPABASE_ACCESS_TOKEN are not configured.");
  process.exit(0);
}

const directory = await mkdtemp(join(tmpdir(), "beckett-db-types-"));
const generatedPath = join(directory, "database.types.ts");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

try {
  const result = await run("npx", ["--yes", "supabase@2.113.0", "gen", "types", "typescript", "--project-id", projectId, "--schema", "public"]);
  if (result.code !== 0) throw new Error(result.stderr || result.stdout || `supabase exited with ${result.code}`);
  await writeFile(generatedPath, result.stdout);
  const expected = (await readFile(new URL("../lib/database.types.ts", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const actual = result.stdout.replaceAll("\r\n", "\n");
  if (actual !== expected) {
    console.error("Database types drift detected. Regenerate lib/database.types.ts with npm run db:types.");
    process.exitCode = 1;
  } else {
    console.log("Database types match the linked Supabase schema.");
  }
} catch (error) {
  console.error(`Database type generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
} finally {
  await rm(directory, { recursive: true, force: true });
}
