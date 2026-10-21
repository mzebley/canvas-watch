<script>
	import { onMount } from 'svelte';
	let scale = $state(100);
	let decrease = $state();
	let increase = $state();
	let buttonsReady = $state(false);
	onMount(() => {
		try {
			const saved = Number(localStorage.getItem('canvas-watch-font-size'));
			if ([100, 125, 150, 175, 200].includes(saved)) scale = saved;
		} catch { /* Text controls still work when storage is unavailable. */ }
		let active = true;
		void customElements.whenDefined('zbk-button').then(async () => {
			await Promise.all([decrease?.updateComplete, increase?.updateComplete]);
			if (active) buttonsReady = true;
		});
		return () => { active = false; };
	});
	$effect(() => {
		document.documentElement.style.fontSize = `${scale}%`;
		for (const [button, disabled] of [[decrease, scale <= 100], [increase, scale >= 200]]) {
			if (!button) continue;
			// Attributes cover prerendering; properties keep the upgraded native control in sync.
			if (buttonsReady) button.disabled = disabled;
			else button.toggleAttribute('disabled', disabled);
		}
		try { localStorage.setItem('canvas-watch-font-size', String(scale)); } catch { /* Optional persistence. */ }
	});
</script>

<div class="font-control" role="group" aria-label="Font size">
	<!-- svelte-ignore a11y_click_events_have_key_events (Zebkit renders a native keyboard-operable button.) -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<zbk-button variant="ghost sm flat" aria-label="Decrease font size" bind:this={decrease} disabled onclick={() => scale = Math.max(100, scale - 25)}>−</zbk-button>
	<span aria-live="polite"><span aria-hidden="true">T<span class="font-control__small">T</span></span><span class="visually-hidden">Font size: {scale}%</span></span>
	<!-- svelte-ignore a11y_click_events_have_key_events (Zebkit renders a native keyboard-operable button.) -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<zbk-button variant="ghost sm flat" aria-label="Increase font size" bind:this={increase} onclick={() => scale = Math.min(200, scale + 25)}>+</zbk-button>
</div>
