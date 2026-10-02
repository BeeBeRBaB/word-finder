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

export const THEME_KEY = 'wordfinder-theme';
/** Every theme, default first. Each has a dark and a light block in styles.css except the
 * default, which is the base palettes themselves; tokens.test.js holds the two in step.
 * @type {readonly string[]} */
export const THEMES = ['phosphor', 'broadsheet', 'sticker', 'drafting', 'grove', 'plum', 'graphite'];

export const PALETTE_KEY = 'wordfinder-palette';
/** Colour sets every theme comes in, default first. The default is the theme blocks
 * themselves; each other one has a [data-palette] block per theme and mode in styles.css.
 * @type {readonly string[]} */
export const PALETTES = ['classic', 'jewel', 'duotone', 'calm'];

/**
 * @typedef {'light'|'dark'} Pref
 * @typedef {Pick<Storage,'getItem'|'setItem'>} PrefStore
 * @typedef {{dataset:{appearance?:string, theme?:string, palette?:string}}} Root
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

/** Same contract as normalizePref: an unknown or retired theme falls back to the default,
 * matching index.html's inline resolver.
 * @param {string|null|undefined} theme @returns {string} */
export function normalizeTheme(theme) {
  return THEMES.find(t => t === theme) ?? THEMES[0];
}

/** @param {string|null|undefined} palette @returns {string} */
export function normalizePalette(palette) {
  return PALETTES.find(p => p === palette) ?? PALETTES[0];
}

/** @param {string} palette @returns {string} */
export const paletteName = (palette) => title(normalizePalette(palette));

/** Display name for the theme picker.
 * @param {string} theme @returns {string} */
export const themeName = (theme) => title(normalizeTheme(theme));

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
 * @param {{store?:PrefStore|null, root?:Root, onApply?:(mode:Pref, theme:string, palette:string)=>void}} [deps]
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
  let theme = THEMES[0];
  try { theme = normalizeTheme(store ? store.getItem(THEME_KEY) : null); } catch { theme = THEMES[0]; }
  let palette = PALETTES[0];
  try { palette = normalizePalette(store ? store.getItem(PALETTE_KEY) : null); } catch { palette = PALETTES[0]; }

  /** @returns {void} */
  function apply() {
    root.dataset.appearance = pref;
    root.dataset.theme = theme;
    root.dataset.palette = palette;
    onApply(pref, theme, palette);
  }

  /** @param {string} p @returns {void} */
  function set(p) {
    pref = normalizePref(p);
    try { if (store) store.setItem(PREF_KEY, pref); } catch { /* not remembered */ }
    apply();
  }

  /** A theme and one of its palettes, chosen together on the Theme page and applied once.
   * @param {string} t @param {string} p @returns {void} */
  function setLook(t, p) {
    theme = normalizeTheme(t);
    palette = normalizePalette(p);
    try { if (store) { store.setItem(THEME_KEY, theme); store.setItem(PALETTE_KEY, palette); } } catch { /* not remembered */ }
    apply();
  }

  // Deliberately plain functions closing over `pref` rather than methods using `this`,
  // so a destructured `const {cycle} = makeAppearance()` still works.
  return {
    /** @returns {Pref} */
    get: () => pref,
    set,
    /** @returns {string} */
    getTheme: () => theme,
    /** @returns {string} */
    getPalette: () => palette,
    setLook,
    /** @returns {Pref} */
    cycle() { set(nextPref(pref)); return pref; },
    /** Apply now. Nothing to subscribe to any more: with `system` gone the preference is
     * the mode, so there is no OS query to follow.
     * @returns {void} */
    start() { apply(); },
  };
}
