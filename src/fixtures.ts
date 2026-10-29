import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, expect } from "@playwright/test";
import { type WithExtensionOptions, withExtension } from "./factory";

export const createFixture = (
  extPaths: string | string[],
  options: WithExtensionOptions = {},
) => {
  const test = base.extend<Record<never, never>>({
    browser: [
      async ({ playwright, browserName }, use) => {
        const browser = await withExtension(
          playwright[browserName],
          extPaths,
          options,
        ).launch();
        try {
          await use(browser);
        } finally {
          await browser.close();
        }
      },
      { scope: "worker", timeout: 0 },
    ],
    context: [
      async ({ playwright, browserName, headless }, use) => {
        if (browserName === "chromium" && headless) {
          throw new Error(
            "launching chromium with extensions is only supported in headed browsers",
          );
        }
        const userDataDir = await mkdtemp(
          join(tmpdir(), "playwright-webextext-"),
        );
        try {
          const browserType = withExtension(
            playwright[browserName],
            extPaths,
            options,
          );
          // Firefox MV3 content-script permissions must be written before launch.
          const context = await browserType.launchPersistentContext(
            userDataDir,
            {
              headless,
            },
          );
          try {
            await use(context);
          } finally {
            await context.close();
          }
        } finally {
          await rm(userDataDir, { recursive: true, force: true });
        }
      },
      { scope: "test" },
    ],
  });
  return {
    test,
    expect,
  };
};
