import assert from "node:assert/strict";
import test from "node:test";

import { matchesMicrosoftConnection } from "../features/teams/user-linking.ts";

test("Teams linking requires the tenant and Microsoft user ID pair", () => {
  const connection = { external_tenant_id: "tenant-a", external_user_id: "user-a" };
  assert.equal(matchesMicrosoftConnection(connection, "tenant-a", "user-a"), true);
  assert.equal(matchesMicrosoftConnection(connection, "tenant-b", "user-a"), false);
  assert.equal(matchesMicrosoftConnection(connection, "tenant-a", "user-b"), false);
  assert.equal(matchesMicrosoftConnection({ external_tenant_id: null, external_user_id: "user-a" }, "tenant-a", "user-a"), false);
});
