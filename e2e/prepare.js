const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const archiveName = `${manifest.name.replace(/^@/, "").replace(/\//g, "-")}-${manifest.version}.tgz`;
const archive = path.join(__dirname, ".artifacts", archiveName);
fs.accessSync(archive);
const workspace = fs.mkdtempSync(
  path.join(os.tmpdir(), "playwright-webextext-e2e-"),
);
fs.writeFileSync(
  path.join(workspace, "package.json"),
  JSON.stringify({ name: "playwright-webextext-e2e-consumer", private: true }),
);
fs.copyFileSync(archive, path.join(workspace, "package.tgz"));
for (const file of ["playwright.config.ts", "extension.test.ts"]) {
  fs.copyFileSync(path.join(__dirname, file), path.join(workspace, file));
}
fs.cpSync(
  path.join(__dirname, "extensions"),
  path.join(workspace, "extensions"),
  { recursive: true },
);
fs.mkdirSync(path.join(__dirname, ".work"), { recursive: true });
fs.writeFileSync(path.join(__dirname, ".work", "consumer-path"), workspace);
if (process.env.GITHUB_OUTPUT)
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `workspace=${workspace}\n`);
console.log(`Prepared isolated E2E consumer: ${workspace}`);
