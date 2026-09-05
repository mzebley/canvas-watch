/**
 * JavaScript-realm-wide shared watcher. The Svelte action and reactive viewport
 * state register here, so one `requestAnimationFrame` loop drives both APIs —
 * and a consumer using the core directly can join the same loop.
 *
 * Framework-agnostic: no Svelte imports.
 */
import { createCanvasWatcher, type CanvasWatcher } from './canvas-watcher.js';

interface SharedState {
	watcher: CanvasWatcher | null;
	refreshQueuedFor: CanvasWatcher | null;
}

const SHARED_STATE = Symbol.for('@mzebley/canvas-watch.shared.v1');
const root = globalThis as typeof globalThis & { [SHARED_STATE]?: SharedState };
const state = (root[SHARED_STATE] ??= { watcher: null, refreshQueuedFor: null });

function createSharedWatcher(): CanvasWatcher {
	const watcher = createCanvasWatcher();
	const destroy = watcher.destroy.bind(watcher);
	watcher.destroy = () => {
		destroy();
		if (state.watcher === watcher) state.watcher = null;
		if (state.refreshQueuedFor === watcher) state.refreshQueuedFor = null;
	};
	return watcher;
}

/**
 * Get the live singleton shared across ESM/CJS entries, lazily replacing a
 * destroyed instance.
 */
export function getSharedWatcher(): CanvasWatcher {
	// Do not retain the SSR no-op: a reused module graph must be able to acquire
	// a live watcher after a DOM becomes available during hydration or testing.
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		return createCanvasWatcher();
	}
	if (!state.watcher) state.watcher = createSharedWatcher();
	return state.watcher;
}

/**
 * Coalesce refreshes onto a microtask so several elements mounting in the same
 * tick (a nav, a player, a demo card) collapse into a single DOM scan rather
 * than one scan each. No-op until the shared watcher actually exists.
 */
export function scheduleRefresh(): void {
	const intended = state.watcher;
	if (!intended || state.refreshQueuedFor === intended) return;
	state.refreshQueuedFor = intended;
	queueMicrotask(() => {
		if (state.refreshQueuedFor === intended) state.refreshQueuedFor = null;
		if (state.watcher === intended) intended.refresh();
	});
}

/**
 * Re-scan the document for watch + trigger elements on the shared watcher.
 * Call after client-side navigation so long-lived watched elements (e.g. a
 * persistent nav) pick up trigger zones on the newly rendered page. Coalesced
 * onto a microtask, so many calls in one tick run a single scan.
 */
export function refreshCanvasWatch(): void {
	scheduleRefresh();
}
