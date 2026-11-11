import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { CATEGORIES } from '../../src/catalog.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { CATEGORY_ICONS, CATEGORY_MOTION, FACING, SUBJECT_ICONS, SUBJECT_MOTION } from '../../src/backgrounds/subject-icons.js';
import { VARIANTS, facingOf, iconsFor, motionFor, sceneColors, variantOf, withHero } from '../../src/backgrounds/icon-scene.js';
import { MOTIONS } from '../../src/backgrounds/subject-motion.js';

/** Every drawing, by id, and the ids each category's file holds. An icon two categories map is in
 * both files, drawn the same. @returns {Promise<{all:Map<string, string>, files:Map<string, string[]>}>} */
async function drawings() {
  const all = new Map(), files = new Map();
  for (const f of readdirSync(new URL('../../src/backgrounds/icons/flat/', import.meta.url))) {
    const { ICONS } = await import(`../../src/backgrounds/icons/flat/${f}`);
    for (const [id, svg] of Object.entries(ICONS)) {
      assert.equal(all.get(id) ?? svg, svg, `${id} differs between files`);
      all.set(id, svg);
    }
    files.set(f.slice(0, -3), Object.keys(ICONS));
  }
  return { all, files };
}
const flat = await drawings();
const FLAT = flat.all;

test('every subject and category maps 4-6 distinct drawn icons, and every icon is used', async () => {
  const used = new Set();
  for (const { id: cat } of CATEGORIES) {
    const { WORDS } = await import(`../../src/subjects/${cat}.js`);
    for (const [key, list] of [[cat, CATEGORY_ICONS[cat]], ...Object.keys(WORDS).map(s => [s, SUBJECT_ICONS[s]])]) {
      assert.ok(list, `${key}: no icons`);
      const ids = list.split(' ');
      assert.ok(ids.length >= 4 && ids.length <= 6, `${key}: ${ids.length} icons`);
      assert.equal(new Set(ids).size, ids.length, `${key}: duplicate icon`);
      for (const i of ids) { assert.ok(FLAT.has(i), `${key}: ${i} is not drawn`); used.add(i); }
    }
  }
  assert.deepEqual([...FLAT.keys()].filter(i => !used.has(i)), [], 'emitted but never shown');
});

// The drawings are in their own colours only: the One colour set went with the Icons switch.
test('each category\'s file draws every icon its subjects show, and only the flat set is left', async () => {
  assert.equal(existsSync(new URL('../../src/backgrounds/icons/mono/', import.meta.url)), false);
  assert.deepEqual([...flat.files.keys()].sort(), CATEGORIES.map(c => c.id).sort());
  for (const { id: cat } of CATEGORIES) {
    const { WORDS } = await import(`../../src/subjects/${cat}.js`);
    const want = [...new Set([CATEGORY_ICONS[cat], ...Object.keys(WORDS).map(s => SUBJECT_ICONS[s])].flatMap(l => l.split(' ')))].sort();
    assert.deepEqual(flat.files.get(cat), want, `flat/${cat}`);
  }
});

// The markup goes into an image URL, so only the drawing vocabulary passes.
test('icon markup uses only shapes and their geometry, paint and stroke attributes', () => {
  const TAGS = /^(path|circle|ellipse|rect|g)$/;
  const ATTRS = /^(d|cx|cy|r|rx|ry|x|y|width|height|transform|fill|fill-rule|clip-rule|opacity|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit)$/;
  for (const [id, svg] of FLAT) {
    for (const [, tag, rest] of svg.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g)) {
      assert.match(tag, TAGS, `${id}: <${tag}>`);
      for (const [, a, v] of rest.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
        assert.match(a, ATTRS, `${id}: ${a}`);
        if (a === 'fill' || a === 'stroke') assert.match(v, /^(#[0-9A-Fa-f]{3,8}|none|currentColor)$/, `${id}: ${a}="${v}"`);
      }
    }
    assert.doesNotMatch(svg, /url\(|href|javascript|on\w+=|style|['\\]/i, id);
  }
});

test('every category has a motion, every override names a real subject, and every motion has a module', () => {
  assert.deepEqual(Object.keys(CATEGORY_MOTION).sort(), CATEGORIES.map(c => c.id).sort());
  assert.equal(new Set(Object.values(CATEGORY_MOTION)).size, CATEGORIES.length, 'each category has a style of its own');
  for (const [key, m] of [...Object.entries(CATEGORY_MOTION), ...Object.entries(SUBJECT_MOTION)]) {
    assert.ok(m in MOTIONS, `${key}: no motion ${m}`);
    if (key.includes('/')) {
      assert.ok(key in SUBJECT_ICONS, `${key}: not a subject`);
      assert.notEqual(m, CATEGORY_MOTION[key.split('/')[0]], `${key}: repeats its category`);
    }
  }
  for (const file of Object.values(MOTIONS)) assert.ok(existsSync(new URL(`../../src/backgrounds/${file}.js`, import.meta.url)), file);
  assert.equal(motionFor('nature/weather'), SUBJECT_MOTION['nature/weather'] ?? CATEGORY_MOTION.nature);
  assert.equal(motionFor('space/not-a-subject'), CATEGORY_MOTION.space);
  assert.equal(motionFor('nope/nope'), 'drift');
});

test('the emitted modules match the icon and map sources', () => {
  const r = spawnSync(process.execPath, ['tools/art-src/iconmap/emit.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('FACING is facing.json for the drawn icons, -1 or 1 each, and facingOf gives the rest 0', () => {
  const src = JSON.parse(readFileSync(new URL('../../tools/art-src/icons/facing.json', import.meta.url), 'utf8'));
  const want = [...src.left.map(id => [id, -1]), ...src.right.map(id => [id, 1])].sort(([a], [b]) => (a < b ? -1 : 1));
  assert.deepEqual(Object.entries(FACING), want);
  assert.ok(Object.isFrozen(FACING));
  for (const [id, v] of Object.entries(FACING)) {
    assert.ok(FLAT.has(id), `${id} is not drawn`);
    assert.ok(v === -1 || v === 1, `${id}: ${v}`);
    assert.equal(facingOf(id), v);
  }
  assert.ok(FLAT.has('owl') && !('owl' in FACING));
  assert.equal(facingOf('owl'), 0);
  assert.equal(facingOf('no-such-icon'), 0);
});

test('a subject shows its own icons, an unknown one its category\'s', () => {
  assert.deepEqual(iconsFor('animals/dogs'), SUBJECT_ICONS['animals/dogs'].split(' '));
  assert.deepEqual(iconsFor('animals/not-a-subject'), CATEGORY_ICONS.animals.split(' '));
  assert.ok(iconsFor('nope/nope').length >= 4);
  assert.deepEqual(withHero(['a', 'b', 'c'], 1), ['b', 'a', 'c']);
  assert.deepEqual(withHero(['a'], 1), ['a']);
});

test('seeds pick each fixed variant, and the same seed always the same one', () => {
  const seen = new Set();
  for (let s = 0; s < 60; s++) {
    const v = variantOf('food/pizza', s);
    assert.deepEqual(v, variantOf('food/pizza', s + VARIANTS * 1000));
    seen.add(`${v.layout}/${v.hero}/${v.seed}`);
  }
  assert.equal(seen.size, VARIANTS);
  assert.notEqual(variantOf('food/pizza', 0).seed, variantOf('food/tacos', 0).seed);
});

test('a scene takes the theme\'s colours, or its fallback while they are empty', () => {
  assert.deepEqual(sceneColors(['#a', '', '#b'], 'currentColor'), ['#a', '#b']);
  assert.deepEqual(sceneColors(['', ''], 'currentColor'), ['currentColor']);
});
