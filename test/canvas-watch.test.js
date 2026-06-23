/**
 * Unit tests for the pure, DOM-free pieces of the core: overlap geometry and the
 * trigger -> applied class convention. The DOM-driven watcher is exercised by
 * the demo (demo/index.html), not here.
 *
 * Imports the built bundle, so `npm test` builds the core first (see the test
 * script in package.json).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlapArea, resolveAppliedClass } from '../dist/index.js';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });

test('overlapArea: disjoint rects have zero overlap', () => {
	assert.equal(overlapArea(rect(0, 0, 10, 10), rect(20, 20, 30, 30)), 0);
});

test('overlapArea: edge-touching rects have zero overlap', () => {
	assert.equal(overlapArea(rect(0, 0, 10, 10), rect(10, 0, 20, 10)), 0);
});

test('overlapArea: partial overlap is the intersection area', () => {
	// x overlap [5,10] = 5, y overlap [5,10] = 5 -> 25
	assert.equal(overlapArea(rect(0, 0, 10, 10), rect(5, 5, 15, 15)), 25);
});

test('overlapArea: fully contained rect overlaps by its own area', () => {
	assert.equal(overlapArea(rect(0, 0, 100, 100), rect(10, 10, 30, 40)), 20 * 30);
});

test('overlapArea: is commutative', () => {
	const a = rect(0, 0, 10, 10);
	const b = rect(5, 5, 15, 15);
	assert.equal(overlapArea(a, b), overlapArea(b, a));
});

const convention = { triggerSuffix: '-trigger', appliedPrefix: 'over-' };

test('resolveAppliedClass: convention strips suffix and adds prefix', () => {
	assert.equal(
		resolveAppliedClass('canvas-brand-emphasis-trigger', convention),
		'over-canvas-brand-emphasis',
	);
});

test('resolveAppliedClass: non-trigger classes resolve to null', () => {
	assert.equal(resolveAppliedClass('card', convention), null);
	assert.equal(resolveAppliedClass('watch-bg-canvas', convention), null);
});

test('resolveAppliedClass: a bare suffix resolves to null (no base)', () => {
	assert.equal(resolveAppliedClass('-trigger', convention), null);
});

test('resolveAppliedClass: classMap overrides win over the convention', () => {
	const opts = { ...convention, classMap: { 'hero-trigger': 'on-hero' } };
	assert.equal(resolveAppliedClass('hero-trigger', opts), 'on-hero');
	// other triggers still follow the convention
	assert.equal(resolveAppliedClass('canvas-danger-trigger', opts), 'over-canvas-danger');
});

test('resolveAppliedClass: classMap can map a non-suffixed class', () => {
	const opts = { ...convention, classMap: { hero: 'on-hero' } };
	assert.equal(resolveAppliedClass('hero', opts), 'on-hero');
});

test('resolveAppliedClass: custom suffix/prefix is honored', () => {
	assert.equal(
		resolveAppliedClass('hero-zone', { triggerSuffix: '-zone', appliedPrefix: 'on-' }),
		'on-hero',
	);
});
