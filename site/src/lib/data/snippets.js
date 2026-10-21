/** Static sources are highlighted on the server; no highlighter ships to the browser. */
export const snippets = {
  install: { lang: 'bash', label: 'Shell', code: 'npm install @mzebley/canvas-watch' },
  core: { lang: 'js', label: 'JavaScript', code: `import { createCanvasWatcher } from '@mzebley/canvas-watch';

const watcher = createCanvasWatcher();
watcher.refresh();

// When this part of your app unmounts:
// watcher.destroy();` },
  markup: { lang: 'html', label: 'HTML', code: `<section class="ink-trigger">A dark background</section>
<nav class="watch-bg-canvas">A floating navigation</nav>` },
  styles: { lang: 'css', label: 'CSS', code: `.ink-trigger {
  min-block-size: 100vh;
  background: #33205e;
  color: #f4f0fa;
}
.watch-bg-canvas {
  position: fixed;
  inset: 1rem 1rem auto;
  padding: 1rem;
  color: #4b2a87;
}
.watch-bg-canvas.over-ink { color: #f4f0fa; }

/* You own the style. canvas-watch supplies the class. */` },
  svelte: { lang: 'svelte', label: 'Page.svelte', code: `<script>
  import { watchBgCanvas } from '@mzebley/canvas-watch/svelte';
</script>

<section class="ink-trigger">A dark background</section>
<nav use:watchBgCanvas>A floating navigation</nav>

<style>
  section { min-block-size: 100vh; background: #33205e; color: #f4f0fa; }
  nav { position: fixed; inset: 1rem 1rem auto; padding: 1rem; color: #4b2a87; }
  nav:global(.over-ink) { color: #f4f0fa; }
</style>` },
  events: { lang: 'js', label: 'JavaScript', code: `floatingElement.addEventListener('canvaschange', (event) => {
  const { appliedClass, previousClass } = event.detail;
  console.log(previousClass, '→', appliedClass);
});

// Svelte: pass the same detail to an onChange callback.
// use:watchBgCanvas={{ onChange: (detail) => { … } }}` },
  shadow: { lang: 'css', label: 'Player.css', code: `.player {
  --shadow-color: #4b2a87;
  /* Compose this on the element, where its color changes. */
  box-shadow: 0 12px 32px -8px
    color-mix(in srgb, var(--shadow-color) 40%, transparent);
}
.player.over-rose { --shadow-color: #a72772; }
.player.over-ink  { --shadow-color: #c5b2e6; }

@media (prefers-reduced-motion: no-preference) {
  .player { transition: box-shadow 180ms ease; }
}` },
  nested: { lang: 'html', label: 'HTML', code: `<section class="paper-trigger">
  A background covering the entire example.
  <aside class="ink-trigger">A more specific background.</aside>
</section>

<div class="watch-bg-canvas">The floating element</div>
<!-- The nested ink zone wins once it meets the threshold. -->` },
  union: { lang: 'html', label: 'HTML', code: `<section class="rose-trigger">Left half</section>
<section class="rose-trigger">Right half</section>

<div class="watch-bg-canvas">Across both zones</div>
<!-- Adjacent zones with the same applied class combine.
     Overlapping pixels at the same depth count once. -->` },
  mapping: { lang: 'js', label: 'JavaScript', code: `const watcher = createCanvasWatcher({
  watchSelector: '.floating-control',
  triggerSelector: '.page-zone',
  classMap: {
    'paper-trigger': 'on-paper',
    'rose-trigger': 'on-rose',
    'ink-trigger': 'on-ink',
  },
  threshold: 0.5,
});
watcher.refresh();` },
  viewport: { lang: 'svelte', label: 'Page.svelte', code: `<script>
  import { canvasWatch } from '@mzebley/canvas-watch/svelte';
  const hero = canvasWatch('#hero');
</script>

<header class:past-hero={hero.aboveViewport}>
  {hero.missing ? 'Hero not found' : hero.state}
</header>
<section id="hero">Your introduction</section>` },
  viewportCore: { lang: 'js', label: 'JavaScript', code: `const stop = watcher.observeViewport('#hero', (detail) => {
  // state: 'missing' | 'above' | 'within' | 'below'
  console.log(detail.state, detail.previousState);
});

// A direct Element reference works too.
// Each subscription gets an independent disposer.
stop();` },
  declarative: { lang: 'html', label: 'HTML', code: `<header data-canvas-watch-viewport="#hero">Navigation</header>
<section id="hero">Your introduction</section>

<style>
  header.cw-reference-above { box-shadow: 0 4px 12px #0002; }
  header.cw-reference-missing { border-bottom: 2px dashed; }
</style>
<!-- Call watcher.refresh() once to enable discovery. -->` },
  lifecycle: { lang: 'js', label: 'JavaScript', code: `const watcher = createCanvasWatcher();
const unwatch = watcher.watch(floatingElement);
const unsubscribe = watcher.observeViewport('#hero', onViewportChange);

watcher.refresh();  // Re-index after adding or changing trigger zones.
watcher.schedule(); // Re-measure after moving an element with a transform.

unwatch();
unsubscribe();
watcher.destroy();  // Disconnect observers and remove owned classes.` },
  routing: { lang: 'svelte', label: '+layout.svelte', code: `<script>
  import { afterNavigate } from '$app/navigation';
  import { tick } from 'svelte';
  import { refreshCanvasWatch } from '@mzebley/canvas-watch/svelte';

  afterNavigate(async () => {
    await tick();
    refreshCanvasWatch();
  });
</script>` },
  types: { lang: 'ts', label: 'TypeScript', code: `import type {
  CanvasWatcher, CanvasWatchOptions, CanvasChangeDetail,
  ViewportState, ViewportReference, ViewportChangeDetail,
  ViewportListener, ClassResolveOptions, DOMRectLike, ZoneOverlap,
} from '@mzebley/canvas-watch';

// Additional Svelte types from '@mzebley/canvas-watch/svelte':
// CanvasViewport, WatchBgCanvasParams

type State = 'unknown' | 'missing' | 'above' | 'within' | 'below';
// ViewportReference accepts a native '#id' or a direct Element.` },
};
