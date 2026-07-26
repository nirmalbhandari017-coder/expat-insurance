import { test, expect } from "@playwright/test";

// Runs without credentials — verifies the shell + auth guard.
test.describe("smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Expat Lead Tracker" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("unauthenticated user is redirected from a protected route", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page).toHaveURL(/\/login/);
  });
});
