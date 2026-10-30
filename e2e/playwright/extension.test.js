const assert = require("node:assert/strict");
const {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { after, describe, test } = require("node:test");
const playwright = require("playwright");
const {
  withExtension,
  getFirefoxExtensionUUID,
} = require("playwright-webextext");

const directory = mkdtempSync(path.join(tmpdir(), "sdk-extensions-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const { version } = JSON.parse(
  readFileSync(
    path.join(path.dirname(require.resolve("playwright")), "package.json"),
    "utf8",
  ),
);
const extensionPaths = ["magic-number-extension", "deadbeef-extension"].map(
  (name) => {
    const destination = path.join(directory, name);
    cpSync(path.join(__dirname, "extensions", name), destination, {
      recursive: true,
    });
    if (version === "1.12.0") {
      const manifestPath = path.join(destination, "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifest.manifest_version = 2;
      writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    return destination;
  },
);
const html = "<!doctype html><html><body></body></html>";

async function extensionPage(context) {
  const page = await context.newPage();
  await page.route("https://example.com/", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("https://example.com/");
  assert.equal(await page.textContent("#magic-number"), "42");
  assert.equal(await page.textContent("#deadbeef-container"), "0xDEADBEEF");
  return page;
}

test("the packed library works without @playwright/test installed", () => {
  assert.throws(() => require.resolve("@playwright/test"), {
    code: "MODULE_NOT_FOUND",
  });
  assert.equal(typeof withExtension, "function");
});

const projects = [
  { name: "chromium", browserName: "chromium", headless: false },
  { name: "firefox", browserName: "firefox", headless: false },
];
if (version !== "1.12.0") {
  projects.push({
    name: "chromium-headless",
    browserName: "chromium",
    channel: "chromium",
    headless: true,
  });
}
for (const project of projects) {
  describe(project.name, () => {
    test("delegates browser metadata", () => {
      const original = playwright[project.browserName];
      const wrapped = withExtension(original, extensionPaths);
      assert.equal(wrapped.name(), original.name());
      assert.equal(wrapped.executablePath(), original.executablePath());
    });
    test("installs extensions through the standalone SDK", {
      timeout: 60000,
    }, async () => {
      const browser = withExtension(
        playwright[project.browserName],
        extensionPaths,
      );
      const context = await browser.launchPersistentContext(
        path.join(directory, `${project.name}-profile`),
        { headless: project.headless, channel: project.channel },
      );
      try {
        await extensionPage(context);
        if (project.browserName === "firefox") {
          const first = await getFirefoxExtensionUUID(
            context,
            "magic-number-extension@playwright-webextext.test",
          );
          const second = await getFirefoxExtensionUUID(
            context,
            "deadbeef-extension@playwright-webextext.test",
          );
          assert.match(first, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
          assert.notEqual(first, second);
          await assert.rejects(
            getFirefoxExtensionUUID(context, "missing@example.test"),
            /does not have your extension installed/,
          );
        }
      } finally {
        await context.close();
      }
    });
  });
}

test("Firefox extensions can opt into real private browsing", {
  timeout: 60000,
}, async () => {
  const browser = withExtension(playwright.firefox, extensionPaths, {
    allowPrivateBrowsing: true,
  });
  const context = await browser.launchPersistentContext(
    path.join(directory, "private-profile"),
    {
      headless: false,
      firefoxUserPrefs: { "browser.privatebrowsing.autostart": true },
    },
  );
  try {
    const page = await extensionPage(context);
    assert.equal(
      await page.getAttribute("#magic-number", "data-private-browsing"),
      "true",
    );
  } finally {
    await context.close();
  }
});
