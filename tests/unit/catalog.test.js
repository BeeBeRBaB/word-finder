import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, SUBJECTS, findSubject, findCategory } from '../../src/catalog.js';

test('every category id is a lowercase slug matching its module filename', () => {
  for (const c of CATEGORIES) {
    assert.match(c.id, /^[a-z][a-z0-9-]*$/, `bad category id: ${c.id}`);
    assert.ok(c.name.length > 0, `category ${c.id} has no name`);
    assert.ok(c.subjects.length > 0, `category ${c.id} has no subjects`);
  }
  assert.equal(new Set(CATEGORIES.map(c => c.id)).size, CATEGORIES.length, 'duplicate category id');
});

test('every subject id is its category slash a slug of its name', () => {
  for (const c of CATEGORIES) for (const s of c.subjects) {
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    assert.equal(s.id, `${c.id}/${slug}`, `${s.name} should be ${c.id}/${slug}`);
  }
});

// Names are what the win card and the header show, and what accentSlot() hashes for
// the underline colour. Two subjects sharing a name would be two different word lists
// the player cannot tell apart.
test('subject ids and names are unique across the whole catalog', () => {
  assert.equal(new Set(SUBJECTS.map(s => s.id)).size, SUBJECTS.length, 'duplicate subject id');
  assert.equal(new Set(SUBJECTS.map(s => s.name)).size, SUBJECTS.length, 'duplicate subject name');
});

test('SUBJECTS carries its category down with it', () => {
  for (const s of SUBJECTS) {
    const c = findCategory(s.category);
    assert.ok(c, `${s.id} names a category that does not exist`);
    assert.equal(s.categoryName, c.name);
  }
});

test('findSubject and findCategory return null rather than throwing', () => {
  assert.equal(findSubject('nope/nope'), null);
  assert.equal(findCategory('nope'), null);
  assert.equal(findSubject(SUBJECTS[0].id)?.name, SUBJECTS[0].name);
});
