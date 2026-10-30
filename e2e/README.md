# Package E2E tests

Two consumers test the packed library independently:

- `playwright/package.json` installs only the standalone `playwright` peer and
  runs the SDK tests with Node.js's built-in test runner. It verifies that
  `@playwright/test` cannot be resolved while importing and using the library.
- `playwright-test/package.json` installs only the `@playwright/test` peer as a
  direct dependency and runs the fixture tests with the public `playwright test`
  command. Current versions also depend on `playwright` transitively.

Both manifests are static files. Preparation copies the selected consumer and
shared extension fixtures to a fresh temporary directory outside the repository,
so missing peers cannot resolve from the checkout's `node_modules`. The library
is installed from the `pnpm pack` tarball, never imported from `src/` or `dist/`.
`createFixture()` loads its optional test-runner dependency only when called.

From the repository root, using Bash, choose one consumer:

```sh
pnpm install --frozen-lockfile
CONSUMER=playwright # or playwright-test
PEER_PACKAGE=playwright # use @playwright/test for playwright-test
PEER_TARGET=latest # or 1.12.0
pnpm run e2e:prepare "$CONSUMER"
consumer="$(cat "e2e/.work/$CONSUMER-path")"
cd "$consumer"
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --save-exact --ignore-scripts --no-audit --no-fund "$PEER_PACKAGE@$PEER_TARGET"
npm exec -- playwright install chromium firefox
npm test
```

On Linux, install browser system dependencies with
`npm exec -- playwright install-deps chromium firefox` if needed, then run
`xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" -- npm test`.
The `1.12.0` CI jobs use the matching official browser image instead of installing
historical browsers on a current OS, and convert test extensions to Manifest V2.
Modern peers use Manifest V3 and also run a headless Chromium project.

In the `playwright-test` consumer, `npm test -- --list`, `--grep`, and `--project`
select or list Playwright tests. In the SDK consumer, use Node's standard options,
for example `node --test --test-name-pattern="delegates|without" extension.test.js`
to run browser-free checks. Both consumers intercept `https://example.com/` with
local HTML. They test content scripts, Firefox UUID lookup, and real private
browsing; the test-runner consumer additionally exercises `createFixture()`.

GitHub Actions calls `.github/workflows/e2e.yaml` after lint/build and unit tests
succeed. Each consumer runs against `1.12.0` on the historical Linux image and
`latest` on Ubuntu, macOS, and Windows. Publishing waits for all eight jobs.

Generated tarballs are under `e2e/.artifacts/`, and consumer paths are recorded
under `e2e/.work/`. Delete those directories and the temporary consumers printed
by preparation to clean up after debugging.
