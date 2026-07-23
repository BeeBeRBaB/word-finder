import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStorage } from '../../src/storage.js';

function memStore() {
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
}

test('save/load round-trips', () => {
  const s = makeStorage(memStore());
  const data = { seed: 42, themeIdx: 3, found: [{ word: 'BEACH', x0: 0, y0: 0, x1: 4, y1: 0 }] };
  s.save(data);
  assert.deepEqual(s.load(), data);
});

test('load returns null when empty', () => {
  assert.equal(makeStorage(memStore()).load(), null);
});

test('a throwing store degrades to null / no throw', () => {
  const bad = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); }, removeItem() {} };
  const s = makeStorage(bad);
  assert.doesNotThrow(() => s.save({ seed: 1, themeIdx: 0, found: [] }));
  assert.equal(s.load(), null);
});

test('clear removes the saved entry', () => {
  const store = memStore();
  const s = makeStorage(store);
  s.save({ seed: 1, themeIdx: 0, found: [] });
  s.clear();
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
    assert.doesNotThrow(() => s.save({ seed: 1, themeIdx: 0, found: [] }));
    assert.equal(s.load(), null);
  } finally {
    if (orig) Object.defineProperty(globalThis, 'localStorage', orig);
    else delete globalThis.localStorage;
  }
});
