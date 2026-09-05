import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const temp = await mkdtemp(join(tmpdir(), 'canvas-watch-package-'));
let tarball = '';

function run(command, args, cwd) {
	return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function createConsumer(name, svelteVersion) {
	const directory = join(temp, name);
	await mkdir(directory);
	await writeFile(
		join(directory, 'package.json'),
		JSON.stringify({ name, private: true, type: 'module' }, null, 2),
	);
	const dependencies = [tarball];
	if (svelteVersion) dependencies.push(`svelte@${svelteVersion}`);
	run(
		'npm',
		[
			'install',
			'--ignore-scripts',
			'--no-audit',
			'--no-fund',
			'--no-package-lock',
			...(svelteVersion ? [] : ['--omit=optional']),
			...dependencies,
		],
		directory,
	);
	return directory;
}

async function verifyTrackedSvelteReader(consumer) {
	const compiler = await import(
		pathToFileURL(join(consumer, 'node_modules/svelte/compiler/index.js')).href
	);
	const compile = compiler.compile ?? compiler.default?.compile;
	assert.equal(typeof compile, 'function', 'the installed minimum Svelte compiler is callable');
	const fixture = join(consumer, 'TrackedViewport.svelte');
	await writeFile(
		fixture,
		`<script>
import { canvasWatch } from '@mzebley/canvas-watch/svelte';
const target = canvasWatch('#tracked-target');
</script>
<output id="tracked-state">{target.state}</output>
`,
	);
	const bundle = await build({
		stdin: {
			contents: `import { mount } from 'svelte'; import Fixture from './TrackedViewport.svelte'; globalThis.startTrackedFixture = (target) => mount(Fixture, { target });`,
			resolveDir: consumer,
		},
		bundle: true,
		format: 'iife',
		platform: 'browser',
		write: false,
		conditions: ['browser'],
		plugins: [
			{
				name: 'minimum-svelte-fixture',
				setup(builder) {
					builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
						contents: compile(await readFile(path, 'utf8'), {
							filename: path,
							generate: 'client',
						}).js.code,
						resolveDir: dirname(path),
					}));
				},
			},
		],
	});

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
	const pageErrors = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	try {
		await page.setContent(
			'<div id="tracked-target" style="position:fixed;top:100px;width:100px;height:100px"></div><div id="app"></div>',
		);
		await page.addScriptTag({ content: bundle.outputFiles[0].text });
		await page.evaluate(() => startTrackedFixture(document.querySelector('#app')));
		await page.waitForFunction(() => document.querySelector('#tracked-state')?.textContent === 'within');
		await page.evaluate(() => {
			document.querySelector('#tracked-target').style.top = '900px';
			window.dispatchEvent(new Event('scroll'));
		});
		await page.waitForFunction(() => document.querySelector('#tracked-state')?.textContent === 'below');
		assert.deepEqual(pageErrors, []);
	} finally {
		await page.close();
		await browser.close();
	}
}

try {
	run('npm', ['run', 'build'], root);
	const packOutput = run(
		'npm',
		['pack', '--json', '--ignore-scripts', '--pack-destination', temp],
		root,
	);
	const jsonStart = Math.max(packOutput.lastIndexOf('\n[') + 1, packOutput.indexOf('['));
	const packResult = JSON.parse(packOutput.slice(jsonStart))[0];
	tarball = join(temp, packResult.filename);
	const files = packResult.files.map(({ path }) => path);
	assert(files.includes('dist/index.js'));
	assert(files.includes('dist/index.cjs'));
	assert(files.includes('dist/svelte/index.js'));
	assert(files.includes('dist/svelte/index.cjs'));
	assert.equal(files.some((path) => path.includes('angular')), false);

	const coreOnly = await createConsumer('core-only');
	await writeFile(
		join(coreOnly, 'verify.mjs'),
		`import assert from 'node:assert/strict';
import { createCanvasWatcher } from '@mzebley/canvas-watch';
assert.equal(typeof createCanvasWatcher().observeViewport, 'function');
await import('@mzebley/canvas-watch/package.json', { with: { type: 'json' } });
`,
	);
	run('node', ['verify.mjs'], coreOnly);

	const installedSvelte = JSON.parse(
		await readFile(join(root, 'node_modules/svelte/package.json'), 'utf8'),
	).version;
	const svelteVersions = [...new Set(['5.7.0', installedSvelte])];
	for (const version of svelteVersions) {
		const consumer = await createConsumer(`svelte-${version.replaceAll('.', '-')}`, version);
		await writeFile(
			join(consumer, 'verify.mjs'),
			`import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { canvasWatch } from '@mzebley/canvas-watch/svelte';
import { getSharedWatcher } from '@mzebley/canvas-watch';

assert.equal(canvasWatch('#hero').state, 'unknown');

globalThis.window = new EventTarget();
globalThis.document = { documentElement: { clientHeight: 800 }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
let intersections = 0;
let resizes = 0;
globalThis.IntersectionObserver = class { constructor() { intersections += 1; } observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = class { constructor() { resizes += 1; } observe() {} unobserve() {} disconnect() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const esm = getSharedWatcher();
const require = createRequire(import.meta.url);
const cjsCore = require('@mzebley/canvas-watch');
const cjsSvelte = require('@mzebley/canvas-watch/svelte');
const node = new EventTarget();
node.classList = { add() {}, remove() {}, forEach() {} };
node.getBoundingClientRect = () => ({ left: 0, right: 1, top: 0, bottom: 1, width: 1, height: 1 });
const action = cjsSvelte.watchBgCanvas(node);
assert.equal(cjsCore.getSharedWatcher(), esm);
assert.equal(intersections, 2);
assert.equal(resizes, 1);
action.destroy();
esm.destroy();
assert.notEqual(cjsCore.getSharedWatcher(), esm);
`,
		);
		run('node', ['verify.mjs'], consumer);
		if (version === '5.7.0') await verifyTrackedSvelteReader(consumer);
	}

	console.log(
		`Package verification passed: ${files.length} files; core-only; Svelte ${svelteVersions.join(' and ')}; minimum-version tracked reader; ESM/CJS sharing.`,
	);
} finally {
	await rm(temp, { recursive: true, force: true });
}
