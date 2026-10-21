<script>
	import { onMount, tick } from 'svelte';
	import { createCanvasWatcher } from '@mzebley/canvas-watch';

	let { id = 'hero-lab', mode = 'surfaces', compact = false, appearance = 'foreground' } = $props();
	let position = $state(50);
	let threshold = $state(50);
	let duplicate = $state(false);
	let mounted = $state(false);
	let applied = $state(null);
	let previous = $state(null);
	let secondary = $state(null);
	let changes = $state(0);
	let lab;
	let vertical = $state(false);
	let watcher;
	const mapped = $derived(mode === 'mapping');
	const result = $derived(applied ?? 'No qualifying zone');
	const zone = $derived(applied?.replace(/^(over-|on-)/, '') ?? 'unassigned');

	onMount(() => {
		threshold = mode === 'union' ? 75 : 50;
		mounted = true;
		const layout = new ResizeObserver(([entry]) => {
			vertical = entry.contentRect.width < 560;
		});
		layout.observe(lab);
		return () => { layout.disconnect(); watcher?.destroy(); };
	});

	$effect(() => {
		if (!mounted) return;
		applied = null;
		secondary = null;
		const current = createCanvasWatcher({
			watchSelector: `#${id} [data-watched]`,
			triggerSelector: `#${id} [data-zone]`,
			threshold: threshold / 100,
			...(mapped ? { classMap: { 'paper-trigger': 'on-paper', 'rose-trigger': 'on-rose', 'ink-trigger': 'on-ink' } } : {})
		});
		// Each example has its own scope; its targets share one frame scheduler.
		watcher = current;
		current.refresh();
		return () => current.destroy();
	});

	$effect(() => {
		position;
		vertical;
		if (mounted) void tick().then(() => watcher?.schedule());
	});
	$effect(() => {
		duplicate;
		if (mounted) void tick().then(() => watcher?.refresh());
	});

	function record(node) {
		const changed = (event) => {
			applied = event.detail.appliedClass;
			previous = event.detail.previousClass;
			changes += 1;
		};
		node.addEventListener('canvaschange', changed);
		return { destroy: () => node.removeEventListener('canvaschange', changed) };
	}
	function recordSecondary(node) {
		const changed = (event) => secondary = event.detail.appliedClass;
		node.addEventListener('canvaschange', changed);
		return { destroy: () => node.removeEventListener('canvaschange', changed) };
	}
</script>

<div bind:this={lab} class="overlap-lab" class:overlap-lab--compact={compact} class:overlap-lab--vertical={vertical} data-example={mode}>
	<div class="example-bar">
		<span class="live-label"><span class="live-dot" aria-hidden="true"></span>Live example</span>
		<span>{mode === 'nested' ? 'Nested backgrounds' : mode === 'union' ? 'Combined coverage' : mode === 'mapping' ? 'Your class names' : 'Background overlap'}</span>
	</div>
	<div class="lab-workspace">
	<div {id} class="lab-scene" class:lab-scene--nested={mode === 'nested'} class:lab-scene--union={mode === 'union'} style:--position={position}>
		{#if mode === 'nested'}
			<div data-zone class="lab-zone lab-zone--outer paper-trigger">
				<span class="zone-caption">paper-trigger · parent</span>
				<div data-zone class="lab-zone lab-zone--nested ink-trigger"><span class="zone-caption">ink-trigger · nested</span></div>
			</div>
		{:else if mode === 'union'}
			<div class="lab-zone lab-zone--empty"><span class="zone-caption">Two adjacent zones. One class.</span></div>
			<div data-zone class="lab-zone lab-zone--half lab-zone--half-a rose-trigger"><span class="zone-caption">rose-trigger</span></div>
			<div data-zone class="lab-zone lab-zone--half lab-zone--half-b rose-trigger"><span class="zone-caption">rose-trigger</span></div>
			{#if duplicate}<div data-zone class="lab-zone lab-zone--half lab-zone--half-a lab-zone--duplicate rose-trigger"><span class="zone-caption">Same pixels, twice</span></div>{/if}
		{:else}
			<div data-zone class="lab-zone lab-zone--paper paper-trigger"><span class="zone-caption">paper-trigger</span></div>
			<div data-zone class="lab-zone lab-zone--rose rose-trigger"><span class="zone-caption">rose-trigger</span></div>
			<div data-zone class="lab-zone lab-zone--ink ink-trigger"><span class="zone-caption">ink-trigger</span></div>
		{/if}
		<div class="lab-track" aria-hidden="true"></div>
		<div data-watched class="lab-target" class:lab-target--shadow={appearance === 'shadow'} use:record>
			{#if appearance === 'shadow'}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 5v14l11-7Z" /></svg>
				<span>Stay a little longer<span class="target-caption">A floating player</span></span>
			{:else}
				<span class="target-type" aria-hidden="true">Aa</span>
				<span class="target-copy"><span class="target-label">{compact ? 'Same element.' : mapped ? 'Your styles.' : mode === 'nested' ? 'Specific wins.' : mode === 'union' ? 'One surface.' : 'Stays readable.'}</span><span class="target-caption">{zone}</span></span>
			{/if}
		</div>
		{#if compact}<div data-watched class="lab-secondary" use:recordSecondary><span class="secondary-mark" aria-hidden="true">↗</span><span class="target-copy">Another element<span class="target-caption">{secondary ?? 'Waiting for a zone'}</span></span></div>{/if}
	</div>
	<!-- Zebkit has no range component; retain native labels and sliders. -->
	<label class="movement-label" for="{id}-position">Move the {appearance === 'shadow' ? 'player' : 'element'}<span aria-hidden="true">{vertical ? '↑ ↓' : '← →'}</span></label>
	<div class="position-control range-field"><input id="{id}-position" type="range" min="0" max="100" step="1" bind:value={position} aria-orientation={vertical ? 'vertical' : 'horizontal'} aria-valuetext={`${position}% from the ${vertical ? 'top' : 'left'}`} /></div>
	{#if !compact}<div class="threshold-control range-field"><label for="{id}-threshold">Minimum overlap <output for="{id}-threshold">{threshold}%</output></label><input id="{id}-threshold" type="range" min="10" max="100" step="5" bind:value={threshold} /></div>{/if}
	</div>
	<div class="lab-readout" aria-live="polite" aria-atomic="true"><div><span>{compact ? 'Aa' : 'Applied class'}</span><code>{result}</code></div>{#if compact}<div><span>↗</span><code>{secondary ?? 'No qualifying zone'}</code></div>{/if}</div>
	{#if mode === 'union'}<div class="lab-extra"><!-- svelte-ignore a11y_click_events_have_key_events (Zebkit renders a native keyboard-operable button.) -->
	<!-- svelte-ignore a11y_no_static_element_interactions --><zbk-button variant="outline sm" aria-pressed={duplicate} onclick={() => duplicate = !duplicate}>{duplicate ? 'Remove duplicate zone' : 'Duplicate the left zone'}</zbk-button><span>Duplicate rectangles don't add coverage.</span></div>{/if}
</div>
{#if !compact}<zbk-disclosure class="event-detail"><span slot="summary">canvaschange event · {changes} {changes === 1 ? 'change' : 'changes'}</span><pre><code>{JSON.stringify({ appliedClass: applied, previousClass: previous }, null, 2)}</code></pre></zbk-disclosure>{/if}
