<script>
	import AngularDemo from '$lib/components/AngularDemo.svelte';
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import DemoStage from '$lib/components/DemoStage.svelte';
	import Toc from '$lib/components/Toc.svelte';

	let { data } = $props();
	const s = data.snippets;

	const sections = [
		{ id: 'concepts', label: 'Concepts' },
		{ id: 'install', label: 'Install' },
		{ id: 'usage', label: 'Usage' },
		{ id: 'api', label: 'API' },
		{ id: 'how-it-works', label: 'How it works' },
		{ id: 'gotchas', label: 'Gotchas' },
		{ id: 'accessibility', label: 'Accessibility' }
	];

	const options = [
		{
			name: 'watchSelector',
			def: '.watch-bg-canvas',
			desc: 'Selector for elements to watch.'
		},
		{
			name: 'triggerSelector',
			def: '[class*="-trigger"]',
			desc: 'Coarse selector for trigger elements; refined in JS by triggerSuffix.'
		},
		{ name: 'triggerSuffix', def: '-trigger', desc: 'Suffix that marks a class as a trigger.' },
		{ name: 'appliedPrefix', def: 'over-', desc: 'Prefix for the applied class.' },
		{
			name: 'classMap',
			def: '{}',
			desc: 'Explicit triggerClass → appliedClass overrides; these win over the convention.'
		},
		{
			name: 'threshold',
			def: '0.5',
			desc: "Fraction of the watched element's own area that must overlap to count."
		},
		{
			name: 'triggerRootMargin',
			def: '200',
			desc: 'Margin in px around the viewport for keeping a trigger zone "active".'
		}
	];

	const methods = [
		{ name: 'refresh()', desc: 'Re-scan the DOM for watch + trigger elements. Call after DOM changes.' },
		{ name: 'watch(el)', desc: 'Manually register an element. Returns an unwatch() function.' },
		{ name: 'schedule()', desc: 'Force a recompute on the next frame.' },
		{ name: 'destroy()', desc: 'Disconnect observers and listeners, and remove all applied classes.' }
	];

	const steps = [
		{
			title: 'Visibility gate',
			body: 'Each watched element is tracked by an IntersectionObserver, so only on-screen elements are ever measured. A second observer tracks trigger zones with a root margin, so only zones near the viewport are considered.'
		},
		{
			title: 'One rAF loop',
			body: 'Scroll, resize, ResizeObserver and observer callbacks all funnel into a single coalesced requestAnimationFrame. At most one recompute per frame — and both adapters share one watcher, so a Svelte and an Angular element on the same page still share that loop.'
		},
		{
			title: 'Read, then write',
			body: 'Per frame, every trigger rect is read once (not once per watched element), then every watched rect, then all class changes are applied together. One layout pass instead of a reflow per element.'
		},
		{
			title: 'Minimal DOM churn',
			body: 'A class is added or removed only when the winning zone actually changes, so scrolling within one zone touches the DOM zero times.'
		},
		{
			title: 'Idle pages cost nothing',
			body: 'With no trigger zones, or nothing visible, scroll frames short-circuit before any work is scheduled.'
		}
	];

	const gotchas = [
		{
			title: 'Overriding a composed token',
			body: "If the property you're changing is a variable that itself references another one — a shadow composite, a gradient, a border shorthand — declared on :root, then overriding the inner variable from an over-* class does nothing. CSS bakes the nested var() once, where the composite is declared, and the result inherits down. Re-declare the composite on the watched element so it re-bakes against that element's value."
		},
		{
			title: 'position: sticky and overflow',
			body: "A sticky watched element won't stick if an ancestor has overflow: hidden, auto, or scroll. Put clipping on a sibling layer, not an ancestor of the sticky element."
		},
		{
			title: 'Stacking is not considered',
			body: 'Majority overlap ignores z-index. The larger overlap area wins, which may not be the element actually painted on top.'
		},
		{
			title: 'Neither is clipping',
			body: "getBoundingClientRect reports where an element would be, not what's visible. A trigger zone inside a scrolling container still reports a full-size rect once it has scrolled out of view, so a watched element can pick up a zone that is no longer on screen. When your zones live in a scroller, put the trigger class on the scroller itself — its rect is the visible box — and relabel it as its content scrolls. The playground on this page does exactly that."
		},
		{
			title: 'Dynamic triggers need refresh()',
			body: 'Trigger zones are indexed on refresh() — at adapter mount, or via refreshCanvasWatch() — not continuously observed for class changes.'
		}
	];
</script>

<svelte:head>
	<title>canvas-watch — floating elements that know what they're over</title>
	<meta
		name="description"
		content="Detect which background zone a floating element sits over and reflect it as a class, so you can restyle it however you like — shadow, text colour, border, the whole panel. Framework-agnostic core with Svelte and Angular adapters."
	/>
	<meta property="og:title" content="canvas-watch" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://canvas-watch.markzebley.com" />
	<meta
		property="og:description"
		content="Detect which background zone a floating element sits over and reflect it as a class. What you restyle with it is up to you."
	/>
	<link rel="canonical" href="https://canvas-watch.markzebley.com/" />
</svelte:head>

<main id="top">
	<!-- ── Hero ──────────────────────────────────────────────────────────────── -->
	<section
		class="cw-zone cw-zone--tall canvas-brand-muted ink-brand canvas-brand-muted-trigger"
	>
		<div class="cw-shell">
			<p class="font-sm letter-spacing-wide text-uppercase margin-0">@mzebley/canvas-watch</p>
			<h1 class="font-2xl margin-block-start-05 margin-block-end-1 measure-3">
				Floating elements that know where they're at.
			</h1>
			<p class="font-lg measure-2 margin-block-end-1">
				Sticky nav bars, docked players, and cards drift over backgrounds that keep changing.
				canvas-watch works out which zone an element is currently sitting over and puts that answer
				on the element as a class.
			</p>
			<p class="font-lg measure-2 margin-block-end-2">
				What you do with that class is entirely yours. Re-tint a shadow, flip dark text to light,
				swap a border, invert the whole panel — the library only ever swaps the class.
			</p>

			<div class="measure-2 margin-block-end-1">
				<CodeBlock snippet={s['install-npm']} />
			</div>

			<div class="display-flex flex-wrap gap-1 align-items-center">
				<zbk-link href="#demo" appearance="button" variant="lg">See it move</zbk-link>
				<zbk-link
					href="https://github.com/mzebley/canvas-watch"
					appearance="button"
					variant="outline lg"
					target="_blank"
					rel="noopener"
				>
					Source on GitHub
				</zbk-link>
			</div>

			<p class="font-sm margin-block-start-2 margin-block-end-0">
				The bar at the top of this page is a canvas-watch element. Scroll, and watch its shadow and
				border follow the section behind it — and read the class it's wearing, live.
			</p>
		</div>
	</section>

	<!-- ── Why not IntersectionObserver ──────────────────────────────────────── -->
	<section
		id="why"
		class="cw-zone canvas-accent-secondary ink-accent-secondary-inverse canvas-accent-secondary-trigger"
	>
		<div class="cw-shell cw-prose">
			<h2 class="font-xl margin-block-start-0 margin-block-end-1">
				Why not just IntersectionObserver?
			</h2>
			<p class="font-lg margin-block-end-1">
				Because it can't answer this question. <code>IntersectionObserver</code> compares a target
				against its scroll-ancestor or the viewport — never against an arbitrary sibling element.
			</p>
			<p class="margin-block-end-1">
				"Is this floating card mostly over that background zone?" is a 2D overlap question between
				two unrelated elements. So canvas-watch compares bounding rectangles instead.
				IntersectionObserver is still in play — as a cheap visibility gate, so the overlap maths
				only runs for elements actually on screen.
			</p>
		</div>
	</section>

	<!-- ── Live demo ─────────────────────────────────────────────────────────── -->
	<section id="demo" class="cw-zone canvas-app">
		<div class="cw-shell">
			<div class="cw-prose margin-block-end-2">
				<h2 class="font-xl margin-block-start-0 margin-block-end-05">Try it</h2>
				<p class="margin-block-end-1">
					Scroll inside the frame. The card is watched; the bands behind it are trigger zones. The
					winning zone is the one covering the largest share of the card — and only if that share
					clears the threshold, which you can drag.
				</p>
				<p class="margin-0">
					The card does more than re-tint a shadow: over the pale band it inverts completely, dark
					panel and light text, so it still reads. None of that is the library's doing — it swapped
					one class, and the CSS did the rest.
				</p>
			</div>
			<DemoStage />
			<p class="font-sm ink-app-muted margin-block-start-1 measure-3">
				Scroll the page — not the frame — until the bar at the top passes over these bands, and it
				picks them up too: its mark and theme switch pull their accent from whichever band is
				behind it. The bands can't be page triggers directly, though. canvas-watch compares
				unclipped rectangles, so a band scrolled out of this frame still reports a rect where it
				would have been, and the bar would tint from a zone that isn't on screen. The frame itself
				carries the trigger instead, relabelled as you scroll — the same proxy any zone inside a
				scroller needs.
			</p>

			<div class="margin-block-start-3">
				<AngularDemo />
			</div>
		</div>
	</section>

	<!-- ── Docs ──────────────────────────────────────────────────────────────── -->
	<section class="cw-zone canvas-brand-subtle canvas-brand-subtle-trigger">
		<div class="cw-shell cw-docs">
			<Toc {sections} />

			<div>
				<!-- Concepts -->
				<section id="concepts" class="margin-block-end-3">
					<zbk-heading level="2">Concepts</zbk-heading>

					<div class="cw-prose">
						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Watched element</h3>
						<p class="margin-0">
							A floating element you tag with <code>watch-bg-canvas</code> (or register through an
							adapter). It receives an <code>over-*</code> class describing the zone it currently sits
							over.
						</p>

						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Trigger zone</h3>
						<p class="margin-block-end-1">
							A background element tagged with a <code>*-trigger</code> class. Each maps to an
							<code>over-*</code> class by convention: strip the <code>-trigger</code> suffix, add the
							<code>over-</code> prefix.
						</p>
					</div>

					<div class="cw-table-scroll margin-block-end-105">
						<table class="cw-table">
							<thead>
								<tr>
									<th scope="col">Trigger class</th>
									<th scope="col">Applied class</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td><code>canvas-brand-emphasis-trigger</code></td>
									<td><code>over-canvas-brand-emphasis</code></td>
								</tr>
								<tr>
									<td><code>canvas-danger-trigger</code></td>
									<td><code>over-canvas-danger</code></td>
								</tr>
							</tbody>
						</table>
					</div>

					<div class="cw-prose">
						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Winner = majority overlap</h3>
						<p class="margin-0">
							A watched element gets the class of the zone covering the largest share of
							<em>its own</em> area. If that share is below the threshold (default 50%), or it overlaps
							no zone at all, every <code>over-*</code> class is removed. Only one is applied at a time.
						</p>

						<h3 class="font-lg margin-block-start-105 margin-block-end-05">
							The <code>canvaschange</code> event
						</h3>
						<p class="margin-0">
							Most restyling needs no JavaScript at all — write CSS for the <code>over-*</code>
							class and you're done. When you need more, each change dispatches a
							<code>canvaschange</code>
							CustomEvent with <code>detail: &lbrace; appliedClass, previousClass &rbrace;</code> (each
							<code>string | null</code>): swap an icon set, re-render a chart's palette, announce
							something. Both adapters surface it: <code>onChange</code> in Svelte,
							<code>(canvasChange)</code> in Angular.
						</p>
					</div>
				</section>

				<!-- Install -->
				<section id="install" class="margin-block-end-3">
					<zbk-heading level="2">Install</zbk-heading>

					<div class="margin-block-start-1 margin-block-end-105">
						<CodeBlock snippet={s['install-npm']} />
					</div>

					<p class="cw-prose margin-block-end-1">
						Framework adapters ship as subpath entry points and pull in <strong>optional</strong> peer
						dependencies — install only what you use.
					</p>

					<div class="cw-table-scroll margin-block-end-105">
						<table class="cw-table">
							<thead>
								<tr>
									<th scope="col">Import</th>
									<th scope="col">What you get</th>
									<th scope="col">Peer dependency</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td><code>@mzebley/canvas-watch</code></td>
									<td>Framework-agnostic core (<code>createCanvasWatcher</code>)</td>
									<td>none</td>
								</tr>
								<tr>
									<td><code>@mzebley/canvas-watch/svelte</code></td>
									<td><code>watchBgCanvas</code> action</td>
									<td><code>svelte &gt;= 5</code></td>
								</tr>
								<tr>
									<td><code>@mzebley/canvas-watch/angular</code></td>
									<td><code>CanvasWatchDirective</code> + <code>CanvasWatchService</code></td>
									<td><code>@angular/core &gt;= 16</code></td>
								</tr>
							</tbody>
						</table>
					</div>

					<zbk-button variant="subtle sm" toggles="install-prerelease">
						Installing the prerelease from GitHub Packages
					</zbk-button>
					<zbk-panel id="install-prerelease" hidden="until-found">
						<div class="margin-block-start-1">
							<p class="cw-prose margin-block-end-1">
								While the package is distributed privately through GitHub Packages, point the
								<code>@mzebley</code> scope at that registry. Locally, authenticate once with a classic
								personal access token carrying only <code>read:packages</code>:
							</p>
							<div class="margin-block-end-1">
								<CodeBlock snippet={s['install-github']} />
							</div>
							<p class="cw-prose margin-block-end-1">
								For CI or hosted builds, keep the token in a secret and reference it from
								<code>.npmrc</code> rather than committing the value:
							</p>
							<CodeBlock snippet={s['install-npmrc']} />
						</div>
					</zbk-panel>
				</section>

				<!-- Usage -->
				<section id="usage" class="margin-block-end-3">
					<zbk-heading level="2">Usage</zbk-heading>

					<div class="cw-prose margin-block-start-1 margin-block-end-105">
						<p class="margin-0">
							The shape is the same everywhere: mark the background zones, register the floating
							element, and write CSS for the <code>over-*</code> classes.
						</p>
					</div>

					<div class="margin-block-end-1">
						<CodeBlock snippet={s.quickstart} />
					</div>
					<div class="margin-block-end-2">
						<CodeBlock snippet={s['quickstart-css']} />
					</div>

					<div
						class="display-flex flex-wrap gap-1 align-items-center margin-block-end-105"
						role="group"
						aria-label="Choose a framework"
					>
						<zbk-radio name="framework" value="svelte" checked toggles="usage-svelte">
							Svelte
						</zbk-radio>
						<zbk-radio name="framework" value="angular" toggles="usage-angular">Angular</zbk-radio>
						<zbk-radio name="framework" value="vanilla" toggles="usage-vanilla">
							Vanilla JS
						</zbk-radio>
					</div>

					<zbk-panel id="usage-svelte">
						<h3 class="font-lg margin-block-start-0 margin-block-end-05">Svelte</h3>
						<p class="cw-prose margin-block-end-1">
							The action shares one watcher across the whole app and cleans up on destroy.
							<code>class="watch-bg-canvas"</code> is optional when you use the action — it registers
							the node directly — but keeping it makes the intent obvious in markup.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['svelte-action']} />
						</div>
						<p class="cw-prose margin-block-end-1">
							Elements that outlive a page — a layout-level nav or player — are registered once and
							won't automatically see a new page's trigger zones. Re-scan after navigation:
						</p>
						<CodeBlock snippet={s['svelte-navigate']} />
					</zbk-panel>

					<zbk-panel id="usage-angular" hidden="until-found">
						<h3 class="font-lg margin-block-start-0 margin-block-end-05">Angular</h3>
						<p class="cw-prose margin-block-end-1">
							<code>CanvasWatchDirective</code> is a <strong>standalone</strong> directive — import it
							directly into a component's <code>imports</code>. You can
							<zbk-link href="#demo">run it live on this page</zbk-link>: the demo section
							bootstraps a real Angular app that shares this page's watcher with the Svelte header.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['angular-directive']} />
						</div>
						<p class="cw-prose margin-block-end-1">
							After router navigation, re-scan so persistent watched elements pick up the new page's
							trigger zones — the analogue of Svelte's <code>afterNavigate</code>:
						</p>
						<CodeBlock snippet={s['angular-refresh']} />
					</zbk-panel>

					<zbk-panel id="usage-vanilla" hidden="until-found">
						<h3 class="font-lg margin-block-start-0 margin-block-end-05">Vanilla, or any framework</h3>
						<p class="cw-prose margin-block-end-1">
							The core has no framework dependencies. Tag the elements in markup, then create a
							watcher and refresh it.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['vanilla-markup']} />
						</div>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['vanilla-core']} />
						</div>
						<p class="cw-prose margin-block-end-1">Listen for changes directly on the element:</p>
						<CodeBlock snippet={s['vanilla-event']} />
					</zbk-panel>
				</section>

				<!-- API -->
				<section id="api" class="margin-block-end-3">
					<zbk-heading level="2">API</zbk-heading>

					<h3 class="font-lg margin-block-start-1 margin-block-end-05">
						<code>createCanvasWatcher(options?)</code>
					</h3>
					<p class="cw-prose margin-block-end-1">
						Returns a live watcher in the browser, or a no-op during SSR — so you never need to guard
						<code>typeof window</code>.
					</p>

					<div class="cw-table-scroll margin-block-end-105">
						<table class="cw-table">
							<thead>
								<tr>
									<th scope="col">Option</th>
									<th scope="col">Default</th>
									<th scope="col">Description</th>
								</tr>
							</thead>
							<tbody>
								{#each options as option (option.name)}
									<tr>
										<th scope="row"><code>{option.name}</code></th>
										<td><code>{option.def}</code></td>
										<td>{option.desc}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="margin-block-end-105">
						<CodeBlock snippet={s.options} />
					</div>

					<h3 class="font-lg margin-block-start-105 margin-block-end-05">
						<code>CanvasWatcher</code>
					</h3>
					<div class="cw-table-scroll margin-block-end-105">
						<table class="cw-table">
							<thead>
								<tr>
									<th scope="col">Method</th>
									<th scope="col">Description</th>
								</tr>
							</thead>
							<tbody>
								{#each methods as method (method.name)}
									<tr>
										<th scope="row"><code>{method.name}</code></th>
										<td>{method.desc}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<p class="cw-prose margin-0">
						The core also exports the pure helpers <code>overlapArea(a, b)</code> and
						<code>resolveAppliedClass(triggerClass, opts)</code>, plus the shared-singleton helpers
						<code>getSharedWatcher()</code> and <code>refreshCanvasWatch()</code> that the adapters
						are built on.
					</p>
				</section>

				<!-- How it works -->
				<section id="how-it-works" class="margin-block-end-3">
					<zbk-heading level="2">How it works</zbk-heading>
					<ol class="cw-prose margin-block-start-1 padding-inline-start-105">
						{#each steps as step (step.title)}
							<li class="margin-block-end-1">
								<strong>{step.title}.</strong>
								{step.body}
							</li>
						{/each}
					</ol>
				</section>

				<!-- Gotchas -->
				<section id="gotchas" class="margin-block-end-3">
					<zbk-heading level="2">Gotchas</zbk-heading>
					<div class="margin-block-start-1">
						{#each gotchas as gotcha (gotcha.title)}
							<h3 class="font-lg margin-block-start-105 margin-block-end-05">{gotcha.title}</h3>
							<p class="cw-prose margin-0">{gotcha.body}</p>
						{/each}
					</div>
					<div class="margin-block-start-105">
						<CodeBlock snippet={s['gotcha-shadow']} />
					</div>
				</section>

				<!-- Accessibility -->
				<section id="accessibility" class="margin-block-end-1">
					<zbk-heading level="2">Accessibility</zbk-heading>
					<div class="cw-prose margin-block-start-1">
						<p class="margin-block-end-1">
							canvas-watch is <strong>purely presentational</strong>. It adds and removes one class.
							It adds no ARIA, announces nothing to assistive technology, and never alters content,
							focus order, or layout.
						</p>
						<p class="margin-block-end-1">
							<strong>Contrast is your responsibility, and it matters more the more you restyle.</strong>
							A shadow that misses 3:1 is cosmetic; text that lands at 2:1 because the panel behind it
							changed is a WCAG 1.4.3 failure. If your <code>over-*</code> rules touch text, border, or
							icon colour, check every zone — the library only tells you which one you're over, it has
							no idea whether the result is legible.
						</p>
						<p class="margin-block-end-1">
							<strong>Reduced motion is the consumer's call.</strong> Put any
							<code>transition</code> on the properties you change behind
							<code>@media (prefers-reduced-motion: reduce)</code>.
						</p>
						<p class="margin-0">
							Under the hood it needs <code>IntersectionObserver</code>,
							<code>ResizeObserver</code>, <code>requestAnimationFrame</code> and
							<code>CustomEvent</code> — all available in every current evergreen browser. It is
							SSR-safe: <code>createCanvasWatcher</code> returns a no-op when
							<code>window</code> and <code>document</code> are absent, and both adapters only run on
							the client.
						</p>
					</div>
				</section>
			</div>
		</div>
	</section>

	<!-- ── Closing ───────────────────────────────────────────────────────────── -->
	<section
		id="get-started"
		class="cw-zone canvas-accent-primary ink-accent-primary-inverse canvas-accent-primary-trigger"
	>
		<div class="cw-shell cw-prose">
			<h2 class="font-xl margin-block-start-0 margin-block-end-1">One class. That's the API.</h2>
			<p class="font-lg margin-block-end-2">
				Mark your zones, register your floating element, and write the CSS you were going to write
				anyway.
			</p>
			<div class="display-flex flex-wrap gap-1 align-items-center">
				<zbk-link
					href="https://github.com/mzebley/canvas-watch"
					appearance="button"
					variant="lg"
					target="_blank"
					rel="noopener"
				>
					Read the source
				</zbk-link>
				<zbk-link href="#install" appearance="button" variant="inverse lg">Install it</zbk-link>
			</div>
		</div>
	</section>
</main>
