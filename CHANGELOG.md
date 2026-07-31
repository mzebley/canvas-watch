# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  demo, an adjustable-threshold playground, and an opt-in Angular app that shares
  the page's watcher with the Svelte header.

[Unreleased]: https://github.com/mzebley/canvas-watch/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mzebley/canvas-watch/releases/tag/v1.0.0
