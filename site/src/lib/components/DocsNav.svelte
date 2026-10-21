<script>
	import { pushState } from '$app/navigation';
	import Toc from './Toc.svelte';
	let { sections } = $props();
	let mobileNav;

	async function closeAfterNavigation(event) {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = event.target instanceof Element && event.target.closest('a[href^="#"]');
		const target = link && document.getElementById(link.hash.slice(1));
		if (!target) return;
		event.preventDefault();
		mobileNav.removeAttribute('open');
		// Wait for the native details to close before measuring the destination.
		await mobileNav.updateComplete;
		pushState(link.hash, {});
		if (!target.hasAttribute('tabindex')) {
			target.setAttribute('tabindex', '-1');
			target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
		}
		target.focus({ preventScroll: true });
		target.scrollIntoView({ block: 'start' });
	}
</script>

{#snippet links()}
	<Toc {sections} />
	<div class="project-links">
		<a href="https://github.com/mzebley/canvas-watch" target="_blank" rel="noopener">GitHub <span aria-hidden="true">↗</span><span class="visually-hidden"> (opens in a new tab)</span></a>
		<a href="https://www.npmjs.com/package/@mzebley/canvas-watch" target="_blank" rel="noopener">npm <span aria-hidden="true">↗</span><span class="visually-hidden"> (opens in a new tab)</span></a>
	</div>
{/snippet}

<div class="rail-sticky desktop-docs-nav">
	<div class="quick-links"><h2>Quick links</h2>{@render links()}</div>
	<a class="back-to-top" href="#heading">↑ Back to top</a>
</div>
<div class="mobile-docs-nav">
	<!-- svelte-ignore a11y_click_events_have_key_events (The contents are native links and a Zebkit summary.) -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<zbk-disclosure variant="navigation" bind:this={mobileNav} onclick={closeAfterNavigation}>
		<span slot="summary">Quick links</span>
		{@render links()}
	</zbk-disclosure>
</div>
