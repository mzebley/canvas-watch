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

	'install-npmrc': {
		lang: 'ini',
		label: '.npmrc',
		code: `registry=https://registry.npmjs.org
@mzebley:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${GITHUB_PACKAGES_TOKEN}`
	},

	'install-github': {
		lang: 'bash',
		label: 'shell',
		code: `# One-time login with a classic token that has read:packages
npm login --scope=@mzebley --auth-type=legacy --registry=https://npm.pkg.github.com

npm install @mzebley/canvas-watch`
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
	--shadow-color: rgb(0 0 0);
	box-shadow: 0 10px 30px -8px color-mix(in srgb, var(--shadow-color) 40%, transparent);
	transition: box-shadow 400ms ease;
}

/* canvas-brand-emphasis-trigger → over-canvas-brand-emphasis */
.card.over-canvas-brand-emphasis {
	--shadow-color: rgb(79 70 229);
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
		label: 'demo.component.ts',
		code: `import { Component } from '@angular/core';
import { CanvasWatchDirective } from '@mzebley/canvas-watch/angular';
import type { CanvasChangeDetail } from '@mzebley/canvas-watch/angular';

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
import { CanvasWatchService } from '@mzebley/canvas-watch/angular';

export class AppComponent {
	private readonly canvasWatch = inject(CanvasWatchService);

	constructor() {
		inject(Router)
			.events.pipe(filter((e) => e instanceof NavigationEnd))
			.subscribe(() => this.canvasWatch.refresh());
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
		code: `/* ✗ Does nothing. The nested var() is baked once, on :root. */
:root {
	--shadow-color: 0deg 0% 0%;
	--shadow-elevation: 0 10px 30px -8px hsl(var(--shadow-color) / 0.4);
}
.card { box-shadow: var(--shadow-elevation); }
.card.over-canvas-brand-emphasis { --shadow-color: 243deg 55% 36%; }

/* ✓ Re-declare the composite on the watched element so it re-bakes. */
.card {
	--shadow-color: 0deg 0% 0%;
	--shadow-elevation: 0 10px 30px -8px hsl(var(--shadow-color) / 0.4);
	box-shadow: var(--shadow-elevation);
}`
	}
};
