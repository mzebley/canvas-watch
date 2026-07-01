/**
 * @mzebley/canvas-watch/angular — refresh service.
 *
 * Re-scan the document for watch + trigger elements on the shared watcher. Call
 * after router navigation so persistent watched elements (a layout-level nav or
 * player) pick up trigger zones on the newly rendered page — the Angular
 * analogue of Svelte's `afterNavigate` refresh.
 *
 * ```ts
 * private readonly canvasWatch = inject(CanvasWatchService);
 * private readonly router = inject(Router);
 *
 * constructor() {
 *   this.router.events
 *     .pipe(filter((e) => e instanceof NavigationEnd))
 *     .subscribe(() => this.canvasWatch.refresh());
 * }
 * ```
 */
import { Injectable } from '@angular/core';
// Package self-reference, not '../core/shared.js' — see the note in
// canvas-watch.directive.ts about the singleton.
import { refreshCanvasWatch } from '@mzebley/canvas-watch';

@Injectable({ providedIn: 'root' })
export class CanvasWatchService {
	/** Coalesced re-scan of the shared watcher. */
	refresh(): void {
		refreshCanvasWatch();
	}
}
