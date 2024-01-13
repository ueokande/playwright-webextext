// This is TypeScript version of the following
// https://github.com/mozilla/web-ext/blob/7.1.1/src/firefox/remote.js

import * as net from "node:net";
import FirefoxRDPClient, {
  connectToFirefox as defaultFirefoxConnector,
} from "./firefox_rdpclient";
import type {
  FirefoxRDPAddonActor,
  RDPRequestType,
  RDPResponseMap,
  InstallTemporaryAddonResponse,
} from "./firefox_types";

export function isErrorWithCode(
  codeWanted: string | Array<string>,
  error: any,
): boolean {
  if (Array.isArray(codeWanted) && codeWanted.indexOf(error.code) !== -1) {
    return true;
  } else if (error.code === codeWanted) {
    return true;
  }

  return false;
}

export type FirefoxConnectorFn = (port: number) => Promise<FirefoxRDPClient>;

export type FirefoxRDPResponseError = {
  error: string;
  message: string;
};

// Convert a request rejection to a message string.
function requestErrorToMessage(err: Error | FirefoxRDPResponseError) {
  if (err instanceof Error) {
    return String(err);
  }
  return `${err.error}: ${err.message}`;
}

export class RemoteFirefox {
  client: FirefoxRDPClient;
  checkedForAddonReloading: boolean;

  constructor(client: FirefoxRDPClient) {
    this.client = client;
    this.checkedForAddonReloading = false;
  }

  disconnect() {
    this.client.disconnect();
  }

  async addonRequest<K extends RDPRequestType>(
    addon: FirefoxRDPAddonActor,
    request: K,
  ): Promise<RDPResponseMap[K]> {
    try {
      const response = await this.client.request({
        to: addon.actor,
        type: request,
      });
      return response as RDPResponseMap[K];
    } catch (err: any) {
      const message = requestErrorToMessage(err);
      throw new Error(`Remote Firefox: addonRequest() error: ${message}`);
    }
  }

  async getAddonsActor(): Promise<string> {
    try {
      // getRoot should work since Firefox 55 (bug 1352157).
      const response = await this.client.request("getRoot");
      if (response.addonsActor == null) {
        return Promise.reject(
          new Error(
            "This version of Firefox does not provide an add-ons actor for " +
              "remote installation.",
          ),
        );
      }
      return response.addonsActor;
    } catch (err) {
      // Fallback to listTabs otherwise, Firefox 49 - 77 (bug 1618691).
    }

    try {
      const response = await this.client.request("listTabs");
      // addonsActor was added to listTabs in Firefox 49 (bug 1273183).
      if (response.addonsActor == null) {
        return Promise.reject(
          new Error(
            "This is an older version of Firefox that does not provide an " +
              "add-ons actor for remote installation. Try Firefox 49 or " +
              "higher.",
          ),
        );
      }
      return response.addonsActor;
    } catch (err: any) {
      const message = requestErrorToMessage(err);
      throw new Error(`Remote Firefox: listTabs() error: ${message}`);
    }
  }

  async installTemporaryAddon(
    addonPath: string,
  ): Promise<InstallTemporaryAddonResponse> {
    const addonsActor = await this.getAddonsActor();

    try {
      const response = await this.client.request<"installTemporaryAddon">({
        to: addonsActor,
        type: "installTemporaryAddon",
        addonPath,
      });
      return response;
    } catch (err: any) {
      const message = requestErrorToMessage(err);
      throw new Error(`installTemporaryAddon: Error: ${message}`);
    }
  }

  async getInstalledAddon(addonId: string): Promise<FirefoxRDPAddonActor> {
    try {
      const response = await this.client.request("listAddons");
      for (const addon of response.addons) {
        if (addon.id === addonId) {
          return addon;
        }
      }
      return Promise.reject(
        new Error("The remote Firefox does not have your extension installed"),
      );
    } catch (err: any) {
      const message = requestErrorToMessage(err);
      throw new Error(`Remote Firefox: listAddons() error: ${message}`);
    }
  }

  async checkForAddonReloading(
    addon: FirefoxRDPAddonActor,
  ): Promise<FirefoxRDPAddonActor> {
    if (this.checkedForAddonReloading) {
      // We only need to check once if reload() is supported.
      return addon;
    } else {
      const response = await this.addonRequest(addon, "requestTypes");

      if (response.requestTypes.indexOf("reload") === -1) {
        throw new Error(
          "This Firefox version does not support add-on reloading. " +
            "Re-run with --no-reload",
        );
      } else {
        this.checkedForAddonReloading = true;
        return addon;
      }
    }
  }

  async reloadAddon(addonId: string): Promise<void> {
    const addon = await this.getInstalledAddon(addonId);
    await this.checkForAddonReloading(addon);
    await this.addonRequest(addon, "reload");
  }
}

// Connect types and implementation

export type ConnectOptions = {
  connectToFirefox?: FirefoxConnectorFn;
};

export async function connect(
  port: number,
  { connectToFirefox = defaultFirefoxConnector }: ConnectOptions = {},
): Promise<RemoteFirefox> {
  const client = await connectToFirefox(port);
  return new RemoteFirefox(client);
}

// ConnectWithMaxRetries types and implementation

export type ConnectWithMaxRetriesParams = {
  maxRetries?: number;
  retryInterval?: number;
  port: number;
};

export type ConnectWithMaxRetriesDeps = {
  connectToFirefox?: typeof connect;
};

export async function connectWithMaxRetries(
  // A max of 250 will try connecting for 30 seconds.
  { maxRetries = 250, retryInterval = 120, port }: ConnectWithMaxRetriesParams,
  { connectToFirefox = connect }: ConnectWithMaxRetriesDeps = {},
): Promise<RemoteFirefox> {
  async function establishConnection() {
    let lastError;

    for (let retries = 0; retries <= maxRetries; retries++) {
      try {
        return await connectToFirefox(port);
      } catch (error) {
        if (isErrorWithCode("ECONNREFUSED", error)) {
          // Wait for `retryInterval` ms.
          await new Promise((resolve) => {
            setTimeout(resolve, retryInterval);
          });

          lastError = error;
        } else {
          throw error;
        }
      }
    }
    throw lastError;
  }

  return establishConnection();
}

export function findFreeTcpPort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    // $FlowFixMe: signature for listen() is missing - see https://github.com/facebook/flow/pull/8290
    srv.listen(0, "127.0.0.1", () => {
      const freeTcpPort = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(freeTcpPort));
    });
  });
}
