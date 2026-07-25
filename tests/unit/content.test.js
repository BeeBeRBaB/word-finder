import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { CATEGORIES } from '../../src/catalog.js';

const DIR = new URL('../../src/subjects/', import.meta.url);

/** @returns {string[]} */
function onDiskIds() {
  return readdirSync(DIR).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3));
}

/** Load every category module that actually exists on disk, keyed by category id.
 * Categories are written in parallel, so a CATEGORIES entry with no file yet is
 * allowed -- it is simply absent from the returned map rather than a failure.
 * @returns {Promise<Map<string, Record<string,string>>>} */
async function loadAll() {
  /** @type {Map<string, Record<string,string>>} */
  const out = new Map();
  for (const id of onDiskIds()) {
    const mod = await import(`../../src/subjects/${id}.js`);
    out.set(id, mod.WORDS);
  }
  return out;
}

test('every module on disk has a matching entry in CATEGORIES', () => {
  const ids = new Set(CATEGORIES.map(c => c.id));
  for (const id of onDiskIds()) {
    assert.ok(ids.has(id), `${id}.js exists on disk but CATEGORIES has no entry for it`);
  }
});

test('every key in a module is that module\'s category slash a slug', async () => {
  const mods = await loadAll();
  for (const [cat, words] of mods) {
    for (const id of Object.keys(words)) {
      assert.match(id, new RegExp(`^${cat}/[a-z0-9]+(-[a-z0-9]+)*$`), `${id} is not a valid subject id for ${cat}.js`);
    }
  }
});

// Bucket floors, not just a total. A subject with 100 words that are all seven
// letters long passes a word count and still cannot deal a board.
const FLOORS = [
  { min: 3, max: 4, need: 6 },
  { min: 3, max: 5, need: 8 },
  { min: 5, max: 6, need: 8 },
  { min: 6, max: 8, need: 8 },
  { min: 7, max: 9, need: 8 },
  { min: 9, max: 12, need: 8 },
];

test('every subject meets the word contract', async () => {
  const mods = await loadAll();
  for (const [cat, words] of mods) {
    for (const [id, raw] of Object.entries(words)) {
      const list = raw.split(',');
      // 40, not 100. The floor only has to make the draw vary: a board takes 12 of
      // these, so 40 gives every deal a different dozen. Deepening a pool later is a
      // pure data change — this number is the only thing that gates it, and no code
      // anywhere assumes a pool size.
      assert.ok(list.length >= 40, `${id}: ${list.length} words, need 40`);
      assert.equal(new Set(list).size, list.length, `${id}: duplicate word`);
      for (const w of list) {
        assert.match(w, /^[A-Z]+$/, `${id}: "${w}" is not bare uppercase A-Z`);
        assert.ok(w.length >= 3 && w.length <= 12, `${id}: "${w}" is ${w.length} letters`);
      }
      for (const f of FLOORS) {
        const n = list.filter(w => w.length >= f.min && w.length <= f.max).length;
        assert.ok(n >= f.need, `${id}: ${n} words of ${f.min}-${f.max} letters, need ${f.need} (${cat})`);
      }
    }
  }
});
