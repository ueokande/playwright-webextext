import { BrowserType } from "playwright";
import { FirefoxWithExtension } from "./firefox_browser";
import { ChromiumWithExtensions } from "./chromium_browser";

export const withExtension = (
  browserType: BrowserType,
  extensionsPath: string
): BrowserType => {
  switch (browserType.name()) {
    case "firefox":
      return new FirefoxWithExtension(browserType, extensionsPath);
    case "chromium":
      return new ChromiumWithExtensions(browserType, extensionsPath);
  }
  throw new Error(`unsupported browser: ${browserType.name()}`);
};
