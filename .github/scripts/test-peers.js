const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const packagePath = path.join(
  path.dirname(require.resolve("@playwright/test")),
  "package.json",
);
const packageInfo = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const cli = path.resolve(path.dirname(packagePath), packageInfo.bin.playwright);
console.log(
  `Testing playwright ${JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve("playwright")), "package.json"), "utf8")).version}, @playwright/test ${packageInfo.version}`,
);
const result = spawnSync(
  process.execPath,
  [
    cli,
    "test",
    "--config=.github/compatibility/playwright.config.ts",
    "--headed",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
