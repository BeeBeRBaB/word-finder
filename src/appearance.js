// Appearance (light / dark). Split like storage.js: the one real decision is a pure
// function any unit test can call, and every side effect goes through an injectable
// dependency, so nothing here needs a browser to exercise.
//
// This module deliberately knows nothing about the header button or the theme-color
// meta tag — those are page shape, and reach it through the `onApply` callback.
import { defaultStore } from './storage.js';

export const PREF_KEY = 'wordfinder-appearance';
/** The two settings, in the order the header button toggles through them. */
/** @type {readonly ['light','dark']} */
export const PREFS = ['light', 'dark'];

/**
 * @typedef {'light'|'dark'} Pref
 * @typedef {Pick<Storage,'getItem'|'setItem'>} PrefStore
 * @typedef {{dataset:{appearance?:string}}} Root
 */

/** @param {string} s @returns {string} */
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Anything unrecognised — a null read, a hand-edited value, or the `system` setting this
 * app shipped with until this build — falls back to `dark`, matching styles.css's bare
 * `:root` and index.html's inline resolver. That fallback IS the migration off `system`;
 * there is deliberately no migration code, because `system` is not a value this build can
 * honour and the allowlist already rejects it.
 * @param {string|null|undefined} pref @returns {Pref} */
export function normalizePref(pref) {
  return PREFS.some(p => p === pref) ? /** @type {Pref} */ (pref) : 'dark';
}

/** The other of the two. Total over any input, because it normalizes first.
 * @param {string|null|undefined} pref @returns {Pref} */
export function nextPref(pref) {
  return normalizePref(pref) === 'light' ? 'dark' : 'light';
}

/** Label for the button's aria-label and tooltip. One argument now: with `system` gone a
 * preference IS the resolved mode, so there is no second thing to report.
 * @param {Pref} pref @returns {string} */
export function appearanceLabel(pref) {
  return `Appearance: ${title(pref)}`;
}

/**
 * @param {{store?:PrefStore|null, root?:Root, onApply?:(mode:Pref)=>void}} [deps]
 */
export function makeAppearance(deps = {}) {
  const store = deps.store === undefined ? defaultStore() : deps.store;
  const root = deps.root || document.documentElement;
  const onApply = deps.onApply || (() => {});

  /** @type {Pref} */
  let pref = 'dark';
  // A disabled, full or throwing store must degrade to "appearance not remembered",
  // never into the game — same contract as makeStorage.
  try { pref = normalizePref(store ? store.getItem(PREF_KEY) : null); } catch { pref = 'dark'; }

  /** @returns {void} */
  function apply() {
    root.dataset.appearance = pref;
    onApply(pref);
  }

  /** @param {string} p @returns {void} */
  function set(p) {
    pref = normalizePref(p);
    try { if (store) store.setItem(PREF_KEY, pref); } catch { /* not remembered */ }
    apply();
  }

  // Deliberately plain functions closing over `pref` rather than methods using `this`,
  // so a destructured `const {cycle} = makeAppearance()` still works.
  return {
    /** @returns {Pref} */
    get: () => pref,
    set,
    /** @returns {Pref} */
    cycle() { set(nextPref(pref)); return pref; },
    /** Apply now. Nothing to subscribe to any more: with `system` gone the preference is
     * the mode, so there is no OS query to follow.
     * @returns {void} */
    start() { apply(); },
  };
}
