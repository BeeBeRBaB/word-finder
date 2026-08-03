import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, parseProgress, chooseSubject, makeProgress } from '../../src/progress.js';
import { memStore } from './helpers.js';

const POOL = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH'];

test('an absent key yields a usable default record', () => {
  const p = parseProgress(null);
  assert.equal(p.puzzles, 0);
  assert.equal(p.favourLeastSeen, true);
  assert.deepEqual(p.bags, {});
  assert.deepEqual(p.sizes, {});
});

test('an unparseable blob yields defaults rather than throwing', () => {
  assert.equal(parseProgress('{not json').puzzles, 0);
  assert.equal(parseProgress('null').puzzles, 0);
  assert.equal(parseProgress('[]').puzzles, 0);
  assert.equal(parseProgress('"a string"').puzzles, 0);
});

test('validation is merge-tolerant: one bad field never costs the others', () => {
  const p = parseProgress(JSON.stringify({
    v: 1, puzzles: 'not a number', favourLeastSeen: 'yes',
    bags: { 'a/b': { n: 8, c: 1, d: 'AA==' } }, sizes: { a: 24 },
  }));
  assert.equal(p.puzzles, 0, 'the bad counter falls back');
  assert.equal(p.favourLeastSeen, true, 'the bad flag falls back');
  assert.deepEqual(p.sizes, { a: 24 }, 'the good fields survive');
  assert.equal(p.bags['a/b'].n, 8, 'the bag survives a bad sibling field');
});

test('an individual bad bag is dropped and the rest survive', () => {
  const p = parseProgress(JSON.stringify({
    v: 1, bags: {
      'good/one': { n: 8, c: 0, d: 'AA==' },
      'bad/n': { n: -3, c: 0, d: 'AA==' },
      'bad/zero': { n: 0, c: 0, d: 'AA==' },
      'bad/d': { n: 8, c: 0, d: 42 },
      'bad/c': { n: 8, c: 'x', d: 'AA==' },
      'bad/shape': 'not an object',
    },
  }));
  assert.ok(p.bags['good/one'], 'the valid bag survives');
  for (const k of ['bad/n', 'bad/zero', 'bad/d', 'bad/c', 'bad/shape']) {
    assert.equal(p.bags[k], undefined, `${k} should have been dropped`);
  }
});

test('a non-object bags or sizes field falls back without throwing', () => {
  assert.deepEqual(parseProgress(JSON.stringify({ bags: 'nope' })).bags, {});
  assert.deepEqual(parseProgress(JSON.stringify({ sizes: [1, 2] })).sizes, {});
  assert.deepEqual(parseProgress(JSON.stringify({ sizes: { a: -1, b: 'x', c: 3 } })).sizes, { c: 3 });
});

test('bagFor returns the whole pool when nothing is stored', () => {
  const p = makeProgress(memStore());
  assert.deepEqual([...p.bagFor('a/b', POOL)].sort(), [...POOL].sort());
});

test('noteDraw removes drawn words from the bag', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/b', POOL, ['AAA', 'BBB']);
  assert.deepEqual([...p.bagFor('a/b', POOL)].sort(), ['CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH']);
});

test('noteDraw ignores a word that is not in the pool', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/b', POOL, ['AAA', 'NOTINPOOL']);
  assert.equal(p.bagFor('a/b', POOL).size, POOL.length - 1);
});

test('emptying the bag increments the cycle and refills', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/b', POOL, POOL.slice(0, 4));
  assert.equal(p.coverage('a/b'), 0.5);
  p.noteDraw('a/b', POOL, POOL.slice(4));
  assert.equal(p.get().bags['a/b'].c, 1, 'a full pass increments the cycle');
  assert.equal(p.coverage('a/b'), 1, 'coverage is 1 once a cycle completes');
  assert.deepEqual([...p.bagFor('a/b', POOL)].sort(), [...POOL].sort(), 'the bag refilled');
});

test('pool drift discards only that subject bag', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/b', POOL, ['AAA', 'BBB']);
  p.noteDraw('c/d', POOL, ['AAA']);
  const grown = [...POOL, 'III'];
  assert.deepEqual([...p.bagFor('a/b', grown)].sort(), [...grown].sort(),
    'a changed pool length starts a fresh cycle');
  assert.equal(p.bagFor('c/d', POOL).has('AAA'), false, 'the other bag is untouched');
});

test('coverage is 0 for a subject never played', () => {
  assert.equal(makeProgress(memStore()).coverage('never/played'), 0);
});

test('a bitmask round-trips through storage', () => {
  const store = memStore();
  const a = makeProgress(store);
  a.noteDraw('a/b', POOL, ['AAA', 'CCC', 'HHH']);
  const reloaded = makeProgress(store);
  assert.deepEqual([...reloaded.bagFor('a/b', POOL)].sort(), ['BBB', 'DDD', 'EEE', 'FFF', 'GGG']);
});

test('a long pool round-trips, covering multi-byte masks', () => {
  const long = Array.from({ length: 105 }, (_, i) => `W${i}`);
  const store = memStore();
  const a = makeProgress(store);
  const drawn = long.filter((_, i) => i % 3 === 0);
  a.noteDraw('a/long', long, drawn);
  const back = makeProgress(store).bagFor('a/long', long);
  assert.equal(back.size, long.length - drawn.length);
  for (const w of drawn) assert.equal(back.has(w), false, `${w} should be drawn`);
});

test('addSolve counts puzzles and persists', () => {
  const store = memStore();
  const p = makeProgress(store);
  p.addSolve();
  p.addSolve();
  assert.equal(p.get().puzzles, 2);
  assert.equal(makeProgress(store).get().puzzles, 2, 'it survives a reload');
});

test('noteSize records a category size and setFavourLeastSeen persists', () => {
  const store = memStore();
  const p = makeProgress(store);
  p.noteSize('nature', 24);
  p.noteSize('bad', 0);
  p.setFavourLeastSeen(false);
  const reloaded = makeProgress(store).get();
  assert.equal(reloaded.sizes.nature, 24);
  assert.equal(reloaded.sizes.bad, undefined, 'a non-positive size is not recorded');
  assert.equal(reloaded.favourLeastSeen, false);
});

test('isComplete needs every subject through a full cycle', () => {
  const p = makeProgress(memStore());
  const ids = ['a/one', 'a/two'];
  p.noteSize('a', 2);
  assert.equal(p.isComplete('a', ids), false, 'nothing played');
  p.noteDraw('a/one', POOL, POOL);
  assert.equal(p.isComplete('a', ids), false, 'one subject short');
  p.noteDraw('a/two', POOL, POOL);
  assert.equal(p.isComplete('a', ids), true);
});

test('isComplete is false when the category size is unknown', () => {
  const p = makeProgress(memStore());
  p.noteDraw('a/one', POOL, POOL);
  assert.equal(p.isComplete('a', ['a/one']), false, 'never guess from an unknown size');
});

test('isComplete is false when fewer ids are offered than the recorded size', () => {
  const p = makeProgress(memStore());
  p.noteSize('a', 2);
  p.noteDraw('a/one', POOL, POOL);
  assert.equal(p.isComplete('a', ['a/one']), false);
});

test('get() returns a copy that cannot mutate the record', () => {
  const p = makeProgress(memStore());
  p.noteSize('nature', 24);
  p.noteDraw('a/b', POOL, ['AAA']);
  const snap = p.get();
  snap.sizes.nature = 999;
  snap.puzzles = 999;
  snap.bags['a/b'].c = 999;
  assert.equal(p.get().sizes.nature, 24);
  assert.equal(p.get().puzzles, 0);
  assert.equal(p.get().bags['a/b'].c, 0);
});

test('chooseSubject prefers the least-seen subject', () => {
  const seen = new Map([['a/one', 1], ['a/two', 0.25], ['a/three', 0]]);
  assert.equal(chooseSubject(['a/one', 'a/two', 'a/three'], seen, null, true, () => 0), 'a/three');
});

test('chooseSubject treats an unrecorded subject as unseen', () => {
  const seen = new Map([['a/one', 0.5]]);
  assert.equal(chooseSubject(['a/one', 'a/two'], seen, null, true, () => 0), 'a/two');
});

test('chooseSubject ignores coverage when the preference is off', () => {
  const seen = new Map([['a/one', 1], ['a/two', 0]]);
  assert.equal(chooseSubject(['a/one', 'a/two'], seen, null, false, () => 0), 'a/one',
    'with the preference off it is a plain draw over the full list');
});

test('chooseSubject avoids the current subject while an alternative exists', () => {
  const seen = new Map([['a/one', 0], ['a/two', 0]]);
  for (const r of [0, 0.99]) {
    assert.notEqual(chooseSubject(['a/one', 'a/two'], seen, 'a/one', true, () => r), 'a/one');
  }
});

test('chooseSubject returns the only subject even when it is current', () => {
  assert.equal(chooseSubject(['a/one'], new Map(), 'a/one', true, () => 0), 'a/one');
});

test('chooseSubject never returns undefined for a fully-covered category', () => {
  const ids = ['a/one', 'a/two'];
  const seen = new Map([['a/one', 1], ['a/two', 1]]);
  for (const r of [0, 0.5, 0.99]) {
    assert.ok(ids.includes(chooseSubject(ids, seen, null, true, () => r)),
      'a completed category must still deal something');
  }
});

test('a throwing store degrades silently', () => {
  const bad = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
  };
  /** @type {ReturnType<typeof makeProgress>} */
  let p;
  assert.doesNotThrow(() => { p = makeProgress(bad); });
  assert.doesNotThrow(() => p.addSolve());
  assert.doesNotThrow(() => p.noteDraw('a/b', POOL, ['AAA']));
  assert.doesNotThrow(() => p.noteSize('a', 24));
  assert.doesNotThrow(() => p.setFavourLeastSeen(false));
  assert.equal(p.get().puzzles, 1, 'it still works for this session');
});

test('a null store is accepted and simply does not persist', () => {
  const p = makeProgress(null);
  p.addSolve();
  p.noteDraw('a/b', POOL, ['AAA']);
  assert.equal(p.get().puzzles, 1);
  assert.equal(p.bagFor('a/b', POOL).has('AAA'), false, 'in-memory state still works');
});

test('a stored record round-trips through the store', () => {
  const store = memStore();
  store.setItem(KEY, JSON.stringify({
    v: 1, puzzles: 5, favourLeastSeen: false, bags: {}, sizes: { a: 3 },
  }));
  const p = makeProgress(store);
  assert.equal(p.get().puzzles, 5);
  assert.equal(p.get().favourLeastSeen, false);
});
