// The Background page's markup: under Manual, a Still and an Animated row, each a radio saying
// which of the two shows and a dropdown whose menu has an option per registry entry of its kind
// (by its `animated` flag), so a new entry there needs no markup anywhere; the note under the
// mode; and the summary on the row that opens the page.
import { BACKGROUNDS, findBackground } from './backgrounds.js';

/** @typedef {import('./backgrounds.js').Background} Background */

/** What each way of choosing does, said under the dropdown. @type {Readonly<Record<string, string>>} */
export const MODE_NOTES = Object.freeze({
  theme: 'Each theme comes with its own background.',
  random: 'A new background with every game.',
  manual: 'Pick a still and an animated one, and which of the two shows.',
});
// The row's tag for a background the player did not pick themselves.
/** @type {Readonly<Record<string, string>>} */
const MODE_TAGS = Object.freeze({ theme: 'Theme', random: 'Random' });

/** The two kinds: the settings field holding each one's last pick, its heading, and its flag. */
export const KINDS = /** @type {const} */ ([['still', 'Still', false], ['moving', 'Animated', true]]);

/** @param {Background} bg @returns {string} */
function glyphMarkup(bg) {
  return `<svg class="bgglyph" viewBox="0 0 48 32" aria-hidden="true">${bg.glyph}</svg>`;
}

/** @param {string} kind @returns {(bg:Background) => string} */
const optionMarkup = (kind) => (bg) => `<label class="tile bgtile" data-bg="${bg.id}">`
  + `<input type="radio" name="bg-${kind}" value="${bg.id}">${glyphMarkup(bg)}<span class="bgname">${bg.name}</span></label>`;

const CHEVRON = '<svg class="navchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';

/** The Still row then the Animated one, each followed by its menu, closed. A menu's radios
 * share a name of their own; the two rows' radios share `bgkind`.
 * @param {readonly Background[]} [list] @returns {string} */
export function manualMarkup(list = BACKGROUNDS) {
  return KINDS.map(([kind, head, animated]) => `<div class="row bgkind" data-kind="${kind}">`
    + `<label class="bgpick"><input type="radio" name="bgkind" value="${kind}"><span class="panelabel" id="bghead-${kind}">${head}</span></label>`
    + `<button type="button" class="navrow bgdrop" id="bgdrop-${kind}" aria-expanded="false" aria-controls="bgmenu-${kind}"`
    + ` aria-labelledby="bghead-${kind} bgnow-${kind}"><span class="navnow" id="bgnow-${kind}"></span>${CHEVRON}</button></div>`
    + `<div class="bgmenu" id="bgmenu-${kind}" role="radiogroup" aria-labelledby="bghead-${kind}" hidden>`
    + list.filter(bg => bg.animated === animated).map(optionMarkup(kind)).join('') + '</div>').join('');
}

/** A dropdown's picture and name for its kind's pick. @param {unknown} id @returns {string} */
export function dropMarkup(id) {
  const bg = findBackground(id);
  return `${glyphMarkup(bg)}<span class="bgname">${bg.name}</span>`;
}

/** The note under the mode; under Theme and Random it names the background they show.
 * @param {string} mode @param {unknown} id @returns {string} */
export function modeNote(mode, id) {
  const note = MODE_NOTES[mode] ?? MODE_NOTES.manual;
  return MODE_TAGS[mode] ? `${note} Now: ${findBackground(id).name}.` : note;
}

/** The row's picture and name for the background showing, with the mode under the name unless
 * it is Manual. @param {unknown} id @param {string} [mode] @returns {string} */
export function summaryMarkup(id, mode = 'manual') {
  const bg = findBackground(id), tag = MODE_TAGS[mode];
  return `${glyphMarkup(bg)}<span class="bgsum"><span class="bgname">${bg.name}</span>`
    + `${tag ? `<span class="bgtag">${tag}</span>` : ''}</span>`;
}
