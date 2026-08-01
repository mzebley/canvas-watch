<script>
	import { glassDisplacementMap } from '$lib/data/glass-map.js';

	/**
	 * SVG filter definitions for the liquid-glass bars.
	 *
	 * Both work the same way: a pseudo-element sets `backdrop-filter: blur(0px)`,
	 * which promotes it to a backdrop root, and then `filter: url(#…)` displaces
	 * that captured backdrop. The displacement source is what differs.
	 *
	 * Technique from https://codepen.io/daftplug/pen/QwbaYGO — the numbers below
	 * are retuned, because the reference is a 300x200 card and these are ~1150x44
	 * bars, where the original `scale="77"` smears the backdrop into mush.
	 */

	/** Displacement strength for the surface filter. */
	let { scale = 24, baseFrequency = '0.012 0.02', seed = 92 } = $props();
</script>

<svg aria-hidden="true" focusable="false" class="cw-glass-defs">
	<defs>
		<!-- Whole-bar glass: organic turbulence, bending the backdrop everywhere.
		     x/y/width/height clip the filter region to the element box so the
		     effect can't bleed past a bar that spans most of the viewport. -->
		<filter id="cw-glass-surface" x="0%" y="0%" width="100%" height="100%">
			<feTurbulence
				type="fractalNoise"
				{baseFrequency}
				numOctaves="2"
				{seed}
				result="noise"
			/>
			<feGaussianBlur in="noise" stdDeviation="0.02" result="blurredNoise" />
			<feDisplacementMap
				in="SourceGraphic"
				in2="blurredNoise"
				{scale}
				xChannelSelector="R"
				yChannelSelector="G"
			/>
		</filter>

		<!-- Control glass: a baked map that bends hard at the edges and stays flat
		     in the middle, which is what makes a small pill read as a lens. -->
		<filter id="cw-glass-control" primitiveUnits="objectBoundingBox">
			<feImage href={glassDisplacementMap} x="0" y="0" width="1" height="1" result="map" />
			<feGaussianBlur in="SourceGraphic" stdDeviation="0.02" result="blurred" />
			<feDisplacementMap
				in="blurred"
				in2="map"
				scale="1"
				xChannelSelector="R"
				yChannelSelector="G"
			/>
		</filter>
	</defs>
</svg>

<style>
	.cw-glass-defs {
		position: absolute;
		inline-size: 0;
		block-size: 0;
		overflow: hidden;
	}
</style>
