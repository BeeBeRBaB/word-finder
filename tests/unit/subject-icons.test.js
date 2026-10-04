import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { CATEGORIES } from '../../src/catalog.js';
import { ICONS } from '../../src/backgrounds/icons.js';
import { existsSync } from 'node:fs';
import { CATEGORY_ICONS, CATEGORY_MOTION, SUBJECT_ICONS, SUBJECT_MOTION } from '../../src/backgrounds/subject-icons.js';
import { VARIANTS, iconMarkup, iconsFor, layoutScene, motionFor, sceneColors, variantOf, withHero } from '../../src/backgrounds/icon-scene.js';
import { MOTIONS } from '../../src/backgrounds/subject-motion.js';
import { makeRng } from '../../src/rng.js';

test('every subject and category maps 4-6 distinct drawn icons, and every icon is used', async () => {
  const used = new Set();
  for (const { id: cat } of CATEGORIES) {
    const { WORDS } = await import(`../../src/subjects/${cat}.js`);
    for (const [key, list] of [[cat, CATEGORY_ICONS[cat]], ...Object.keys(WORDS).map(s => [s, SUBJECT_ICONS[s]])]) {
      assert.ok(list, `${key}: no icons`);
      const ids = list.split(' ');
      assert.ok(ids.length >= 4 && ids.length <= 6, `${key}: ${ids.length} icons`);
      assert.equal(new Set(ids).size, ids.length, `${key}: duplicate icon`);
      for (const i of ids) { assert.ok(i in ICONS, `${key}: ${i} is not drawn`); used.add(i); }
    }
  }
  assert.deepEqual(Object.keys(ICONS).filter(i => !used.has(i)), [], 'emitted but never shown');
});

// The markup goes in through innerHTML and an image URL, so only the drawing vocabulary passes.
test('icon markup uses only shapes, geometry attributes and the four tone classes', () => {
  const TAGS = /^(path|circle|ellipse|rect|polygon|polyline|line|g)$/;
  const ATTRS = /^(d|cx|cy|r|rx|ry|x|y|width|height|points|x1|y1|x2|y2|transform|fill-rule|stroke-width|stroke-linecap|stroke-linejoin|class)$/;
  for (const [id, svg] of Object.entries(ICONS)) {
    for (const [, tag, rest] of svg.matchAll(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g)) {
      assert.match(tag, TAGS, `${id}: <${tag}>`);
      for (const [, a, v] of rest.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
        assert.match(a, ATTRS, `${id}: ${a}`);
        if (a === 'class') assert.match(v, /^(t-a|t-b|t-c|ln)$/, `${id}: class ${v}`);
      }
    }
    assert.doesNotMatch(svg, /url\(|href|javascript|on\w+=|style|['\\]/i, id);
  }
});

test('every category has a motion, every override names a real subject, and every motion has a module', () => {
  assert.deepEqual(Object.keys(CATEGORY_MOTION).sort(), CATEGORIES.map(c => c.id).sort());
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

test('icon tones become attributes, and an explicit stroke width survives', () => {
  for (const id of Object.keys(ICONS)) assert.doesNotMatch(iconMarkup(id), /class=/, id);
  const ln = Object.keys(ICONS).find(id => /class="ln" [^>]*stroke-width="/.test(ICONS[id]) || /stroke-width="[^"]*"[^>]*class="ln"/.test(ICONS[id]));
  assert.ok(ln, 'some icon sets its own stroke width');
  for (const m of iconMarkup(ln).matchAll(/<[^>]*stroke="currentColor"[^>]*>/g)) assert.equal(m[0].match(/stroke-width=/g)?.length, 1, m[0]);
  assert.equal(iconMarkup('no-such-icon'), '');
});

test('every layout covers the host without leaving it, and a hero keeps its space', () => {
  const ids = SUBJECT_ICONS['music/concerts'].split(' ');
  for (const [W, H] of [[1280, 800], [390, 844], [300, 700], [800, 160]]) {
    for (const layout of [0, 1, 2]) {
      const placed = layoutScene(layout, ids, W, H, makeRng(7));
      assert.ok(placed.length >= 3, `${layout} at ${W}x${H}: ${placed.length} icons`);
      assert.deepEqual(placed, layoutScene(layout, ids, W, H, makeRng(7)), 'deterministic');
      assert.ok(placed.some(p => p.x < W / 2) && placed.some(p => p.x > W / 2), `${layout} at ${W}x${H}: one-sided`);
      for (const p of placed) {
        assert.ok(ids.includes(p.id) && p.size > 20 && p.hue >= 0 && p.hue < 5);
        if (layout !== 1) assert.ok(p.x > -p.size && p.x < W + p.size && p.y > -p.size && p.y < H + p.size, `${layout}: off the host`);
      }
      if (layout === 2) {
        const [hero, ...rest] = placed;
        assert.equal(hero.id, ids[0]);
        for (const p of rest) assert.ok(Math.hypot(p.x - hero.x, p.y - hero.y) > hero.size * 0.48, 'icon on the hero');
      }
    }
  }
  assert.deepEqual(layoutScene(0, [], 100, 100, makeRng(1)), []);
});

test('a scene takes the theme\'s colours, or its fallback while they are empty', () => {
  assert.deepEqual(sceneColors(['#a', '', '#b'], 'currentColor'), ['#a', '#b']);
  assert.deepEqual(sceneColors(['', ''], 'currentColor'), ['currentColor']);
});
