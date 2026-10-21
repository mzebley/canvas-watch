# canvas-watch site

The library's documentation site uses canvas-watch's existing purple, pink, and
cyan palette with the layout and typography shared by the Dynamo library sites.

```bash
npm run site:dev     # from the repository root
npm run site:build   # static output in site/build
```

The site imports the built package through Vite aliases, so its examples exercise
the same core and Svelte entry points consumers use.

| Owner | Responsibility |
| --- | --- |
| `src/lib/components/OverlapLab.svelte` | Scoped watchers for foregrounds, shadows, nested priority, union coverage, thresholds, class mappings, and change events. |
| `src/lib/components/ViewportDemo.svelte` | Reactive state for a real page reference, including removal and restoration. |
| `src/lib/components/DocsNav.svelte` | Desktop quick links and a collapsed mobile disclosure. |
| `src/lib/data/snippets.js` | Source examples, highlighted by Shiki during prerendering. |
| `tokens/` and `themes/dark/` | Zebkit theme sources; the normal site build regenerates CSS and runtime configuration. |
| `src/app.css` | Page layout and demo geometry; native range inputs cover the slider surface Zebkit doesn't provide. |

Each overlap lab owns one watcher and scopes both selectors to its own scene;
changing its construction-time threshold recreates only that watcher. Slider
movement explicitly schedules geometry measurement, while adding the duplicate
zone refreshes the zone index. The viewport demo uses the shared
Svelte watcher, and the declarative example enables discovery through `refresh()`.

Below 560px of available demo width, overlap zones become horizontal bands and the
position slider runs vertically beside them. The watcher still measures the real
rectangles; its threshold and class rules are unchanged.

Vercel builds with `npm run site:build` and serves `site/build`. Pushing to `main`
deploys the site to [canvas-watch.markzebley.com](https://canvas-watch.markzebley.com).
