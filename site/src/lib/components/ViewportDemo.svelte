<script>
	import { canvasWatch } from '@mzebley/canvas-watch/svelte';

	const beacon = canvasWatch('#viewport-beacon');
	let showBeacon = $state(true);

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
	<div class="cw-viewport-demo__hud">
		<div class="cw-viewport-demo__grid" aria-hidden="true"></div>
		<div class="cw-viewport-demo__glow" aria-hidden="true"></div>

		<div class="cw-viewport-demo__status">
			<p class="cw-viewport-demo__eyebrow">Live viewport signal</p>
			<p class="cw-viewport-demo__state">{stateLabel}</p>
			<p class="cw-viewport-demo__description">{stateDescription}</p>
		</div>

		<div class="cw-viewport-demo__readout" aria-hidden="true">
			<span class:active={beacon.aboveViewport}>aboveViewport</span>
			<span class:active={beacon.inViewport}>inViewport</span>
			<span class:active={beacon.belowViewport}>belowViewport</span>
			<span class:active={beacon.missing}>missing</span>
		</div>

		<div class="cw-viewport-demo__frame" aria-hidden="true">
			<span class="cw-viewport-demo__edge cw-viewport-demo__edge--top">viewport top</span>
			<span class="cw-viewport-demo__crosshair"></span>
			<span class="cw-viewport-demo__edge cw-viewport-demo__edge--bottom">viewport bottom</span>
		</div>

		<button
			type="button"
			class="cw-viewport-demo__toggle"
			onclick={() => (showBeacon = !showBeacon)}
		>
			{showBeacon ? 'Remove the reference' : 'Restore the reference'}
		</button>
	</div>

	{#if showBeacon}
		<div id="viewport-beacon" class="cw-viewport-demo__beacon">
			<span>Reference</span>
			<code>#viewport-beacon</code>
		</div>
	{/if}
</div>
