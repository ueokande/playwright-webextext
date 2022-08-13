import type {
  Browser,
  BrowserContext,
  BrowserType,
  BrowserServer,
  LaunchOptions,
} from "playwright-core";
import { FirefoxOverrides } from "./firefox_overrides";
import { FirefoxAddonInstaller } from "./firefox_addon_installer";
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
    defaultDebuggingServerPort: number | PortFn = findFreeTcpPort
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
    const overrides = new FirefoxOverrides(await this.getDefaultPort());
    const { args, port } = overrides.debuggingServerPortArgs(options.args);
    const firefoxUserPrefs = overrides.userPrefs(options.firefoxUserPrefs);
    const browser = await this.browserType.launch({
      ...options,
      args,
      firefoxUserPrefs,
    });
    await this.installAddons(port);
    return browser;
  }

  async launchPersistentContext(
    userDataDir: string,
    options: LaunchPersistentContextOptions = {}
  ): Promise<BrowserContext> {
    const overrides = new FirefoxOverrides(await this.getDefaultPort());
    const { args, port } = overrides.debuggingServerPortArgs(options.args);
    await this.installAddons(port);
    return this.browserType.launchPersistentContext(userDataDir, {
      ...options,
      args,
    });
  }

  async launchServer(
    options: LaunchServerOptions = {}
  ): Promise<BrowserServer> {
    const overrides = new FirefoxOverrides(await this.getDefaultPort());
    const { args, port } = overrides.debuggingServerPortArgs(options.args);
    const firefoxUserPrefs = overrides.userPrefs(options.firefoxUserPrefs);
    const browserServer = await this.browserType.launchServer({
      ...options,
      args,
      firefoxUserPrefs,
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

  private async getDefaultPort(): Promise<number> {
    if (typeof this.defaultPort === "function") {
      return await this.defaultPort();
    }
    return this.defaultPort;
  }
}
