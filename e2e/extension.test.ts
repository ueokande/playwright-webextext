import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFixture, withExtension } from "playwright-webextext";

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "peer-extensions-"));
process.once("exit", () =>
  rmSync(temporaryDirectory, { recursive: true, force: true }),
);
const { version } = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(require.resolve("@playwright/test")),
      "package.json",
    ),
    "utf8",
  ),
);
const extensionPaths = [
  "magic-number-extension",
  "deadbeef-extension",
  "empty-extension",
].map((name) => {
  const destination = path.join(temporaryDirectory, name);
  cpSync(path.join(__dirname, "extensions", name), destination, {
    recursive: true,
  });
  if (version === "1.12.0") {
    // The Firefox bundled with Playwright 1.12 predates Manifest V3 support.
    const manifestPath = path.join(destination, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.manifest_version = 2;
    writeFileSync(manifestPath, JSON.stringify(manifest));
  }
  return destination;
});

const { test, expect } = createFixture(extensionPaths);
const html = "<!doctype html><html><body></body></html>";

test("browser metadata is delegated to the original browser", async ({
  playwright,
  browserName,
}) => {
  const original = playwright[browserName];
  const wrapped = withExtension(original, extensionPaths);
  expect(wrapped.name()).toBe(original.name());
  expect(wrapped.executablePath()).toBe(original.executablePath());
});

test("withExtension installs both content scripts", async ({
  playwright,
  browserName,
}, testInfo) => {
  const browserType = withExtension(playwright[browserName], extensionPaths);
  expect(browserType.name()).toBe(browserName);
  expect(browserType.executablePath()).toBe(
    playwright[browserName].executablePath(),
  );
  const context = await browserType.launchPersistentContext(
    testInfo.outputPath("profile"),
    { headless: false },
  );
  try {
    const page = await context.newPage();
    await page.route("https://example.com/", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );
    await page.goto("https://example.com/");
    expect(await page.textContent("#magic-number")).toBe("42");
    expect(await page.textContent("#deadbeef-container")).toBe("0xDEADBEEF");
  } finally {
    await context.close();
  }
});

test("createFixture installs both content scripts", async ({ page }) => {
  await page.route("https://example.com/", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("https://example.com/");
  expect(await page.textContent("#magic-number")).toBe("42");
  expect(await page.textContent("#deadbeef-container")).toBe("0xDEADBEEF");
});
