# Package E2E tests

These tests install the `pnpm pack` tarball in a temporary consumer outside the
repository. The consumer has only the packaged library and the selected
`playwright` / `@playwright/test` peers. Tests import `playwright-webextext`, never
`src/` or the checkout's `dist/`.

From the repository root, using Bash:

```sh
pnpm install --frozen-lockfile
pnpm run e2e:prepare
consumer="$(cat e2e/.work/consumer-path)"
PEER_TARGET=latest # or 1.12.0
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm --dir "$consumer" add --save-exact --ignore-scripts ./package.tgz "playwright@$PEER_TARGET" "@playwright/test@$PEER_TARGET"
node e2e/run.js install chromium firefox
pnpm run test:e2e
```

On Linux, install the selected browser's system dependencies with
`node e2e/run.js install-deps chromium firefox` if needed, and run the tests with
`xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" -- pnpm run test:e2e`.
The `1.12.0` CI job uses the corresponding official browser image instead of
installing historical browsers on a current OS. That Firefox version uses
Manifest V2 test extensions; current browsers use Manifest V3.

`pnpm run test:e2e -- --list` lists tests; `--grep` and `--project` select cases.
Reports are written under the isolated consumer's `test-results/` directory.
The consumer path is recorded in ignored `e2e/.work/consumer-path`.

GitHub Actions calls `.github/workflows/e2e.yaml` only after the main workflow's
Lint/build and unit-test jobs succeed. Its matrix tests `1.12.0` on the historical
Linux image and `latest` on Ubuntu, macOS, and Windows. Publishing also waits for
E2E success. To remove generated files after debugging, delete the temporary
consumer printed by preparation, `e2e/.work/`, and `e2e/.artifacts/`.
