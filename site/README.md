# canvas-watch site

The landing page, docs, and live demo for `@mzebley/canvas-watch` —
[canvas-watch.markzebley.com](https://canvas-watch.markzebley.com).

SvelteKit + `adapter-static` (fully prerendered), styled with
[zebkit](https://github.com/mzebley/zebkit) tokens and web components. The page
**dogfoods the library**: the floating header bar is a real canvas-watch
element, and the demo playground runs a second, independently configured
watcher.

```bash
npm run site:dev     # from the repo root
npm run site:build   # → site/build
```

## How it's wired

| Piece | Where |
|---|---|
| Library under test | Vite aliases `@mzebley/canvas-watch[/svelte]` → `../dist`, so the site imports the exact specifiers a consumer writes. `prebuild` runs the library's `build:core` first. |
| Design tokens | `tokens/` (base) and `themes/dark/` (overlay) → `zebkit build` → `static/zbk-canvas-watch.min.css` + `static/zbk-dark.css`. |
| Component registration | `src/lib/zebkit/define.js`, called from `onMount` only — zebkit components are Lit custom elements and the site is prerendered. |
| Code samples | `src/lib/data/snippets.js`, highlighted by Shiki at build time in `+page.server.js`. No highlighter ships to the browser. |
| Zone → tint CSS | `src/app.css`. Trigger zones are zebkit canvas utilities (`canvas-brand-emphasis-trigger` → `over-canvas-brand-emphasis`). |

Generated files (`static/zbk-*.css`, `src/lib/zebkit/zebkit.runtime.*`) are
gitignored and rebuilt by `prebuild`.

## Two watchers, two frameworks, one page

The header uses the **shared** watcher via `use:watchBgCanvas`, keyed off
`*-trigger` classes on the page's full-bleed sections. The playground creates
its **own** watcher so it can vary `threshold` (a construction-time option),
using `-demozone` instead of `-trigger` so the two never see each other's zones.

The demo section can also bootstrap a **real Angular app** on demand
(`src/lib/angular/demo.ts`), which docks a `canvasWatch` pill to the bottom of
the viewport. It joins the same shared watcher as the Svelte header — the Vite
alias resolves the adapter's bare `@mzebley/canvas-watch` self-reference to the
same module instance, so the singleton really is shared. Because the two
elements sit at opposite ends of the viewport they usually report different
zones, from one rAF loop.

Angular runs in **JIT** mode: the adapter ships partial-compiled declarations
(`compilationMode: "partial"`), which the runtime compiler links on load, so no
build-time Angular linker is needed. The cost is `@angular/compiler` in the
bundle — ~270 KB gzipped — which is why the whole thing is behind a button and
dynamically imported. Nothing Angular-related is in the initial payload.

## Deploying

`vercel.json` at the repo root builds from the repo root
(`npm run site:build`) and serves `site/build`.

zebkit is published privately to GitHub Packages, so the Vercel project needs
npm auth. Set an `NPM_RC` environment variable in the project settings:

```ini
registry=https://registry.npmjs.org
@mzebley:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<classic PAT with read:packages>
```

## Checks

```bash
npm run check:zebkit
```

Validates every class attribute against the compiled CSS and reports token
contrast findings. The site's own markup is clean; the remaining accessibility
findings are contrast pairs inside zebkit components the site doesn't use
(`zbk-card`, `zbk-pagination`, `zbk-checkbox`, `zbk-dialog`, …), which are
compiled regardless.

> **Careful:** CSS pruning is enabled. It scans `src/**` for class names, with a
> safelist for `zbk-*`, `over-*`, and `cw-*`. A utility referenced only from a
> string built at runtime would be stripped — write class names as literals.
