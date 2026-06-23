# @mzebley/canvas-watch

Detect which background "canvas" zone a floating element is sitting over, and
reflect it as a class on that element — so its shadow (or, later, its text
color) can be tinted to match what's behind it.

Useful for sticky nav bars, docked players, and cards that float over changing
backgrounds, where one fixed shadow color looks wrong against a shifting page.

```svelte
<script>
	import { watchBgCanvas } from '@mzebley/canvas-watch/svelte';
</script>

<section class="canvas-brand-emphasis-trigger">…</section>

<div class="card watch-bg-canvas" use:watchBgCanvas>…</div>
```

```css
.card { --shadow-color: rgba(0, 0, 0, 0.3); }
.card.over-canvas-brand-emphasis { --shadow-color: rgba(79, 70, 229, 0.75); }
```

As the card scrolls over the section, it gains the class
`over-canvas-brand-emphasis`; when it leaves, the class is removed.

---

## Install

```sh
npm install @mzebley/canvas-watch
```

Framework adapters are shipped as subpath entry points and pull in **optional
peer deps** — install only what you use:

| Import                          | What you get                              | Peer dep        |
| ------------------------------- | ----------------------------------------- | --------------- |
| `@mzebley/canvas-watch`         | Framework-agnostic core (`createCanvasWatcher`) | none      |
| `@mzebley/canvas-watch/svelte`  | `watchBgCanvas` action                    | `svelte >= 5`   |
| `@mzebley/canvas-watch/angular` | `CanvasWatchDirective` + `CanvasWatchService` | `@angular/core >= 16` |

---

## Why not just IntersectionObserver?

`IntersectionObserver` can only compare a target against its **scroll-ancestor
or the viewport** — never against an arbitrary sibling element. "Is this
floating card mostly over that background zone?" is a 2D overlap question
between two unrelated elements, which IO cannot answer.

So canvas-watch compares bounding rectangles. IntersectionObserver is still used
— as a cheap **visibility gate** so the overlap math only runs for on-screen
elements.

---

## Concepts

**Watched element** — a floating element you tag with `watch-bg-canvas` (or
register via an adapter). It receives an `over-*` class describing the zone it
currently sits over.

**Trigger zone** — a background element tagged with a `*-trigger` class. Each
maps to an `over-*` class by convention: strip the `-trigger` suffix, add the
`over-` prefix.

| Trigger class                   | Applied class                |
| ------------------------------- | ---------------------------- |
| `canvas-brand-emphasis-trigger` | `over-canvas-brand-emphasis` |
| `canvas-danger-trigger`         | `over-canvas-danger`         |

**Winner = majority overlap.** A watched element gets the class of the zone
covering the largest share of *its own* area. If that share is below the
threshold (default 50%), or it overlaps no zone, all `over-*` classes are
removed. Only one `over-*` class is applied at a time.

**`canvaschange` event.** Each time the applied class changes, the watched
element dispatches a `canvaschange` CustomEvent with
`detail: { appliedClass, previousClass }` (each `string | null`). This is the
hook for logic beyond CSS — e.g. flipping text color for contrast. Both adapters
surface it (`onChange` in Svelte, `(canvasChange)` in Angular).

---

## Usage

### Svelte

```svelte
<script>
	import { watchBgCanvas } from '@mzebley/canvas-watch/svelte';
	let tint = $state(null);
</script>

<div
	class="card watch-bg-canvas"
	use:watchBgCanvas={{ onChange: (d) => (tint = d.appliedClass) }}
>…</div>
```

The action shares one watcher across the whole app (a single
`requestAnimationFrame` loop drives every element) and cleans up on destroy.
`class="watch-bg-canvas"` is optional when you use the action — the action
registers the node directly — but keeping it makes the intent obvious in markup.

Elements that outlive a page (a layout-level nav or player) are registered once
and won't automatically see a new page's trigger zones. Re-scan after navigation:

```svelte
<!-- +layout.svelte -->
<script>
	import { afterNavigate } from '$app/navigation';
	import { tick } from 'svelte';
	import { refreshCanvasWatch } from '@mzebley/canvas-watch/svelte';

	afterNavigate(async () => {
		await tick(); // let the new page's DOM render first
		refreshCanvasWatch();
	});
</script>
```

### Angular

`CanvasWatchDirective` is a **standalone** directive — import it directly into a
component's `imports`:

```ts
import { Component } from '@angular/core';
import { CanvasWatchDirective } from '@mzebley/canvas-watch/angular';
import type { CanvasChangeDetail } from '@mzebley/canvas-watch/angular';

@Component({
	standalone: true,
	imports: [CanvasWatchDirective],
	template: `
		<section class="canvas-brand-emphasis-trigger">…</section>
		<div class="card watch-bg-canvas" canvasWatch (canvasChange)="onTint($event)">…</div>
	`,
})
export class DemoComponent {
	onTint(detail: CanvasChangeDetail) {
		// detail.appliedClass / detail.previousClass
	}
}
```

After router navigation, re-scan so persistent watched elements pick up the new
page's trigger zones (the analogue of Svelte's `afterNavigate`):

```ts
import { inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CanvasWatchService } from '@mzebley/canvas-watch/angular';

export class AppComponent {
	private readonly canvasWatch = inject(CanvasWatchService);

	constructor() {
		inject(Router)
			.events.pipe(filter((e) => e instanceof NavigationEnd))
			.subscribe(() => this.canvasWatch.refresh());
	}
}
```

### Vanilla / any framework

The core has no framework dependencies.

```ts
import { createCanvasWatcher } from '@mzebley/canvas-watch';

const watcher = createCanvasWatcher();
watcher.refresh(); // scan the DOM for .watch-bg-canvas + *-trigger elements

// later, after adding/removing watch or trigger elements:
watcher.refresh();

// on teardown:
watcher.destroy();
```

Listen for changes directly on the element:

```ts
el.addEventListener('canvaschange', (e) => {
	console.log(e.detail.appliedClass, e.detail.previousClass);
});
```

See [`demo/index.html`](demo/index.html) for a complete, framework-free example.

---

## API

### `createCanvasWatcher(options?): CanvasWatcher`

Returns a live watcher in the browser, or a no-op during SSR (so you never need
to guard `typeof window`).

#### Options

| Option              | Default               | Description                                                                 |
| ------------------- | --------------------- | --------------------------------------------------------------------------- |
| `watchSelector`     | `.watch-bg-canvas`    | Selector for elements to watch.                                             |
| `triggerSelector`   | `[class*="-trigger"]` | Coarse selector for trigger elements; refined in JS by `triggerSuffix`.     |
| `triggerSuffix`     | `-trigger`            | Suffix that marks a class as a trigger.                                     |
| `appliedPrefix`     | `over-`               | Prefix for the applied class.                                               |
| `classMap`          | `{}`                  | Explicit `triggerClass → appliedClass` overrides; win over the convention.  |
| `threshold`         | `0.5`                 | Fraction of the watched element's area that must overlap to count.          |
| `triggerRootMargin` | `200`                 | Margin (px) around the viewport for keeping a trigger zone "active".        |

```ts
createCanvasWatcher({
	classMap: { 'hero-trigger': 'on-hero' }, // hero-trigger → on-hero
	threshold: 0.6,
});
```

#### `CanvasWatcher`

| Method        | Description                                                              |
| ------------- | ------------------------------------------------------------------------ |
| `refresh()`   | Re-scan the DOM for watch + trigger elements. Call after DOM changes.    |
| `watch(el)`   | Manually register an element to watch. Returns an `unwatch()` function.  |
| `schedule()`  | Force a recompute on the next frame.                                     |
| `destroy()`   | Disconnect observers/listeners and remove all applied classes.           |

The core also exports the pure helpers `overlapArea(a, b)` and
`resolveAppliedClass(triggerClass, opts)`, and the shared-singleton helpers
`getSharedWatcher()` / `refreshCanvasWatch()` used by the adapters.

### Types

```ts
interface CanvasChangeDetail {
	appliedClass: string | null;
	previousClass: string | null;
}
```

---

## How it works

1. **Visibility gate.** Each watched element is tracked by an
   `IntersectionObserver`; only on-screen elements are measured. Trigger zones
   are tracked by a second observer (with `triggerRootMargin`) so only zones
   near the viewport are considered.
2. **Single rAF loop.** Scroll, resize, `ResizeObserver`, and observer callbacks
   all funnel into one coalesced `requestAnimationFrame`. At most one recompute
   per frame. Both adapters register on **one** shared watcher, so a Svelte and
   an Angular element on the same page still share a single loop.
3. **Read then write.** Per frame, every trigger rect is read **once** (not once
   per watched element), then all watched rects, then all class changes are
   applied together — a single layout pass instead of a reflow per element.
4. **Minimal DOM churn.** A class is only added/removed when the winning zone
   actually changes, so scrolling within one zone touches the DOM zero times.
5. **Idle pages cost nothing.** With no trigger zones or nothing visible, scroll
   frames short-circuit before scheduling any work.

---

## Accessibility

canvas-watch is **purely presentational** — it toggles a class and changes a
shadow color. It adds no ARIA, announces nothing to assistive tech, and never
alters content, focus order, or layout.

- **Reduced motion** is the consumer's call: put any `transition` on the tinted
  property behind `@media (prefers-reduced-motion: reduce)`.
- **Future text-color use:** the `canvaschange` event makes it easy to flip text
  color against the background ("liquid glass"). If you do, **you** are
  responsible for meeting WCAG contrast — the service only tells you which zone
  you're over.

---

## Gotchas

- **Tinting a *composed* shadow token.** If your shadow is a variable that itself
  references the color — e.g. `--shadow-elevation: … hsl(var(--shadow-color)) …`
  declared on `:root` — overriding `--shadow-color` from an `over-*` class does
  **nothing**. CSS bakes the nested `var()` once, where the composite is declared
  (`:root`), and the result inherits down. Re-declare the composite on the
  watched element so it re-bakes against that element's `--shadow-color`.
- **`position: sticky` and `overflow`.** A sticky watched element won't stick if
  an **ancestor** has `overflow: hidden|auto|scroll`. Put clipping on a sibling
  layer, not an ancestor of the sticky element.
- **Stacking is not considered.** "Majority overlap" ignores `z-index`; the
  larger overlap area wins, which may not be the element painted on top.
- **Dynamic triggers need `refresh()`.** Trigger zones are indexed on `refresh()`
  (and at adapter mount / `refreshCanvasWatch()`), not continuously observed for
  class changes.

---

## Browser support

`IntersectionObserver`, `ResizeObserver`, `requestAnimationFrame`, and
`CustomEvent` — all supported in every current evergreen browser. SSR-safe:
`createCanvasWatcher` returns a no-op when `window`/`document` are absent, and
the framework adapters only run on the client.

---

## License

ISC © Mark Zebley
