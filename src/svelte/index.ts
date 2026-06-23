/**
 * @mzebley/canvas-watch/svelte — Svelte action wrapper.
 *
 * `use:watchBgCanvas` registers an element on the shared watcher so its `over-*`
 * class tracks whatever background trigger zone it currently sits over.
 */
import type { Action } from 'svelte/action';
import { getSharedWatcher, scheduleRefresh, refreshCanvasWatch } from '../core/shared.js';
import type { CanvasChangeDetail } from '../core/canvas-watcher.js';

export { refreshCanvasWatch };
export type { CanvasChangeDetail };

export interface WatchBgCanvasParams {
	/** Called whenever the element's applied `over-*` class changes. */
	onChange?: (detail: CanvasChangeDetail) => void;
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
		},
	};
};
