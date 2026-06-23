/**
 * Process-wide shared watcher. Both the Svelte action and the Angular directive
 * register their elements here, so a single `requestAnimationFrame` loop drives
 * every watched element on the page regardless of which framework mounted it.
 *
 * Framework-agnostic: no Svelte/Angular imports.
 */
import { createCanvasWatcher, type CanvasWatcher } from './canvas-watcher.js';

let shared: CanvasWatcher | null = null;
let refreshQueued = false;

/** Get (lazily creating) the singleton watcher shared across all adapters. */
export function getSharedWatcher(): CanvasWatcher {
	if (!shared) shared = createCanvasWatcher();
	return shared;
}

/**
 * Coalesce refreshes onto a microtask so several elements mounting in the same
 * tick (a nav, a player, a demo card) collapse into a single DOM scan rather
 * than one scan each. No-op until the shared watcher actually exists.
 */
export function scheduleRefresh(): void {
	if (refreshQueued || !shared) return;
	refreshQueued = true;
	queueMicrotask(() => {
		refreshQueued = false;
		shared?.refresh();
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
