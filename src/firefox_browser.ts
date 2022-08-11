import type {
  Browser,
  BrowserContext,
  BrowserType,
  BrowserServer,
  LaunchOptions,
} from "playwright-core";
import * as remote from "./firefox_remote";

type LaunchServerOptions = Parameters<BrowserType["launchServer"]>[0];
type LaunchPersistentContextOptions = Parameters<
  BrowserType["launchPersistentContext"]
>[1];
type FirefoxUserPrefs = { [key: string]: string | number | boolean };

const DEFAULT_DEBUGGING_SERVER_PORT = 6000;

export class FirefoxWithExtension implements BrowserType {
  private readonly addonPaths: string[];

  constructor(
    private readonly browserType: BrowserType,
    addonPaths: string | string[],
    private readonly defaultDebuggingServerPort = DEFAULT_DEBUGGING_SERVER_PORT
  ) {
    if (browserType.name() !== "firefox") {
      throw new Error(`unexpected browser: ${browserType.name()}`);
    }

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
    const { args, port } = this.debuggingServerPortOverride(options.args);
    const firefoxUserPrefs = this.prefsOverride(options.firefoxUserPrefs);
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
    const { args, port } = this.debuggingServerPortOverride(options.args);
    await this.installAddons(port);
    return this.browserType.launchPersistentContext(userDataDir, {
      args,
      ...options,
    });
  }

  async launchServer(
    options: LaunchServerOptions = {}
  ): Promise<BrowserServer> {
    const { args, port } = this.debuggingServerPortOverride(options.args);
    const firefoxUserPrefs = this.prefsOverride(options.firefoxUserPrefs);
    const browserServer = await this.browserType.launchServer({
      args,
      firefoxUserPrefs,
      ...options,
    });
    await this.installAddons(port);
    return browserServer;
  }

  private debuggingServerPortOverride(args: string[] = []): {
    args: string[];
    port: number;
  } {
    const index = args.findIndex((arg) => {
      arg.includes("start-debugger-server");
    });
    if (index === -1) {
      return {
        args: args.concat(
          "--start-debugger-server",
          String(this.defaultDebuggingServerPort)
        ),
        port: this.defaultDebuggingServerPort,
      };
    }

    const port = Number(args[index + 1]);
    if (isNaN(port)) {
      throw new Error(`invalid argument: ${args[index]} ${args[index + 1]}`);
    }
    return { args, port };
  }

  private prefsOverride(prefs: FirefoxUserPrefs = {}): FirefoxUserPrefs {
    const DEVTOOLS_DEBUGGER_REMOTE_ENABLED = "devtools.debugger.remote-enabled";
    const DEVTOOLS_DEBUGGER_PROMPT_CONNECTION =
      "devtools.debugger.prompt-connection";
    const newPrefs = { ...prefs };

    const remoteEnabled = prefs[DEVTOOLS_DEBUGGER_REMOTE_ENABLED];
    if (typeof remoteEnabled === "undefined") {
      newPrefs[DEVTOOLS_DEBUGGER_REMOTE_ENABLED] = true;
    } else if (remoteEnabled !== true) {
      throw new Error(`${DEVTOOLS_DEBUGGER_REMOTE_ENABLED} must be true`);
    }

    const promptConnection = prefs[DEVTOOLS_DEBUGGER_PROMPT_CONNECTION];
    if (typeof promptConnection === "undefined") {
      newPrefs[DEVTOOLS_DEBUGGER_PROMPT_CONNECTION] = false;
    } else if (promptConnection !== false) {
      throw new Error(`${DEVTOOLS_DEBUGGER_PROMPT_CONNECTION} must be false`);
    }
    return newPrefs;
  }

  async installAddons(debuggingServerPort: number): Promise<void[]> {
    return Promise.all(
      this.addonPaths.map(async (path) => {
        const client = await remote.connect(debuggingServerPort);
        await client.installTemporaryAddon(path);
      })
    );
  }
}
