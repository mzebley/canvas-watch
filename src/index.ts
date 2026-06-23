/**
 * @mzebley/canvas-watch — framework-agnostic core.
 *
 * Detect which background "canvas" zone a floating element sits over and reflect
 * it as an `over-*` class on that element, so shadows (or text color) can re-tint
 * to match what's behind them.
 *
 * Framework adapters live at `@mzebley/canvas-watch/svelte` and
 * `@mzebley/canvas-watch/angular`.
 */
export {
	createCanvasWatcher,
	overlapArea,
	resolveAppliedClass,
	type CanvasWatcher,
	type CanvasWatchOptions,
	type CanvasChangeDetail,
	type ClassResolveOptions,
	type DOMRectLike,
} from './core/canvas-watcher.js';

export {
	getSharedWatcher,
	scheduleRefresh,
	refreshCanvasWatch,
} from './core/shared.js';
