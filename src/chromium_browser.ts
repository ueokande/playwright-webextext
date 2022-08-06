import type {
  Browser,
  BrowserContext,
  BrowserType,
  BrowserServer,
  LaunchOptions,
} from "playwright-core";

type LaunchServerOptions = Parameters<BrowserType["launchServer"]>[0];
type LaunchPersistentContextOptions = Parameters<
  BrowserType["launchPersistentContext"]
>[1];

export class ChromiumWithExtensions implements BrowserType {
  constructor(
    private readonly browserType: BrowserType,
    private readonly extensionPath: string
  ) {
    if (browserType.name() !== "chromium") {
      throw new Error(`unexpected browser: ${browserType.name()}`);
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
    const args = this.argsOverride(options.args);
    const browser = await this.browserType.launch({ args, ...options });
    return browser;
  }

  async launchPersistentContext(
    userDataDir: string,
    options: LaunchPersistentContextOptions = {}
  ): Promise<BrowserContext> {
    const args = this.argsOverride(options.args);
    return this.browserType.launchPersistentContext(userDataDir, {
      args,
      ...options,
    });
  }

  async launchServer(
    options: LaunchServerOptions = {}
  ): Promise<BrowserServer> {
    const args = this.argsOverride(options.args);
    const browserServer = await this.browserType.launchServer({
      args,
      ...options,
    });
    return browserServer;
  }

  private argsOverride(args: string[] = []): string[] {
    return [
      `--disable-extensions-except=${this.extensionPath}`,
      `--load-extension=${this.extensionPath}`,
      ...args,
    ];
  }
}
