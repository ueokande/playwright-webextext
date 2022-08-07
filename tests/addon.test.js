import { chromium, firefox } from "playwright";
import { test, expect } from "@playwright/test";
import * as path from "node:path";
import { withExtension } from "../src";

test("chromium installs extensions", async () => {
  const browserTypeWithExtension = withExtension(
    chromium,
    path.join(__dirname, "magic-number-extension")
  );
  const browser = await browserTypeWithExtension.launchPersistentContext("", {
    headless: false,
  });

  const page = await browser.newPage();
  await page.goto("https://example.com/");

  const magicNumber = await page.locator("#magic-number");
  expect(await magicNumber.textContent()).toBe("42");
});

test("firefox installs add-ons", async () => {
  const browserTypeWithExtension = withExtension(
    firefox,
    path.join(__dirname, "magic-number-extension")
  );
  const browser = await browserTypeWithExtension.launch({ headless: true });

  const page = await browser.newPage();
  await page.goto("https://example.com/");

  const magicNumber = await page.locator("#magic-number");
  expect(await magicNumber.textContent()).toBe("42");
});
