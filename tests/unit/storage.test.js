import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStorage } from '../../src/storage.js';
import { memStore } from './helpers.js';

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
