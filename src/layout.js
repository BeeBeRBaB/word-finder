/**
 * @typedef {{landscape:boolean, cell:number, gridSize:number, sideWidth:number,
 *   listColumns:string, scroll:boolean}} LayoutDims
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

/**
 * Which board this DEVICE plays. `screen`, not the viewport: tracking the window would
 * re-deal the board mid-drag, and make an iPad in Slide Over a different game. `min()`
 * because iOS reports portrait values in both orientations and Android swaps them.
 * @param {{screenW:number, screenH:number}} opts @returns {Preset}
 */
export function pickPreset({ screenW, screenH }) {
  return Math.min(screenW, screenH) < 480 ? PRESETS.compact : PRESETS.full;
}

// Portrait chrome above and below the grid: a fixed part, plus one row per two words.
// Pinned so reservePortrait(12) === 366, the value the full board shipped with.
const RESERVE_BASE = 162;
const ROW_H = 34;
/** @param {number} count @returns {number} */
export const reservePortrait = (count) => RESERVE_BASE + Math.ceil(count / 2) * ROW_H;

const GAP = 20;        // must equal #app[data-landscape]'s column-gap; tokens.test.js pins it
const MIN_SIDE = 160;  // rail floor
const LIST_MAX = 380;  // rail ceiling: two content-sized columns need no more
const BORDER = 2;      // #gridbox's content-box border, 1px each side
// Content-sized, not `1fr 1fr`: a fr split puts the second column wherever the viewport
// ends. Portrait shares it so the orientations cannot drift.
const LIST_COLUMNS = 'max-content max-content';

/**
 * Viewport arithmetic. Pure, so it can be swept across every device shape in a unit test.
 * vw/vh are the space inside #app, safe-area insets already subtracted by the caller.
 * `scroll` means minCell won and the board is bigger than its space.
 * @param {{vw:number, vh:number, size:number, pad:number, count:number, minCell?:number}} opts
 * @returns {LayoutDims}
 */
export function computeLayout({ vw, vh, size, pad, count, minCell = 16 }) {
  const landscape = vw > vh * 1.08;
  let cell, sideWidth;
  if (landscape) {
    // Both axes. Sizing on height alone let the grid eat the width the rail needs, and
    // the tracks then overflowed the viewport for CSS to sweep up.
    const byHeight = Math.floor((vh - 2 * pad - BORDER) / size);
    const byWidth = Math.floor((vw - GAP - MIN_SIDE - 2 * pad) / size);
    cell = Math.max(minCell, Math.min(54, byHeight, byWidth));
    const gridSize = size * cell + 2 * pad;
    sideWidth = Math.min(Math.max(MIN_SIDE, vw - gridSize - GAP), LIST_MAX);
    const scroll = size * cell + 2 * pad + BORDER > vh || gridSize + GAP + sideWidth > vw;
    return { landscape, cell, gridSize, sideWidth, listColumns: LIST_COLUMNS, scroll };
  }
  const availW = vw - 2 * pad - BORDER;
  const availH = vh - reservePortrait(count) - 2 * pad - BORDER;
  cell = Math.max(minCell, Math.min(54, Math.floor(Math.min(availW, availH) / size)));
  const gridSize = size * cell + 2 * pad;
  // avail* already exclude padding, border and the list reserve, so compare the raw run.
  const scroll = size * cell > availW || size * cell > availH;
  return { landscape, cell, gridSize, sideWidth: gridSize, listColumns: LIST_COLUMNS, scroll };
}
