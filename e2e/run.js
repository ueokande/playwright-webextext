const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");

const workspace = fs
  .readFileSync(path.join(__dirname, ".work", "consumer-path"), "utf8")
  .trim();
const consumerRequire = createRequire(path.join(workspace, "package.json"));
const packagePath = path.join(
  path.dirname(consumerRequire.resolve("@playwright/test")),
  "package.json",
);
const packageInfo = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const playwrightPath = path.join(
  path.dirname(consumerRequire.resolve("playwright")),
  "package.json",
);
const playwrightVersion = JSON.parse(
  fs.readFileSync(playwrightPath, "utf8"),
).version;
const cli = path.resolve(path.dirname(packagePath), packageInfo.bin.playwright);
let args = process.argv.slice(2);
if (args[0] === "--") args = args.slice(1);
if (args[0] !== "install" && args[0] !== "install-deps") {
  console.log(
    `Testing packed playwright-webextext with playwright ${playwrightVersion}, @playwright/test ${packageInfo.version}`,
  );
  args = ["test", "--config=playwright.config.ts", "--headed", ...args];
}
const result = spawnSync(process.execPath, [cli, ...args], {
  cwd: workspace,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
