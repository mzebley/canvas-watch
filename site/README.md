# canvas-watch site

The landing page, docs, and live demo for `@mzebley/canvas-watch` —
[canvas-watch.markzebley.com](https://canvas-watch.markzebley.com).

SvelteKit + `adapter-static` (fully prerendered), styled with
[zebkit](https://github.com/mzebley/zebkit) tokens and web components. The page
**dogfoods the library**: the floating header bar is a real canvas-watch
element, its readout reactively tracks the hero's viewport state, and the demo
playground runs a second, independently configured watcher.

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
| Zone → restyle CSS | `src/app.css`. Trigger zones are zebkit canvas utilities (`canvas-brand-emphasis-trigger` → `over-canvas-brand-emphasis`). The header tints shadow and border; the demo card inverts panel and text outright over the pale band, to show the library only swaps the class. |

Generated files (`static/zbk-*.css`, `src/lib/zebkit/zebkit.runtime.*`) are
gitignored and rebuilt by `prebuild`.

## Two watchers, one page

The header uses the **shared** watcher via `use:watchBgCanvas`, keyed off
`*-trigger` classes on the page's full-bleed sections. The playground creates
its **own** watcher so it can vary `threshold` (a construction-time option),
using `-demozone` instead of `-trigger` so the two never see each other's zones.

## The header tints per region, not per bar

The bar registers three elements: itself, plus its left and right content
groups. Surface and shadow are whole-bar properties and take the bar's own
answer; **ink** is resolved per group, because a bar this wide regularly
straddles two zones and one element can only carry one class.

Nesting works because canvas-watch resolves against elements carrying a
`*-trigger` class. The bar has none, so it is invisible to the watcher and the
groups measure against the page's zones rather than the bar they sit in. That
split is why `.cw-glass` (the surface) and `.cw-tint` (the adaptive ink) are
separate classes in `app.css`.

The playground's bands can't carry `-trigger` themselves — canvas-watch compares
*unclipped* rects, so a band scrolled out of the frame still reports a rect where
it would have been, and the header would tint from a zone that isn't on screen.
The frame carries the trigger instead, relabelled as its content scrolls. That's
the same proxy any consumer needs for zones inside a scroller.

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
