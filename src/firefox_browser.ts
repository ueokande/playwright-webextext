import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  Browser,
  BrowserContext,
  BrowserServer,
  BrowserType,
  LaunchOptions,
} from "playwright";
import type { WithExtensionOptions } from "./factory";
import { FirefoxAddonInstaller } from "./firefox_addon_installer";
import { FirefoxExtensionPreferenceRepository } from "./firefox_extension_preferences";
import { firefoxDebuggingPorts } from "./firefox_extension_uuid";
import { FirefoxOverrides } from "./firefox_overrides";
import { findFreeTcpPort } from "./firefox_remote";

type LaunchServerOptions = Parameters<BrowserType["launchServer"]>[0];
type LaunchPersistentContextOptions = Parameters<
  BrowserType["launchPersistentContext"]
>[1];

type PortFn = () => number | Promise<number>;
type Port = number | PortFn;

export class FirefoxWithExtension implements BrowserType {
  private readonly addonPaths: string[];
  private readonly defaultPort: Port;

  constructor(
    private readonly browserType: BrowserType,
    addonPaths: string | string[],
    defaultDebuggingServerPort: number | PortFn = findFreeTcpPort,
    private readonly extensionOptions: WithExtensionOptions = {},
  ) {
    if (browserType.name() !== "firefox") {
      throw new Error(`unexpected browser: ${browserType.name()}`);
    }
    this.defaultPort = defaultDebuggingServerPort;

    if (typeof addonPaths === "string") {
      this.addonPaths = [addonPaths];
    } else {
      this.addonPaths = addonPaths;
    }

    this.connectOverCDP = browserType.connectOverCDP.bind(browserType);
    this.connect = browserType.connect.bind(browserType);
    this.executablePath = browserType.executablePath.bind(browserType);
    this.name = browserType.name.bind(browserType);
  }

  connectOverCDP;
  connect;
  executablePath;
  name;

  async launch(options: LaunchOptions = {}): Promise<Browser> {
    if (this.extensionOptions.allowPrivateBrowsing) {
      throw new Error(
        "allowPrivateBrowsing requires launchPersistentContext() with a non-empty userDataDir",
      );
    }
    const overrides = new FirefoxOverrides(await this.getDefaultPort());
    const { args, port } = overrides.debuggingServerPortArgs(options.args);
    const firefoxUserPrefs = overrides.userPrefs(options.firefoxUserPrefs);
    const browser = await this.browserType.launch({
      ...options,
      args,
      firefoxUserPrefs,
    });
    await this.installAddons(port);
    firefoxDebuggingPorts.set(browser, port);
    return browser;
  }

  async launchPersistentContext(
    userDataDir: string,
    options: LaunchPersistentContextOptions = {},
  ): Promise<BrowserContext> {
    const overrides = new FirefoxOverrides(await this.getDefaultPort());
    const { args, port } = overrides.debuggingServerPortArgs(options.args);
    const firefoxUserPrefs = overrides.userPrefs(options.firefoxUserPrefs);

    if (this.extensionOptions.allowPrivateBrowsing) {
      if (!userDataDir) {
        throw new Error(
          "allowPrivateBrowsing requires a non-empty userDataDir",
        );
      }
      await this.allowPrivateBrowsing(userDataDir);
    }

    // patch extension preferences before launch
    await this.overridePermissions(userDataDir);
    if (userDataDir) {
      await this.writeUserPrefs(userDataDir, firefoxUserPrefs);
    }

    const browser = await this.browserType.launchPersistentContext(
      userDataDir,
      {
        ...options,
        args,
        firefoxUserPrefs,
      },
    );
    await this.installAddons(port);
    firefoxDebuggingPorts.set(browser, port);
    return browser;
  }

  async launchServer(
    options: LaunchServerOptions = {},
  ): Promise<BrowserServer> {
    if (this.extensionOptions.allowPrivateBrowsing) {
      throw new Error(
        "allowPrivateBrowsing requires launchPersistentContext() with a non-empty userDataDir",
      );
    }
    const overrides = new FirefoxOverrides(await this.getDefaultPort());
    const { args, port } = overrides.debuggingServerPortArgs(options.args);
    const firefoxUserPrefs = overrides.userPrefs(options.firefoxUserPrefs);
    const browserServer = await this.browserType.launchServer({
      ...options,
      args,
      firefoxUserPrefs,
    });
    await this.installAddons(port);
    firefoxDebuggingPorts.set(browserServer, port);
    return browserServer;
  }

  async installAddons(debuggingServerPort: number): Promise<void> {
    const installer = new FirefoxAddonInstaller(debuggingServerPort);
    await Promise.all(
      this.addonPaths.map(async (path) => {
        await installer.install(path);
      }),
    );
  }

  async overridePermissions(userDataDir: string): Promise<void> {
    const repo = new FirefoxExtensionPreferenceRepository(userDataDir);
    for (const addonPath of this.addonPaths) {
      const manifest = JSON.parse(
        await fs.readFile(path.join(addonPath, "manifest.json"), "utf-8"),
      );
      if (manifest.manifest_version !== 3) {
        continue;
      }
      if (
        (!(manifest.content_scripts instanceof Array) ||
          manifest.content_scripts.length === 0) &&
        !(manifest.optional_permissions instanceof Array) &&
        manifest.optional_permissions.length === 0
      ) {
        continue;
      }

      const addonId = manifest.browser_specific_settings?.gecko?.id;
      if (!addonId) {
        console.warn(
          `Addon ${addonPath} does not have browser_specific_settings.gecko.id, it will not be able to override permissions.`,
        );
        continue;
      }
      await repo.patch((prefs) => {
        for (const contentScript of manifest.content_scripts) {
          const matches = contentScript.matches;
          if (!(matches instanceof Array) || matches.length === 0) {
            continue;
          }
          prefs.addOrigins(addonId, contentScript.matches);
          if (matches.includes("<all_urls>")) {
            prefs.addPermissions(addonId, ["<all_urls>"]);
          }
        }

        prefs.addOrigins(addonId, manifest.content_scripts[0].matches);
        if (manifest.optional_permissions) {
          prefs.addPermissions(addonId, manifest.optional_permissions);
        }
      });
    }
  }

  private async allowPrivateBrowsing(userDataDir: string): Promise<void> {
    const repo = new FirefoxExtensionPreferenceRepository(userDataDir);
    for (const addonPath of this.addonPaths) {
      const manifest = JSON.parse(
        await fs.readFile(path.join(addonPath, "manifest.json"), "utf8"),
      );
      if (manifest.incognito === "not_allowed") {
        throw new Error(
          `Addon ${addonPath} forbids private browsing in its manifest`,
        );
      }
      const addonId = manifest.browser_specific_settings?.gecko?.id;
      if (!addonId) {
        throw new Error(
          `Addon ${addonPath} requires browser_specific_settings.gecko.id for private browsing`,
        );
      }
      await repo.patch((prefs) => {
        prefs.addPermissions(addonId, ["internal:privateBrowsingAllowed"]);
      });
    }
  }

  private async writeUserPrefs(
    userDataDir: string,
    prefs: NonNullable<LaunchOptions["firefoxUserPrefs"]>,
  ): Promise<void> {
    // Older Playwright drivers ignore firefoxUserPrefs for persistent contexts.
    await fs.mkdir(userDataDir, { recursive: true });
    const file = path.join(userDataDir, "user.js");
    const previous = await fs.readFile(file, "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const preserved = previous.replace(
      /\n\/\/ playwright-webextext preferences begin\n[\s\S]*?\n\/\/ playwright-webextext preferences end\n/g,
      "",
    );
    const lines = Object.entries(prefs).map(
      ([key, value]) =>
        `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`,
    );
    await fs.writeFile(
      file,
      `${preserved}\n// playwright-webextext preferences begin\n${lines.join("\n")}\n// playwright-webextext preferences end\n`,
    );
  }

  private async getDefaultPort(): Promise<number> {
    if (typeof this.defaultPort === "function") {
      return await this.defaultPort();
    }
    return this.defaultPort;
  }
}
