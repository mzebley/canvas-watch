/**
 * canvas-watch — detect which background "canvas" zone a floating element
 * is sitting over, and reflect it as a class on that element.
 *
 * This is geometry-based (getBoundingClientRect overlap), NOT a raw
 * IntersectionObserver, because IO can only measure a target against its
 * scroll-ancestor/viewport — never against an arbitrary sibling element.
 * IntersectionObserver is still used here as a cheap visibility gate so the
 * overlap math only runs for on-screen elements.
 *
 * Framework-agnostic: no Svelte/Angular imports. The framework adapters in
 * `../svelte` and `../angular` are thin wrappers around this.
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
	/** Re-scan the DOM for watch + trigger elements. Call after dynamic content changes. */
	refresh(): void;
	/** Manually register an element to watch. Returns an unwatch function. */
	watch(el: HTMLElement): () => void;
	/** Force a recompute on the next frame. */
	schedule(): void;
	/** Tear everything down and remove all applied classes. */
	destroy(): void;
}

/** Detail dispatched on the `canvaschange` CustomEvent each time the applied class changes. */
export interface CanvasChangeDetail {
	/** The `over-*` class now applied, or `null` if the element is over no zone. */
	appliedClass: string | null;
	/** The previous applied class, or `null`. */
	previousClass: string | null;
}

const DEFAULTS = {
	watchSelector: '.watch-bg-canvas',
	triggerSelector: '[class*="-trigger"]',
	triggerSuffix: '-trigger',
	appliedPrefix: 'over-',
	threshold: 0.5,
	triggerRootMargin: 200,
} as const;

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

/**
 * Create a watcher. In the browser, returns a live instance; during SSR it
 * returns a no-op so callers don't need to guard `typeof window`.
 */
export function createCanvasWatcher(options: CanvasWatchOptions = {}): CanvasWatcher {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return { refresh() {}, watch: () => () => {}, schedule() {}, destroy() {} };
	}

	const opts = { ...DEFAULTS, ...options };

	/** Elements registered via an adapter/`watch()` — persist across refreshes. */
	const manual = new Set<HTMLElement>();
	/** All currently watched elements (manual ∪ selector-scanned). */
	const watched = new Set<HTMLElement>();
	/** Trigger element -> the set of applied classes it contributes. */
	const triggers = new Map<HTMLElement, Set<string>>();

	const visibleWatched = new Set<HTMLElement>();
	const activeTriggers = new Set<HTMLElement>();
	const applied = new WeakMap<HTMLElement, string | null>();

	let frame = 0;

	function appliedClassesFor(el: Element): Set<string> {
		const out = new Set<string>();
		el.classList.forEach((cls) => {
			const resolved = resolveAppliedClass(cls, opts);
			if (resolved) out.add(resolved);
		});
		return out;
	}

	const watchIo = new IntersectionObserver((entries) => {
		for (const e of entries) {
			const el = e.target as HTMLElement;
			if (e.isIntersecting) visibleWatched.add(el);
			else {
				visibleWatched.delete(el);
				setApplied(el, null); // off-screen → revert to default tint
			}
		}
		schedule();
	});

	const triggerIo = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				const el = e.target as HTMLElement;
				if (e.isIntersecting) activeTriggers.add(el);
				else activeTriggers.delete(el);
			}
			schedule();
		},
		{ rootMargin: `${opts.triggerRootMargin}px` },
	);

	const ro = new ResizeObserver(() => schedule());

	function setApplied(el: HTMLElement, next: string | null) {
		const prev = applied.get(el) ?? null;
		if (prev === next) return;
		if (prev) el.classList.remove(prev);
		if (next) el.classList.add(next);
		applied.set(el, next);
		el.dispatchEvent(
			new CustomEvent<CanvasChangeDetail>('canvaschange', {
				detail: { appliedClass: next, previousClass: prev },
			}),
		);
	}

	function measure() {
		frame = 0;
		if (visibleWatched.size === 0) return;

		// ── Read phase ──────────────────────────────────────────────────────────
		// Snapshot every active trigger's rect once per frame (not once per
		// watched element), and read all watched rects, before mutating any class.
		// Reading ahead of writing keeps the browser to a single layout pass per
		// frame instead of forcing a reflow between each element.
		const triggerRects: Array<{ rect: DOMRect; classes: Set<string> }> = [];
		for (const t of activeTriggers) {
			const classes = triggers.get(t);
			if (!classes || classes.size === 0) continue;
			triggerRects.push({ rect: t.getBoundingClientRect(), classes });
		}

		// No zone in play right now — clear everyone and skip the rect reads.
		if (triggerRects.length === 0) {
			for (const el of visibleWatched) setApplied(el, null);
			return;
		}

		const decisions: Array<[HTMLElement, string | null]> = [];
		for (const el of visibleWatched) {
			const rect = el.getBoundingClientRect();
			const area = rect.width * rect.height;
			if (area <= 0) {
				decisions.push([el, null]);
				continue;
			}

			// Sum overlap per applied class; track the running winner inline (sums
			// only grow, so the final max equals the max seen during accumulation).
			let best: string | null = null;
			let bestOverlap = 0;
			const overlapByClass = new Map<string, number>();
			for (const { rect: tr, classes } of triggerRects) {
				const ov = overlapArea(rect, tr);
				if (ov <= 0) continue;
				for (const cls of classes) {
					const sum = (overlapByClass.get(cls) ?? 0) + ov;
					overlapByClass.set(cls, sum);
					if (sum > bestOverlap) {
						bestOverlap = sum;
						best = cls;
					}
				}
			}

			decisions.push([el, best && bestOverlap / area >= opts.threshold ? best : null]);
		}

		// ── Write phase ─────────────────────────────────────────────────────────
		// Reads are done; apply class changes together. setApplied is a no-op when
		// the class is unchanged, so steady state touches the DOM zero times.
		for (const [el, cls] of decisions) setApplied(el, cls);
	}

	function schedule() {
		// Skip the frame entirely when there is nothing to compute: nothing on
		// screen, or the current page registers no trigger zones at all.
		if (frame || visibleWatched.size === 0 || triggers.size === 0) return;
		frame = requestAnimationFrame(measure);
	}

	function addWatched(el: HTMLElement) {
		if (watched.has(el)) return;
		watched.add(el);
		watchIo.observe(el);
		ro.observe(el);
	}

	function removeWatched(el: HTMLElement) {
		if (!watched.has(el)) return;
		watched.delete(el);
		visibleWatched.delete(el);
		watchIo.unobserve(el);
		ro.unobserve(el);
		setApplied(el, null);
	}

	function refresh() {
		// Reconcile watched elements: keep manual ones, sync selector-scanned ones.
		const scanned = new Set(
			document.querySelectorAll<HTMLElement>(opts.watchSelector),
		);
		const desired = new Set<HTMLElement>([...manual, ...scanned]);
		for (const el of watched) if (!desired.has(el)) removeWatched(el);
		for (const el of desired) addWatched(el);

		// Rebuild the trigger index from scratch — classes may have changed.
		for (const t of triggers.keys()) {
			triggerIo.unobserve(t);
			ro.unobserve(t);
		}
		triggers.clear();
		activeTriggers.clear();
		for (const t of document.querySelectorAll<HTMLElement>(opts.triggerSelector)) {
			const classes = appliedClassesFor(t);
			if (classes.size === 0) continue;
			triggers.set(t, classes);
			// Seed as active until the observer's first delivery says otherwise.
			// IO reports asynchronously, after the rAF that schedule() queues below —
			// starting empty would give measure() one frame with no triggers, which
			// strips every applied class and fires spurious canvaschange events on
			// each refresh. The rootMargin gate is only a perf filter, so one frame
			// of measuring far-away triggers is harmless.
			activeTriggers.add(t);
			triggerIo.observe(t);
			ro.observe(t);
		}

		// With no zones registered, schedule() is now a no-op, so measure() will
		// never run to clear tints inherited from a previous page — do it here.
		if (triggers.size === 0) {
			for (const el of watched) setApplied(el, null);
		}

		schedule();
	}

	const onScroll = () => schedule();
	window.addEventListener('scroll', onScroll, { passive: true, capture: true });
	window.addEventListener('resize', onScroll, { passive: true });

	return {
		refresh,
		schedule,
		watch(el: HTMLElement) {
			manual.add(el);
			addWatched(el);
			schedule();
			return () => {
				manual.delete(el);
				removeWatched(el);
			};
		},
		destroy() {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
			window.removeEventListener('resize', onScroll);
			watchIo.disconnect();
			triggerIo.disconnect();
			ro.disconnect();
			for (const el of watched) setApplied(el, null);
			watched.clear();
			manual.clear();
			triggers.clear();
			visibleWatched.clear();
			activeTriggers.clear();
		},
	};
}
