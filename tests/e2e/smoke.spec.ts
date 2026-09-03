import { expect, test } from "@playwright/test";

test("public homepage and login entry point render", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText("Beckett");

  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator("body")).toContainText(/sign in|log in/i);
});

test("protected Practice and Skills routes redirect anonymous users", async ({ page }) => {
  await page.goto("/dashboard/practice");
  await expect(page).toHaveURL(/\/auth\/login/);

  await page.goto("/dashboard/skills");
  await expect(page).toHaveURL(/\/auth\/login/);
});
