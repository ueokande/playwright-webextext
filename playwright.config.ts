import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  forbidOnly: true,
  reporter: process.env.CI ? [["github"], ["line"]] : [["list"]],
  workers: 2,
  outputDir: "./test-results",
});
