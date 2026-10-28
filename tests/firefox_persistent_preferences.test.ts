import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import { type BrowserType, firefox } from "playwright";
import { FirefoxWithExtension } from "../src/firefox_browser";

let directory: string;
test.beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "firefox-persistent-prefs-"));
});
test.afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function interceptLaunch() {
  const observed: string[] = [];
  const browserType: BrowserType = Object.create(firefox);
  browserType.launchPersistentContext = async (profile) => {
    observed.push(await readFile(path.join(profile, "user.js"), "utf8"));
    throw new Error("Browser launch intercepted");
  };
  return { observed, browser: new FirefoxWithExtension(browserType, [], 6000) };
}

function preferences(contents: string) {
  const values: Record<string, unknown> = {};
  runInNewContext(contents, {
    user_pref: (key: string, value: unknown) => {
      values[key] = value;
    },
  });
  return values;
}

test("persistent launch writes debugger preferences before an old driver starts Firefox", async () => {
  const { browser, observed } = interceptLaunch();
  await expect(
    browser.launchPersistentContext(path.join(directory, "profile"), {
      firefoxUserPrefs: { "test.custom": "configured" },
    }),
  ).rejects.toThrow("Browser launch intercepted");
  expect(preferences(observed[0])).toMatchObject({
    "devtools.debugger.remote-enabled": true,
    "devtools.debugger.prompt-connection": false,
    "test.custom": "configured",
  });
});

test("persistent launch preserves existing user preferences and updates its own block", async () => {
  await mkdir(path.join(directory, "profile"));
  const userSettings =
    '// User-owned preferences\nuser_pref("test.user", 42);\nuser_pref("devtools.debugger.prompt-connection", true);\n';
  await writeFile(path.join(directory, "profile/user.js"), userSettings);
  const { browser, observed } = interceptLaunch();
  for (const value of ["first", "second", "second"]) {
    await expect(
      browser.launchPersistentContext(path.join(directory, "profile"), {
        firefoxUserPrefs: { "test.custom": value },
      }),
    ).rejects.toThrow("Browser launch intercepted");
  }
  expect(observed[2].startsWith(userSettings)).toBe(true);
  expect(observed[2]).toBe(observed[1]);
  expect(preferences(observed[2])).toMatchObject({
    "test.user": 42,
    "test.custom": "second",
    "devtools.debugger.prompt-connection": false,
  });
});
