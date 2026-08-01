<script>
	import { refreshCanvasWatch } from '@mzebley/canvas-watch/svelte';

	/**
	 * The interactive playground.
	 *
	 * It runs its own watcher rather than the shared one, because `threshold` is
	 * a construction option and this demo lets you change it. Its selectors are
	 * deliberately distinct (`-demozone`, not `-trigger`), so the page-level
	 * watcher never resolves these bands directly.
	 *
	 * The page's header still reacts to them, but through the proxy trigger
	 * below rather than the bands themselves — see the note there for why.
	 */

	// A pale band sits second so you scroll dark → light → dark and watch the
	// card invert, not merely re-tint.
	const zones = [
		{ canvas: 'canvas-brand-emphasis', ink: 'ink-brand-inverse' },
		{ canvas: 'canvas-brand-subtle', ink: 'ink-brand-emphasis' },
		{ canvas: 'canvas-accent-primary', ink: 'ink-accent-primary-inverse' },
		{ canvas: 'canvas-positive', ink: 'ink-positive-inverse' },
		{ canvas: 'canvas-critical', ink: 'ink-critical-inverse' },
		{ canvas: 'canvas-accent-secondary', ink: 'ink-accent-secondary-inverse' }
	];

	let threshold = $state(0.5);
	let applied = $state(/** @type {string | null} */ (null));

	/** @type {HTMLElement | undefined} */
	let stage = $state();

	// Effects run only in the browser, so the dynamic import is safe here. The
	// effect re-runs whenever `threshold` changes, tearing the old watcher down.
	$effect(() => {
		const value = threshold;
		let cancelled = false;
		/** @type {{ destroy(): void } | null} */
		let watcher = null;

		import('@mzebley/canvas-watch').then(({ createCanvasWatcher }) => {
			if (cancelled) return;
			watcher = createCanvasWatcher({
				watchSelector: '.cw-demo-watch',
				triggerSelector: '[class*="-demozone"]',
				triggerSuffix: '-demozone',
				appliedPrefix: 'over-',
				threshold: value
			});
			watcher.refresh();
		});

		return () => {
			cancelled = true;
			watcher?.destroy();
		};
	});

	/**
	 * Proxy trigger for the page-level watcher.
	 *
	 * The bands can't carry `-trigger` themselves: canvas-watch compares
	 * *unclipped* bounding rects, and a band scrolled out of this frame still
	 * reports a rect where it would have been. That rect can cross the header
	 * while the band is invisible, tinting the bar from a zone that isn't there.
	 *
	 * So the frame itself becomes the trigger — its rect is exactly the visible
	 * box — and carries the class of whichever band is actually painted behind
	 * the header. Same idea a consumer needs for any zone inside a scroller.
	 */
	let stageTrigger = $state('');

	$effect(() => {
		let frame = 0;

		const sync = () => {
			frame = 0;
			const header = document.querySelector('.cw-header');
			if (!stage || !header) return;

			const hr = header.getBoundingClientRect();
			const sr = stage.getBoundingClientRect();
			const midpoint = (hr.top + hr.bottom) / 2;

			let next = '';
			// Only claim the header while it is genuinely over the frame.
			if (midpoint >= sr.top && midpoint <= sr.bottom) {
				for (const band of stage.querySelectorAll('[data-zone]')) {
					const r = band.getBoundingClientRect();
					if (midpoint >= r.top && midpoint <= r.bottom) {
						next = `${band.getAttribute('data-zone')}-trigger`;
						break;
					}
				}
			}

			if (next !== stageTrigger) {
				stageTrigger = next;
				// The class changed, so the shared watcher has to re-index it.
				refreshCanvasWatch();
			}
		};

		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(sync);
		};

		sync();
		window.addEventListener('scroll', schedule, { passive: true, capture: true });
		window.addEventListener('resize', schedule, { passive: true });

		return () => {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener('scroll', schedule, { capture: true });
			window.removeEventListener('resize', schedule);
		};
	});

	/** @param {Event} event */
	function oncanvaschange(event) {
		applied = /** @type {CustomEvent} */ (event).detail.appliedClass;
	}

	/** @param {number} direction */
	function scrollStage(direction) {
		stage?.scrollBy({ top: direction * 240, behavior: 'smooth' });
	}
</script>

<div
	class="display-flex flex-wrap align-items-center justify-content-between gap-1 margin-block-end-1"
>
	<div>
		<label class="display-block font-sm font-weight-semibold" for="cw-threshold">
			threshold — {threshold.toFixed(2)}
		</label>
		<input
			id="cw-threshold"
			class="cw-range"
			type="range"
			min="0.1"
			max="1"
			step="0.05"
			bind:value={threshold}
		/>
		<p class="font-xs ink-app-muted margin-0 measure-2">
			How much of the card must sit over a zone before that zone's class applies.
		</p>
	</div>

	<div class="text-right">
		<p class="font-xs letter-spacing-wide text-uppercase ink-app-muted margin-0">Applied class</p>
		<p class="cw-readout font-md font-weight-semibold margin-0" aria-live="polite">
			{applied ?? '— none —'}
		</p>
	</div>
</div>

<div
	class="cw-stage {stageTrigger}"
	bind:this={stage}
	tabindex="0"
	role="region"
	aria-label="Scrollable zone demo"
>
	<div class="cw-stage__spacer"></div>

	<div class="cw-stage__card cw-watched cw-demo-watch" {oncanvaschange}>
		<p class="font-xs letter-spacing-wide text-uppercase ink-app-muted margin-0">Watched element</p>
		<p class="font-md font-weight-semibold margin-0">It restyles itself for whatever's behind it.</p>
		<p class="cw-readout ink-app-muted margin-block-start-05 margin-block-end-0">
			{applied ?? 'no class applied'}
		</p>
	</div>

	{#each zones as zone (zone.canvas)}
		<!-- `-demozone` drives this section's own threshold-configurable watcher.
		     `data-zone` is read by the proxy-trigger effect above, which hands the
		     visible band up to the page-level watcher behind the header. -->
		<div
			data-zone={zone.canvas}
			class="cw-stage__zone {zone.canvas} {zone.ink} {zone.canvas}-demozone"
		>
			<code>.{zone.canvas}-demozone</code>
		</div>
	{/each}

	<div class="cw-stage__spacer"></div>
</div>

<div class="display-flex gap-05 justify-content-center margin-block-start-1">
	<zbk-button variant="outline sm" onclick={() => scrollStage(-1)}>Scroll up</zbk-button>
	<zbk-button variant="outline sm" onclick={() => scrollStage(1)}>Scroll down</zbk-button>
</div>

<style>
	.cw-range {
		inline-size: min(18rem, 100%);
		accent-color: var(--zbk-action-ink);
	}
</style>
