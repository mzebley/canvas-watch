<script>
	/**
	 * A build-time-highlighted code block with a copy button.
	 * `snippet` comes from the page's server load (see `+page.server.js`).
	 */
	/**
	 * `isZone` marks this block as a background the floating header passes over.
	 *
	 * Only needed for the handful of blocks that sit inside a *dark* zone: there
	 * the zone tells the bar to use light ink while the block underneath is
	 * near-white, which measured 1.2:1 on the wordmark. Blocks on the light
	 * canvas already agree with their zone and need nothing.
	 *
	 * Deliberately opt-in rather than applied to every block. Making all 21 a
	 * trigger turns them into 21 competing zones, and the bar's single answer
	 * then comes from whichever covers most of it rather than from what is
	 * actually behind the text.
	 */
	let { snippet, label = undefined, isZone = false } = $props();

	let copied = $state(false);
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let resetTimer;

	async function copy() {
		try {
			await navigator.clipboard.writeText(snippet.code);
			copied = true;
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard unavailable (insecure context, denied permission) — the
			// code is still selectable, so there is nothing to recover from.
			copied = false;
		}
	}
</script>

<div class="cw-code {isZone ? 'cw-code-trigger' : ''}">
	<div class="cw-code__bar">
		<span>{label ?? snippet.label ?? snippet.lang}</span>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- `zbk-button` renders a real <button> in its shadow root, so Enter and
		     Space activate it natively and the click bubbles out composed. The
		     compiler only sees an unknown element. Verified by keyboard. -->
		<zbk-button variant="ghost sm" onclick={copy}>
			{copied ? 'Copied' : 'Copy'}
			<span class="visually-hidden">{label ?? snippet.label ?? 'code'} to clipboard</span>
		</zbk-button>
	</div>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- Shiki output, generated at build time from static strings. -->
	{@html snippet.html}
</div>
