import type {
  Browser,
  BrowserContext,
  BrowserType,
  BrowserServer,
  LaunchOptions,
} from "playwright-core";
import { FirefoxOverrides } from "./firefox_overrides";
import { FirefoxAddonInstaller } from "./firefox_addon_installer";

type LaunchServerOptions = Parameters<BrowserType["launchServer"]>[0];
type LaunchPersistentContextOptions = Parameters<
  BrowserType["launchPersistentContext"]
>[1];

export class FirefoxWithExtension implements BrowserType {
  private readonly addonPaths: string[];
  private readonly overrides: FirefoxOverrides;

  constructor(
    private readonly browserType: BrowserType,
    addonPaths: string | string[],
    defaultDebuggingServerPort?: number
  ) {
    if (browserType.name() !== "firefox") {
      throw new Error(`unexpected browser: ${browserType.name()}`);
    }
    this.overrides = new FirefoxOverrides(defaultDebuggingServerPort);

    if (typeof addonPaths === "string") {
      this.addonPaths = [addonPaths];
    } else {
      this.addonPaths = addonPaths;
    }

    this.connectOverCDP = browserType.connectOverCDP;
    this.connect = browserType.connect;
    this.executablePath = browserType.executablePath;
    this.name = browserType.name;
  }

  connectOverCDP;
  connect;
  executablePath;
  name;

  async launch(options: LaunchOptions = {}): Promise<Browser> {
    const { args, port } = this.overrides.debuggingServerPortArgs(options.args);
    const firefoxUserPrefs = this.overrides.userPrefs(options.firefoxUserPrefs);
    const browser = await this.browserType.launch({
      args,
      firefoxUserPrefs,
      ...options,
    });
    await this.installAddons(port);
    return browser;
  }

  async launchPersistentContext(
    userDataDir: string,
    options: LaunchPersistentContextOptions = {}
  ): Promise<BrowserContext> {
    const { args, port } = this.overrides.debuggingServerPortArgs(options.args);
    await this.installAddons(port);
    return this.browserType.launchPersistentContext(userDataDir, {
      args,
      ...options,
    });
  }

  async launchServer(
    options: LaunchServerOptions = {}
  ): Promise<BrowserServer> {
    const { args, port } = this.overrides.debuggingServerPortArgs(options.args);
    const firefoxUserPrefs = this.overrides.userPrefs(options.firefoxUserPrefs);
    const browserServer = await this.browserType.launchServer({
      args,
      firefoxUserPrefs,
      ...options,
    });
    await this.installAddons(port);
    return browserServer;
  }

  async installAddons(debuggingServerPort: number): Promise<void[]> {
    const installer = new FirefoxAddonInstaller(debuggingServerPort);
    return Promise.all(
      this.addonPaths.map(async (path) => {
        await installer.install(path);
      })
    );
  }
}
