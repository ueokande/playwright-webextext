import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { chromium, firefox } from "playwright";
import { withExtension } from "../src/factory";
import { FirefoxWithExtension } from "../src/firefox_browser";

let directory: string;
test.beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "firefox-private-browsing-"));
});
test.afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function extension(manifest: Record<string, unknown> = {}) {
  const addon = path.join(directory, "addon");
  await mkdir(addon);
  await writeFile(
    path.join(addon, "manifest.json"),
    JSON.stringify({
      manifest_version: 2,
      browser_specific_settings: { gecko: { id: "addon@example.test" } },
      ...manifest,
    }),
  );
  return addon;
}

function browser(addon: string, allowPrivateBrowsing = true) {
  const original = Object.create(firefox);
  original.launchPersistentContext = async () => {
    throw new Error("Launch intercepted");
  };
  return new FirefoxWithExtension(original, addon, 6000, {
    allowPrivateBrowsing,
  });
}

test("grants private access before launch while retaining existing permissions", async () => {
  const addon = await extension();
  const profile = path.join(directory, "profile");
  await mkdir(profile);
  const file = path.join(profile, "extension-preferences.json");
  await writeFile(
    file,
    JSON.stringify({
      "addon@example.test": {
        permissions: ["storage"],
        origins: ["https://example.com/*"],
      },
      "other@example.test": { permissions: ["tabs"], origins: [] },
    }),
  );
  const wrapped = browser(addon);
  for (let i = 0; i < 2; i++) {
    await expect(wrapped.launchPersistentContext(profile)).rejects.toThrow(
      "Launch intercepted",
    );
  }
  expect(JSON.parse(await readFile(file, "utf8"))).toEqual({
    "addon@example.test": {
      permissions: ["storage", "internal:privateBrowsingAllowed"],
      origins: ["https://example.com/*"],
    },
    "other@example.test": { permissions: ["tabs"], origins: [] },
  });
});

test("does not grant private access by default", async () => {
  const profile = path.join(directory, "profile");
  await expect(
    browser(await extension(), false).launchPersistentContext(profile),
  ).rejects.toThrow("Launch intercepted");
  await expect(
    readFile(path.join(profile, "extension-preferences.json")),
  ).rejects.toMatchObject({ code: "ENOENT" });
});

test("requires an explicit Gecko ID", async () => {
  await expect(
    browser(
      await extension({ browser_specific_settings: {} }),
    ).launchPersistentContext(path.join(directory, "profile")),
  ).rejects.toThrow("requires browser_specific_settings.gecko.id");
});

test("respects manifest opt-out", async () => {
  await expect(
    browser(
      await extension({ incognito: "not_allowed" }),
    ).launchPersistentContext(path.join(directory, "profile")),
  ).rejects.toThrow("forbids private browsing");
});

test("requires a persistent non-empty profile", async () => {
  const wrapped = browser(await extension());
  await expect(wrapped.launch()).rejects.toThrow(
    "requires launchPersistentContext()",
  );
  await expect(wrapped.launchServer()).rejects.toThrow(
    "requires launchPersistentContext()",
  );
  await expect(wrapped.launchPersistentContext("")).rejects.toThrow(
    "requires a non-empty userDataDir",
  );
});

test("rejects Firefox private permissions for Chromium", () => {
  expect(() =>
    withExtension(chromium, [], { allowPrivateBrowsing: true }),
  ).toThrow("only supported for Firefox");
});
