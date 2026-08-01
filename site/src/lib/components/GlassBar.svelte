<script>
	import { watchBgCanvas } from '@mzebley/canvas-watch/svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	/**
	 * A duplicate of the site header, dressed in liquid glass, for side-by-side
	 * review.
	 *
	 * `variant="surface"` puts the glass on the bar itself — pure refraction, no
	 * frost, so the content behind reads straight through.
	 * `variant="controls"` keeps the bar nearly clear and gives each control its
	 * own frosted glass pill.
	 *
	 * Either way the ink has to adapt: with a near-transparent bar the text is
	 * effectively sitting on the zone itself, so `--cw-glass-ink` is set per
	 * `over-*` class in app.css and measured against each zone.
	 */
	let { variant = 'surface', label = '', offset = '0.75rem' } = $props();

	let applied = $state(/** @type {string | null} */ (null));
	const zone = $derived(applied ? applied.replace(/^over-/, '') : null);
</script>

<div
	class="cw-glassbar cw-glassbar--{variant} cw-watched"
	style="--cw-glassbar-offset: {offset}"
	use:watchBgCanvas={{ onChange: (detail) => (applied = detail.appliedClass) }}
>
	<span class="cw-glassbar__pill cw-glassbar__mark">
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none">
			<rect x="1" y="3" width="22" height="8" rx="2" fill="currentColor" opacity="0.28" />
			<rect x="1" y="13" width="22" height="8" rx="2" fill="currentColor" opacity="0.55" />
			<rect
				x="5.5"
				y="8"
				width="13"
				height="8"
				rx="2.5"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			/>
		</svg>
		<strong>canvas-watch</strong>
	</span>

	<span class="cw-glassbar__spacer">
		<span class="cw-readout" aria-hidden="true">{zone ? `over: ${zone}` : 'over: —'}</span>
	</span>

	{#if label}
		<span class="cw-glassbar__tag">{label}</span>
	{/if}

	<span class="cw-glassbar__pill cw-glassbar__control">
		<ThemeToggle />
	</span>
</div>
