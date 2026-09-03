import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const hasCredentials = Boolean(email && password);

async function signIn(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 30_000 });
}

test.describe("authenticated preview coverage", () => {
  test.skip(!hasCredentials, "Set E2E_EMAIL and E2E_PASSWORD for authenticated preview coverage.");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("loads Skills, Contacts, Course, and Practice for an authenticated user", async ({ page }) => {
    await page.goto("/dashboard/skills");
    await expect(page).toHaveURL(/\/dashboard\/skills/);
    await expect(page.getByText("Introducing yourself to a new colleague")).toBeVisible();

    await page.goto("/dashboard/contacts");
    await expect(page).toHaveURL(/\/dashboard\/contacts/);

    await page.goto("/dashboard/courses/asking-for-clarity");
    await expect(page).toHaveURL(/\/dashboard\/courses\/asking-for-clarity/);

    await page.goto("/dashboard/practice");
    await expect(page.getByRole("heading", { name: "Practice a conversation" })).toBeVisible();
  });

  test("creates and owns a real simulator session", async ({ page }) => {
    await page.goto("/dashboard/practice");
    const response = await page.request.post("/api/labs/adaptive-conversation", {
      data: {
        approved: true,
        scenarioType: "general",
        channel: "text",
        difficulty: "realistic",
        person: "my manager",
        situation: "I need to discuss a changing deadline.",
        goal: "Agree on a realistic next step.",
        concern: "I do not want to sound defensive.",
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json() as { session?: { id?: string } };
    expect(body.session?.id).toBeTruthy();

    const sessionId = body.session!.id!;
    const owned = await page.request.get("/api/labs/adaptive-conversation");
    expect(owned.ok()).toBeTruthy();
    expect((await owned.json()).sessions.some((session: { id: string }) => session.id === sessionId)).toBe(true);

    const deleted = await page.request.delete(`/api/labs/adaptive-conversation/${sessionId}`);
    expect(deleted.ok()).toBeTruthy();
  });

  test("privileged record routes reject a foreign contact ID", async ({ page }) => {
    test.skip(!process.env.E2E_FOREIGN_CONTACT_ID, "Set E2E_FOREIGN_CONTACT_ID to run cross-user ownership checks.");
    const response = await page.request.get(`/api/contacts/${process.env.E2E_FOREIGN_CONTACT_ID}`);
    expect(response.status()).toBe(404);
  });
});
