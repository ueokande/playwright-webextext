import { test, expect } from "@playwright/test";
import {
  FirefoxExtensionPreferencesBuilder,
  FirefoxExtensionPreferenceRepository,
} from "../src/firefox_extension_preferences";
import fs from "fs/promises";
import path from "path";
import os from "os";

test.describe("FirefoxExtensionPreferencesBuilder", () => {
  test.describe("new", () => {
    test("should create a new preferences", () => {
      const obj = FirefoxExtensionPreferencesBuilder.new().build();
      expect(obj).toEqual({});
    });
  });

  test.describe("from", () => {
    test("should create a new preferences from an object", () => {
      const obj = FirefoxExtensionPreferencesBuilder.from({
        "addon@id": { permissions: [], origins: [] },
      }).build();
      expect(obj).toEqual({ "addon@id": { permissions: [], origins: [] } });
    });

    [
      null,
      123,
      "abc",
      { "addon@id": null },
      { "addon@id": 123 },
      { "addon@id": "abc" },
      { "addon@id": { permissions: [] } },
      { "addon@id": { origins: [] } },
      { "addon@id": { permissions: [], origins: [123] } },
      { "addon@id": { permissions: [123], origins: [] } },
    ].forEach((obj) => {
      test(`should throw an error: ${JSON.stringify(obj)}`, () => {
        expect(() => FirefoxExtensionPreferencesBuilder.from(obj)).toThrowError(
          TypeError,
        );
      });
    });
  });

  test.describe("addPermission", () => {
    test("should add a permission to an existing permission array", () => {
      const b = FirefoxExtensionPreferencesBuilder.from({
        "addon@id": {
          permissions: ["storage"],
          origins: ["https://example.com/*"],
        },
      });

      b.addPermissions("addon@id", ["clipboardRead"]);
      b.addOrigins("addon@id", ["https://example.org/*"]);
      b.addPermissions("other@id", ["clipboardWrite"]);
      b.addOrigins("other@id", ["https://example.net/*"]);
      b.addOrigins("other@id", ["https://example.org/*"]);
      b.addOrigins("other@id", ["https://example.org/*"]);

      const obj = b.build();
      expect(obj).toEqual({
        "addon@id": {
          permissions: ["storage", "clipboardRead"],
          origins: ["https://example.com/*", "https://example.org/*"],
        },
        "other@id": {
          permissions: ["clipboardWrite"],
          origins: ["https://example.net/*", "https://example.org/*"],
        },
      });
    });
  });
});

test.describe("FirefoxExtensionPreferencesRepository", () => {
  let tmpdir: string;
  let userDataDir: string;

  test.beforeEach(async () => {
    tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "test-"));
    userDataDir = path.join(tmpdir, "my-profile-xxxx");
  });

  test.afterEach(async () => {
    await fs.rm(tmpdir, { recursive: true });
  });

  test.only("should create a new preferences", async () => {
    const repo = new FirefoxExtensionPreferenceRepository(userDataDir);
    await repo.patch((b) => {
      b.addPermissions("addon@id", ["clipboardRead"]);
      b.addOrigins("addon@id", ["https://example.com/*"]);
    });

    const obj = await fs.readFile(
      path.join(userDataDir, "extension-preferences.json"),
      "utf-8",
    );
    expect(JSON.parse(obj)).toEqual({
      "addon@id": {
        permissions: ["clipboardRead"],
        origins: ["https://example.com/*"],
      },
    });
  });

  test("should update an existing preferences", async () => {
    await fs.mkdir(userDataDir, { recursive: true });
    await fs.writeFile(
      path.join(userDataDir, "extension-preferences.json"),
      JSON.stringify({
        "addon@id": {
          permissions: ["storage"],
          origins: ["https://example.com/*"],
        },
      }),
    );

    const repo = new FirefoxExtensionPreferenceRepository(userDataDir);
    await repo.patch((b) => {
      b.addPermissions("addon@id", ["clipboardRead"]);
      b.addOrigins("addon@id", ["https://example.org/*"]);
    });

    const obj = await fs.readFile(
      path.join(userDataDir, "extension-preferences.json"),
      "utf-8",
    );
    expect(JSON.parse(obj)).toEqual({
      "addon@id": {
        permissions: ["storage", "clipboardRead"],
        origins: ["https://example.com/*", "https://example.org/*"],
      },
    });
  });
});
