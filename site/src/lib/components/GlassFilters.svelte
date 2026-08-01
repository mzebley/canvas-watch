<script>
	/**
	 * SVG filter definition for the liquid-glass bar.
	 *
	 * A pseudo-element sets `backdrop-filter: blur(0px)`, which promotes it to a
	 * backdrop root, and then `filter: url(#…)` displaces that captured backdrop.
	 *
	 * Technique from https://codepen.io/daftplug/pen/QwbaYGO — retuned, because
	 * the reference is a 300x200 card and this is a ~1150x44 bar, where the
	 * original `scale="77"` smears the backdrop into mush.
	 *
	 * The pen's second filter (a baked displacement-map PNG for its button) is
	 * gone: nothing uses it now that the controls sit directly on the bar, and it
	 * carried ~9 KB of base64 with it.
	 */

	/**
	 * Displacement strength.
	 *
	 * Keep this well under half the bar's height. The turbulence map displaces
	 * uniformly, including at the very edge of the element, and the filter region
	 * is clipped to the element box — so any pixel pulled from beyond that box
	 * samples transparency. On a ~44px bar, scale 24 pulls from further than the
	 * bar is tall and the frost fills with pale smears. (The reference pen avoids
	 * this on small elements by using an edge-weighted displacement image instead
	 * of turbulence, which falls off to zero at the border.)
	 */
	let { scale = 9, baseFrequency = '0.015 0.03', seed = 92 } = $props();
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
