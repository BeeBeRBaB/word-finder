import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS_KEY, HISTORY_MAX, newProgress, normalizeProgress, levelSeed, levelCategory, levelSubject,
  recordLevel, saveCurrent, mergeProgress, makeLevelStore,
} from '../../src/levels.js';
import { CATEGORIES } from '../../src/catalog.js';
import { WORDS as NATURE } from '../../src/subjects/nature.js';
import { memStore } from './helpers.js';

const IDS = CATEGORIES.map(c => c.id);
const NATURE_IDS = Object.keys(NATURE);

/** @param {number} level @param {object} [over] */
const result = (level, over = {}) => ({
  level, subject: 'nature/birds', difficulty: 'normal', score: 100, ms: 60000, reveals: 0, at: 1700000000000, ...over,
});
/** @param {number} level @param {object} [over] */
const current = (level, over = {}) => ({
  level, subject: 'nature/birds', difficulty: 'hard', elapsedMs: 5000,
  events: [{ word: 'ROBIN', at: 1200, revealed: false }, { word: 'WREN', at: 3400, revealed: true }], ...over,
});
/** @param {object} over */
const progress = (over) => ({ ...newProgress(7), ...over });

test('a new account starts at level 1 with nothing banked', () => {
  assert.deepEqual(newProgress(42), { v: 1, seed: 42, level: 1, points: 0, history: [], current: null });
  assert.equal(newProgress(-1).seed, 0xffffffff, 'the seed is a uint32');
  assert.equal(LEVELS_KEY, 'wordfinder-levels-v1');
});

test('a level deals the same thing on every call', () => {
  for (const seed of [0, 1, 12345, 0xffffffff]) {
    for (const level of [1, 2, 26, 999]) {
      assert.equal(levelSeed(seed, level), levelSeed(seed, level));
      assert.equal(levelCategory(seed, level, IDS), levelCategory(seed, level, [...IDS]));
      assert.equal(levelSubject(seed, level, 'nature', NATURE_IDS, IDS.length),
        levelSubject(seed, level, 'nature', [...NATURE_IDS], IDS.length));
    }
  }
});

// Pinned: a change to any hash or shuffle here silently re-deals every existing account.
// Literal lists, so adding a subject or category to the content does not trip it.
test('the deal for a known account is pinned', () => {
  assert.deepEqual([1, 2, 3, 100000].map(n => levelSeed(12345, n)), [2899053611, 641106332, 1921154378, 2940798295]);
  const cats = ['a', 'b', 'c', 'd', 'e', 'f', 'g'], subs = ['s/1', 's/2', 's/3', 's/4', 's/5'];
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => levelCategory(12345, i + 1, cats)),
    ['a', 'g', 'd', 'e', 'c', 'f', 'b', 'c', 'b']);
  assert.deepEqual(Array.from({ length: 6 }, (_, v) => levelSubject(12345, v * 7 + 1, 'c', subs, 7)),
    ['s/2', 's/3', 's/4', 's/5', 's/1', 's/5']);
});

// One account misses rare branches (dropping the cycle-0 guard leaves 12345's deal as is),
// so also pin a checksum of 200 accounts' first 30 levels.
test('the deal across many accounts is pinned', () => {
  const cats = ['a', 'b', 'c', 'd', 'e', 'f', 'g'], subs = ['s/1', 's/2', 's/3', 's/4', 's/5'];
  let h = 0x811c9dc5;
  const eat = (/** @type {string} */ s) => { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); };
  for (let seed = 0; seed < 200; seed++) {
    for (let level = 1; level <= 30; level++) {
      const c = levelCategory(seed, level, cats);
      eat(`${c}${levelSubject(seed, level, c, subs, cats.length)}${levelSeed(seed, level)};`);
    }
  }
  assert.equal(h >>> 0, 3481867511);
});

test('the listing order of the ids does not change the deal', () => {
  const reversed = [...IDS].reverse(), subs = [...NATURE_IDS].reverse();
  for (let level = 1; level <= 80; level++) {
    assert.equal(levelCategory(9, level, reversed), levelCategory(9, level, IDS));
    assert.equal(levelSubject(9, level, 'nature', subs, 25), levelSubject(9, level, 'nature', NATURE_IDS, 25));
  }
});

test('levelSeed never collides across levels 1..100k, and differs across accounts', () => {
  for (const seed of [0, 1, 12345, 0xdeadbeef]) {
    const seen = new Set();
    for (let level = 1; level <= 100000; level++) {
      const s = levelSeed(seed, level);
      assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff, `not a uint32: ${s}`);
      seen.add(s);
    }
    assert.equal(seen.size, 100000, `seed ${seed} collided`);
  }
  assert.notEqual(levelSeed(1, 1), levelSeed(2, 1));
  // Spread, not just distinctness: consecutive levels should not sit next to each other.
  let close = 0;
  for (let level = 1; level < 1000; level++) if (Math.abs(levelSeed(5, level + 1) - levelSeed(5, level)) < 1 << 16) close++;
  assert.ok(close < 5, `${close} adjacent levels landed within 65536 of each other`);
});

test('every category comes up exactly once per cycle', () => {
  for (const ids of [IDS, ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e'], ['a', 'b']]) {
    const n = ids.length;
    for (let seed = 0; seed < 40; seed++) {
      for (let cycle = 0; cycle < 12; cycle++) {
        const got = Array.from({ length: n }, (_, i) => levelCategory(seed, cycle * n + i + 1, ids));
        assert.deepEqual(got.sort(), [...ids].sort(), `seed ${seed} cycle ${cycle}`);
      }
    }
  }
});

test('cycles are shuffled per cycle, not one order repeated', () => {
  let differs = 0;
  for (let seed = 0; seed < 20; seed++) {
    const first = Array.from({ length: 25 }, (_, i) => levelCategory(seed, i + 1, IDS)).join();
    const second = Array.from({ length: 25 }, (_, i) => levelCategory(seed, 25 + i + 1, IDS)).join();
    if (first !== second) differs++;
  }
  assert.equal(differs, 20);
});

test('no category repeats back to back across a cycle boundary', () => {
  for (let seed = 0; seed < 10000; seed++) {
    for (const boundary of [25, 50]) {
      assert.notEqual(levelCategory(seed, boundary, IDS), levelCategory(seed, boundary + 1, IDS),
        `seed ${seed}, levels ${boundary}/${boundary + 1}`);
    }
  }
  // Three is the smallest list where the swap can fire; two has exactly one safe order.
  for (const ids of [['a', 'b', 'c'], ['x', 'y']]) {
    for (let seed = 0; seed < 500; seed++) {
      for (let level = 1; level < 40; level++) {
        assert.notEqual(levelCategory(seed, level, ids), levelCategory(seed, level + 1, ids), `${ids} seed ${seed} level ${level}`);
      }
    }
  }
  assert.equal(levelCategory(3, 7, ['only']), 'only');
});

test('no subject repeats within a category until every one has been dealt', () => {
  const m = NATURE_IDS.length;
  let reordered = 0;
  for (let seed = 0; seed < 200; seed++) {
    const rounds = [0, 1, 2].map(round => Array.from({ length: m },
      (_, i) => levelSubject(seed, (round * m + i) * 25 + 1, 'nature', NATURE_IDS, 25)));
    for (const r of rounds) assert.deepEqual([...r].sort(), [...NATURE_IDS].sort(), `seed ${seed}`);
    if (rounds[0].join() !== rounds[1].join()) reordered++;
  }
  assert.equal(reordered, 200, 'each round is shuffled afresh');
});

test('a level asks for its subject on the category visit it actually is', () => {
  // Walk real levels: the k-th time 'nature' comes up must be its k-th subject.
  for (const seed of [4, 77]) {
    const dealt = [];
    for (let level = 1; dealt.length < NATURE_IDS.length; level++) {
      if (levelCategory(seed, level, IDS) === 'nature') dealt.push(levelSubject(seed, level, 'nature', NATURE_IDS, IDS.length));
    }
    assert.equal(new Set(dealt).size, NATURE_IDS.length, `seed ${seed} repeated a subject`);
  }
});

test('categories and accounts get their own subject orders', () => {
  const subs = ['s/a', 's/b', 's/c', 's/d', 's/e', 's/f', 's/g', 's/h'];
  const order = (/** @type {number} */ seed, /** @type {string} */ cat) =>
    Array.from({ length: 8 }, (_, v) => levelSubject(seed, v * 25 + 1, cat, subs, 25)).join();
  assert.notEqual(order(1, 'nature'), order(1, 'food'));
  assert.notEqual(order(1, 'nature'), order(2, 'nature'));
});

test('bad arguments throw instead of dealing undefined', () => {
  for (const level of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => levelCategory(1, level, IDS), RangeError);
    assert.throws(() => levelSubject(1, level, 'nature', NATURE_IDS, 25), RangeError);
  }
  assert.throws(() => levelCategory(1, 1, []), RangeError);
  assert.throws(() => levelSubject(1, 1, 'nature', [], 25), RangeError);
  assert.throws(() => levelSubject(1, 1, 'nature', NATURE_IDS, 0), RangeError);
  assert.throws(() => levelSubject(1, 1, 'nature', NATURE_IDS, 2.5), RangeError);
});

test('normalize rejects anything that is not a v1 record with a uint32 seed', () => {
  for (const raw of [null, undefined, 'x', 42, [], [newProgress(1)], {}, { v: 1 }, { v: 2, seed: 1 },
    { seed: 1 }, { v: 1, seed: -1 }, { v: 1, seed: 1.5 }, { v: 1, seed: 2 ** 32 }, { v: 1, seed: '5' },
    Object.assign([], { v: 1, seed: 1 })]) {
    assert.equal(normalizeProgress(raw), null, JSON.stringify(raw));
  }
  assert.deepEqual(normalizeProgress({ v: 1, seed: 0xffffffff }), newProgress(0xffffffff), 'the rest defaults');
  assert.deepEqual(normalizeProgress(newProgress(0)), newProgress(0), 'zero is a seed');
});

test('normalize clamps level and points to integers in range', () => {
  const cases = [[0, 1], [-4, 1], [2.9, 2], ['7', 1], [Infinity, 1], [null, 1], [12, 12]];
  for (const [raw, want] of cases) assert.equal(normalizeProgress({ v: 1, seed: 1, level: raw })?.level, want, `level ${raw}`);
  const pts = [[-3, 0], [4.9, 4], ['9', 0], [-Infinity, 0], [250, 250]];
  for (const [raw, want] of pts) assert.equal(normalizeProgress({ v: 1, seed: 1, points: raw })?.points, want, `points ${raw}`);
});

test('normalize drops each bad history entry on its own and keeps the last 50', () => {
  const bad = [
    null, 'x', [], result(0), result(1.5), result(1, { subject: '' }), result(1, { subject: 3 }),
    result(1, { difficulty: 'extreme' }), result(1, { score: '10' }), result(1, { score: Infinity }),
    result(1, { ms: -1 }), result(1, { reveals: -1 }), result(1, { reveals: 0.5 }), result(1, { at: -5 }),
    result(1, { at: undefined }), Object.assign([], result(1)),
  ];
  const p = normalizeProgress({ v: 1, seed: 1, level: 3, history: [result(1), ...bad, result(2, { score: -20 })] });
  assert.deepEqual(p?.history, [result(1), result(2, { score: -20 })]);
  assert.deepEqual(normalizeProgress({ v: 1, seed: 1, history: 'nope' })?.history, []);

  const many = Array.from({ length: 70 }, (_, i) => result(i + 1));
  const capped = normalizeProgress({ v: 1, seed: 1, level: 71, history: many });
  assert.equal(capped?.history.length, HISTORY_MAX);
  assert.equal(capped?.history[0].level, 21, 'the oldest are the ones dropped');
  const strays = normalizeProgress({ v: 1, seed: 1, history: [{ ...result(1), extra: 'x' }] });
  assert.equal(/** @type {any} */ (strays?.history[0]).extra, undefined, 'unknown fields are not carried');
});

test('normalize drops an invalid or stale current, whole', () => {
  const ok = normalizeProgress({ v: 1, seed: 1, level: 4, current: current(4) });
  assert.deepEqual(ok?.current, current(4), 'no size, as builds before it was kept wrote');
  for (const size of [10, 13]) {
    assert.deepEqual(normalizeProgress({ v: 1, seed: 1, level: 4, current: current(4, { size }) })?.current, current(4, { size }));
  }
  const bad = [
    'x', current(3), current(5), current(4, { subject: '' }), current(4, { difficulty: 'x' }),
    current(4, { elapsedMs: -1 }), current(4, { events: 'x' }), current(4, { level: 0 }),
    current(4, { size: 0 }), current(4, { size: 10.5 }), current(4, { size: '10' }), current(4, { size: null }), current(4, { size: 7 }),
    current(4, { events: [{ word: 'A', at: 1, revealed: false }, null] }),
    current(4, { events: [{ word: '', at: 1, revealed: false }] }),
    current(4, { events: [{ word: 'A', at: -1, revealed: false }] }),
    current(4, { events: [{ word: 'A', at: 1, revealed: 'no' }] }), Object.assign([], current(4)),
  ];
  for (const c of bad) assert.equal(normalizeProgress({ v: 1, seed: 1, level: 4, current: c })?.current, null, JSON.stringify(c));
});

test('normalize returns a copy, not the record it was handed', () => {
  const raw = { v: 1, seed: 1, level: 2, points: 5, history: [result(1)], current: current(2), extra: true };
  const p = normalizeProgress(raw);
  assert.equal(/** @type {any} */ (p).extra, undefined);
  assert.notEqual(p?.history, raw.history);
  assert.notEqual(p?.history[0], raw.history[0]);
  assert.notEqual(p?.current, raw.current);
  assert.notEqual(p?.current?.events[0], raw.current.events[0]);
});

test('recordLevel banks the current level and moves on', () => {
  const p = progress({ level: 3, points: 40, history: [result(1), result(2)], current: current(3) });
  const before = structuredClone(p);
  const next = recordLevel(p, result(3, { score: 25 }));
  assert.deepEqual(p, before, 'the input is untouched');
  assert.equal(next.level, 4);
  assert.equal(next.points, 65);
  assert.deepEqual(next.history.map(h => h.level), [1, 2, 3]);
  assert.equal(next.current, null);
  assert.equal(next.seed, p.seed);
});

test('recordLevel ignores a stale, duplicate, future or malformed result', () => {
  const p = progress({ level: 3, points: 40 });
  assert.equal(recordLevel(p, result(2)), p, 'stale');
  assert.equal(recordLevel(p, result(4)), p, 'future');
  assert.equal(recordLevel(p, result(3, { score: NaN })), p, 'malformed');
  const once = recordLevel(p, result(3));
  assert.equal(recordLevel(once, result(3)), once, 'a duplicate delivery counts once');
});

test('recordLevel floors points at zero and caps history', () => {
  const p = progress({ level: 2, points: 10 });
  assert.equal(recordLevel(p, result(2, { score: -30 })).points, 0);
  assert.equal(recordLevel(p, result(2, { score: 2.7 })).points, 12);
  const full = progress({ level: 51, history: Array.from({ length: 50 }, (_, i) => result(i + 1)) });
  const next = recordLevel(full, result(51));
  assert.equal(next.history.length, HISTORY_MAX);
  assert.equal(next.history[0].level, 2);
  assert.equal(next.history[49].level, 51);
});

test('saveCurrent keeps only a valid current for this level', () => {
  const p = progress({ level: 5 });
  const before = structuredClone(p);
  const saved = saveCurrent(p, current(5));
  assert.deepEqual(saved.current, current(5));
  assert.deepEqual(p, before, 'the input is untouched');
  assert.equal(saveCurrent(p, current(4)), p);
  assert.equal(saveCurrent(p, current(5, { events: [{ word: 'A' }] })), p);
  assert.deepEqual(saveCurrent(saved, current(5, { events: [] })).current?.events, []);
});

test('zero is a valid time: a level saved the instant it starts, or won in 0ms, is kept', () => {
  const start = current(1, { elapsedMs: 0, events: [{ word: 'OAK', at: 0, revealed: false }] });
  const p = saveCurrent(newProgress(3), start);
  assert.deepEqual(p.current, start);
  assert.deepEqual(normalizeProgress(p)?.current, start);
  const r = result(1, { ms: 0, at: 0, score: 0 });
  assert.deepEqual(recordLevel(p, r).history, [r]);
});

test('merge with a null or garbage side takes the other', () => {
  const a = progress({ level: 3 });
  assert.equal(mergeProgress(null, null), null);
  assert.equal(mergeProgress('junk', { v: 9 }), null);
  assert.deepEqual(mergeProgress(a, null), a);
  assert.deepEqual(mergeProgress(null, a), a);
  assert.deepEqual(mergeProgress(a, { v: 1, seed: 'bad', level: 99 }), a);
  assert.notEqual(mergeProgress(a, null), a, 'a copy, never the input');
});

test('merge across different seeds takes the remote: the account seed wins', () => {
  const local = { ...newProgress(1), level: 90, points: 9000 };
  const remote = newProgress(2);
  assert.deepEqual(mergeProgress(local, remote), remote);
});

test('merge on one seed: level, then points, then the smaller board, then events, then remote', () => {
  const tag = (/** @type {string} */ s) => [result(1, { subject: s })];
  const pairs = [
    [progress({ level: 5, history: tag('l') }), progress({ level: 4, points: 999, history: tag('r') })],
    [progress({ level: 4, points: 50, history: tag('l') }), progress({ level: 4, points: 49, history: tag('r') })],
    [progress({ level: 4, current: current(4), history: tag('l') }),
      progress({ level: 4, current: current(4, { events: [{ word: 'OAK', at: 1, revealed: false }] }), history: tag('r') })],
    [progress({ level: 4, current: current(4, { events: [{ word: 'OAK', at: 1, revealed: false }] }), history: tag('l') }),
      progress({ level: 4, current: null, history: tag('r') })],
    // The smaller board's game wins over more finds on a larger one; a size not said is no rule.
    [progress({ level: 4, current: current(4, { size: 10, events: [] }), history: tag('l') }),
      progress({ level: 4, current: current(4, { size: 13 }), history: tag('r') })],
    [progress({ level: 4, points: 50, current: current(4, { size: 13 }), history: tag('l') }),
      progress({ level: 4, points: 49, current: current(4, { size: 10 }), history: tag('r') })],
    [progress({ level: 4, current: current(4, { size: 13 }), history: tag('l') }),
      progress({ level: 4, current: current(4, { events: [] }), history: tag('r') })],
    [progress({ level: 4, current: current(4), history: tag('l') }),
      progress({ level: 4, current: current(4, { size: 10, events: [] }), history: tag('r') })],
  ];
  for (const [winner, loser] of pairs) {
    assert.equal(mergeProgress(winner, loser)?.history[0].subject, 'l', 'as local');
    assert.equal(mergeProgress(loser, winner)?.history[0].subject, 'l', 'as remote');
  }
  const same = progress({ level: 4, points: 3 });
  assert.equal(mergeProgress({ ...same, history: tag('l') }, { ...same, history: tag('r') })?.history[0].subject, 'r', 'a full tie goes remote');
});

test('the store round-trips a record and forgets it on clear', () => {
  const store = memStore();
  const s = makeLevelStore({ store });
  assert.equal(s.load(), null, 'nothing saved yet');
  const p = saveCurrent(recordLevel(progress({ level: 1 }), result(1)), current(2));
  s.save(p);
  assert.deepEqual(makeLevelStore({ store }).load(), p);
  s.save(/** @type {any} */ ({ v: 1, seed: 'bad' }));
  assert.deepEqual(s.load(), p, 'an invalid record is not written over a good one');
  s.clear();
  assert.equal(store.getItem(LEVELS_KEY), null);
  assert.equal(s.load(), null);
});

test('a missing, throwing or garbled store degrades to null and never throws', () => {
  const garbled = memStore(); garbled.setItem(LEVELS_KEY, '{not json');
  assert.equal(makeLevelStore({ store: garbled }).load(), null);
  const wrong = memStore(); wrong.setItem(LEVELS_KEY, JSON.stringify({ v: 1, seed: -3 }));
  assert.equal(makeLevelStore({ store: wrong }).load(), null);
  const boom = () => { throw new Error('blocked'); };
  for (const s of [makeLevelStore({ store: { getItem: boom, setItem: boom, removeItem: boom } }),
    makeLevelStore({ store: null }), makeLevelStore()]) {
    assert.equal(s.load(), null);
    assert.doesNotThrow(() => s.save(newProgress(1)));
    assert.doesNotThrow(() => s.clear());
  }
});
