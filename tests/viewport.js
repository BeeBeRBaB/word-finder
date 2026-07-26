// The shapes this app is judged against, and the one measurement that decides whether
// it fits at them. Shared by playwright.config.js, layout.spec.js and npm run shots —
// separate copies had already drifted, letting cells sit off the unscrollable left edge
// while the suite stayed green.
//
// Heights are real Safari innerHeight, chrome already subtracted: an iPhone 13 is 390px
// tall in landscape on paper and ~300px in a browser, and that gap is where layout
// breaks. A PWA has no chrome, which is why these bugs are browser-only.

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
    // Two questions, not one. `.w` carries a deliberate ~2px negative inset to line its
    // text up with the header, so words are judged on bottom/right only. A cell past any
    // edge is a real fault — past the start edge nothing can even scroll to it.
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
