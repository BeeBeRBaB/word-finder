// Rendering. Everything here writes to the DOM and returns nothing; it holds no
// state of its own, so what you see is a pure function of the arguments passed in.
import { cap } from './puzzle.js';

/**
 * @typedef {import('./puzzle.js').Puzzle} Puzzle
 * @typedef {import('./puzzle.js').Selection} Selection
 * @typedef {import('./layout.js').LayoutDims} LayoutDims
 * @typedef {{sel:Selection}} FoundEntry
 * @typedef {{found:Record<string, FoundEntry>, foundOrder:string[], sel:Selection|null, miss:Selection|null}} GameState
 * @typedef {{
 *   app:HTMLElement, gridbox:HTMLElement, pills:HTMLElement, letters:HTMLElement, fx:HTMLElement,
 *   list:HTMLElement, main:HTMLElement, side:HTMLElement, count:HTMLElement,
 *   theme:HTMLElement, win:HTMLElement, winmsg:HTMLElement, confirm:HTMLElement, winclose:HTMLElement,
 * }} Els
 */

const PAL = ['rgba(240,196,90,.38)','rgba(120,220,255,.33)','rgba(255,140,150,.35)','rgba(190,150,255,.36)'];

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
  els.side.style.width = dims.sideWidth + 'px';
  els.list.style.gridTemplateColumns = dims.listColumns;
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

/** One rounded highlight bar laid over the cells of a selection.
 * @param {Selection} s @param {string} bg @param {number} cell @param {number} pad
 * @returns {HTMLDivElement} */
function pillDiv(s, bg, cell, pad) {
  const h = Math.round(cell * 0.82);
  const cx0 = pad + (s.x0 + 0.5) * cell, cy0 = pad + (s.y0 + 0.5) * cell;
  const cx1 = pad + (s.x1 + 0.5) * cell, cy1 = pad + (s.y1 + 0.5) * cell;
  const d = document.createElement('div');
  d.className = 'pill';
  d.style.left = Math.round(cx0 - h / 2) + 'px';
  d.style.top = Math.round(cy0 - h / 2) + 'px';
  d.style.width = Math.round(Math.sqrt(Math.pow(cx1 - cx0, 2) + Math.pow(cy1 - cy0, 2)) + h) + 'px';
  d.style.height = h + 'px';
  d.style.background = bg;
  d.style.transformOrigin = (h / 2) + 'px center';
  d.style.transform = 'rotate(' + Math.round(Math.atan2(cy1 - cy0, cx1 - cx0) * 180 / Math.PI) + 'deg)';
  return d;
}

/** Found-word pills in discovery order, plus the live selection on top.
 * @param {Els} els @param {GameState} state @param {LayoutDims} dims @param {number} pad
 * @returns {void} */
export function renderPills(els, state, dims, pad) {
  els.pills.innerHTML = '';
  state.foundOrder.forEach((w, i) => els.pills.appendChild(pillDiv(state.found[w].sel, PAL[i % 4], dims.cell, pad)));
  if (state.sel) els.pills.appendChild(pillDiv(state.sel, 'rgba(79,209,165,.30)', dims.cell, pad));
  if (state.miss) els.pills.appendChild(pillDiv(state.miss, 'rgba(255,90,90,.5)', dims.cell, pad));
}

/**
 * The word list. A word's presence in `state.found` means found-and-done;
 * this module keeps no state of its own. `justFound` is the single word (if any)
 * that was found this instant: it renders with class `glow` — a brief green
 * fade — instead of `done`, so it animates before it is struck through. Every
 * other found word, including all of them after a restore, renders `done`.
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
