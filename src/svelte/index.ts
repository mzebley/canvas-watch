/**
 * @mzebley/canvas-watch/svelte — Svelte action wrapper.
 *
 * `use:watchBgCanvas` registers an element on the shared watcher so its `over-*`
 * class tracks whatever background trigger zone it currently sits over.
 */
import type { Action } from 'svelte/action';
import { createSubscriber } from 'svelte/reactivity';
import { getSharedWatcher, scheduleRefresh, refreshCanvasWatch } from '../core/shared.js';
import type {
	CanvasChangeDetail,
	ViewportReference,
	ViewportState,
} from '../core/canvas-watcher.js';

export { refreshCanvasWatch };
export type { CanvasChangeDetail, ViewportReference, ViewportState };

export interface WatchBgCanvasParams {
	/** Called whenever the element's applied `over-*` class changes. */
	onChange?: (detail: CanvasChangeDetail) => void;
}

/** Reactive viewport state returned by {@link canvasWatch}. */
export interface CanvasViewport {
	readonly state: ViewportState;
	readonly aboveViewport: boolean;
	readonly inViewport: boolean;
	readonly belowViewport: boolean;
	readonly missing: boolean;
}

/**
 * Track a native ID reference or direct element through Svelte's external
 * reactivity bridge. Read the result from a template or tracked effect; direct
 * imperative callers should use the core `observeViewport` interface.
 *
 * ```svelte
 * <script>
 * 	import { canvasWatch } from '@mzebley/canvas-watch/svelte';
 * 	const hero = canvasWatch('#hero');
 * </script>
 *
 * <header class:past-hero={hero.aboveViewport}>…</header>
 * <section id="hero">…</section>
 * ```
 */
export function canvasWatch(reference: ViewportReference): CanvasViewport {
	let state: ViewportState = 'unknown';
	const subscribe = createSubscriber((update) =>
		getSharedWatcher().observeViewport(reference, (detail) => {
			state = detail.state;
			update();
		}),
	);
	const current = () => {
		subscribe();
		return state;
	};

	return {
		get state() {
			return current();
		},
		get aboveViewport() {
			return current() === 'above';
		},
		get inViewport() {
			return current() === 'within';
		},
		get belowViewport() {
			return current() === 'below';
		},
		get missing() {
			return current() === 'missing';
		},
	};
}

/**
 * Svelte action: register an element so its `over-*` class tracks whatever
 * background trigger zone it currently sits over.
 *
 * ```svelte
 * <div class="card" use:watchBgCanvas>…</div>
 * <div class="card" use:watchBgCanvas={{ onChange: (d) => (tint = d.appliedClass) }}>…</div>
 * ```
 *
 * The action shares one watcher across the whole app (a single
 * `requestAnimationFrame` loop drives every element) and cleans up on destroy.
 * After client-side navigation, call {@link refreshCanvasWatch} so persistent
 * elements pick up the new page's trigger zones.
 */
export const watchBgCanvas: Action<HTMLElement, WatchBgCanvasParams | undefined> = (
	node,
	params,
) => {
	const watcher = getSharedWatcher();
	const unwatch = watcher.watch(node);
	// Pick up any trigger zones already in the DOM (coalesced across mounts).
	scheduleRefresh();

	let current = params;
	const listener = (event: Event) => {
		current?.onChange?.((event as CustomEvent<CanvasChangeDetail>).detail);
	};
	node.addEventListener('canvaschange', listener);

	return {
		update(next) {
			current = next;
		},
		destroy() {
			node.removeEventListener('canvaschange', listener);
			unwatch();
			// Release disconnected trigger zones after component teardown. The
			// microtask runs after Svelte has removed the component's DOM.
			scheduleRefresh();
		},
	};
};
