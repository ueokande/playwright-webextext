import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { firefox } from "playwright";
import { FirefoxWithExtension } from "../src/firefox_browser";

let directory: string;
test.beforeEach(async () => {
  directory = await mkdtemp(
    path.join(tmpdir(), "firefox-manifest-permissions-"),
  );
});
test.afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function approve(manifest: Record<string, unknown>) {
  const addon = path.join(directory, "addon");
  await mkdir(addon);
  await writeFile(
    path.join(addon, "manifest.json"),
    JSON.stringify({
      manifest_version: 3,
      browser_specific_settings: { gecko: { id: "addon@example.test" } },
      ...manifest,
    }),
  );
  const profile = path.join(directory, "profile");
  const browser = new FirefoxWithExtension(firefox, addon);
  await browser.overridePermissions(profile);
  return profile;
}

for (const manifest of [
  {},
  { content_scripts: [], optional_permissions: [] },
]) {
  test(`accepts an MV3 manifest without permission requests: ${JSON.stringify(manifest)}`, async () => {
    const profile = await approve(manifest);
    await expect(
      readFile(path.join(profile, "extension-preferences.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
}

test("approves host and optional permissions without content scripts", async () => {
  const profile = await approve({
    host_permissions: ["https://example.com/*"],
    optional_host_permissions: ["https://optional.example/*"],
    optional_permissions: ["storage"],
  });
  expect(
    JSON.parse(
      await readFile(path.join(profile, "extension-preferences.json"), "utf8"),
    ),
  ).toEqual({
    "addon@example.test": {
      origins: ["https://example.com/*", "https://optional.example/*"],
      permissions: ["storage"],
    },
  });
});

test("merges every content-script match and preserves existing grants", async () => {
  const profile = path.join(directory, "profile");
  await mkdir(profile);
  await writeFile(
    path.join(profile, "extension-preferences.json"),
    JSON.stringify({
      "addon@example.test": {
        origins: ["https://existing.example/*"],
        permissions: ["storage"],
      },
      "other@example.test": { origins: [], permissions: ["tabs"] },
    }),
  );
  await approve({
    content_scripts: [
      { matches: ["https://example.com/*"] },
      { matches: ["<all_urls>", "https://example.com/*"] },
    ],
  });
  expect(
    JSON.parse(
      await readFile(path.join(profile, "extension-preferences.json"), "utf8"),
    ),
  ).toEqual({
    "addon@example.test": {
      origins: [
        "https://existing.example/*",
        "https://example.com/*",
        "<all_urls>",
      ],
      permissions: ["storage", "<all_urls>"],
    },
    "other@example.test": { origins: [], permissions: ["tabs"] },
  });
});
