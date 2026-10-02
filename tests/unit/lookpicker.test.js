import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, PALETTES } from '../../src/appearance.js';
import { lookId, previewMarkup, tilesMarkup, summaryMarkup, varsOf, readLooks } from '../../src/lookpicker.js';

/** A computed style whose tokens name the look `root` is in. @param {{dataset:Record<string,string>}} root */
const styleOf = (root) => /** @type {any} */ ({ getPropertyValue: (/** @type {string} */ k) => ` ${root.dataset.theme}.${root.dataset.palette}${k} ` });

test('a tile per theme and palette, grouped by theme in order, each a radio named for both', () => {
  const html = tilesMarkup();
  assert.equal((html.match(/<input type="radio" name="look"/g) ?? []).length, THEMES.length * PALETTES.length);
  assert.equal((html.match(/class="lookgroup" role="group"/g) ?? []).length, THEMES.length);
  const order = [...html.matchAll(/value="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(order, THEMES.flatMap(t => PALETTES.map(p => lookId(t, p))));
  assert.match(html, /<h3 class="lookhead" id="look-plum">Plum<\/h3>/);
  assert.match(html, /aria-labelledby="look-plum"/);
  // The theme is in each radio's name, out of sight, so "Jewel" alone is never ambiguous.
  assert.match(html, /value="plum\/jewel"><span class="lookprev" aria-hidden="true">[^]*?<span class="lookname"><span class="sr">Plum <\/span>Jewel<\/span>/);
});

test('a preview is uncoloured until it is given its look, and is hidden from assistive tech', () => {
  assert.doesNotMatch(previewMarkup(), /style=/);
  assert.match(previewMarkup('--look-bg:#000'), /^<span class="lookprev" aria-hidden="true" style="--look-bg:#000">/);
  assert.equal((previewMarkup().match(/class="lookl"/g) ?? []).length, 3);
});

test('the row summary names the theme and palette and shows the preview', () => {
  const html = summaryMarkup('grove', 'calm', '--look-bg:#123456');
  assert.match(html, /style="--look-bg:#123456"/);
  assert.match(html, /<span class="lookname">Grove · Calm<\/span>$/);
});

test('varsOf reads each preview token, trimmed', () => {
  const vars = varsOf(styleOf({ dataset: { theme: 'sticker', palette: 'duotone' } }));
  assert.match(vars, /^--look-bg:sticker\.duotone--bg;--look-surface:sticker\.duotone--surface;/);
  assert.match(vars, /--look-pill-2:sticker\.duotone--pill-2$/);
});

test('readLooks tries every look on the root and puts the root back as it was', () => {
  const root = { dataset: /** @type {Record<string,string>} */ ({ theme: 'plum', palette: 'jewel', appearance: 'light' }) };
  const looks = readLooks(root, styleOf);
  assert.equal(looks.size, THEMES.length * PALETTES.length);
  assert.match(looks.get('grove/calm') ?? '', /^--look-bg:grove\.calm--bg;/);
  assert.deepEqual(root.dataset, { theme: 'plum', palette: 'jewel', appearance: 'light' });
  // Absent before (the inline resolver never ran), absent after; and restored on a throw too.
  const bare = { dataset: /** @type {Record<string,string>} */ ({}) };
  readLooks(bare, styleOf, ['grove'], ['calm']);
  assert.deepEqual(bare.dataset, {});
  assert.throws(() => readLooks(root, () => { throw new Error('no style'); }), /no style/);
  assert.deepEqual(root.dataset, { theme: 'plum', palette: 'jewel', appearance: 'light' });
});
