/**
 * A real Angular application, bootstrapped into this page on demand.
 *
 * Its only job is to prove a claim the docs make: `CanvasWatchDirective` and
 * the Svelte `watchBgCanvas` action register on the *same* shared watcher, so
 * one requestAnimationFrame loop drives both. The header bar above is the
 * Svelte element; the pill this renders is the Angular one. They re-tint on the
 * same frame, from the same page zones.
 *
 * Everything here is dynamically imported — never at module scope — because the
 * site is prerendered and Angular needs a DOM.
 */
import 'zone.js';
// JIT: the adapter ships partial-compiled declarations, which the runtime
// compiler links on the fly. No build-time Angular linker needed.
import '@angular/compiler';

import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import type { ApplicationRef } from '@angular/core';
import { CanvasWatchDirective } from '@mzebley/canvas-watch/angular';
import type { CanvasChangeDetail } from '@mzebley/canvas-watch/angular';

@Component({
	selector: 'cw-angular-demo',
	standalone: true,
	imports: [CanvasWatchDirective],
	template: `
		<div class="cw-angular-pill cw-watched" canvasWatch (canvasChange)="onTint($event)">
			<span class="cw-angular-pill__tag">Angular directive</span>
			<span class="cw-readout">{{ applied() ?? 'over: —' }}</span>
		</div>
	`,
})
export class AngularDemoComponent {
	readonly applied = signal<string | null>(null);

	onTint(detail: CanvasChangeDetail): void {
		// Strip the `over-` prefix so the readout matches the header bar's.
		const zone = detail.appliedClass?.replace(/^over-/, '');
		this.applied.set(zone ? `over: ${zone}` : 'over: —');
	}
}

/**
 * Bootstrap into `host`. Returns a teardown that destroys the Angular app —
 * which unregisters the directive's element from the shared watcher via
 * `ngOnDestroy`, leaving the Svelte side untouched.
 */
export async function mountAngularDemo(host: HTMLElement): Promise<() => void> {
	const mountPoint = document.createElement('cw-angular-demo');
	host.appendChild(mountPoint);

	const app: ApplicationRef = await bootstrapApplication(AngularDemoComponent, {
		providers: [],
	});

	return () => {
		app.destroy();
		mountPoint.remove();
	};
}
