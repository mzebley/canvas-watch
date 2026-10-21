<script>
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import FontSizeControl from '$lib/components/FontSizeControl.svelte';
	import Signature from '$lib/components/Signature.svelte';
	import CanvasMark from '$lib/components/CanvasMark.svelte';
	import OverlapLab from '$lib/components/OverlapLab.svelte';
	import ViewportDemo from '$lib/components/ViewportDemo.svelte';
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import DocsNav from '$lib/components/DocsNav.svelte';

	let { data } = $props();
	const s = $derived(data.snippets);
	const sections = [
		{ id: 'installation', label: 'Installation' },
		{ id: 'usage', label: 'Usage' },
		{ id: 'examples', label: 'Live examples' },
		{ id: 'viewport', label: 'Viewport state' },
		{ id: 'api', label: 'API reference' },
		{ id: 'lifecycle', label: 'Lifecycle & routing' },
		{ id: 'accessibility', label: 'Accessibility & limits' }
	];
	const options = [
		['watchSelector', '.watch-bg-canvas', 'Find the elements that receive overlap classes.'],
		['triggerSelector', '[class*="-trigger"]', 'Find candidate background zones.'],
		['triggerSuffix', '-trigger', 'Identify the zone classes on each candidate.'],
		['appliedPrefix', 'over-', 'Prefix the class applied to a watched element.'],
		['classMap', 'undefined', 'Map trigger classes to your own applied classes.'],
		['threshold', '0.5', "Require this share of the watched element's area, from 0 to 1."],
		['triggerRootMargin', '200', 'Keep zones active within this many pixels of the viewport.']
	];
	const methods = [
		['refresh()', 'Re-scan overlap targets, trigger zones, and declarative viewport elements.'],
		['watch(element)', 'Register an element directly. Returns an independent unwatch function.'],
		['observeViewport(reference, listener)', 'Watch a native #id or Element. Returns an independent unsubscribe function.'],
		['schedule()', 'Request one measurement on the next animation frame.'],
		['destroy()', 'Disconnect observers, cancel pending work, and remove owned classes. Terminal and idempotent.']
	];
	const helpers = [
		['getSharedWatcher()', 'Join the singleton used by the Svelte adapter.'],
		['refreshCanvasWatch()', 'Queue a coalesced re-scan of the shared watcher.'],
		['scheduleRefresh()', 'An alias of refreshCanvasWatch; the same coalesced re-scan.'],
		['overlapArea(a, b)', 'Calculate the intersection area of two rectangles.'],
		['resolveAppliedClass(triggerClass, options)', 'Resolve a class mapping or the suffix/prefix convention.'],
		['pickWinningClass(totals, area, threshold)', 'Choose among depth-qualified class claims.'],
		['classifyViewportRect(rect, top, bottom)', 'Classify vertical position against two viewport bounds.']
	];
</script>

<svelte:head>
	<title>canvas-watch — background overlap & viewport state</title>
	<meta name="description" content="A dependency-free geometry watcher for background-aware interfaces and reactive viewport state. Explore live examples, Svelte integration, and the complete API." />
	<link rel="canonical" href="https://canvas-watch.markzebley.com/" />
	<meta property="og:title" content="canvas-watch" />
	<meta property="og:description" content="Know which background an element overlaps, and where a reference sits relative to the viewport." />
</svelte:head>

<header id="hero" class="masthead">
	<div class="header-tools">
		<a class="signature-link" href="https://markzebley.com" aria-label="Mark Zebley's website"><Signature /></a>
		<FontSizeControl />
		<div class="header-theme"><ThemeToggle /></div>
	</div>
	<div class="brand-intro">
		<h1 id="heading" class="wordmark" aria-label="canvas-watch"><span class="wordmark__part">canvas<span class="wordmark__hyphen">-</span></span><wbr /><span class="wordmark__part">watch</span></h1>
		<p class="hero-description">A dependency-free <strong>geometry watcher</strong> for<br class="desktop-break" /> <strong>background-aware interfaces</strong> and reactive viewport state.</p>
	</div>
	<div class="hero-example">
		<OverlapLab id="hero-lab" compact />
		<p class="hero-caption">Two elements, one watcher. Each follows the background underneath it.</p>
	</div>
</header>

<main id="main-content" tabindex="-1" class="docs-layout">
	<aside class="docs-rail">
		<DocsNav {sections} />
	</aside>

	<article class="docs-column" aria-label="canvas-watch documentation">
		<div class="capability-intro">
			<div><h2>What am I over?</h2><p>Compare a floating element with background zones. Get one class for the winning surface.</p></div>
			<div><h2>Where did it go?</h2><p>Track whether a reference is above, within, below, or missing from the viewport.</p></div>
		</div>

		<section id="installation" class="docs-section prose" aria-labelledby="installation-title">
			<p class="section-index">Get it running</p><h2 id="installation-title">Installation</h2>
			<p>canvas-watch compares element geometry and gives your interface a class or a state to work with. Your CSS and application decide what happens next.</p>
			<CodeBlock snippet={s.install} />
			<div class="import-grid"><div><h3>Any framework</h3><code>@mzebley/canvas-watch</code><p>The core has no framework dependencies.</p></div><div><h3>Svelte 5.7+</h3><code>@mzebley/canvas-watch/svelte</code><p>An action for overlap. Reactive getters for viewport state.</p></div></div>
			<p class="note">Both entries are safe to import during SSR. Measurements begin in the browser.</p>
		</section>

		<section id="usage" class="docs-section prose" aria-labelledby="usage-title">
			<p class="section-index">The small version</p><h2 id="usage-title">A zone, an element, a class.</h2>
			<p>Give a background a <code>-trigger</code> class. Register the element that should respond to it. When enough of that element overlaps the zone, it receives the matching <code>over-</code> class.</p>
			<div class="class-convention"><code>ink-trigger</code><span aria-hidden="true">→</span><code>over-ink</code><span class="small-copy">on the watched element</span></div>
			<zbk-tabs aria-label="Choose an integration">
				<span slot="tab">JavaScript</span><section id="usage-javascript"><CodeBlock snippet={s.markup} /><CodeBlock snippet={s.core} /><CodeBlock snippet={s.styles} /></section>
				<span slot="tab">Svelte</span><section id="usage-svelte"><CodeBlock snippet={s.svelte} /><p>The action registers the element directly, shares a watcher across the app, and cleans up when the element is destroyed. A <code>watch-bg-canvas</code> class is optional here.</p></section>
			</zbk-tabs>
			<p>React, Vue, Angular, and other frameworks can use the core in their mount and teardown lifecycles. The package ships a Svelte adapter; other adapters are yours to compose.</p>
		</section>

		<section id="examples" class="docs-section prose" aria-labelledby="examples-title">
			<p class="section-index">Try the actual behavior</p><h2 id="examples-title">Practical examples</h2>
			<p>These examples run canvas-watch itself. Adjust the geometry, change the threshold, and inspect the class and event it produces.</p>
			<div class="example-heading"><div><h3 id="adaptive-shadow">Let a floating player pick up its surroundings.</h3><p>Swap a shadow color without rebuilding the player. The class changes only when a different zone wins.</p></div></div>
			<OverlapLab id="shadow-lab" appearance="shadow" />
			<zbk-disclosure><span slot="summary">View the shadow styles</span><CodeBlock snippet={s.shadow} /></zbk-disclosure>

			<div class="example-heading"><div><h3 id="nested-zones">Give the more specific background a say.</h3><p>A dark inset sits inside a light section. Once the inset meets the overlap threshold, it wins over its parent. Raise the threshold and move to an edge to see it fall back.</p></div></div>
			<OverlapLab id="nested-lab" mode="nested" />
			<zbk-disclosure><span slot="summary">View the nested markup</span><CodeBlock snippet={s.nested} /></zbk-disclosure>

			<div class="example-heading"><div><h3 id="combined-zones">Treat adjacent surfaces as one.</h3><p>The two rose zones carry the same class. Together, they can meet a threshold that neither meets alone. Duplicating the left zone adds no new physical coverage.</p></div></div>
			<OverlapLab id="union-lab" mode="union" />
			<zbk-disclosure><span slot="summary">View the combined-zone markup</span><CodeBlock snippet={s.union} /></zbk-disclosure>

			<div class="example-heading"><div><h3 id="custom-mapping">Keep the class names your app already uses.</h3><p>Map trigger classes to <code>on-paper</code>, <code>on-rose</code>, and <code>on-ink</code>. Custom selectors keep a watcher focused on the part of the page it owns.</p></div></div>
			<OverlapLab id="mapping-lab" mode="mapping" />
			<zbk-disclosure><span slot="summary">View the watcher configuration</span><CodeBlock snippet={s.mapping} /></zbk-disclosure>

			<h3 id="change-events">React when the answer changes.</h3><p>Each example exposes its latest <code>canvaschange</code> event. Use <code>appliedClass</code> and <code>previousClass</code> for application logic; both can be <code>null</code>. Svelte's action exposes the same detail through <code>onChange</code>.</p>
			<CodeBlock snippet={s.events} />
			<div class="rule-note"><strong>The winner rule</strong><p>First, discard zones below the threshold. Then choose the deepest eligible zone. At the same depth, the greatest overlap wins. If no zone qualifies, the owned class is removed.</p></div>
		</section>

		<section id="viewport" class="docs-section prose" aria-labelledby="viewport-title">
			<p class="section-index">A second kind of watching</p><h2 id="viewport-title">Keep track of what left the viewport.</h2>
			<p>A navigation can gain a border after the hero leaves. A dock can change after its original controls scroll away. Reference a native ID or an <code>Element</code> and read its vertical state.</p>
			<ViewportDemo />
			<CodeBlock snippet={s.viewport} />
			<p><code>aboveViewport</code>, <code>inViewport</code>, <code>belowViewport</code>, and <code>missing</code> are reactive getters. Before the first client measurement, <code>state</code> is <code>unknown</code> and all four are false. Read them from a template or tracked effect.</p>
			<zbk-disclosure><span slot="summary">Use the core callback instead</span><CodeBlock snippet={s.viewportCore} /></zbk-disclosure>
			<h3 id="declarative-viewport">Or let HTML own the styling.</h3><p>With <code>data-canvas-watch-viewport</code>, an element receives exactly one <code>cw-reference-above</code>, <code>cw-reference-within</code>, <code>cw-reference-below</code>, or <code>cw-reference-missing</code> class. Discovery stays active after <code>refresh()</code>, so later insertion, removal, and reference attribute changes are picked up automatically.</p>
			<CodeBlock snippet={s.declarative} />
			<div class="declarative-example" data-canvas-watch-viewport="#viewport-beacon"><span>HTML-owned reference state</span><span class="declarative-state" aria-hidden="true"></span><span class="visually-hidden">State is also shown by the live viewport example above.</span></div>
		</section>

		<section id="api" class="docs-section prose" aria-labelledby="api-title">
			<p class="section-index">The complete surface</p><h2 id="api-title">API reference</h2>
			<h3><code>createCanvasWatcher(options?)</code></h3><p>Create an independent watcher. In an SSR environment it returns a no-op. Options are validated before browser resources are allocated: thresholds must be finite and between 0 and 1, margins finite, selectors valid, and class mappings single tokens.</p>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (The named overflow region needs keyboard scrolling.) -->
			<div class="table-scroll" role="region" aria-label="Watcher options" tabindex="0"><table><caption>Watcher options</caption><thead><tr><th>Option / default</th><th>What it controls</th></tr></thead><tbody>{#each options as [name, def, description]}<tr><th scope="row"><code>{name}</code><span class="table-default">{def}</span></th><td>{description}</td></tr>{/each}</tbody></table></div>
			<h3>Watcher methods</h3><dl class="api-list">{#each methods as [name, description]}<div><dt><code>{name}</code></dt><dd>{description}</dd></div>{/each}</dl>
			<h3>Svelte adapter</h3><dl class="api-list"><div><dt><code>watchBgCanvas</code></dt><dd>An action that registers overlap on the shared watcher. Accepts an optional <code>onChange(detail)</code> callback.</dd></div><div><dt><code>canvasWatch(reference)</code></dt><dd>Reactive viewport state with five getters: <code>state</code>, <code>aboveViewport</code>, <code>inViewport</code>, <code>belowViewport</code>, and <code>missing</code>. For imperative subscriptions, use <code>observeViewport</code>.</dd></div><div><dt><code>refreshCanvasWatch()</code></dt><dd>Re-scan the shared watcher after mounting new trigger zones or navigating.</dd></div></dl>
			<h3>Shared watcher and pure helpers</h3><dl class="api-list">{#each helpers as [name, description]}<div><dt><code>{name}</code></dt><dd>{description}</dd></div>{/each}</dl>
			<zbk-disclosure><span slot="summary">TypeScript exports</span><CodeBlock snippet={s.types} /><p>The core exports types for watchers, options, rectangles, overlap claims, viewport references and listeners, and change details. The Svelte entry also exports <code>CanvasViewport</code> and <code>WatchBgCanvasParams</code>.</p></zbk-disclosure>
		</section>

		<section id="lifecycle" class="docs-section prose" aria-labelledby="lifecycle-title">
			<p class="section-index">Mount, update, clean up</p><h2 id="lifecycle-title">Built to live inside an app.</h2>
			<p>Register one element or discover a group. Each registration owns an independent, idempotent disposer. Destroying a watcher disconnects its observers and makes future calls inert.</p>
			<CodeBlock snippet={s.lifecycle} />
			<h3 id="route-changes">Refresh after a route changes.</h3><p>A layout-level navigation outlives its pages. Let the new DOM render, then re-index its trigger zones. In SvelteKit:</p><CodeBlock snippet={s.routing} />
			<h3 id="measurement">One measurement pass per frame.</h3><ol class="how-it-works"><li><strong>Gate by visibility.</strong> IntersectionObserver keeps overlap work focused on visible elements and nearby zones.</li><li><strong>Coalesce the signals.</strong> Scroll, resize, relevant mutations, and observer callbacks feed one frame scheduler per watcher.</li><li><strong>Read, commit, notify.</strong> Each unique rectangle is read once per pass. Classes are committed before consumer callbacks run.</li><li><strong>Leave stable classes alone.</strong> Scrolling within the same winning zone causes no class churn. An idle page with no active work skips measuring.</li></ol>
			<p>The Svelte adapter shares one watcher across its elements. ESM and CommonJS consumers in the same JavaScript realm join the same singleton through <code>getSharedWatcher()</code>. Separate watchers, as used by these configurable examples, keep their own schedulers.</p>
		</section>

		<section id="accessibility" class="docs-section prose" aria-labelledby="accessibility-title">
			<p class="section-index">Know the boundaries</p><h2 id="accessibility-title">Geometry is a useful signal.</h2>
			<p>canvas-watch changes classes and reports state. It doesn't inspect pixels, calculate contrast, add ARIA, announce changes, or move focus. Your styles and behavior still need to work for the people using them.</p>
			<dl class="limits-list"><div><dt>Rectangles, not paint order.</dt><dd>Overlap doesn't model occlusion, clipping, opacity, or <code>z-index</code>. DOM nesting decides specificity. A zone's geometry can extend outside a clipped scroller.</dd></div><div><dt>A layout viewport, on the vertical axis.</dt><dd>Viewport state ignores horizontal position and uses the layout viewport. Direct references must belong to the watcher's document. Document selectors don't cross shadow roots; direct viewport references inside one are supported.</dd></div><div><dt>Styles stay your responsibility.</dt><dd>Choose contrasting foregrounds for every background. Respect reduced motion for transitions and compose shadow variables on the watched element where overrides apply.</dd></div><div><dt>Some changes need an explicit signal.</dt><dd>Call <code>refresh()</code> after editing trigger classes or adding zones. Call <code>schedule()</code> after transforms or other geometry changes that don't trigger an observed signal. Sticky positioning still follows normal overflow rules.</dd></div></dl>
			<h3>Browser requirements</h3><p><code>IntersectionObserver</code>, <code>ResizeObserver</code>, <code>MutationObserver</code>, <code>requestAnimationFrame</code>, and <code>CustomEvent</code>. The library's browser suite covers Chromium; other engines aren't covered by that CI suite.</p>
			<p class="closing-copy">Small pieces. Your interface.<br /><a href="https://github.com/mzebley/canvas-watch">Read the source <span aria-hidden="true">↗</span></a></p>
		</section>
	</article>
</main>

<footer class="site-footer"><div class="footer-project"><CanvasMark class="footer-mark" /><nav aria-label="Project links"><a href="https://github.com/mzebley/canvas-watch">GitHub <span aria-hidden="true">↗</span></a><a href="https://www.npmjs.com/package/@mzebley/canvas-watch">npm <span aria-hidden="true">↗</span></a></nav></div><p>An idea by <a href="https://markzebley.com">Mark Zebley <span aria-hidden="true">↗</span></a></p></footer>
