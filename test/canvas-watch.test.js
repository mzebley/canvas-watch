/**
 * Unit tests for the pure, DOM-free pieces of the core: overlap geometry and the
 * trigger -> applied class convention. The DOM-driven watcher is exercised by
 * the demo (demo/index.html), not here.
 *
 * Imports the built bundle, so `npm test` builds the core first (see the test
 * script in package.json).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
	classifyViewportRect,
	createCanvasWatcher,
	getSharedWatcher,
	overlapArea,
	pickWinningClass,
	resolveAppliedClass,
} from '../dist/index.js';

const require = createRequire(import.meta.url);

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });

test('overlapArea: disjoint rects have zero overlap', () => {
	assert.equal(overlapArea(rect(0, 0, 10, 10), rect(20, 20, 30, 30)), 0);
});

test('overlapArea: edge-touching rects have zero overlap', () => {
	assert.equal(overlapArea(rect(0, 0, 10, 10), rect(10, 0, 20, 10)), 0);
});

test('overlapArea: partial overlap is the intersection area', () => {
	// x overlap [5,10] = 5, y overlap [5,10] = 5 -> 25
	assert.equal(overlapArea(rect(0, 0, 10, 10), rect(5, 5, 15, 15)), 25);
});

test('overlapArea: fully contained rect overlaps by its own area', () => {
	assert.equal(overlapArea(rect(0, 0, 100, 100), rect(10, 10, 30, 40)), 20 * 30);
});

test('overlapArea: is commutative', () => {
	const a = rect(0, 0, 10, 10);
	const b = rect(5, 5, 15, 15);
	assert.equal(overlapArea(a, b), overlapArea(b, a));
});

test('classifyViewportRect: vertical edges belong to above and below', () => {
	assert.equal(classifyViewportRect(rect(-100, -20, 100, 0), 0, 800), 'above');
	assert.equal(classifyViewportRect(rect(-100, 800, 100, 900), 0, 800), 'below');
	assert.equal(classifyViewportRect(rect(2000, -20, 2100, 20), 0, 800), 'within');
	assert.equal(classifyViewportRect(rect(-2000, 799, -1900, 900), 0, 800), 'within');
});

/** `pickWinningClass` takes a Map of appliedClass -> { overlap, depth }. */
const totals = (entries) =>
	new Map(Object.entries(entries).map(([cls, [overlap, depth = 0]]) => [cls, { overlap, depth }]));

const AREA = 100;

test('pickWinningClass: the largest overlap wins at equal depth', () => {
	assert.equal(
		pickWinningClass(totals({ 'over-a': [60], 'over-b': [80] }), AREA, 0.5),
		'over-b',
	);
});

test('pickWinningClass: nothing wins below the threshold', () => {
	assert.equal(pickWinningClass(totals({ 'over-a': [40] }), AREA, 0.5), null);
});

test('pickWinningClass: a nested zone beats its container', () => {
	// The container covers the element entirely; the zone inside it covers less
	// but is the more specific answer.
	assert.equal(
		pickWinningClass(totals({ 'over-outer': [100, 0], 'over-inner': [60, 1] }), AREA, 0.5),
		'over-inner',
	);
});

test('pickWinningClass: nesting does not lower the threshold', () => {
	// The nested zone clips the element without covering it, so the container
	// still wins — depth reorders candidates, it does not admit new ones.
	assert.equal(
		pickWinningClass(totals({ 'over-outer': [100, 0], 'over-inner': [20, 1] }), AREA, 0.5),
		'over-outer',
	);
});

test('pickWinningClass: the deepest qualifying zone wins', () => {
	assert.equal(
		pickWinningClass(
			totals({ 'over-a': [100, 0], 'over-b': [90, 1], 'over-c': [70, 2] }),
			AREA,
			0.5,
		),
		'over-c',
	);
});

test('pickWinningClass: subthreshold nested contributions do not promote a class', () => {
	assert.equal(
		pickWinningClass(
			new Map([
				['over-a', [{ overlap: 100, depth: 0 }, { overlap: 1, depth: 2 }]],
				['over-b', { overlap: 60, depth: 1 }],
			]),
			AREA,
			0.5,
		),
		'over-b',
	);
});

test('pickWinningClass: overlap breaks a tie at the same depth', () => {
	assert.equal(
		pickWinningClass(totals({ 'over-a': [70, 2], 'over-b': [90, 2] }), AREA, 0.5),
		'over-b',
	);
});

test('pickWinningClass: a zero-area element wins nothing', () => {
	assert.equal(pickWinningClass(totals({ 'over-a': [100] }), 0, 0.5), null);
});

test('pickWinningClass: a zero threshold still needs real overlap', () => {
	assert.equal(pickWinningClass(totals({ 'over-a': [0] }), AREA, 0), null);
});

test('pickWinningClass: no candidates resolve to null', () => {
	assert.equal(pickWinningClass(new Map(), AREA, 0.5), null);
});

const convention = { triggerSuffix: '-trigger', appliedPrefix: 'over-' };

test('resolveAppliedClass: convention strips suffix and adds prefix', () => {
	assert.equal(
		resolveAppliedClass('canvas-brand-emphasis-trigger', convention),
		'over-canvas-brand-emphasis',
	);
});

test('resolveAppliedClass: non-trigger classes resolve to null', () => {
	assert.equal(resolveAppliedClass('card', convention), null);
	assert.equal(resolveAppliedClass('watch-bg-canvas', convention), null);
});

test('resolveAppliedClass: a bare suffix resolves to null (no base)', () => {
	assert.equal(resolveAppliedClass('-trigger', convention), null);
});

test('resolveAppliedClass: classMap overrides win over the convention', () => {
	const opts = { ...convention, classMap: { 'hero-trigger': 'on-hero' } };
	assert.equal(resolveAppliedClass('hero-trigger', opts), 'on-hero');
	// other triggers still follow the convention
	assert.equal(resolveAppliedClass('canvas-danger-trigger', opts), 'over-canvas-danger');
});

test('resolveAppliedClass: classMap can map a non-suffixed class', () => {
	const opts = { ...convention, classMap: { hero: 'on-hero' } };
	assert.equal(resolveAppliedClass('hero', opts), 'on-hero');
});

test('resolveAppliedClass: classMap ignores inherited Object.prototype keys', () => {
	const opts = { ...convention, classMap: { 'hero-trigger': 'on-hero' } };
	// `constructor`/`toString` exist on the prototype chain; they must not
	// resolve as classMap hits (and are not triggers, so they resolve to null).
	assert.equal(resolveAppliedClass('constructor', opts), null);
	assert.equal(resolveAppliedClass('toString', opts), null);
});

test('resolveAppliedClass: custom suffix/prefix is honored', () => {
	assert.equal(
		resolveAppliedClass('hero-zone', { triggerSuffix: '-zone', appliedPrefix: 'on-' }),
		'on-hero',
	);
});

class FakeClassList extends Set {
	remove(...classes) {
		for (const cls of classes) this.delete(cls);
	}
}

class FakeElement extends EventTarget {
	constructor(rectangle = rect(0, 0, 100, 100)) {
		super();
		this.rect = rectangle;
		this.rectReads = 0;
		this.isConnected = true;
		this.parentElement = null;
		this.classList = new FakeClassList();
		this.attributes = new Map();
	}

	getBoundingClientRect() {
		this.rectReads += 1;
		return {
			...this.rect,
			width: this.rect.right - this.rect.left,
			height: this.rect.bottom - this.rect.top,
		};
	}

	getAttribute(name) {
		return this.attributes.get(name) ?? null;
	}

	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}
}

function installDom() {
	const originals = new Map();
	for (const name of [
		'window',
		'document',
		'IntersectionObserver',
		'ResizeObserver',
		'MutationObserver',
		'requestAnimationFrame',
		'cancelAnimationFrame',
		'reportError',
	]) {
		originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
	}

	const elements = new Set();
	const frames = new Map();
	const intersectionObservers = [];
	const resizeObservers = [];
	const mutationObservers = [];
	const reportedErrors = [];
	const queryCounts = new Map();
	let nextFrame = 1;

	class FakeIntersectionObserver {
		constructor(callback, options) {
			this.callback = callback;
			this.options = options;
			this.observed = new Set();
			this.observeCalls = 0;
			this.unobserveCalls = 0;
			this.disconnected = false;
			intersectionObservers.push(this);
		}
		observe(element) {
			this.observeCalls += 1;
			this.observed.add(element);
		}
		unobserve(element) {
			this.unobserveCalls += 1;
			this.observed.delete(element);
		}
		disconnect() {
			this.disconnected = true;
			this.observed.clear();
		}
		fire(entries) {
			const active = entries.filter(({ target }) => this.observed.has(target));
			if (active.length > 0) this.callback(active);
		}
	}

	class FakeResizeObserver {
		constructor(callback) {
			this.callback = callback;
			this.observed = new Set();
			this.observeCalls = 0;
			this.unobserveCalls = 0;
			this.disconnected = false;
			resizeObservers.push(this);
		}
		observe(element) {
			this.observeCalls += 1;
			this.observed.add(element);
		}
		unobserve(element) {
			this.unobserveCalls += 1;
			this.observed.delete(element);
		}
		disconnect() {
			this.disconnected = true;
			this.observed.clear();
		}
	}

	class FakeMutationObserver {
		constructor(callback) {
			this.callback = callback;
			this.active = false;
			this.disconnected = false;
			mutationObservers.push(this);
		}
		observe() {
			this.active = true;
			this.disconnected = false;
		}
		disconnect() {
			this.active = false;
			this.disconnected = true;
		}
		fire(records = []) {
			if (this.active) this.callback(records);
		}
	}

	const documentElement = new FakeElement();
	documentElement.clientHeight = 800;
	const fakeDocument = {
		documentElement,
		getElementById(id) {
			return (
				[...elements].find(
					(element) => element.isConnected && element.getAttribute('id') === id,
				) ?? null
			);
		},
		querySelectorAll(selector) {
			queryCounts.set(selector, (queryCounts.get(selector) ?? 0) + 1);
			if (selector === '[data-canvas-watch-viewport]') {
				return [...elements].filter(
					(element) =>
						element.isConnected && element.getAttribute('data-canvas-watch-viewport') !== null,
				);
			}
			if (selector === '.watch-bg-canvas') {
				return [...elements].filter(
					(element) => element.isConnected && element.classList.has('watch-bg-canvas'),
				);
			}
			if (selector === '[class*="-trigger"]') {
				return [...elements].filter(
					(element) =>
						element.isConnected && [...element.classList].some((cls) => cls.includes('-trigger')),
				);
			}
			return [];
		},
	};
	const fakeWindow = new EventTarget();
	fakeWindow.innerHeight = 800;

	Object.assign(globalThis, {
		window: fakeWindow,
		document: fakeDocument,
		IntersectionObserver: FakeIntersectionObserver,
		ResizeObserver: FakeResizeObserver,
		MutationObserver: FakeMutationObserver,
		requestAnimationFrame(callback) {
			const id = nextFrame++;
			frames.set(id, callback);
			return id;
		},
		cancelAnimationFrame(id) {
			frames.delete(id);
		},
		reportError(error) {
			reportedErrors.push(error);
		},
	});

	return {
		elements,
		frames,
		intersectionObservers,
		resizeObservers,
		mutationObservers,
		reportedErrors,
		queryCounts,
		flushFrame() {
			const pending = [...frames.values()];
			frames.clear();
			for (const callback of pending) callback(0);
		},
		fireMutation(records = []) {
			for (const observer of mutationObservers) observer.fire(records);
		},
		fireIntersection(element, isIntersecting) {
			for (const observer of intersectionObservers) {
				observer.fire([{ target: element, isIntersecting }]);
			}
		},
		restore() {
			for (const [name, descriptor] of originals) {
				if (descriptor) Object.defineProperty(globalThis, name, descriptor);
				else delete globalThis[name];
			}
		},
	};
}

test('viewport observation shares one frame and one rect read per resolved element', () => {
	const dom = installDom();
	try {
		const hero = new FakeElement(rect(4000, 100, 4100, 300));
		hero.setAttribute('id', 'hero');
		dom.elements.add(hero);
		const watcher = createCanvasWatcher();
		const byId = [];
		const byElement = [];
		const unsubscribeId = watcher.observeViewport('#hero', (detail) => byId.push(detail));
		const unsubscribeElement = watcher.observeViewport(hero, (detail) => byElement.push(detail));

		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('scroll'));
		assert.equal(dom.frames.size, 1, 'registration and scroll events coalesce');
		dom.flushFrame();
		assert.equal(hero.rectReads, 1, 'ID and direct references share the rect read');
		assert.equal(byId[0].state, 'within');
		assert.equal(byId[0].inViewport, true);
		assert.equal(byId[0].aboveViewport, false);
		assert.equal(byId[0].belowViewport, false);
		assert.equal(byId[0].missing, false);

		window.dispatchEvent(new Event('scroll'));
		dom.flushFrame();
		assert.equal(byId.length, 1, 'an unchanged state is silent');
		assert.equal(byElement.length, 1, 'all listeners are silent when unchanged');

		hero.rect = rect(0, -100, 100, 0);
		window.dispatchEvent(new Event('scroll'));
		dom.flushFrame();
		assert.equal(byId.at(-1).state, 'above');
		assert.equal(byId.at(-1).aboveViewport, true);

		unsubscribeId();
		assert.equal(
			dom.resizeObservers[0].observed.has(hero),
			true,
			'a shared resize target remains while another reference owns it',
		);
		unsubscribeElement();
		assert.equal(dom.resizeObservers[0].observed.size, 0, 'unsubscribe releases resize tracking');
		assert.equal(dom.mutationObservers[0].disconnected, true, 'the shared mutation observer idles');
		window.dispatchEvent(new Event('scroll'));
		assert.equal(dom.frames.size, 0, 'an unused watcher does not schedule scroll work');
		const unsubscribeAgain = watcher.observeViewport('#hero', () => {});
		assert.equal(dom.mutationObservers.length, 1, 'a watcher reuses its one mutation observer');
		unsubscribeAgain();
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('viewport references resolve missing, late insertion, and disconnection', () => {
	const dom = installDom();
	try {
		const watcher = createCanvasWatcher();
		const changes = [];
		const directChanges = [];
		const detached = new FakeElement(rect(0, 100, 100, 200));
		detached.isConnected = false;
		watcher.observeViewport('#late', (detail) => changes.push(detail));
		watcher.observeViewport(detached, (detail) => directChanges.push(detail));
		dom.flushFrame();
		assert.deepEqual(changes.map(({ state }) => state), ['missing']);
		assert.equal(changes[0].missing, true);
		assert.deepEqual(directChanges.map(({ state }) => state), ['missing']);

		detached.isConnected = true;
		dom.elements.add(detached);
		dom.fireMutation();
		dom.flushFrame();
		assert.deepEqual(directChanges.map(({ state }) => state), ['missing', 'within']);

		const late = new FakeElement(rect(0, 900, 100, 1000));
		late.setAttribute('id', 'late');
		dom.elements.add(late);
		dom.fireMutation();
		dom.flushFrame();
		assert.deepEqual(changes.map(({ state }) => state), ['missing', 'below']);

		late.isConnected = false;
		dom.fireMutation();
		dom.flushFrame();
		assert.deepEqual(changes.map(({ state }) => state), ['missing', 'below', 'missing']);
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('declarative viewport classes preserve unrelated classes and clean up', () => {
	const dom = installDom();
	try {
		const hero = new FakeElement(rect(0, 800, 100, 900));
		hero.setAttribute('id', 'hero');
		const header = new FakeElement();
		header.setAttribute('data-canvas-watch-viewport', '#hero');
		header.classList.add('site-header');
		dom.elements.add(hero);
		dom.elements.add(header);

		const watcher = createCanvasWatcher();
		watcher.refresh();
		dom.flushFrame();
		assert.deepEqual([...header.classList].sort(), ['cw-reference-below', 'site-header']);

		hero.setAttribute('id', 'renamed');
		dom.fireMutation();
		dom.flushFrame();
		assert.deepEqual([...header.classList].sort(), ['cw-reference-missing', 'site-header']);

		header.attributes.delete('data-canvas-watch-viewport');
		dom.fireMutation();
		dom.flushFrame();
		assert.deepEqual([...header.classList], ['site-header']);
		assert.equal(dom.mutationObservers[0].active, true, 'refresh keeps late discovery active');
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('destroy cancels pending viewport work and prevents later notification', () => {
	const dom = installDom();
	try {
		const watcher = createCanvasWatcher();
		let notifications = 0;
		watcher.observeViewport('#hero', () => notifications++);
		assert.equal(dom.frames.size, 1);
		watcher.destroy();
		assert.equal(dom.frames.size, 0);
		dom.fireMutation();
		window.dispatchEvent(new Event('scroll'));
		assert.equal(dom.frames.size, 0);
		assert.equal(notifications, 0);
	} finally {
		dom.restore();
	}
});

test('viewport subscriptions have independent tokens and suppress removed listeners', () => {
	const dom = installDom();
	try {
		const target = new FakeElement(rect(0, 100, 100, 200));
		target.setAttribute('id', 'target');
		dom.elements.add(target);
		const watcher = createCanvasWatcher();
		const states = [];
		const sharedListener = ({ state }) => states.push(state);
		const stopFirst = watcher.observeViewport('#target', sharedListener);
		watcher.observeViewport('#target', sharedListener);
		dom.flushFrame();
		assert.deepEqual(states, ['within', 'within']);

		stopFirst();
		stopFirst();
		target.rect = rect(0, 900, 100, 1000);
		watcher.schedule();
		dom.flushFrame();
		assert.deepEqual(states, ['within', 'within', 'below']);

		let removedCalls = 0;
		let stopRemoved = () => {};
		watcher.observeViewport(target, () => stopRemoved());
		stopRemoved = watcher.observeViewport(target, () => removedCalls++);
		dom.flushFrame();
		assert.equal(removedCalls, 0, 'a listener removed earlier in dispatch is suppressed');
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('viewport-first observation seeds overlap tracking across unwatch and rewatch', () => {
	const dom = installDom();
	try {
		const target = new FakeElement(rect(0, 0, 100, 100));
		const zone = new FakeElement(rect(0, 0, 100, 100));
		zone.classList.add('zone-trigger');
		dom.elements.add(target);
		dom.elements.add(zone);
		const watcher = createCanvasWatcher();
		const stopViewport = watcher.observeViewport(target, () => {});
		dom.flushFrame();
		dom.fireIntersection(target, true);
		dom.flushFrame();

		const stopWatch = watcher.watch(target);
		watcher.refresh();
		dom.flushFrame();
		assert.equal(target.classList.has('over-zone'), true);
		assert.equal(dom.intersectionObservers[0].observeCalls, 1, 'the shared IO target is not duplicated');

		stopWatch();
		assert.equal(target.classList.has('over-zone'), false);
		const stopRewatch = watcher.watch(target);
		dom.flushFrame();
		assert.equal(
			target.classList.has('over-zone'),
			true,
			'rewatch uses the still-current viewport intersection state',
		);

		stopRewatch();
		stopViewport();
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('removing one viewport registration during delivery does not suppress another', () => {
	const dom = installDom();
	try {
		const first = new FakeElement(rect(0, 100, 100, 200));
		const second = new FakeElement(rect(0, 300, 100, 400));
		dom.elements.add(first);
		dom.elements.add(second);
		const watcher = createCanvasWatcher();
		let stopFirst = () => {};
		let stopSibling = () => {};
		let siblingCalls = 0;
		let secondCalls = 0;
		stopFirst = watcher.observeViewport(first, () => {
			stopFirst();
			stopSibling();
		});
		stopSibling = watcher.observeViewport(first, () => siblingCalls++);
		watcher.observeViewport(second, () => secondCalls++);

		dom.flushFrame();
		assert.equal(siblingCalls, 0, 'the removed sibling stays suppressed');
		assert.equal(secondCalls, 1, 'an unrelated committed registration still delivers');
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('a viewport subscription created during delivery receives one initial state', async () => {
	const dom = installDom();
	try {
		const first = new FakeElement(rect(0, 100, 100, 200));
		const second = new FakeElement(rect(0, 300, 100, 400));
		dom.elements.add(first);
		dom.elements.add(second);
		const watcher = createCanvasWatcher();
		const lateDetails = [];
		watcher.observeViewport(first, () => {
			watcher.observeViewport(second, (detail) => lateDetails.push(detail));
		});
		watcher.observeViewport(second, () => {});

		dom.flushFrame();
		await Promise.resolve();
		assert.equal(lateDetails.length, 1);
		assert.equal(lateDetails[0].state, 'within');
		assert.equal(lateDetails[0].previousState, 'unknown');
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('viewport delivery isolates consumer errors and destruction is terminal mid-dispatch', () => {
	const dom = installDom();
	try {
		const target = new FakeElement(rect(0, 100, 100, 200));
		target.setAttribute('id', 'target');
		dom.elements.add(target);
		const watcher = createCanvasWatcher();
		let healthyCalls = 0;
		watcher.observeViewport('#target', () => {
			throw new Error('consumer failure');
		});
		watcher.observeViewport('#target', () => healthyCalls++);
		dom.flushFrame();
		assert.equal(healthyCalls, 1);
		assert.equal(dom.reportedErrors[0]?.message, 'consumer failure');
		watcher.destroy();

		const terminal = createCanvasWatcher();
		let siblingCalls = 0;
		terminal.observeViewport('#target', () => terminal.destroy());
		terminal.observeViewport('#target', () => siblingCalls++);
		dom.flushFrame();
		assert.equal(siblingCalls, 0);
		assert.equal(dom.frames.size, 0);
		assert.equal(dom.resizeObservers.at(-1).observed.size, 0);
		terminal.watch(target)();
		terminal.observeViewport('not-an-id', () => {})();
		terminal.refresh();
		terminal.schedule();
		assert.equal(dom.frames.size, 0, 'all public entry points remain inert after destroy');
	} finally {
		dom.restore();
	}
});

test('watch ownership is independent across duplicates, stale disposers, and selector scans', () => {
	const dom = installDom();
	try {
		const element = new FakeElement();
		element.classList.add('watch-bg-canvas');
		dom.elements.add(element);
		const watcher = createCanvasWatcher();
		const old = watcher.watch(element);
		const second = watcher.watch(element);
		watcher.refresh();
		old();
		old();
		assert.equal(dom.intersectionObservers[0].observed.has(element), true);
		second();
		assert.equal(
			dom.intersectionObservers[0].observed.has(element),
			true,
			'selector ownership survives the last manual disposer',
		);

		element.classList.delete('watch-bg-canvas');
		const newer = watcher.watch(element);
		old();
		assert.equal(dom.intersectionObservers[0].observed.has(element), true);
		newer();
		watcher.refresh();
		assert.equal(dom.intersectionObservers[0].observed.has(element), false);
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

function canvasFixture(zoneSpecs) {
	const dom = installDom();
	const watcher = createCanvasWatcher();
	const watched = new FakeElement(rect(0, 0, 100, 100));
	dom.elements.add(watched);
	const zones = [];
	for (const { rectangle, className, parent = null } of zoneSpecs) {
		const zone = new FakeElement(rectangle);
		zone.classList.add(className);
		zone.parentElement = parent === null ? null : zones[parent];
		dom.elements.add(zone);
		zones.push(zone);
	}
	watcher.watch(watched);
	watcher.refresh();
	dom.fireIntersection(watched, true);
	dom.flushFrame();
	return { dom, watcher, watched, zones };
}

test('canvas coverage unions duplicate rectangles and combines adjacent zones', () => {
	let fixture = canvasFixture([
		{ rectangle: rect(0, 0, 100, 30), className: 'a-trigger' },
		{ rectangle: rect(0, 0, 100, 30), className: 'a-trigger' },
	]);
	try {
		assert.equal(fixture.watched.classList.has('over-a'), false, 'duplicate 30% is still 30%');
		fixture.watcher.destroy();
	} finally {
		fixture.dom.restore();
	}

	fixture = canvasFixture([
		{ rectangle: rect(0, 0, 100, 30), className: 'a-trigger' },
		{ rectangle: rect(0, 30, 100, 60), className: 'a-trigger' },
	]);
	try {
		assert.equal(fixture.watched.classList.has('over-a'), true, 'adjacent zones combine to 60%');
		fixture.watcher.destroy();
	} finally {
		fixture.dom.restore();
	}
});

test('canvas depth is attached to qualifying coverage, not the whole class', () => {
	const fixture = canvasFixture([
		{ rectangle: rect(0, 0, 100, 100), className: 'a-trigger' },
		{ rectangle: rect(0, 0, 100, 60), className: 'b-trigger', parent: 0 },
		{ rectangle: rect(0, 0, 100, 1), className: 'a-trigger', parent: 1 },
	]);
	try {
		assert.equal(fixture.watched.classList.has('over-b'), true);
		assert.equal(fixture.watched.classList.has('over-a'), false);
		fixture.watcher.destroy();
	} finally {
		fixture.dom.restore();
	}
});

test('destroy from canvaschange cannot repaint a later watched element', () => {
	const dom = installDom();
	try {
		const zone = new FakeElement(rect(0, 0, 500, 500));
		zone.classList.add('zone-trigger');
		const first = new FakeElement(rect(0, 0, 100, 100));
		const second = new FakeElement(rect(200, 0, 300, 100));
		dom.elements.add(zone);
		dom.elements.add(first);
		dom.elements.add(second);
		const watcher = createCanvasWatcher();
		watcher.watch(first);
		watcher.watch(second);
		first.addEventListener('canvaschange', () => watcher.destroy(), { once: true });
		watcher.refresh();
		dom.fireIntersection(first, true);
		dom.fireIntersection(second, true);
		dom.flushFrame();
		assert.equal(first.classList.has('over-zone'), false);
		assert.equal(second.classList.has('over-zone'), false);
		assert.equal(dom.resizeObservers[0].observed.size, 0);
	} finally {
		dom.restore();
	}
});

test('viewport intersection invalidates position changes without target resize', () => {
	const dom = installDom();
	try {
		const target = new FakeElement(rect(0, 100, 100, 200));
		target.setAttribute('id', 'target');
		dom.elements.add(target);
		const states = [];
		const watcher = createCanvasWatcher();
		watcher.observeViewport('#target', ({ state }) => states.push(state));
		dom.flushFrame();
		target.rect = rect(0, 1000, 100, 1100);
		dom.fireIntersection(target, false);
		dom.flushFrame();
		assert.deepEqual(states, ['within', 'below']);
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('mutation work is coalesced and late declarative insertion remains discoverable', () => {
	const dom = installDom();
	try {
		const watcher = createCanvasWatcher();
		watcher.refresh();
		const stopTemporary = watcher.observeViewport('#temporary', () => {});
		dom.flushFrame();
		const initialScans = dom.queryCounts.get('[data-canvas-watch-viewport]') ?? 0;
		const target = new FakeElement(rect(0, 900, 100, 1000));
		target.setAttribute('id', 'target');
		const consumer = new FakeElement();
		consumer.setAttribute('data-canvas-watch-viewport', '#target');
		dom.elements.add(target);
		dom.elements.add(consumer);
		for (let index = 0; index < 100; index += 1) {
			dom.fireMutation([{ type: 'childList', attributeName: null }]);
		}
		stopTemporary();
		assert.equal(dom.frames.size, 1);
		dom.flushFrame();
		assert.equal(
			(dom.queryCounts.get('[data-canvas-watch-viewport]') ?? 0) - initialScans,
			1,
		);
		assert.equal(consumer.classList.has('cw-reference-below'), true);

		const scansBeforeIds = dom.queryCounts.get('[data-canvas-watch-viewport]') ?? 0;
		for (let index = 0; index < 100; index += 1) {
			dom.fireMutation([{ type: 'attributes', attributeName: 'id' }]);
		}
		dom.flushFrame();
		assert.equal(dom.queryCounts.get('[data-canvas-watch-viewport]'), scansBeforeIds);
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('unchanged refresh preserves trigger observer ownership', () => {
	const dom = installDom();
	try {
		const zone = new FakeElement(rect(0, 0, 100, 100));
		zone.classList.add('zone-trigger');
		dom.elements.add(zone);
		const watcher = createCanvasWatcher();
		watcher.refresh();
		const triggerObserver = dom.intersectionObservers[1];
		const resizeObserver = dom.resizeObservers[0];
		const ioCalls = triggerObserver.observeCalls;
		const resizeCalls = resizeObserver.observeCalls;
		watcher.refresh();
		assert.equal(triggerObserver.observeCalls, ioCalls);
		assert.equal(triggerObserver.unobserveCalls, 0);
		assert.equal(resizeObserver.observeCalls, resizeCalls);
		assert.equal(resizeObserver.unobserveCalls, 0);
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('invalid options and registrations fail before allocating resources', () => {
	const dom = installDom();
	try {
		assert.throws(() => createCanvasWatcher({ threshold: Number.NaN }), /threshold/);
		assert.throws(() => createCanvasWatcher({ threshold: 1.1 }), /threshold/);
		assert.throws(() => createCanvasWatcher({ triggerRootMargin: Infinity }), /triggerRootMargin/);
		assert.throws(() => createCanvasWatcher({ triggerSuffix: 'two tokens' }), /triggerSuffix/);
		assert.throws(
			() => createCanvasWatcher({ classMap: { 'a-trigger': 'two tokens' } }),
			/classMap/,
		);
		assert.equal(dom.intersectionObservers.length, 0);
		assert.equal(dom.resizeObservers.length, 0);

		const watcher = createCanvasWatcher();
		assert.throws(() => watcher.observeViewport('target', () => {}), /native ID selectors/);
		assert.throws(() => watcher.observeViewport('#target', null), /listener/);
		watcher.destroy();
	} finally {
		dom.restore();
	}
});

test('shared watcher spans ESM/CJS entries and is reacquired after destroy', async () => {
	const ssrWatcher = getSharedWatcher();
	const dom = installDom();
	try {
		const esmWatcher = getSharedWatcher();
		assert.notEqual(esmWatcher, ssrWatcher, 'the SSR no-op is not cached into a DOM runtime');
		assert.equal(dom.intersectionObservers.length, 2);
		assert.equal(dom.resizeObservers.length, 1);

		const cjsCore = require('../dist/index.cjs');
		const cjsSvelte = require('../dist/svelte/index.cjs');
		const node = new FakeElement();
		const action = cjsSvelte.watchBgCanvas(node);
		assert.equal(cjsCore.getSharedWatcher(), esmWatcher);
		assert.equal(dom.intersectionObservers.length, 2, 'mixed entries share one live core');
		assert.equal(dom.resizeObservers.length, 1);

		action.destroy();
		esmWatcher.destroy();
		const replacement = cjsCore.getSharedWatcher();
		assert.notEqual(replacement, esmWatcher);
		assert.equal(dom.intersectionObservers.length, 4);
		assert.equal(dom.resizeObservers.length, 2);
		replacement.destroy();
		await Promise.resolve();
	} finally {
		dom.restore();
	}
});
