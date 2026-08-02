import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSubject, loadCategory, makeSubjectLoader, SubjectLoadError } from '../../src/subjects.js';

// nature.js is complete (not one of the in-flight parallel writes), so its keys are
// stable ground to test against.
const CATEGORY = 'nature';
const SUBJECT = 'nature/birds';

test('loadSubject resolves a slug to its pool and its names', async () => {
  const s = await loadSubject(SUBJECT);
  assert.equal(s.id, SUBJECT);
  assert.equal(s.name, 'Birds');
  assert.equal(s.category, 'nature');
  assert.equal(s.categoryName, 'Nature');
  assert.ok(s.words.length >= 40);
  assert.ok(s.words.every(w => /^[A-Z]+$/.test(w)));
});

test('loadCategory returns subjectIds matching the module\'s keys', async () => {
  const c = await loadCategory(CATEGORY);
  assert.equal(c.id, CATEGORY);
  assert.equal(c.name, 'Nature');
  assert.deepEqual(c.subjectIds.slice().sort(), Object.keys(c.words).sort());
  assert.ok(c.subjectIds.includes(SUBJECT));
});

// One import per category, not per subject: the picker deals many subjects out of
// one category in a session, and re-importing is a needless round trip each time.
test('the loader imports each category module exactly once', async () => {
  let calls = 0;
  const { loadSubject: load } = makeSubjectLoader(async (cat) => {
    calls++;
    return await import(`../../src/subjects/${cat}.js`);
  });
  await load(SUBJECT);
  await load(SUBJECT);
  assert.equal(calls, 1);
});

test('an unknown subject id rejects as "unknown", without importing anything', async () => {
  let calls = 0;
  const { loadSubject: load } = makeSubjectLoader(async () => { calls++; return { WORDS: {} }; });
  await assert.rejects(() => load('nope/nope'), (/** @type {SubjectLoadError} */ e) => {
    assert.ok(e instanceof SubjectLoadError);
    assert.equal(e.reason, 'unknown');
    return true;
  });
  assert.equal(calls, 0, 'a bad id must not cost a network request');
});

test('an unknown category id rejects as "unknown", without importing anything', async () => {
  let calls = 0;
  const { loadCategory: load } = makeSubjectLoader(async () => { calls++; return { WORDS: {} }; });
  await assert.rejects(() => load('not-a-category'), (/** @type {SubjectLoadError} */ e) => {
    assert.ok(e instanceof SubjectLoadError);
    assert.equal(e.reason, 'unknown');
    return true;
  });
  assert.equal(calls, 0, 'a bad category must not cost a network request');
});

// A real category whose module loads but has no such key. content.test.js catches this
// before it ships, so at runtime it is treated as unknown rather than crashing the boot.
test('a subject missing from a loaded category rejects as "unknown"', async () => {
  const { loadSubject: load } = makeSubjectLoader(async () => ({ WORDS: {} }));
  await assert.rejects(() => load('nature/no-such-subject'), (/** @type {SubjectLoadError} */ e) => {
    assert.ok(e instanceof SubjectLoadError);
    assert.equal(e.reason, 'unknown');
    return true;
  });
});

// Offline with an uncached category is the shipped failure mode, and the picker has
// to tell it apart from a typo'd URL to know whether to disable the option.
test('a failed import rejects as "unavailable", not as a raw import error', async () => {
  const { loadSubject: load } = makeSubjectLoader(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(() => load(SUBJECT), (/** @type {SubjectLoadError} */ e) => {
    assert.ok(e instanceof SubjectLoadError);
    assert.equal(e.reason, 'unavailable');
    return true;
  });
});
