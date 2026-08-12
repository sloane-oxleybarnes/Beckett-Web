import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Conventional Commit validator accepts policy and rejects legacy subjects", () => {
  const valid = spawnSync(process.execPath, [
    "scripts/validate-conventional-commit.mjs",
    "--message",
    "refactor(auth): consolidate server guards",
  ]);
  const invalid = spawnSync(process.execPath, [
    "scripts/validate-conventional-commit.mjs",
    "--message",
    "Update auth stuff",
  ]);
  assert.equal(valid.status, 0);
  assert.equal(invalid.status, 1);
});

test("web and legacy AI metering use serialized database functions", () => {
  const migration = read("supabase/migrations/20260811220822_atomic_web_ai_credits.sql");
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /create or replace function public\.consume_ai_usage/);
  assert.match(migration, /create or replace function public\.reserve_web_credit/);
  assert.match(migration, /create or replace function public\.commit_web_credit/);
  assert.match(migration, /revoke all on function public\.reserve_web_credit[\s\S]*authenticated/);
});

test("legacy skills redirect and Practice uses the consolidated simulator and contacts", () => {
  assert.match(read("app/dashboard/skills/[id]/page.tsx"), /permanentRedirect/);
  assert.match(read("supabase/migrations/20260811220702_consolidate_contacts.sql"), /drop table public\.trusted_people/);
  assert.match(read("app/dashboard/practice/page.tsx"), /AdaptiveConversationSimulator/);
  assert.doesNotMatch(read("app/api/labs/adaptive-conversation/route.ts"), /from\(['"]trusted_people['"]\)/);
});

test("course content is loaded on the server rather than bundled as client fallback data", () => {
  assert.match(read("app/dashboard/courses/[id]/page.tsx"), /getPublishedCourse/);
  assert.doesNotMatch(read("components/courses/CourseClient.tsx"), /getCourse/);
});

test("the auth proxy only runs for protected dashboard routes", () => {
  assert.match(read("proxy.ts"), /matcher: \['\/dashboard\/:path\*'\]/);
  assert.match(read("proxy.ts"), /auth\.getClaims\(\)/);
});
