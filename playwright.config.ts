import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  forbidOnly: true,
  reporter: process.env.CI ? [["github"], ["line"]] : [["list"]],
  workers: 2,
  outputDir: "./test-results",
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
      testMatch: [
        "**/chromium.test.ts",
        "**/browser_type.test.ts",
        "**/fixture.test.ts",
        "**/*_overrides.test.ts",
        "**/firefox_extension_preferences.test.ts",
      ],
    },
    {
      name: "firefox",
      use: { browserName: "firefox" },
      testMatch: ["**/firefox.test.ts", "**/fixture.test.ts"],
    },
  ],
});
