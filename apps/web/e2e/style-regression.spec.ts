import { expect, test } from "@playwright/test";

/**
 * Covers the essentials likely to regress in the Tailwind CSS 3 -> 4 migration.
 * Functional microphone/browser tests are run separately in CI.
 */
test("Tailwind design styles render at mobile and desktop widths", async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const background = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
    // The page root supplies a dark slate background rather than unstyled white.
    expect(background).not.toBe("rgba(0, 0, 0, 0)");

    const brand = await page
      .locator("header")
      .locator("div.bg-brand-600")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(brand).not.toBe("rgba(0, 0, 0, 0)");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    const fontSize = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBe(width >= 768 ? 48 : 36);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
