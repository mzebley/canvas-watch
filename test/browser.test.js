import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
	entryPoints: [new URL('../src/index.ts', import.meta.url).pathname],
	bundle: true,
	format: 'iife',
	globalName: 'CanvasWatch',
	write: false,
});
const source = bundle.outputFiles[0].text;

async function withPage(browser, html, run) {
	const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
	const pageErrors = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));
	await page.setContent(html);
	await page.evaluate(() => {
		window.auditObservers = [];
		for (const name of ['IntersectionObserver', 'ResizeObserver']) {
			const NativeObserver = window[name];
			window[name] = class extends NativeObserver {
				constructor(callback, options) {
					super(callback, options);
					this.targets = new Set();
					window.auditObservers.push(this);
				}
				observe(element, ...args) {
					this.targets.add(element);
					return super.observe(element, ...args);
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
		}
		window.settleCanvasWatch = () => new Promise((resolve) => setTimeout(resolve, 100));
	});
	await page.addScriptTag({ content: source });
	try {
		return { result: await page.evaluate(run), pageErrors };
	} finally {
		await page.close();
	}
}

test('Chromium watcher contract', async (context) => {
	const browser = await chromium.launch({ headless: true });
	try {
		await context.test('destroy during canvas delivery leaves every element released', async () => {
			const { result } = await withPage(
				browser,
				'<style>body{margin:0}.zone{position:fixed;inset:0}.watch{position:fixed;top:0;width:100px;height:100px}</style><div class="zone zone-trigger"></div><div id="a" class="watch"></div><div id="b" class="watch" style="left:200px"></div>',
				async () => {
					const watcher = CanvasWatch.createCanvasWatcher();
					const a = document.querySelector('#a');
					const b = document.querySelector('#b');
					watcher.watch(a);
					watcher.watch(b);
					a.addEventListener('canvaschange', () => watcher.destroy(), { once: true });
					watcher.refresh();
					await settleCanvasWatch();
					return {
						a: a.className,
						b: b.className,
						retainedTargets: auditObservers.reduce((sum, observer) => sum + observer.targets.size, 0),
					};
				},
			);
			assert.deepEqual(result, { a: 'watch', b: 'watch', retainedTargets: 0 });
		});

		await context.test('consumer errors are isolated and layout shifts invalidate state', async () => {
			const { result, pageErrors } = await withPage(
				browser,
				'<style>body{margin:0}</style><div id="spacer" style="height:100px"></div><div id="target" style="height:100px"></div>',
				async () => {
					const watcher = CanvasWatch.createCanvasWatcher();
					let healthyCalls = 0;
					let state = 'unknown';
					watcher.observeViewport('#target', () => {
						throw new Error('consumer failure');
					});
					watcher.observeViewport('#target', (detail) => {
						healthyCalls += 1;
						state = detail.state;
					});
					await settleCanvasWatch();
					const initial = state;
					document.querySelector('#spacer').style.height = '1000px';
					await settleCanvasWatch();
					const shifted = state;
					watcher.destroy();
					return { healthyCalls, initial, shifted };
				},
			);
			assert.equal(result.initial, 'within');
			assert.equal(result.shifted, 'below');
			assert.equal(result.healthyCalls, 2);
			assert.equal(pageErrors.filter((message) => message === 'consumer failure').length, 2);
		});

		await context.test('same-class duplicate rectangles use physical coverage', async () => {
			const { result } = await withPage(
				browser,
				'<style>body{margin:0}.zone{position:fixed;top:0;left:0;width:100px;height:30px}.watch{position:fixed;top:0;left:0;width:100px;height:100px}</style><div class="zone a-trigger"></div><div class="zone a-trigger"></div><div id="watch" class="watch"></div>',
				async () => {
					const watcher = CanvasWatch.createCanvasWatcher();
					const watched = document.querySelector('#watch');
					watcher.watch(watched);
					watcher.refresh();
					await settleCanvasWatch();
					const className = watched.className;
					watcher.destroy();
					return className;
				},
			);
			assert.equal(result, 'watch');
		});

		await context.test('viewport-first registration remains overlap-active after rewatch', async () => {
			const { result } = await withPage(
				browser,
				'<style>body{margin:0}.zone{position:fixed;inset:0}.watch{position:fixed;top:0;width:100px;height:100px}</style><div class="zone zone-trigger"></div><div id="target" class="watch"></div>',
				async () => {
					const watcher = CanvasWatch.createCanvasWatcher();
					const target = document.querySelector('#target');
					const stopViewport = watcher.observeViewport(target, () => {});
					await settleCanvasWatch();
					const stopWatch = watcher.watch(target);
					watcher.refresh();
					await settleCanvasWatch();
					const first = target.classList.contains('over-zone');
					stopWatch();
					const stopRewatch = watcher.watch(target);
					await settleCanvasWatch();
					const second = target.classList.contains('over-zone');
					stopRewatch();
					stopViewport();
					watcher.destroy();
					return { first, second };
				},
			);
			assert.deepEqual(result, { first: true, second: true });
		});

		await context.test('unsubscribing one reference preserves unrelated delivery', async () => {
			const { result } = await withPage(
				browser,
				'<div id="a"></div><div id="b"></div>',
				async () => {
					const watcher = CanvasWatch.createCanvasWatcher();
					let stopFirst = () => {};
					let stopSibling = () => {};
					let siblingCalls = 0;
					let bCalls = 0;
					stopFirst = watcher.observeViewport(document.querySelector('#a'), () => {
						stopFirst();
						stopSibling();
					});
					stopSibling = watcher.observeViewport(document.querySelector('#a'), () => siblingCalls++);
					watcher.observeViewport(document.querySelector('#b'), () => bCalls++);
					await settleCanvasWatch();
					watcher.destroy();
					return { siblingCalls, bCalls };
				},
			);
			assert.deepEqual(result, { siblingCalls: 0, bCalls: 1 });
		});

		await context.test('subscription created during delivery initializes once', async () => {
			const { result } = await withPage(
				browser,
				'<div id="a"></div><div id="b"></div>',
				async () => {
					const watcher = CanvasWatch.createCanvasWatcher();
					const details = [];
					watcher.observeViewport(document.querySelector('#a'), () => {
						watcher.observeViewport(document.querySelector('#b'), (detail) => details.push(detail));
					});
					watcher.observeViewport(document.querySelector('#b'), () => {});
					await settleCanvasWatch();
					watcher.destroy();
					return details.map(({ state, previousState }) => ({ state, previousState }));
				},
			);
			assert.deepEqual(result, [{ state: 'within', previousState: 'unknown' }]);
		});
	} finally {
		await browser.close();
	}
});
