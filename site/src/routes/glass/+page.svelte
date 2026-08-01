<script>
	import GlassBar from '$lib/components/GlassBar.svelte';
	import GlassFilters from '$lib/components/GlassFilters.svelte';

	/**
	 * Side-by-side review of two liquid-glass treatments for the site header.
	 * Not linked from the site — it exists to be looked at and then thrown away
	 * or promoted.
	 */

	const zones = [
		{ canvas: 'canvas-brand-muted', ink: 'ink-brand', note: 'the hero' },
		{ canvas: 'canvas-brand-emphasis', ink: 'ink-brand-inverse', note: 'deep brand' },
		{ canvas: 'canvas-brand-subtle', ink: 'ink-brand-emphasis', note: 'near-white' },
		{ canvas: 'canvas-accent-primary', ink: 'ink-accent-primary-inverse', note: 'warm' },
		{ canvas: 'canvas-accent-secondary', ink: 'ink-accent-secondary-inverse', note: 'teal' },
		{ canvas: 'canvas-critical', ink: 'ink-critical-inverse', note: 'busy red' },
		{ canvas: 'canvas-positive', ink: 'ink-positive-inverse', note: 'light green' },
		{ canvas: 'canvas-app', ink: 'ink-app', note: 'no zone at all' }
	];
</script>

<svelte:head>
	<title>Liquid glass — header review</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<GlassFilters />

<GlassBar variant="surface" label="A · surface glass" offset="4.25rem" />
<GlassBar variant="controls" label="B · frosted surface" offset="7.75rem" />

<main class="cw-glassreview">
	<section class="cw-zone canvas-app">
		<div class="cw-shell cw-prose" style="padding-block-start: 8rem">
			<h1 class="font-xl margin-block-start-0 margin-block-end-1">Two glass bars, one backdrop</h1>
			<p class="margin-block-end-1">
				Three bars are stacked above. Top is the current header, unchanged, as a control. Below it:
			</p>
			<ul class="margin-block-end-1">
				<li>
					<strong>A — surface glass.</strong> The bar itself is the lens: no frost, no tint, just the
					backdrop refracted through <code>feTurbulence</code> +
					<code>feDisplacementMap</code>. Closest to the pen's
					<code>.glassContainer</code>.
				</li>
				<li>
					<strong>B — frosted surface.</strong> One translucent frost across the whole bar
					(<code>backdrop-filter: blur(8px)</code> over 7% white), with the same specular edge.
					Controls sit directly on it — one backdrop-filter for the bar rather than one per
					control.
				</li>
			</ul>
			<p class="margin-block-end-1">
				Scroll through the bands and watch both. The thing to judge is legibility: with a
				transparent bar the text is sitting on the zone, so the ink flips per zone rather than
				staying fixed.
			</p>
			<p class="font-sm ink-app-muted margin-0">
				Chromium only, for now — Firefox and Safari won't displace a backdrop through an SVG
				filter, and fall back to the frosted surface the current header already uses.
			</p>
		</div>
	</section>

	{#each zones as zone (zone.canvas)}
		<section
			class="cw-zone cw-glassreview__band {zone.canvas} {zone.ink} {zone.canvas}-trigger"
		>
			<div class="cw-shell">
				<p class="font-lg font-weight-semibold margin-0">
					<code>.{zone.canvas}</code>
				</p>
				<p class="margin-0">{zone.note}</p>
			</div>
		</section>
	{/each}

	<section class="cw-zone canvas-app">
		<div class="cw-shell cw-prose">
			<h2 class="font-lg margin-block-start-0 margin-block-end-05">Notes</h2>
			<p class="margin-block-end-1">
				The pen's <code>scale="77"</code> is tuned for a 300&times;200 card. On a bar this wide it
				smears the backdrop into mush, so A runs at <code>scale="24"</code> with a slightly higher
				base frequency. Easy to push either way.
			</p>
			<p class="margin-0">
				B carries no SVG filter at all now — just one <code>backdrop-filter</code> and a
				translucent white. That makes it the cheaper of the two, and the only one that degrades
				gracefully outside Chromium.
			</p>
		</div>
	</section>
</main>

<style>
	.cw-glassreview__band {
		min-block-size: 60vh;
		display: flex;
		align-items: center;
	}
</style>
