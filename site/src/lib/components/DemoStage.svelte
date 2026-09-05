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

	/**
	 * Six decorative surfaces, alternating dark and light so every transition
	 * flips the card's ink as well as shifting its hue. The names are arbitrary
	 * on purpose: canvas-watch has no opinion about them, it just strips the
	 * suffix and adds the prefix.
	 */
	const zones = [
		{ id: 'cw-band-indigo', note: 'deep indigo' },
		{ id: 'cw-band-butterfield', note: 'warm gold' },
		{ id: 'cw-band-merlot', note: 'deep aubergine' },
		{ id: 'cw-band-mint', note: 'pale mint' },
		{ id: 'cw-band-ember', note: 'deep oxblood' },
		{ id: 'cw-band-cyan', note: 'bright cyan' }
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

<div class="cw-demo">
	<div>
		<div
			class="cw-stage {stageTrigger}"
			bind:this={stage}
			tabindex="0"
			role="region"
			aria-label="Scrollable zone demo"
		>
			<!--
				The card is the first child on purpose. It is `position: sticky`, so it
				still occupies a slot in normal flow — a spacer above it would push the
				first band down past the sticky offset, leaving the card straddling bare
				stage canvas at rest. Starting with the card means band one begins
				directly beneath its flow slot, and it is over a real zone immediately.
			-->
			<div
				class="cw-stage__card cw-glass cw-glass--panel cw-tint cw-watched cw-demo-watch"
				{oncanvaschange}
			>
				<span class="cw-glass__surface" aria-hidden="true"></span>
				<p class="cw-glass__label font-xs letter-spacing-wide text-uppercase margin-0">
					Watched element
				</p>
				<p class="font-md font-weight-semibold margin-0">
					The panel samples the winning band's tint and ink.
				</p>
				<p class="cw-glass__label cw-readout margin-block-start-05 margin-block-end-0">
					{applied ?? 'no class applied'}
				</p>
			</div>

			{#each zones as zone (zone.id)}
				<!-- `-demozone` drives this section's own threshold-configurable watcher.
				     `data-zone` is read by the proxy-trigger effect above, which hands the
				     visible band up to the page-level watcher behind the header. -->
				<div data-zone={zone.id} class="cw-stage__zone {zone.id} {zone.id}-demozone">
					<code>.{zone.id}-demozone</code>
				</div>
			{/each}

			<div class="cw-stage__spacer"></div>
		</div>

		<div class="display-flex gap-05 margin-block-start-1">
			<zbk-button variant="outline sm" onclick={() => scrollStage(-1)}>Scroll up</zbk-button>
			<zbk-button variant="outline sm" onclick={() => scrollStage(1)}>Scroll down</zbk-button>
		</div>
	</div>

	<div>
		<div class="cw-panel">
			<label class="display-block font-sm font-weight-semibold" for="cw-threshold">
				threshold — {threshold.toFixed(2)}
			</label>
			<input
				id="cw-threshold"
				class="cw-range margin-block-start-05"
				type="range"
				min="0.1"
				max="1"
				step="0.05"
				bind:value={threshold}
			/>
			<p class="font-xs ink-app-muted margin-block-start-05 margin-block-end-105">
				How much of the card must sit over a band before that band's class applies.
			</p>

			<p class="font-xs letter-spacing-wide text-uppercase ink-app-muted margin-0">Applied class</p>
			<p class="cw-readout font-md font-weight-semibold margin-0" aria-live="polite">
				{applied ?? '— none —'}
			</p>
		</div>

		<div class="cw-measure margin-block-start-105">
			<p class="font-sm margin-block-end-1">
				The card is a translucent lens. Its winning <code>over-*</code> class supplies a tinted
				scrim in the band's hue as well as the ink above it. Every pairing was measured through
				that composite: body and label ink clear 4.5:1, and the border clears 3:1, on all six.
			</p>
			<p class="font-sm ink-app-muted margin-0">
				Scroll the page — not the frame — until the header passes over these bands, and it picks
				them up too. The bands can't be page triggers directly, though: canvas-watch compares
				unclipped rectangles, so a band scrolled out of this frame still reports a rect where it
				would have been, and the header would tint from a band that isn't on screen. The frame
				itself carries the trigger instead, relabelled as you scroll — the same proxy any zone
				inside a scroller needs.
			</p>
		</div>
	</div>
</div>
