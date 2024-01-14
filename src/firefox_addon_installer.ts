import * as remote from "./firefox_remote";

type InstallTemporaryAddonResponse = {
  addon: {
    id: string;
  };
};

export class FirefoxAddonInstaller {
  constructor(private readonly debuggingServerPort: number) {}

  async install(path: string): Promise<InstallTemporaryAddonResponse> {
    const client = await remote.connect(this.debuggingServerPort);
    return client.installTemporaryAddon(path);
  }
}
