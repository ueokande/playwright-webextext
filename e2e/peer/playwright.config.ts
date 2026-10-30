import { readFileSync } from "node:fs";
import path from "node:path";
import type { PlaywrightTestConfig } from "@playwright/test";

const { version } = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(require.resolve("@playwright/test")),
      "package.json",
    ),
    "utf8",
  ),
);

const config: PlaywrightTestConfig = {
  testDir: __dirname,
  testMatch: /extension\.test\.ts$/,
  forbidOnly: true,
  reporter:
    process.env.CI && version !== "1.12.0" ? [["github"], ["line"]] : "line",
  workers: 1,
  outputDir: path.resolve(__dirname, "test-results"),
  projects: [
    { name: "chromium", use: { browserName: "chromium", headless: false } },
    { name: "firefox", use: { browserName: "firefox", headless: false } },
  ],
};

if (version !== "1.12.0") {
  config.projects?.push({
    name: "chromium-headless",
    use: { browserName: "chromium", channel: "chromium", headless: true },
  });
}

export default config;
