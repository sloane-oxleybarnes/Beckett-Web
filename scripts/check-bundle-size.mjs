#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const staticDirectory = join(process.cwd(), ".next", "static");
const totalBudget = Number(process.env.NEXT_BUNDLE_MAX_BYTES || 15 * 1024 * 1024);
const chunkBudget = Number(process.env.NEXT_BUNDLE_MAX_CHUNK_BYTES || 600 * 1024);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else files.push(path);
  }
  return files;
}

try {
  const files = await filesIn(staticDirectory);
  const sizes = await Promise.all(files.map(async (path) => ({ path, bytes: (await stat(path)).size })));
  const totalBytes = sizes.reduce((total, file) => total + file.bytes, 0);
  const largestJavaScript = sizes
    .filter((file) => file.path.endsWith(".js"))
    .sort((left, right) => right.bytes - left.bytes)[0];
  const failures = [];
  if (totalBytes > totalBudget) failures.push(`static bundle total ${totalBytes} bytes exceeds ${totalBudget}`);
  if (largestJavaScript && largestJavaScript.bytes > chunkBudget) {
    failures.push(`largest JavaScript chunk ${largestJavaScript.bytes} bytes exceeds ${chunkBudget}: ${largestJavaScript.path}`);
  }
  console.log(`Bundle budget: ${(totalBytes / 1024 / 1024).toFixed(2)} MB total; largest JS ${(largestJavaScript?.bytes || 0) / 1024} KB.`);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
} catch (error) {
  console.error(`Could not inspect .next/static: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
