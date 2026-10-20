// The Background page's markup: under Manual, a dropdown whose menu has an option per registry
// entry, so a new entry there needs no markup anywhere; the note under the mode; and the summary
// on the row that opens the page. The menu is cut into sections under headings, the dealt
// subject's icon motions first.
import { BACKGROUNDS, findBackground, lookOf } from './backgrounds.js';

/** @typedef {import('./backgrounds.js').Background} Background */

/** What each way of choosing does, said under the dropdown. @type {Readonly<Record<string, string>>} */
export const MODE_NOTES = Object.freeze({
  theme: 'Each theme comes with its own background.',
  random: 'A new background with every game.',
  manual: 'The one you pick shows with every game.',
});
// The row's tag for a background the player did not pick themselves.
/** @type {Readonly<Record<string, string>>} */
const MODE_TAGS = Object.freeze({ theme: 'Theme', random: 'Random' });

/** @param {Background} bg @returns {string} */
function glyphMarkup(bg) {
  return `<svg class="bgglyph" viewBox="0 0 48 32" aria-hidden="true"${lookStyle(bg)}>${bg.glyph}</svg>`;
}

/** A picture in its background's own colours, as it shows behind the game, in both flavours: the
 * stylesheet picks the theme's. @param {Background} bg @returns {string} */
function lookStyle(bg) {
  const vars = [['d', 'dark'], ['l', 'light']].map(([k, pref]) => {
    const { ground, dark, colors } = lookOf(bg.id, pref);
    return `--gb${k}:${ground};${colors.slice(0, 4).map((c, i) => `--g${i + 1}${k}:${c}`).join(';')};--gl${k}:${dark ? '#fff' : '#222'}`;
  });
  return ` style="${vars.join(';')}"`;
}

/** @param {Background} bg @returns {string} */
const optionMarkup = (bg) => `<label class="tile bgtile" data-bg="${bg.id}">`
  + `<input type="radio" name="bg" value="${bg.id}">${glyphMarkup(bg)}<span class="bgname">${bg.name}</span></label>`;

/** The menu's sections after the icon motions, each naming its scenes by id. A scene
 * listed in none goes under More, so a new registry entry still shows with no change here. */
export const MOVING_SECTIONS = /** @type {readonly (readonly [string, readonly string[]])[]} */ (Object.freeze([
  ['Sky and space', ['aurora', 'constellation', 'galaxy', 'meteors', 'orrery', 'planet', 'black-hole',
    'moon-phases', 'day-night', 'sunbeams', 'clouds', 'fireworks', 'lanterns', 'paper-planes', 'kites', 'balloons']],
  ['Water and weather', ['rain', 'snow', 'waves', 'caustics', 'koi', 'puddles', 'rainy-window', 'shoreline', 'river',
    'jellyfish', 'kelp', 'frost', 'lighthouse', 'weather-map']],
  ['Land and life', ['fireflies', 'hills', 'dunes', 'vines', 'tree', 'sunflower', 'leaves', 'spiderweb', 'ants', 'slime',
    'windmills', 'train-window', 'zen-garden', 'traffic', 'rail-map', 'flag']],
  ['Games', ['pong', 'snake', 'breakout', 'invaders', 'asteroids', 'chess', 'reversi', 'card-cascade', 'dice', 'pinball',
    'maze-chase', 'light-cycles', 'pegboard', 'dominoes', 'blocks', 'maze']],
  ['Puzzles and words', ['hanoi', 'slide-puzzle', 'sudoku', 'tangram', 'letterrain', 'tiles', 'crossword', 'typewriter',
    'bubbles', 'word-hunt', 'anagrams', 'word-swarm', 'ticker']],
  ['Science and maths', ['life', 'turing', 'sand', 'interference', 'iron-filings', 'double-pendulum', 'chaos-game',
    'attractor', 'dragon-curve', 'automaton', 'dna', 'molecules', 'cells', 'chladni', 'cloud-chamber', 'sorting',
    'heart-monitor', 'oscilloscope', 'radar', 'circuit', 'equalizer']],
  ['Machines', ['gears', 'clocks', 'kinetic', 'newtons-cradle', 'metronomes', 'slinky', 'marble-run', 'hourglass',
    'abacus', 'pipes', 'mystify', 'synthwave', 'wireframe', 'trails']],
  ['Light and patterns', ['plasma', 'blobs', 'contours', 'ribbons', 'voronoi', 'honeycomb', 'halftone', 'flowfield',
    'mandala', 'truchet', 'moire', 'low-poly', 'penrose', 'spirograph', 'string-art', 'bokeh',
    'neon', 'embers', 'smoke']],
  ['Paint and craft', ['ink', 'marbling', 'brushstrokes', 'drips', 'weave', 'cross-stitch', 'chalkboard', 'blueprint',
    'cracks']],
]));

/** The menu's sections in order, each with its backgrounds in registry order: the icon motions
 * (`perDeal`), MOVING_SECTIONS, then More; empty ones are left out.
 * @param {readonly Background[]} list @returns {[string, Background[]][]} */
export function movingSections(list) {
  const placed = new Set(MOVING_SECTIONS.flatMap(([, ids]) => ids));
  /** @type {[string, Background[]][]} */
  const sections = [['Subject icons', list.filter(b => b.perDeal)]];
  for (const [name, ids] of MOVING_SECTIONS) sections.push([name, list.filter(b => !b.perDeal && ids.includes(b.id))]);
  sections.push(['More', list.filter(b => !b.perDeal && !placed.has(b.id))]);
  return sections.filter(([, bgs]) => bgs.length);
}

const CHEVRON = '<svg class="navchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';

/** The Background row's dropdown, then its menu, closed.
 * @param {readonly Background[]} [list] @returns {string} */
export function manualMarkup(list = BACKGROUNDS) {
  return '<div class="row"><span class="panelabel" id="bghead">Background</span>'
    + '<button type="button" class="navrow bgdrop" id="bgdrop" aria-expanded="false" aria-controls="bgmenu"'
    + ` aria-labelledby="bghead bgnow"><span class="navnow" id="bgnow"></span>${CHEVRON}</button></div>`
    + '<div class="bgmenu" id="bgmenu" role="radiogroup" aria-labelledby="bghead" hidden>'
    + movingSections(list).map(([name, bgs]) => `<h3 class="bggroup">${name}</h3>` + bgs.map(optionMarkup).join('')).join('')
    + '</div>';
}

/** The dropdown's picture and name for the pick. @param {unknown} id @returns {string} */
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
