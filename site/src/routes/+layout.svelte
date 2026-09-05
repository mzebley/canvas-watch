<script>
	import { onMount } from 'svelte';
	import { canvasWatch, watchBgCanvas } from '@mzebley/canvas-watch/svelte';
	import { syncThemeFromDocument } from '$lib/theme.svelte.js';
	import { defineZebkit } from '$lib/zebkit/define.js';
	import GlassFilters from '$lib/components/GlassFilters.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import '../app.css';

	let { children } = $props();
	const hero = canvasWatch('#hero');

	/**
	 * The header is a real canvas-watch consumer, and it registers *twice*.
	 *
	 * A bar spanning the full content width regularly straddles two zones — a pale
	 * band under its left half, a dark page under its right. One element can only
	 * carry one ink, so whichever zone wins leaves the other half's text on the
	 * wrong background. Each cluster of bar content is therefore its own watched
	 * element with its own `over-*` class, resolved from the same shared watcher in
	 * the same frame.
	 *
	 * The bar itself carries no `*-trigger` class, so it is invisible to the
	 * watcher: these groups measure against the page's zones, not against the bar
	 * they sit inside.
	 */
	let endApplied = $state(/** @type {string | null} */ (null));

	/** @type {HTMLElement | undefined} */
	let endEl = $state();

	// The readout reports the zone under the *end* group, which is where it is
	// physically sitting — so it describes its own colour, not the far side's.
	const zoneLabel = $derived(endApplied ? endApplied.replace(/^over-/, '') : null);

	onMount(() => {
		syncThemeFromDocument();
		defineZebkit();

		/*
		 * Seed the readout from the DOM.
		 *
		 * The watcher's first pass runs in a requestAnimationFrame, and on a load
		 * that lands mid-page (an anchor link, or a restored scroll position) it can
		 * apply the class before this component is listening. The element was then
		 * visibly tinted while the readout still said "—". `onChange` stays the real
		 * mechanism — this only catches the state that predates it.
		 */
		let frames = 0;
		let raf = 0;
		const seed = () => {
			if (endApplied === null && endEl) {
				const found = [...endEl.classList].find((c) => c.startsWith('over-'));
				if (found) {
					endApplied = found;
					return;
				}
			}
			if (endApplied === null && frames++ < 3) raf = requestAnimationFrame(seed);
		};
		raf = requestAnimationFrame(seed);

		return () => cancelAnimationFrame(raf);
	});
</script>

<GlassFilters />

<div class="cw-page">
	<a class="cw-skip-link" href="#top">Skip to content</a>

	<!--
		The bar is one glass surface (`.cw-glass`) with one shadow (`.cw-watched`) —
		both are whole-bar properties. Only the *ink* is split, into two independently
		watched `.cw-tint` groups.
	-->
	<!-- The bar stays registered in its own right: the shadow and border are
	     whole-bar properties, so they take the whole bar's answer. -->
	<header class="cw-header cw-glass cw-watched" use:watchBgCanvas>
		<span class="cw-glass__surface" aria-hidden="true"></span>

		<!-- No onChange: this group's tint is driven entirely by the class the
		     watcher puts on it. Only the readout needs the value in JS. -->
		<div class="cw-header__group cw-tint" use:watchBgCanvas>
			<a class="cw-mark" href="#top">
				<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none">
					<rect x="1" y="3" width="22" height="8" rx="2" fill="currentColor" opacity="0.28" />
					<rect x="1" y="13" width="22" height="8" rx="2" fill="currentColor" opacity="0.55" />
					<rect
						x="5.5"
						y="8"
						width="13"
						height="8"
						rx="2.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					/>
				</svg>
				canvas-watch
			</a>
		</div>

		<div class="cw-header__spacer"></div>

		<div
			class="cw-header__group cw-header__group--end cw-tint"
			bind:this={endEl}
			use:watchBgCanvas={{ onChange: (detail) => (endApplied = detail.appliedClass) }}
		>
			<!-- No ink-* utility here: the bar is glass, so its colour has to come
			     from the adaptive `--cw-glass-ink`, not a fixed token. -->
			<p class="cw-readout margin-0" aria-hidden="true">
				{zoneLabel ? `over: ${zoneLabel}` : 'over: —'} · hero:
				{hero.aboveViewport
					? 'above'
					: hero.inViewport
						? 'within'
						: hero.belowViewport
							? 'below'
							: hero.missing
								? 'missing'
								: 'unknown'}
			</p>

			<zbk-link
				href="https://github.com/mzebley/canvas-watch"
				target="_blank"
				rel="noopener"
				variant="subtle"
			>
				<svg
					slot="icon"
					data-position="start"
					width="18"
					height="18"
					viewBox="0 0 16 16"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
					/>
				</svg>
				<span class="visually-hidden">canvas-watch on GitHub</span>
			</zbk-link>

			<ThemeToggle />
		</div>
	</header>

	{@render children()}

	<footer class="canvas-brand-muted ink-brand padding-block-2 padding-inline-105">
		<div
			class="cw-shell display-flex flex-wrap gap-1 align-items-center justify-content-between"
		>
			<p class="font-sm margin-0">
				<strong>canvas-watch</strong> — ISC licensed, by
				<zbk-link href="https://markzebley.com" target="_blank" rel="noopener">Mark Zebley</zbk-link>
			</p>
			<div class="display-flex gap-1 flex-wrap align-items-center">
				<zbk-link href="https://github.com/mzebley/canvas-watch" target="_blank" rel="noopener">
					GitHub
				</zbk-link>
				<zbk-link
					href="https://www.npmjs.com/package/@mzebley/canvas-watch"
					target="_blank"
					rel="noopener"
				>
					npm
				</zbk-link>
				<zbk-link href="https://dynamowaves.markzebley.com" target="_blank" rel="noopener">
					dynamowaves
				</zbk-link>
			</div>
		</div>
	</footer>
</div>
