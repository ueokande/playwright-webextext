# Publishing to npm

The `publish` job in `.github/workflows/build.yaml` publishes releases from
`master` after lint, unit tests, and package E2E tests pass. Release Please
creates the release; npm authenticates with GitHub Actions OIDC using Trusted
Publishing. No `NPM_TOKEN` or `NODE_AUTH_TOKEN` is required.

Before the next release, a package maintainer must open the settings for
[`playwright-webextext` on npm](https://www.npmjs.com/package/playwright-webextext/access)
and add a GitHub Actions Trusted Publisher with these values:

| Field | Value |
| --- | --- |
| Organization or user | `ueokande` |
| Repository | `playwright-webextext` |
| Workflow filename | `build.yaml` |
| Environment | Leave empty (the job does not use a GitHub environment) |

Register the filename only, without `.github/workflows/`. The publishing job
runs on a GitHub-hosted Ubuntu runner and has `id-token: write` permission.
It installs npm 11 (Trusted Publishing requires npm 11.5.1 or later), which
supports the project's Node.js 22 minimum, and runs
`npm publish --provenance --access public` after building with pnpm.

After configuring the Trusted Publisher, remove the unused `NPM_TOKEN` secret
from the repository's GitHub Actions settings. Actual OIDC authentication can
only be verified by publishing a release from the configured workflow; a local
dry run does not verify the npm-side configuration.

See [npm's Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).
