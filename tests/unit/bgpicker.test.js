import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUNDS } from '../../src/backgrounds.js';
import { CHOICES } from '../../src/settings.js';
import { manualMarkup, dropMarkup, modeNote, summaryMarkup, MODE_NOTES, KINDS } from '../../src/bgpicker.js';

/** @param {string} html @param {string} name @returns {string[]} the radios' values, in order */
const values = (html, name) => [...html.matchAll(new RegExp(`<input type="radio" name="${name}" value="([\\w-]+)">`, 'g'))].map(m => m[1]);

test('a Still row then an Animated one, each a radio, a dropdown and its menu of that kind in registry order', () => {
  const html = manualMarkup();
  const rows = html.split('<div class="row bgkind"').slice(1);
  assert.equal(rows.length, 2);
  assert.deepEqual(values(html, 'bgkind'), ['still', 'moving']);
  assert.match(rows[0], /^ data-kind="still"><label class="bgpick"><input type="radio" name="bgkind" value="still"><span class="panelabel" id="bghead-still">Still<\/span><\/label>/);
  assert.match(rows[1], /^ data-kind="moving"><label class="bgpick"><input type="radio" name="bgkind" value="moving"><span class="panelabel" id="bghead-moving">Animated<\/span><\/label>/);
  for (const [kind] of KINDS) {
    assert.ok(html.includes(`<button type="button" class="navrow bgdrop" id="bgdrop-${kind}" aria-expanded="false" aria-controls="bgmenu-${kind}" aria-labelledby="bghead-${kind} bgnow-${kind}">`));
    assert.ok(html.includes(`<div class="bgmenu" id="bgmenu-${kind}" role="radiogroup" aria-labelledby="bghead-${kind}" hidden>`));
  }
  assert.deepEqual(values(rows[0], 'bg-still'), BACKGROUNDS.filter(b => !b.animated).map(b => b.id));
  assert.deepEqual(values(rows[1], 'bg-moving'), BACKGROUNDS.filter(b => b.animated).map(b => b.id));
  assert.deepEqual(values(html, 'bg-still'), ['illustrated', 'pixel', 'scene', 'none']);
  assert.equal(values(html, 'bg-moving').length, 23);
  assert.equal((html.match(/<label class="tile bgtile"/g) ?? []).length, BACKGROUNDS.length);
  for (const b of BACKGROUNDS) assert.ok(html.includes(`<span class="bgname">${b.name}</span>`), `${b.id}: no name`);
});

test('every motion Subject motion can run has an option of its own', async () => {
  const { MOTIONS } = await import('../../src/backgrounds/subject-motion.js');
  const files = BACKGROUNDS.map(b => b.file);
  for (const [id, file] of Object.entries(MOTIONS)) assert.ok(files.includes(file), `${id}: no option`);
});

test('a new registry entry gets an option in the right menu with no other change', () => {
  const still = { id: 'test-bg', name: 'Test ground', animated: false, file: 'test-bg', glyph: '<circle class="g9" r="4"/>' };
  const moving = { id: 'test-run', name: 'Test run', animated: true, file: 'test-run', glyph: '<circle class="g8" r="4"/>' };
  assert.ok(!manualMarkup().includes('test-'), 'the stand-in entries must not already exist');
  const rows = manualMarkup([...BACKGROUNDS, still, moving]).split('<div class="row bgkind"').slice(1);
  assert.equal(values(rows[0], 'bg-still').at(-1), 'test-bg');
  assert.equal(values(rows[1], 'bg-moving').at(-1), 'test-run');
  assert.ok(rows[0].includes('<span class="bgname">Test ground</span>') && rows[0].includes(still.glyph));
  assert.ok(!rows[1].includes('test-bg') && !rows[0].includes('test-run'));
});

test('a dropdown shows its pick\'s picture and name', () => {
  assert.match(dropMarkup('aurora'), /^<svg class="bgglyph" viewBox="0 0 48 32" aria-hidden="true">.*<\/svg><span class="bgname">Aurora<\/span>$/);
  assert.match(dropMarkup('gone'), new RegExp(`<span class="bgname">${BACKGROUNDS[0].name}</span>$`));
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

test('every mode has a one-line note, and Theme and Random name what they show', () => {
  assert.deepEqual(Object.keys(MODE_NOTES), [...CHOICES.bgmode]);
  assert.equal(modeNote('theme', 'starfield'), 'Each theme comes with its own background. Now: Starfield.');
  assert.equal(modeNote('random', 'bokeh'), 'A new background with every game. Now: Silk bokeh.');
  assert.equal(modeNote('manual', 'bokeh'), 'Pick a still and an animated one, and which of the two shows.');
});
