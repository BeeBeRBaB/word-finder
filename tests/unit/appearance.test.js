import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREFS, PREF_KEY, normalizePref, nextPref, appearanceLabel, makeAppearance,
} from '../../src/appearance.js';
import { memStore } from './helpers.js';

const fakeRoot = () => ({ dataset: {} });

test('there are exactly two preferences and they toggle', () => {
  assert.deepEqual([...PREFS], ['light', 'dark']);
  assert.equal(nextPref('light'), 'dark');
  assert.equal(nextPref('dark'), 'light');
});

test('nextPref is total: anything unrecognised normalizes first', () => {
  assert.equal(nextPref('system'), 'light', 'system normalizes to dark, whose next is light');
  assert.equal(nextPref('sepia'), 'light');
  assert.equal(nextPref(null), 'light');
});

test('normalizePref falls back to dark, which is also the system migration', () => {
  assert.equal(normalizePref('light'), 'light');
  assert.equal(normalizePref('dark'), 'dark');
  assert.equal(normalizePref('system'), 'dark', 'the old third setting must land on dark');
  assert.equal(normalizePref(null), 'dark');
  assert.equal(normalizePref(''), 'dark');
  assert.equal(normalizePref('sepia'), 'dark');
});

test('appearanceLabel names the preference', () => {
  assert.equal(appearanceLabel('light'), 'Appearance: Light');
  assert.equal(appearanceLabel('dark'), 'Appearance: Dark');
});

test('start() applies the preference to the root element', () => {
  const root = fakeRoot();
  makeAppearance({ store: memStore(), root }).start();
  assert.equal(root.dataset.appearance, 'dark', 'no stored preference means dark');
});

test('the preference persists and is read back on construction', () => {
  const store = memStore();
  makeAppearance({ store, root: fakeRoot() }).set('light');
  assert.equal(store.getItem(PREF_KEY), 'light');

  const root = fakeRoot();
  const a = makeAppearance({ store, root });
  a.start();
  assert.equal(a.get(), 'light');
  assert.equal(root.dataset.appearance, 'light');
});

test('a stored value from a future build is normalized, never applied verbatim', () => {
  const store = memStore();
  store.setItem(PREF_KEY, 'sepia');
  const root = fakeRoot();
  makeAppearance({ store, root }).start();
  assert.equal(root.dataset.appearance, 'dark');
});

test('cycle() flips and returns the new preference', () => {
  const a = makeAppearance({ store: memStore(), root: fakeRoot() });
  assert.equal(a.get(), 'dark');
  assert.equal(a.cycle(), 'light');
  assert.equal(a.cycle(), 'dark');
});

test('onApply reports the resolved mode', () => {
  /** @type {string[]} */
  const seen = [];
  const a = makeAppearance({ store: memStore(), root: fakeRoot(), onApply: (m) => seen.push(m) });
  a.start();
  a.set('light');
  assert.deepEqual(seen, ['dark', 'light']);
});

test('a throwing store degrades to "not remembered" rather than throwing', () => {
  const bad = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
  };
  const root = fakeRoot();
  /** @type {ReturnType<typeof makeAppearance>} */
  let a;
  assert.doesNotThrow(() => { a = makeAppearance({ store: bad, root }); });
  assert.equal(a.get(), 'dark');
  assert.doesNotThrow(() => a.set('light'));
  assert.equal(root.dataset.appearance, 'light', 'the setting still applies for this session');
});

test('a null store is accepted and simply does not persist', () => {
  const root = fakeRoot();
  const a = makeAppearance({ store: null, root });
  a.start();
  a.set('light');
  assert.equal(a.get(), 'light');
  assert.equal(root.dataset.appearance, 'light');
});

test('themes: default first, unknown values normalize to it, and a choice persists', async () => {
  const { THEMES, THEME_KEY, normalizeTheme, themeName } = await import('../../src/appearance.js');
  assert.equal(THEMES[0], 'phosphor');
  assert.equal(normalizeTheme('grove'), 'grove');
  assert.equal(normalizeTheme('banana'), 'phosphor');
  assert.equal(normalizeTheme(null), 'phosphor');
  assert.equal(themeName('plum'), 'Plum');
  const store = memStore();
  const root = fakeRoot();
  /** @type {[string, string][]} */
  const seen = [];
  const a = makeAppearance({ store, root, onApply: (m, t) => seen.push([m, t]) });
  a.start();
  assert.equal(/** @type {any} */ (root).dataset.theme, 'phosphor');
  a.setLook('sticker', 'classic');
  assert.equal(store.getItem(THEME_KEY), 'sticker');
  assert.equal(/** @type {any} */ (root).dataset.theme, 'sticker');
  assert.deepEqual(seen.at(-1), ['dark', 'sticker']);
  const b = makeAppearance({ store, root: fakeRoot() });
  assert.equal(b.getTheme(), 'sticker', 'read back on construction');
  a.setLook('retired-theme', 'classic');
  assert.equal(a.getTheme(), 'phosphor');
});

test('a throwing store still yields the default theme', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const a = makeAppearance({ store: bad, root: fakeRoot() });
  assert.equal(a.getTheme(), 'phosphor');
  a.setLook('plum', 'classic');
  assert.equal(a.getTheme(), 'plum', 'applied for the session even though it cannot be stored');
});

test('palettes: default first, unknown values normalize to it, and a choice persists and is applied', async () => {
  const { PALETTES, PALETTE_KEY, normalizePalette, paletteName } = await import('../../src/appearance.js');
  assert.equal(PALETTES[0], 'classic');
  assert.equal(normalizePalette('jewel'), 'jewel');
  assert.equal(normalizePalette('neon'), 'classic');
  assert.equal(normalizePalette(undefined), 'classic');
  assert.equal(paletteName('duotone'), 'Duotone');
  const store = memStore();
  const root = fakeRoot();
  /** @type {string[]} */
  const seen = [];
  const a = makeAppearance({ store, root, onApply: (_m, _t, p) => seen.push(p) });
  a.start();
  assert.equal(/** @type {any} */ (root).dataset.palette, 'classic');
  a.setLook('grove', 'calm');
  assert.equal(store.getItem(PALETTE_KEY), 'calm');
  assert.equal(/** @type {any} */ (root).dataset.palette, 'calm');
  assert.equal(/** @type {any} */ (root).dataset.theme, 'grove');
  assert.deepEqual(seen, ['classic', 'calm'], 'a theme and palette together apply once');
  assert.equal(makeAppearance({ store, root: fakeRoot() }).getPalette(), 'calm', 'read back on construction');
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const b = makeAppearance({ store: bad, root: fakeRoot() });
  assert.equal(b.getPalette(), 'classic');
  b.setLook('phosphor', 'jewel');
  assert.equal(b.getPalette(), 'jewel', 'applied for the session even though it cannot be stored');
});
