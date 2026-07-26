// The screen shapes this app is judged against, and the one measurement that decides
// whether it fits at them. Shared by playwright.config.js (which picks its two project
// viewports from here), tests/e2e/layout.spec.js (which asserts nothing clips at any
// shape) and tools/shots.mjs (which renders them).
//
// One list and one measurement, deliberately. The list and the renderer used to hold
// separate copies of "is anything off-screen", and they had already drifted: the spec
// checked bottom and right, the tool checked all four edges. So `npm run shots` could
// print clean at a viewport where the spec failed, and — worse — the spec could pass
// while cells sat off the LEFT edge, which is what happened when a centring change put
// a board's first column out of reach. Start-edge overflow is not scrollable and is
// not counted by scrollWidth, so it is invisible to every check except this one.
//
// Heights are real Safari innerHeight with the browser chrome already subtracted —
// what a player actually gets, not the spec sheet. That is why the landscape entries
// are so short: an iPhone 13 is 390px tall in landscape on paper and ~300px in a
// browser, and the missing 90px is where layout breaks. Installed as a PWA there is no
// chrome and the device has its full height, which is why bugs here show up in the
// browser and not in the installed app.

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {{name:string, w:number, h:number}} Device */

/** @type {Device[]} */
export const DEVICES = [
  { name: 'iPhone 13 portrait', w: 390, h: 664 },
  { name: 'iPhone 13 landscape', w: 844, h: 300 },
  { name: 'iPhone 13 landscape PWA', w: 844, h: 390 },
  { name: 'iPhone Pro Max portrait', w: 430, h: 752 },
  { name: 'iPhone Pro Max landscape', w: 932, h: 340 },
  { name: 'iPad Mini portrait', w: 744, h: 1053 },
  { name: 'iPad Mini landscape', w: 1133, h: 664 },
  { name: 'Desktop', w: 1440, h: 900 },
];

/** @param {string} name @returns {Device} */
export function device(name) {
  const d = DEVICES.find((x) => x.name === name);
  if (!d) throw new Error(`unknown device ${name}; known: ${DEVICES.map((x) => x.name).join(', ')}`);
  return d;
}

/**
 * Everything either consumer needs to decide "does the board fit here".
 * @param {Page} page
 * @returns {Promise<{gridOverflowY:number, gridOverflowX:number, clippedY:number, clippedX:number,
 *   offscreenWords:(string|null)[], offscreenCells:number, cell:number, grid:number, list:number}>}
 */
export function measure(page) {
  return page.evaluate(() => {
    /** @param {string} id @returns {HTMLElement} */
    const q = (id) => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`missing element #${id}`);
      return el;
    };
    const gb = q('gridbox').getBoundingClientRect();
    const app = q('app');
    // Two different questions, deliberately not one predicate. A word pill may sit a
    // couple of px past the left edge — `.w` carries a negative inset so its text lines
    // up with the header above it, measured at left:-2 in portrait — and that is
    // design, not clipping. A CELL past any edge is a different matter: the game is
    // played by dragging across cells, and past the start edge nothing can even scroll
    // to it.
    const past = (/** @type {DOMRect} */ r) =>
      r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5;
    const anyEdge = (/** @type {DOMRect} */ r) =>
      past(r) || r.left < -0.5 || r.top < -0.5;
    return {
      gridOverflowY: Math.round(gb.bottom - innerHeight),
      gridOverflowX: Math.round(gb.right - innerWidth),
      clippedY: app.scrollHeight - app.clientHeight,
      clippedX: app.scrollWidth - app.clientWidth,
      offscreenWords: [...document.querySelectorAll('.w')]
        .filter((e) => past(e.getBoundingClientRect())).map((e) => e.textContent),
      offscreenCells: [...document.querySelectorAll('.cell')]
        .filter((e) => anyEdge(e.getBoundingClientRect())).length,
      cell: Math.round(document.querySelector('.cell')?.getBoundingClientRect().width ?? 0),
      grid: Math.round(gb.width),
      list: Math.round(q('list').getBoundingClientRect().width),
    };
  });
}
