import test from 'node:test';
import assert from 'node:assert/strict';
import { artFor, ILLUSTRATIONS } from '../../src/art.js';
import { CATEGORIES } from '../../src/catalog.js';

test('art is stable per subject, varies across subjects, and is null for an unknown category', () => {
  assert.deepEqual(artFor('space/jupiter'), artFor('space/jupiter'));
  const looks = new Set(['space/jupiter', 'space/mars', 'space/comets', 'space/galaxies', 'space/rockets', 'space/moons']
    .map(id => { const a = /** @type {any} */ (artFor(id)); return `${a.hue}${a.flip}`; }));
  assert.ok(looks.size >= 3, 'six subjects in one category should not all look alike');
  const a = /** @type {any} */ (artFor('space/jupiter'));
  assert.equal(a.motif, 'space');
  assert.ok(a.hue >= 1 && a.hue <= 4);
  assert.equal(artFor('nonsense/thing'), null);
});

// A signed shift once made a choice negative for hashes above 2^31 (animals/dogs among
// them) and threw mid-deal, leaving the board "Unavailable". Every real subject, checked.
test('every real subject gets art with in-range choices', async () => {
  const { readdirSync } = await import('node:fs');
  const dir = new URL('../../src/subjects/', import.meta.url);
  let n = 0;
  for (const f of readdirSync(dir)) {
    const { WORDS } = await import(new URL(f, dir).href);
    for (const id of Object.keys(WORDS)) {
      const a = /** @type {any} */ (artFor(id));
      assert.ok(a, `no art for ${id}`);
      assert.ok([1, 2, 3, 4].includes(a.hue) && typeof a.flip === 'boolean', `${id}: ${JSON.stringify({ hue: a.hue, flip: a.flip })}`);
      n++;
    }
  }
  assert.ok(n >= 600, `only ${n} subjects checked`);
});

test('every illustration is safe, plain shapes with tone classes only', () => {
  const ids = new Set(CATEGORIES.map(c => c.id));
  for (const [id, svg] of Object.entries(ILLUSTRATIONS)) {
    assert.ok(ids.has(id), `${id}: an illustration for a category that does not exist`);
    for (const m of svg.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g)) {
      assert.ok(['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line', 'g'].includes(m[1]), `${id}: <${m[1]}>`);
      for (const a of m[2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
        if (a[1] === 'class') assert.ok(a[2].split(/\s+/).every(c => ['t-a', 't-b', 't-c', 'ln'].includes(c)), `${id}: class ${a[2]}`);
      }
    }
    assert.doesNotMatch(svg, /url\(|href|javascript|on\w+=|style/i, `${id}: forbidden content`);
  }
});
