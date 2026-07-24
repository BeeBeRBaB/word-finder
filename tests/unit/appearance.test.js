import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREFS, PREF_KEY, normalizePref, nextPref, resolveAppearance, appearanceLabel, makeAppearance,
} from '../../src/appearance.js';

function memStore() {
  const m = new Map();
  return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v) };
}
/** A stand-in for the narrowed prefers-color-scheme query. `flipTo` is the test's
 * handle on an OS appearance change; the module only ever sees matches/subscribe. */
function fakeQuery(matches = false) {
  const listeners = [];
  return {
    matches,
    subscribe(l) { listeners.push(l); },
    flipTo(v) { this.matches = v; listeners.forEach(l => l()); },
  };
}
const fakeRoot = () => ({ dataset: {} });

test('the cycle is system -> light -> dark -> system', () => {
  assert.deepEqual([...PREFS], ['system', 'light', 'dark']);
  assert.equal(nextPref('system'), 'light');
  assert.equal(nextPref('light'), 'dark');
  assert.equal(nextPref('dark'), 'system');
});

test('normalizePref falls back to system for anything unrecognised', () => {
  assert.equal(normalizePref('dark'), 'dark');
  assert.equal(normalizePref(null), 'system');
  assert.equal(normalizePref(''), 'system');
  assert.equal(normalizePref('sepia'), 'system');
});

test('resolveAppearance pins light and dark, and defers only for system', () => {
  assert.equal(resolveAppearance('light', true), 'light');
  assert.equal(resolveAppearance('dark', false), 'dark');
  assert.equal(resolveAppearance('system', true), 'dark');
  assert.equal(resolveAppearance('system', false), 'light');
});

test('appearanceLabel names the preference, and what system resolved to', () => {
  assert.equal(appearanceLabel('system', 'dark'), 'Appearance: System (Dark)');
  assert.equal(appearanceLabel('system', 'light'), 'Appearance: System (Light)');
  assert.equal(appearanceLabel('light', 'light'), 'Appearance: Light');
  assert.equal(appearanceLabel('dark', 'dark'), 'Appearance: Dark');
});

test('start() applies the resolved mode to the root element', () => {
  const root = fakeRoot();
  makeAppearance({ store: memStore(), root, query: fakeQuery(true) }).start();
  assert.equal(root.dataset.appearance, 'dark');
});

test('the preference persists and is read back on construction', () => {
  const store = memStore(), query = fakeQuery(true);
  makeAppearance({ store, root: fakeRoot(), query }).set('light');
  assert.equal(store.getItem(PREF_KEY), 'light');

  const root = fakeRoot();
  const a = makeAppearance({ store, root, query });
  a.start();
  assert.equal(a.get(), 'light');
  assert.equal(root.dataset.appearance, 'light', 'a stored preference must beat the OS');
});

test('cycle() advances one step and returns the new preference', () => {
  const a = makeAppearance({ store: memStore(), root: fakeRoot(), query: fakeQuery(false) });
  assert.equal(a.get(), 'system');
  assert.equal(a.cycle(), 'light');
  assert.equal(a.cycle(), 'dark');
  assert.equal(a.cycle(), 'system');
});

test('while system, an OS change repaints; once pinned, it does not', () => {
  const root = fakeRoot(), query = fakeQuery(false);
  const a = makeAppearance({ store: memStore(), root, query });
  a.start();
  assert.equal(root.dataset.appearance, 'light');

  query.flipTo(true);
  assert.equal(root.dataset.appearance, 'dark', 'system must follow the OS');

  a.set('light');
  query.flipTo(false);
  query.flipTo(true);
  assert.equal(root.dataset.appearance, 'light', 'a pinned preference must ignore the OS');
});

test('onApply reports both the preference and the resolved mode', () => {
  /** @type {[string,string][]} */
  const seen = [];
  const a = makeAppearance({
    store: memStore(), root: fakeRoot(), query: fakeQuery(true),
    onApply: (pref, mode) => seen.push([pref, mode]),
  });
  a.start();
  a.set('light');
  assert.deepEqual(seen, [['system', 'dark'], ['light', 'light']]);
});

test('a throwing store degrades to "not remembered" rather than throwing', () => {
  const bad = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
  const root = fakeRoot();
  /** @type {ReturnType<typeof makeAppearance>} */
  let a;
  assert.doesNotThrow(() => { a = makeAppearance({ store: bad, root, query: fakeQuery(true) }); });
  assert.equal(a.get(), 'system');
  assert.doesNotThrow(() => a.set('light'));
  assert.equal(root.dataset.appearance, 'light', 'the setting still applies for this session');
});

test('a missing matchMedia resolves system to light instead of throwing', () => {
  const root = fakeRoot();
  const a = makeAppearance({ store: memStore(), root, query: null });
  assert.doesNotThrow(() => a.start());
  assert.equal(root.dataset.appearance, 'light');
});
