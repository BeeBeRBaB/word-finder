/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('../../src/puzzle.js').Selection} Selection
 */

/** Grid origin, cell size and board size, read from the live DOM. The board is 13x13
 * or 10x10 depending on the device, so nothing here may assume a size — `.cell` count
 * is the source of truth, and it is a perfect square by construction.
 * @param {Page} page @returns {Promise<{left:number, top:number, cell:number, pad:number, n:number}>} */
async function gridGeometry(page) {
  return page.evaluate(() => {
    const gb = document.getElementById('gridbox');
    if (!gb) throw new Error('missing #gridbox');
    const n = Math.round(Math.sqrt(document.querySelectorAll('.cell').length));
    if (!n) throw new Error('grid has not rendered yet');
    const r = gb.getBoundingClientRect();
    return { left: r.left, top: r.top, cell: (gb.offsetWidth - 20) / n, pad: 10, n };
  });
}

/**
 * Every run in the rendered grid that reads `word`, by brute force over all 8 directions.
 * Pass a word to search for that one, or omit to scan every word in the list.
 *
 * More than one run can read the same word: its letters also appear inside longer words
 * (WOOD inside HARDWOOD) and, for short words, by chance in the filler. Only one of them
 * is the word's actual placement, and the DOM does not say which — so callers try them in
 * turn. Before matchWord keyed on the cell run, dragging ANY of these "found" the word,
 * which is the bug `findAndDrag` now guards.
 * @param {Page} page @param {string} [word]
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}[]>}
 */
export async function findRunsInGrid(page, word) {
  const runs = await page.evaluate((target) => {
    const letters = [...document.querySelectorAll('.cell')].map(e => e.textContent);
    const N = Math.round(Math.sqrt(letters.length));
    const words = target
      ? [target]
      // Every `.w` chip's textContent is set from a word string in view.js, so it is
      // never actually null; the cast avoids widening this to a defensive `?? ''`
      // that would silently hide a real regression instead of throwing on one.
      : [...document.querySelectorAll('.w')].map(e => /** @type {string} */ (e.textContent).toUpperCase());
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
    /** @type {{word:string, x0:number, y0:number, x1:number, y1:number}[]} */
    const out = [];
    for (const w of words) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        for (const [dx, dy] of DIRS) {
          const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
          if (ex < 0 || ex >= N || ey < 0 || ey >= N) continue;
          let ok = true;
          for (let i = 0; i < w.length; i++) {
            if (letters[(y + dy * i) * N + (x + dx * i)] !== w[i]) { ok = false; break; }
          }
          if (ok) out.push({ word: w, x0: x, y0: y, x1: ex, y1: ey });
        }
      }
    }
    return out;
  }, word);
  if (!runs.length) throw new Error(`could not locate ${word || 'any word'} in the grid`);
  return runs;
}

/**
 * The first run that reads the word. Only safe where the caller does not need the word to
 * actually register — asserting a miss, or reading geometry. To find a word for real,
 * use `findAndDrag`, which tries runs until one is accepted.
 * @param {Page} page @param {string} [word]
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}>}
 */
export async function findWordInGrid(page, word) {
  return (await findRunsInGrid(page, word))[0];
}

/** Drag runs until the word actually crosses out, and return the run that worked.
 *
 * A word can read at several runs but is placed at exactly one, so a single drag at the
 * first match is a coin flip on any board where the word's letters recur.
 * @param {Page} page @param {string} word
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}>}
 */
export async function findAndDrag(page, word) {
  const runs = await findRunsInGrid(page, word);
  for (const run of runs) {
    await dragCells(page, run);
    const done = await page.locator('.w.done, .w.glow').allTextContents();
    if (done.some(t => t.trim().toUpperCase() === word.toUpperCase())) return run;
  }
  throw new Error(`no run for ${word} registered as found — ${runs.length} tried`);
}

/** Same brute-force search, but only accepts a diagonally placed word.
 * @param {Page} page
 * @returns {Promise<{word:string, x0:number, y0:number, x1:number, y1:number}>}
 */
export async function findDiagonalWord(page) {
  const all = await page.locator('.w').allTextContents();
  for (const w of all) {
    // Every run, not just the first: the first match can be a straight ghost of a word
    // that is actually placed diagonally, which would skip a perfectly good candidate.
    for (const hit of await findRunsInGrid(page, w.toUpperCase())) {
      if (hit.x0 !== hit.x1 && hit.y0 !== hit.y1) return hit;
    }
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

/** Remove service-worker registration before any page script runs.
 *
 * Needed by any test that intercepts a lazily imported word pool with `page.route`.
 * Once the worker calls `clients.claim()` it controls the page, and a dynamic
 * `import()` is then fetched from inside the worker's context where `page.route`
 * cannot see it — the request simply never reaches the handler and the test's
 * interception silently does nothing.
 * @param {Page} page @returns {Promise<void>} */
export async function blockServiceWorker(page) {
  await page.addInitScript(() => { delete Object.getPrototypeOf(navigator).serviceWorker; });
}
