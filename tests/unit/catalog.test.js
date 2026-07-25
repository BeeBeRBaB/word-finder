import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, findCategory, categoryOf, subjectName } from '../../src/catalog.js';

test('every category id is a lowercase slug, with a non-empty name', () => {
  for (const c of CATEGORIES) {
    assert.match(c.id, /^[a-z][a-z0-9-]*$/, `bad category id: ${c.id}`);
    assert.ok(c.name.length > 0, `category ${c.id} has no name`);
  }
  assert.equal(new Set(CATEGORIES.map(c => c.id)).size, CATEGORIES.length, 'duplicate category id');
});

test('findCategory returns null rather than throwing for an unknown id', () => {
  assert.equal(findCategory('nope'), null);
  assert.equal(findCategory(CATEGORIES[0].id)?.name, CATEGORIES[0].name);
});

test('subjectName title-cases a slug, including multi-word ones', () => {
  assert.equal(subjectName('nature/birds'), 'Birds');
  assert.equal(subjectName('sports/card-games'), 'Card Games');
  assert.equal(subjectName('sports/board-games'), 'Board Games');
});

test('categoryOf reads the prefix', () => {
  assert.equal(categoryOf('nature/birds'), 'nature');
  assert.equal(categoryOf('sports/card-games'), 'sports');
});
