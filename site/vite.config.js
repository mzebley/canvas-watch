import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const libDist = (path) => fileURLToPath(new URL(`../dist/${path}`, import.meta.url));

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		// The site dogfoods the library from its real build output, using the exact
		// import specifiers a consumer writes. `npm run lib` refreshes ../dist first.
		alias: [
			{ find: '@mzebley/canvas-watch/svelte', replacement: libDist('svelte/index.js') },
			{ find: '@mzebley/canvas-watch/angular', replacement: libDist('angular/index.js') },
			// Also catches the bare self-reference inside dist/angular/*, so the
			// Angular directive and the Svelte action resolve to one module
			// instance — and therefore one shared watcher.
			{ find: /^@mzebley\/canvas-watch$/, replacement: libDist('index.js') }
		]
	},
	esbuild: {
		// The Angular demo component uses decorators.
		tsconfigRaw: {
			compilerOptions: {
				experimentalDecorators: true,
				useDefineForClassFields: false
			}
		}
	},
	server: {
		fs: {
			// ../dist lives outside the site root.
			allow: ['..']
		}
	}
});
