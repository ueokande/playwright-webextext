# Publishing to npm

`.github/workflows/publish.yaml` runs after the `Build` workflow succeeds for
a push to `master` in this repository. Pull request builds cannot publish.
Release Please creates the release in a job with GitHub write permissions.
A separate publishing job has only `contents: read` and `id-token: write`.
npm authenticates with GitHub Actions OIDC using Trusted Publishing.
No `NPM_TOKEN` or `NODE_AUTH_TOKEN` is required.

The publishing job checks out the release tag without persisting Git credentials
and verifies that its commit matches the successful Build run. If `master` has
advanced and Release Please creates a tag for a different commit, publication
stops rather than publishing code that this run did not test. Dependencies and
build output are created afresh; no artifacts or caches from the triggering
workflow are consumed. Install and publish lifecycle scripts are disabled.

Before the next release, a package maintainer must open the settings for
[`playwright-webextext` on npm](https://www.npmjs.com/package/playwright-webextext/access)
and add a GitHub Actions Trusted Publisher with these values:

| Field | Value |
| --- | --- |
| Organization or user | `ueokande` |
| Repository | `playwright-webextext` |
| Workflow filename | `publish.yaml` |
| Environment | Leave empty (the job does not use a GitHub environment) |

Register the filename only, without `.github/workflows/`. The publishing job
runs on a GitHub-hosted Ubuntu runner and has `id-token: write` permission.
It installs npm 11 (Trusted Publishing requires npm 11.5.1 or later), which
supports the project's Node.js 22 minimum, and runs
`npm publish --provenance --access public --ignore-scripts` after building with pnpm.

If `build.yaml` was already registered as a Trusted Publisher, replace it with
`publish.yaml`. The workflow must be merged into the default branch before
GitHub will trigger it on `workflow_run` events.

After configuring the Trusted Publisher, remove the unused `NPM_TOKEN` secret
from the repository's GitHub Actions settings. Actual OIDC authentication can
only be verified by publishing a release from the configured workflow; a local
dry run does not verify the npm-side configuration.

See [npm's Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).
