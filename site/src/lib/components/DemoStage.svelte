<script>
	/**
	 * The interactive playground.
	 *
	 * It runs its own watcher rather than the shared one, because `threshold` is
	 * a construction option and this demo lets you change it. Its selectors are
	 * deliberately distinct (`-demozone`, not `-trigger`) so the page-level
	 * watcher driving the header never sees these zones — two independent
	 * watchers, one page, no interference.
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
	class="cw-stage"
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
		<div class="cw-stage__zone {zone.canvas} {zone.ink} {zone.canvas}-demozone">
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
