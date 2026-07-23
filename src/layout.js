/**
 * @typedef {{landscape:boolean, cell:number, gridSize:number, sideWidth:number, listColumns:string}} LayoutDims
 */

// Portrait non-grid chrome (header + gap + word list + hint), in px. The list is a
// fixed-height block, so on a short screen the grid must shrink to fit under it. Measured
// against the trimmed CSS in styles.css; the layout unit + e2e tests enforce that whatever
// value is here actually fits every in-scope device.
const RESERVE_PORTRAIT = 340;
const GAP = 20; // the #main column gap between grid and list rail in landscape
// #gridbox keeps its pre-existing content-box border (1px each side, per styles.css),
// so its rendered box is BORDER px larger than the width/height we set on it. Budgeted
// here rather than folded into RESERVE_PORTRAIT so that constant stays purely "non-grid
// chrome" and this stays a fixed, well-understood 2px account for the actual CSS box model.
const BORDER = 2;

/**
 * Viewport arithmetic. Pure so it can be unit-tested across a device table.
 * vw/vh are the space available INSIDE #app (the caller subtracts #app's padding, which
 * includes the resolved safe-area insets). The grid is sized to the scarce dimension:
 * height in landscape, min(width, height-under-the-chrome) in portrait. No floor forces
 * the grid larger than its space, which is what used to clip it.
 * @param {{vw:number, vh:number, size:number, pad:number}} opts
 * @returns {LayoutDims}
 */
export function computeLayout({ vw, vh, size, pad }) {
  const landscape = vw > vh * 1.08;
  let cell, sideWidth;
  if (landscape) {
    cell = Math.min(54, Math.floor((vh - 2 * pad - BORDER) / size));
    cell = Math.max(16, cell);
    const gridSize = size * cell + 2 * pad;
    sideWidth = Math.max(160, vw - gridSize - GAP);
    return { landscape, cell, gridSize, sideWidth, listColumns: '1fr 1fr' };
  }
  const availW = vw - 2 * pad - BORDER;
  const availH = vh - RESERVE_PORTRAIT - 2 * pad - BORDER;
  cell = Math.min(54, Math.floor(Math.min(availW, availH) / size));
  cell = Math.max(16, cell);
  const gridSize = size * cell + 2 * pad;
  return { landscape, cell, gridSize, sideWidth: gridSize, listColumns: '1fr 1fr' };
}
