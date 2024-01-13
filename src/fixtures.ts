import { withExtension } from "./factory";
import { test as base, expect } from "@playwright/test";

export const createFixture = (extPaths: string | string[]) => {
  const test = base.extend<Record<never, never>>({
    browser: [
      async ({ playwright, browserName }, use) => {
        await use(
          await withExtension(playwright[browserName], extPaths).launch(),
        );
      },
      { scope: "worker", timeout: 0 },
    ],
    context: [
      async ({ context, playwright, browserName, headless }, use) => {
        if (browserName === "chromium") {
          if (headless) {
            throw new Error(
              "launching chromium with extensions is only supported in headed browsers",
            );
          }
          const browserType = withExtension(playwright[browserName], extPaths);
          const newContext = await browserType.launchPersistentContext("", {
            headless: false,
          });
          await use(newContext);
          await context.close();
        } else {
          await use(context);
          await context.close();
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
