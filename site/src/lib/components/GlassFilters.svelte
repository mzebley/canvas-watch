<script>
	import { glassDisplacementMap } from '$lib/data/glass-map.js';

	/**
	 * SVG filter definitions for the liquid-glass surfaces.
	 *
	 * A pseudo-element sets `backdrop-filter`, which promotes it to a backdrop
	 * root, and then an SVG filter displaces that captured backdrop. The shallow
	 * lens uses a baked edge map; the taller panel uses balanced turbulence so the
	 * bar's horizontal refraction does not stretch down the card.
	 *
	 * Technique from https://codepen.io/daftplug/pen/QwbaYGO.
	 */

	let {
		/**
		 * Lens strength.
		 *
		 * The baked map bends hardest at the edges and falls off to nothing at the
		 * border, so it has no smearing ceiling and can be pushed hard.
		 * `primitiveUnits="objectBoundingBox"` means the value is a fraction of
		 * the box, not pixels.
		 */
		lensScale = 0.05
	} = $props();
</script>

<svg aria-hidden="true" focusable="false" class="cw-glass-defs">
	<defs>
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

		<!-- A taller surface needs a balanced field. Reusing the bar's edge map
		     makes the middle of a panel read flat and stretches its refraction. -->
		<filter id="cw-glass-panel" x="0%" y="0%" width="100%" height="100%">
			<feTurbulence
				type="fractalNoise"
				baseFrequency="0.008 0.008"
				numOctaves="2"
				seed="92"
				result="noise"
			/>
			<feGaussianBlur in="noise" stdDeviation="0.02" result="displacement" />
			<feDisplacementMap
				in="SourceGraphic"
				in2="displacement"
				scale="77"
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
