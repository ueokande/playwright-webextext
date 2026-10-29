const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const e2e = path.join(root, "e2e");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const archiveName = `${manifest.name.replace(/^@/, "").replace(/\//g, "-")}-${manifest.version}.tgz`;
const archive = path.join(e2e, ".artifacts", archiveName);
fs.accessSync(archive);
const workspace = fs.mkdtempSync(
  path.join(os.tmpdir(), "playwright-webextext-e2e-"),
);
fs.copyFileSync(archive, path.join(workspace, "package.tgz"));
for (const file of [
  "package.json",
  "playwright.config.ts",
  "extension.test.ts",
]) {
  fs.copyFileSync(path.join(e2e, file), path.join(workspace, file));
}
fs.cpSync(path.join(e2e, "extensions"), path.join(workspace, "extensions"), {
  recursive: true,
});
fs.mkdirSync(path.join(e2e, ".work"), { recursive: true });
fs.writeFileSync(path.join(e2e, ".work", "consumer-path"), workspace);
if (process.env.GITHUB_OUTPUT)
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `workspace=${workspace}\n`);
console.log(`Prepared isolated E2E consumer: ${workspace}`);
