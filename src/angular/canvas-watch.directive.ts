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
	OnDestroy,
	OnInit,
	Output,
} from '@angular/core';
import { getSharedWatcher, scheduleRefresh } from '../core/shared.js';
import type { CanvasChangeDetail } from '../core/canvas-watcher.js';

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
	private unwatch?: () => void;

	private readonly listener = (event: Event): void => {
		this.canvasChange.emit((event as CustomEvent<CanvasChangeDetail>).detail);
	};

	ngOnInit(): void {
		const node = this.host.nativeElement;
		this.unwatch = getSharedWatcher().watch(node);
		// Pick up any trigger zones already in the DOM (coalesced across mounts).
		scheduleRefresh();
		node.addEventListener('canvaschange', this.listener);
	}

	ngOnDestroy(): void {
		this.host.nativeElement.removeEventListener('canvaschange', this.listener);
		this.unwatch?.();
	}
}
