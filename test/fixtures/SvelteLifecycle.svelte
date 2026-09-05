<script>
	import { canvasWatch, watchBgCanvas } from '../../src/svelte/index.ts';

	let visible = $state(true);
	const first = canvasWatch('#target');
	const second = canvasWatch('#target');
</script>

<div id="target" style="height: 100px"></div>
<button id="toggle" onclick={() => (visible = !visible)}>Toggle consumers</button>

{#if visible}
	<div class="zone-trigger" style="position: fixed; inset: 0; pointer-events: none"></div>
	<div id="watched" style="position: fixed; top: 0; width: 100px; height: 100px; pointer-events: none" use:watchBgCanvas></div>
	<output id="state">{first.state}:{second.state}</output>
{/if}
