import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type WithExtensionOptions, withExtension } from "./factory";

export const createFixture = (
  extPaths: string | string[],
  options: WithExtensionOptions = {},
) => {
  const { test: base, expect } =
    require("@playwright/test") as typeof import("@playwright/test");
  const test = base.extend<Record<never, never>>({
    browser: [
      async (
        { playwright, browserName, launchOptions, channel, headless },
        use,
      ) => {
        const browser = await withExtension(
          playwright[browserName],
          extPaths,
          options,
        ).launch({
          ...launchOptions,
          channel: channel ?? launchOptions.channel,
          headless,
        });
        try {
          await use(browser);
        } finally {
          await browser.close();
        }
      },
      { scope: "worker", timeout: 0 },
    ],
    context: [
      async (
        { playwright, browserName, headless, channel, launchOptions },
        use,
      ) => {
        const browserChannel = channel ?? launchOptions.channel;
        if (
          browserName === "chromium" &&
          headless &&
          browserChannel !== "chromium"
        ) {
          throw new Error(
            "Chromium extensions in headless mode require channel: 'chromium'; use headless: false for older Playwright versions",
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
              ...launchOptions,
              channel: browserChannel,
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
