import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUNDS } from '../../src/backgrounds.js';
import { tilesMarkup, summaryMarkup, badgeMarkup } from '../../src/bgpicker.js';

test('one radio tile per registry entry, in order, each a setting of art', () => {
  const html = tilesMarkup();
  const values = [...html.matchAll(/<input type="radio" name="art" value="([\w-]+)" data-setting="art">/g)].map(m => m[1]);
  assert.deepEqual(values, BACKGROUNDS.map(b => b.id));
  assert.equal((html.match(/<label class="tile bgtile"/g) ?? []).length, BACKGROUNDS.length);
  for (const b of BACKGROUNDS) assert.ok(html.includes(`<span class="bgname">${b.name}</span>`), `${b.id}: no name`);
});

test('a new registry entry gets a tile with no other change', () => {
  const extra = { id: 'scene', name: 'Subject scene', animated: false, file: 'scene', glyph: '<circle class="g1" r="4"/>' };
  const html = tilesMarkup([...BACKGROUNDS, extra]);
  assert.ok(html.includes('value="scene"') && html.includes('Subject scene') && html.includes(extra.glyph));
});

test('the badge says Animated or Still, with its own icon', () => {
  const a = badgeMarkup(BACKGROUNDS.find(b => b.animated) ?? BACKGROUNDS[0]);
  const s = badgeMarkup(BACKGROUNDS.find(b => !b.animated) ?? BACKGROUNDS[0]);
  assert.match(a, /data-kind="animated".*Animated<\/span>$/);
  assert.match(s, /data-kind="still".*Still<\/span>$/);
  assert.notEqual(a.replace(/Animated|animated/g, ''), s.replace(/Still|still/g, ''));
});

test('registry names and ids are plain text, safe to put in markup', () => {
  for (const b of BACKGROUNDS) {
    assert.match(b.id, /^[a-z-]+$/);
    assert.doesNotMatch(b.name, /[<>&"]/);
  }
});

test('the row summary names the stored choice, and the default for an unknown one', () => {
  assert.match(summaryMarkup('aurora'), /<svg class="bgglyph".*<span class="bgname">Aurora<\/span>$/);
  assert.match(summaryMarkup('gone'), new RegExp(`<span class="bgname">${BACKGROUNDS[0].name}</span>$`));
});
