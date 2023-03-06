type FirefoxUserPrefs = { [key: string]: string | number | boolean };
import { DEFAULT_PORT } from "./firefox_rdpclient";

export class FirefoxOverrides {
  constructor(private readonly defaultDebuggingServerPort = DEFAULT_PORT) {}

  debuggingServerPortArgs(args: string[] = []): {
    args: string[];
    port: number;
  } {
    const index = args.findIndex((arg) =>
      arg.includes("start-debugger-server")
    );
    if (index === -1) {
      return {
        args: args.concat(
          "--start-debugger-server",
          String(this.defaultDebuggingServerPort)
        ),
        port: this.defaultDebuggingServerPort,
      };
    }

    const port = parseInt(args[index + 1], 10);
    if (isNaN(port)) {
      throw new Error(`invalid argument: ${args[index]} ${args[index + 1]}`);
    }
    return { args, port };
  }

  userPrefs(prefs: FirefoxUserPrefs = {}): FirefoxUserPrefs {
    const DEVTOOLS_DEBUGGER_REMOTE_ENABLED = "devtools.debugger.remote-enabled";
    const DEVTOOLS_DEBUGGER_PROMPT_CONNECTION =
      "devtools.debugger.prompt-connection";
    const EXTENSIONS_MANIFESTV3_ENABLED = "extensions.manifestV3.enabled";
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

    const manifestV3Enabled = prefs[EXTENSIONS_MANIFESTV3_ENABLED];
    if (typeof manifestV3Enabled === "undefined") {
      newPrefs[EXTENSIONS_MANIFESTV3_ENABLED] = true;
    } else if (manifestV3Enabled !== true) {
      throw new Error(`${EXTENSIONS_MANIFESTV3_ENABLED} must be true`);
    }
    return newPrefs;
  }
}
