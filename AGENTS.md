# AI coding guidelines

## Project and scope

- This TypeScript library loads local WebExtensions into Playwright Chromium and Firefox browsers. Its public entry points are `withExtension` and `createFixture` in `src/index.ts`.
- Browser adapters, launch overrides, and Firefox add-on installation live in `src/`. Tests and example extensions live in `tests/`; compiled output is generated in `dist/`.
- Read the relevant implementation, tests, and README before changing behavior. Preserve public API compatibility unless a breaking change is requested.
- Keep changes focused on the requested task. Preserve existing user changes and avoid unrelated refactoring, formatting, or dependency upgrades.
- Use the existing checkout; do not create a Git worktree unless requested. Never edit generated files in `dist/` or dependencies in `node_modules/`.

## Development and validation

- Use Node.js >=20 and the pinned package manager, pnpm 8.14.1. Install with `pnpm install --frozen-lockfile`; do not regenerate the lockfile unless dependency changes are needed.
- Follow the existing TypeScript style and ESLint/Prettier configuration. Prefer clear names and small, focused changes over new abstractions.
- For code changes, run `pnpm run lint`, `pnpm run build`, and the existing tests relevant to the changed behavior. Add regression coverage for behavior changes when appropriate; documentation-only changes do not require browser tests.
- Browser setup: `pnpm exec playwright install chromium firefox`. Run browser tests in headed mode with a working display; Linux CI uses `xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" -- pnpm run test`.
- Browser tests visit `https://example.com/`. Chromium extension tests require a headed persistent context; Firefox uses its remote debugging protocol. Keep these constraints in mind when changing launch behavior.
- At the time this guide was added, `tests/firefox_extension_preferences.test.ts` contains a `test.only`. A default test run therefore does not establish full coverage. Run other relevant test files separately and report the actual test counts; do not add focused or skipped tests to make checks pass.
- Distinguish passed, failed, skipped, and unrun checks. Report missing browser binaries, display support, or network access as validation limitations rather than claiming success.

## Commit messages: Conventional Commits and useful context

- Use Conventional Commits: `<type>[optional scope][!]: <description>`. Use `feat` for new features, `fix` for bug fixes, and an appropriate type such as `docs`, `refactor`, `perf`, `test`, `build`, `ci`, or `chore` for other changes. Add a scope only when it helps identify the affected area.
- Write a concise, specific subject in imperative mood, consistent with the existing English commit history: for example, `fix(firefox): preserve existing extension permissions`. Avoid vague subjects such as `fix issues` or `update code`, and do not end the subject with a period.
- For non-trivial changes, separate the body from the subject with a blank line. Explain the problem or prior behavior, why the change is needed, and how the chosen approach improves the result. Include meaningful trade-offs or rejected alternatives only when relevant and supported by the actual work.
- Scale the explanation to the change. An obvious typo fix may need only a subject; a subtle browser compatibility fix needs enough context for a future maintainer to understand the decision. A literal `Why:` heading is not required. Avoid filler, repeated subjects, file inventories, and line-by-line descriptions of the diff.
- Make the message understandable without the chat or an external issue. Add issue or commit references when useful, but summarize the essential context in the message itself. Do not invent issue IDs, motivation, or validation results.
- Mark breaking changes with `!` before the colon or a `BREAKING CHANGE:` footer, as specified by Conventional Commits. Explain the incompatible behavior and necessary migration; use the footer when the subject is insufficient.
- Keep each commit focused on one logical change. Before committing, inspect the staged diff and ensure the message describes what is actually staged; exclude unrelated user changes.
- Example:

  ```text
  fix(firefox): preserve existing extension permissions

  Replacing the stored permission list revokes grants that other
  installed add-ons still need when a persistent profile is reused.

  Merge the requested grants with the stored permissions so existing
  add-ons retain access.
  ```

References:

- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Git contribution guidelines: Describe your changes well](https://github.com/git/git/blob/master/Documentation/SubmittingPatches#describe-changes)

## Code comments: add useful information, avoid noise

- Prefer code that explains itself through naming and structure. Do not add comments that merely narrate what the code does or repeat types, function names, or assertions.
- Keep necessary comments short, accurate, and close to the decision. Update or remove stale comments when behavior changes. Use API documentation to explain contracts when needed; reserve implementation comments for reasoning that the code cannot express clearly.
- Before adding an implementation comment, ask: would removing it hide a constraint or rationale that a maintainer needs to avoid a likely mistake? If not, omit it. Prefer clearer naming or simpler local code when that solves the ambiguity without unrelated refactoring.
- Do not add boilerplate JSDoc to every symbol, repeat TypeScript types in JSDoc, or add `@param` / `@returns` descriptions that merely restate names and signatures. Document public API contracts, side effects, and usage constraints when they add information.
- Avoid step-by-step narration, decorative section banners, change summaries, and comments about the AI's editing process. Put change history and motivation in the commit message, while keeping enduring implementation constraints next to the relevant code.
- A brief explanation of a subtle algorithm, protocol invariant, or regular expression is appropriate when it materially improves understanding. Choose the explanation that helps the reader; do not invent rationale or rejected alternatives to justify a comment.
- Before finishing, review comments added in the diff and remove redundant or speculative ones. Preserve existing useful rationale and required license/tooling directives; do not delete comments merely to reduce their count.

These rules adapt general review and TypeScript documentation practices into instructions for AI contributors; they are not a universal AGENTS.md standard:

- [Google Engineering Practices: Comments](https://google.github.io/eng-practices/review/reviewer/looking-for.html#comments)
- [Google TypeScript Style Guide: Make comments that actually add information](https://google.github.io/styleguide/tsguide.html#redundant-comments)
- [Google TypeScript Style Guide: JSDoc type annotations](https://google.github.io/styleguide/tsguide.html#jsdoc-type-annotations)
