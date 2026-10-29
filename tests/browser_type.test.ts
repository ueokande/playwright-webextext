import { expect, test } from "@playwright/test";
import { chromium, firefox } from "playwright";
import { withExtension } from "../src";

for (const browserType of [chromium, firefox]) {
  test(`${browserType.name()} delegates browser metadata to the original browser type`, () => {
    const wrapped = withExtension(browserType, []);
    expect(wrapped.name()).toBe(browserType.name());
    expect(wrapped.executablePath()).toBe(browserType.executablePath());
  });
}
