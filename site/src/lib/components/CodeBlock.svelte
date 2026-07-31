<script>
	/**
	 * A build-time-highlighted code block with a copy button.
	 * `snippet` comes from the page's server load (see `+page.server.js`).
	 */
	let { snippet, label = undefined } = $props();

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

<div class="cw-code">
	<div class="cw-code__bar">
		<span>{label ?? snippet.label ?? snippet.lang}</span>
		<zbk-button variant="ghost sm" onclick={copy}>
			{copied ? 'Copied' : 'Copy'}
			<span class="visually-hidden">{label ?? snippet.label ?? 'code'} to clipboard</span>
		</zbk-button>
	</div>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- Shiki output, generated at build time from static strings. -->
	{@html snippet.html}
</div>
