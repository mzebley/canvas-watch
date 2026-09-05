/**
 * canvas-watch — detect which background "canvas" zone a floating element
 * is sitting over, and track the vertical viewport state of references.
 *
 * This is geometry-based (getBoundingClientRect overlap), NOT a raw
 * IntersectionObserver, because IO can only measure a target against its
 * scroll-ancestor/viewport — never against an arbitrary sibling element.
 * IntersectionObserver is still used here as a cheap visibility gate so the
 * overlap math only runs for on-screen elements.
 *
 * Framework-agnostic: no Svelte imports. The adapter in `../svelte` is a thin
 * wrapper around this.
 */

export interface CanvasWatchOptions {
	/** Selector for elements to watch. Default `.watch-bg-canvas`. */
	watchSelector?: string;
	/** Coarse selector for trigger elements; refined in JS by `triggerSuffix`. Default `[class*="-trigger"]`. */
	triggerSelector?: string;
	/** Trigger class suffix convention. Default `-trigger`. */
	triggerSuffix?: string;
	/** Applied class prefix convention. Default `over-`. */
	appliedPrefix?: string;
	/** Explicit overrides, keyed by trigger class -> applied class. Wins over the convention. */
	classMap?: Record<string, string>;
	/** Fraction of the watched element's area that must overlap a zone to count as "majority". Default 0.5. */
	threshold?: number;
	/** Margin (px) around the viewport for keeping trigger zones "active". Default 200. */
	triggerRootMargin?: number;
}

export interface CanvasWatcher {
	/** Re-scan watch, trigger, and declarative viewport elements. */
	refresh(): void;
	/** Manually register a same-document element. Returns an independent, idempotent disposer. */
	watch(el: HTMLElement): () => void;
	/** Subscribe to same-document layout-viewport state. Returns an independent, idempotent disposer. */
	observeViewport(reference: ViewportReference, listener: ViewportListener): () => void;
	/** Force a recompute on the next frame. */
	schedule(): void;
	/** Terminally tear down resources and owned classes; every later call stays inert. */
	destroy(): void;
}

/** Detail dispatched on the `canvaschange` CustomEvent each time the applied class changes. */
export interface CanvasChangeDetail {
	/** The `over-*` class now applied, or `null` if the element is over no zone. */
	appliedClass: string | null;
	/** The previous applied class, or `null`. */
	previousClass: string | null;
}

/** A native ID reference or a direct element in the watcher's document. */
export type ViewportReference = `#${string}` | Element;

/** The lifecycle and vertical position states reported by viewport observation. */
export type ViewportState = 'unknown' | 'missing' | 'above' | 'within' | 'below';

/** Detail delivered when a viewport reference changes state. */
export interface ViewportChangeDetail {
	state: ViewportState;
	previousState: ViewportState;
	reference: ViewportReference;
	element: Element | null;
	aboveViewport: boolean;
	inViewport: boolean;
	belowViewport: boolean;
	missing: boolean;
}

export type ViewportListener = (detail: ViewportChangeDetail) => void;

const DEFAULTS = {
	watchSelector: '.watch-bg-canvas',
	triggerSelector: '[class*="-trigger"]',
	triggerSuffix: '-trigger',
	appliedPrefix: 'over-',
	threshold: 0.5,
	triggerRootMargin: 200,
} as const;

const VIEWPORT_CLASSES = [
	'cw-reference-above',
	'cw-reference-within',
	'cw-reference-below',
	'cw-reference-missing',
] as const;

/** The subset of options that govern the trigger -> applied class convention. */
export type ClassResolveOptions = Pick<
	Required<CanvasWatchOptions>,
	'triggerSuffix' | 'appliedPrefix'
> & { classMap?: Record<string, string> };

/**
 * Area of the rectangular intersection of two rects. `0` when they don't overlap.
 * Pure + DOM-free so it can be unit-tested directly.
 */
export function overlapArea(a: DOMRectLike, b: DOMRectLike): number {
	const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
	const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
	return w * h;
}

/** Minimal rect shape used by {@link overlapArea} — a structural subset of `DOMRect`. */
export interface DOMRectLike {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/**
 * Classify a rect against the viewport's vertical bounds. Horizontal position
 * is deliberately ignored.
 */
export function classifyViewportRect(
	rect: Pick<DOMRectLike, 'top' | 'bottom'>,
	viewportTop: number,
	viewportBottom: number,
): Exclude<ViewportState, 'unknown' | 'missing'> {
	if (rect.bottom <= viewportTop) return 'above';
	if (rect.top >= viewportBottom) return 'below';
	return 'within';
}

/** One depth-qualified applied class claim on a watched element. */
export interface ZoneOverlap {
	/** Physical overlap area after duplicate rectangles at this depth are unioned. */
	overlap: number;
	/** Trigger nesting for this claim — 0 = not inside another zone. */
	depth: number;
}

/**
 * Pick the winning class for one watched element.
 *
 * Two rules, in order:
 *
 * 1. **Nesting wins.** A zone inside another zone is the more specific answer,
 *    so it beats its container outright — a dark band inside a light section
 *    gets to say "dark" even though the section covers strictly more of the
 *    element. Without this, a container zone can never be overridden, because
 *    its overlap is by definition at least its children's.
 * 2. **Then physical majority overlap**, among zones at the same nesting depth.
 *
 * Only zones clearing `threshold` are eligible, so a deeply nested zone that
 * barely clips the element can't hijack it — depth reorders the candidates,
 * it doesn't lower the bar. An array keeps one class's coverage paired with
 * each depth instead of letting a small nested contribution promote an
 * ancestor. Pure + DOM-free.
 */
export function pickWinningClass(
	totals: ReadonlyMap<string, ZoneOverlap | readonly ZoneOverlap[]>,
	area: number,
	threshold: number,
): string | null {
	if (area <= 0) return null;

	let best: string | null = null;
	let bestDepth = -1;
	let bestOverlap = 0;

	for (const [cls, value] of totals) {
		const candidates = Array.isArray(value) ? value : [value];
		for (const { overlap, depth } of candidates) {
			if (overlap <= 0 || overlap / area < threshold) continue;
			if (depth > bestDepth || (depth === bestDepth && overlap > bestOverlap)) {
				best = cls;
				bestDepth = depth;
				bestOverlap = overlap;
			}
		}
	}

	return best;
}

/**
 * Resolve a single trigger class to its applied class.
 *
 * `classMap` wins; otherwise the convention is "strip `triggerSuffix`, prefix
 * with `appliedPrefix`" (e.g. `canvas-danger-trigger` → `over-canvas-danger`).
 * Returns `null` for classes that aren't triggers. Pure + DOM-free.
 */
export function resolveAppliedClass(
	triggerClass: string,
	opts: ClassResolveOptions,
): string | null {
	// hasOwn, not `in`: a class like "constructor" must not hit Object.prototype.
	if (opts.classMap && Object.hasOwn(opts.classMap, triggerClass)) {
		return opts.classMap[triggerClass] ?? null;
	}
	if (!triggerClass.endsWith(opts.triggerSuffix)) return null;
	const base = triggerClass.slice(0, -opts.triggerSuffix.length);
	return base ? opts.appliedPrefix + base : null;
}

/** A trigger element's indexed state: what it applies, and how deeply it nests. */
interface TriggerEntry {
	classes: Set<string>;
	/** Number of registered trigger elements between this one and the root. */
	depth: number;
}

function intersectionRect(a: DOMRectLike, b: DOMRectLike): DOMRectLike | null {
	const left = Math.max(a.left, b.left);
	const right = Math.min(a.right, b.right);
	const top = Math.max(a.top, b.top);
	const bottom = Math.min(a.bottom, b.bottom);
	return right > left && bottom > top ? { left, right, top, bottom } : null;
}

/** Physical union area for axis-aligned rectangles in O(n log n) time. */
function rectangleUnionArea(rects: readonly DOMRectLike[]): number {
	if (rects.length === 0) return 0;
	const ys = [...new Set(rects.flatMap(({ top, bottom }) => [top, bottom]))].sort(
		(a, b) => a - b,
	);
	if (ys.length < 2) return 0;

	const yIndexes = new Map(ys.map((value, index) => [value, index]));
	const events = rects
		.flatMap((rect) => [
			{ x: rect.left, delta: 1, start: yIndexes.get(rect.top)!, end: yIndexes.get(rect.bottom)! - 1 },
			{ x: rect.right, delta: -1, start: yIndexes.get(rect.top)!, end: yIndexes.get(rect.bottom)! - 1 },
		])
		.sort((a, b) => a.x - b.x);
	const segmentCount = ys.length - 1;
	const cover = new Int32Array(segmentCount * 4);
	const coveredLength = new Float64Array(segmentCount * 4);

	const update = (
		node: number,
		left: number,
		right: number,
		start: number,
		end: number,
		delta: number,
	) => {
		if (start <= left && right <= end) {
			cover[node] = (cover[node] ?? 0) + delta;
		} else {
			const middle = (left + right) >> 1;
			if (start <= middle) update(node * 2, left, middle, start, end, delta);
			if (end > middle) update(node * 2 + 1, middle + 1, right, start, end, delta);
		}
		if ((cover[node] ?? 0) > 0) coveredLength[node] = ys[right + 1]! - ys[left]!;
		else if (left === right) coveredLength[node] = 0;
		else coveredLength[node] = coveredLength[node * 2]! + coveredLength[node * 2 + 1]!;
	};

	let area = 0;
	let previousX = events[0]!.x;
	for (let index = 0; index < events.length; ) {
		const x = events[index]!.x;
		area += (x - previousX) * coveredLength[1]!;
		while (index < events.length && events[index]!.x === x) {
			const event = events[index]!;
			if (event.start <= event.end) {
				update(1, 0, segmentCount - 1, event.start, event.end, event.delta);
			}
			index += 1;
		}
		previousX = x;
	}
	return area;
}

function assertClassToken(value: unknown, label: string): asserts value is string {
	if (typeof value !== 'string' || value.length === 0 || /\s/.test(value)) {
		throw new TypeError(`${label} must be one non-empty class token.`);
	}
}

function validateOptions(options: CanvasWatchOptions): Required<Omit<CanvasWatchOptions, 'classMap'>> & {
	classMap?: Record<string, string>;
} {
	const opts = { ...DEFAULTS, ...options };
	if (!Number.isFinite(opts.threshold) || opts.threshold < 0 || opts.threshold > 1) {
		throw new RangeError('threshold must be a finite number between 0 and 1.');
	}
	if (!Number.isFinite(opts.triggerRootMargin)) {
		throw new TypeError('triggerRootMargin must be a finite number of pixels.');
	}
	if (typeof opts.watchSelector !== 'string' || opts.watchSelector.trim() === '') {
		throw new TypeError('watchSelector must be a non-empty selector.');
	}
	if (typeof opts.triggerSelector !== 'string' || opts.triggerSelector.trim() === '') {
		throw new TypeError('triggerSelector must be a non-empty selector.');
	}
	assertClassToken(opts.triggerSuffix, 'triggerSuffix');
	assertClassToken(opts.appliedPrefix, 'appliedPrefix');
	if (
		opts.classMap !== undefined &&
		(typeof opts.classMap !== 'object' || opts.classMap === null || Array.isArray(opts.classMap))
	) {
		throw new TypeError('classMap must be an object of single class-token mappings.');
	}
	if (opts.classMap) {
		for (const [triggerClass, appliedClass] of Object.entries(opts.classMap)) {
			assertClassToken(triggerClass, 'Each classMap key');
			assertClassToken(appliedClass, `classMap["${triggerClass}"]`);
		}
	}
	if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
		for (const [label, selector] of [
			['watchSelector', opts.watchSelector],
			['triggerSelector', opts.triggerSelector],
		] as const) {
			try {
				document.querySelector(selector);
			} catch (error) {
				throw new TypeError(`${label} must be a valid selector.`, { cause: error });
			}
		}
	}
	return opts;
}

function reportConsumerError(error: unknown): void {
	if (typeof globalThis.reportError === 'function') {
		globalThis.reportError(error);
		return;
	}
	queueMicrotask(() => {
		throw error;
	});
}

/**
 * Create a watcher. In the browser, returns a live instance; during SSR it
 * returns a no-op so callers don't need to guard `typeof window`.
 */
export function createCanvasWatcher(options: CanvasWatchOptions = {}): CanvasWatcher {
	const opts = validateOptions(options);
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return {
			refresh() {},
			watch: () => () => {},
			observeViewport: () => () => {},
			schedule() {},
			destroy() {},
		};
	}

	/** Independent imperative owners for each watched element. */
	const manualCounts = new Map<HTMLElement, number>();
	/** Elements owned by the current `watchSelector` scan. */
	const selectorWatched = new Set<HTMLElement>();
	/** All currently watched elements (manual ∪ selector-scanned). */
	const watched = new Set<HTMLElement>();
	/** Trigger element -> the classes it contributes, and how deeply it's nested. */
	const triggers = new Map<HTMLElement, TriggerEntry>();

	const visibleWatched = new Set<HTMLElement>();
	/** Current IO state for targets shared by overlap and viewport tracking. */
	const intersectingElements = new Set<Element>();
	const pendingCanvasClears = new Set<HTMLElement>();
	const activeTriggers = new Set<HTMLElement>();
	const applied = new WeakMap<HTMLElement, string | null>();

	interface ViewportSubscription {
		listener: ViewportListener;
		deliveredVersion: number;
		initialPending: boolean;
	}

	interface ViewportRegistration {
		reference: ViewportReference;
		state: ViewportState;
		version: number;
		resolved: Element | null;
		listeners: Map<number, ViewportSubscription>;
	}

	interface DeclarativeRegistration {
		reference: string;
		unsubscribe: (() => void) | null;
		appliedClass: string | null;
	}

	const viewportRegistrations = new Map<ViewportReference, ViewportRegistration>();
	const declarativeRegistrations = new Map<HTMLElement, DeclarativeRegistration>();
	const viewportElementCounts = new Map<Element, number>();
	const resizeObserved = new Map<Element, number>();

	let frame = 0;
	let mutationObserver: MutationObserver | null = null;
	let mutationObserverActive = false;
	let declarativeDiscoveryEnabled = false;
	let declarativeDirty = false;
	let measuring = false;
	let destroyed = false;
	let nextViewportToken = 1;

	function appliedClassesFor(el: Element): Set<string> {
		const out = new Set<string>();
		el.classList.forEach((cls) => {
			const resolved = resolveAppliedClass(cls, opts);
			if (resolved) out.add(resolved);
		});
		return out;
	}

	const watchIo = new IntersectionObserver((entries) => {
		if (destroyed) return;
		for (const e of entries) {
			const el = e.target as HTMLElement;
			if (!watched.has(el) && !viewportElementCounts.has(el)) {
				intersectingElements.delete(el);
				continue;
			}
			if (e.isIntersecting) intersectingElements.add(el);
			else intersectingElements.delete(el);
			if (watched.has(el)) {
				if (e.isIntersecting) {
					visibleWatched.add(el);
					pendingCanvasClears.delete(el);
				} else {
					visibleWatched.delete(el);
					pendingCanvasClears.add(el);
				}
			}
		}
		schedule();
	});

	const triggerIo = new IntersectionObserver(
		(entries) => {
			if (destroyed) return;
			for (const e of entries) {
				const el = e.target as HTMLElement;
				if (!triggers.has(el)) continue;
				if (e.isIntersecting) activeTriggers.add(el);
				else activeTriggers.delete(el);
			}
			schedule();
		},
		{ rootMargin: `${opts.triggerRootMargin}px` },
	);

	const ro = new ResizeObserver(() => {
		if (!destroyed) schedule();
	});

	function observeResize(el: Element) {
		const count = resizeObserved.get(el) ?? 0;
		if (count === 0) ro.observe(el);
		resizeObserved.set(el, count + 1);
	}

	function unobserveResize(el: Element) {
		const count = resizeObserved.get(el);
		if (!count) return;
		if (count === 1) {
			resizeObserved.delete(el);
			ro.unobserve(el);
		} else {
			resizeObserved.set(el, count - 1);
		}
	}

	function clearApplied(el: HTMLElement): CanvasChangeDetail | null {
		const prev = applied.get(el) ?? null;
		if (!prev) return null;
		el.classList.remove(prev);
		applied.delete(el);
		return { appliedClass: null, previousClass: prev };
	}

	function viewportDetail(
		registration: ViewportRegistration,
		state: ViewportState,
		previousState: ViewportState,
		element = registration.resolved,
	): ViewportChangeDetail {
		return {
			state,
			previousState,
			reference: registration.reference,
			element,
			aboveViewport: state === 'above',
			inViewport: state === 'within',
			belowViewport: state === 'below',
			missing: state === 'missing',
		};
	}

	function deliverViewportSubscription(
		registration: ViewportRegistration,
		token: number,
		detail?: ViewportChangeDetail,
	) {
		const subscription = registration.listeners.get(token);
		if (!subscription || subscription.deliveredVersion >= registration.version) return;
		const nextDetail = subscription.initialPending
			? viewportDetail(registration, registration.state, 'unknown')
			: detail ?? viewportDetail(registration, registration.state, registration.state);

		// Commit delivery before consumer code can unsubscribe, subscribe, or throw.
		subscription.deliveredVersion = registration.version;
		subscription.initialPending = false;
		try {
			subscription.listener(nextDetail);
		} catch (error) {
			reportConsumerError(error);
		}
	}

	function isIdReference(reference: unknown): reference is `#${string}` {
		return typeof reference === 'string' && reference.startsWith('#') && reference.length > 1;
	}

	function resolveViewportReference(reference: ViewportReference): Element | null {
		if (typeof reference === 'string') return document.getElementById(reference.slice(1));
		return reference.isConnected ? reference : null;
	}

	function retainViewportElement(element: Element) {
		const count = viewportElementCounts.get(element) ?? 0;
		if (count === 0) {
			if (!watched.has(element as HTMLElement)) watchIo.observe(element);
			observeResize(element);
		}
		viewportElementCounts.set(element, count + 1);
	}

	function releaseViewportElement(element: Element) {
		const count = viewportElementCounts.get(element);
		if (!count) return;
		if (count === 1) {
			viewportElementCounts.delete(element);
			if (!watched.has(element as HTMLElement)) {
				watchIo.unobserve(element);
				intersectingElements.delete(element);
			}
			unobserveResize(element);
		} else {
			viewportElementCounts.set(element, count - 1);
		}
	}

	function setResolved(registration: ViewportRegistration, next: Element | null) {
		if (registration.resolved === next) return;
		if (registration.resolved) releaseViewportElement(registration.resolved);
		registration.resolved = next;
		if (next) retainViewportElement(next);
	}

	function setDeclarativeClass(
		element: HTMLElement,
		registration: DeclarativeRegistration,
		state: ViewportState,
	) {
		const next =
			state === 'above'
				? 'cw-reference-above'
				: state === 'within'
					? 'cw-reference-within'
					: state === 'below'
						? 'cw-reference-below'
						: state === 'missing'
							? 'cw-reference-missing'
							: null;
		if (registration.appliedClass === next) return;
		for (const ownedClass of VIEWPORT_CLASSES) {
			if (ownedClass !== next) element.classList.remove(ownedClass);
		}
		if (next) element.classList.add(next);
		registration.appliedClass = next;
	}

	function removeDeclarative(element: HTMLElement) {
		const registration = declarativeRegistrations.get(element);
		if (!registration) return;
		registration.unsubscribe?.();
		if (registration.appliedClass) element.classList.remove(registration.appliedClass);
		declarativeRegistrations.delete(element);
	}

	function ensureMutationObserver() {
		if (destroyed || mutationObserverActive || typeof MutationObserver === 'undefined') return;
		if (!mutationObserver) {
			mutationObserver = new MutationObserver((records) => {
				if (destroyed) return;
				if (
					records.length === 0 ||
					records.some(
						(record) =>
							record.type === 'childList' ||
							(record.type === 'attributes' &&
								record.attributeName === 'data-canvas-watch-viewport'),
					)
				) {
					declarativeDirty = true;
				}
				schedule();
			});
		}
		mutationObserver.observe(document.documentElement, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['id', 'class', 'style', 'hidden', 'data-canvas-watch-viewport'],
		});
		mutationObserverActive = true;
	}

	function maybeDisconnectMutationObserver() {
		if (
			declarativeDiscoveryEnabled ||
			viewportRegistrations.size > 0 ||
			declarativeRegistrations.size > 0
		) return;
		mutationObserver?.disconnect();
		mutationObserverActive = false;
	}

	function reconcileDeclarative() {
		if (destroyed) return;
		declarativeDirty = false;
		const found = new Set(
			document.querySelectorAll<HTMLElement>('[data-canvas-watch-viewport]'),
		);
		for (const element of declarativeRegistrations.keys()) {
			if (!found.has(element)) removeDeclarative(element);
		}

		for (const element of found) {
			const reference = element.getAttribute('data-canvas-watch-viewport')?.trim() ?? '';
			const current = declarativeRegistrations.get(element);
			if (current?.reference === reference) continue;
			if (current) removeDeclarative(element);

			const registration: DeclarativeRegistration = {
				reference,
				unsubscribe: null,
				appliedClass: null,
			};
			declarativeRegistrations.set(element, registration);

			if (!isIdReference(reference)) {
				setDeclarativeClass(element, registration, 'missing');
				continue;
			}
			registration.unsubscribe = observeViewport(reference, (detail) => {
				setDeclarativeClass(element, registration, detail.state);
			});
		}

		if (declarativeRegistrations.size > 0 || declarativeDiscoveryEnabled) ensureMutationObserver();
		else maybeDisconnectMutationObserver();
	}

	function measure() {
		frame = 0;
		if (destroyed) return;
		measuring = true;
		if (declarativeDirty) reconcileDeclarative();

		const rects = new Map<Element, DOMRect>();
		const readRect = (element: Element): DOMRect => {
			let rect = rects.get(element);
			if (!rect) {
				rect = element.getBoundingClientRect();
				rects.set(element, rect);
			}
			return rect;
		};
		const canvasDecisions: Array<[HTMLElement, string | null]> = [];
		for (const element of pendingCanvasClears) {
			if (watched.has(element)) canvasDecisions.push([element, null]);
		}

		// ── Read phase ──────────────────────────────────────────────────────────
		// Snapshot every active trigger's rect once per frame (not once per
		// watched element), and read all watched rects, before mutating any class.
		// Reading ahead of writing keeps the browser to a single layout pass per
		// frame instead of forcing a reflow between each element.
		const triggerRects: Array<{ rect: DOMRect; entry: TriggerEntry }> = [];
		if (visibleWatched.size > 0) {
			for (const t of activeTriggers) {
				const entry = triggers.get(t);
				if (!entry || entry.classes.size === 0) continue;
				triggerRects.push({ rect: readRect(t), entry });
			}
		}

		// No zone in play right now — clear everyone and skip their rect reads.
		if (triggerRects.length === 0) {
			for (const el of visibleWatched) canvasDecisions.push([el, null]);
		}

		// Reused across elements — the winner is read out before the next element
		// clears it, so one Map serves the whole frame instead of one per element.
		const contributions = new Map<string, Map<number, DOMRectLike[]>>();
		const totals = new Map<string, ZoneOverlap[]>();
		for (const el of triggerRects.length > 0 ? visibleWatched : []) {
			const rect = readRect(el);
			const area = rect.width * rect.height;
			if (area <= 0) {
				canvasDecisions.push([el, null]);
				continue;
			}

			// Collect physical intersections by applied class and depth. Unioning
			// within each bucket avoids double-counting duplicate rectangles while
			// preserving depth as part of qualification.
			contributions.clear();
			for (const { rect: tr, entry } of triggerRects) {
				const intersection = intersectionRect(rect, tr);
				if (!intersection) continue;
				for (const cls of entry.classes) {
					let byDepth = contributions.get(cls);
					if (!byDepth) contributions.set(cls, (byDepth = new Map()));
					let rectangles = byDepth.get(entry.depth);
					if (!rectangles) byDepth.set(entry.depth, (rectangles = []));
					rectangles.push(intersection);
				}
			}
			totals.clear();
			for (const [cls, byDepth] of contributions) {
				totals.set(
					cls,
					[...byDepth].map(([depth, rectangles]) => ({
						depth,
						overlap: rectangleUnionArea(rectangles),
					})),
				);
			}

			canvasDecisions.push([el, pickWinningClass(totals, area, opts.threshold)]);
		}

		const viewportDecisions: Array<{
			registration: ViewportRegistration;
			resolved: Element | null;
			state: ViewportState;
		}> = [];
		const viewportBottom = window.innerHeight || document.documentElement.clientHeight;
		for (const registration of viewportRegistrations.values()) {
			const resolved = resolveViewportReference(registration.reference);
			if (!resolved) {
				viewportDecisions.push({ registration, resolved, state: 'missing' });
				continue;
			}
			viewportDecisions.push({
				registration,
				resolved,
				state: classifyViewportRect(readRect(resolved), 0, viewportBottom),
			});
		}

		// ── Commit phase ────────────────────────────────────────────────────────
		// Commit every resource and state decision before calling consumer code.
		const canvasChanges: Array<[HTMLElement, CanvasChangeDetail]> = [];
		for (const [el, next] of canvasDecisions) {
			if (destroyed || !watched.has(el)) continue;
			const previousClass = applied.get(el) ?? null;
			if (previousClass === next) continue;
			if (previousClass) el.classList.remove(previousClass);
			if (next) el.classList.add(next);
			if (next) applied.set(el, next);
			else applied.delete(el);
			canvasChanges.push([el, { appliedClass: next, previousClass }]);
		}
		pendingCanvasClears.clear();

		const viewportChanges: Array<[ViewportRegistration, ViewportChangeDetail]> = [];
		for (const { registration, resolved, state } of viewportDecisions) {
			if (
				destroyed ||
				viewportRegistrations.get(registration.reference) !== registration
			) continue;
			setResolved(registration, resolved);
			if (registration.state === state) continue;
			const previousState = registration.state;
			registration.state = state;
			registration.version += 1;
			viewportChanges.push([
				registration,
				viewportDetail(registration, state, previousState, resolved),
			]);
		}

		measuring = false;

		// ── Delivery phase ──────────────────────────────────────────────────────
		for (const [element, detail] of canvasChanges) {
			if (destroyed || !watched.has(element) || (applied.get(element) ?? null) !== detail.appliedClass) {
				continue;
			}
			element.dispatchEvent(new CustomEvent<CanvasChangeDetail>('canvaschange', { detail }));
		}

		for (const [registration, detail] of viewportChanges) {
			for (const token of [...registration.listeners.keys()]) {
				if (destroyed) return;
				if (viewportRegistrations.get(registration.reference) !== registration) break;
				deliverViewportSubscription(registration, token, detail);
			}
		}
	}

	function schedule() {
		if (destroyed || frame || measuring) return;
		const hasCanvasWork =
			pendingCanvasClears.size > 0 || (visibleWatched.size > 0 && triggers.size > 0);
		if (!hasCanvasWork && viewportRegistrations.size === 0 && !declarativeDirty) return;
		frame = requestAnimationFrame(measure);
	}

	function addWatched(el: HTMLElement) {
		if (watched.has(el)) return;
		watched.add(el);
		if (!viewportElementCounts.has(el)) watchIo.observe(el);
		else if (intersectingElements.has(el)) {
			visibleWatched.add(el);
			pendingCanvasClears.delete(el);
		}
		observeResize(el);
	}

	function removeWatched(el: HTMLElement, notify = true) {
		if (!watched.has(el)) return;
		watched.delete(el);
		visibleWatched.delete(el);
		pendingCanvasClears.delete(el);
		if (!viewportElementCounts.has(el)) {
			watchIo.unobserve(el);
			intersectingElements.delete(el);
		}
		unobserveResize(el);
		const detail = clearApplied(el);
		if (notify && !destroyed && detail) {
			el.dispatchEvent(new CustomEvent<CanvasChangeDetail>('canvaschange', { detail }));
		}
	}

	function maybeRemoveWatched(el: HTMLElement) {
		if ((manualCounts.get(el) ?? 0) === 0 && !selectorWatched.has(el)) removeWatched(el);
	}

	/**
	 * How many registered trigger zones `el` sits inside. Walks up to the nearest
	 * indexed trigger ancestor and takes its depth + 1; because triggers are
	 * indexed in document order, that ancestor's depth is already final.
	 */
	function depthOf(el: HTMLElement, index: ReadonlyMap<HTMLElement, TriggerEntry>): number {
		for (let p = el.parentElement; p; p = p.parentElement) {
			const entry = index.get(p);
			if (entry) return entry.depth + 1;
		}
		return 0;
	}

	function refresh() {
		if (destroyed) return;
		declarativeDiscoveryEnabled = true;
		ensureMutationObserver();

		// Reconcile selector ownership without disturbing imperative owners.
		const scanned = new Set(
			document.querySelectorAll<HTMLElement>(opts.watchSelector),
		);
		for (const el of selectorWatched) {
			if (scanned.has(el)) continue;
			selectorWatched.delete(el);
			maybeRemoveWatched(el);
			if (destroyed) return;
		}
		for (const el of scanned) {
			if (!selectorWatched.has(el)) selectorWatched.add(el);
			addWatched(el);
		}

		// Build the next trigger index in document order, then diff resources.
		const nextTriggers = new Map<HTMLElement, TriggerEntry>();
		for (const t of document.querySelectorAll<HTMLElement>(opts.triggerSelector)) {
			const classes = appliedClassesFor(t);
			if (classes.size === 0) continue;
			nextTriggers.set(t, { classes, depth: depthOf(t, nextTriggers) });
		}
		for (const t of triggers.keys()) {
			if (nextTriggers.has(t)) continue;
			triggers.delete(t);
			activeTriggers.delete(t);
			triggerIo.unobserve(t);
			unobserveResize(t);
		}
		for (const [t, entry] of nextTriggers) {
			if (triggers.has(t)) {
				triggers.set(t, entry);
				continue;
			}
			triggers.set(t, entry);
			activeTriggers.add(t);
			triggerIo.observe(t);
			observeResize(t);
		}

		// With no zones registered, schedule() is now a no-op, so measure() will
		// never run to clear tints inherited from a previous page — do it here.
		if (triggers.size === 0) {
			for (const el of [...watched]) {
				const detail = clearApplied(el);
				if (detail && !destroyed) {
					el.dispatchEvent(new CustomEvent<CanvasChangeDetail>('canvaschange', { detail }));
				}
				if (destroyed) return;
			}
		}

		reconcileDeclarative();
		schedule();
	}

	function observeViewport(
		reference: ViewportReference,
		listener: ViewportListener,
	): () => void {
		if (destroyed) return () => {};
		if (typeof reference === 'string' && !isIdReference(reference)) {
			throw new TypeError('Viewport string references must be native ID selectors such as "#hero".');
		}
		if (
			typeof reference !== 'string' &&
			(!reference ||
				typeof reference.getBoundingClientRect !== 'function' ||
				(reference.ownerDocument && reference.ownerDocument !== document))
		) {
			throw new TypeError('Viewport element references must belong to the watcher document.');
		}
		if (typeof listener !== 'function') {
			throw new TypeError('Viewport listener must be a function.');
		}

		let registration = viewportRegistrations.get(reference);
		if (!registration) {
			registration = {
				reference,
				state: 'unknown',
				version: 0,
				resolved: null,
				listeners: new Map(),
			};
			viewportRegistrations.set(reference, registration);
		}
		const token = nextViewportToken++;
		const subscription: ViewportSubscription = {
			listener,
			deliveredVersion:
				registration.state === 'unknown' ? registration.version : registration.version - 1,
			initialPending: true,
		};
		registration.listeners.set(token, subscription);
		ensureMutationObserver();
		schedule();

		if (registration.state !== 'unknown') {
			const current = registration;
			queueMicrotask(() => {
				if (
					!destroyed &&
					viewportRegistrations.get(reference) === current &&
					current.listeners.get(token) === subscription
				) {
					deliverViewportSubscription(current, token);
				}
			});
		}

		let subscribed = true;
		return () => {
			if (!subscribed) return;
			subscribed = false;
			registration?.listeners.delete(token);
			if (registration?.listeners.size === 0) {
				if (viewportRegistrations.get(reference) === registration) {
					viewportRegistrations.delete(reference);
				}
				if (registration.resolved) {
					releaseViewportElement(registration.resolved);
					registration.resolved = null;
				}
			}
			maybeDisconnectMutationObserver();
			if (
				frame &&
				viewportRegistrations.size === 0 &&
				!declarativeDirty &&
				pendingCanvasClears.size === 0 &&
				!(visibleWatched.size > 0 && triggers.size > 0)
			) {
				cancelAnimationFrame(frame);
				frame = 0;
			}
		};
	}

	const onScroll = () => schedule();
	window.addEventListener('scroll', onScroll, { passive: true, capture: true });
	window.addEventListener('resize', onScroll, { passive: true });

	return {
		refresh,
		schedule,
		observeViewport,
		watch(el: HTMLElement) {
			if (destroyed) return () => {};
			if (
				!el ||
				typeof el.getBoundingClientRect !== 'function' ||
				(el.ownerDocument && el.ownerDocument !== document)
			) {
				throw new TypeError('Watched elements must belong to the watcher document.');
			}
			manualCounts.set(el, (manualCounts.get(el) ?? 0) + 1);
			addWatched(el);
			schedule();
			let watching = true;
			return () => {
				if (!watching) return;
				watching = false;
				const count = manualCounts.get(el) ?? 0;
				if (count <= 1) manualCounts.delete(el);
				else manualCounts.set(el, count - 1);
				maybeRemoveWatched(el);
			};
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
			window.removeEventListener('resize', onScroll);
			watchIo.disconnect();
			triggerIo.disconnect();
			ro.disconnect();
			mutationObserver?.disconnect();
			mutationObserver = null;
			mutationObserverActive = false;
			declarativeDirty = false;
			for (const [element, registration] of declarativeRegistrations) {
				if (registration.appliedClass) element.classList.remove(registration.appliedClass);
			}
			for (const el of watched) clearApplied(el);
			watched.clear();
			manualCounts.clear();
			selectorWatched.clear();
			triggers.clear();
			visibleWatched.clear();
			intersectingElements.clear();
			pendingCanvasClears.clear();
			activeTriggers.clear();
			viewportRegistrations.clear();
			declarativeRegistrations.clear();
			viewportElementCounts.clear();
			resizeObserved.clear();
		},
	};
}
