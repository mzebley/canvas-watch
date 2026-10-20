<script>
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import DemoStage from '$lib/components/DemoStage.svelte';
	import Toc from '$lib/components/Toc.svelte';
	import ViewportDemo from '$lib/components/ViewportDemo.svelte';

	let { data } = $props();
	const s = $derived(data.snippets);

	const sections = [
		{ id: 'concepts', label: 'Concepts' },
		{ id: 'install', label: 'Install' },
		{ id: 'usage', label: 'Usage' },
		{ id: 'api', label: 'API' },
		{ id: 'how-it-works', label: 'How it works' },
		{ id: 'limitations', label: 'Limitations' },
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
			desc: 'Coarse selector for trigger elements, refined in JS by triggerSuffix.'
		},
		{ name: 'triggerSuffix', def: '-trigger', desc: 'Suffix that marks a class as a trigger.' },
		{ name: 'appliedPrefix', def: 'over-', desc: 'Prefix for the applied class.' },
		{
			name: 'classMap',
			def: 'undefined',
			desc: 'Explicit triggerClass → appliedClass overrides, which win over the convention.'
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

	/** Every non-method export, so the page covers the whole public surface. */
	const helpers = [
		{
			name: 'getSharedWatcher()',
			desc: 'The realm-wide singleton the Svelte adapter uses. Join it to share one rAF loop.'
		},
		{
			name: 'refreshCanvasWatch()',
			desc: 'Re-scan the shared watcher. Call after client-side navigation.'
		},
		{
			name: 'scheduleRefresh()',
			desc: 'The same coalesced re-scan. refreshCanvasWatch() is a named alias for it.'
		},
		{ name: 'overlapArea(a, b)', desc: 'Intersection area of two rects, or 0. Pure.' },
		{
			name: 'pickWinningClass(totals, area, threshold)',
			desc: 'The winner rule itself, depth and all. Pure.'
		},
		{
			name: 'resolveAppliedClass(triggerClass, opts)',
			desc: 'One trigger class to its applied class, or null. Pure.'
		},
		{
			name: 'classifyViewportRect(rect, top, bottom)',
			desc: "A rect's vertical state against two bounds. Pure."
		}
	];

	/** Thrown synchronously, before any browser resource is allocated. */
	const errors = [
		{ when: 'threshold is NaN, infinite, or outside 0–1', type: 'RangeError' },
		{ when: 'triggerRootMargin is not a finite number', type: 'TypeError' },
		{ when: 'watchSelector or triggerSelector is empty or not a valid selector', type: 'TypeError' },
		{ when: 'triggerSuffix or appliedPrefix is not one non-empty class token', type: 'TypeError' },
		{ when: 'classMap is not an object of single class tokens', type: 'TypeError' },
		{
			when: 'observeViewport gets a string that is not an #id, or a non-function listener',
			type: 'TypeError'
		},
		{ when: 'watch() or observeViewport() gets an element from another document', type: 'TypeError' }
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
			body: "Per frame, every unique element rect is read once. Classes, ownership and observer targets are committed before consumer callbacks, so reentrant teardown can't resurrect stale work."
		},
		{
			title: 'Minimal class churn',
			body: 'A class is added or removed only when the winning zone actually changes, so scrolling within one zone writes to the DOM zero times. Rects are still read each frame.'
		},
		{
			title: 'Idle pages skip the measuring',
			body: "With no visible overlap work and no viewport registrations, a scroll frame returns before scheduling anything. The passive scroll and resize listeners stay attached, because they're what notices the page becoming busy again."
		}
	];

	const limitations = [
		{
			title: 'Overriding a composed token',
			body: "Say the property you're changing is a variable that references another variable (a shadow composite, a gradient, a border shorthand) and the composite is declared on :root. Overriding the inner variable from an over-* class does nothing. CSS bakes the nested var() once, where the composite is declared, and the result inherits down. Re-declare the composite on the watched element so it re-bakes against that element's value."
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
			body: "getBoundingClientRect reports where an element would be, not what's visible. A trigger zone inside a scrolling container still reports a full-size rect once it has scrolled out of view, so a watched element outside that container can pick up a zone nobody can see. When your zones live in a scroller, put the trigger class on the scroller itself, whose rect is the visible box, and relabel it from script as its content scrolls."
		},
		{
			title: 'One element gets one answer',
			body: "Majority overlap resolves per watched element, so a wide element spanning two zones takes a single class and half of it ends up styled for the wrong background. A bar across the full content width hits this constantly. The fix isn't in the library. Watch the regions instead of the container: wrap each cluster of content in its own watched element, and each one resolves its own zone, in the same frame, from the same watcher. The header on this page does exactly that, so its left and right ends carry different classes whenever they sit over different zones. Nesting is safe because a watched element only ever resolves against elements carrying a trigger class, so the container it sits inside is invisible to it."
		},
		{
			title: 'Dynamic triggers need refresh()',
			body: "Trigger zones are indexed on refresh(), either at adapter mount or via refreshCanvasWatch(), rather than continuously observed for class changes. Adding a zone, or changing an existing zone's trigger class, needs a re-scan."
		},
		{
			title: 'Unobservable motion needs schedule()',
			body: 'Scroll, resize, relevant DOM mutations, target resizing and viewport-boundary crossings invalidate geometry. Call schedule() after motion that changes geometry without producing one of those signals.'
		},
		{
			title: 'Viewport state is vertical only',
			body: 'observeViewport and canvasWatch classify a reference against the viewport’s top and bottom edges. Horizontal position is deliberately ignored, so an element parked far off to the side still reports within.'
		}
	];
</script>

<svelte:head>
	<title>canvas-watch · which background is your floating element over?</title>
	<meta
		name="description"
		content="Work out which background zone a floating element is sitting over, and get that answer as a class you can style however you like. Framework-agnostic, with an optional Svelte adapter."
	/>
	<meta property="og:title" content="canvas-watch" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://canvas-watch.markzebley.com" />
	<meta
		property="og:description"
		content="Tell a floating element which background it's over, and get that answer as a class. The styling is yours."
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
			<div class="prose cw-inverse-prose">
				<!--
					A zone inside a zone. The hero canvas is dark, so the bar's answer for
					it is light ink — but the display type on it is near-white and huge,
					and a light bar crossing it puts light text on light text. The heading
					is therefore its own zone, nested inside the hero's, and nesting wins:
					while the bar is over these letters it takes dark ink instead.
				-->
				<h1 class="cw-display-trigger">Tell a floating element which background it's over.</h1>

				<p class="lede">
					A sticky header crosses a dark hero, then a white section, then a photo. canvas-watch
					works out which zone it's sitting over and puts that answer on it as a class.
				</p>
				<!-- Body size, not `font-lg`: two lede-sized paragraphs flatten the
				     hierarchy, and on a 375px screen they push the CTAs most of a
				     second screen down. -->
				<p class="margin-block-end-2">
					That's the whole library, and it's one class that stays in step as things move. Re-tint a
					shadow, flip ink from dark to light, swap a border, or invert the whole panel. The styling
					is yours.
				</p>

				<div class="display-flex flex-wrap gap-1 align-items-center margin-block-end-105">
					<zbk-link href="#try-it" appearance="button" variant="lg">Try it</zbk-link>
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

				<CodeBlock snippet={s['install-npm']} isZone />
			</div>

			<div class="cw-inverse-prose">
				<!-- A static miniature of the playground below, so the idea is legible
				     before any scrolling happens. Decorative: the caption carries the
				     same information in prose. -->
				<div class="cw-hero-figure" aria-hidden="true">
					<span class="cw-hero-figure__overlap">largest overlap wins</span>

					<div class="cw-hero-figure__card cw-glass cw-glass--panel cw-tint over-cw-band-merlot">
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
					card as a class. The bar at the top of this page is doing this for real, so scroll and
					read the class it's wearing.
				</p>
			</div>
		</div>
	</section>

	<!-- ── Try it: the overlap playground ──────────────────────── -->
	<section id="try-it" class="cw-zone canvas-app">
		<div class="cw-shell">
			<div class="cw-measure margin-block-end-2">
				<h2 class="font-xl margin-block-start-0 margin-block-end-05">Try it</h2>
				<p class="margin-block-end-1">
					Scroll inside the frame. The floating panel holds three regions, each one separately
					watched, and the cells behind them change colour across the row as well as down the
					stack. Wherever the panel spans a boundary its regions disagree, because each one takes
					the ink of whatever is under <em>it</em>.
				</p>
				<p class="margin-0">
					It needs nothing from the library beyond registering each region, because one watcher
					resolves them all in the same frame.
				</p>
			</div>

			<DemoStage />

			<div class="margin-block-start-2">
				<div class="cw-measure--wide margin-block-end-1">
					<h3 class="font-lg margin-block-start-0 margin-block-end-05">The code running above</h3>
					<p class="margin-0">
						This demo builds its own watcher rather than joining the shared one, because
						<code>threshold</code> is set at construction and the slider changes it. Its selectors
						are deliberately distinct (<code>-demozone</code> rather than <code>-trigger</code>) so
						the page's own watcher never resolves these bands, and the header stays out of it.
					</p>
				</div>

				<div class="margin-block-end-105">
					<CodeBlock snippet={s['demo-overlap-js']} />
				</div>

				<zbk-button variant="subtle sm" toggles="demo-overlap-rest">
					Show the markup and CSS
				</zbk-button>
				<zbk-panel id="demo-overlap-rest" hidden="until-found">
					<div class="margin-block-start-1 margin-block-end-105">
						<CodeBlock snippet={s['demo-overlap-markup']} />
					</div>
					<CodeBlock snippet={s['demo-overlap-css']} />
				</zbk-panel>
			</div>
		</div>
	</section>

	<!-- ── The question everyone asks straight after the demo ──── -->
	<section
		id="why-not-io"
		class="cw-zone canvas-brand-subtle canvas-brand-subtle-trigger"
	>
		<div class="cw-shell">
			<div class="cw-measure--wide">
				<h2 class="font-xl margin-block-start-0 margin-block-end-1">
					Why not just use an IntersectionObserver?
				</h2>
				<p class="font-lg margin-block-end-105">
					Because it can't answer this question, and because canvas-watch is already using one for
					the part it <em>is</em> good at.
				</p>

				<h3 class="font-lg margin-block-start-0 margin-block-end-05">
					What IntersectionObserver can't do
				</h3>
				<p class="margin-block-end-1">
					An IntersectionObserver measures a target against a <code>root</code>, and that root has
					to be an <strong>ancestor</strong> of the target, or the viewport. That's the whole model.
				</p>
				<p class="margin-block-end-105">
					"Is this floating card mostly over that background band?" involves two elements with no
					ancestor relationship at all. They're siblings, or cousins, or in unrelated parts of the
					tree. There's no <code>root</code> you can pass that expresses it, and no
					<code>threshold</code> array that recovers it. The answer you want is the overlap of two
					arbitrary rectangles, which is a different question from the one IO was built to answer.
				</p>

				<h3 class="font-lg margin-block-start-0 margin-block-end-05">So what does it do instead?</h3>
				<p class="margin-block-end-105">
					It compares <code>getBoundingClientRect()</code> on the watched element and on each
					candidate zone, takes the area of the intersection as a fraction of the watched
					element's own area, and applies the threshold and nesting rules. It's plain geometry, run
					once per frame.
				</p>

				<h3 class="font-lg margin-block-start-0 margin-block-end-05">
					IntersectionObserver still does the expensive half
				</h3>
				<p class="margin-block-end-1">
					Rectangle math is cheap, but doing it for every element on a long page, every frame, is
					not. So canvas-watch keeps two IntersectionObservers whose only job is to decide what is
					worth measuring:
				</p>
				<div class="cw-table-scroll margin-block-end-105">
					<table class="cw-table">
						<thead>
							<tr>
								<th scope="col">Observer</th>
								<th scope="col">Watches</th>
								<th scope="col">Effect</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th scope="row">Element gate</th>
								<td>Every watched element</td>
								<td>
									An element off screen is dropped from the measured set entirely. Its rect is
									never read and its class is cleared.
								</td>
							</tr>
							<tr>
								<th scope="row">Zone gate</th>
								<td>
									Every trigger zone, with a <code>triggerRootMargin</code> of 200px by default
								</td>
								<td>
									Only zones near the viewport stay candidates, so a page with two hundred zones
									compares against the handful currently in play.
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p class="margin-0">
					The result is that per-frame cost tracks what is on screen rather than how long the
					document is, and a page with nothing visible to resolve schedules no work at all. IO does
					what it's genuinely good at, which is cheap off-main-thread visibility signals, and the
					rectangle comparison only runs on what survives that filter.
				</p>
			</div>
		</div>
	</section>

	<!-- ── Viewport state: the second feature ──────────────────── -->
	<section
		id="viewport"
		class="cw-zone canvas-accent-secondary ink-accent-secondary-inverse canvas-accent-secondary-trigger"
	>
		<div class="cw-shell">
			<div class="cw-viewport-intro cw-measure cw-inverse-prose">
				<h2 class="font-xl margin-block-start-0 margin-block-end-1">
					Or track one reference crossing the viewport.
				</h2>
				<p class="font-lg margin-block-end-1">
					This is the library's second job, and it has nothing to do with overlap. Point it at an
					element and it reports whether that element is above the viewport, inside it, below it, or
					missing from the document entirely.
				</p>
				<p class="margin-0">
					Keep scrolling. The beacon starts below you, burns bright while any part of it is in view,
					then leaves above. Remove the reference to see <code>missing</code>, then restore it.
				</p>
			</div>

			<ViewportDemo />

			<div class="cw-measure--wide margin-block-start-2 cw-inverse-prose">
				<p class="margin-block-end-1">
					That readout is the real Svelte API, watching <code>#viewport-beacon</code>:
				</p>
				<CodeBlock snippet={s['demo-viewport']} isZone />
			</div>
		</div>
	</section>

	<!-- ── Docs ──────────────────────────────────────────────────────────────── -->
	<section class="cw-zone canvas-brand-subtle canvas-brand-subtle-trigger">
		<div class="cw-shell cw-docs">
			<Toc {sections} />

			<div class="cw-docs-body">
				<!-- Concepts -->
				<section id="concepts">
					<h2 class="cw-docs-h2">Concepts</h2>

					<div class="cw-measure--wide">
						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Watched element</h3>
						<p class="margin-0">
							A floating element you tag with <code>watch-bg-canvas</code> (or register through an
							adapter). It receives an <code>over-*</code> class describing the zone it currently sits
							over.
						</p>

						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Trigger zone</h3>
						<p class="margin-block-end-1">
							A background element tagged with a <code>*-trigger</code> class. Each one maps to an
							<code>over-*</code> class by convention, so you strip the <code>-trigger</code> suffix
							and add the <code>over-</code> prefix.
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
						<h3 class="font-lg margin-block-start-105 margin-block-end-05">
							The winner is the deepest zone, then the largest overlap
						</h3>
						<p class="margin-block-end-1">
							Only zones covering at least <code>threshold</code> of the watched element's
							<em>own</em> area are eligible, which is 50% by default. Among those the most deeply
							nested zone wins outright, and among zones at the same depth the largest overlap wins.
							If nothing clears the threshold, every <code>over-*</code> class is removed.
						</p>
						<p class="margin-0">
							Nesting beats area because a zone inside another zone is the more specific answer.
							Otherwise a container could never be overridden, since its overlap is by definition at
							least its children's. Depth only reorders zones that already clear the threshold, so a
							nested zone that barely clips the element can't hijack it. Same-class rectangles count
							by their physical union, so duplicate pixels are never counted twice, and coverage
							stays paired with its depth so a tiny nested zone can't promote a same-class ancestor.
							The heading at the top of this page is a zone of its own inside the hero's, so the bar
							takes dark ink while it's crossing those pale letters and the hero's light ink
							everywhere else.
						</p>

						<h3 class="font-lg margin-block-start-105 margin-block-end-05">
							The <code>canvaschange</code> event
						</h3>
						<p class="margin-0">
							Most restyling needs no JavaScript at all, so write CSS for the <code>over-*</code>
							class and you're done. When you need more, each change dispatches a
							<code>canvaschange</code>
							CustomEvent whose detail carries
							<code>&lbrace; appliedClass, previousClass &rbrace;</code>, each either a
							<code>string</code> or <code>null</code>. Use it to swap an icon set, re-render a
							chart's palette, or announce something. The Svelte adapter surfaces it as
							<code>onChange</code>.
						</p>
					</div>
				</section>

				<!-- Install -->
				<section id="install">
					<h2 class="cw-docs-h2">Install</h2>

					<div class="margin-block-start-1 margin-block-end-105">
						<CodeBlock snippet={s['install-npm']} />
					</div>

					<p class="cw-measure--wide margin-block-end-1">
						The Svelte adapter ships as a subpath entry point and pulls in an
						<strong>optional</strong> peer dependency, so install it only if you use it.
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
									<td>
										Svelte adapter (<code>watchBgCanvas</code> action and reactive
										<code>canvasWatch</code> state)
									</td>
									<td><code>svelte &gt;= 5.7</code></td>
								</tr>
							</tbody>
						</table>
					</div>
				</section>

				<!-- Usage -->
				<section id="usage">
					<h2 class="cw-docs-h2">Usage</h2>

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
							<code>class="watch-bg-canvas"</code> is optional when you use the action, since the
							action registers the node directly, but keeping it makes the intent obvious in markup.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['svelte-action']} />
						</div>
						<h3 class="font-lg margin-block-start-105 margin-block-end-05">Viewport state</h3>
						<p class="cw-measure--wide margin-block-end-1">
							<code>canvasWatch('#hero')</code> exposes reactive <code>aboveViewport</code>,
							<code>inViewport</code>, <code>belowViewport</code> and <code>missing</code> properties.
							The full state starts as <code>unknown</code>, and a missing ID becomes
							<code>missing</code> only after client resolution. Read these properties in a template
							or tracked effect. If you're calling imperatively, use <code>observeViewport</code>
							instead.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['svelte-viewport']} />
						</div>
						<p class="cw-measure--wide margin-block-end-1">
							Elements that outlive a page, like a layout-level nav or player, are registered once
							and won't automatically see a new page's trigger zones. Re-scan after navigation:
						</p>
						<CodeBlock snippet={s['svelte-navigate']} />
					</zbk-panel>

					<zbk-panel id="usage-angular" hidden="until-found">
						<h3 class="font-lg margin-block-start-0 margin-block-end-05">Angular</h3>
						<p class="cw-measure--wide margin-block-end-1">
							There's no Angular entry point to install, because the core is enough. A standalone
							directive wraps it in about fifty lines including imports, and because it registers on
							<code>getSharedWatcher()</code> it joins the same single rAF loop as every other
							watched element on the page. This is code to own and adapt in your app rather than a
							shipped adapter, and the library's tests don't cover it.
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
							Elements that outlive a route, like a layout-level nav or player, are registered once
							and won't automatically see the next page's trigger zones. Re-scan after navigation:
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
							Subscribe in JavaScript, or let HTML own one default state class. ID resolution, late
							insertion, removal and relevant attribute changes share one coalesced
							<code>MutationObserver</code> per watcher. Unrelated classes are untouched.
						</p>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['viewport-core']} />
						</div>
						<div class="margin-block-end-105">
							<CodeBlock snippet={s['viewport-markup']} />
						</div>
						<p class="cw-measure--wide margin-block-end-1">
							The declarative form applies exactly one of these four classes to the element carrying
							the attribute, and removes the other three. An attribute value that is not an
							<code>#id</code> resolves to <code>missing</code> rather than throwing.
						</p>
						<div class="cw-table-scroll margin-block-end-105">
							<table class="cw-table">
								<thead>
									<tr>
										<th scope="col">State</th>
										<th scope="col">Class applied</th>
									</tr>
								</thead>
								<tbody>
									<tr><th scope="row"><code>above</code></th><td><code>cw-reference-above</code></td></tr>
									<tr><th scope="row"><code>within</code></th><td><code>cw-reference-within</code></td></tr>
									<tr><th scope="row"><code>below</code></th><td><code>cw-reference-below</code></td></tr>
									<tr><th scope="row"><code>missing</code></th><td><code>cw-reference-missing</code></td></tr>
								</tbody>
							</table>
						</div>
						<p class="cw-measure--wide margin-block-end-1">Listen for changes directly on the element:</p>
						<CodeBlock snippet={s['vanilla-event']} />
					</zbk-panel>
				</section>

				<!-- API -->
				<section id="api">
					<h2 class="cw-docs-h2">API</h2>

					<h3 class="font-lg margin-block-start-1 margin-block-end-05">
						<code>createCanvasWatcher(options?)</code>
					</h3>
					<p class="cw-measure--wide margin-block-end-1">
						Returns a live watcher in the browser, or a no-op during SSR, so you never need to guard
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
						repeated. <code>destroy()</code> is terminal. A consumer listener that throws is reported
						through <code>reportError</code> without blocking healthy listeners or cleanup.
					</p>

					<h3 class="font-lg margin-block-start-105 margin-block-end-05">
						Shared watcher and pure helpers
					</h3>
					<div class="cw-table-scroll margin-block-end-105">
						<table class="cw-table">
							<thead>
								<tr>
									<th scope="col">Export</th>
									<th scope="col">Description</th>
								</tr>
							</thead>
							<tbody>
								{#each helpers as helper (helper.name)}
									<tr>
										<th scope="row"><code>{helper.name}</code></th>
										<td>{helper.desc}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<h3 class="font-lg margin-block-start-105 margin-block-end-05">Validation errors</h3>
					<p class="cw-measure--wide margin-block-end-1">
						Bad configuration throws immediately rather than failing quietly on the first frame.
					</p>
					<div class="cw-table-scroll margin-block-end-105">
						<table class="cw-table">
							<thead>
								<tr>
									<th scope="col">When</th>
									<th scope="col">Thrown</th>
								</tr>
							</thead>
							<tbody>
								{#each errors as error (error.when)}
									<tr>
										<td>{error.when}</td>
										<td><code>{error.type}</code></td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<h3 class="font-lg margin-block-start-105 margin-block-end-05">Types</h3>
					<p class="cw-measure--wide margin-0">
						The package ships its own declarations. Exported from the core:
						<code>CanvasWatcher</code>, <code>CanvasWatchOptions</code>,
						<code>CanvasChangeDetail</code>, <code>ClassResolveOptions</code>,
						<code>DOMRectLike</code>, <code>ZoneOverlap</code>,
						<code>ViewportChangeDetail</code>, <code>ViewportListener</code>,
						<code>ViewportReference</code> and <code>ViewportState</code>. The Svelte entry adds
						<code>WatchBgCanvasParams</code> and <code>CanvasViewport</code>.
					</p>
				</section>

				<!-- How it works -->
				<section id="how-it-works">
					<h2 class="cw-docs-h2">How it works</h2>

					<p class="cw-measure--wide margin-block-start-1 margin-block-end-0">
						The short version of <a href="#why-not-io">why this isn't an IntersectionObserver</a>,
						plus what happens on each frame.
					</p>

					<ol class="cw-measure--wide margin-block-start-105 padding-inline-start-105">
						{#each steps as step (step.title)}
							<li class="margin-block-end-1">
								<strong>{step.title}.</strong>
								{step.body}
							</li>
						{/each}
					</ol>
				</section>

				<!-- Limitations -->
				<section id="limitations">
					<h2 class="cw-docs-h2">Limitations</h2>
					<p class="cw-measure--wide margin-0">
						The things that cost an afternoon if you meet them cold.
					</p>
					<div class="margin-block-start-1">
						{#each limitations as limitation (limitation.title)}
							<h3 class="font-lg margin-block-start-105 margin-block-end-05">{limitation.title}</h3>
							<p class="cw-measure--wide margin-0">{limitation.body}</p>
						{/each}
					</div>
					<div class="margin-block-start-105">
						<CodeBlock snippet={s['gotcha-shadow']} />
					</div>
				</section>

				<!-- Accessibility -->
				<section id="accessibility">
					<h2 class="cw-docs-h2">Accessibility</h2>
					<div class="cw-measure--wide margin-block-start-1">
						<p class="margin-block-end-1">
							canvas-watch is <strong>purely presentational</strong>. It adds and removes one class.
							It sets no ARIA attributes, announces nothing to assistive technology, and never alters
							content or focus order. Whether it changes layout is entirely down to what your
							<code>over-*</code> rules declare.
						</p>
						<p class="margin-block-end-1">
							<strong>Contrast is your responsibility, and it matters more the more you restyle.</strong>
							A shadow that misses 3:1 is cosmetic, but text that lands at 2:1 because the panel
							behind it changed is a WCAG 1.4.3 failure. If your <code>over-*</code> rules touch
							text, border, or icon colour, check every zone. The library only tells you which one
							you're over, and it has no idea whether the result is legible.
						</p>
						<p class="margin-block-end-1">
							<strong>Reduced motion is your call.</strong> Put any
							<code>transition</code> on the properties you change behind
							<code>@media (prefers-reduced-motion: reduce)</code>.
						</p>
						<p class="margin-0">
							Under the hood it needs <code>IntersectionObserver</code>,
							<code>ResizeObserver</code>, <code>MutationObserver</code>,
							<code>requestAnimationFrame</code> and <code>CustomEvent</code>. The test suite runs in
							headless Chromium, and other engines aren't covered by CI. It's SSR-safe, so
							<code>createCanvasWatcher</code> returns a no-op when <code>window</code> and
							<code>document</code> are absent, and the Svelte adapter only runs on the client.
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
			<div class="cw-measure cw-inverse-prose">
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
