<script>
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { refreshCanvasWatch } from '@mzebley/canvas-watch/svelte';
	import { syncThemeFromDocument } from '$lib/theme.svelte.js';
	import { defineZebkit } from '$lib/zebkit/define.js';
	import '../app.css';

	let { children } = $props();
	onMount(() => {
		syncThemeFromDocument();
		void defineZebkit();
	});
	afterNavigate(refreshCanvasWatch);
</script>

<a class="skip-link" href="#main-content">Skip to documentation</a>
{@render children()}
