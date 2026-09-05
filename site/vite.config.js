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
			{ find: /^@mzebley\/canvas-watch$/, replacement: libDist('index.js') }
		]
	},
	server: {
		fs: {
			// ../dist lives outside the site root.
			allow: ['..']
		}
	}
});
