/**
 * @mzebley/canvas-watch/angular — standalone directive.
 *
 * Register the host element on the shared watcher so its `over-*` class tracks
 * whatever background trigger zone it currently sits over, and surface each
 * change as a `(canvasChange)` output.
 */
import {
	Directive,
	ElementRef,
	EventEmitter,
	inject,
	NgZone,
	Output,
	type OnDestroy,
	type OnInit,
} from '@angular/core';
// Import via the package self-reference, NOT a relative path into ../core.
// tsup bundles the core into the root entry's chunk; a relative import here
// would make ngc emit a second copy of shared.ts, giving Angular its own
// singleton watcher that refreshCanvasWatch() from the root entry never sees.
import {
	getSharedWatcher,
	scheduleRefresh,
	type CanvasChangeDetail,
} from '@mzebley/canvas-watch';

/**
 * ```html
 * <div canvasWatch (canvasChange)="onTint($event)">…</div>
 * ```
 *
 * Add `class="watch-bg-canvas"` too if you also drive zones via a selector scan;
 * the directive registers the node directly, so the class is optional but makes
 * intent obvious in markup.
 */
@Directive({
	selector: '[canvasWatch]',
	standalone: true,
})
export class CanvasWatchDirective implements OnInit, OnDestroy {
	/** Emits whenever the host element's applied `over-*` class changes. */
	@Output() canvasChange = new EventEmitter<CanvasChangeDetail>();

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly zone = inject(NgZone);
	private unwatch?: () => void;

	private readonly listener = (event: Event): void => {
		const detail = (event as CustomEvent<CanvasChangeDetail>).detail;
		// Re-enter the zone only when a change actually fires (rare), so change
		// detection runs for consumers without paying for it on every scroll.
		this.zone.run(() => this.canvasChange.emit(detail));
	};

	ngOnInit(): void {
		const node = this.host.nativeElement;
		// Register outside the zone: the shared watcher is lazily created on first
		// use, and its window scroll listener + rAF loop must not be zone-patched —
		// otherwise every scroll event app-wide triggers change detection.
		this.zone.runOutsideAngular(() => {
			this.unwatch = getSharedWatcher().watch(node);
			// Pick up any trigger zones already in the DOM (coalesced across mounts).
			scheduleRefresh();
			node.addEventListener('canvaschange', this.listener);
		});
	}

	ngOnDestroy(): void {
		this.host.nativeElement.removeEventListener('canvaschange', this.listener);
		this.unwatch?.();
	}
}
