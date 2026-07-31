<script>
	import { onMount } from 'svelte';

	/** @type {{ sections: { id: string, label: string }[] }} */
	let { sections } = $props();

	let activeId = $state(sections[0]?.id ?? '');

	onMount(() => {
		const order = new Map(sections.map((s, i) => [s.id, i]));
		const inBand = new Set();

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) inBand.add(entry.target.id);
					else inBand.delete(entry.target.id);
				}
				// Several sections can straddle the band; the highest one wins.
				let best = null;
				for (const id of inBand) {
					if (best === null || (order.get(id) ?? 0) < (order.get(best) ?? 0)) best = id;
				}
				// Nothing in the band (a very tall section) keeps the last answer.
				if (best) activeId = best;
			},
			{ rootMargin: '-15% 0px -70% 0px' }
		);

		for (const { id } of sections) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});
</script>

<nav class="cw-toc" aria-label="On this page">
	<p class="font-xs letter-spacing-wide text-uppercase ink-app-muted margin-block-end-05">
		On this page
	</p>
	<ul class="list-style-none padding-0 margin-0">
		{#each sections as section (section.id)}
			<li>
				<a href="#{section.id}" aria-current={activeId === section.id ? 'true' : undefined}>
					{section.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
