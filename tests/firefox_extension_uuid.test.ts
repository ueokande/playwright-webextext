import { once } from "node:events";
import { type AddressInfo, createServer } from "node:net";
import { expect, test } from "@playwright/test";
import type { BrowserContext } from "playwright";
import {
  firefoxDebuggingPorts,
  getFirefoxExtensionUUID,
} from "../src/firefox_extension_uuid";

const uuid = "2975768f-5c9f-4941-86e9-c53dfb667d84";
for (const example of [
  {
    name: "installed extension",
    manifestURL: `moz-extension://${uuid}/manifest.json`,
    expected: uuid,
  },
  {
    name: "missing manifest URL",
    manifestURL: undefined,
    error: "did not expose a manifest URL",
  },
  {
    name: "non-extension URL",
    manifestURL: "https://example.com/manifest.json",
    error: "invalid extension manifest URL",
  },
  {
    name: "unknown add-on",
    manifestURL: `moz-extension://${uuid}/manifest.json`,
    addonId: "unknown@example.test",
    error: "does not have your extension installed",
  },
]) {
  test(`UUID lookup handles ${example.name} and closes its RDP connection`, async () => {
    let received = "";
    let disconnected: Promise<unknown> | undefined;
    const server = createServer((socket) => {
      disconnected = once(socket, "close");
      const send = (value: unknown) => {
        const data = JSON.stringify(value);
        socket.write(`${Buffer.byteLength(data)}:${data}`);
      };
      send({ from: "root" });
      socket.once("data", (data) => {
        received = data.toString();
        send({
          from: "root",
          addons: [
            {
              id: "different@example.test",
              manifestURL: "moz-extension://other/manifest.json",
            },
            { id: "addon@example.test", manifestURL: example.manifestURL },
          ],
        });
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const target = {} as BrowserContext;
    firefoxDebuggingPorts.set(target, (server.address() as AddressInfo).port);
    try {
      const lookup = getFirefoxExtensionUUID(
        target,
        example.addonId ?? "addon@example.test",
      );
      if (example.error) {
        await expect(lookup).rejects.toThrow(example.error);
      } else {
        expect(await lookup).toBe(example.expected);
      }
      expect(received).toContain('"type":"listAddons"');
      await disconnected;
    } finally {
      server.close();
      await once(server, "close");
    }
  });
}

test("UUID lookup rejects instances not created by the Firefox wrapper", async () => {
  await expect(
    getFirefoxExtensionUUID({} as BrowserContext, "addon@example.test"),
  ).rejects.toThrow("Expected a Firefox");
});
