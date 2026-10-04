import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUNDS } from '../../src/backgrounds.js';
import { CHOICES } from '../../src/settings.js';
import { tilesMarkup, summaryMarkup, MODE_NOTES } from '../../src/bgpicker.js';

/** @param {string} html @returns {string[]} the radios' values, in order */
const values = (html) => [...html.matchAll(/<input type="radio" name="art" value="([\w-]+)">/g)].map(m => m[1]);

test('a Still group then an Animated one, each a labelled group of tiles in registry order', () => {
  const html = tilesMarkup();
  const groups = html.split('<div class="bggroup"').slice(1);
  assert.equal(groups.length, 2);
  assert.match(groups[0], /^ role="group" aria-labelledby="bghead-still" data-kind="still"><h3 class="bghead" id="bghead-still">Still<\/h3>/);
  assert.match(groups[1], /^ role="group" aria-labelledby="bghead-animated" data-kind="animated"><h3 class="bghead" id="bghead-animated">Animated<\/h3>/);
  assert.deepEqual(values(groups[0]), BACKGROUNDS.filter(b => !b.animated).map(b => b.id));
  assert.deepEqual(values(groups[1]), BACKGROUNDS.filter(b => b.animated).map(b => b.id));
  assert.deepEqual(values(groups[0]), ['illustrated', 'pixel', 'scene', 'none']);
  assert.equal(values(groups[1]).length, 10);
  // One name across both groups, so the arrow keys run through every tile.
  assert.equal(values(html).length, BACKGROUNDS.length);
  assert.equal((html.match(/<label class="tile bgtile"/g) ?? []).length, BACKGROUNDS.length);
  for (const b of BACKGROUNDS) assert.ok(html.includes(`<span class="bgname">${b.name}</span>`), `${b.id}: no name`);
  // The group says Still or Animated, so a tile no longer does.
  assert.doesNotMatch(html, /bgbadge/);
});

test('a new registry entry gets a tile in the right group with no other change', () => {
  const still = { id: 'test-bg', name: 'Test ground', animated: false, file: 'test-bg', glyph: '<circle class="g9" r="4"/>' };
  const moving = { id: 'test-run', name: 'Test run', animated: true, file: 'test-run', glyph: '<circle class="g8" r="4"/>' };
  assert.ok(!tilesMarkup().includes('test-'), 'the stand-in entries must not already exist');
  const groups = tilesMarkup([...BACKGROUNDS, still, moving]).split('<div class="bggroup"').slice(1);
  assert.equal(values(groups[0]).at(-1), 'test-bg');
  assert.equal(values(groups[1]).at(-1), 'test-run');
  assert.ok(groups[0].includes('<span class="bgname">Test ground</span>') && groups[0].includes(still.glyph));
  assert.ok(!groups[1].includes('test-bg') && !groups[0].includes('test-run'));
});

test('registry names and ids are plain text, safe to put in markup', () => {
  for (const b of BACKGROUNDS) {
    assert.match(b.id, /^[a-z-]+$/);
    assert.doesNotMatch(b.name, /[<>&"]/);
  }
});

test('the row summary names the background showing, and says Theme or Random under it', () => {
  assert.match(summaryMarkup('aurora'), /^<svg class="bgglyph".*<span class="bgsum"><span class="bgname">Aurora<\/span><\/span>$/);
  assert.equal(summaryMarkup('aurora', 'manual'), summaryMarkup('aurora'), 'Manual has no tag');
  assert.match(summaryMarkup('starfield', 'theme'), /<span class="bgname">Starfield<\/span><span class="bgtag">Theme<\/span><\/span>$/);
  assert.match(summaryMarkup('bokeh', 'random'), /<span class="bgname">Silk bokeh<\/span><span class="bgtag">Random<\/span><\/span>$/);
  assert.match(summaryMarkup('gone'), new RegExp(`<span class="bgname">${BACKGROUNDS[0].name}</span></span>$`));
});

test('every mode has a one-line note', () => {
  assert.deepEqual(Object.keys(MODE_NOTES), [...CHOICES.bgmode]);
  assert.equal(MODE_NOTES.theme, 'Each theme comes with its own background.');
  assert.equal(MODE_NOTES.random, 'A new background with every game.');
  assert.equal(MODE_NOTES.manual, 'The one you pick below.');
});
