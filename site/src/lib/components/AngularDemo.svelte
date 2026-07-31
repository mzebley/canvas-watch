<script>
	/**
	 * Loads a real Angular app on demand and docks its element to the viewport,
	 * alongside the Svelte-driven header. Opt-in, because bootstrapping Angular
	 * costs far more than the rest of this page put together.
	 */
	let mounted = $state(false);
	let loading = $state(false);
	let failed = $state(false);

	/** @type {HTMLElement | undefined} */
	let host = $state();
	/** @type {(() => void) | null} */
	let teardown = null;

	async function load() {
		if (mounted || loading || !host) return;
		loading = true;
		failed = false;
		try {
			const { mountAngularDemo } = await import('$lib/angular/demo.ts');
			teardown = await mountAngularDemo(host);
			mounted = true;
		} catch (error) {
			failed = true;
			console.error('[canvas-watch] Angular demo failed to bootstrap', error);
		} finally {
			loading = false;
		}
	}

	function unload() {
		teardown?.();
		teardown = null;
		mounted = false;
	}

	$effect(() => () => teardown?.());
</script>

<div class="cw-prose">
	<h3 class="font-lg margin-block-start-0 margin-block-end-05">The same watcher, from Angular</h3>
	<p class="margin-block-end-1">
		Both adapters register on one shared watcher, so a single
		<code>requestAnimationFrame</code> loop drives every element regardless of which framework
		mounted it. Load a real Angular app into this page and you get a second floating element,
		docked at the bottom of the viewport.
	</p>
	<p class="margin-block-end-1">
		The header bar is the Svelte action; the pill is
		<code>CanvasWatchDirective</code>. They sit at opposite ends of the viewport, so most of the
		time they report <em>different</em> zones — which is the point. Two elements, two answers, one
		loop.
	</p>

	<div class="display-flex flex-wrap gap-05 align-items-center">
		{#if mounted}
			<zbk-button variant="outline sm" onclick={unload}>Unload the Angular app</zbk-button>
			<span class="font-xs ink-app-muted">Angular is running — scroll and watch both elements.</span>
		{:else}
			<zbk-button variant="sm" onclick={load} disabled={loading || undefined}>
				{loading ? 'Bootstrapping…' : 'Run the Angular adapter live'}
			</zbk-button>
			<span class="font-xs ink-app-muted">
				Downloads ~270 KB of Angular. Nothing ships until you ask.
			</span>
		{/if}
	</div>

	{#if failed}
		<p class="font-sm ink-critical margin-block-start-05 margin-block-end-0" role="alert">
			The Angular app didn't start. The console has the details.
		</p>
	{/if}
</div>

<div bind:this={host}></div>
