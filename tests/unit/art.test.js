import test from 'node:test';
import assert from 'node:assert/strict';
import { SPRITES, artFor, spriteRects, normalizeArtStyle, ART_STYLES, ILLUSTRATIONS } from '../../src/art.js';
import { CATEGORIES } from '../../src/catalog.js';

test('every catalog category has a well-formed 16x16 sprite, and no sprite is orphaned', () => {
  for (const c of CATEGORIES) {
    const rows = SPRITES[c.id];
    assert.ok(rows, `no sprite for ${c.id}`);
    assert.equal(rows.length, 16, `${c.id}: ${rows.length} rows`);
    for (const r of rows) assert.match(r, /^[.abc]{16}$/, `${c.id}: bad row ${r}`);
    assert.ok(rows.join('').replace(/\./g, '').length >= 40, `${c.id}: too few pixels to read`);
  }
  assert.deepEqual(Object.keys(SPRITES).sort(), CATEGORIES.map(c => c.id).sort());
});

test('art is stable per subject, varies across subjects, and is null for an unknown category', () => {
  assert.deepEqual(artFor('space/jupiter'), artFor('space/jupiter'));
  const looks = new Set(['space/jupiter', 'space/mars', 'space/comets', 'space/galaxies', 'space/rockets', 'space/moons']
    .map(id => { const a = /** @type {any} */ (artFor(id)); return `${a.hue}${a.flip}${a.corner}`; }));
  assert.ok(looks.size >= 3, 'six subjects in one category should not all look alike');
  const a = /** @type {any} */ (artFor('space/jupiter'));
  assert.equal(a.motif, 'space');
  assert.ok(a.hue >= 1 && a.hue <= 4 && a.corner >= 0 && a.corner <= 3);
  assert.equal(artFor('nonsense/thing'), null);
});

// A signed shift once made the corner negative for hashes above 2^31 (animals/dogs among
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
      assert.ok([0, 1, 2, 3].includes(a.corner) && [1, 2, 3, 4].includes(a.hue) && typeof a.flip === 'boolean', `${id}: ${JSON.stringify({ corner: a.corner, hue: a.hue, flip: a.flip })}`);
      n++;
    }
  }
  assert.ok(n >= 600, `only ${n} subjects checked`);
});

test('spriteRects draws one rect per filled pixel, mirrored when asked', () => {
  const rows = ['a' + '.'.repeat(15), ...Array(15).fill('.'.repeat(16))];
  assert.equal((spriteRects(rows, false).match(/<rect/g) || []).length, 1);
  assert.match(spriteRects(rows, false), /x="0"/);
  assert.match(spriteRects(rows, true), /x="15"/);
});

test('the Background setting normalizes like the other preferences', () => {
  assert.deepEqual([...ART_STYLES], ['illustrated', 'pixel', 'none']);
  assert.equal(normalizeArtStyle('pixel'), 'pixel');
  assert.equal(normalizeArtStyle('none'), 'none');
  assert.equal(normalizeArtStyle('banana'), 'illustrated');
  assert.equal(normalizeArtStyle(null), 'illustrated');
});

test('every illustration is safe, plain shapes with tone classes only', () => {
  for (const [id, svg] of Object.entries(ILLUSTRATIONS)) {
    assert.ok(SPRITES[id], `${id}: an illustration for a category that does not exist`);
    for (const m of svg.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g)) {
      assert.ok(['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line', 'g'].includes(m[1]), `${id}: <${m[1]}>`);
      for (const a of m[2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
        if (a[1] === 'class') assert.ok(a[2].split(/\s+/).every(c => ['t-a', 't-b', 't-c', 'ln'].includes(c)), `${id}: class ${a[2]}`);
      }
    }
    assert.doesNotMatch(svg, /url\(|href|javascript|on\w+=|style/i, `${id}: forbidden content`);
  }
});
