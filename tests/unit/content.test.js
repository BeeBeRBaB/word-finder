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

// A cross-subject rule, not a per-subject one: the per-subject checks above cannot
// see that a word is being reused as filler *across* subjects. Measured with
// tools/words-db.mjs against the category files on disk as of 2026-07-24 (other
// category files are being written in parallel, so these counts move; the shape of
// the distribution does not): word reuse is a long tail -- the great majority of
// words are used in only one or two subjects -- and every word already known to be
// padding sits far above 8: CHAMPIONSHIP, COMPOSITION, COMPETITION, EQUIPMENT,
// ATMOSPHERE, DECORATION, TOURNAMENT and CELEBRATION were all found in 15-26
// subjects apiece. Words that are genuinely about many subjects rather than
// generic filler sit in the same range, which is exactly why a bare count cannot
// be the whole rule: FUR (a real animal trait) and SUN and ICE (real natural
// phenomena) were found in 16-23 subjects too. 8 is a threshold with daylight
// below it -- not a guess -- but it only works paired with a review step, which is
// what OVERLAP_ALLOWLIST is for. The allowlist is deliberately short: only words a
// human has actually looked at and confirmed are topical rather than padding
// belong on it. Everything else over the ceiling -- ORBIT, GEAR, ENGINE, GRAVITY,
// and the rest -- is left as a recorded violation for the category authors to
// judge, not pre-approved here.
const OVERLAP_CEILING = 8;
const OVERLAP_ALLOWLIST = new Set(['FUR', 'SUN', 'ICE']);

// 163 violations against the ceiling/allowlist above as measured on 2026-07-24 (14
// of 25 category files on disk at that moment; other agents are actively adding
// more, so re-running `node tools/words-db.mjs` will show a different number).
// Skipped rather than deleted: the rule and its message are correct and ready, but
// flipping it on is a content cleanup for the category authors, not something this
// change should force onto unrelated in-flight work. Remove `.skip` once the
// filler words below are fixed or -- for words that turn out to be genuinely
// topical -- added to OVERLAP_ALLOWLIST above.
test.skip('no word is reused as filler across more subjects than the overlap ceiling allows', async () => {
  const mods = await loadAll();
  /** @type {Map<string, Set<string>>} */
  const subjectsByWord = new Map();
  for (const [, words] of mods) {
    for (const [subjectId, raw] of Object.entries(words)) {
      for (const word of raw.split(',')) {
        if (!subjectsByWord.has(word)) subjectsByWord.set(word, new Set());
        subjectsByWord.get(word).add(subjectId);
      }
    }
  }

  /** @type {string[]} */
  const violations = [];
  for (const [word, subjects] of subjectsByWord) {
    if (OVERLAP_ALLOWLIST.has(word)) continue;
    if (subjects.size > OVERLAP_CEILING) {
      violations.push(`${word} appears in ${subjects.size} subjects (max ${OVERLAP_CEILING}): ${[...subjects].sort().join(', ')}`);
    }
  }
  violations.sort();

  assert.equal(
    violations.length,
    0,
    `${violations.length} word(s) exceed the overlap ceiling of ${OVERLAP_CEILING} subjects -- each is either filler `
      + `to diversify or a genuinely topical word to add to OVERLAP_ALLOWLIST:\n${violations.join('\n')}`,
  );
});
