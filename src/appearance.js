// Appearance (light / dark / system). Split like storage.js: the two real decisions
// are pure functions any unit test can call, and every side effect goes through an
// injectable dependency, so nothing here needs a browser to exercise.
//
// This module deliberately knows nothing about the header button or the theme-color
// meta tag — those are page shape, and reach it through the `onApply` callback.
import { defaultStore } from './storage.js';

export const PREF_KEY = 'wordfinder-appearance';
/** The three settings, in the order the header button cycles through them. */
/** @type {readonly ['system','light','dark']} */
export const PREFS = ['system', 'light', 'dark'];

/**
 * @typedef {'system'|'light'|'dark'} Pref
 * @typedef {'light'|'dark'} Mode
 * @typedef {Pick<Storage,'getItem'|'setItem'>} PrefStore
 * @typedef {{matches:boolean, subscribe:(listener:()=>void)=>void}} DarkQuery
 * @typedef {{dataset:{appearance?:string}}} Root
 */

/** @param {string} s @returns {string} */
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Anything unrecognised — a null read, a hand-edited localStorage value, a
 * setting from a future build — falls back to `system` rather than propagating.
 * @param {string|null|undefined} pref @returns {Pref} */
export function normalizePref(pref) {
  return PREFS.some(p => p === pref) ? /** @type {Pref} */ (pref) : 'system';
}

/** The next step in the System -> Light -> Dark -> System cycle.
 * @param {Pref} pref @returns {Pref} */
export function nextPref(pref) {
  const i = PREFS.indexOf(normalizePref(pref));
  return PREFS[(i + 1) % PREFS.length];
}

/** What a preference resolves to; only `system` consults the OS. `prefersDark: null`
 * means there is no OS to ask, which is not "the OS says light" — it falls back to dark,
 * matching styles.css's bare `:root` and index.html's inline resolver.
 * @param {Pref} pref @param {boolean|null} prefersDark @returns {Mode} */
export function resolveAppearance(pref, prefersDark) {
  if (pref === 'light' || pref === 'dark') return pref;
  if (prefersDark === null) return 'dark';
  return prefersDark ? 'dark' : 'light';
}

/** Label for the button's aria-label and tooltip. `System` also reports what it
 * currently resolved to, which is the one case the icon alone can't tell you.
 * @param {Pref} pref @param {Mode} mode @returns {string} */
export function appearanceLabel(pref, mode) {
  return pref === 'system'
    ? `Appearance: System (${title(mode)})`
    : `Appearance: ${title(pref)}`;
}

/** The real prefers-color-scheme query, narrowed to the two things this module
 * needs. Narrowing at the boundary keeps `MediaQueryList` — an overloaded,
 * event-map-keyed DOM type — out of the injectable surface, and lets a unit test
 * hand in a plain object with no DOM in it at all.
 * @returns {DarkQuery|null} */
function systemQuery() {
  if (!globalThis.matchMedia) return null;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  return {
    get matches() { return mq.matches; },
    // Best-effort. addEventListener needs Safari 14+, above this app's ~13.1 floor, so
    // 13.x has only addListener. Neither may throw: start() runs at module scope, so an
    // escape here is a blank page rather than a setting that stops following the OS.
    subscribe(listener) {
      const on = () => listener();
      try {
        if (mq.addEventListener) mq.addEventListener('change', on);
        else if (mq.addListener) mq.addListener(on);
      } catch { /* System won't auto-follow; never fatal */ }
    },
  };
}

/**
 * @param {{store?:PrefStore|null, root?:Root, query?:DarkQuery|null, onApply?:(pref:Pref, mode:Mode)=>void}} [deps]
 */
export function makeAppearance(deps = {}) {
  const store = deps.store === undefined ? defaultStore() : deps.store;
  const root = deps.root || document.documentElement;
  const query = deps.query === undefined ? systemQuery() : deps.query;
  const onApply = deps.onApply || (() => {});

  /** @type {Pref} */
  let pref = 'system';
  // A disabled, full or throwing store must degrade to "appearance not remembered",
  // never into the game — same contract as makeStorage.
  try { pref = normalizePref(store ? store.getItem(PREF_KEY) : null); } catch { pref = 'system'; }

  /** @returns {void} */
  function apply() {
    // `null` (not `false`) when there's no query at all, so "no OS to ask" doesn't
    // get treated as "the OS says light" -- see resolveAppearance's doc comment.
    const mode = resolveAppearance(pref, query ? !!query.matches : null);
    root.dataset.appearance = mode;
    onApply(pref, mode);
  }

  /** @param {Pref} p @returns {void} */
  function set(p) {
    pref = normalizePref(p);
    try { if (store) store.setItem(PREF_KEY, pref); } catch { /* not remembered */ }
    apply();
  }

  // Deliberately plain functions closing over `pref` rather than methods using
  // `this`, so a destructured `const {cycle} = makeAppearance()` still works.
  return {
    /** @returns {Pref} */
    get: () => pref,
    set,
    /** @returns {Pref} */
    cycle() { set(nextPref(pref)); return pref; },
    /** Apply now, then keep following the OS for as long as the preference is `system`.
     * @returns {void} */
    start() {
      apply();
      if (query) query.subscribe(() => { if (pref === 'system') apply(); });
    },
  };
}
