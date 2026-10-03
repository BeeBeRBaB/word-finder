import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, PREFS } from '../../src/appearance.js';
import { lookId, previewMarkup, tilesMarkup, summaryMarkup, varsOf, readLooks } from '../../src/lookpicker.js';

/** A computed style whose tokens name the look `root` is in. @param {{dataset:Record<string,string>}} root */
const styleOf = (root) => /** @type {any} */ ({ getPropertyValue: (/** @type {string} */ k) => ` ${root.dataset.theme}.${root.dataset.appearance}${k} ` });

test('a Light and a Dark tile per theme, grouped by theme in order, each a radio named for both', () => {
  const html = tilesMarkup();
  assert.equal((html.match(/<input type="radio" name="look"/g) ?? []).length, THEMES.length * 2);
  assert.equal((html.match(/class="lookgroup" role="group"/g) ?? []).length, THEMES.length);
  const order = [...html.matchAll(/value="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(order, THEMES.flatMap(t => PREFS.map(p => lookId(t, p))));
  assert.match(html, /<h3 class="lookhead" id="look-plum">Plum<\/h3>/);
  assert.match(html, /aria-labelledby="look-plum"/);
  // The theme is in each radio's name, out of sight, so "Dark" alone is never ambiguous.
  assert.match(html, /value="plum\/dark"><span class="lookprev" aria-hidden="true">[^]*?<span class="lookname"><span class="sr">Plum <\/span>Dark<\/span>/);
});

test('a preview is uncoloured until it is given its look, and is hidden from assistive tech', () => {
  assert.doesNotMatch(previewMarkup(), /style=/);
  assert.match(previewMarkup('--look-bg:#000'), /^<span class="lookprev" aria-hidden="true" style="--look-bg:#000">/);
  assert.equal((previewMarkup().match(/class="lookl"/g) ?? []).length, 3);
});

test('the row summary names the theme and flavour and shows the preview', () => {
  const html = summaryMarkup('grove', 'light', '--look-bg:#123456');
  assert.match(html, /style="--look-bg:#123456"/);
  assert.match(html, /<span class="lookname">Grove · Light<\/span>$/);
});

test('varsOf reads each preview token, trimmed', () => {
  const vars = varsOf(styleOf({ dataset: { theme: 'sticker', appearance: 'light' } }));
  assert.match(vars, /^--look-bg:sticker\.light--bg;--look-surface:sticker\.light--surface;/);
  assert.match(vars, /--look-pill-2:sticker\.light--pill-2$/);
});

test('readLooks tries every look on the root and puts the root back as it was', () => {
  const root = { dataset: /** @type {Record<string,string>} */ ({ theme: 'plum', appearance: 'light', motion: 'reduce' }) };
  const looks = readLooks(root, styleOf);
  assert.equal(looks.size, THEMES.length * 2);
  assert.match(looks.get('grove/dark') ?? '', /^--look-bg:grove\.dark--bg;/);
  assert.match(looks.get('grove/light') ?? '', /^--look-bg:grove\.light--bg;/);
  assert.deepEqual(root.dataset, { theme: 'plum', appearance: 'light', motion: 'reduce' });
  // Absent before (the inline resolver never ran), absent after; and restored on a throw too.
  const bare = { dataset: /** @type {Record<string,string>} */ ({}) };
  readLooks(bare, styleOf, ['grove'], ['dark']);
  assert.deepEqual(bare.dataset, {});
  assert.throws(() => readLooks(root, () => { throw new Error('no style'); }), /no style/);
  assert.deepEqual(root.dataset, { theme: 'plum', appearance: 'light', motion: 'reduce' });
});
