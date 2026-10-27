import * as path from "node:path";
import { expect, test } from "@playwright/test";
import { firefox } from "playwright";
import { withExtension } from "../src";

test("should installs add-ons with custom browser type", async () => {
  const browserTypeWithExtension = withExtension(firefox, [
    path.join(__dirname, "magic-number-extension"),
    path.join(__dirname, "deadbeef-extension"),
  ]);
  const browser = await browserTypeWithExtension.launchPersistentContext(
    test.info().outputPath("firefox-profile"),
    { headless: true },
  );
  try {
    const page = await browser.newPage();
    await page.route("https://example.com/", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><body></body></html>",
      }),
    );
    await page.goto("https://example.com/");

    const magicNumber = await page.locator("#magic-number");
    expect(await magicNumber.textContent()).toBe("42");

    const deadbeef = await page.locator("#deadbeef-container");
    expect(await deadbeef.textContent()).toBe("0xDEADBEEF");
  } finally {
    await browser.close();
  }
});
