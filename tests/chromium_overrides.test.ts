import { test, expect } from "@playwright/test";
import { ChromiumOverrides } from "../src/chromium_overrides";

test.describe("args", () => {
  test("should adds extensions args", () => {
    const overrides = new ChromiumOverrides(["path-to-ext1", "path-to-ext2"]);
    const args = overrides.args(["--no-sandbox", "--no-disable-sync"]);
    expect(args).toEqual([
      "--no-sandbox",
      "--no-disable-sync",
      `--disable-extensions-except=path-to-ext1,path-to-ext2`,
      `--load-extension=path-to-ext1,path-to-ext2`,
    ]);
  });
});
