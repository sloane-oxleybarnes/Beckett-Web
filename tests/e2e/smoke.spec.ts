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

test("public Slack installation journey is guest-first and warns before OAuth", async ({ page }) => {
  await page.goto("/slack");
  await expect(page.getByRole("heading", { name: /Communication coaching/ })).toBeVisible();
  await expect(page.getByText("No Beckett account required", { exact: false })).toBeVisible();
  await expect(page.getByText("App is not approved by Slack", { exact: false }).first()).toBeVisible();

  await page.getByRole("link", { name: "Install Beckett for Slack" }).first().click();
  await expect(page).toHaveURL(/\/slack\/install$/);
  await expect(page.getByRole("heading", { name: "Install Beckett for Slack" })).toBeVisible();
  await expect(page.getByText("Final review before Slack")).toBeVisible();
  await expect(page.getByText("App is not approved by Slack", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to Slack" })).toHaveAttribute("href", "/api/slack/install");
});
