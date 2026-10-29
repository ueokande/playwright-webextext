import path from "node:path";
import type { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: __dirname,
  testMatch: /extension\.test\.ts$/,
  forbidOnly: true,
  reporter: "line",
  workers: 1,
  outputDir: path.resolve(__dirname, "test-results"),
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
};

export default config;
