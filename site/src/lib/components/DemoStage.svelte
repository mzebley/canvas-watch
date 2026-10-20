<script>
	import { onMount } from 'svelte';
	import { refreshCanvasWatch } from '@mzebley/canvas-watch/svelte';

	/**
	 * The interactive playground.
	 *
	 * Full content width, and the zones vary horizontally as well as vertically.
	 * That second axis is the point: a single floating panel spans three cells of
	 * different colours at once, and each of its three regions is independently
	 * watched, so each takes its own ink. It is the same split the site header
	 * makes between its wordmark, readout and controls — one parent, one scroll
	 * position, three different answers.
	 *
	 * It runs its own watcher rather than the shared one, because `threshold` is
	 * a construction option and the slider changes it. Its selector is distinct
	 * (`-demozone`), so these cells are invisible to the page's own watcher.
	 */

	/**
	 * Four rows of three cells, alternating dark and light along both axes, so
	 * every region flips polarity as it travels and no two adjacent regions
	 * agree. The names are arbitrary on purpose: canvas-watch has no opinion
	 * about them, it strips the suffix and adds the prefix.
	 */
	const rows = [
		['cw-band-indigo', 'cw-band-butterfield', 'cw-band-merlot'],
		['cw-band-mint', 'cw-band-ember', 'cw-band-cyan'],
		['cw-band-merlot', 'cw-band-mint', 'cw-band-indigo'],
		['cw-band-cyan', 'cw-band-merlot', 'cw-band-butterfield']
	];

	const regions = [
		{ key: 'start', label: 'Region A' },
		{ key: 'middle', label: 'Region B' },
		{ key: 'end', label: 'Region C' }
	];

	let threshold = $state(0.5);
	/** Applied class per region, keyed as above. */
	let applied = $state({ start: null, middle: null, end: null });

	/** Short band name for a region, or null. */
	const bandOf = (/** @type {string | null} */ cls) =>
		cls ? cls.replace('over-cw-band-', '') : null;

	/**
	 * The headline: how many different inks the panel is wearing right now.
	 * It is the one number that states the feature — three regions, one scroll
	 * position, and they do not have to agree.
	 */
	const inkCount = $derived(
		new Set(Object.values(applied).filter(Boolean)).size
	);

	const stateLabel = $derived(
		inkCount === 0 ? 'No class' : inkCount === 1 ? 'One ink' : inkCount === 2 ? 'Two inks' : 'Three inks'
	);

	const stateDescription = $derived(
		inkCount === 0
			? 'No zone covers enough of any region to clear the threshold.'
			: inkCount === 1
				? 'All three regions resolved the same zone.'
				: `The panel spans a boundary, so its regions disagree and you get ${inkCount} different answers at once.`
	);

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
	 * Proxy triggers for the page-level watcher — one per column.
	 *
	 * The cells cannot carry `-trigger` themselves: canvas-watch compares
	 * *unclipped* rects, and a cell scrolled out of this frame still reports a
	 * rect where it would have been, which can cross the site header and tint
	 * it from a cell nobody can see. The documented remedy is to put the trigger
	 * on something whose rect is the visible box and relabel it as content
	 * scrolls.
	 *
	 * One proxy for the whole frame is not enough here, though: the header spans
	 * all three columns, so a single answer left its ends over the wrong colour
	 * (measured 1.05:1). So there is a proxy strip per column, each labelled
	 * with whichever cell that column currently shows at header height — which
	 * gives the header's own three regions something to disagree about.
	 */
	let proxyClasses = $state(['', '', '']);

	$effect(() => {
		let frame = 0;

		const sync = () => {
			frame = 0;
			const header = document.querySelector('.cw-header');
			if (!stage || !header) return;

			const hr = header.getBoundingClientRect();
			const sr = stage.getBoundingClientRect();
			const midpoint = (hr.top + hr.bottom) / 2;

			const next = ['', '', ''];
			// Only claim the header while it is genuinely over the frame.
			if (midpoint >= sr.top && midpoint <= sr.bottom) {
				for (const cell of stage.querySelectorAll('[data-zone]')) {
					const r = cell.getBoundingClientRect();
					if (midpoint < r.top || midpoint > r.bottom) continue;
					const column = Number(cell.getAttribute('data-column'));
					if (Number.isInteger(column)) next[column] = `${cell.getAttribute('data-zone')}-trigger`;
				}
			}

			if (next.some((cls, i) => cls !== proxyClasses[i])) {
				proxyClasses = next;
				// The classes changed, so the shared watcher has to re-index them.
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

	onMount(refreshCanvasWatch);

	/** @param {string} key */
	function onRegionChange(key) {
		/** @param {Event} event */
		return (event) => {
			applied = { ...applied, [key]: /** @type {CustomEvent} */ (event).detail.appliedClass };
		};
	}

	/** @param {number} direction */
	function scrollStage(direction) {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		stage?.scrollBy({ top: direction * 260, behavior: reduced ? 'auto' : 'smooth' });
	}
</script>

<div class="cw-demo cw-instrument">
	<div class="cw-instrument__grid" aria-hidden="true"></div>

	<div class="cw-demo__head">
		<div>
			<p class="cw-instrument__eyebrow">Live overlap signal</p>
			<p class="cw-instrument__state cw-demo__state">{stateLabel}</p>
			<p class="cw-instrument__description">{stateDescription}</p>
		</div>

		<div class="cw-instrument__badges" aria-hidden="true">
			{#each regions as region (region.key)}
				<span class="cw-instrument__badge" class:active={applied[region.key]}>
					{region.label.replace('Region ', '')} · {bandOf(applied[region.key]) ?? 'none'}
				</span>
			{/each}
		</div>
	</div>

  <div class="cw-stage-wrap">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- The tabindex is deliberate and required: this is a scrollable region, and
	     a keyboard user needs to focus it to scroll with the arrow keys. A
	     labelled role="region" makes it a navigable landmark rather than an
	     unexplained tab stop. -->
	<div
		class="cw-stage"
		bind:this={stage}
		tabindex="0"
		role="region"
		aria-label="Scrollable zone demo"
	>
		<!--
			The panel is the first child on purpose. It is `position: sticky`, so it
			still occupies a slot in normal flow — a spacer above it would push the
			first row down past the sticky offset, leaving it over bare stage canvas
			at rest. Starting with the panel means row one begins directly beneath
			its flow slot, and it is over real zones immediately.
		-->
		<div class="cw-stage__panel cw-watched">
			{#each regions as region (region.key)}
				<!--
					One parent, three independently watched children.

					Each region carries its *own* glass surface as well as its own ink,
					because a single panel-wide scrim can only take one colour and the
					regions regularly disagree — a light scrim under the light ink that
					a dark cell calls for is unreadable. Surface and ink are a pairing,
					so they have to move together, per region.
				-->
				<div
					class="cw-stage__region cw-glass cw-glass--panel cw-tint cw-demo-watch"
					oncanvaschange={onRegionChange(region.key)}
				>
					<span class="cw-glass__surface" aria-hidden="true"></span>
					<p class="cw-glass__label font-xs letter-spacing-wide text-uppercase margin-0">
						{region.label}
					</p>
					<p class="cw-readout font-sm font-weight-semibold margin-0">
						{applied[region.key]?.replace('over-cw-band-', '') ?? '—'}
					</p>
				</div>
			{/each}
		</div>

		{#each rows as row, i (i)}
			<div class="cw-stage__row">
				{#each row as zone, j (j)}
					<div data-zone={zone} data-column={j} class="cw-stage__cell {zone} {zone}-demozone">
						<code>.{zone}-demozone</code>
					</div>
				{/each}
			</div>
		{/each}

		<div class="cw-stage__spacer"></div>
	</div>

	<!--
		The proxy strips. Outside the scroller, so their rects are the visible
		column boxes rather than the clipped cells'. Invisible and inert — they
		exist only to give the page's watcher an honest zone per column.
	-->
	<div class="cw-stage__proxies" aria-hidden="true">
		{#each proxyClasses as cls, i (i)}
			<span class="cw-stage__proxy {cls}"></span>
		{/each}
	</div>
  </div>

	<div class="cw-demo__controls">
		<div class="cw-demo__control">
			<label class="cw-demo__label" for="cw-threshold">
				threshold {threshold.toFixed(2)}
			</label>
			<input
				id="cw-threshold"
				class="cw-range margin-block-start-05"
				type="range"
				min="0.1"
				max="1"
				step="0.05"
				aria-describedby="cw-threshold-hint"
				bind:value={threshold}
			/>
			<p id="cw-threshold-hint" class="cw-demo__hint">
				How much of a region must sit over a cell before that cell's class applies.
			</p>
		</div>

		<div class="cw-demo__scrollers">
			<button type="button" class="cw-instrument__control" onclick={() => scrollStage(-1)}>
				Scroll up
			</button>
			<button type="button" class="cw-instrument__control" onclick={() => scrollStage(1)}>
				Scroll down
			</button>
		</div>
	</div>
</div>

<div class="cw-measure--wide margin-block-start-2">
	<p class="font-sm margin-block-end-1">
		Nothing coordinates those three regions. They're three watched elements sharing one watcher, and
		each one resolved against the cell under itself, in the same frame.
	</p>
	<p class="font-sm ink-app-muted margin-0">
		Drag the threshold to <code>1.00</code> and a region has to sit entirely within one cell before
		it takes anything, so any region straddling a boundary falls back to no class at all. The cells
		can't be page-level triggers, incidentally, because they're inside a scroller and a clipped cell
		still reports a full-size rect. Invisible proxy strips outside the scroller carry the trigger
		instead, one per column, relabelled as you scroll.
	</p>
</div>
