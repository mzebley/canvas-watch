<script>
	import { glassDisplacementMap } from '$lib/data/glass-map.js';

	/**
	 * SVG filter definitions for the liquid-glass bars.
	 *
	 * Both work the same way: a pseudo-element sets `backdrop-filter`, which
	 * promotes it to a backdrop root, and then `filter: url(#…)` displaces that
	 * captured backdrop. What differs is where the displacement comes from.
	 *
	 * Technique from https://codepen.io/daftplug/pen/QwbaYGO.
	 */

	let {
		/**
		 * Turbulence strength, for `#cw-glass-surface`.
		 *
		 * Has to stay well under half the bar's height. Turbulence displaces
		 * uniformly right up to the element's border, and the filter region is
		 * clipped to the element box, so any pixel pulled from beyond that box
		 * samples transparency. On a ~44px bar, scale 24 reaches further than the
		 * bar is tall and the frost fills with pale smears.
		 */
		scale = 9,
		baseFrequency = '0.015 0.03',
		seed = 92,

		/**
		 * Lens strength, for `#cw-glass-lens`.
		 *
		 * This one uses the baked map, which bends hardest at the edges and falls
		 * off to nothing at the border — so it has no smearing ceiling and can be
		 * pushed far harder than turbulence. `primitiveUnits="objectBoundingBox"`
		 * means the value is a fraction of the box, not pixels.
		 */
		lensScale = 0.05
	} = $props();
</script>

<svg aria-hidden="true" focusable="false" class="cw-glass-defs">
	<defs>
		<!-- Organic turbulence, bending the backdrop everywhere. x/y/width/height
		     clip the filter region to the element box so the effect can't bleed
		     past a bar that spans most of the viewport. -->
		<filter id="cw-glass-surface" x="0%" y="0%" width="100%" height="100%">
			<feTurbulence type="fractalNoise" {baseFrequency} numOctaves="2" {seed} result="noise" />
			<feGaussianBlur in="noise" stdDeviation="0.02" result="blurredNoise" />
			<feDisplacementMap
				in="SourceGraphic"
				in2="blurredNoise"
				{scale}
				xChannelSelector="R"
				yChannelSelector="G"
			/>
		</filter>

		<!-- Edge-weighted lens. The map is neutral through the middle and bends
		     hard near the border, which is what reads as thick glass with a
		     refracting rim rather than an evenly wobbled surface. -->
		<filter id="cw-glass-lens" primitiveUnits="objectBoundingBox">
			<feImage href={glassDisplacementMap} x="0" y="0" width="1" height="1" result="map" />
			<feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="blurred" />
			<feDisplacementMap
				in="blurred"
				in2="map"
				scale={lensScale}
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
