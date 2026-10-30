# Package E2E tests

`peer/package.json` declares only the packed library. Both peers are installed
manually into the same consumer for each version target:

- `playwright@1.12.0` and `@playwright/test@1.12.0`
- `playwright@latest` and `@playwright/test@latest`

Preparation copies the static consumer and shared extension fixtures to a fresh
temporary directory outside the repository. Tests import the installed tarball,
never `src/` or `dist/`. The SDK suite checks that both installed peers have the
same version and exercises the standalone SDK. The Playwright Test suite also
checks `createFixture()`. Both cover content scripts, Firefox UUID lookup, and
real private browsing. Modern versions additionally test headless Chromium.

From the repository root, using Bash:

```sh
pnpm install --frozen-lockfile
pnpm run e2e:prepare
consumer="$(cat e2e/.work/consumer-path)"
cd "$consumer"
PEER_TARGET=latest # or 1.12.0
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save --ignore-scripts --no-audit --no-fund "playwright@$PEER_TARGET" "@playwright/test@$PEER_TARGET"
npm exec -- playwright install chromium firefox
npm test
```

`--no-save` leaves the consumer manifest unchanged. Install both peers in the
same npm command to provide the test runner's public `playwright` executable,
including on 1.12.0. No internal CLI paths or legacy execution scripts are used.

On Linux, install browser system dependencies with
`npm exec -- playwright install-deps chromium firefox` if needed, then run
`xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" -- npm test`.
The `1.12.0` CI job uses the matching official browser image and converts test
extensions to Manifest V2. Current peers use Manifest V3.

`npm test` runs the SDK tests with Node.js's built-in runner, followed by the
fixture tests with `playwright test`. For browser-free checks, use
`node --test --test-name-pattern="delegates|same version" sdk.test.js` and
`npm exec -- playwright test --grep "browser metadata"` separately. Both suites
intercept `https://example.com/` with local HTML.

GitHub Actions calls `.github/workflows/e2e.yaml` after lint/build and unit tests
succeed. The version matrix runs `1.12.0` on the historical Linux image and
`latest` on Ubuntu, macOS, and Windows. Publishing waits for all four jobs.

Generated tarballs are under `e2e/.artifacts/`, and the temporary consumer path is
recorded in `e2e/.work/consumer-path`. Delete those directories and the temporary
consumer printed by preparation to clean up after debugging.
