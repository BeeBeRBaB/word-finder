// The Theme page: a group per theme, each with a Light and a Dark tile previewed in that look's
// own colours. The colours are read off the live stylesheet, so a colour edit needs no change here.
import { THEMES, PREFS, themeName, prefName } from './appearance.js';

/** The tokens a preview paints with, each as --look-<name> on the preview. */
const KEYS = ['bg', 'surface', 'border', 'text', 'accent', 'pill-1', 'pill-2'];

/** @param {string} theme @param {string} pref @returns {string} the radio's value */
export const lookId = (theme, pref) => `${theme}/${pref}`;

/** A board and a word list in miniature, coloured by the --look-* properties `vars` sets.
 * @param {string} [vars] @returns {string} */
export function previewMarkup(vars = '') {
  return `<span class="lookprev" aria-hidden="true"${vars ? ` style="${vars}"` : ''}><span class="lookboard">`
    + '<span class="lookpill p1"></span><span class="lookpill p2"></span>'
    + '<span class="lookl">WORD</span><span class="lookl">FIND</span><span class="lookl">SEEK</span></span>'
    + '<span class="lookrail"><i></i><i></i><i></i></span></span>';
}

/** Every look as a radio, grouped by theme. The previews are uncoloured until they are filled.
 * @param {readonly string[]} [themes] @param {readonly string[]} [prefs] @returns {string} */
export function tilesMarkup(themes = THEMES, prefs = PREFS) {
  return themes.map(t => `<div class="lookgroup" role="group" aria-labelledby="look-${t}">`
    + `<h3 class="lookhead" id="look-${t}">${themeName(t)}</h3><div class="looktiles">`
    + prefs.map(p => `<label class="tile looktile" data-look="${lookId(t, p)}">`
      + `<input type="radio" name="look" value="${lookId(t, p)}">${previewMarkup()}`
      + `<span class="lookname"><span class="sr">${themeName(t)} </span>${prefName(p)}</span></label>`).join('')
    + '</div></div>').join('');
}

/** @param {string} theme @param {string} pref @param {string} vars @returns {string} the Theme row's picture and name */
export function summaryMarkup(theme, pref, vars) {
  return `${previewMarkup(vars)}<span class="lookname">${themeName(theme)} · ${prefName(pref)}</span>`;
}

/** @param {CSSStyleDeclaration} cs @returns {string} the preview properties for the look `cs` is in */
export const varsOf = (cs) => KEYS.map(k => `--look-${k}:${cs.getPropertyValue(`--${k}`).trim()}`).join(';');

/**
 * Every look's preview properties, by trying each on `root` in turn. All in one task, so no
 * frame shows a borrowed look, and `root` is left as it was.
 * @param {{dataset:DOMStringMap}} root
 * @param {(el:any) => CSSStyleDeclaration} style getComputedStyle, or a fake
 * @param {readonly string[]} [themes] @param {readonly string[]} [prefs]
 * @returns {Map<string, string>} look id to properties
 */
export function readLooks(root, style, themes = THEMES, prefs = PREFS) {
  const was = { theme: root.dataset.theme, appearance: root.dataset.appearance };
  const out = new Map();
  try {
    for (const t of themes) for (const p of prefs) {
      root.dataset.theme = t;
      root.dataset.appearance = p;
      out.set(lookId(t, p), varsOf(style(root)));
    }
  } finally {
    for (const k of /** @type {const} */ (['theme', 'appearance'])) {
      if (was[k] === undefined) delete root.dataset[k]; else root.dataset[k] = was[k];
    }
  }
  return out;
}
