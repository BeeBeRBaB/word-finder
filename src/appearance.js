// Appearance: the theme and its flavour, light or dark, chosen together as one look. Split
// like storage.js: the decisions are pure functions any unit test can call, and every side
// effect goes through an injectable dependency, so nothing here needs a browser.
//
// This module knows nothing about the Theme page or the theme-color meta tag; those are
// page shape, and reach it through the `onApply` callback.
import { defaultStore } from './storage.js';

export const PREF_KEY = 'wordfinder-appearance';
/** A theme's two flavours, in the order its Theme page tiles show them. */
/** @type {readonly ['light','dark']} */
export const PREFS = ['light', 'dark'];

export const THEME_KEY = 'wordfinder-theme';
/** Every theme, default first, in Theme page order: a phone shows two to a row, so each
 * neighbour shares a style. Each has its own fixed colours, a dark and a light block in
 * styles.css, except the default, which is the base blocks themselves.
 * @type {readonly string[]} */
export const THEMES = ['phosphor', 'graphite', 'broadsheet', 'drafting', 'sticker', 'plum', 'grove'];

/**
 * @typedef {'light'|'dark'} Pref
 * @typedef {Pick<Storage,'getItem'|'setItem'>} PrefStore
 * @typedef {{dataset:{appearance?:string, theme?:string}}} Root
 */

/** @param {string} s @returns {string} */
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Anything unrecognised (a null read, a hand-edited value, or the `system` setting this app
 * once had) falls back to `dark`, matching styles.css's bare `:root` and index.html's inline
 * resolver. That fallback is the migration: the allowlist rejects what it cannot honour.
 * @param {string|null|undefined} pref @returns {Pref} */
export function normalizePref(pref) {
  return PREFS.some(p => p === pref) ? /** @type {Pref} */ (pref) : 'dark';
}

/** Same contract as normalizePref: an unknown or retired theme falls back to the default,
 * matching index.html's inline resolver.
 * @param {string|null|undefined} theme @returns {string} */
export function normalizeTheme(theme) {
  return THEMES.find(t => t === theme) ?? THEMES[0];
}

/** @param {string} theme @returns {string} the theme's display name */
export const themeName = (theme) => title(normalizeTheme(theme));

/** @param {string} pref @returns {string} the flavour's display name, Light or Dark */
export const prefName = (pref) => title(normalizePref(pref));

/**
 * @param {{store?:PrefStore|null, root?:Root, onApply?:(mode:Pref, theme:string)=>void}} [deps]
 */
export function makeAppearance(deps = {}) {
  const store = deps.store === undefined ? defaultStore() : deps.store;
  const root = deps.root || document.documentElement;
  const onApply = deps.onApply || (() => {});

  // A disabled, full or throwing store must degrade to "appearance not remembered",
  // never into the game: same contract as makeStorage.
  /** @param {string} key @returns {string|null} */
  const read = (key) => { try { return store ? store.getItem(key) : null; } catch { return null; } };
  let pref = normalizePref(read(PREF_KEY));
  let theme = normalizeTheme(read(THEME_KEY));

  /** @returns {void} */
  function apply() {
    root.dataset.appearance = pref;
    root.dataset.theme = theme;
    onApply(pref, theme);
  }

  // Plain functions closing over the state rather than methods using `this`, so a
  // destructured `const {setLook} = makeAppearance()` still works.
  return {
    /** @returns {Pref} */
    get: () => pref,
    /** @returns {string} */
    getTheme: () => theme,
    /** A theme in one of its flavours, chosen as one tile on the Theme page and applied once.
     * @param {string} t @param {string} p @returns {void} */
    setLook(t, p) {
      theme = normalizeTheme(t);
      pref = normalizePref(p);
      try { if (store) { store.setItem(THEME_KEY, theme); store.setItem(PREF_KEY, pref); } } catch { /* not remembered */ }
      apply();
    },
    /** @returns {void} */
    start() { apply(); },
  };
}
