<script>
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import DemoStage from '$lib/components/DemoStage.svelte';
	import Toc from '$lib/components/Toc.svelte';
	import ViewportDemo from '$lib/components/ViewportDemo.svelte';

	let { data } = $props();
	const s = data.snippets;

	const sections = [
		{ id: 'viewport-demo', label: 'Viewport demo' },
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
			{ name: 'refresh()', desc: 'Re-scan watch, trigger and declarative viewport elements.' },
			{ name: 'watch(el)', desc: 'Register one overlap owner. Returns an idempotent unwatch() function.' },
			{
				name: 'observeViewport(reference, listener)',
				desc: 'Subscribe one owner to vertical viewport state. Returns an idempotent unsubscribe function.'
			},
			{ name: 'schedule()', desc: 'Force a recompute on the next frame.' },
			{ name: 'destroy()', desc: 'Terminally cancel work, disconnect observers and remove owned classes.' }
	];

	const steps = [
		{
			title: 'Visibility gate',
			body: 'Each watched element is tracked by an IntersectionObserver, so only on-screen elements are ever measured. A second observer tracks trigger zones with a root margin, so only zones near the viewport are considered.'
		},
			{
				title: 'One rAF loop',
				body: 'Scroll, resize, DOM mutation, ResizeObserver and observer callbacks all funnel into one coalesced requestAnimationFrame. Overlap and viewport registrations share that loop.'
			},
			{
				title: 'Read, commit, then notify',
				body: 'Per frame, every unique element rect is read once. Classes, ownership and observer targets are committed before consumer callbacks, so reentrant teardown cannot resurrect stale work.'
		},
		{
			title: 'Minimal DOM churn',
			body: 'A class is added or removed only when the winning zone actually changes, so scrolling within one zone touches the DOM zero times.'
		},
		{
			title: 'Idle pages cost nothing',
			body: 'With no visible overlap work and no viewport registrations, scroll frames short-circuit before any work is scheduled.'
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
				body: 'Overlap ignores z-index. At one nesting depth the larger physical coverage wins, which may not be the element actually painted on top.'
		},
		{
			title: 'Neither is clipping',
			body: "getBoundingClientRect reports where an element would be, not what's visible. A trigger zone inside a scrolling container still reports a full-size rect once it has scrolled out of view, so a watched element can pick up a zone that is no longer on screen. When your zones live in a scroller, put the trigger class on the scroller itself — its rect is the visible box — and relabel it as its content scrolls. The playground on this page does exactly that."
		},
		{
			title: 'One element gets one answer',
			body: "Majority overlap resolves per watched element, so a wide element spanning two zones takes a single class — and half of it ends up styled for the wrong background. A bar across the full content width hits this constantly. The fix is not in the library: watch the regions instead of the container. Wrap each cluster of content in its own watched element and each resolves its own zone, in the same frame, from the same watcher. The header on this page does exactly that — its left and right ends carry different classes whenever they sit over different zones. Nesting is safe because a watched element only ever resolves against elements carrying a trigger class, so the container it sits inside is invisible to it."
		},
			{
				title: 'Dynamic triggers need refresh()',
				body: 'Trigger zones are indexed on refresh() — at adapter mount, or via refreshCanvasWatch() — not continuously observed for class changes.'
			},
			{
				title: 'Unobservable motion needs schedule()',
				body: 'Scroll, resize, relevant DOM mutations, target resizing and viewport-boundary crossings invalidate geometry. Call schedule() after motion that changes geometry without producing one of those signals.'
			}
	];
</script>

<svelte:head>
	<title>canvas-watch — floating elements that know what they're over</title>
	<meta
		name="description"
		content="Detect which background zone a floating element sits over and reflect it as a class, so you can restyle it however you like — shadow, text colour, border, the whole panel. Framework-agnostic core with a Svelte adapter."
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
	<!-- ── Hero ──────────────────────────────────────────────── -->
	<section
		id="hero"
		class="cw-zone cw-zone--hero canvas-brand-emphasis ink-brand-inverse canvas-brand-emphasis-trigger"
	>
		<div class="cw-shell cw-hero">
			<div class="prose ">
				<!--
					A zone inside a zone. The hero canvas is dark, so the bar's answer for
					it is light ink — but the display type on it is near-white and huge,
					and a light bar crossing it puts light text on light text. The heading
					is therefore its own zone, nested inside the hero's, and nesting wins:
					while the bar is over these letters it takes dark ink instead.
				-->
				<h1 class="cw-display-trigger">
					Floating elements that know where they're at.
				</h1>
				<p class="lede">
					Sticky nav bars, docked players, and cards drift over backgrounds that keep changing.
					canvas-watch works out which zone an element is currently sitting over and puts that answer
					on the element as a class.
				</p>
				<p class="font-lg margin-block-end-2">
					What you do with that class is entirely yours. Re-tint a shadow, flip dark text to light,
					swap a border, invert the whole panel — the library only ever swaps the class.
				</p>

				<div class="display-flex flex-wrap gap-1 align-items-center margin-block-end-105">
					<zbk-link href="#viewport-demo" appearance="button" variant="lg">
						See viewport tracking
					</zbk-link>
					<!-- `inverse`, not `outline`: the hero is a dark canvas, and the outline
					     variant's ink is the light-theme action colour. -->
					<zbk-link
						href="https://github.com/mzebley/canvas-watch"
						appearance="button"
						variant="inverse lg"
						target="_blank"
						rel="noopener"
					>
						Source on GitHub
					</zbk-link>
				</div>

				<CodeBlock snippet={s['install-npm']} />
			</div>

			<div>
				<!-- A static miniature of the playground below, so the idea is legible
				     before any scrolling happens. Decorative: the caption carries the
				     same information in prose. -->
				<div class="cw-hero-figure" aria-hidden="true">
					<span class="cw-hero-figure__overlap">62% overlap wins</span>

					<div
						class="cw-hero-figure__card cw-glass cw-glass--panel cw-tint over-cw-band-merlot"
					>
						<span class="cw-glass__surface" aria-hidden="true"></span>
						<p class="cw-glass__label font-xs letter-spacing-wide text-uppercase margin-0">
							Watched element
						</p>
						<p class="cw-readout font-sm font-weight-semibold margin-0">over-cw-band-merlot</p>
					</div>

					<div class="cw-hero-figure__band cw-band-indigo">.cw-band-indigo-trigger</div>
					<div class="cw-hero-figure__band cw-band-merlot">.cw-band-merlot-trigger</div>
					<div class="cw-hero-figure__band cw-band-butterfield">.cw-band-butterfield-trigger</div>
				</div>

				<p class="font-sm margin-block-start-1 margin-block-end-0">
					The card straddles two zones. The one covering most of it wins, and its name lands on the
					card as a class — which is the entire API. The bar at the top of this page is doing it for
					real: scroll, and read the class it's wearing.
				</p>
			</div>
		</div>
	</section>

	<!-- ── Why not IntersectionObserver ─────────────────────────────── -->
	<section
		id="why"
		class="cw-zone canvas-accent-secondary ink-accent-secondary-inverse canvas-accent-secondary-trigger"
	>
		<div class="cw-shell">
			<div class="cw-measure">
				<h2 class="font-xl margin-block-start-0 margin-block-end-1">
					Why not just IntersectionObserver?
				</h2>
				<p class="font-lg margin-block-end-1">
					Because it can't answer this question. <code>IntersectionObserver</code> compares a target
					against its scroll-ancestor or the viewport — never against an arbitrary sibling element.
				</p>
				<p class="margin-0">
					"Is this floating card mostly over that background zone?" is a 2D overlap question between
					two unrelated elements. So canvas-watch compares bounding rectangles instead.
					IntersectionObserver is still in play — as a cheap visibility gate, so the overlap maths
					only runs for elements actually on screen.
				</p>
			</div>
		</div>
	</section>

	<!-- ── Viewport state demo ─────────────────────────────────── -->
	<section
		id="viewport-demo"
		class="cw-zone canvas-brand-emphasis ink-brand-inverse canvas-brand-emphasis-trigger"
	>
		<div class="cw-shell">
			<div class="cw-viewport-intro cw-measure">
				<h2 class="font-xl margin-block-start-0 margin-block-end-1">
					Watch one reference cross the viewport.
				</h2>
				<p class="font-lg margin-block-end-1">
					Keep scrolling. The beacon starts below you, burns bright while any part of it is in
					view, then leaves above. The panel stays put so the state change is impossible to miss.
				</p>
				<p class="margin-0">
					This is the real Svelte API watching <code>#viewport-beacon</code>. Remove the reference
					to see <code>missing</code>, then restore it and continue the flight.
				</p>
			</div>
			<ViewportDemo />
		</div>
	</section>

	<!-- ── Live demo ────────────────────────────────────────── -->
	<section id="demo" class="cw-zone canvas-app">
		<div class="cw-shell">
			<div class="cw-measure margin-block-end-2">
				<h2 class="font-xl margin-block-start-0 margin-block-end-05">Try it</h2>
				<p class="margin-block-end-1">
					Scroll inside the frame. The card is watched; the bands behind it are trigger zones. The
					winning zone is the one covering the largest share of the card — and only if that share
					clears the threshold, which you can drag.
				</p>
				<p class="margin-0">
					The card is a sheet of glass whose low-opacity tint follows the winning band. The same
					class updates tint, ink and border as one measured pairing. None of it is the library's
					doing: it swapped one class, and the CSS did the rest.
				</p>
			</div>
			<DemoStage />
		</div>
	</section>

	<!-- ── Docs ──────────────────────────────────────────────────────────────── -->
	<section class="cw-zone canvas-brand-subtle canvas-brand-subtle-trigger">
		<div class="cw-shell cw-docs">
			<Toc {sections} />

			<div class="cw-docs-body">
				<!-- Concepts -->
				<section id="concepts">
					<zbk-heading level="2">Concepts</zbk-heading>

					<div class="cw-measure--wide">
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
									<td><code>cw-band-merlot-trigger</code></td>
									<td><code>over-cw-band-merlot</code></td>
								</tr>
							</tbody>
						</table>
					</div>

					<div class="cw-measure--wide">
						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Winner = majority overlap</h3>
						<p class="margin-0">
								A watched element gets the class of the zone covering the largest share of
								<em>its own</em> area. If that share is below the threshold (default 50%), or it overlaps
								no zone at all, every <code>over-*</code> class is removed. Same-class rectangles count
								by their physical union, so duplicate pixels are never counted twice.
						</p>

						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Nesting wins</h3>
						<p class="margin-0">
							A zone inside another zone is the more specific answer, so it beats its container
							outright — otherwise a container could never be overridden, because its overlap is by
								definition at least its children's. Depth only reorders zones that already clear the
								threshold, so a nested zone that barely clips the element can't hijack it, and among
								zones at the same depth the larger overlap still wins. Coverage stays paired with its
								depth, so a tiny nested zone cannot promote a same-class ancestor. The heading at the top of this
							page is a zone of its own inside the hero's: the bar takes dark ink while it is crossing
							those pale letters, and the hero's light ink everywhere else.
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
							something. The Svelte adapter surfaces it as <code>onChange</code>.
						</p>
					</div>
				</section>

				<!-- Install -->
				<section id="install">
					<zbk-heading level="2">Install</zbk-heading>

					<div class="margin-block-start-1 margin-block-end-105">
						<CodeBlock snippet={s['install-npm']} />
					</div>

					<p class="cw-measure--wide margin-block-end-1">
						The Svelte adapter ships as a subpath entry point and pulls in an
						<strong>optional</strong> peer dependency — install it only if you use it.
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
									<td><code>watchBgCanvas</code> action and reactive <code>canvasWatch</code> state</td>
								<td><code>svelte &gt;= 5.7</code></td>
								</tr>
							</tbody>
						</table>
					</div>

					<zbk-button variant="subtle sm" toggles="install-prerelease">
						Installing the prerelease from GitHub Packages
					</zbk-button>
					<zbk-panel id="install-prerelease" hidden="until-found">
						<div class="margin-block-start-1">
							<p class="cw-measure--wide margin-block-end-1">
								While the package is distributed privately through GitHub Packages, point the
								<code>@mzebley</code> scope at that registry. Locally, authenticate once with a classic
								personal access token carrying only <code>read:packages</code>:
							</p>
							<div class="margin-block-end-1">
								<CodeBlock snippet={s['install-github']} />
							</div>
							<p class="cw-measure--wide margin-block-end-1">
								For CI or hosted builds, keep the token in a secret and reference it from
								<code>.npmrc</code> rather than committing the value:
							</p>
							<CodeBlock snippet={s['install-npmrc']} />
						</div>
					</zbk-panel>
				</section>

				<!-- Usage -->
				<section id="usage">
					<zbk-heading level="2">Usage</zbk-heading>

					<div class="cw-measure--wide margin-block-start-1 margin-block-end-105">
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
						<zbk-radio name="framework" value="angular" toggles="usage-angular">
							Angular
						</zbk-radio>
						<zbk-radio name="framework" value="vanilla" toggles="usage-vanilla">
							Vanilla JS
						</zbk-radio>
					</div>

					<zbk-panel id="usage-svelte">
						<h3 class="font-lg margin-block-start-0 margin-block-end-05">Svelte</h3>
						<p class="cw-measure--wide margin-block-end-1">
							The action shares one watcher across the whole app and cleans up on destroy.
							<code>class="watch-bg-canvas"</code> is optional when you use the action — it registers
							the node directly — but keeping it makes the intent obvious in markup.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['svelte-action']} />
						</div>
						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Viewport state</h3>
						<p class="cw-measure--wide margin-block-end-1">
							<code>canvasWatch('#hero')</code> exposes reactive <code>aboveViewport</code>,
							<code>inViewport</code>, <code>belowViewport</code> and <code>missing</code> properties.
								The full state starts as <code>unknown</code>; a missing ID becomes
								<code>missing</code> only after client resolution. Read these properties in a template
								or tracked effect; imperative callers should use <code>observeViewport</code>.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['svelte-viewport']} />
						</div>
						<p class="cw-measure--wide margin-block-end-1">
							Elements that outlive a page — a layout-level nav or player — are registered once and
							won't automatically see a new page's trigger zones. Re-scan after navigation:
						</p>
						<CodeBlock snippet={s['svelte-navigate']} />
					</zbk-panel>

					<zbk-panel id="usage-angular" hidden="until-found">
						<h3 class="font-lg margin-block-start-0 margin-block-end-05">Angular</h3>
						<p class="cw-measure--wide margin-block-end-1">
							There is no Angular entry point to install — the core is enough. A standalone directive
							wraps it in about thirty lines, and because it registers on
							<code>getSharedWatcher()</code>, it joins the same single rAF loop as every other
							watched element on the page. Own this file in your app:
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['angular-directive']} />
						</div>
						<p class="cw-measure--wide margin-block-end-1">
							The <code>runOutsideAngular</code> wrapper is the part worth keeping. The watcher's
							scroll listener and rAF loop would otherwise be zone-patched, and every scroll frame
							app-wide would trigger change detection. Re-entering the zone only when a class actually
							changes keeps that cost off the scroll path.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['angular-usage']} />
						</div>
						<p class="cw-measure--wide margin-block-end-1">
							Elements that outlive a route — a layout-level nav or player — are registered once and
							won't automatically see the next page's trigger zones. Re-scan after navigation:
						</p>
						<CodeBlock snippet={s['angular-refresh']} />
					</zbk-panel>

					<zbk-panel id="usage-vanilla" hidden="until-found">
						<h3 class="font-lg margin-block-start-0 margin-block-end-05">Vanilla, or any framework</h3>
						<p class="cw-measure--wide margin-block-end-1">
							The core has no framework dependencies. Tag the elements in markup, then create a
							watcher and refresh it.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['vanilla-markup']} />
						</div>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['vanilla-core']} />
						</div>
						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Viewport state</h3>
						<p class="cw-measure--wide margin-block-end-1">
								Subscribe in JavaScript, or let HTML own one default state class. ID resolution,
								late insertion, removal and relevant attribute changes share one coalesced
								<code>MutationObserver</code> per watcher. Unrelated classes are untouched.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['viewport-core']} />
						</div>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['viewport-markup']} />
						</div>
						<p class="cw-measure--wide margin-block-end-1">Listen for changes directly on the element:</p>
						<CodeBlock snippet={s['vanilla-event']} />
					</zbk-panel>
				</section>

				<!-- API -->
				<section id="api">
					<zbk-heading level="2">API</zbk-heading>

					<h3 class="font-lg margin-block-start-1 margin-block-end-05">
						<code>createCanvasWatcher(options?)</code>
					</h3>
					<p class="cw-measure--wide margin-block-end-1">
							Returns a live watcher in the browser, or a no-op during SSR — so you never need to guard
							<code>typeof window</code>. Invalid thresholds, margins, selectors and class mappings
							fail before any browser resources are allocated.
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
					<p class="cw-measure--wide margin-block-end-105">
						Every registration owns an independent disposer, even when an element or callback is
						repeated. <code>destroy()</code> is terminal. Consumer listener errors are reported
						without blocking healthy listeners or cleanup.
					</p>

					<p class="cw-measure--wide margin-0">
						The core also exports the pure helpers <code>overlapArea(a, b)</code>,
						<code>resolveAppliedClass(triggerClass, opts)</code> and
						<code>pickWinningClass(totals, area, threshold)</code> — the winner rule itself, depth and
						all — plus <code>classifyViewportRect(rect, viewportTop, viewportBottom)</code> and the
						shared-singleton helpers
						<code>getSharedWatcher()</code> and <code>refreshCanvasWatch()</code> that the Svelte
						adapter is built on.
					</p>
				</section>

				<!-- How it works -->
				<section id="how-it-works">
					<zbk-heading level="2">How it works</zbk-heading>
					<ol class="cw-measure--wide margin-block-start-1 padding-inline-start-105">
						{#each steps as step (step.title)}
							<li class="margin-block-end-1">
								<strong>{step.title}.</strong>
								{step.body}
							</li>
						{/each}
					</ol>
				</section>

				<!-- Gotchas -->
				<section id="gotchas">
					<zbk-heading level="2">Gotchas</zbk-heading>
					<div class="margin-block-start-1">
						{#each gotchas as gotcha (gotcha.title)}
							<h3 class="font-lg margin-block-start-105 margin-block-end-05">{gotcha.title}</h3>
							<p class="cw-measure--wide margin-0">{gotcha.body}</p>
						{/each}
					</div>
					<div class="margin-block-start-105">
						<CodeBlock snippet={s['gotcha-shadow']} />
					</div>
				</section>

				<!-- Accessibility -->
				<section id="accessibility">
					<zbk-heading level="2">Accessibility</zbk-heading>
					<div class="cw-measure--wide margin-block-start-1">
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
							<code>ResizeObserver</code>, <code>MutationObserver</code>,
							<code>requestAnimationFrame</code> and <code>CustomEvent</code> — all available in
							every current evergreen browser. It is
							SSR-safe: <code>createCanvasWatcher</code> returns a no-op when
							<code>window</code> and <code>document</code> are absent, and the Svelte adapter only
							runs on the client.
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
		<div class="cw-shell">
			<div class="cw-measure">
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
		</div>
	</section>
</main>
