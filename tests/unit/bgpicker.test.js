import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUNDS, lookOf } from '../../src/backgrounds.js';
import { CHOICES } from '../../src/settings.js';
import { manualMarkup, dropMarkup, modeNote, summaryMarkup, movingSections, MODE_NOTES, MOVING_SECTIONS } from '../../src/bgpicker.js';

/** @param {string} html @param {string} name @returns {string[]} the radios' values, in order */
const values = (html, name) => [...html.matchAll(new RegExp(`<input type="radio" name="${name}" value="([\\w-]+)">`, 'g'))].map(m => m[1]);

test('one row, a dropdown and its menu of every background, by section', () => {
  const html = manualMarkup();
  assert.ok(html.startsWith('<div class="row"><span class="panelabel" id="bghead">Background</span>'
    + '<button type="button" class="navrow bgdrop" id="bgdrop" aria-expanded="false" aria-controls="bgmenu" aria-labelledby="bghead bgnow">'));
  assert.ok(html.includes('<div class="bgmenu" id="bgmenu" role="radiogroup" aria-labelledby="bghead" hidden>'));
  assert.deepEqual(values(html, 'bg'), movingSections(BACKGROUNDS).flatMap(([, bgs]) => bgs.map(b => b.id)));
  assert.equal(values(html, 'bg').length, BACKGROUNDS.length);
  assert.equal((html.match(/<label class="tile bgtile"/g) ?? []).length, BACKGROUNDS.length);
  for (const b of BACKGROUNDS) assert.ok(html.includes(`<span class="bgname">${b.name}</span>`), `${b.id}: no name`);
});

test('the menu is cut into sections, icon motions first, every background in exactly one', () => {
  const sections = movingSections(BACKGROUNDS);
  assert.deepEqual(sections.map(([name]) => name), ['Subject icons', ...MOVING_SECTIONS.map(([name]) => name)], 'nothing falls under More');
  assert.deepEqual(sections[0][1], BACKGROUNDS.filter(b => b.perDeal));
  const ids = sections.flatMap(([, bgs]) => bgs.map(b => b.id));
  assert.equal(new Set(ids).size, ids.length, 'a background in two sections');
  assert.deepEqual([...ids].sort(), BACKGROUNDS.map(b => b.id).sort());
  const listed = MOVING_SECTIONS.flatMap(([, list]) => list);
  assert.equal(new Set(listed).size, listed.length, 'an id listed twice');
  for (const id of listed) assert.ok(BACKGROUNDS.some(b => b.id === id && !b.perDeal), `${id}: not a scene`);
  assert.deepEqual([...manualMarkup().matchAll(/<h3 class="bggroup">([^<]+)<\/h3>/g)].map(m => m[1]), sections.map(([name]) => name));
});

test('every motion Subject motion can run has an option of its own', async () => {
  const { MOTIONS } = await import('../../src/backgrounds/subject-motion.js');
  const files = BACKGROUNDS.map(b => b.file);
  for (const [id, file] of Object.entries(MOTIONS)) assert.ok(files.includes(file), `${id}: no option`);
});

test('a new registry entry gets an option with no other change', () => {
  const entry = { id: 'test-run', name: 'Test run', file: 'test-run', glyph: '<circle class="g8" r="4"/>' };
  assert.ok(!manualMarkup().includes('test-'), 'the stand-in entry must not already exist');
  const html = manualMarkup([...BACKGROUNDS, entry]);
  assert.equal(values(html, 'bg').at(-1), 'test-run');
  assert.ok(html.includes('<h3 class="bggroup">More</h3><label class="tile bgtile" data-bg="test-run">'), 'an unlisted scene goes under More');
  assert.ok(html.includes('<span class="bgname">Test run</span>') && html.includes(entry.glyph));
});

test('a dropdown shows its pick\'s picture and name', () => {
  assert.match(dropMarkup('snow'), /^<svg class="bgglyph" viewBox="0 0 48 32" aria-hidden="true" style="--gbd:[^"]+">.*<\/svg><span class="bgname">Snowfall<\/span>$/);
  // In the background's own colours, both flavours for the stylesheet to choose.
  for (const [k, pref] of [['d', 'dark'], ['l', 'light']]) {
    assert.ok(dropMarkup('snow').includes(`--gb${k}:${lookOf('snow', pref).ground};`), pref);
    assert.ok(dropMarkup('snow').includes(`--g1${k}:${lookOf('snow', pref).colors[0]};`), pref);
  }
  assert.match(dropMarkup('gone'), new RegExp(`<span class="bgname">${BACKGROUNDS[0].name}</span>$`));
});

test('registry names and ids are plain text, safe to put in markup', () => {
  for (const b of BACKGROUNDS) {
    assert.match(b.id, /^[a-z-]+$/);
    assert.doesNotMatch(b.name, /[<>&"]/);
  }
});

test('the row summary names the background showing, and says Theme or Random under it', () => {
  assert.match(summaryMarkup('snow'), /^<svg class="bgglyph".*<span class="bgsum"><span class="bgname">Snowfall<\/span><\/span>$/);
  assert.equal(summaryMarkup('snow', 'manual'), summaryMarkup('snow'), 'Manual has no tag');
  assert.match(summaryMarkup('galaxy', 'theme'), /<span class="bgname">Galaxy<\/span><span class="bgtag">Theme<\/span><\/span>$/);
  assert.match(summaryMarkup('bokeh', 'random'), /<span class="bgname">Silk bokeh<\/span><span class="bgtag">Random<\/span><\/span>$/);
  assert.match(summaryMarkup('gone'), new RegExp(`<span class="bgname">${BACKGROUNDS[0].name}</span></span>$`));
});

test('every mode has a one-line note, and Theme and Random name what they show', () => {
  assert.deepEqual(Object.keys(MODE_NOTES), [...CHOICES.bgmode]);
  assert.equal(modeNote('theme', 'galaxy'), 'Each theme comes with its own background. Now: Galaxy.');
  assert.equal(modeNote('random', 'bokeh'), 'A new background with every game. Now: Silk bokeh.');
  assert.equal(modeNote('manual', 'bokeh'), 'The one you pick shows with every game.');
});
