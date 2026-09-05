# Releasing Canvas Watch

Merge a same-repository release PR into `main` to publish `@mzebley/canvas-watch` to npm and GitHub Packages, then create its immutable tag and GitHub Release.

## Prepare

- Branch: `codex/release-1.2.0`, `release/1.2.0`, `release/v1.2.0`, or `release-1.2.0`
- Matching stable version in `package.json` and both root version fields in `package-lock.json`
- Dated changelog entry, for example `## [1.2.0] - 2026-09-05`
- Reviewed code and passing `npm run verify`

The workflow checks out the exact merge commit, runs library/browser/site/package verification, and publishes the same inspected tarball to both registries; a registry chooses its destination explicitly, so keep `publishConfig.registry` unset.

## One-time setup

| Service | Required configuration |
| --- | --- |
| npm | Trusted publisher for `@mzebley/canvas-watch`: owner `mzebley`, repository `canvas-watch`, workflow `release.yml`, environment `npm`, direct publishing allowed |
| GitHub environment | Environment named `npm`; only `main` deployments allowed |
| Private build dependency | Give `mzebley/canvas-watch` Actions read access to `@mzebley/zebkit` in its GitHub package settings |
| GitHub Packages | Publication uses the repository's ephemeral `GITHUB_TOKEN` with `packages: write`; existing packages must grant this repository write access |

npm trust must be configured by a package owner; if the package does not exist yet, bootstrap its first publication before configuring package-level trust, without storing a permanent npm token in Actions.

## First run and retries

After this workflow merges, run **Release** manually on `main` with `release_version: 1.1.0` to publish the already-merged release; ordinary feature/workflow merges do not publish.

Rerun failed jobs to reuse their uploaded artifact, or dispatch again only while `main` still contains the intended version: matching registry integrity is accepted, different contents or an existing tag at another commit fail, and finalization waits for both registries.

## Install

```bash
npm install @mzebley/canvas-watch --registry=https://registry.npmjs.org --@mzebley:registry=https://registry.npmjs.org
```

For GitHub Packages, authenticate with a token permitted to read packages and configure the scope before installing:

```ini
@mzebley:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

GitHub Packages visibility and consumer access are managed in package settings; publishing a package does not replace those access settings.
