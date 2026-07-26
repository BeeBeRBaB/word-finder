/**
 * @typedef {{landscape:boolean, cell:number, gridSize:number, sideWidth:number, listColumns:string}} LayoutDims
 */

/**
 * @typedef {import('./puzzle.js').Bucket} Bucket
 * @typedef {{size:number, count:number, mix:Bucket[]}} Preset
 */

// A mix only means anything next to the size it was tuned for — a 9-12 letter bucket is
// nonsense on a 10x10 grid, whose longest placeable word is 9 — so the three travel together.
/** @type {{full:Preset, compact:Preset}} */
export const PRESETS = {
  full: {
    size: 13, count: 12,
    mix: [{ min: 3, max: 5, take: 3 }, { min: 6, max: 8, take: 5 }, { min: 9, max: 12, take: 4 }],
  },
  compact: {
    size: 10, count: 8,
    mix: [{ min: 3, max: 4, take: 2 }, { min: 5, max: 6, take: 3 }, { min: 7, max: 9, take: 3 }],
  },
};

/**
 * Which board this DEVICE plays. Deliberately `screen`, not the viewport: a preset
 * that tracked the window would rebuild the board when a desktop player dragged their
 * window narrow, and would make an iPad in Slide Over a different game from the same
 * iPad full screen. `min()` because platforms disagree about rotation — iOS Safari
 * reports the portrait values whichever way the device is held, Chrome on Android
 * swaps them — and the smaller edge is the same number under both.
 * @param {{screenW:number, screenH:number}} opts @returns {Preset}
 */
export function pickPreset({ screenW, screenH }) {
  return Math.min(screenW, screenH) < 480 ? PRESETS.compact : PRESETS.full;
}

// Portrait non-grid chrome in px, split into the part that does not depend on the word
// list (header, gaps, list header, hint) and the part that does — every list row not
// drawn is a row the grid can have. Pinned so reservePortrait(12) is exactly 366, the
// measured value this file shipped with: that makes the full preset a provable no-op
// and confines this change's risk to the compact board.
const RESERVE_BASE = 162;
const ROW_H = 34;
/** @param {number} count @returns {number} */
export const reservePortrait = (count) => RESERVE_BASE + Math.ceil(count / 2) * ROW_H;

const GAP = 20; // the #main column gap between grid and list rail in landscape
// Narrowest and widest the landscape word-list rail may get. See the notes at their uses.
const MIN_SIDE = 160;
const LIST_MAX = 380;
// #gridbox keeps a content-box border (1px each side, per styles.css), so its rendered
// box is 2px larger than the size set on it. Kept out of the reserve above so that stays
// purely non-grid chrome and this stays the CSS box model.
const BORDER = 2;
// Both columns hug their content — see the landscape return for why this is not `1fr 1fr`.
// Portrait shares it so the two orientations cannot drift.
const LIST_COLUMNS = 'max-content max-content';

/**
 * Viewport arithmetic. Pure so it can be unit-tested across a device table.
 * vw/vh are the space INSIDE #app — the caller subtracts #app's padding, which includes
 * the resolved safe-area insets. The grid is sized to the scarce dimension: height in
 * landscape, min(width, height-under-the-chrome) in portrait. No floor forces the grid
 * larger than its space, which is what used to clip it.
 * @param {{vw:number, vh:number, size:number, pad:number, count:number}} opts
 * @returns {LayoutDims}
 */
export function computeLayout({ vw, vh, size, pad, count }) {
  const landscape = vw > vh * 1.08;
  let cell, sideWidth;
  if (landscape) {
    // Bound by BOTH axes. Height is what usually binds in landscape, but sizing on it
    // alone let the grid claim so much width that the rail hit its 160px floor and the
    // tracks together exceeded the viewport — at 700x640 they totalled 811px against
    // 700. That overflow had to be swept up in CSS, and a bare `center` put half of it
    // past the start edge, which cannot be scrolled to: the board's whole first column
    // sat off-screen, unreachable in a game played by dragging across cells. Leaving
    // room for the rail here makes the tracks fit by construction, which is a property
    // this pure module can be tested on rather than a rule CSS has to rescue.
    const byHeight = Math.floor((vh - 2 * pad - BORDER) / size);
    const byWidth = Math.floor((vw - GAP - MIN_SIDE - 2 * pad) / size);
    cell = Math.max(16, Math.min(54, byHeight, byWidth));
    const gridSize = size * cell + 2 * pad;
    // Capped, not "whatever is left". The rail holds two content-sized columns of
    // words, so extra width does not make it more useful — it just spreads the same
    // words over a wider box. That is what looked wrong in landscape on a phone: the
    // browser's chrome leaves roughly 300px of height, the grid is height-bound down
    // to ~270px, and the rail then took the remaining 544px, making the word list
    // twice the width of the board it belongs to. Installed as a PWA there is no
    // chrome, the grid gets its full height back, and the same code looked fine —
    // which is why this only ever showed up in the browser. 380 is the width the list
    // already proves it needs in portrait, where it is the full content width.
    sideWidth = Math.min(Math.max(MIN_SIDE, vw - gridSize - GAP), LIST_MAX);
    // `1fr 1fr` split the WHOLE rail, which in landscape is every pixel left over after
    // the grid — so the second column sat hundreds of px away on a wide window and slid
    // on every resize. Content-sized columns make the list's width a function of the
    // words rather than the viewport.
    return { landscape, cell, gridSize, sideWidth, listColumns: LIST_COLUMNS };
  }
  const availW = vw - 2 * pad - BORDER;
  const availH = vh - reservePortrait(count) - 2 * pad - BORDER;
  cell = Math.min(54, Math.floor(Math.min(availW, availH) / size));
  cell = Math.max(16, cell);
  const gridSize = size * cell + 2 * pad;
  return { landscape, cell, gridSize, sideWidth: gridSize, listColumns: LIST_COLUMNS };
}
