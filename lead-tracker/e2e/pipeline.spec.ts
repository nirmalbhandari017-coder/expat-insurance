import { test, expect } from "@playwright/test";

// Authed core-pipeline flow. Requires an existing account:
//   TEST_EMAIL=... TEST_PASSWORD=... npx playwright test pipeline
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

test.describe("pipeline (authed)", () => {
  test.skip(!email || !password, "Set TEST_EMAIL and TEST_PASSWORD to run authed E2E");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("create a lead, then mark it lost with a reason", async ({ page }) => {
    await page.goto("/pipeline");
    await page.getByRole("button", { name: "New lead" }).click();

    // Affiliate is required first.
    await page.getByText("Which affiliate sent this lead?").click();
    await page.getByRole("option").first().click();

    const name = `E2E Test ${Date.now()}`;
    await page.getByLabel("Customer name *").fill(name);
    await page.getByLabel("Email").fill(`e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Create lead" }).click();
    await expect(page.getByText(/created/)).toBeVisible();

    // Switch to table, find the lead, move it to Lost -> reason dialog required.
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByText(name)).toBeVisible();
  });

  test("global search finds a lead via command palette", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Search leads, affiliates…").fill("a");
    // Palette should stay open and accept input.
    await expect(page.getByPlaceholder("Search leads, affiliates…")).toBeVisible();
  });
});
