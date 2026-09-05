# @mzebley/canvas-watch

Detect which background "canvas" zone a floating element is sitting over, and
reflect it as a class on that element — or reactively track whether a reference
is above, within, below, or missing from the viewport.

Useful for sticky nav bars, docked players, and cards that float over changing
backgrounds, where a fixed shadow color may look wrong against a shifting page, or flipping floating elements that are darkly colored over to being lightly colored when they're over a dark background so they still pop.

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

**[canvas-watch.markzebley.com](https://canvas-watch.markzebley.com)** — docs
with a live demo you can scroll. Source in [`site/`](site/README.md).

---

## Install

```sh
npm install @mzebley/canvas-watch
```

The Svelte adapter ships as a subpath entry point and pulls in an **optional
peer dep** — install it only if you use it:

| Import                         | What you get                                    | Peer dep      |
| ------------------------------ | ----------------------------------------------- | ------------- |
| `@mzebley/canvas-watch`        | Framework-agnostic core (`createCanvasWatcher`) | none          |
| `@mzebley/canvas-watch/svelte` | `watchBgCanvas` action and reactive `canvasWatch` state | `svelte >= 5.7` |

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
removed. Repeated same-class rectangles count by their physical union, not by
adding duplicate pixels; adjacent same-class zones still combine. Only one
`over-*` class is applied at a time.

**Nesting wins.** A zone inside another zone is the more specific answer, so it
beats its container outright — a dark band, or a block of big pale display type,
inside a light section gets to overrule the section even though the section
covers strictly more of the element. Without this a container could never be
overridden, since its overlap is by definition at least its children's. Nesting
only reorders zones that already clear the threshold, so a nested zone that
barely clips the element can't hijack it. Among zones at the same depth, the
larger overlap still wins. Coverage qualifies at its own depth: a tiny nested
zone cannot promote the qualifying coverage of a same-class ancestor.

```html
<section class="canvas-brand-subtle-trigger">
	<!-- while the bar is over this heading it takes `over-cw-display`,
	     not `over-canvas-brand-subtle` -->
	<h1 class="cw-display-trigger">Big pale display type</h1>
</section>
```

**`canvaschange` event.** Each time the applied class changes, the watched
element dispatches a `canvaschange` CustomEvent with
`detail: { appliedClass, previousClass }` (each `string | null`). This is the
hook for logic beyond CSS — e.g. flipping text color for contrast. The Svelte
adapter surfaces it as `onChange`.

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

For vertical viewport state, give `canvasWatch` a native ID reference or a
direct `Element`. Its properties participate in Svelte 5 reactivity:

```svelte
<script>
	import { canvasWatch } from '@mzebley/canvas-watch/svelte';
	const hero = canvasWatch('#hero');
</script>

<header class:past-hero={hero.aboveViewport}>
	{hero.missing ? 'Hero not found' : hero.state}
</header>
<section id="hero">…</section>
```

`state` is `'unknown' | 'missing' | 'above' | 'within' | 'below'`.
`aboveViewport`, `inViewport`, and `belowViewport` are all false while the state
is `unknown` or `missing`; `missing` becomes true only after the client has tried
to resolve the reference.

Read these properties from a Svelte template or tracked effect. `canvasWatch`
uses Svelte's external reactivity bridge and deliberately does not create an
orphan subscription for an imperative getter read; direct callers should use
`observeViewport` instead.

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

There is no Angular entry point to install — the core is enough. A standalone
directive wraps it in about thirty lines, and because it registers on
`getSharedWatcher()` it joins the same single rAF loop as every other watched
element on the page. Own this file in your app:

```ts
// canvas-watch.directive.ts
import {
	Directive,
	ElementRef,
	EventEmitter,
	inject,
	NgZone,
	Output,
	type OnDestroy,
	type OnInit,
} from '@angular/core';
import {
	getSharedWatcher,
	scheduleRefresh,
	type CanvasChangeDetail,
} from '@mzebley/canvas-watch';

@Directive({ selector: '[canvasWatch]', standalone: true })
export class CanvasWatchDirective implements OnInit, OnDestroy {
	@Output() canvasChange = new EventEmitter<CanvasChangeDetail>();

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly zone = inject(NgZone);
	private unwatch?: () => void;

	private readonly listener = (event: Event): void => {
		const detail = (event as CustomEvent<CanvasChangeDetail>).detail;
		// Re-enter the zone only when a change actually fires (rare).
		this.zone.run(() => this.canvasChange.emit(detail));
	};

	ngOnInit(): void {
		const node = this.host.nativeElement;
		// Register outside the zone: the watcher's scroll listener and rAF loop
		// must not be zone-patched, or every scroll frame app-wide triggers
		// change detection.
		this.zone.runOutsideAngular(() => {
			this.unwatch = getSharedWatcher().watch(node);
			scheduleRefresh(); // pick up trigger zones already in the DOM
			node.addEventListener('canvaschange', this.listener);
		});
	}

	ngOnDestroy(): void {
		this.host.nativeElement.removeEventListener('canvaschange', this.listener);
		this.unwatch?.();
	}
}
```

```ts
@Component({
	standalone: true,
	imports: [CanvasWatchDirective],
	template: `
		<section class="canvas-brand-emphasis-trigger">…</section>
		<div class="card" canvasWatch (canvasChange)="onTint($event)">…</div>
	`,
})
export class DemoComponent {
	onTint(detail: CanvasChangeDetail) {
		// detail.appliedClass / detail.previousClass
	}
}
```

Elements that outlive a route are registered once and won't automatically see
the next page's trigger zones. Re-scan after navigation — the analogue of
Svelte's `afterNavigate`:

```ts
export class AppComponent {
	constructor() {
		inject(Router)
			.events.pipe(filter((e) => e instanceof NavigationEnd))
			.subscribe(() => refreshCanvasWatch());
	}
}
```

### Vanilla / any framework

The core has no framework dependencies.

```ts
import { createCanvasWatcher } from '@mzebley/canvas-watch';

const watcher = createCanvasWatcher();
watcher.refresh(); // scan the DOM for .watch-bg-canvas + *-trigger elements

const stop = watcher.observeViewport('#hero', (detail) => {
	console.log(detail.state); // missing | above | within | below
});

// later, after adding/removing watch or trigger elements:
watcher.refresh();

// on teardown:
stop();
watcher.destroy();
```

For HTML-owned styling, point `data-canvas-watch-viewport` at an ID and call
`refresh()` once. The element owns exactly one `cw-reference-above`,
`cw-reference-within`, `cw-reference-below`, or `cw-reference-missing` class;
unrelated classes are left alone.

```html
<header class="site-header" data-canvas-watch-viewport="#hero"></header>
<section id="hero"></section>
```

ID resolution, late insertion, removal, and relevant attribute changes share
one `MutationObserver` and one frame scheduler per watcher. After `refresh()`
enables declarative discovery, that observer remains until `destroy()` so a
later declarative element can be found; mutation batches still cause at most one
declarative scan per frame.

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
to guard `typeof window`). Options are validated before observers or listeners
are allocated: thresholds must be finite and between 0 and 1, margins finite,
selectors valid, and class mappings single tokens.

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

| Method                                | Description                                                               |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `refresh()`                           | Re-scan watch, trigger, and declarative viewport elements.                |
| `watch(el)`                           | Manually register an overlap element. Returns an `unwatch()` function.    |
| `observeViewport(reference, listener)` | Subscribe to vertical viewport state. Returns an `unsubscribe()` function. |
| `schedule()`                          | Force a recompute on the next frame.                                      |
| `destroy()`                           | Cancel work, disconnect observers, clear registrations and owned classes. |

Each `watch()` and `observeViewport()` call owns an independent, idempotent
disposer, even when the element or callback is repeated. `destroy()` is terminal:
all later calls and queued deliveries stay inert. A consumer listener exception
is reported through the browser's error reporting path without preventing
healthy sibling listeners or resource cleanup.

The core also exports the pure helpers `overlapArea(a, b)`,
`resolveAppliedClass(triggerClass, opts)` and
`pickWinningClass(totals, area, threshold)` — the last being the winner rule
itself, taking a `Map<appliedClass, ZoneOverlap | ZoneOverlap[]>` so physical
coverage can remain qualified by depth — plus
`classifyViewportRect(rect, viewportTop, viewportBottom)`, and the
shared-singleton helpers `getSharedWatcher()` / `refreshCanvasWatch()` that the
Svelte adapter and the Angular directive above are built on. ESM and CJS entries
join the same live singleton in one JavaScript realm; destroying it makes the
next call acquire a new watcher.

### Types

```ts
interface CanvasChangeDetail {
	appliedClass: string | null;
	previousClass: string | null;
}

interface ViewportChangeDetail {
	state: 'unknown' | 'missing' | 'above' | 'within' | 'below';
	previousState: ViewportState;
	reference: `#${string}` | Element;
	element: Element | null;
	aboveViewport: boolean;
	inViewport: boolean;
	belowViewport: boolean;
	missing: boolean;
}
```

---

## How it works

1. **Visibility gate.** Each watched element is tracked by an
   `IntersectionObserver`; only on-screen elements are measured. Trigger zones
   are tracked by a second observer (with `triggerRootMargin`) so only zones
   near the viewport are considered.
2. **Single rAF loop.** Scroll, resize, DOM mutation, `ResizeObserver`, and
   observer callbacks all funnel into one coalesced `requestAnimationFrame`. At
   most one recompute runs per frame.
3. **Read, commit, then notify.** Per frame, every unique element rect is read
   **once**. Classes, ownership, and observer targets are committed before any
   consumer callback runs, so reentrant teardown cannot resurrect stale work.
4. **Minimal DOM churn.** A class is only added/removed when the winning zone
   actually changes, so scrolling within one zone touches the DOM zero times.
5. **Idle pages cost nothing.** With no visible overlap work and no viewport
   registrations, scroll frames short-circuit before scheduling any work.

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
- **Stacking is not considered.** Overlap ignores `z-index`; among zones at the
  same nesting depth the larger overlap wins, which may not be the element
  painted on top. DOM nesting, not paint order, is what promotes a zone.
- **Dynamic triggers need `refresh()`.** Trigger zones are indexed on `refresh()`
   (and at adapter mount / `refreshCanvasWatch()`), not continuously observed for
   class changes.
- **Geometry is layout-based.** Viewport state uses the layout viewport and
  ignores horizontal position. Canvas overlap uses bounding rectangles; it does
  not model occlusion, clipping, opacity, or `z-index`. Direct references must
  belong to the watcher's document. Document selectors do not cross into shadow
  roots, though a direct viewport reference inside one is supported.
- **Unobservable motion needs `schedule()`.** Scroll, resize, relevant DOM
  mutations, target resizing, and viewport-boundary crossings invalidate state.
  Call `schedule()` after motion that changes geometry without producing one of
  those signals.

---

## Browser support

`IntersectionObserver`, `ResizeObserver`, `MutationObserver`,
`requestAnimationFrame`, and `CustomEvent` — all supported in every current
evergreen browser. SSR-safe:
`createCanvasWatcher` returns a no-op when `window`/`document` are absent, and
the Svelte adapter only runs on the client.

---

## License

ISC © Mark Zebley
