// Themed Word Finder — wiring. This is the only module that owns mutable game
// state, reads the URL, or listens for events; everything it calls is either pure
// (rng, puzzle, layout) or a stateless renderer (view, effects).
import { THEMES } from './themes.js';
import { makeRng, resolveSeed, resolveThemeIndex } from './rng.js';
import { buildPuzzle, cap, matchWord, readLine, snap } from './puzzle.js';
import { computeLayout } from './layout.js';
import { applyLayout, renderGrid, renderList, renderPills } from './view.js';
import { burst, pop } from './effects.js';
import { makeStorage } from './storage.js';

/**
 * @typedef {import('./puzzle.js').Puzzle} Puzzle
 * @typedef {import('./puzzle.js').Selection} Selection
 * @typedef {import('./layout.js').LayoutDims} LayoutDims
 * @typedef {import('./view.js').Els} Els
 * @typedef {import('./view.js').FoundEntry} FoundEntry
 * @typedef {{
 *   puzzle: Puzzle|null,
 *   found: Record<string, FoundEntry>,
 *   foundOrder: string[],
 *   sel: Selection|null,
 *   miss: Selection|null,
 *   drag: {x:number, y:number}|null,
 *   dims: LayoutDims,
 *   winTimer: ReturnType<typeof setTimeout>|null,
 * }} State
 */

const N = 13, COUNT = 12, PAD = 10;
// How long a freshly found word glows green before it strikes through. Kept in
// sync with the `foundGlow` animation duration in styles.css.
const GLOW_MS = 900;
/** @returns {boolean} */
const prefersReducedMotion = () =>
  !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Every id below is present in index.html's static markup, so this never throws
 * in practice — it exists so a genuinely missing element fails loudly at startup
 * instead of as a silent `null` deref deep inside a renderer.
 * @param {string} id @returns {HTMLElement} */
function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}
/** @type {Els} */
const els = {
  app: must('app'), gridbox: must('gridbox'), pills: must('pills'), letters: must('letters'), fx: must('fx'),
  list: must('list'), main: must('main'), side: must('side'), count: must('count'),
  theme: must('theme'), win: must('win'), winmsg: must('winmsg'),
  confirm: must('confirm'), winclose: must('winclose'),
};

// The single home of every mutable value in the game. Renderers receive it and
// read from it; nothing else writes to it.
// `dims` starts as a placeholder — `newPuzzle()` below calls `layout()`
// synchronously before any event can fire, replacing it wholesale, so these
// numbers are never actually read.
/** @type {State} */
const state = {
  puzzle: null,
  found: {},
  foundOrder: [],
  sel: null,
  miss: null,
  drag: null,
  dims: { landscape: false, cell: 34, gridSize: 0, sideWidth: 0, listColumns: '1fr 1fr' },
  winTimer: null,
};

const store = makeStorage();
/** @type {number} */
let currentSeed;
/** @type {number} */
let themeIdx;
// The word (if any) currently mid-glow in the list. `list()` renders it with the
// green-glow class instead of the struck-through one; a timer clears it back to
// null so it strikes through. Only ever set by a live find, never by a restore.
/** @type {string|null} */
let justFound = null;

/** Every puzzle is built from its own fresh rng seeded by `seed`, never the
 * shared/advanced one — that's what lets a single stored seed reproduce an
 * identical grid later (see `restore`), and what makes `newTheme` safe to
 * call repeatedly without drifting out of sync with what was last saved.
 * @param {number} seed @param {number} idx @returns {void} */
function newPuzzle(seed, idx) {
  currentSeed = seed;
  themeIdx = idx;
  const rng = makeRng(seed);
  justFound = null;
  state.found = {}; state.foundOrder = []; state.sel = null; state.miss = null; state.drag = null;
  state.puzzle = buildPuzzle({ themes: THEMES, themeIdx: idx, rng, size: N, count: COUNT });
  els.theme.textContent = cap(state.puzzle.name);
  // Cancel any pending win reveal; otherwise starting a new puzzle within the
  // 700ms delay lets the stale timer drop the overlay over a fresh grid, where
  // it swallows every pointer event and makes the game unplayable.
  if (state.winTimer) { clearTimeout(state.winTimer); state.winTimer = null; }
  els.win.style.display = 'none';
  layout();
  list();
  persist();
}

/** Save just enough to regenerate the identical grid on reload: the seed and
 * theme (from which `buildPuzzle` reproduces the same cells) plus each found
 * word's selection — not the 169 cells themselves.
 * @returns {void} */
function persist() {
  store.save({
    seed: currentSeed,
    themeIdx,
    found: state.foundOrder.map(w => ({ word: w, ...state.found[w].sel })),
  });
}

/** @returns {void} */
function layout() {
  if (!state.puzzle) return;
  const cs = getComputedStyle(els.app);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  state.dims = computeLayout({
    vw: window.innerWidth - padX,
    vh: window.innerHeight - padY,
    size: N, pad: PAD,
  });
  applyLayout(els, state.dims);
  renderGrid(els, state.puzzle, state.dims, N, PAD);
  pills();
}

const pills = () => renderPills(els, state, state.dims, PAD);
/** @returns {void} */
function list() {
  if (!state.puzzle) return;
  renderList(els, state.puzzle, state, justFound);
}

/** Briefly show the attempted selection as a red miss pill, then clear it.
 * @param {Selection} s @returns {void} */
function flashMiss(s) {
  state.miss = s;
  pills();
  setTimeout(() => { state.miss = null; pills(); }, 400);
}

/** @param {PointerEvent} e @returns {{fx:number, fy:number}} */
function cellXY(e) {
  const r = els.gridbox.getBoundingClientRect();
  return {
    fx: (e.clientX - r.left - PAD) / state.dims.cell - 0.5,
    fy: (e.clientY - r.top - PAD) / state.dims.cell - 0.5,
  };
}
/** @param {number} v @returns {number} */
const clampI = (v) => Math.max(0, Math.min(N - 1, Math.round(v)));

els.gridbox.addEventListener('pointerdown', (e) => {
  if (!state.puzzle) return;
  els.gridbox.setPointerCapture(e.pointerId);
  const p = cellXY(e), x = clampI(p.fx), y = clampI(p.fy);
  state.drag = { x, y };
  state.sel = { x0: x, y0: y, x1: x, y1: y };
  pills();
});

els.gridbox.addEventListener('pointermove', (e) => {
  if (!state.drag) return;
  const p = cellXY(e), r = snap(state.drag.x, state.drag.y, p.fx, p.fy, N);
  if (!state.sel || state.sel.x1 !== r.x1 || state.sel.y1 !== r.y1) {
    state.sel = { x0: state.drag.x, y0: state.drag.y, x1: r.x1, y1: r.y1 };
    pills();
  }
});

/** @returns {void} */
function endDrag() {
  if (!state.drag) return;
  state.drag = null;
  if (!state.sel || !state.puzzle) { state.sel = null; pills(); return; }
  const s = state.sel;
  // Aliased to a local so the narrowing to non-null survives inside the
  // `setTimeout` closures below, the same reason `effects.js` aliases `ac`.
  const puzzle = state.puzzle;
  const hit = matchWord(puzzle.words, state.found, readLine(puzzle.cells, N, s));
  state.sel = null;
  if (hit) {
    state.found[hit] = { sel: s };
    state.foundOrder.push(hit);
    const won = state.foundOrder.length === puzzle.words.length;
    burst(els.fx, s, won ? 90 : 34, state.dims, PAD);
    pop(won);
    // Glow the word green for one beat, then strike it through. The timer only
    // clears the glow if `hit` is still the one glowing — finding a second word
    // meanwhile resets `justFound`, and that word's own timer strikes it. Under
    // reduced motion, skip the glow and strike immediately.
    if (prefersReducedMotion()) {
      justFound = null;
    } else {
      justFound = hit;
      setTimeout(() => { if (justFound === hit) { justFound = null; list(); } }, GLOW_MS);
    }
    list();
    persist();
    // `newPuzzle()` cancels `state.winTimer` before replacing `state.puzzle`, so
    // by the time this fires `puzzle` is still the one that was just won.
    if (won) state.winTimer = setTimeout(() => {
      state.winTimer = null;
      els.winmsg.textContent = 'You found every ' + cap(puzzle.name) + ' word.';
      els.win.style.display = 'flex';
    }, 700);
  } else if (!(s.x0 === s.x1 && s.y0 === s.y1)) {
    // Wrong guess: flash the attempted selection red, then clear it. A plain tap
    // (pointerdown with no movement) produces a 1-cell selection that can never
    // match a word, so skip the flash for it rather than flashing red on every tap.
    flashMiss(s);
  }
  pills();
}
els.gridbox.addEventListener('pointerup', endDrag);
els.gridbox.addEventListener('pointercancel', endDrag);

// A fresh theme is a player-facing surprise, so it stays on Math.random() rather
// than the seeded sequence — `?seed=` pins the puzzle you land on, not every one after.
// It also gets a fresh seed (not the old `currentSeed`): `newPuzzle` builds its own
// rng from scratch each time, so reusing the same seed here would reproduce the
// exact same word/placement choices for the new theme too.
/** @returns {void} */
function newTheme() {
  /** @type {number} */
  let i;
  do { i = Math.floor(Math.random() * THEMES.length); } while (i === themeIdx);
  newPuzzle(Date.now() >>> 0, i);
}
/** Mid-puzzle, an accidental tap on "New theme" would silently wipe progress, so
 * confirm first; a fresh or fully-solved board has nothing to lose, so skip the
 * dialog and start immediately.
 * @returns {void} */
function requestNewTheme() {
  const inProgress = state.puzzle && state.foundOrder.length > 0
    && state.foundOrder.length < state.puzzle.words.length;
  if (inProgress) { els.confirm.style.display = 'flex'; return; }
  newTheme();
}
must('newbtn').addEventListener('click', requestNewTheme);
must('confirm-cancel').addEventListener('click', () => { els.confirm.style.display = 'none'; });
must('confirm-ok').addEventListener('click', () => { els.confirm.style.display = 'none'; newTheme(); });
must('winbtn').addEventListener('click', newTheme);
els.winclose.addEventListener('click', () => { els.win.style.display = 'none'; });
els.win.addEventListener('click', (e) => { if (e.target === els.win) els.win.style.display = 'none'; });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { els.win.style.display = 'none'; els.confirm.style.display = 'none'; }
});
window.addEventListener('resize', layout);

// Explicit `?seed=`/`?theme=` in the URL always wins (it's what the spec-1
// determinism e2e test relies on), even over a saved game — that's the whole
// point of pinning a puzzle by URL. Otherwise, prefer a saved game; only fall
// back to a fresh random puzzle when there's nothing to restore.
const params = new URLSearchParams(location.search);
if (params.has('seed') || params.has('theme')) {
  const seed = resolveSeed(location.search);
  newPuzzle(seed, resolveThemeIndex(location.search, THEMES.length, makeRng(seed)));
} else {
  const saved = store.load();
  if (saved) restore(saved);
  else newPuzzle(Date.now() >>> 0, Math.floor(Math.random() * THEMES.length));
}

/** Regenerate the exact grid a save came from (same seed -> same fresh rng ->
 * same puzzle, per `newPuzzle`), then replay the found words on top of it.
 * Guards against a stale/corrupt save: a word the regenerated puzzle doesn't
 * contain, or one already replayed, is skipped rather than crashing.
 * @param {import('./storage.js').SaveData} saved @returns {void} */
function restore(saved) {
  newPuzzle(saved.seed, saved.themeIdx); // regenerates the identical grid, empty found
  for (const f of saved.found) {
    if (!state.puzzle || !state.puzzle.words.includes(f.word) || state.found[f.word]) continue;
    state.found[f.word] = { sel: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 } };
    state.foundOrder.push(f.word);
  }
  pills();
  list(); // redraw pills + cross out; deliberately does NOT pop the win overlay
  // `newPuzzle()` above already called `persist()` with an empty `found` (it
  // always saves a fresh puzzle), so without this the just-replayed progress
  // would only live in memory — a second reload would silently lose it even
  // though the first one looked fine. Re-save now that `found` is populated.
  persist();
}
// './sw.js' stays relative to the DOCUMENT, not to this module — register()
// resolves against the page's base URL. Writing '../sw.js' because the script
// now lives in src/ would resolve to the domain root and break the project-path
// deploy on GitHub Pages, where the app is served from /word-finder/.
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
