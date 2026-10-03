import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREFS, PREF_KEY, THEMES, THEME_KEY, normalizePref, normalizeTheme, themeName, prefName, makeAppearance,
} from '../../src/appearance.js';
import { memStore } from './helpers.js';

/** @returns {{dataset:Record<string,string>}} */
const fakeRoot = () => ({ dataset: {} });

test('a theme comes in two flavours, light first as the Theme page shows them', () => {
  assert.deepEqual([...PREFS], ['light', 'dark']);
  assert.equal(prefName('light'), 'Light');
  assert.equal(prefName('dark'), 'Dark');
  assert.equal(prefName('sepia'), 'Dark', 'an unknown flavour is named as what it resolves to');
});

test('normalizePref falls back to dark, which is also the migration off the old system setting', () => {
  assert.equal(normalizePref('light'), 'light');
  assert.equal(normalizePref('dark'), 'dark');
  assert.equal(normalizePref('system'), 'dark');
  assert.equal(normalizePref(null), 'dark');
  assert.equal(normalizePref(''), 'dark');
  assert.equal(normalizePref('sepia'), 'dark');
});

test('themes: default first, each listed once, and anything unknown is the default', () => {
  assert.equal(THEMES[0], 'phosphor');
  assert.equal(new Set(THEMES).size, THEMES.length);
  assert.equal(normalizeTheme('grove'), 'grove');
  assert.equal(normalizeTheme('banana'), 'phosphor');
  assert.equal(normalizeTheme(null), 'phosphor');
  assert.equal(themeName('plum'), 'Plum');
  assert.equal(themeName('retired'), 'Phosphor');
});

test('start() applies the default look when nothing is stored', () => {
  const root = fakeRoot();
  /** @type {[string, string][]} */
  const seen = [];
  makeAppearance({ store: memStore(), root, onApply: (m, t) => seen.push([m, t]) }).start();
  assert.deepEqual(root.dataset, { appearance: 'dark', theme: 'phosphor' });
  assert.deepEqual(seen, [['dark', 'phosphor']]);
});

test('setLook applies a theme and its flavour at once, and both are read back on construction', () => {
  const store = memStore();
  const root = fakeRoot();
  /** @type {[string, string][]} */
  const seen = [];
  const a = makeAppearance({ store, root, onApply: (m, t) => seen.push([m, t]) });
  a.start();
  a.setLook('grove', 'light');
  assert.deepEqual(root.dataset, { appearance: 'light', theme: 'grove' });
  assert.deepEqual(seen, [['dark', 'phosphor'], ['light', 'grove']], 'one apply per choice');
  assert.equal(store.getItem(THEME_KEY), 'grove');
  assert.equal(store.getItem(PREF_KEY), 'light');
  const b = makeAppearance({ store, root: fakeRoot() });
  assert.equal(b.getTheme(), 'grove');
  assert.equal(b.get(), 'light');
});

test('a stored or chosen value it does not know is normalized, never applied verbatim', () => {
  const store = memStore();
  store.setItem(PREF_KEY, 'sepia');
  store.setItem(THEME_KEY, 'retired-theme');
  const root = fakeRoot();
  const a = makeAppearance({ store, root });
  a.start();
  assert.deepEqual(root.dataset, { appearance: 'dark', theme: 'phosphor' });
  a.setLook('banana', 'system');
  assert.deepEqual(root.dataset, { appearance: 'dark', theme: 'phosphor' });
  assert.equal(store.getItem(THEME_KEY), 'phosphor');
});

test('a throwing store degrades to "not remembered", and a choice still applies for the session', () => {
  const bad = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
  };
  const root = fakeRoot();
  /** @type {ReturnType<typeof makeAppearance>} */
  let a;
  assert.doesNotThrow(() => { a = makeAppearance({ store: bad, root }); });
  assert.equal(a.get(), 'dark');
  assert.equal(a.getTheme(), 'phosphor');
  assert.doesNotThrow(() => a.setLook('plum', 'light'));
  assert.deepEqual(root.dataset, { appearance: 'light', theme: 'plum' });
});

test('a null store is accepted and simply does not persist', () => {
  const root = fakeRoot();
  const a = makeAppearance({ store: null, root });
  a.start();
  a.setLook('sticker', 'light');
  assert.equal(a.get(), 'light');
  assert.equal(a.getTheme(), 'sticker');
  assert.deepEqual(root.dataset, { appearance: 'light', theme: 'sticker' });
});
