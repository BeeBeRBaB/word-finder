import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSubject, makeSubjectLoader, SubjectLoadError } from '../../src/subjects.js';
import { SUBJECTS } from '../../src/catalog.js';

const FIRST = SUBJECTS[0].id;

test('loadSubject resolves a slug to its pool and its names', async () => {
  const s = await loadSubject(FIRST);
  assert.equal(s.id, FIRST);
  assert.equal(s.name, SUBJECTS[0].name);
  assert.equal(s.categoryName, SUBJECTS[0].categoryName);
  assert.ok(s.words.length >= 100);
  assert.ok(s.words.every(w => /^[A-Z]+$/.test(w)));
});

// One import per category, not per subject: the picker deals many subjects out of
// one category in a session, and re-importing is a needless round trip each time.
test('the loader imports each category module exactly once', async () => {
  let calls = 0;
  const load = makeSubjectLoader(async (cat) => {
    calls++;
    return await import(`../../src/subjects/${cat}.js`);
  });
  await load(FIRST);
  await load(FIRST);
  assert.equal(calls, 1);
});

test('an unknown subject id rejects as "unknown", without importing anything', async () => {
  let calls = 0;
  const load = makeSubjectLoader(async () => { calls++; return { WORDS: {} }; });
  await assert.rejects(() => load('nope/nope'), (/** @type {SubjectLoadError} */ e) => {
    assert.ok(e instanceof SubjectLoadError);
    assert.equal(e.reason, 'unknown');
    return true;
  });
  assert.equal(calls, 0, 'a bad id must not cost a network request');
});

// Offline with an uncached category is the shipped failure mode, and the picker has
// to tell it apart from a typo'd URL to know whether to disable the option.
test('a failed import rejects as "unavailable", not as a raw import error', async () => {
  const load = makeSubjectLoader(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(() => load(FIRST), (/** @type {SubjectLoadError} */ e) => {
    assert.ok(e instanceof SubjectLoadError);
    assert.equal(e.reason, 'unavailable');
    return true;
  });
});
