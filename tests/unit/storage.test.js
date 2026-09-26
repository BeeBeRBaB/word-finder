import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStorage } from '../../src/storage.js';
import { memStore } from './helpers.js';
import { buildPuzzle } from '../../src/puzzle.js';
import { makeRng } from '../../src/rng.js';
import { PRESETS } from '../../src/layout.js';

test('save/load round-trips', () => {
  const s = makeStorage(memStore());
  const data = { seed: 42, subjectId: 'nature/birds', size: 12, count: 3, found: [{ word: 'BEACH', x0: 0, y0: 0, x1: 4, y1: 0 }] };
  s.save(data);
  assert.deepEqual(s.load(), data);
});

test('load returns null when empty', () => {
  assert.equal(makeStorage(memStore()).load(), null);
});

test('a throwing store degrades to null / no throw', () => {
  const bad = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); } };
  const s = makeStorage(bad);
  assert.doesNotThrow(() => s.save({ seed: 1, subjectId: 'nature/birds', size: 10, count: 0, found: [] }));
  assert.equal(s.load(), null);
});

test('load returns null on malformed JSON instead of throwing', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', '{not json');
  const s = makeStorage(store);
  assert.doesNotThrow(() => s.load());
  assert.equal(s.load(), null);
});

test('default store resolution survives a throwing localStorage getter (Safari private mode)', () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    let s;
    assert.doesNotThrow(() => { s = makeStorage(); });
    assert.doesNotThrow(() => s.save({ seed: 1, subjectId: 'nature/birds', size: 10, count: 0, found: [] }));
    assert.equal(s.load(), null);
  } finally {
    if (orig) Object.defineProperty(globalThis, 'localStorage', orig);
    else delete globalThis.localStorage;
  }
});

// A save written before deep pools shipped is unreproducible, not merely stale: its
// board was dealt by taking twelve words from a twelve-word list, and that list no
// longer exists. Absence of `size` is the whole detection rule, so there is no
// migration code and no frozen legacy pool to carry forever.
test('a legacy save with no size field is discarded, not half-read', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, topicIdx: 5, found: [] }));
  assert.equal(makeStorage(store).load(), null);
});

test('a save with a non-numeric size is discarded', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, subjectId: 'nature/birds', size: '13', count: 12, found: [] }));
  assert.equal(makeStorage(store).load(), null);
});

test('a save missing its subject id is discarded', () => {
  const store = memStore();
  store.setItem('wordfinder-save-v1', JSON.stringify({ seed: 7, size: 13, count: 12, found: [] }));
  assert.equal(makeStorage(store).load(), null);
});

test('a complete save round-trips including its board shape', () => {
  const store = memStore();
  const data = {
    seed: 42, subjectId: 'nature/birds', size: 10, count: 8,
    found: [{ word: 'OWL', x0: 1, y0: 2, x1: 3, y1: 2 }],
  };
  makeStorage(store).save(data);
  assert.deepEqual(makeStorage(store).load(), data);
});

// The board shape is recorded so restore never has to ask the device what size to
// rebuild at. A 13x13 save reopened where the preset says 10x10 still comes back as
// the board that was saved — progress is not something a resize gets to destroy.
test('a save whose size does not match any current preset still loads', () => {
  const store = memStore();
  const data = { seed: 1, subjectId: 'nature/birds', size: 11, count: 9, found: [] };
  makeStorage(store).save(data);
  assert.equal(makeStorage(store).load()?.size, 11);
});

// Made-up words, eight of every length the full board takes: the save must not care
// what a subject is.
const POOL = (() => {
  const rng = makeRng(3), out = [];
  for (let len = 3; len <= 12; len++) for (let i = 0; i < 8; i++)
    out.push(Array.from({ length: len }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[rng.int(26)]).join(''));
  return out;
})();
const { size, count, mix } = PRESETS.full;
/** @param {number} seed @param {Set<string>} [undrawn] */
const deal = (seed, undrawn) => buildPuzzle({ name: 'Test', pool: POOL, rng: makeRng(seed), size, count, mix, undrawn });
/** @param {import('../../src/puzzle.js').Puzzle} p */
const saveOf = (p) => ({ seed: 5, subjectId: 'nature/birds', size, count, found: [], cells: p.cells.join(''), placements: p.placements });

// The deal itself draws its words out of the bag, so rerunning its seed later picks
// others. Only a save that holds the board can bring it back.
test('a save carries the dealt board, which its seed alone would not reproduce', () => {
  const dealt = deal(5, new Set(POOL.filter((_, i) => i % 3 === 0)));
  assert.notEqual(deal(5).cells.join(''), dealt.cells.join(''), 'the fixture must be a deal the bag steered');
  const store = memStore();
  makeStorage(store).save(saveOf(dealt));
  const back = makeStorage(store).load();
  assert.equal(back?.cells, dealt.cells.join(''));
  assert.deepEqual(back?.placements, dealt.placements);
});

test('a save written before boards were stored still loads, for restore to regenerate', () => {
  const store = memStore();
  const data = { seed: 5, subjectId: 'nature/birds', size, count, found: [{ word: 'OWL', x0: 1, y0: 2, x1: 3, y1: 2 }] };
  store.setItem('wordfinder-save-v1', JSON.stringify(data));
  assert.deepEqual(makeStorage(store).load(), data);
});

// A list naming a word the grid does not spell is an unwinnable board. Dropping the board
// costs only itself: restore falls back to the seed, and the found words still replay.
test('a board that does not hold together is dropped, and the rest of the save kept', () => {
  const good = saveOf(deal(5));
  const p0 = good.placements[0];
  const wrongLetter = good.cells[p0.y0 * size + p0.x0] === 'Z' ? 'Y' : 'Z';
  /** @type {[string, (s: any) => void][]} */
  const breaks = [
    ['cells short', (s) => { s.cells = s.cells.slice(1); }],
    ['cells not A-Z', (s) => { s.cells = s.cells.toLowerCase(); }],
    ['cells not a string', (s) => { s.cells = [...s.cells]; }],
    ['placements short of count', (s) => { s.placements.pop(); }],
    ['placements missing', (s) => { delete s.placements; }],
    ['a placement off the grid', (s) => { s.placements[0].x0 = size; }],
    ['a placement going nowhere', (s) => { s.placements[0].dx = 0; s.placements[0].dy = 0; }],
    ['a placement not spelling its word', (s) => {
      const i = p0.y0 * size + p0.x0;
      s.cells = s.cells.slice(0, i) + wrongLetter + s.cells.slice(i + 1);
    }],
  ];
  for (const [what, breakIt] of breaks) {
    const s = structuredClone(good);
    s.found = [{ word: 'OWL', x0: 1, y0: 2, x1: 3, y1: 2 }];
    breakIt(s);
    const store = memStore();
    store.setItem('wordfinder-save-v1', JSON.stringify(s));
    const back = makeStorage(store).load();
    assert.ok(back, `${what}: the save itself must survive`);
    assert.equal(back.cells, undefined, `${what}: cells`);
    assert.equal(back.placements, undefined, `${what}: placements`);
    assert.deepEqual(back.found, s.found, `${what}: found`);
  }
});
