import * as remote from "./firefox_remote";

export class FirefoxAddonInstaller {
  constructor(private readonly debuggingServerPort: number) {}

  async install(path: string): Promise<void> {
    const client = await remote.connect(this.debuggingServerPort);
    await client.installTemporaryAddon(path);
  }
}
