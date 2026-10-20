<script>
	import { onMount, tick } from 'svelte';
	import { canvasWatch, refreshCanvasWatch } from '@mzebley/canvas-watch/svelte';

	const beacon = canvasWatch('#viewport-beacon');
	let showBeacon = $state(true);

	/**
	 * The beacon is a bright conic gradient that physically scrolls behind the
	 * floating header, where the header's light ink drops to roughly 1.2:1. It
	 * is a background the bar passes over, so it gets a trigger class like any
	 * other — and because it is added and removed by the toggle below, the
	 * shared watcher has to re-index each time.
	 */
	onMount(refreshCanvasWatch);

	async function toggleBeacon() {
		showBeacon = !showBeacon;
		await tick();
		refreshCanvasWatch();
	}

	const stateLabel = $derived(
		beacon.state === 'within'
			? 'In view'
			: beacon.state === 'above'
				? 'Above'
				: beacon.state === 'below'
					? 'Below'
					: beacon.state === 'missing'
						? 'Missing'
						: 'Resolving'
	);

	const stateDescription = $derived(
		beacon.state === 'within'
			? 'The reference intersects the viewport now.'
			: beacon.state === 'above'
				? 'Its bottom edge has crossed the viewport top.'
				: beacon.state === 'below'
					? 'Its top edge has not reached the viewport bottom yet.'
					: beacon.state === 'missing'
						? 'The ID is absent from the document.'
						: 'Waiting for the first client measurement.'
	);
</script>

<div class="cw-viewport-demo" data-state={beacon.state}>
	<div class="cw-viewport-demo__hud cw-instrument">
		<div class="cw-instrument__grid" aria-hidden="true"></div>
		<div class="cw-viewport-demo__glow" aria-hidden="true"></div>

		<div class="cw-viewport-demo__status">
			<p class="cw-instrument__eyebrow">Live viewport signal</p>
			<p class="cw-instrument__state cw-viewport-demo__state">{stateLabel}</p>
			<p class="cw-instrument__description">{stateDescription}</p>
		</div>

		<div class="cw-viewport-demo__readout cw-instrument__badges" aria-hidden="true">
			<span class="cw-instrument__badge" class:active={beacon.aboveViewport}>aboveViewport</span>
			<span class="cw-instrument__badge" class:active={beacon.inViewport}>inViewport</span>
			<span class="cw-instrument__badge" class:active={beacon.belowViewport}>belowViewport</span>
			<span class="cw-instrument__badge" class:active={beacon.missing}>missing</span>
		</div>

		<div class="cw-viewport-demo__frame" aria-hidden="true">
			<span class="cw-viewport-demo__edge cw-viewport-demo__edge--top">viewport top</span>
			<span class="cw-viewport-demo__crosshair"></span>
			<span class="cw-viewport-demo__edge cw-viewport-demo__edge--bottom">viewport bottom</span>
		</div>

		<button type="button" class="cw-viewport-demo__toggle cw-instrument__control" onclick={toggleBeacon}>
			{showBeacon ? 'Remove the reference' : 'Restore the reference'}
		</button>
	</div>

	{#if showBeacon}
		<div id="viewport-beacon" class="cw-viewport-demo__beacon cw-beacon-trigger">
			<span>Reference</span>
			<code>#viewport-beacon</code>
		</div>
	{/if}
</div>
