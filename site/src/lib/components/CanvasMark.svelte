<script>
	let { class: className = '' } = $props();
</script>

<svg class={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
	<rect x="2" y="4" width="44" height="40" rx="6" fill="currentColor" opacity=".16" />
	<path d="M2 24h44v14a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6Z" fill="currentColor" />
	<path d="M12 24v-5a5 5 0 0 1 5-5h14a5 5 0 0 1 5 5v5" stroke="currentColor" stroke-width="2.5" />
	<path d="M12 24v5a5 5 0 0 0 5 5h14a5 5 0 0 0 5-5v-5" stroke="var(--zbk-app-canvas)" stroke-width="2.5" />
</svg>
