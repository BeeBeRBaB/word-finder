import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSettings, normalizeSettings, DEFAULTS, CHOICES, SETTINGS_KEY } from '../../src/settings.js';
import { memStore } from './helpers.js';

test('a first visit gets the defaults', () => {
  assert.deepEqual(makeSettings({ store: memStore() }).get(), { ...DEFAULTS });
  assert.equal(DEFAULTS.art, 'illustrated');
  assert.equal(DEFAULTS.board, 'auto');
  assert.equal(DEFAULTS.difficulty, 'normal');
  assert.equal(DEFAULTS.play, 'random', 'levels are opt-in');
  assert.equal(DEFAULTS.bgmode, 'theme', 'each theme brings its own background');
  assert.equal(DEFAULTS.area, 'full');
});

test('the background is chosen by theme, at random or by hand, and the choice is remembered', () => {
  assert.deepEqual(CHOICES.bgmode, ['theme', 'random', 'manual']);
  const store = memStore();
  makeSettings({ store }).set('bgmode', 'random');
  assert.equal(makeSettings({ store }).get().bgmode, 'random');
  assert.equal(normalizeSettings({ bgmode: 'daily', art: 'illustrated' }).bgmode, 'theme');
});

test('a record from before the mode keeps a background the player picked', () => {
  /** @param {object} rec */
  const from = (rec) => { const store = memStore(); store.setItem(SETTINGS_KEY, JSON.stringify(rec)); return makeSettings({ store }).get(); };
  assert.deepEqual([from({ art: 'aurora', area: 'list' }).bgmode, from({ art: 'aurora' }).art], ['manual', 'aurora']);
  assert.equal(from({ art: 'none' }).bgmode, 'manual', 'None was a pick too');
  assert.equal(from({ art: 'illustrated', area: 'list' }).bgmode, 'theme', 'the old default is no pick');
  assert.equal(from({ art: 'gone' }).bgmode, 'theme', 'nor is one this build does not have');
  assert.equal(from({ sound: false }).bgmode, 'theme');
  // A stored mode stands, whatever the art.
  assert.equal(from({ art: 'aurora', bgmode: 'theme' }).bgmode, 'theme');
  assert.equal(from({ art: 'illustrated', bgmode: 'manual' }).bgmode, 'manual');
  // A stored area stays as it was; only a new player gets Full screen.
  assert.equal(from({ art: 'aurora', area: 'list' }).area, 'list');
  assert.equal(makeSettings({ store: memStore() }).get().area, 'full');
  // A record from before the area had the art where Word list puts it.
  assert.deepEqual([from({ art: 'pixel', sound: true }).area, from({ art: 'illustrated' }).area], ['list', 'list']);
  assert.equal(from({ art: 'pixel', bgmode: 'manual' }).area, 'full', 'only a record from before the mode is migrated');
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
