# Releasing `@zodapp/*`

This is the procedure for publishing the 27 public `@zodapp/*` packages (the packages in `packages/` that are not private) to npm.
All 27 are released with the same version (`fixed` in `.changeset/config.json`).
`@repo/*` and the apps are not published.
Users of `@zodapp/zod-form-widget` import `@zodapp/zod-form-widget/styles.css` (or `styles.layer.css`, wrapped in `@layer zodapp`) themselves.

**Current state**: only the preparation for publishing is done; nothing has been published to npm yet.
`.github/workflows/release.yml` is set to run only manually.

---

## The usual flow (after publishing has started)

1. When you change a published package, add a changeset to the PR.
   ```bash
   pnpm changeset
   ```
2. When the PR is merged into main, the release workflow opens (or updates) the "Version Packages" PR.
   This PR bumps the versions and each package's CHANGELOG.md.
3. When the "Version Packages" PR is merged, the release workflow publishes to npm and creates git tags.

Before publishing, `pnpm build` and `pnpm check:pack` run (`pnpm release`).
`check:pack` checks what goes into npm (`tools/check-pack.mjs`). It also runs in CI every time.

---

## The shape of published packages

All 27 share the same shape. New packages follow it too.

- **Version**: all 27 have the same version (`fixed` of changesets). `@repo/*` and the apps are not published
- **Contents**: `files` is `dist`, `README.md`, `README.ja.md`, and `LICENSE`. `src`, tests, configuration files, and `docs/` (hand-written specifications and typedoc output) are not included. `LICENSE` is the one at the root, copied into each package (npm cannot include files from parent directories)
- **Build**: tsup outputs `.mjs` / `.d.mts` for ESM and `.cjs` / `.d.ts` for CJS, and the `import` / `require` conditions of exports point to their respective types. It is not `"type": "module"`, so that relative imports in the source do not need extensions. dist is used inside the workspace too (`^build` before the apps' dev; package changes are followed with `watch`)
- **Metadata**: `repository` (with `directory`), `homepage`, `bugs`, `publishConfig.access: "public"`, `license: "MIT"`, and `engines.node: ">=22"` are set uniformly. Trusted publishing checks for an exact match of `repository.url`, so if the publishing repository changes, fix them all at once with `tools/set-repository.mjs`
- **CSS**: JS does not import CSS (so as not to require users' bundlers to handle CSS). Styles are written with Mantine's `styles` prop and theme variables. Packages that need CSS (`@zodapp/zod-form-widget`) ship a built `dist/styles.css` and a `dist/styles.layer.css` wrapped in `@layer zodapp`, which users import themselves. Class names are not public API
- **Side effects**: importing does not change global settings. For example, Japanese error messages are only exported as `jaErrorMap`, and the user calls `z.config()`

`pnpm check:pack` (`tools/check-pack.mjs`) checks the following about the result of `pnpm pack`:

1. `package.json`, `LICENSE`, and `dist/` are included
2. `src/`, tests, `tsconfig*.json`, `eslint.config.*`, `tsup.config.*`, `docs/`, `.turbo/`, and CSS outside `dist/` are not included
3. Every target of `main` / `module` / `types` / exports is inside the tarball (wildcards match at least one file)
4. No `workspace:` remains in the packed `package.json`
5. `repository` / `publishConfig` / `version` are consistent
6. `LICENSE` is the same as the one at the root
7. publint and attw (`@arethetypeswrong/cli`) find no mistakes in how package.json is written or in type resolution for ESM and CJS
8. The tarball is installed in a temporary directory, and each entry point can be loaded with Node's `import()` and `require()` (peers are installed too; for CSS entry points, only their presence in the tarball is checked)

---

## Steps to start publishing

### 0. Prerequisites

- [ ] The publishing repository is decided.
- [ ] `repository.url`, `homepage`, and `bugs` of all 27 match the publishing repository.
      npm's trusted publishing checks that `repository.url` exactly matches the GitHub repository.
      `node tools/set-repository.mjs <owner>/<repo>` rewrites them all at once.
- [ ] Each package has an English README (`README.md`) (it is in `files`, so it goes into npm once it exists).
- [ ] The items in "Decisions to make when publishing" below are decided.
- [ ] In the GitHub repository's Settings → Actions → General,
      "Allow GitHub Actions to create and approve pull requests" is enabled (for the Version Packages PR).

### 1. Decide the first version (0.1.0)

The only changeset is `.changeset/initial-release.md` (all 27 as minor, with the body "Initial release.").
Even if published packages change before the first release, no changesets are added; it is released with this single one (a history of unreleased changes means nothing to users).

```bash
pnpm version-packages     # sets package.json and each package's CHANGELOG.md to 0.1.0
```

Make this a PR and merge it into main.

### 2. The first publish (from a Mac)

An npm trusted publisher can only be registered once the package exists on npm. So the very first publish is done locally.
This publish has no provenance.

```bash
npm install -g npm@^11.15.0   # for npm trust and trusted publishing
npm login                     # enable 2FA on the account beforehand
git switch main && git pull
pnpm install --frozen-lockfile
pnpm release                  # build → check:pack → changeset publish (enter the OTP when asked)
git push --follow-tags        # the @zodapp/<name>@0.1.0 tags created by changeset publish
```

If it fails partway, run `pnpm release` again. What has already been published is skipped.

### 3. Register trusted publishers and switch to publishing from CI

**If publishing from CI does not succeed within 2 days of registration, the setting expires.**
So do this in one go after preparing the next changeset and getting a "Version Packages" PR.

1. Add `push: branches: [main]` to `on` in `.github/workflows/release.yml`, and merge it into main.
   (From then on, pushes to main open the "Version Packages" PR)
2. Register trusted publishers for all 27.
   ```bash
   tools/npm-trust-all.sh <owner>/<repo> --dry-run   # check the commands it will run
   tools/npm-trust-all.sh <owner>/<repo>             # choose "skip for 5 minutes" at the first 2FA
   ```
   To put an approval step in a GitHub environment, add `--env <environment name>`, and also add `environment:` to the release.yml job.
3. Merge the "Version Packages" PR, and confirm the release workflow succeeded.
4. In each npm package's Settings → Publishing access,
   set "Require two-factor authentication and disallow tokens". Trusted publishing keeps working.

---

## Decisions to make when publishing

### Publish directly from CI, or approve on npm before publishing

- **Publish directly** (`--allow-publish`, the default of `tools/npm-trust-all.sh`): the human check is "merging the Version Packages PR".
  To add another step, put approvers on a GitHub environment. changesets can be used as is.
- **Approve before publishing** (`--allow-stage-publish`): CI publishes with `npm stage publish`, and nothing is public until approved on npm with 2FA.
  Even if CI is compromised, nothing is published without approval, but `changeset publish` does not support `npm stage publish`, so a custom script is needed,
  and every release needs 27 approvals.

### If the publishing repository is private

Publishing from a private repository has no provenance (publishing itself works).
Provenance is added from the first release after the repository is made public.

---

## References

- npm: Trusted publishing (`trusted-publishers.mdx` in `npm/documentation`)
- npm: `npm trust` (`npm-trust.mdx`), Staged publishing (`staged-publishing.mdx`)
- `pnpm publish` of pnpm 10 builds the tarball and then delegates the actual publishing to the npm CLI (the `--dry-run` output is `npm notice`).
  So the npm in CI must be 11.5.1 or later (checked in release.yml).
