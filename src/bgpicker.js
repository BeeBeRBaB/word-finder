// The Background page's markup: under Manual, a Still and an Animated row, each a radio saying
// which of the two shows and a dropdown whose menu has an option per registry entry of its kind
// (by its `animated` flag), so a new entry there needs no markup anywhere; the note under the
// mode; and the summary on the row that opens the page. The Animated menu is cut into
// sections under headings, the dealt subject's icon motions first.
import { BACKGROUNDS, findBackground, lookOf } from './backgrounds.js';

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
  return `<svg class="bgglyph${bg.id === 'none' ? '' : ' own'}" viewBox="0 0 48 32" aria-hidden="true"${lookStyle(bg)}>${bg.glyph}</svg>`;
}

/** A picture in its background's own colours, as it shows behind the game, in both flavours: the
 * stylesheet picks the theme's. None keeps the theme's own.
 * @param {Background} bg @returns {string} */
function lookStyle(bg) {
  if (bg.id === 'none') return '';
  const vars = [['d', 'dark'], ['l', 'light']].map(([k, pref]) => {
    const { ground, dark, colors } = lookOf(bg.id, pref);
    return `--gb${k}:${ground};${colors.slice(0, 4).map((c, i) => `--g${i + 1}${k}:${c}`).join(';')};--gl${k}:${dark ? '#fff' : '#222'}`;
  });
  return ` style="${vars.join(';')}"`;
}

/** @param {string} kind @returns {(bg:Background) => string} */
const optionMarkup = (kind) => (bg) => `<label class="tile bgtile" data-bg="${bg.id}">`
  + `<input type="radio" name="bg-${kind}" value="${bg.id}">${glyphMarkup(bg)}<span class="bgname">${bg.name}</span></label>`;

/** The Animated menu's sections after the icon motions, each naming its scenes by id. A scene
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

/** The Animated menu's sections in order, each with its backgrounds in registry order: the icon
 * motions (`perDeal`), MOVING_SECTIONS, then More; empty ones are left out.
 * @param {readonly Background[]} list @returns {[string, Background[]][]} */
export function movingSections(list) {
  const moving = list.filter(b => b.animated);
  const placed = new Set(MOVING_SECTIONS.flatMap(([, ids]) => ids));
  /** @type {[string, Background[]][]} */
  const sections = [['Subject icons', moving.filter(b => b.perDeal)]];
  for (const [name, ids] of MOVING_SECTIONS) sections.push([name, moving.filter(b => !b.perDeal && ids.includes(b.id))]);
  sections.push(['More', moving.filter(b => !b.perDeal && !placed.has(b.id))]);
  return sections.filter(([, bgs]) => bgs.length);
}

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
    + (animated
      ? movingSections(list).map(([name, bgs]) => `<h3 class="bggroup">${name}</h3>` + bgs.map(optionMarkup(kind)).join('')).join('')
      : list.filter(bg => !bg.animated).map(optionMarkup(kind)).join(''))
    + '</div>').join('');
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
