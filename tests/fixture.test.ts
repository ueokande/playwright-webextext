import * as path from "node:path";
import { createFixture } from "../src/fixtures";

const { test, expect } = createFixture([
  path.join(__dirname, "magic-number-extension"),
  path.join(__dirname, "deadbeef-extension"),
]);

test("should installs add-ons with custom fixtures", async ({ page }) => {
  await page.goto("https://example.com/");

  const magicNumber = await page.locator("#magic-number");
  expect(await magicNumber.textContent()).toBe("42");

  const deadbeef = await page.locator("#deadbeef-container");
  expect(await deadbeef.textContent()).toBe("0xDEADBEEF");
});
