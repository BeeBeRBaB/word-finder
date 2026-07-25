/**
 * @typedef {{landscape:boolean, cell:number, gridSize:number, sideWidth:number, listColumns:string}} LayoutDims
 */

/**
 * @typedef {import('./puzzle.js').Bucket} Bucket
 * @typedef {{size:number, count:number, mix:Bucket[]}} Preset
 */

// The two board shapes the game deals. A mix only means anything next to the size and
// count it was tuned for — a 9-12 letter bucket is nonsense on a 10x10 grid, whose
// longest placeable word is 9 — so all three travel together as one preset.
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

// Portrait non-grid chrome, in px, split into the part that does not depend on the
// word list (header, gaps, list header, hint) and the part that does. The list is a
// fixed-height block laid out in two columns, so every row it does not draw is a row
// the grid can have. BASE and ROW are pinned so that reservePortrait(12) is exactly
// 366 — the measured value this file shipped with — which makes the full preset a
// provable no-op and confines all of this change's risk to the compact board.
const RESERVE_BASE = 162;
const ROW_H = 34;
/** @param {number} count @returns {number} */
export const reservePortrait = (count) => RESERVE_BASE + Math.ceil(count / 2) * ROW_H;

const GAP = 20; // the #main column gap between grid and list rail in landscape
// #gridbox keeps its pre-existing content-box border (1px each side, per styles.css),
// so its rendered box is BORDER px larger than the width/height we set on it. Budgeted
// here rather than folded into the reserve so that stays purely "non-grid chrome" and
// this stays a fixed, well-understood 2px account for the actual CSS box model.
const BORDER = 2;
// Both word-list columns hug their content. See the note at the landscape return below
// for why this is not `1fr 1fr`; portrait shares it so the two orientations cannot drift.
const LIST_COLUMNS = 'max-content max-content';

/**
 * Viewport arithmetic. Pure so it can be unit-tested across a device table.
 * vw/vh are the space available INSIDE #app (the caller subtracts #app's padding, which
 * includes the resolved safe-area insets). The grid is sized to the scarce dimension:
 * height in landscape, min(width, height-under-the-chrome) in portrait. No floor forces
 * the grid larger than its space, which is what used to clip it.
 * @param {{vw:number, vh:number, size:number, pad:number, count:number}} opts
 * @returns {LayoutDims}
 */
export function computeLayout({ vw, vh, size, pad, count }) {
  const landscape = vw > vh * 1.08;
  let cell, sideWidth;
  if (landscape) {
    cell = Math.min(54, Math.floor((vh - 2 * pad - BORDER) / size));
    cell = Math.max(16, cell);
    const gridSize = size * cell + 2 * pad;
    sideWidth = Math.max(160, vw - gridSize - GAP);
    // `1fr 1fr` split the WHOLE rail, and in landscape the rail is every pixel left over
    // after the grid — so the second column sat hundreds of px away on a wide window and
    // slid every time the window resized. Sizing both columns to their content pins them
    // next to each other and makes the list's width a function of the words, not the
    // viewport. LIST_COLUMNS is shared with portrait so the two never drift apart.
    return { landscape, cell, gridSize, sideWidth, listColumns: LIST_COLUMNS };
  }
  const availW = vw - 2 * pad - BORDER;
  const availH = vh - reservePortrait(count) - 2 * pad - BORDER;
  cell = Math.min(54, Math.floor(Math.min(availW, availH) / size));
  cell = Math.max(16, cell);
  const gridSize = size * cell + 2 * pad;
  return { landscape, cell, gridSize, sideWidth: gridSize, listColumns: LIST_COLUMNS };
}
