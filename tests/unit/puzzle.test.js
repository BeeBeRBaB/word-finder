import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPuzzle, pickWords, snap, readLine, matchWord, runKey, cap } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';

const FULL_MIX = [
  { min: 3, max: 5, take: 3 },
  { min: 6, max: 8, take: 5 },
  { min: 9, max: 12, take: 4 },
];

/** A synthetic pool with plenty in every bucket. Deliberately not real content:
 * this module must not know what a subject is, and a test that reached for one
 * would quietly reintroduce that coupling. */
const POOL = [
  'ANT', 'BEE', 'COW', 'DOE', 'ELK', 'FOX', 'GNU', 'HEN',
  'CROW', 'DEER', 'FROG', 'GOAT', 'IBIS', 'LARK', 'MOLE', 'NEWT',
  'BISON', 'CAMEL', 'EAGLE', 'GOOSE', 'HORSE', 'KOALA', 'LEMUR', 'MOOSE',
  'BADGER', 'BEAVER', 'CONDOR', 'DONKEY', 'FALCON', 'GERBIL', 'IGUANA', 'JAGUAR',
  'BUZZARD', 'CHEETAH', 'DOLPHIN', 'GAZELLE', 'GIRAFFE', 'LEOPARD', 'MEERKAT', 'OCTOPUS',
  'ANTELOPE', 'FLAMINGO', 'HEDGEHOG', 'KANGAROO', 'MARMOSET', 'PHEASANT', 'REINDEER', 'SQUIRREL',
  'ALLIGATOR', 'BUTTERFLY', 'CORMORANT', 'CROCODILE', 'PORCUPINE', 'RATTLESNAKE', 'WOODPECKER', 'HUMMINGBIRD',
];

const build = (seed, opts = {}) => buildPuzzle({
  name: 'Test', pool: POOL, rng: makeRng(seed),
  size: 13, count: 12, mix: FULL_MIX, ...opts,
});

test('pickWords draws exactly the requested number from each length bucket', () => {
  const words = pickWords(POOL, makeRng(7), { count: 12, mix: FULL_MIX });
  assert.equal(words.length, 12);
  const inBucket = (b) => words.filter(w => w.length >= b.min && w.length <= b.max).length;
  assert.equal(inBucket(FULL_MIX[0]), 3, 'short bucket');
  assert.equal(inBucket(FULL_MIX[1]), 5, 'medium bucket');
  assert.equal(inBucket(FULL_MIX[2]), 4, 'long bucket');
});

test('pickWords never repeats a word', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const words = pickWords(POOL, makeRng(seed), { count: 12, mix: FULL_MIX });
    assert.equal(new Set(words).size, 12, `seed ${seed} repeated a word`);
  }
});

test('pickWords varies its draw across seeds', () => {
  const a = pickWords(POOL, makeRng(1), { count: 12, mix: FULL_MIX }).join(',');
  const b = pickWords(POOL, makeRng(2), { count: 12, mix: FULL_MIX }).join(',');
  assert.notEqual(a, b, 'a 56-word pool must not produce one canonical draw');
});

// The whole point of a deep pool is that the same subject deals differently. This
// is the assertion that would catch a `slice(0, count)` creeping back in.
test('pickWords is deterministic for one seed', () => {
  const a = pickWords(POOL, makeRng(9), { count: 12, mix: FULL_MIX });
  const b = pickWords(POOL, makeRng(9), { count: 12, mix: FULL_MIX });
  assert.deepEqual(a, b);
});

test('pickWords backfills a short bucket rather than returning fewer words', () => {
  // Only two words in 9-12, but the mix asks for four.
  const thin = POOL.filter(w => w.length < 9).concat(['ALLIGATOR', 'BUTTERFLY']);
  const words = pickWords(thin, makeRng(3), { count: 12, mix: FULL_MIX });
  assert.equal(words.length, 12, 'must still return a full board');
  assert.equal(new Set(words).size, 12);
  assert.equal(words.filter(w => w.length >= 9).length, 2, 'takes what the bucket has');
});

test('pickWords throws when the pool cannot fill a board at all', () => {
  assert.throws(() => pickWords(['ANT', 'BEE'], makeRng(1), { count: 12, mix: FULL_MIX }), /pool/i);
});

test('buildPuzzle places every word it lists, at both presets', () => {
  const COMPACT_MIX = [
    { min: 3, max: 4, take: 2 },
    { min: 5, max: 6, take: 3 },
    { min: 7, max: 9, take: 3 },
  ];
  for (let seed = 1; seed <= 60; seed++) {
    for (const opts of [{}, { size: 10, count: 8, mix: COMPACT_MIX }]) {
      const p = build(seed, opts);
      const size = opts.size ?? 13, count = opts.count ?? 12;
      assert.equal(p.words.length, count, `seed ${seed} size ${size} dealt ${p.words.length}`);
      for (const { word, x0, y0, dx, dy } of p.placements) {
        let read = '';
        for (let i = 0; i < word.length; i++) read += p.cells[(y0 + dy * i) * size + (x0 + dx * i)];
        assert.equal(read, word, `seed ${seed} size ${size}: ${word} is not at its recorded position`);
      }
    }
  }
});

// The old buildPuzzle dropped a word that would not place after 400 attempts, so a
// board could quietly come up one word short and nothing said so. `words` is now
// exactly as long as `count` or buildPuzzle throws.
test('buildPuzzle never silently returns a short board', () => {
  for (let seed = 1; seed <= 60; seed++) assert.equal(build(seed).words.length, 12);
});

test('buildPuzzle respects the maximum word length for its grid size', () => {
  const p = build(5, { size: 10, count: 8, mix: [
    { min: 3, max: 4, take: 2 }, { min: 5, max: 6, take: 3 }, { min: 7, max: 9, take: 3 },
  ] });
  for (const w of p.words) assert.ok(w.length <= 9, `${w} is too long for a 10x10 grid`);
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

test('matchWord matches a placement, and nothing for an empty run', () => {
  // Replaces a string-based version of this test. matchWord no longer reads letters at
  // all -- see the cell-run tests below for why that had to change.
  const placements = [
    { word: 'CAT', x0: 0, y0: 0, dx: 1, dy: 0 },
    { word: 'DOG', x0: 0, y0: 2, dx: 1, dy: 0 },
  ];
  assert.equal(matchWord(placements, {}, 13, { x0: 0, y0: 0, x1: 2, y1: 0 }), 'CAT');
  assert.equal(matchWord(placements, {}, 13, { x0: 2, y0: 0, x1: 0, y1: 0 }), 'CAT');
  assert.equal(matchWord(placements, { CAT: true }, 13, { x0: 0, y0: 0, x1: 2, y1: 0 }), null);
  assert.equal(matchWord(placements, {}, 13, { x0: 5, y0: 5, x1: 7, y1: 5 }), null);
});

test('cap title-cases a word', () => {
  assert.equal(cap('SUNSHINE'), 'Sunshine');
});

// A word's letters also read where the word is NOT: inside a longer word, or by chance in
// the filler. Matching on letters alone marked it found at the wrong place, after which
// its real placement flashed as a miss. 581 of 600 subjects contain a word inside another
// of their own words, and 30% of dealt puzzles contain at least one such run.

test('a word is not matched at a run that is not its placement', () => {
  // HARDWOOD across the top row; WOOD placed on its own, five rows down.
  const placements = [
    { word: 'HARDWOOD', x0: 0, y0: 0, dx: 1, dy: 0 },
    { word: 'WOOD', x0: 0, y0: 5, dx: 1, dy: 0 },
  ];
  // Cells 4..7 of row 0 spell WOOD, but that is HARDWOOD's tail, not WOOD's placement.
  assert.equal(matchWord(placements, {}, 13, { x0: 4, y0: 0, x1: 7, y1: 0 }), null);
  assert.equal(matchWord(placements, {}, 13, { x0: 0, y0: 5, x1: 3, y1: 5 }), 'WOOD');
});

test('two words sharing cells are both findable, in either order', () => {
  // WOOD sits exactly on HARDWOOD's last four cells -- a legal overlap.
  const placements = [
    { word: 'HARDWOOD', x0: 0, y0: 0, dx: 1, dy: 0 },
    { word: 'WOOD', x0: 4, y0: 0, dx: 1, dy: 0 },
  ];
  /** @type {Record<string, boolean>} */
  const found = {};
  assert.equal(matchWord(placements, found, 13, { x0: 4, y0: 0, x1: 7, y1: 0 }), 'WOOD');
  found.WOOD = true;
  assert.equal(matchWord(placements, found, 13, { x0: 0, y0: 0, x1: 7, y1: 0 }), 'HARDWOOD',
    'finding the short word must not consume the long one');
});

test('a word dragged backwards is the same run as forwards', () => {
  const placements = [{ word: 'STAR', x0: 2, y0: 3, dx: 1, dy: 0 }];
  assert.equal(matchWord(placements, {}, 13, { x0: 2, y0: 3, x1: 5, y1: 3 }), 'STAR');
  assert.equal(matchWord(placements, {}, 13, { x0: 5, y0: 3, x1: 2, y1: 3 }), 'STAR');
});

test('a diagonal placement matches only its own run', () => {
  const placements = [{ word: 'CAT', x0: 0, y0: 0, dx: 1, dy: 1 }];
  assert.equal(matchWord(placements, {}, 13, { x0: 0, y0: 0, x1: 2, y1: 2 }), 'CAT');
  assert.equal(matchWord(placements, {}, 13, { x0: 0, y0: 0, x1: 2, y1: 0 }), null,
    'same start, same length, wrong direction');
});

test('an already-found word is skipped', () => {
  const placements = [{ word: 'CAT', x0: 0, y0: 0, dx: 1, dy: 0 }];
  assert.equal(matchWord(placements, { CAT: true }, 13, { x0: 0, y0: 0, x1: 2, y1: 0 }), null);
});

test('a one-cell selection matches nothing on a real board', () => {
  const placements = [{ word: 'CAT', x0: 0, y0: 0, dx: 1, dy: 0 }];
  assert.equal(matchWord(placements, {}, 13, { x0: 0, y0: 0, x1: 0, y1: 0 }), null);
});

test('runKey is direction-independent and distinguishes different runs', () => {
  assert.equal(runKey(13, { x0: 1, y0: 0, x1: 4, y1: 0 }), runKey(13, { x0: 4, y0: 0, x1: 1, y1: 0 }));
  assert.notEqual(runKey(13, { x0: 1, y0: 0, x1: 4, y1: 0 }), runKey(13, { x0: 1, y0: 0, x1: 4, y1: 3 }));
});

test('every placement in a real puzzle matches at its own run and nowhere else', () => {
  const p = build(6);
  for (const pl of p.placements) {
    const last = pl.word.length - 1;
    const sel = { x0: pl.x0, y0: pl.y0, x1: pl.x0 + pl.dx * last, y1: pl.y0 + pl.dy * last };
    assert.equal(matchWord(p.placements, {}, 13, sel), pl.word, `${pl.word} at its own run`);
  }
});

// The shuffle bag reaches puzzle.js as a plain Set, so the preference is testable with no
// storage and puzzle.js stays pure. Ordering rather than filtering is what keeps the
// bucket contract intact: a bag that cannot fill a bucket must not produce a short board.

const BAG_POOL = [
  'AAA', 'BBB', 'CCC', 'DDD', 'EEEE', 'FFFF', 'GGGG', 'HHHH',
  'IIIIII', 'JJJJJJ', 'KKKKKK', 'LLLLLL', 'MMMMMMM', 'NNNNNNN', 'OOOOOOO', 'PPPPPPP',
  'QQQQQQQQQ', 'RRRRRRRRR', 'SSSSSSSSS', 'TTTTTTTTT',
  'UUUUUUUUUU', 'VVVVVVVVVV', 'WWWWWWWWWW', 'XXXXXXXXXX',
];
const BAG_MIX = [
  { min: 3, max: 5, take: 2 }, { min: 6, max: 8, take: 2 }, { min: 9, max: 12, take: 2 },
];

test('pickWords draws only from undrawn while the buckets allow it', () => {
  // Every other word, so each bucket still has enough undrawn candidates to fill.
  const undrawn = new Set(BAG_POOL.filter((_, i) => i % 2 === 0));
  const got = pickWords(BAG_POOL, makeRng(1), { count: 6, mix: BAG_MIX, undrawn });
  assert.equal(got.length, 6);
  for (const w of got) assert.ok(undrawn.has(w), `${w} was already drawn and should not be reused`);
});

test('pickWords tops up from drawn words rather than returning a short list', () => {
  const pool = ['AAA', 'BBB', 'CCC', 'DDD', 'EEEE', 'FFFF', 'GGGG', 'HHHH'];
  const mix = [{ min: 3, max: 5, take: 4 }];
  const undrawn = new Set(['AAA']);      // one word, but the bucket needs four
  const got = pickWords(pool, makeRng(1), { count: 4, mix, undrawn });
  assert.equal(got.length, 4, 'the bucket must still be filled');
  assert.ok(got.includes('AAA'), 'the undrawn word is used first');
});

test('omitting undrawn reproduces the previous behaviour for a seed', () => {
  const a = pickWords(BAG_POOL, makeRng(7), { count: 6, mix: BAG_MIX });
  const b = pickWords(BAG_POOL, makeRng(7), { count: 6, mix: BAG_MIX, undrawn: undefined });
  assert.deepEqual(a, b, 'an absent bag must not change the draw');
});

test('an undrawn set holding the whole pool changes nothing', () => {
  assert.deepEqual(
    pickWords(BAG_POOL, makeRng(7), { count: 6, mix: BAG_MIX }),
    pickWords(BAG_POOL, makeRng(7), { count: 6, mix: BAG_MIX, undrawn: new Set(BAG_POOL) }),
  );
});

test('an empty undrawn set still deals a full board', () => {
  const got = pickWords(BAG_POOL, makeRng(3), { count: 6, mix: BAG_MIX, undrawn: new Set() });
  assert.equal(got.length, 6, 'an exhausted bag must not starve the board');
});

test('buildPuzzle threads undrawn through to the draw', () => {
  const undrawn = new Set(BAG_POOL.filter((_, i) => i % 2 === 0));
  const p = buildPuzzle({
    name: 'bag', pool: BAG_POOL, rng: makeRng(2), size: 13, count: 6, mix: BAG_MIX, undrawn,
  });
  for (const w of p.words) assert.ok(undrawn.has(w), `${w} should have come from the bag`);
});
