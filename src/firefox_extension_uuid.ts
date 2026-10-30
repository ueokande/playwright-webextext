import type { Browser, BrowserContext, BrowserServer } from "playwright";
import { connect } from "./firefox_remote";

type FirefoxTarget = Browser | BrowserContext | BrowserServer;

export const firefoxDebuggingPorts = new WeakMap<FirefoxTarget, number>();

/**
 * Read an installed extension's internal UUID from a running Firefox instance
 * created by withExtension() or createFixture(). This does not enable Playwright
 * to automate moz-extension:// pages.
 */
export async function getFirefoxExtensionUUID(
  target: FirefoxTarget,
  addonId: string,
): Promise<string> {
  const port = firefoxDebuggingPorts.get(target);
  if (port === undefined) {
    throw new Error(
      "Expected a Firefox browser or context created by playwright-webextext",
    );
  }
  const remote = await connect(port);
  try {
    const addon = await remote.getInstalledAddon(addonId);
    if (!addon.manifestURL) {
      throw new Error(
        `Firefox did not expose a manifest URL for extension ${addonId}`,
      );
    }
    const manifest = new URL(addon.manifestURL);
    if (manifest.protocol !== "moz-extension:" || !manifest.hostname) {
      throw new Error(
        `Firefox returned an invalid extension manifest URL for ${addonId}`,
      );
    }
    return manifest.hostname;
  } finally {
    remote.disconnect();
  }
}
