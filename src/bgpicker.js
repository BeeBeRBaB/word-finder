// The Background page's markup: a radio tile per entry in the backgrounds registry, grouped Still
// and Animated by its `animated` flag, so a new entry there needs no markup anywhere; the note
// under the mode switch; and the summary on the row that opens the page.
import { BACKGROUNDS, findBackground } from './backgrounds.js';

/** @typedef {import('./backgrounds.js').Background} Background */

/** What each way of choosing does, said under the switch. @type {Readonly<Record<string, string>>} */
export const MODE_NOTES = Object.freeze({
  theme: 'Each theme comes with its own background.',
  random: 'A new background with every game.',
  manual: 'The one you pick below.',
});
// The row's tag for a background the player did not pick themselves.
/** @type {Readonly<Record<string, string>>} */
const MODE_TAGS = Object.freeze({ theme: 'Theme', random: 'Random' });

/** @param {Background} bg @returns {string} */
function glyphMarkup(bg) {
  return `<svg class="bgglyph" viewBox="0 0 48 32" aria-hidden="true">${bg.glyph}</svg>`;
}

/** @param {Background} bg @returns {string} */
const tileMarkup = (bg) => `<label class="tile bgtile" data-bg="${bg.id}">`
  + `<input type="radio" name="art" value="${bg.id}">${glyphMarkup(bg)}<span class="bgname">${bg.name}</span></label>`;

/** Two groups, Still then Animated, each in registry order under its heading. The radios share
 * one name, so the arrow keys run through both groups.
 * @param {readonly Background[]} [list] @returns {string} */
export function tilesMarkup(list = BACKGROUNDS) {
  return /** @type {const} */ ([['still', 'Still', false], ['animated', 'Animated', true]])
    .map(([kind, head, animated]) => `<div class="bggroup" role="group" aria-labelledby="bghead-${kind}" data-kind="${kind}">`
      + `<h3 class="bghead" id="bghead-${kind}">${head}</h3><div class="tiles">`
      + list.filter(bg => bg.animated === animated).map(tileMarkup).join('') + '</div></div>').join('');
}

/** The row's picture and name for the background showing, with the mode under the name unless
 * it is Manual. @param {unknown} id @param {string} [mode] @returns {string} */
export function summaryMarkup(id, mode = 'manual') {
  const bg = findBackground(id), tag = MODE_TAGS[mode];
  return `${glyphMarkup(bg)}<span class="bgsum"><span class="bgname">${bg.name}</span>`
    + `${tag ? `<span class="bgtag">${tag}</span>` : ''}</span>`;
}
