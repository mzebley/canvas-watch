<script>
	import { theme, toggleTheme } from '$lib/theme.svelte.js';

	/** @type {HTMLElement | undefined} */
	let el = $state();

	// Drive the switch through its attribute rather than a Svelte prop: the
	// attribute is honoured both before the element upgrades (prerendered HTML)
	// and after, when Lit's boolean converter mirrors it onto the property.
	$effect(() => {
		const dark = theme.mode === 'dark';
		el?.toggleAttribute('checked', dark);
	});

	/** zbk-toggle wraps a native checkbox with role="switch" — change bubbles. */
	function onchange() {
		toggleTheme();
	}
</script>

<zbk-toggle bind:this={el} variant="sm" {onchange}>Dark</zbk-toggle>
