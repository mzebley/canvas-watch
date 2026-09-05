/**
 * @mzebley/canvas-watch — framework-agnostic core.
 *
 * Detect which background "canvas" zone a floating element sits over, or track
 * whether a referenced element is above, within, below, or missing from the
 * viewport.
 *
 * The Svelte adapter lives at `@mzebley/canvas-watch/svelte`.
 */
export {
	createCanvasWatcher,
	classifyViewportRect,
	overlapArea,
	pickWinningClass,
	resolveAppliedClass,
	type CanvasWatcher,
	type CanvasWatchOptions,
	type CanvasChangeDetail,
	type ClassResolveOptions,
	type DOMRectLike,
	type ZoneOverlap,
	type ViewportChangeDetail,
	type ViewportListener,
	type ViewportReference,
	type ViewportState,
} from './core/canvas-watcher.js';

export {
	getSharedWatcher,
	scheduleRefresh,
	refreshCanvasWatch,
} from './core/shared.js';
