/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('../../src/puzzle.js').Selection} Selection
 */

export const N = 13;
export const PAD = 10;

/** Grid origin and cell size, read from the live DOM.
 * @param {Page} page @returns {Promise<{left:number, top:number, cell:number, pad:number}>} */
export async function gridGeometry(page) {
  return page.evaluate(() => {
    const gb = document.getElementById('gridbox');
    if (!gb) throw new Error('missing #gridbox');
    const r = gb.getBoundingClientRect();
    return { left: r.left, top: r.top, cell: (gb.offsetWidth - 20) / 13, pad: 10 };
  });
}

/**
 * Locate a word in the rendered grid by brute force over all 8 directions.
 * Pass a word to find that specific one, or omit to get the first word from the
 * list that is locatable. Returns grid coordinates, not pixels.
 * @param {Page} page @param {string} [word]
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}>}
 */
export async function findWordInGrid(page, word) {
  const found = await page.evaluate((target) => {
    const N = 13;
    const letters = [...document.querySelectorAll('.cell')].map(e => e.textContent);
    const words = target
      ? [target]
      // Every `.w` chip's textContent is set from a word string in view.js, so it is
      // never actually null; the cast avoids widening this to a defensive `?? ''`
      // that would silently hide a real regression instead of throwing on one.
      : [...document.querySelectorAll('.w')].map(e => /** @type {string} */ (e.textContent).toUpperCase());
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    for (const w of words) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        for (const [dx, dy] of DIRS) {
          const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
          if (ex < 0 || ex >= N || ey < 0 || ey >= N) continue;
          let ok = true;
          for (let i = 0; i < w.length; i++) {
            if (letters[(y + dy * i) * N + (x + dx * i)] !== w[i]) { ok = false; break; }
          }
          if (ok) return { word: w, x0: x, y0: y, x1: ex, y1: ey };
        }
      }
    }
    return null;
  }, word);
  if (!found) throw new Error(`could not locate ${word || 'any word'} in the grid`);
  return found;
}

/** Same brute-force search, but only accepts a diagonally placed word.
 * @param {Page} page
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}>}
 */
export async function findDiagonalWord(page) {
  const all = await page.locator('.w').allTextContents();
  for (const w of all) {
    const hit = await findWordInGrid(page, w.toUpperCase());
    if (hit.x0 !== hit.x1 && hit.y0 !== hit.y1) return hit;
  }
  throw new Error('no diagonally placed word in this puzzle');
}

/** Drag across a selection using real pointer events, with intermediate steps.
 * @param {Page} page @param {Selection} sel @returns {Promise<void>} */
export async function dragCells(page, sel) {
  const g = await gridGeometry(page);
  /** @param {number} x @param {number} y @returns {{x:number, y:number}} */
  const pt = (x, y) => ({
    x: g.left + g.pad + (x + 0.5) * g.cell,
    y: g.top + g.pad + (y + 0.5) * g.cell,
  });
  const a = pt(sel.x0, sel.y0), b = pt(sel.x1, sel.y1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}
