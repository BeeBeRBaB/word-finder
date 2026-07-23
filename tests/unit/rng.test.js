import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, resolveSeed, resolveThemeIndex } from '../../src/rng.js';

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

test('resolveThemeIndex clamps ?theme= into range', () => {
  const rng = makeRng(1);
  assert.equal(resolveThemeIndex('?theme=5', 100, rng), 5);
  assert.equal(resolveThemeIndex('?theme=999', 100, rng), 99);
  assert.equal(resolveThemeIndex('?theme=-4', 100, rng), 0);
});

test('resolveThemeIndex does not consume rng when ?theme= is explicit', () => {
  const rngA = makeRng(5), rngB = makeRng(5);
  resolveThemeIndex('?theme=3', 100, rngA);
  assert.equal(rngA.int(50), rngB.int(50), 'explicit ?theme= must not draw from rng');
});
