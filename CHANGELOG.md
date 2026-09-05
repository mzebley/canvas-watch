# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-09-04

### Changed

- The Svelte adapter now requires Svelte 5.7 or newer, matching the release that
  introduced the `createSubscriber` runtime interface it imports.
- Same-class overlap now measures physical union coverage. Duplicate rectangles
  cannot inflate 30% coverage into a qualifying 60%, while adjacent zones still
  combine. Coverage and nesting depth remain paired so a subthreshold nested
  contribution cannot promote a same-class ancestor.
- **Nesting now wins.** A trigger zone inside another trigger zone beats its
  container, whatever the overlap: the nested zone is the more specific answer,
  and a container's overlap is by definition at least its children's, so under
  pure majority overlap a container could never be overridden. Only zones that
  already clear `threshold` are reordered by depth, so a nested zone that barely
  clips a watched element still can't hijack it; at equal depth the larger
  overlap wins, exactly as before. A page with no nested zones is unaffected.

### Added

- `pickWinningClass(totals, area, threshold)` — the winner rule as a pure,
  DOM-free export, taking a `Map<appliedClass, { overlap, depth }>`, alongside
  the `ZoneOverlap` type.
- Shared viewport observation through
  `watcher.observeViewport(reference, listener)`, with native ID and direct
  element references, vertical `above` / `within` / `below` classification,
  explicit `unknown` / `missing` lifecycle states, and cleanup on unsubscribe
  or destroy.
- Reactive Svelte 5 state through `canvasWatch(reference)`, exposing
  `aboveViewport`, `inViewport`, `belowViewport`, and `missing` properties.
- Declarative viewport classes through `data-canvas-watch-viewport="#hero"`.
  ID resolution and DOM changes share one lazy `MutationObserver` per watcher.
- Durable DOM and Chromium lifecycle coverage plus a clean-tarball consumer
  matrix for the framework-free core, Svelte 5.7.0/current, ESM, CJS, and mixed
  entry loading.

### Fixed

- Destruction is terminal even when called from viewport or `canvaschange`
  callbacks; queued work cannot re-observe targets or repaint released nodes.
- Repeated watches and viewport subscriptions now have independent, idempotent
  ownership. Stale disposers and selector/manual overlap cannot release a newer
  owner, and listeners removed during dispatch are suppressed immediately.
- Throwing viewport listeners are reported without blocking sibling delivery or
  resource reconciliation.
- Destroying the shared watcher invalidates the singleton, and ESM/CJS entries
  share the same live watcher in one JavaScript realm.
- Viewport references are invalidated by boundary observation and relevant DOM
  changes, covering layout shifts that do not resize the reference itself.
- Mutation reconciliation is coalesced per frame, bulk viewport cleanup uses
  element reference counts, and unchanged trigger refreshes preserve observers.
- Invalid options and foreign-document registrations now fail before partially
  allocating resources.
- Viewport-first registration and rewatching now preserve overlap visibility
  when both APIs share the same element.
- Removing one reference's subscriptions no longer suppresses notifications
  for other references; subscriptions added during delivery initialize once.

### Removed

- **Breaking:** the Angular adapter (`@mzebley/canvas-watch/angular`), along with
  `CanvasWatchDirective`, `CanvasWatchService`, the `@angular/core` peer
  dependency, and the `ngc` build step. The core and the Svelte adapter remain
  available; an Angular consumer can register elements against
  `getSharedWatcher()` directly in a handful of lines, and the equivalent
  standalone directive is documented in the README and on the site under
  **Usage → Angular**. The adapter carried a whole partial-Ivy build pipeline for
  that, which was not a trade worth keeping.

This release removes the Angular entry point and raises the minimum
supported Svelte version to 5.7.

## [1.0.0] - 2026-07-31

First published release.

### Added

- `createCanvasWatcher(options?)` — the framework-agnostic core. Compares
  bounding rectangles to decide which background zone a floating element is
  sitting over, and reflects the answer as a class on that element.
  `IntersectionObserver` cannot answer this question, because it only compares a
  target against its scroll-ancestor or the viewport, never against an arbitrary
  sibling.
- Class convention: a `*-trigger` zone maps to an `over-*` class by stripping the
  suffix and adding the prefix, with `classMap` for explicit overrides.
- Majority-overlap resolution — the winning zone is the one covering the largest
  share of the watched element's *own* area, and only when that share clears
  `threshold` (default `0.5`). One `over-*` class is applied at a time.
- `canvaschange` CustomEvent carrying
  `{ appliedClass, previousClass }` (each `string | null`), for logic beyond CSS.
- Options: `watchSelector`, `triggerSelector`, `triggerSuffix`, `appliedPrefix`,
  `classMap`, `threshold`, `triggerRootMargin`.
- Watcher methods: `refresh()`, `watch(el)`, `schedule()`, `destroy()`.
- Pure exported helpers `overlapArea(a, b)` and
  `resolveAppliedClass(triggerClass, opts)`, plus `getSharedWatcher()` and
  `refreshCanvasWatch()`.
- Svelte adapter at `@mzebley/canvas-watch/svelte` — the `watchBgCanvas` action,
  with an `onChange` callback and automatic cleanup on destroy.
- Angular adapter at `@mzebley/canvas-watch/angular` — the standalone
  `CanvasWatchDirective` with a `(canvasChange)` output, and `CanvasWatchService`
  for re-scanning after router navigation.
- A single shared watcher behind both adapters, so one `requestAnimationFrame`
  loop drives every watched element on the page regardless of which framework
  mounted it. The Angular adapter reaches it through the package's own
  self-reference rather than a relative import, which would otherwise give
  Angular a second, invisible singleton.
- Per frame, each trigger rect is read once rather than once per watched element,
  and all class changes are applied together — one layout pass instead of a
  reflow per element. Classes are only touched when the winning zone actually
  changes, so scrolling within a zone costs zero DOM writes.
- SSR safety: `createCanvasWatcher` returns a no-op when `window` and `document`
  are absent, so callers never need to guard `typeof window`.
- Documentation site at
  [canvas-watch.markzebley.com](https://canvas-watch.markzebley.com), with a live
  demo and an adjustable-threshold playground.

[Unreleased]: https://github.com/mzebley/canvas-watch/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/mzebley/canvas-watch/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mzebley/canvas-watch/releases/tag/v1.0.0
