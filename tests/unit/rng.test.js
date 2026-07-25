import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, resolveSeed, resolveSubject } from '../../src/rng.js';

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
  { id: 'nature', name: 'Nature', subjects: [
    { id: 'nature/birds', name: 'Birds' }, { id: 'nature/trees', name: 'Trees' }] },
  { id: 'food', name: 'Food & Drink', subjects: [
    { id: 'food/pizza', name: 'Pizza' }, { id: 'food/candy', name: 'Candy' }] },
];

test('resolveSubject honours an explicit ?subject=', () => {
  assert.equal(resolveSubject('?subject=food/candy', CATS, makeRng(1)), 'food/candy');
});

test('resolveSubject picks inside an explicit ?category=', () => {
  const id = resolveSubject('?category=food', CATS, makeRng(1));
  assert.ok(['food/pizza', 'food/candy'].includes(id), `got ${id}`);
});

test('resolveSubject picks from the whole catalog when neither is given', () => {
  const id = resolveSubject('', CATS, makeRng(1));
  assert.ok(CATS.flatMap(c => c.subjects).some(s => s.id === id), `got ${id}`);
});

// The asymmetry is not decoration. If pinning a subject drew from rng, the same
// ?seed= would deal a different grid with and without ?subject=, and the determinism
// the e2e suite rests on would quietly stop holding.
test('an explicit ?subject= does not consume rng', () => {
  const a = makeRng(5), b = makeRng(5);
  resolveSubject('?subject=food/candy', CATS, a);
  assert.equal(a.int(50), b.int(50));
});

test('an unknown ?subject= falls back to a random one rather than throwing', () => {
  const id = resolveSubject('?subject=nope/nope', CATS, makeRng(1));
  assert.ok(CATS.flatMap(c => c.subjects).some(s => s.id === id), `got ${id}`);
});

// ?topic=N was the old parameter and is deliberately NOT aliased: indices no longer
// identify anything stable, so honouring one would silently deal the wrong subject.
test('the retired ?topic= parameter is ignored, not honoured', () => {
  assert.equal(resolveSubject('?topic=0', CATS, makeRng(1)), resolveSubject('', CATS, makeRng(1)));
});
