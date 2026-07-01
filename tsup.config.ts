import { defineConfig } from 'tsup';

// Core + Svelte entries. The Angular entry is built separately by ngc
// (partial-Ivy) — see `build:angular` in package.json — because Angular AOT
// consumers expect a partial-compiled library, which esbuild does not emit.
export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'svelte/index': 'src/svelte/index.ts',
	},
	format: ['esm', 'cjs'],
	dts: true,
	// No clean: ngc writes dist/angular after tsup, and `npm test`/`npm run demo`
	// rerun tsup alone — cleaning here would silently delete the Angular build.
	// The full `build` script clears dist up front instead.
	clean: false,
	sourcemap: true,
	treeshake: true,
	// Svelte is a peer dep; never bundle it (the action only imports a type).
	external: ['svelte', 'svelte/action'],
});
