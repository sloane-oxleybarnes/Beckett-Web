import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("record routes scope dynamic reads and writes to the authenticated owner", async () => {
  const routes = [
    ["app/api/contacts/[id]/route.ts", /eq\(['"]user_id['"],\s*(?:userId|user\.id)\)/g],
    ["app/api/labs/adaptive-conversation/[id]/route.ts", /eq\(['"]user_id['"],\s*(?:session\.user\.id|userId)\)/g],
    ["app/api/meetings/sessions/[id]/route.ts", /eq\(['"]user_id['"],\s*user\.id\)/g],
  ];

  for (const [path, ownershipPattern] of routes) {
    const content = await source(path);
    assert.match(content, ownershipPattern, `${path} must scope dynamic records to the authenticated user`);
  }
});

test("record routes return not-found instead of leaking cross-user records", async () => {
  const contacts = await source("app/api/contacts/[id]/route.ts");
  const simulator = await source("app/api/labs/adaptive-conversation/[id]/route.ts");
  assert.match(contacts, /status:\s*404/);
  assert.match(simulator, /status:\s*404/);
});
