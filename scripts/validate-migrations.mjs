#!/usr/bin/env node

import { readdir } from "node:fs/promises";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
const format = /^(\d{8}|\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const modernVersions = new Set();
const problems = [];

for (const file of files) {
  const match = file.match(format);
  if (!match) {
    problems.push(`${file}: expected YYYYMMDDHHMMSS_lowercase_description.sql`);
    continue;
  }

  const version = match[1];
  if (version.length === 8) {
    if (version > "20260722") {
      problems.push(`${file}: new migrations must use a unique 14-digit UTC timestamp`);
    }
    continue;
  }

  if (modernVersions.has(version)) {
    problems.push(`${file}: duplicate migration version ${version}`);
  }
  modernVersions.add(version);
}

if (problems.length > 0) {
  console.error(`Migration validation failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

console.log(`Validated ${files.length} migrations (${modernVersions.size} unique timestamped migrations).`);
