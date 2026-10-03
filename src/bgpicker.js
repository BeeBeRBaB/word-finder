// The Background page's markup: a radio tile per entry in the backgrounds registry, so a new
// entry there needs no markup anywhere, and the summary on the row that opens the page.
import { BACKGROUNDS, findBackground } from './backgrounds.js';

/** @typedef {import('./backgrounds.js').Background} Background */

// Badge icons on a 16x16 grid: a play mark for animated, a framed picture for still.
const ICONS = {
  animated: '<path d="M5.5 3.5v9l7-4.5z"/>',
  still: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2.5 12.5l3.5-4 3 3 2-2 2.5 3"/>',
};

/** @param {Background} bg @returns {string} */
function glyphMarkup(bg) {
  return `<svg class="bgglyph" viewBox="0 0 48 32" aria-hidden="true">${bg.glyph}</svg>`;
}

/** @param {Background} bg @returns {string} */
export function badgeMarkup(bg) {
  const kind = bg.animated ? 'animated' : 'still';
  return `<span class="bgbadge" data-kind="${kind}"><svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[kind]}</svg>`
    + `${bg.animated ? 'Animated' : 'Still'}</span>`;
}

/** One radio per background, in registry order; data-setting makes each a settings.js field.
 * @param {readonly Background[]} [list] @returns {string} */
export function tilesMarkup(list = BACKGROUNDS) {
  return list.map(bg => `<label class="tile bgtile" data-bg="${bg.id}">`
    + `<input type="radio" name="art" value="${bg.id}" data-setting="art">`
    + `${glyphMarkup(bg)}<span class="bgname">${bg.name}</span>${badgeMarkup(bg)}</label>`).join('');
}

/** @param {unknown} id @returns {string} the row's picture and name for a stored choice */
export function summaryMarkup(id) {
  const bg = findBackground(id);
  return `${glyphMarkup(bg)}<span class="bgname">${bg.name}</span>`;
}
