import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPuzzle, snap, readLine, matchWord, cap } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';
import { THEMES } from '../../src/themes.js';

const build = (seed, themeIdx = 0) =>
  buildPuzzle({ themes: THEMES, themeIdx, rng: makeRng(seed), size: 13, count: 12 });

test('every placed word is actually readable in the grid', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const p = build(seed, seed % THEMES.length);
    for (const { word, x0, y0, dx, dy } of p.placements) {
      let read = '';
      for (let i = 0; i < word.length; i++) read += p.cells[(y0 + dy * i) * 13 + (x0 + dx * i)];
      assert.equal(read, word, `seed ${seed}: ${word} is not at its recorded position`);
    }
  }
});

test('all 12 words place across every theme', () => {
  for (let i = 0; i < THEMES.length; i++) {
    const p = build(i + 1, i);
    assert.equal(p.words.length, 12, `theme ${THEMES[i][0]} placed ${p.words.length}`);
  }
});

test('the same seed produces an identical grid', () => {
  assert.deepEqual(build(123).cells, build(123).cells);
  assert.notDeepEqual(build(123).cells, build(124).cells);
});

test('the grid is fully populated with A-Z', () => {
  const p = build(9);
  assert.equal(p.cells.length, 169);
  assert.ok(p.cells.every(c => /^[A-Z]$/.test(c)));
});

// Regression for 5e2bbf6: a k-cell diagonal spans k*sqrt(2), so length must come
// from the projection onto the snapped direction, not the Euclidean distance.
test('a diagonal drag does not overshoot', () => {
  assert.deepEqual(snap(0, 0, 3, 3, 13), { x1: 3, y1: 3 });
  assert.deepEqual(snap(0, 0, 5, 5, 13), { x1: 5, y1: 5 });
  assert.deepEqual(snap(6, 6, 3, 3, 13), { x1: 3, y1: 3 });
});

test('snap covers all eight directions', () => {
  assert.deepEqual(snap(6, 6, 9, 6, 13), { x1: 9, y1: 6 });
  assert.deepEqual(snap(6, 6, 3, 6, 13), { x1: 3, y1: 6 });
  assert.deepEqual(snap(6, 6, 6, 9, 13), { x1: 6, y1: 9 });
  assert.deepEqual(snap(6, 6, 6, 3, 13), { x1: 6, y1: 3 });
  assert.deepEqual(snap(6, 6, 9, 3, 13), { x1: 9, y1: 3 });
  assert.deepEqual(snap(6, 6, 3, 9, 13), { x1: 3, y1: 9 });
});

test('snap clamps to the grid instead of running off the edge', () => {
  const r = snap(11, 11, 40, 40, 13);
  assert.ok(r.x1 <= 12 && r.y1 <= 12, `escaped the grid: ${JSON.stringify(r)}`);
  const l = snap(1, 1, -40, -40, 13);
  assert.ok(l.x1 >= 0 && l.y1 >= 0, `escaped the grid: ${JSON.stringify(l)}`);
});

test('a tap with no movement selects a single cell', () => {
  assert.deepEqual(snap(4, 4, 4.1, 4.1, 13), { x1: 4, y1: 4 });
});

test('readLine reads a selection in order', () => {
  const cells = Array.from({ length: 169 }, (_, i) => 'ABCDEFGHIJKLM'[i % 13]);
  assert.equal(readLine(cells, 13, { x0: 0, y0: 0, x1: 3, y1: 0 }), 'ABCD');
});

test('matchWord matches forwards and backwards, skipping found words', () => {
  const words = ['CAT', 'DOG'];
  assert.equal(matchWord(words, {}, 'CAT'), 'CAT');
  assert.equal(matchWord(words, {}, 'TAC'), 'CAT');
  assert.equal(matchWord(words, { CAT: true }, 'CAT'), null);
  assert.equal(matchWord(words, {}, 'XYZ'), null);
});

test('cap title-cases a word', () => {
  assert.equal(cap('SUNSHINE'), 'Sunshine');
});
