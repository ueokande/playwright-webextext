import type {
  Browser,
  BrowserContext,
  BrowserType,
  BrowserServer,
  LaunchOptions,
} from "playwright-core";
import { ChromiumOverrides } from "./chromium_overrides";

type LaunchServerOptions = Parameters<BrowserType["launchServer"]>[0];
type LaunchPersistentContextOptions = Parameters<
  BrowserType["launchPersistentContext"]
>[1];

export class ChromiumWithExtensions implements BrowserType {
  private readonly overrides: ChromiumOverrides;

  constructor(
    private readonly browserType: BrowserType,
    extPaths: string | string[],
  ) {
    if (browserType.name() !== "chromium") {
      throw new Error(`unexpected browser: ${browserType.name()}`);
    }
    this.overrides = new ChromiumOverrides(extPaths);

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
    const args = this.overrides.args(options.args);
    const browser = await this.browserType.launch({ ...options, args });
    return browser;
  }

  async launchPersistentContext(
    userDataDir: string,
    options: LaunchPersistentContextOptions = {},
  ): Promise<BrowserContext> {
    const args = this.overrides.args(options.args);
    return this.browserType.launchPersistentContext(userDataDir, {
      ...options,
      args,
    });
  }

  async launchServer(
    options: LaunchServerOptions = {},
  ): Promise<BrowserServer> {
    const args = this.overrides.args(options.args);
    const browserServer = await this.browserType.launchServer({
      ...options,
      args,
    });
    return browserServer;
  }
}
