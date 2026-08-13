#!/usr/bin/env node

const origin = (process.env.PRODUCTION_URL || "https://www.meetbeckett.co").replace(/\/$/, "");
const paths = ["/", "/auth/login", "/api/auth/session"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    const results = await Promise.all(paths.map(async (path) => {
      const response = await fetch(`${origin}${path}`, { redirect: "follow" });
      return { path, status: response.status };
    }));
    const failed = results.filter(({ status }) => status < 200 || status >= 400);
    if (!failed.length) {
      console.log(`Production smoke passed for ${origin}: ${results.map(({ path, status }) => `${path}=${status}`).join(", ")}`);
      process.exit(0);
    }
    console.log(`Attempt ${attempt}: waiting for ${failed.map(({ path, status }) => `${path}=${status}`).join(", ")}`);
  } catch (error) {
    console.log(`Attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await sleep(10_000);
}

console.error(`Production smoke failed after waiting for ${origin}.`);
process.exit(1);
