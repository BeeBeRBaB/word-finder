import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { CATEGORIES } from '../../src/catalog.js';

const DIR = new URL('../../src/subjects/', import.meta.url);

/** @returns {string[]} */
function onDiskIds() {
  return readdirSync(DIR).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3));
}

/** Load every category module on disk, keyed by category id.
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

// The catalog is what the picker offers, so a listed category with no module is a
// dead option: choosing it fails to load and "Surprise me" can land on it. While the
// 25 categories were being written in parallel this check could not exist, and its
// absence was the ship blocker -- every other content rule is per-subject and passes
// happily on a file with one subject in it, or on no file at all.
// A floor, not an equality. Every category ships 24 today, but the README documents
// adding a subject as appending one line to one file -- an equality check would turn
// that documented one-line change red until 24 more landed elsewhere. What actually
// has to hold is that no listed category is thin enough to feel repetitive or, worse,
// missing entirely.
const MIN_SUBJECTS_PER_CATEGORY = 24;

test('every catalog category has a module with a full set of subjects', async () => {
  const mods = await loadAll();
  /** @type {string[]} */
  const problems = [];
  for (const { id } of CATEGORIES) {
    const words = mods.get(id);
    if (!words) { problems.push(`${id}: listed in CATEGORIES but src/subjects/${id}.js does not exist`); continue; }
    const n = Object.keys(words).length;
    if (n < MIN_SUBJECTS_PER_CATEGORY) problems.push(`${id}: ${n} subjects, need at least ${MIN_SUBJECTS_PER_CATEGORY}`);
  }
  assert.deepEqual(problems, []);
});

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

/** How many subjects use each word, keyed however `key` groups them.
 * @param {Map<string, Record<string,string>>} mods
 * @param {(cat: string, subjectId: string) => string} key
 * @returns {Map<string, Map<string, Set<string>>>} */
function subjectsByWord(mods, key) {
  /** @type {Map<string, Map<string, Set<string>>>} */
  const out = new Map();
  for (const [cat, words] of mods) {
    for (const [subjectId, raw] of Object.entries(words)) {
      const k = key(cat, subjectId);
      if (!out.has(k)) out.set(k, new Map());
      const group = out.get(k);
      for (const word of raw.split(',')) {
        if (!group.has(word)) group.set(word, new Set());
        group.get(word).add(subjectId);
      }
    }
  }
  return out;
}

// The rule that matches what a player actually notices. You pick a category and get a
// random subject inside it, so consecutive games come from the same 24 subjects -- that
// is where a repeated word reads as padding. 6 is the measured state of the content
// rather than a round number: no category exceeds it and 16 of the 25 sit exactly on
// it, so there is no headroom to lower it into and no slack above it going unused.
const WITHIN_CATEGORY_CEILING = 6;

test('no word fills more than a quarter of its own category', async () => {
  const mods = await loadAll();
  /** @type {string[]} */
  const violations = [];
  for (const [cat, group] of subjectsByWord(mods, c => c)) {
    for (const [word, subjects] of group) {
      if (subjects.size > WITHIN_CATEGORY_CEILING) {
        violations.push(`${cat}: ${word} in ${subjects.size} subjects -- ${[...subjects].sort().join(', ')}`);
      }
    }
  }
  violations.sort();
  assert.equal(violations.length, 0,
    `${violations.length} word(s) over the within-category ceiling of ${WITHIN_CATEGORY_CEILING}. Replace each with a `
      + `word of the SAME LENGTH -- the bucket floors above are counted by length, so deleting drops the subject below `
      + `them:\n${violations.join('\n')}`);
});

// Across all 600 subjects a ceiling this tight is the wrong rule, and measuring showed
// why: reuse there is dominated by polysemy rather than padding. SCALE spans 14
// categories because a music scale, a fish scale, a map scale and a kitchen scale are
// four different words that happen to be spelled alike, and no diversification fixes
// that. 51% of words are used in exactly one subject and the tail thins fast -- 444
// words appear in more than 8 subjects, 31 in more than 16, 7 in more than 20, and none
// at all in more than 30. So this ceiling is not a quality bar that content must climb
// to; it is a regression guard sitting in the empty space above the whole corpus, to
// catch a future category padding one word across everything. Re-measure with
// `npm run words` rather than trusting these numbers if the corpus has grown.
const CORPUS_CEILING = 40;

test('no word is sprayed across the whole corpus', async () => {
  const mods = await loadAll();
  const all = subjectsByWord(mods, () => 'all').get('all') ?? new Map();
  /** @type {string[]} */
  const violations = [];
  for (const [word, subjects] of all) {
    if (subjects.size > CORPUS_CEILING) violations.push(`${word} appears in ${subjects.size} subjects`);
  }
  violations.sort();
  assert.equal(violations.length, 0,
    `${violations.length} word(s) over the corpus ceiling of ${CORPUS_CEILING}:\n${violations.join('\n')}`);
});

// The placement rules on every real subject, at both presets: parallel words never touch,
// all eight directions appear, none takes more than its even share. A new word list heavy
// in long words is where these would first give way, so it is checked here with the content.
test('every subject lays out under the placement rules at both presets', async () => {
  const { buildPuzzle } = await import('../../src/puzzle.js');
  const { makeRng } = await import('../../src/rng.js');
  const { PRESETS } = await import('../../src/layout.js');
  const { readdirSync } = await import('node:fs');
  const dir = new URL('../../src/subjects/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const { WORDS } = await import(new URL(f, dir).href);
    for (const [id, list] of Object.entries(WORDS)) for (const [name, p] of Object.entries(PRESETS)) for (let seed = 1; seed <= 3; seed++) {
      const pz = buildPuzzle({ name: id, pool: list.split(','), rng: makeRng(seed), size: p.size, count: p.count, mix: p.mix });
      /** @type {Record<string, number>} */
      const per = {};
      for (const pl of pz.placements) per[pl.dx + ',' + pl.dy] = (per[pl.dx + ',' + pl.dy] || 0) + 1;
      assert.equal(Object.keys(per).length, 8, `${name} ${id} seed ${seed}: not all eight directions`);
      assert.ok(Math.max(...Object.values(per)) <= Math.ceil(p.count / 8), `${name} ${id} seed ${seed}: over the even share`);
      const own = new Map();
      pz.placements.forEach((pl, i) => { for (let j = 0; j < pl.word.length; j++) own.set((pl.y0 + pl.dy * j) * p.size + pl.x0 + pl.dx * j, [...(own.get((pl.y0 + pl.dy * j) * p.size + pl.x0 + pl.dx * j) || []), i]); });
      pz.placements.forEach((pl, i) => {
        for (let j = 0; j < pl.word.length; j++) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const x = pl.x0 + pl.dx * j + ox, y = pl.y0 + pl.dy * j + oy;
          if (x < 0 || y < 0 || x >= p.size || y >= p.size) continue;
          for (const k of own.get(y * p.size + x) || []) {
            const q = pz.placements[k];
            const parallel = k !== i && ((q.dx === pl.dx && q.dy === pl.dy) || (q.dx === -pl.dx && q.dy === -pl.dy));
            assert.ok(!parallel, `${name} ${id} seed ${seed}: ${pl.word} touches ${q.word}`);
          }
        }
      });
    }
  }
});
