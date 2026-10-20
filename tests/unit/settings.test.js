import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSettings, normalizeSettings, pickStyle, DEFAULTS, CHOICES, SETTINGS_KEY, STYLES } from '../../src/settings.js';
import { memStore } from './helpers.js';

test('a first visit gets the defaults', () => {
  assert.deepEqual(makeSettings({ store: memStore() }).get(), { ...DEFAULTS });
  assert.equal(DEFAULTS.art, 'drift');
  assert.equal(DEFAULTS.board, 'auto');
  assert.equal(DEFAULTS.difficulty, 'normal');
  assert.equal(DEFAULTS.play, 'random', 'levels are opt-in');
  assert.equal(DEFAULTS.bgmode, 'theme', 'each theme brings its own background');
});

test('the background is chosen by theme, at random or by hand, and the choice is remembered', () => {
  assert.deepEqual(CHOICES.bgmode, ['theme', 'random', 'manual']);
  const store = memStore();
  makeSettings({ store }).set('bgmode', 'random');
  assert.equal(makeSettings({ store }).get().bgmode, 'random');
  assert.equal(normalizeSettings({ bgmode: 'daily', art: 'drift' }).bgmode, 'manual');
  assert.equal(normalizeSettings({ bgmode: 'daily' }).bgmode, 'theme');
});

test('a record from before the mode keeps a background the player picked', () => {
  /** @param {object} rec */
  const from = (rec) => { const store = memStore(); store.setItem(SETTINGS_KEY, JSON.stringify(rec)); return makeSettings({ store }).get(); };
  assert.deepEqual([from({ art: 'snow', area: 'list' }).bgmode, from({ art: 'snow' }).art], ['manual', 'snow']);
  assert.equal(from({ art: 'drift' }).bgmode, 'manual', 'today\'s default was a pick then');
  assert.equal(from({ art: 'illustrated', area: 'list' }).bgmode, 'theme', 'the old default is no pick');
  assert.equal(from({ art: 'none' }).bgmode, 'theme', 'nor is a still one, gone since');
  assert.equal(from({ art: 'gone' }).bgmode, 'theme', 'nor is one this build does not have');
  assert.equal(from({ sound: false }).bgmode, 'theme');
  // A stored mode stands, whatever the art.
  assert.equal(from({ art: 'snow', bgmode: 'theme' }).bgmode, 'theme');
  assert.equal(from({ art: 'koi', bgmode: 'manual' }).bgmode, 'manual');
  // The retired Background area is dropped, whichever it was, and nothing else with it.
  const old = from({ bgmode: 'manual', art: 'snow', area: 'list', sound: false });
  assert.equal('area' in old, false);
  assert.deepEqual([old.bgmode, old.art, old.sound], ['manual', 'snow', false]);
});

test('the New game side is remembered, and only random or levels', () => {
  const store = memStore();
  makeSettings({ store }).set('play', 'levels');
  assert.equal(makeSettings({ store }).get().play, 'levels');
  assert.deepEqual(CHOICES.play, ['random', 'levels']);
  assert.equal(normalizeSettings({ play: 'daily' }).play, 'random');
});

test('a change persists and is read back', () => {
  const store = memStore();
  const s = makeSettings({ store });
  s.set('board', 'compact');
  s.set('sound', false);
  s.set('difficulty', 'easy');
  const again = makeSettings({ store }).get();
  assert.equal(again.board, 'compact');
  assert.equal(again.sound, false);
  assert.equal(again.difficulty, 'easy');
});

test('an invalid value is ignored, never stored', () => {
  const store = memStore();
  const s = makeSettings({ store });
  s.set('board', 'compact');
  s.set('sound', false);
  s.set('board', /** @type {any} */ ('huge'));
  s.set('sound', /** @type {any} */ ('yes'));
  assert.deepEqual([s.get().board, s.get().sound], ['compact', false], 'the choice before it stands');
  assert.deepEqual([makeSettings({ store }).get().board, makeSettings({ store }).get().sound], ['compact', false]);
});

test('one bad field never costs the others', () => {
  const n = normalizeSettings({ board: 'full', letters: 'giant', vibrate: false, motion: 'reduce', extra: 1 });
  assert.equal(n.board, 'full');
  assert.equal(n.letters, 'normal');
  assert.equal(n.vibrate, false);
  assert.equal(n.motion, 'reduce');
  assert.equal(/** @type {any} */ (n).extra, undefined);
  assert.deepEqual(normalizeSettings(null), { ...DEFAULTS });
  assert.deepEqual(normalizeSettings('nope'), { ...DEFAULTS });
});

test('garbled or throwing storage degrades to the defaults', () => {
  const garbled = memStore(); garbled.setItem(SETTINGS_KEY, '{not json');
  assert.deepEqual(makeSettings({ store: garbled }).get(), { ...DEFAULTS });
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = makeSettings({ store: bad });
  assert.deepEqual(s.get(), { ...DEFAULTS });
  assert.equal(s.set('sound', false).sound, false, 'applies for the session even though it cannot be stored');
  assert.equal(makeSettings({ store: null }).set('reveal', false).reveal, false);
});

test('the auto-start setting shipped before this record is carried over', () => {
  const store = memStore(); store.setItem('wordfinder-autonext', 'off');
  assert.equal(makeSettings({ store }).get().autoNext, false);
});

test('get() is a copy', () => {
  const s = makeSettings({ store: memStore() });
  const g = s.get(); g.sound = false;
  assert.equal(s.get().sound, true);
  for (const [k, list] of Object.entries(CHOICES)) assert.equal(/** @type {any} */ (DEFAULTS)[k], list[0], `${k}: default is not first`);
});

// The still backgrounds are gone (2026-10-20): a Manual pick of one shows the theme's own, and the
// record drops the two picks Manual used to keep.
test('a still pick falls back to the theme\'s background, and the Still and Animated picks are dropped', () => {
  for (const art of ['illustrated', 'scene', 'none']) {
    const s = normalizeSettings({ bgmode: 'manual', art, still: art, moving: 'koi' });
    assert.deepEqual([s.bgmode, s.art], ['theme', DEFAULTS.art], art);
    assert.equal('still' in s || 'moving' in s, false);
  }
  // Under Theme or Random a still Manual pick only resets the pick.
  assert.equal(normalizeSettings({ bgmode: 'random', art: 'scene' }).bgmode, 'random');
  const s = makeSettings({ store: memStore() });
  s.set('art', 'bokeh');
  s.set('art', /** @type {any} */ ('scene'));
  assert.equal(s.get().art, 'bokeh', 'a still id is no pick');
});

test('the style is Beads unless chosen; Random picks one per deal by its seed, never the last', () => {
  assert.equal(DEFAULTS.style, 'beads');
  assert.deepEqual(CHOICES.style, [...STYLES, 'random']);
  assert.equal(pickStyle('glass', 1, 'glass'), 'glass', 'a chosen style is shown whatever the last one was');
  assert.equal(pickStyle('nope', 1), 'beads');
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const prev = STYLES[seed % 3], s = pickStyle('random', seed, prev);
    assert.notEqual(s, prev);
    assert.equal(pickStyle('random', seed, prev), s, 'the same deal picks the same style');
    seen.add(s);
  }
  assert.deepEqual([...seen].sort(), [...STYLES].sort(), 'Random reaches every style');
  assert.ok(STYLES.includes(pickStyle('random', 7)), 'a first deal picks from all three');
});
