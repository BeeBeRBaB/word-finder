import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, resolveSeed, resolveTarget } from '../../src/rng.js';

test('the same seed reproduces the same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  const seqA = Array.from({ length: 20 }, () => a.random());
  const seqB = Array.from({ length: 20 }, () => b.random());
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  assert.notEqual(a.random(), b.random());
});

test('random() stays in [0,1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.random();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('shuffle keeps every element and does not mutate the input', () => {
  const r = makeRng(3);
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = r.shuffle(input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(out.slice().sort((x, y) => x - y), input);
});

test('resolveSeed honours ?seed= and falls back to the clock', () => {
  assert.equal(resolveSeed('?seed=99'), 99);
  assert.equal(resolveSeed('?seed=abc'), 0);
  assert.ok(resolveSeed('') > 0);
});

const CATS = [
  { id: 'nature', name: 'Nature' },
  { id: 'food', name: 'Food & Drink' },
];

test('resolveTarget honours an explicit ?subject=', () => {
  assert.deepEqual(
    resolveTarget('?subject=food/candy', CATS, makeRng(1)),
    { subject: 'food/candy', category: 'food' },
  );
});

test('resolveTarget honours an explicit ?category=', () => {
  assert.deepEqual(
    resolveTarget('?category=food', CATS, makeRng(1)),
    { subject: null, category: 'food' },
  );
});

test('resolveTarget draws a category at random when neither is given', () => {
  const r = resolveTarget('', CATS, makeRng(1));
  assert.equal(r.subject, null);
  assert.ok(CATS.some(c => c.id === r.category), `got ${r.category}`);
});

// The asymmetry is not decoration. If pinning consumed a draw, the same ?seed=
// would deal a different grid with and without the parameter, and the determinism
// the e2e suite rests on would quietly stop holding.
test('an explicit ?subject= does not consume rng', () => {
  const a = makeRng(5), b = makeRng(5);
  resolveTarget('?subject=food/candy', CATS, a);
  assert.equal(a.int(50), b.int(50));
});

test('an explicit ?category= does not consume rng', () => {
  const a = makeRng(5), b = makeRng(5);
  resolveTarget('?category=food', CATS, a);
  assert.equal(a.int(50), b.int(50));
});

test('an unknown ?subject= falls back to a random category rather than throwing', () => {
  const r = resolveTarget('?subject=nope/nope', CATS, makeRng(1));
  assert.equal(r.subject, null);
  assert.ok(CATS.some(c => c.id === r.category), `got ${r.category}`);
});

test('an unknown ?category= falls back to a random category rather than throwing', () => {
  const r = resolveTarget('?category=nope', CATS, makeRng(1));
  assert.equal(r.subject, null);
  assert.ok(CATS.some(c => c.id === r.category), `got ${r.category}`);
});

// ?topic=N was the old parameter and is deliberately NOT aliased: indices no longer
// identify anything stable, so honouring one would silently deal the wrong subject.
test('the retired ?topic= parameter is ignored, not honoured', () => {
  assert.deepEqual(
    resolveTarget('?topic=0', CATS, makeRng(1)),
    resolveTarget('', CATS, makeRng(1)),
  );
});
