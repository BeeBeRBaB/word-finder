import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { CATEGORIES } from '../../src/catalog.js';

const DIR = new URL('../../src/subjects/', import.meta.url);

/** Load every category module the catalog names, keyed by category id.
 * @returns {Promise<Map<string, Record<string,string>>>} */
async function loadAll() {
  /** @type {Map<string, Record<string,string>>} */
  const out = new Map();
  for (const c of CATEGORIES) {
    const mod = await import(`../../src/subjects/${c.id}.js`);
    out.set(c.id, mod.WORDS);
  }
  return out;
}

test('the catalog and the word modules agree in both directions', async () => {
  const mods = await loadAll();
  const onDisk = readdirSync(DIR).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort();
  assert.deepEqual(onDisk, CATEGORIES.map(c => c.id).sort(), 'a module exists that the catalog does not list');
  for (const c of CATEGORIES) {
    const words = mods.get(c.id);
    assert.ok(words, `no module for ${c.id}`);
    assert.deepEqual(
      Object.keys(words).sort(),
      c.subjects.map(s => s.id).sort(),
      `${c.id}.js and the catalog list different subjects`,
    );
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
      assert.ok(list.length >= 100, `${id}: ${list.length} words, need 100`);
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
