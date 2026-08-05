import test from "node:test";
import assert from "node:assert/strict";
import { findAuthUserByEmail } from "../lib/admin-beta-approval.ts";

test("finds an existing Auth account case-insensitively", async () => {
  const admin = {
    async listUsers() {
      return {
        data: { users: [{ email: "Existing@Example.com" }] },
        error: null,
      };
    },
  };

  const user = await findAuthUserByEmail(admin, "existing@example.com");
  assert.equal(user?.email, "Existing@Example.com");
});

test("returns null when no Auth account exists", async () => {
  const admin = {
    async listUsers() {
      return { data: { users: [] }, error: null };
    },
  };

  assert.equal(await findAuthUserByEmail(admin, "new@example.com"), null);
});

test("does not turn an Auth lookup failure into a new-user invitation", async () => {
  const lookupError = new Error("Auth lookup unavailable");
  const admin = {
    async listUsers() {
      return { data: { users: [] }, error: lookupError };
    },
  };

  await assert.rejects(
    findAuthUserByEmail(admin, "existing@example.com"),
    lookupError
  );
});
