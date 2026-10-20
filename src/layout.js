/**
 * @typedef {{landscape:boolean, cell:number, gridSize:number, sideWidth:number,
 *   listColumns:string, oneColumn:boolean, scroll:boolean}} LayoutDims
 * @typedef {import('./puzzle.js').Bucket} Bucket
 * @typedef {{size:number, count:number, minCell:number, mix:Bucket[]}} Preset
 */

// size, count and mix travel together: a 9-12 letter bucket is nonsense on a 10x10 grid.
// minCell is a legibility floor — below it the board scrolls rather than shrinking.
/** @type {{full:Preset, compact:Preset}} */
export const PRESETS = {
  full: {
    size: 13, count: 12, minCell: 30,
    mix: [{ min: 3, max: 5, take: 3 }, { min: 6, max: 8, take: 5 }, { min: 9, max: 12, take: 4 }],
  },
  compact: {
    // 16, not 30: a phone screen is small for real, and this board is already 10x10.
    size: 10, count: 8, minCell: 16,
    mix: [{ min: 3, max: 4, take: 2 }, { min: 5, max: 6, take: 3 }, { min: 7, max: 9, take: 3 }],
  },
};

// Difficulty is the words, not their directions: Easy leans short, Hard leans long. Every
// subject can fill each mix (thinnest pools: 8 of 3-5, 12 of 6-8, 8 of 9-12 letters), and
// pickWords backfills a short bucket anyway. Normal is each preset's own mix.
/** @type {Record<'easy'|'hard', {full:Bucket[], compact:Bucket[]}>} */
export const MIXES = {
  easy: {
    full: [{ min: 3, max: 5, take: 6 }, { min: 6, max: 8, take: 6 }],
    compact: [{ min: 3, max: 4, take: 4 }, { min: 5, max: 6, take: 4 }],
  },
  hard: {
    full: [{ min: 3, max: 5, take: 2 }, { min: 6, max: 8, take: 5 }, { min: 9, max: 12, take: 5 }],
    compact: [{ min: 3, max: 4, take: 1 }, { min: 5, max: 6, take: 3 }, { min: 7, max: 9, take: 4 }],
  },
};

/** The word mix a deal of this shape draws at this difficulty.
 * @param {{size:number, mix:Bucket[]}} shape @param {'easy'|'normal'|'hard'} difficulty
 * @returns {Bucket[]} */
export function mixFor(shape, difficulty) {
  if (difficulty === 'normal') return shape.mix;
  return MIXES[difficulty][shape.size === PRESETS.compact.size ? 'compact' : 'full'];
}

/**
 * Which board this DEVICE plays. `screen`, not the viewport: tracking the window would
 * re-deal the board mid-drag, and make an iPad in Slide Over a different game. `min()`
 * because iOS reports portrait values in both orientations and Android swaps them.
 * @param {{screenW:number, screenH:number}} opts @returns {Preset}
 */
export function pickPreset({ screenW, screenH }) {
  return Math.min(screenW, screenH) < 480 ? PRESETS.compact : PRESETS.full;
}

/**
 * Whether the window is the whole screen, held the way `orientation` says when it is known: where
 * an iPad Home Screen app's launch ends. `screen` is portrait in both orientations on iOS.
 * @param {{vw:number, vh:number, screenW:number, screenH:number, landscape?:boolean}} opts
 * @returns {boolean}
 */
export function fillsScreen({ vw, vh, screenW, screenH, landscape }) {
  const near = (/** @type {number} */ a, /** @type {number} */ b) => Math.abs(a - b) <= 1;
  return near(Math.max(vw, vh), Math.max(screenW, screenH)) && near(Math.min(vw, vh), Math.min(screenW, screenH))
    && (landscape === undefined || landscape === vw > vh);
}

// Portrait chrome above and below the grid: a fixed part, plus one row per two words.
// Measured: the one-row header card 60 + two 10px gaps + the list card's padding 14 and its
// header 47, less the last row's 6px gap, is 135; each row is 31 plus a 6px gap. 136 keeps a
// pixel of margin. The hint used to sit below the list and cost every phone 46px of grid.
const RESERVE_BASE = 136;
// The header RESERVE_BASE counts. A long name takes a second line on a phone, and what that
// adds comes out of the grid, or the last row of words falls below the fold.
const HEADER_ROW = 60;
const ROW_H = 37;
/** @param {number} count @returns {number} */
export const reservePortrait = (count) => RESERVE_BASE + Math.ceil(count / 2) * ROW_H;

const GAP = 20;        // must equal #app[data-landscape]'s column-gap; tokens.test.js pins it
// Rail floor: two columns of the widest word list plus the rail card's 20px padding a side.
// 160, the first floor, squeezed the rail to 167-279 between roughly 725 and 950 CSS px and
// clipped the second column OUTSIDE it, with `scroll` unset because the TRACKS fit even though
// their contents did not. Measured, not guessed: the 12 longest words of all 600 subjects as
// two content-sized columns peak at 312px (sports/archery).
const MIN_SIDE = 352;
// Rail ceiling: a wider rail only widens the card around the same words, so the spare width
// goes either side of the board and rail instead (styles.css centres them).
const RAIL_MAX = 500;
// The rail sets the words in one larger column when it is tall enough for them: the header
// card, the list's header and padding, and a row per word.
const ONE_COLUMN_BASE = 150, ONE_COLUMN_ROW = 40;
// Largest cell. The board grows to fill the height; this only stops a large monitor from
// dealing letters the size of the rail's headings. It was 54, which left a 1440x900
// laptop with an eighth of its height and ~100px of width unused.
const CELL_MAX = 96;
const BORDER = 2;      // #gridbox's content-box border, 1px each side
// Content-sized, not `1fr 1fr`: a fr split puts the second column wherever the viewport
// ends. Portrait shares it so the orientations cannot drift.
const LIST_COLUMNS = 'max-content max-content', ONE_COLUMN = 'minmax(0,1fr)';

/**
 * Viewport arithmetic. Pure, so it can be swept across every device shape in a unit test.
 * vw/vh are the space inside #app, safe-area insets already subtracted by the caller.
 * `scroll` means minCell won and the board is bigger than its space.
 * `header` is the header's measured height, which portrait takes from the grid past one row.
 * @param {{vw:number, vh:number, size:number, pad:number, count:number, minCell?:number, header?:number}} opts
 * @returns {LayoutDims}
 */
export function computeLayout({ vw, vh, size, pad, count, minCell = 16, header = HEADER_ROW }) {
  const landscape = vw > vh * 1.08;
  let cell, sideWidth;
  if (landscape) {
    // Both axes. Sizing on height alone let the grid eat the width the rail needs, and
    // the tracks then overflowed the viewport for CSS to sweep up.
    const byHeight = Math.floor((vh - 2 * pad - BORDER) / size);
    const byWidth = Math.floor((vw - GAP - MIN_SIDE - 2 * pad) / size);
    cell = Math.max(minCell, Math.min(CELL_MAX, byHeight, byWidth));
    const gridSize = size * cell + 2 * pad;
    sideWidth = Math.min(RAIL_MAX, Math.max(MIN_SIDE, vw - gridSize - GAP));
    const scroll = size * cell + 2 * pad + BORDER > vh || gridSize + GAP + sideWidth > vw;
    const oneColumn = vh >= ONE_COLUMN_BASE + count * ONE_COLUMN_ROW;
    return { landscape, cell, gridSize, sideWidth, listColumns: oneColumn ? ONE_COLUMN : LIST_COLUMNS, oneColumn, scroll };
  }
  const availW = vw - 2 * pad - BORDER;
  const availH = vh - reservePortrait(count) - Math.max(0, header - HEADER_ROW) - 2 * pad - BORDER;
  cell = Math.max(minCell, Math.min(CELL_MAX, Math.floor(Math.min(availW, availH) / size)));
  const gridSize = size * cell + 2 * pad;
  // avail* already exclude padding, border and the list reserve, so compare the raw run.
  const scroll = size * cell > availW || size * cell > availH;
  return { landscape, cell, gridSize, sideWidth: gridSize, listColumns: LIST_COLUMNS, oneColumn: false, scroll };
}
