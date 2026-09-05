import { defineConfig } from 'tsup';

// Core + Svelte entries.
export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'svelte/index': 'src/svelte/index.ts',
	},
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
	// Svelte is a peer dependency; keep its runtime reactivity bridge external.
	external: ['svelte', 'svelte/action', 'svelte/reactivity'],
});
