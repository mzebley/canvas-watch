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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

try {
	await page.setContent('<style>body{margin:0}</style>');
	await page.evaluate(() => {
		let nextFrame = 1;
		const frames = new Map();
		window.requestAnimationFrame = (callback) => {
			const id = nextFrame++;
			frames.set(id, callback);
			return id;
		};
		window.cancelAnimationFrame = (id) => frames.delete(id);
		window.flushProfileFrames = () => {
			const durations = [];
			while (frames.size > 0) {
				const callbacks = [...frames.values()];
				frames.clear();
				for (const callback of callbacks) {
					const start = performance.now();
					callback(start);
					durations.push(performance.now() - start);
				}
			}
			return durations;
		};

		window.profileObservers = [];
		for (const name of ['IntersectionObserver', 'ResizeObserver']) {
			const NativeObserver = window[name];
			window[name] = class extends NativeObserver {
				constructor(callback, options) {
					super(callback, options);
					this.targets = new Set();
					profileObservers.push(this);
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

		const nativeRect = Element.prototype.getBoundingClientRect;
		window.profileRectReads = 0;
		Element.prototype.getBoundingClientRect = function () {
			if (this.hasAttribute('data-profile')) profileRectReads += 1;
			return nativeRect.call(this);
		};
	});
	await page.addScriptTag({ content: bundle.outputFiles[0].text });

	const results = await page.evaluate(async () => {
		const sizes = [10, 100, 1000];
		const settleObservers = async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
			flushProfileFrames();
		};
		const observerTargets = () =>
			profileObservers.reduce((total, observer) => total + observer.targets.size, 0);
		const sampleFrame = (watcher) => {
			profileRectReads = 0;
			watcher.schedule();
			const durations = flushProfileFrames();
			return { durationMs: durations[0] ?? 0, rectReads: profileRectReads };
		};

		const references = [];
		for (const size of sizes) {
			document.body.replaceChildren();
			const watcher = CanvasWatch.createCanvasWatcher();
			const stops = [];
			for (let index = 0; index < size; index += 1) {
				const element = document.createElement('div');
				element.dataset.profile = '';
				element.style.cssText = `position:absolute;top:${index * 2}px;width:1px;height:1px`;
				document.body.append(element);
				stops.push(watcher.observeViewport(element, () => {}));
			}
			flushProfileFrames();
			await settleObservers();
			const samples = Array.from({ length: 5 }, () => sampleFrame(watcher));
			const teardownStart = performance.now();
			for (const stop of stops) stop();
			const teardownMs = performance.now() - teardownStart;
			references.push({ size, samples, teardownMs, retainedTargets: observerTargets() });
			watcher.destroy();
		}

		const denseOverlap = [];
		for (const size of sizes) {
			document.body.replaceChildren();
			const watched = document.createElement('div');
			watched.dataset.profile = '';
			watched.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px';
			document.body.append(watched);
			for (let index = 0; index < size; index += 1) {
				const trigger = document.createElement('div');
				const left = (index * 37.17) % 90;
				const top = (index * 61.73) % 90;
				trigger.dataset.profile = '';
				trigger.className = 'dense-trigger';
				trigger.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:60px;height:60px`;
				document.body.append(trigger);
			}
			const watcher = CanvasWatch.createCanvasWatcher();
			const stopViewport = watcher.observeViewport(watched, () => {});
			flushProfileFrames();
			await settleObservers();
			const stopWatch = watcher.watch(watched);
			watcher.refresh();
			flushProfileFrames();
			await settleObservers();
			const samples = Array.from({ length: 5 }, () => sampleFrame(watcher));
			const teardownStart = performance.now();
			stopWatch();
			stopViewport();
			watcher.destroy();
			const teardownMs = performance.now() - teardownStart;
			denseOverlap.push({ size, samples, teardownMs, retainedTargets: observerTargets() });
		}

		return { references, denseOverlap };
	});

	for (const result of results.references) {
		assert.equal(result.samples.every(({ rectReads }) => rectReads === result.size), true);
		assert.equal(result.retainedTargets, 0);
	}
	for (const result of results.denseOverlap) {
		assert.equal(result.samples.every(({ rectReads }) => rectReads === result.size + 1), true);
		assert.equal(result.retainedTargets, 0);
	}

	console.log(JSON.stringify(results, null, 2));
} finally {
	await page.close();
	await browser.close();
}
