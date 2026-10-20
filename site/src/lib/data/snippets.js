/**
 * Every code sample on the page, in one place.
 *
 * `+page.server.js` runs these through Shiki at build time, so the browser
 * never downloads a highlighter. Keep `lang` to languages Shiki knows.
 */

/** @typedef {{ lang: string, label?: string, code: string }} Snippet */

/** @type {Record<string, Snippet>} */
export const snippets = {
	'install-npm': {
		lang: 'bash',
		label: 'shell',
		code: `npm install @mzebley/canvas-watch`
	},

	quickstart: {
		lang: 'svelte',
		label: 'Page.svelte',
		code: `<script>
	import { watchBgCanvas } from '@mzebley/canvas-watch/svelte';
</script>

<!-- A background zone -->
<section class="canvas-brand-emphasis-trigger">…</section>

<!-- A floating element that reacts to it -->
<div class="card" use:watchBgCanvas>…</div>`
	},

	'quickstart-css': {
		lang: 'css',
		label: 'styles.css',
		code: `.card {
	background: rgb(255 255 255);
	color: rgb(15 15 20);
	--shadow-color: rgb(0 0 0);
	box-shadow: 0 10px 30px -8px color-mix(in srgb, var(--shadow-color) 40%, transparent);
	transition: background 400ms ease, color 400ms ease, box-shadow 400ms ease;
}

/* canvas-brand-emphasis-trigger → over-canvas-brand-emphasis */
.card.over-canvas-brand-emphasis {
	--shadow-color: rgb(79 70 229);
}

/* Nothing says it has to be a shadow. Over a pale zone, invert the
   whole card so it still reads. Check the contrast of what you flip. */
.card.over-canvas-paper {
	background: rgb(31 27 92);
	color: rgb(226 224 250);
	--shadow-color: rgb(31 27 92);
}`
	},

	'svelte-action': {
		lang: 'svelte',
		label: 'Card.svelte',
		code: `<script>
	import { watchBgCanvas } from '@mzebley/canvas-watch/svelte';

	let tint = $state(null);
</script>

<div
	class="card"
	use:watchBgCanvas={{ onChange: (detail) => (tint = detail.appliedClass) }}
>
	Currently over: {tint ?? 'nothing'}
</div>`
	},

	'svelte-viewport': {
		lang: 'svelte',
		label: 'Header.svelte',
		code: `<script>
	import { canvasWatch } from '@mzebley/canvas-watch/svelte';
	const hero = canvasWatch('#hero');
</script>

<header class:past-hero={hero.aboveViewport}>
	{hero.missing ? 'Hero not found' : hero.state}
</header>
<section id="hero">…</section>`
	},

	'svelte-navigate': {
		lang: 'svelte',
		label: '+layout.svelte',
		code: `<script>
	import { afterNavigate } from '$app/navigation';
	import { tick } from 'svelte';
	import { refreshCanvasWatch } from '@mzebley/canvas-watch/svelte';

	afterNavigate(async () => {
		await tick(); // let the new page's DOM render first
		refreshCanvasWatch();
	});
</script>`
	},

	'angular-directive': {
		lang: 'ts',
		label: 'canvas-watch.directive.ts',
		code: `import {
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

@Directive({
	selector: '[canvasWatch]',
	standalone: true,
})
export class CanvasWatchDirective implements OnInit, OnDestroy {
	@Output() canvasChange = new EventEmitter<CanvasChangeDetail>();

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly zone = inject(NgZone);
	private unwatch?: () => void;

	private readonly listener = (event: Event): void => {
		const detail = (event as CustomEvent<CanvasChangeDetail>).detail;
		// Re-enter the zone only when a change actually fires (rare), so change
		// detection runs for consumers without paying for it on every scroll.
		this.zone.run(() => this.canvasChange.emit(detail));
	};

	ngOnInit(): void {
		const node = this.host.nativeElement;
		// Register outside the zone: the shared watcher is created lazily on first
		// use, and its scroll listener + rAF loop must not be zone-patched —
		// otherwise every scroll event app-wide triggers change detection.
		this.zone.runOutsideAngular(() => {
			this.unwatch = getSharedWatcher().watch(node);
			// Pick up trigger zones already in the DOM (coalesced across mounts).
			scheduleRefresh();
			node.addEventListener('canvaschange', this.listener);
		});
	}

	ngOnDestroy(): void {
		this.host.nativeElement.removeEventListener('canvaschange', this.listener);
		this.unwatch?.();
	}
}`
	},

	'angular-usage': {
		lang: 'ts',
		label: 'demo.component.ts',
		code: `import { Component } from '@angular/core';
import type { CanvasChangeDetail } from '@mzebley/canvas-watch';
import { CanvasWatchDirective } from './canvas-watch.directive';

@Component({
	standalone: true,
	imports: [CanvasWatchDirective],
	template: \`
		<section class="canvas-brand-emphasis-trigger">…</section>
		<div class="card" canvasWatch (canvasChange)="onTint($event)">…</div>
	\`,
})
export class DemoComponent {
	onTint(detail: CanvasChangeDetail) {
		// detail.appliedClass / detail.previousClass
	}
}`
	},

	'angular-refresh': {
		lang: 'ts',
		label: 'app.component.ts',
		code: `import { inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { refreshCanvasWatch } from '@mzebley/canvas-watch';

export class AppComponent {
	constructor() {
		inject(Router)
			.events.pipe(filter((e) => e instanceof NavigationEnd))
			.subscribe(() => refreshCanvasWatch());
	}
}`
	},

	'vanilla-core': {
		lang: 'ts',
		label: 'main.ts',
		code: `import { createCanvasWatcher } from '@mzebley/canvas-watch';

const watcher = createCanvasWatcher();

// Scan the DOM for .watch-bg-canvas elements and *-trigger zones.
watcher.refresh();

// …after adding or removing watched/trigger elements:
watcher.refresh();

// …on teardown:
watcher.destroy();`
	},

	'vanilla-markup': {
		lang: 'html',
		label: 'index.html',
		code: `<section class="canvas-brand-emphasis-trigger">…</section>

<div class="card watch-bg-canvas">…</div>`
	},

	'viewport-markup': {
		lang: 'html',
		label: 'index.html',
		code: `<header class="site-header" data-canvas-watch-viewport="#hero"></header>
<section id="hero"></section>`
	},

	'viewport-core': {
		lang: 'ts',
		label: 'main.ts',
		code: `const stop = watcher.observeViewport('#hero', (detail) => {
	console.log(detail.state); // missing | above | within | below
});

// Later
stop();`
	},

	'vanilla-event': {
		lang: 'ts',
		label: 'main.ts',
		code: `el.addEventListener('canvaschange', (e) => {
	console.log(e.detail.appliedClass, e.detail.previousClass);
});`
	},

	options: {
		lang: 'ts',
		label: 'main.ts',
		code: `createCanvasWatcher({
	classMap: { 'hero-trigger': 'on-hero' }, // hero-trigger → on-hero
	threshold: 0.6,
});`
	},

	'gotcha-shadow': {
		lang: 'css',
		label: 'The composed-token trap',
		code: `/* Does nothing. The nested var() is baked once, on :root. */
:root {
	--shadow-color: 0deg 0% 0%;
	--shadow-elevation: 0 10px 30px -8px hsl(var(--shadow-color) / 0.4);
}
.card { box-shadow: var(--shadow-elevation); }
.card.over-canvas-brand-emphasis { --shadow-color: 243deg 55% 36%; }

/* Works. Re-declare the composite on the watched element so it re-bakes. */
.card {
	--shadow-color: 0deg 0% 0%;
	--shadow-elevation: 0 10px 30px -8px hsl(var(--shadow-color) / 0.4);
	box-shadow: var(--shadow-elevation);
}`
	},

	/* ── Code behind the two live demos on this page ─────────────────────────
	 * These must stay in step with DemoStage.svelte and ViewportDemo.svelte.
	 * They are trimmed of presentation detail, not of API detail.
	 */

	'demo-overlap-markup': {
		lang: 'html',
		label: 'The stage',
		code: `<!-- One panel, one shadow, one glass surface — and three regions
     that each resolve their own ink. Only the regions are watched;
     the panel itself is not. -->
<div class="cw-stage">
	<div class="cw-stage__panel cw-glass cw-watched">
		<div class="cw-stage__region cw-tint cw-demo-watch">…</div>
		<div class="cw-stage__region cw-tint cw-demo-watch">…</div>
		<div class="cw-stage__region cw-tint cw-demo-watch">…</div>
	</div>

	<!-- Zones vary across the row as well as down the stack, so a region
	     at one end can be over a different colour from its neighbour. -->
	<div class="cw-stage__row">
		<div class="cw-stage__cell cw-band-indigo-demozone">…</div>
		<div class="cw-stage__cell cw-band-butterfield-demozone">…</div>
		<div class="cw-stage__cell cw-band-merlot-demozone">…</div>
	</div>
</div>`
	},

	'demo-overlap-js': {
		lang: 'js',
		label: 'DemoStage.svelte',
		code: `import { createCanvasWatcher } from '@mzebley/canvas-watch';

// This demo owns a watcher instead of the shared one, because the
// threshold slider rebuilds it — threshold is a construction option.
const watcher = createCanvasWatcher({
	watchSelector: '.cw-demo-watch',
	triggerSelector: '[class*="-demozone"]',
	triggerSuffix: '-demozone',
	appliedPrefix: 'over-',
	threshold // 0.1 – 1, live from the slider
});

watcher.refresh();

// cw-band-merlot-demozone  →  over-cw-band-merlot
//
// All three regions share this one watcher and resolve in the same
// frame. Nothing coordinates them; each simply measures itself.`
	},

	'demo-overlap-css': {
		lang: 'css',
		label: 'app.css (abridged)',
		code: `/* The card reads two variables; the winning class supplies them. */
.cw-tint {
	color: var(--cw-glass-ink, var(--zbk-app-ink));
	transition: color 400ms cubic-bezier(0.22, 1, 0.36, 1);
}

.cw-glass__surface::after {
	background-color: color-mix(
		in srgb,
		var(--cw-glass-tint) var(--cw-glass-tint-strength, 14%),
		transparent
	);
}

/* One pairing per band. Dark band, light ink — and the reverse. */
.cw-glass.over-cw-band-merlot,
.cw-tint.over-cw-band-merlot {
	--cw-glass-tint: hsl(320 55% 6%);
	--cw-glass-ink: hsl(320 55% 96%);
}

.cw-glass.over-cw-band-butterfield,
.cw-tint.over-cw-band-butterfield {
	--cw-glass-tint: hsl(48 45% 94%);
	--cw-glass-ink: hsl(48 70% 10%);
}`
	},

	'demo-viewport': {
		lang: 'svelte',
		label: 'ViewportDemo.svelte',
		code: `<script>
	import { canvasWatch } from '@mzebley/canvas-watch/svelte';

	// 'unknown' until the first client measurement, then
	// 'above' | 'within' | 'below' | 'missing'.
	const beacon = canvasWatch('#viewport-beacon');
</script>

<p>{beacon.state}</p>

<!-- Remove this element and the state becomes 'missing'. -->
<div id="viewport-beacon">Reference</div>`
	}
};
