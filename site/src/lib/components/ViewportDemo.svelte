<script>
	import { canvasWatch } from '@mzebley/canvas-watch/svelte';
	let showBeacon = $state(true);
	const beacon = canvasWatch('#viewport-beacon');
	const labels = { unknown: 'Waiting for a measurement', missing: 'Reference removed', above: 'Above the viewport', within: 'Inside the viewport', below: 'Below the viewport' };
</script>

<div class="cw-viewport-demo" data-state={beacon.state}>
	<div class="example-bar"><span class="live-label"><span class="live-dot" aria-hidden="true"></span>Live example</span><span>This page's actual viewport</span></div>
	<div class="viewport-demo__body">
		<div class="viewport-demo__state">
			<span class="eyebrow">#viewport-beacon</span>
			<p class="viewport-value" aria-live="polite">{labels[beacon.state]}</p>
			<div class="viewport-states" aria-label="Reference state">{#each ['below', 'within', 'above', 'missing'] as state}<span class:active={beacon.state === state} aria-current={beacon.state === state ? 'true' : undefined}>{state}</span>{/each}</div>
			<p class="small-copy">Scroll past the striped reference, or remove it. The state follows its position in this page.</p>
			<!-- svelte-ignore a11y_click_events_have_key_events (Zebkit renders a native keyboard-operable button.) -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
			<zbk-button class="cw-viewport-demo__toggle" variant="outline sm" onclick={() => showBeacon = !showBeacon}>{showBeacon ? 'Remove the reference' : 'Restore the reference'}</zbk-button>
		</div>
		<div class="viewport-demo__reference-area">
			{#if showBeacon}<div id="viewport-beacon" class="viewport-beacon"><span class="eyebrow">The reference</span><strong>Here I am.</strong><code>#viewport-beacon</code></div>{:else}<div class="viewport-missing"><span aria-hidden="true">−</span><p>The reference is out of the DOM.</p></div>{/if}
		</div>
	</div>
</div>
