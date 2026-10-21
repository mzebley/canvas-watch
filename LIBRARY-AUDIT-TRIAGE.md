# Canvas Watch: library audit and triage

Audit date: 2026-09-04 · Base: `e54975f` plus the current local changes · Implementation: completed and reverified locally; not released

**Recommendation: keep this local until the remaining release-time checks are deliberately accepted or completed.** The functional, lifecycle, package, performance, and viewport-demo work in scope is verified below; broad visual regression and dependency-advisory scanning remain outside this pass.

## Implementation result

- F01–F08, E01–E03, C01–C06, and the three follow-up P2 findings are implemented without changing the public watcher method names.
- Durable coverage now includes DOM-level ownership/lifecycle/geometry fixtures, the exact follow-up interactions in real Chromium, Svelte SSR/hydration and repeated mount cycles, forced-GC retired-node checks, clean-tarball core/Svelte ESM/CJS consumers, and the production viewport demo.
- `npm run verify` passes: 49 tests, library declarations/bundles, the production site build and demo flow, Svelte 5.7.0 and 5.56.4 package consumers, package contents, and diff whitespace. The site build retains its pre-existing Svelte diagnostics.
- The minimum-version package consumer compiles and runs a tracked Svelte viewport reader through `within` → `below`; the version matrix is deduplicated when the installed Svelte version is already 5.7.0.
- `npm run profile:library` covers 10/100/1000 viewport references, dense same-class overlap, and bulk teardown with exact rect-read and retained-observer assertions.
- The Angular entry removal still requires the next published version to be a new major. No version, tag, or package was published by this implementation.
- Firefox/WebKit execution, manual heap-snapshot retaining-path inspection, dependency-advisory scanning, and a broader site visual regression remain release-time checks. Current browser evidence is Chromium plus explicit resource/WeakRef ownership assertions.

## Follow-up P2 findings resolved

| Finding | Resolution | Regression evidence |
| --- | --- | --- |
| Viewport-first registration prevented overlap tracking | The shared IntersectionObserver now records intersection state independently of the role that first retained an element. `watch()` and rewatch seed overlap visibility from that state without duplicate observer ownership. | DOM harness and Chromium: viewport observe → initial IO → watch → unwatch → rewatch remains overlap-active without exit/reentry |
| Removing A's listeners suppressed B's notification | Invalidating one registration breaks only that registration's listener loop. Destruction remains terminal for the whole delivery. | DOM harness and Chromium: A removes both A subscriptions; removed sibling stays silent and B still receives its committed notification |
| Subscription created during delivery initialized twice | Each subscription now tracks the registration version it has received. Both in-frame delivery and queued replay use the same gate and commit before consumer code. | DOM harness and Chromium: listener added to B from A's callback receives one `within` initial detail with `previousState: unknown` |

## Original verified findings, now fixed locally

P1 = release blocker; P2 = next corrective work; P3 = hardening or optimization after correctness.

| ID | Priority | Finding and reproduction | Location | Fix direction |
| --- | --- | --- | --- | --- |
| F01 | P1 | Adapter imports `createSubscriber` unconditionally, but supports Svelte `>=5`; the installed Svelte source marks this API as introduced in 5.7 | `src/svelte/index.ts:8`, `package.json:66` | Raise peer/dev minimum to 5.7 and verify both minimum and current supported versions |
| F02 | P1 | Destruction is not terminal: a viewport callback calling `destroy()` still permits another listener and reinstalls resize observation; a `canvaschange` callback destroying the watcher leaves a later element tinted; calling `watch()` after destruction also observes again | `src/core/canvas-watcher.ts:343`, `:545`, `:554`, `:706` | Guard public entry points and deliveries; commit internal bookkeeping before external callbacks; recheck liveness and ownership before each notification/write |
| F03 | P2 | Calling an old `unwatch()` twice can remove a newer registration of the same element; two watch owners are also collapsed into one Set entry | `src/core/canvas-watcher.ts:706` | Per-registration ownership tokens, idempotent disposers, and separate selector/manual ownership |
| F04 | P2 | A throwing viewport listener prevents its sibling from receiving initial state; another scheduled frame does not recover it because shared state already advanced | `src/core/canvas-watcher.ts:338` | Isolate listener exceptions, continue healthy deliveries, and report errors without swallowing them or aborting resource reconciliation |
| F05 | P2 | `getSharedWatcher().destroy(); getSharedWatcher()` returns the same dead watcher; new viewport subscriptions silently do nothing | `src/core/shared.ts:14` | Invalidate the cached singleton on destruction; reacquire a live instance and bind queued refreshes to the intended instance |
| F06 | P2 | CJS root and Svelte entries contain separate singleton instances; importing/registering through both creates four IntersectionObservers and two ResizeObservers instead of two and one | `tsup.config.ts:5`, `:9` | Share a canonical core implementation across CJS entries; retain ESM sharing and define mixed ESM/CJS behavior |
| F07 | P2 | Outer A covers 100%, middle B covers 60%, nested A covers 1%; at threshold 50%, A wins by borrowing its outer overlap and its inner depth | `src/core/canvas-watcher.ts:513` | Keep qualifying coverage and depth together; never promote a whole class from a subthreshold contribution |
| F08 | P2 | A sibling height change moves a reference from top 100 to top 1000 without resizing it; state stays `within` until manual `schedule()` produces `below` | `src/core/canvas-watcher.ts:395`, `:527`, `:698` | Define invalidation guarantees; cover supported layout shifts and expose/document explicit scheduling for motion that cannot be observed cheaply |

F02–F04 and F08 were reproduced in Chromium; F05–F06 were reproduced with isolated built bundles; F07 was reproduced in both a DOM harness and Chromium; F01 is supported by the local Svelte runtime's version annotation.

## Efficiency and ownership decisions, now implemented

| ID | Evidence or decision | Recommended treatment | Acceptance |
| --- | --- | --- | --- |
| E01 · P2 | 100 unrelated ID mutation deliveries caused 100 full-document declarative queries with an imperative-only subscriber | Inspect mutation records, mark dirty work, reconcile at most once per frame; retain late declarative discovery without blindly rescanning | Same batch: at most one reconciliation; initial declarative insertion, retargeting, removal, and missing-ID resolution still work |
| E02 · P3 | Every unsubscribe scans remaining viewport registrations and resize targets; removing N distinct references can do quadratic work | Maintain resolved-element reference counts and reconcile removals as a batch | Work proportional to removed registrations/affected elements; all shared resize owners preserved |
| E03 · P3 | Refresh tears down/recreates trigger observations and temporarily activates all triggers, including distant ones | Diff the trigger index; update classes/depth without reobserving unchanged targets; retain the existing no-flicker behavior | Unchanged refresh: no observer churn, no spurious class events; geometry still correct after insertion/reparenting |
| C01 · P2 | Svelte unmount leaves a disconnected trigger in the shared index until refresh; explicit refresh releases it | Define document-lifetime versus component-lifetime ownership; recommend idle release/rebuild for adapter-owned overlap work, preserving declarative/manual users | Last consumer removal leaves no retired DOM nodes in library-owned collections; remount restores trigger discovery |
| C02 · P2 | Two same-class rectangles covering the same 30% produce a qualifying 60% sum | Decide whether threshold means physical coverage or additive contributions; recommend physical coverage with depth-qualified candidates | Nested and same-depth duplicate rectangles cannot turn 30% actual coverage into 50% coverage; adjacent same-class zones still combine as specified |
| C03 · P2 | Duplicate viewport subscriptions with the same callback collapse in a Set; stopping one stops both; a listener removed during dispatch still fires from the snapshot | Prefer independent subscription tokens and immediate suppression of removed listeners | Stop one owner without affecting another; removed listeners receive no later call in the same delivery |
| C04 · P3 | `canvasWatch` only subscribes through a Svelte tracking context; imperative-only reads remain `unknown`, and reads after tracking stops can be stale | Document tracked usage and direct callers to `observeViewport`; avoid an eager subscription without an explicit owner | Template/effect reads reactive; untracked behavior documented; no orphan subscription from a standalone getter |
| C05 · P3 | Invalid numeric options and multi-token class mappings have no normalization/validation contract | Validate finite threshold in [0,1], supported margin values, selectors, suffixes, and single class tokens before registration | Predictable actionable errors; failed calls leave no new resources or partially applied classes |
| C06 · P3 | Hidden/zero-size references, scroll clipping, visual versus layout viewport, foreign documents/shadow roots, class ownership, and SSR-to-DOM reuse need explicit boundaries | Document supported geometry and lifecycle semantics; recommend same-document references and layout-viewport classification initially | Focused examples/tests for supported boundaries; no implication of occlusion or pixel-based visibility |

Let `V` be visible watched elements, `T` active triggers, `C` the average resolved classes per trigger, and `R` viewport registrations. Rect reads remain `O(V + T + unique resolved viewport elements)` per frame. CPU work is approximately `O(V × T × C × log(T × C) + R)` in the dense worst case: each watched element collects trigger intersections, then unions each class/depth rectangle bucket with an `O(n log n)` sweep line. The previous slab scan made union itself `O(n² log n)` in the worst case and has been replaced. Visibility gates, passive scroll handling, unique rectangle caching, and one scheduled measurement per frame remain important bounds.

## Implemented sequence

| Order | Deliverable | Scope and dependencies | Done when |
| --- | --- | --- | --- |
| 1 | Functional contract and regression fixtures | Resolve C02/C03/C06; encode current failures without changing public spellings unnecessarily | Expected coverage, ownership, destruction, error reporting, and invalidation behavior agreed in concise API docs and tests |
| 2 | Terminal lifecycle and safe notifications | F02–F04, C03; separate state/resource commit from user delivery; guard stale observer callbacks and stale frame decisions | Destroy/unsubscribe during any callback cannot resurrect targets, repaint released elements, or deliver to removed listeners; disposer calls idempotent |
| 3 | Shared ownership and package compatibility | F01, F05–F06, C01; dependencies from step 2 | One live core per supported package-loading mode; destroy/reacquire works; minimum Svelte works; last-owner cleanup releases retired nodes |
| 4 | Geometry and viewport correctness | F07–F08, C02/C04/C06 | Nested thresholds, repeated classes, boundary positions, missing/late/replaced IDs, and supported layout shifts match documented behavior |
| 5 | Measured efficiency and input hardening | E01–E03, C05; profile only after lifecycle/geometry settle | Coalesced mutation work, linear bulk cleanup, unchanged-refresh stability, validated options, and no functional regressions |
| 6 | Release verification | All prior steps; treat Angular entry removal as a breaking release change | Package/version/docs aligned; supported runtime matrix, browser fixtures, churn checks, and package-consumer smoke tests pass |

Keep the public core/Svelte separation; introduce small internal ownership and delivery helpers where needed rather than a framework rewrite.

## Required invariants and essential tests

| Area | Durable acceptance test |
| --- | --- |
| Terminal destruction | All observers disconnected, no owned nodes/classes, no pending frames; every later public call, queued observer delivery, or queued replay stays inert |
| Independent ownership | Repeated watches/subscriptions, selector plus manual registration, stale/double disposers, same callback twice, and shared resize targets do not interfere |
| Reentrant delivery | Listener self-unsubscribe, removing another listener, destroying, refreshing, and registering during callbacks; throwing consumers isolated; no stale frame writes |
| Core geometry | DOM-level IO delivery and nested/duplicate trigger fixtures, threshold boundaries, trigger removal/reparenting, offscreen clearing, one rect read per unique element per frame |
| Viewport state | Native ID/direct element, initial state, late insertion, replacement, disconnection, declarative retargeting, vertical edges, and supported layout invalidation |
| Svelte lifecycle | Compiled template/effect, action parameter updates, multiple readers, conditional readers, unmount/remount, SSR render/hydration, and shared reset |
| Packaging | Clean tarball consumer using public exports; ESM, CJS, supported mixed loading, SSR without DOM, core without Svelte, and minimum/current Svelte |
| Efficiency | Mutation batches, unchanged refresh, and large teardown; count work before imposing timing budgets; profile 10/100/1000 references against small/large trigger sets |
| Retention | Warm up, then repeated mount/unmount/route replacement/missing-reference cycles; drain deliveries, dispose and release test handles, force GC in the test browser, compare heap retaining paths |

Retain meaningful cases in the existing core tests plus a small browser/consumer suite; temporary diagnosis scripts and documentation-format tests do not belong in the shipped regression suite.

## Memory acceptance

“Memory-leak proof” means demonstrable ownership guarantees for supported lifecycles, not a universal claim about every browser, caller, or retained cleanup closure.

- No retired element retained by Canvas Watch after its last owner releases it and pending deliveries settle
- No reattachment after `destroy()`, including from callback reentrancy or queued observer delivery
- No growing detached-node, subscriber, observer-target, or pending-frame counts across repeated cycles
- Heap snapshots identify retaining paths, separating library roots from caller-held references, DevTools, and test instrumentation
- Document-lifetime singleton/listener costs explicitly bounded; no automatic disposal while a legitimate manual/declarative owner remains
- Compare post-GC baselines across multiple warmed-up batches; investigate sustained retained growth rather than treating total heap bytes as a deterministic assertion

## Verified completion evidence

| Check | Result |
| --- | --- |
| Core, declarations, and browser regressions | `npm test`: 49/49 passed, including six real-Chromium watcher cases and the exact three follow-up P2 interactions |
| Svelte lifecycle | Current installed Svelte: SSR render/hydration, tracked readers, action ownership, 25 repeated mount cycles, and forced-GC retired-node release passed |
| Packed minimum Svelte | Clean tarball installed with Svelte 5.7.0; a compiled tracked reader reported `within` then `below` in Chromium |
| Package loading and contents | 17-file tarball; core-only consumer; optional Svelte; ESM/CJS singleton sharing and destroy/reacquire passed; no Angular output |
| Production viewport demo | Built site passed `below` → `within` → `above` → `missing` → restored `above`; restored reference was present and no page errors occurred |
| Reference scaling | 10/100/1000 references read exactly 10/100/1000 rects per measured frame. Five-sample frame ranges were 0–0.1 ms, 0–0.2 ms, and 1.0 ms in the local headless-Chromium run. |
| Dense same-class overlap | 10/100/1000 triggers read exactly 11/101/1001 rects. Five-sample frame ranges were 0.1–0.3 ms, 0.5–1.8 ms, and 4.3–6.0 ms after the sweep-line change. |
| Bulk teardown | Every 10/100/1000 reference and dense-overlap teardown left zero observer targets; measured teardown calls were 0.1–1.4 ms locally. Timing is diagnostic, not a cross-device budget. |
| Full verification | `npm run verify` passed. The site build still reports existing Svelte diagnostics in `+page.svelte`, `CodeBlock.svelte`, `DemoStage.svelte`, and `Toc.svelte`. |

## Remaining limitations

- Firefox and WebKit have not run this suite.
- Forced-GC WeakRef checks passed, but retaining paths have not been manually inspected in heap snapshots.
- Dependency advisories and broad visual regression remain outside this pass.
- Performance timings are one local headless-Chromium sample set, not release budgets or cross-device guarantees. The repeatable script emphasizes work counts and zero retained observer targets.
- Layout changes that do not emit a supported invalidation signal still require the documented `schedule()` call.
- The Angular entry removal remains a breaking change for the next release; this work did not change the version, publish, tag, or commit.
