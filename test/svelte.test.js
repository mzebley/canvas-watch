import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { compile } from 'svelte/compiler';

const root = new URL('../', import.meta.url).pathname;
const fixture = new URL('./fixtures/SvelteLifecycle.svelte', import.meta.url).pathname;

function sveltePlugin(generate) {
	return {
		name: `svelte-${generate}`,
		setup(builder) {
			builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
				contents: compile(await readFile(path, 'utf8'), { filename: path, generate }).js.code,
				resolveDir: new URL('.', `file://${path}`).pathname,
			}));
		},
	};
}

const serverBundle = await build({
	stdin: {
		contents: `import { render } from 'svelte/server'; import Fixture from ${JSON.stringify(fixture)}; export const body = render(Fixture).body;`,
		resolveDir: root,
	},
	bundle: true,
	format: 'esm',
	platform: 'node',
	write: false,
	plugins: [sveltePlugin('server')],
});
const serverModule = await import(
	`data:text/javascript;base64,${Buffer.from(serverBundle.outputFiles[0].text).toString('base64')}`
);

const clientBundle = await build({
	stdin: {
		contents: `import { hydrate, unmount } from 'svelte'; import Fixture from ${JSON.stringify(fixture)}; let app; globalThis.startFixture = (target) => (app = hydrate(Fixture, { target })); globalThis.stopFixture = () => unmount(app);`,
		resolveDir: root,
	},
	bundle: true,
	format: 'iife',
	platform: 'browser',
	write: false,
	conditions: ['browser'],
	plugins: [sveltePlugin('client')],
});

test('Svelte hydration, tracked readers, and action teardown release ownership', async () => {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
	const pageErrors = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	try {
		await page.setContent(`<div id="app">${serverModule.body}</div>`);
		assert.equal(await page.locator('#state').textContent(), 'unknown:unknown');
		await page.evaluate(() => {
			window.auditResizeObservers = [];
			const NativeResizeObserver = window.ResizeObserver;
			window.ResizeObserver = class extends NativeResizeObserver {
				constructor(callback) {
					super(callback);
					this.targets = new Set();
					window.auditResizeObservers.push(this);
				}
				observe(element) {
					this.targets.add(element);
					return super.observe(element);
				}
				unobserve(element) {
					this.targets.delete(element);
					return super.unobserve(element);
				}
				disconnect() {
					this.targets.clear();
					return super.disconnect();
				}
			};
			window.settleFixture = () => new Promise((resolve) => setTimeout(resolve, 100));
		});
		await page.addScriptTag({ content: clientBundle.outputFiles[0].text });
		await page.evaluate(async () => {
			startFixture(document.querySelector('#app'));
			await settleFixture();
		});
		assert.equal(await page.locator('#state').textContent(), 'within:within');
		assert.equal(await page.locator('#watched').getAttribute('class'), 'over-zone');

		await page.locator('#toggle').click();
		await page.evaluate(() => settleFixture());
		assert.equal(await page.locator('#state').count(), 0);
		assert.deepEqual(
			await page.evaluate(() =>
				auditResizeObservers.flatMap((observer) =>
					[...observer.targets].map((element) => ({ id: element.id, connected: element.isConnected })),
				),
			),
			[],
			'conditional readers and the action release every DOM target',
		);

		await page.locator('#toggle').click();
		await page.evaluate(() => settleFixture());
		assert.equal(await page.locator('#state').textContent(), 'within:within');
		const cycleResult = await page.evaluate(async () => {
			window.retiredNodes = [];
			const settleCycle = () =>
				new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			for (let index = 0; index < 25; index += 1) {
				retiredNodes.push(
					new WeakRef(document.querySelector('#watched')),
					new WeakRef(document.querySelector('.zone-trigger')),
				);
				document.querySelector('#toggle').click();
				await settleCycle();
				document.querySelector('#toggle').click();
				await settleCycle();
			}
			return {
				observers: auditResizeObservers.length,
				targets: auditResizeObservers[0].targets.size,
				disconnected: [...auditResizeObservers[0].targets].filter(
					(element) => !element.isConnected,
				).length,
			};
		});
		assert.deepEqual(cycleResult, { observers: 1, targets: 3, disconnected: 0 });
		await page.requestGC();
		assert.equal(
			await page.evaluate(() => retiredNodes.filter((reference) => reference.deref()).length),
			0,
			'retired action and trigger nodes have no retaining library path after GC',
		);
		await page.evaluate(async () => {
			await stopFixture();
			await settleFixture();
		});
		assert.deepEqual(
			await page.evaluate(() => auditResizeObservers.flatMap((observer) => [...observer.targets])),
			[],
		);
		assert.deepEqual(pageErrors, []);
	} finally {
		await page.close();
		await browser.close();
	}
});
