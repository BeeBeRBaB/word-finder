// Word Finder — wiring. The only module that owns mutable game state, reads the URL, or
// listens for events; everything it calls is either pure (rng, puzzle, layout, catalog)
// or a stateless renderer (view, effects).
import { CATEGORIES, categoryOf } from './catalog.js';
import { loadCategory, loadSubject, SubjectLoadError } from './subjects.js';
import { makeRng, resolveSeed, resolveTarget } from './rng.js';
import { buildPuzzle, cap, matchWord, snap } from './puzzle.js';
import { computeLayout, pickPreset, PRESETS } from './layout.js';
import { applyLayout, renderGrid, renderList, renderPills, renderFoundCells, renderSolvedShape } from './view.js';
import { burst, pop } from './effects.js';
import { makeStorage } from './storage.js';
import { makeAppearance, appearanceLabel } from './appearance.js';
import { makePicker } from './picker.js';

/**
 * @typedef {import('./puzzle.js').Puzzle} Puzzle
 * @typedef {import('./puzzle.js').Selection} Selection
 * @typedef {import('./layout.js').LayoutDims} LayoutDims
 * @typedef {import('./layout.js').Preset} Preset
 * @typedef {import('./view.js').Els} Els
 * @typedef {import('./view.js').FoundEntry} FoundEntry
 * @typedef {{
 *   puzzle: Puzzle|null,
 *   size: number,
 *   found: Record<string, FoundEntry>,
 *   foundOrder: string[],
 *   sel: Selection|null,
 *   miss: Selection|null,
 *   drag: {x:number, y:number}|null,
 *   dims: LayoutDims,
 *   winTimer: ReturnType<typeof setTimeout>|null,
 *   minCell: number,
 *   rendered: {puzzle: Puzzle|null, cell: number},
 * }} State
 */

const PAD = 10;
// Which board THIS DEVICE deals, resolved once from `screen` so a resize or rotation
// never changes it. Governs new games only; a restored board keeps the size it was
// saved at.
const PRESET = pickPreset({ screenW: screen.width, screenH: screen.height });
// How long a found word glows before it strikes through. Matches the `foundGlow`
// animation duration in styles.css.
const GLOW_MS = 900;
/** @returns {boolean} */
const prefersReducedMotion = () =>
  !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Makes a missing element fail at startup rather than as a null deref later.
 * @param {string} id @returns {HTMLElement} */
function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}
/** @type {Els} */
const els = {
  app: must('app'), gridbox: must('gridbox'), pills: must('pills'), letters: must('letters'), fx: must('fx'),
  list: must('list'), side: must('side'), count: must('count'),
  subject: must('subject'), category: must('category'), win: must('win'), winmsg: must('winmsg'),
  picker: must('picker'), winclose: must('winclose'), appearance: must('appearance'),
  solved: must('solved'),
};

// The single home of every mutable value. `dims` is a placeholder newPuzzle() replaces
// before any event can fire.
/** @type {State} */
const state = {
  puzzle: null,
  size: PRESET.size,
  minCell: PRESET.minCell,
  found: {},
  foundOrder: [],
  sel: null,
  miss: null,
  drag: null,
  dims: { landscape: false, cell: 34, gridSize: 0, sideWidth: 0, listColumns: '1fr 1fr', scroll: false },
  winTimer: null,
  // What the on-screen cells were built from; cell:0 matches nothing, so the first
  // layout() always renders.
  rendered: { puzzle: null, cell: 0 },
};

const store = makeStorage();
/** @type {number} */
let currentSeed;
/** @type {string} */
let subjectId;
// The word mid-glow in the list. Only ever set by a live find, never by a restore.
/** @type {string|null} */
let justFound = null;

/** Which of the four pill hues a subject underlines its name with. Hashed from the name
 * rather than its position, so reordering the catalog does not reshuffle all 600.
 * @param {string} name @returns {number} */
function accentSlot(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 4 + 1;
}

/** One phosphor pass across the grid as a puzzle appears. Restarting a CSS animation
 * needs the class gone, a forced reflow, then the class back — without the reflow the
 * browser coalesces remove+add into no change at all.
 * @returns {void} */
function sweep() {
  if (prefersReducedMotion()) return;
  els.gridbox.classList.remove('sweep');
  void els.gridbox.offsetWidth;
  els.gridbox.classList.add('sweep');
}

/** Every puzzle is built from its own fresh rng seeded by `seed`, so a stored seed
 * reproduces its grid. `shape` is an argument, not PRESET: a restored save may have been
 * dealt at a different size.
 * @param {number} seed @param {import('./subjects.js').Subject} subject
 * @param {Preset} shape
 * @returns {void} */
function newPuzzle(seed, subject, shape) {
  currentSeed = seed;
  subjectId = subject.id;
  state.size = shape.size;
  state.minCell = shape.minCell;
  const rng = makeRng(seed);
  justFound = null;
  state.found = {}; state.foundOrder = []; state.sel = null; state.miss = null; state.drag = null;
  state.puzzle = buildPuzzle({
    name: subject.name, pool: subject.words, rng,
    size: shape.size, count: shape.count, mix: shape.mix,
  });
  els.subject.textContent = cap(state.puzzle.name);
  els.subject.dataset.accent = String(accentSlot(state.puzzle.name));
  els.category.textContent = subject.categoryName;
  // Or a stale timer drops the win overlay over the fresh grid, swallowing every tap.
  if (state.winTimer) { clearTimeout(state.winTimer); state.winTimer = null; }
  els.win.style.display = 'none';
  layout();
  list();
  sweep();
  persist();
}

/** Just enough to regenerate the identical grid on reload: the seed, the subject, the
 * board's shape and each found word's selection — not the cells themselves.
 * @returns {void} */
function persist() {
  if (!state.puzzle) return;   // nothing to save before the first deal
  store.save({
    seed: currentSeed,
    subjectId,
    size: state.size,
    // buildPuzzle never returns a short board, so the word list IS the count.
    count: state.puzzle.words.length,
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
    size: state.size, pad: PAD, count: state.puzzle.words.length, minCell: state.minCell,
  });
  applyLayout(els, state.dims);
  // Unchanged means the rebuild would be byte-identical — true on nearly every resize
  // frame. Keyed on the puzzle object, not just its shape, or a new board at the same
  // size would keep the old letters. Size needs no check of its own: only newPuzzle
  // changes it, and it replaces state.puzzle in the same breath.
  const r = state.rendered;
  if (r.puzzle === state.puzzle && r.cell === state.dims.cell) return;
  state.rendered = { puzzle: state.puzzle, cell: state.dims.cell };
  renderGrid(els, state.puzzle, state.dims, state.size, PAD);
  // renderGrid rebuilds every cell, so found-ness has to be reapplied after it.
  renderFoundCells(els, state, state.size);
  pills();
}

let resizeFrame = 0;
/** One relayout per frame. Cancel-and-reschedule rather than a pending flag, which would
 * latch shut for good if a frame scheduled in a hidden tab were dropped. The real saving
 * is layout()'s guard — a browser already fires resize about once per frame.
 * @returns {void} */
function onResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(layout);
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
const clampI = (v) => Math.max(0, Math.min(state.size - 1, Math.round(v)));

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
  const p = cellXY(e), r = snap(state.drag.x, state.drag.y, p.fx, p.fy, state.size);
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
  // Aliased to a local so the narrowing to non-null survives inside the setTimeout
  // closures below, the same reason effects.js aliases `ac`.
  const puzzle = state.puzzle;
  const hit = matchWord(puzzle.placements, state.found, state.size, s);
  state.sel = null;
  if (hit) {
    state.found[hit] = { sel: s };
    state.foundOrder.push(hit);
    renderFoundCells(els, state, state.size);
    const won = state.foundOrder.length === puzzle.words.length;
    burst(els.fx, s, won ? 90 : 34, state.dims, PAD);
    pop(won);
    // Glow, then strike through. The timer only clears if `hit` is still the one
    // glowing; a second find resets justFound and that word's own timer strikes it.
    if (prefersReducedMotion()) {
      justFound = null;
    } else {
      justFound = hit;
      setTimeout(() => { if (justFound === hit) { justFound = null; list(); } }, GLOW_MS);
    }
    list();
    persist();
    // newPuzzle() cancels state.winTimer before replacing state.puzzle, so by the time
    // this fires `puzzle` is still the one that was just won.
    if (won) state.winTimer = setTimeout(() => {
      state.winTimer = null;
      els.winmsg.textContent = 'You found every ' + cap(puzzle.name) + ' word.';
      renderSolvedShape(els, state, state.size);
      els.win.style.display = 'flex';
    }, 700);
  } else if (!(s.x0 === s.x1 && s.y0 === s.y1)) {
    // A plain tap's 1-cell selection can never match, so it is not a miss.
    flashMiss(s);
  }
  pills();
}
els.gridbox.addEventListener('pointerup', endDrag);
els.gridbox.addEventListener('pointercancel', endDrag);

/** Say why a deal failed, in the one place a subject name would otherwise sit. Shared by
 * every caller that can hit a rejected load, so a failure reads identically wherever it
 * happens.
 * @param {unknown} err @returns {void} */
function reportLoadFailure(err) {
  const offline = err instanceof SubjectLoadError && err.reason === 'unavailable';
  // Recorded here, not just in newGame: boot()'s ?subject=/?category= path and restore()
  // call the loader directly, and a failure on either used to be shown and then
  // forgotten. Only 'unavailable' — 'unknown' means an id nothing offers anyway.
  if (offline) unavailableCategories.add(categoryOf(err.id));
  els.subject.textContent = offline ? 'Offline' : 'Unavailable';
  els.category.textContent = '';
}

// Category ids whose module has failed to load this session. One shared record, read by
// newGame's random draw and by the picker's `isUnavailable`, so the win card — which
// bypasses the dialog entirely — still never repeats a draw already proven to fail.
/** @type {Set<string>} */
const unavailableCategories = new Set();

/** A fresh subject is a player-facing surprise, so it stays on Math.random() rather than
 * the seeded sequence: `?seed=` pins the puzzle you land on, not every one after. It also
 * gets a fresh seed, or newPuzzle would reproduce the same choices verbatim.
 * @param {string|null} [categoryId] restrict the pick to one category
 * @returns {Promise<void>} */
async function newGame(categoryId) {
  // The exclusion narrows the RANDOM draw only; an explicit categoryId is attempted
  // regardless. Falls back to the full catalog if everything is somehow marked bad.
  const candidates = CATEGORIES.filter(c => !unavailableCategories.has(c.id));
  const drawPool = candidates.length ? candidates : CATEGORIES;
  const id = categoryId ?? drawPool[Math.floor(Math.random() * drawPool.length)].id;
  /** @type {import('./subjects.js').CategoryData} */
  let cat;
  try {
    cat = await loadCategory(id);
  } catch (err) {
    unavailableCategories.add(id);
    throw err;
  }
  // A category that failed before but loads now (cache warmed, network back) is no longer
  // a reason to skip it. The loader retries on a fresh URL precisely so this can succeed.
  unavailableCategories.delete(id);
  // Avoid dealing the subject already on screen, unless it is the only one there is.
  const fresh = cat.subjectIds.filter(s => s !== subjectId);
  const subjectPool = fresh.length ? fresh : cat.subjectIds;
  const pick = subjectPool[Math.floor(Math.random() * subjectPool.length)];
  newPuzzle(Date.now() >>> 0, await loadSubject(pick), PRESET);
}
// newGame rejects when a category cannot be fetched; the picker catches that to keep
// itself open, so the rejection must survive rather than being swallowed here.
const picker = makePicker({
  root: els.picker,
  select: /** @type {HTMLSelectElement} */ (must('picker-select')),
  warning: must('picker-warning'),
  error: must('picker-error'),
  start: must('picker-start'),
  surprise: must('picker-surprise'),
  cancel: must('picker-cancel'),
  categories: CATEGORIES,
  isUnavailable: (id) => unavailableCategories.has(id),
  onStart: (categoryId) => newGame(categoryId),
});
// Unconditional, unlike the confirm it replaces: the dialog is now how a game is started,
// and the warning is one line inside it rather than a reason to show it.
must('newbtn').addEventListener('click', () => {
  const inProgress = !!state.puzzle && state.foundOrder.length > 0
    && state.foundOrder.length < state.puzzle.words.length;
  picker.open(inProgress);
});
must('winbtn').addEventListener('click', () => {
  newGame().catch((err) => {
    // newGame rejects before newPuzzle runs, so the solved board and win card are still
    // up with nothing saying the tap did nothing. Hide the overlay so the header's
    // failure text is what the player actually sees.
    els.win.style.display = 'none';
    reportLoadFailure(err);
  });
});
els.winclose.addEventListener('click', () => { els.win.style.display = 'none'; });
els.win.addEventListener('click', (e) => { if (e.target === els.win) els.win.style.display = 'none'; });

// appearance.js owns the preference and resolves it onto <html>; this callback is the
// page-shaped half. The status-bar colour is read back off the resolved palette rather
// than duplicated here, so a palette edit has exactly one home.
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const appearance = makeAppearance({
  onApply(mode) {
    els.appearance.dataset.pref = mode;
    const label = appearanceLabel(mode);
    els.appearance.title = label;
    els.appearance.setAttribute('aria-label', label);
    if (themeColorMeta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      themeColorMeta.setAttribute('content', bg);
    }
  },
});
appearance.start();
els.appearance.addEventListener('click', () => appearance.cycle());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { els.win.style.display = 'none'; picker.close(); }
});
window.addEventListener('resize', onResize);

/** Explicit `?seed=` / `?subject=` / `?category=` always wins, even over a saved game —
 * that is the point of pinning a puzzle by URL. Otherwise prefer the save, and only deal
 * fresh when there is nothing to restore.
 * @returns {Promise<void>} */
async function boot() {
  const params = new URLSearchParams(location.search);
  try {
    if (params.has('seed') || params.has('subject') || params.has('category')) {
      const seed = resolveSeed(location.search);
      // One rng for the whole resolution, so a given ?seed= always lands on the same
      // subject: resolveTarget draws from it only when the URL did not pin a category,
      // and the subject draw below continues the same stream.
      const rng = makeRng(seed);
      const target = resolveTarget(location.search, CATEGORIES, rng);
      const cat = await loadCategory(target.category);
      const id = target.subject && cat.subjectIds.includes(target.subject)
        ? target.subject
        : cat.subjectIds[rng.int(cat.subjectIds.length)];
      newPuzzle(seed, await loadSubject(id), PRESET);
      return;
    }
    const saved = store.load();
    if (saved) { await restore(saved); return; }
    await newGame();
  } catch (err) {
    // A blank grid with no explanation is the worst outcome available, so say what
    // happened and leave the board empty rather than half-built.
    reportLoadFailure(err);
  } finally {
    // Reveal whatever we ended up with — a board, or the failure text. Runs after the
    // DOM writes above and before the next paint, so the first frame is the final one.
    document.documentElement.removeAttribute('data-booting');
  }
}

/** Regenerate the exact grid a save came from, then replay the found words on top. The
 * saved shape wins over this device's preset — a board is not something a resize gets to
 * discard. A word the regenerated puzzle doesn't contain, or one already replayed, is
 * skipped rather than crashing.
 * @param {import('./storage.js').SaveData} saved @returns {Promise<void>} */
async function restore(saved) {
  const shape = saved.size === PRESETS.compact.size ? PRESETS.compact : PRESETS.full;
  newPuzzle(saved.seed, await loadSubject(saved.subjectId), {
    size: saved.size, count: saved.count, mix: shape.mix, minCell: shape.minCell,
  });
  for (const f of saved.found) {
    if (!state.puzzle || !state.puzzle.words.includes(f.word) || state.found[f.word]) continue;
    state.found[f.word] = { sel: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 } };
    state.foundOrder.push(f.word);
  }
  renderFoundCells(els, state, state.size);
  pills();
  list(); // redraw pills + cross out; deliberately does NOT pop the win overlay
  // newPuzzle above already saved an empty `found`, so without this the replayed
  // progress would only live in memory and a second reload would lose it.
  persist();
}

// boot() never rejects — it reports any failure into the DOM itself.
void boot();
// './sw.js' resolves against the DOCUMENT, not this module. Writing '../sw.js' because
// the script lives in src/ would resolve to the domain root and break the project-path
// deploy on GitHub Pages, where the app is served from /word-finder/.
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
