import type { BrowserType } from "playwright";
import { ChromiumWithExtensions } from "./chromium_browser";
import { FirefoxWithExtension } from "./firefox_browser";

export type WithExtensionOptions = {
  /** Allow the specified Firefox extensions to run in private windows. Requires a persistent profile and explicit Gecko IDs. */
  allowPrivateBrowsing?: boolean;
};

export const withExtension = (
  browserType: BrowserType,
  extensionsPaths: string | string[],
  options: WithExtensionOptions = {},
): BrowserType => {
  switch (browserType.name()) {
    case "firefox":
      return new FirefoxWithExtension(
        browserType,
        extensionsPaths,
        undefined,
        options,
      );
    case "chromium":
      if (options.allowPrivateBrowsing) {
        throw new Error("allowPrivateBrowsing is only supported for Firefox");
      }
      return new ChromiumWithExtensions(browserType, extensionsPaths);
  }
  throw new Error(`unsupported browser: ${browserType.name()}`);
};
