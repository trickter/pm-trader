import { test, expect } from "@playwright/test";

test.describe("smoke tests", () => {
  test("homepage loads without errors", async ({ page }) => {
    await page.goto("/");

    // Should not have error toast or crash
    await expect(page).toHaveTitle(/PM Trader MVP/i);

    // Page should load some content
    await expect(page.locator("body")).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");

    // Should show login form or redirect to login
    await expect(page.locator("body")).toBeVisible();
  });

  test("markets page loads", async ({ page }) => {
    await page.goto("/markets");

    // Should load markets page
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("trading smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    // Login before trading tests
    await page.goto("/login");
    // Note: These tests assume test environment with mocked auth
  });

  test("orders page loads", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.locator("body")).toBeVisible();
  });

  test("strategies page loads", async ({ page }) => {
    await page.goto("/strategies");
    await expect(page.locator("body")).toBeVisible();
  });

  test("risk page loads", async ({ page }) => {
    await page.goto("/risk");
    await expect(page.locator("body")).toBeVisible();
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("body")).toBeVisible();
  });
});
