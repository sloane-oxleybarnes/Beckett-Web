import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("../supabase/migrations/20260811220822_atomic_web_ai_credits.sql", import.meta.url), "utf8");

test("credit limits serialize concurrent requests before counting and inserting", () => {
  for (const functionName of ["consume_ai_usage", "reserve_web_credit", "ensure_web_course_access"]) {
    const start = sql.indexOf(`function public.${functionName}`);
    assert.notEqual(start, -1, `missing ${functionName}`);
    const body = sql.slice(start, sql.indexOf("$$;", start));
    assert.match(body, /pg_advisory_xact_lock/);
  }
});

test("credit reservations are private, idempotent, and committed under a row lock", () => {
  assert.match(sql, /unique \(user_id, request_id\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.web_credit_reservations from public, anon, authenticated/);
  const commit = sql.slice(sql.indexOf("function public.commit_web_credit"));
  assert.match(commit, /for update/);
  assert.match(commit, /insert into public\.web_credit_events/);
});
