// Rendering. Everything here writes to the DOM and returns nothing; it holds no
// state of its own, so what you see is a pure function of the arguments passed in.
import { cap, lineIndices } from './puzzle.js';

/**
 * @typedef {import('./puzzle.js').Puzzle} Puzzle
 * @typedef {import('./puzzle.js').Selection} Selection
 * @typedef {import('./layout.js').LayoutDims} LayoutDims
 * @typedef {{sel:Selection}} FoundEntry
 * @typedef {{found:Record<string, FoundEntry>, foundOrder:string[], sel:Selection|null, miss:Selection|null}} GameState
 * @typedef {{
 *   app:HTMLElement, gridbox:HTMLElement, pills:HTMLElement, letters:HTMLElement, fx:HTMLElement,
 *   list:HTMLElement, main:HTMLElement, side:HTMLElement, count:HTMLElement,
 *   subject:HTMLElement, category:HTMLElement, win:HTMLElement, winmsg:HTMLElement,
 *   picker:HTMLElement, winclose:HTMLElement, appearance:HTMLElement, solved:HTMLElement,
 * }} Els
 */

/**
 * @param {Els} els
 * @param {import('./layout.js').LayoutDims} dims
 * @returns {void}
 */
export function applyLayout(els, dims) {
  els.gridbox.style.width = dims.gridSize + 'px';
  els.gridbox.style.height = dims.gridSize + 'px';
  if (dims.landscape) {
    els.app.setAttribute('data-landscape', '');
    els.app.style.gridTemplateColumns = dims.gridSize + 'px ' + dims.sideWidth + 'px';
  } else {
    els.app.removeAttribute('data-landscape');
    els.app.style.gridTemplateColumns = '1fr';
  }
  // Portrait: full width, so the list lines up with the kicker above it rather than
  // with the narrower centred grid. Landscape: the rail is its own column.
  els.side.style.width = dims.landscape ? dims.sideWidth + 'px' : '100%';
  els.list.style.gridTemplateColumns = dims.listColumns;
  // minCell won and the board is bigger than its space: scroll, or #app's
  // overflow:hidden would put cells where nothing can reach them.
  els.app.toggleAttribute('data-scroll', dims.scroll);
}

/** Rebuild every letter cell at the current cell size.
 * @param {Els} els @param {Puzzle} puzzle @param {LayoutDims} dims @param {number} size @param {number} pad
 * @returns {void} */
export function renderGrid(els, puzzle, dims, size, pad) {
  const cell = dims.cell;
  els.letters.innerHTML = '';
  const fs = Math.round(cell * 0.46);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = document.createElement('span');
    s.className = 'cell';
    s.textContent = puzzle.cells[y * size + x];
    s.style.left = (pad + x * cell) + 'px';
    s.style.top = (pad + y * cell) + 'px';
    s.style.width = cell + 'px';
    s.style.lineHeight = cell + 'px';
    s.style.fontSize = fs + 'px';
    els.letters.appendChild(s);
  }
}

// Which palette slot each found word gets, cycling. The colours themselves live in
// styles.css so they can follow the appearance setting; this module now holds none.
const PILL_CLASS = ['p1', 'p2', 'p3', 'p4'];

/** One rounded bar over a selection. `thick` is its height as a fraction of the cell —
 * finer for the solved shape, where twelve bars in a 148px box would otherwise blur.
 * @param {Selection} s @param {string} variant @param {number} cell @param {number} pad
 * @param {number} [thick]
 * @returns {HTMLDivElement} */
function pillDiv(s, variant, cell, pad, thick = 0.82) {
  const h = Math.round(cell * thick);
  const cx0 = pad + (s.x0 + 0.5) * cell, cy0 = pad + (s.y0 + 0.5) * cell;
  const cx1 = pad + (s.x1 + 0.5) * cell, cy1 = pad + (s.y1 + 0.5) * cell;
  const d = document.createElement('div');
  d.className = 'pill ' + variant;
  d.style.left = Math.round(cx0 - h / 2) + 'px';
  d.style.top = Math.round(cy0 - h / 2) + 'px';
  d.style.width = Math.round(Math.sqrt(Math.pow(cx1 - cx0, 2) + Math.pow(cy1 - cy0, 2)) + h) + 'px';
  d.style.height = h + 'px';
  d.style.transformOrigin = (h / 2) + 'px center';
  d.style.transform = 'rotate(' + Math.round(Math.atan2(cy1 - cy0, cx1 - cx0) * 180 / Math.PI) + 'deg)';
  return d;
}

/** Found-word pills in discovery order, plus the live selection on top.
 * @param {Els} els @param {GameState} state @param {LayoutDims} dims @param {number} pad
 * @returns {void} */
export function renderPills(els, state, dims, pad) {
  els.pills.innerHTML = '';
  state.foundOrder.forEach((w, i) => els.pills.appendChild(pillDiv(state.found[w].sel, PILL_CLASS[i % 4], dims.cell, pad)));
  if (state.sel) els.pills.appendChild(pillDiv(state.sel, 'sel', dims.cell, pad));
  if (state.miss) els.pills.appendChild(pillDiv(state.miss, 'miss', dims.cell, pad));
}

/** Colour the letters of a found word. Reapplied from `state` because renderGrid
 * rebuilds cells wholesale. Kept out of renderPills, which runs on every pointermove.
 * @param {Els} els @param {GameState} state @param {number} size @returns {void} */
export function renderFoundCells(els, state, size) {
  const cells = els.letters.children;
  for (let i = 0; i < cells.length; i++) cells[i].className = 'cell';
  for (const w of state.foundOrder)
    for (const i of lineIndices(size, state.found[w].sel))
      if (cells[i]) cells[i].className = 'cell found';
}

// The solved-shape plate, matching #solved in styles.css. Laid out against this rather
// than the live grid so the mark is identical whatever viewport solved it; the inset
// keeps edge words off the border.
const SOLVED_BOX = 148, SOLVED_INSET = 9;

/** The finished puzzle as bare strokes, no letters. Seeded puzzles make this a stable
 * per-seed mark, which is what makes it worth showing.
 * @param {Els} els @param {GameState} state @param {number} size @returns {void} */
export function renderSolvedShape(els, state, size) {
  els.solved.innerHTML = '';
  const cell = (SOLVED_BOX - SOLVED_INSET * 2) / size;
  state.foundOrder.forEach((w, i) =>
    els.solved.appendChild(pillDiv(state.found[w].sel, PILL_CLASS[i % 4], cell, SOLVED_INSET, 0.62)));
}

/**
 * The word list; this module keeps no state of its own. `justFound` renders `glow`
 * instead of `done` so it animates before being struck through.
 * @param {Els} els @param {Puzzle} puzzle @param {GameState} state @param {string|null} [justFound]
 * @returns {void}
 */
export function renderList(els, puzzle, state, justFound) {
  els.list.innerHTML = '';
  els.count.textContent = state.foundOrder.length + ' of ' + puzzle.words.length + ' found';
  puzzle.words.forEach((w) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = cap(w);
    if (state.found[w]) s.className = w === justFound ? 'w glow' : 'w done';
    els.list.appendChild(s);
  });
}
