// Word Finder — wiring. This is the only module that owns mutable game
// state, reads the URL, or listens for events; everything it calls is either pure
// (rng, puzzle, layout, catalog) or a stateless renderer (view, effects).
import { CATEGORIES, categoryOf } from './catalog.js';
import { loadCategory, loadSubject, SubjectLoadError } from './subjects.js';
import { makeRng, resolveSeed, resolveTarget } from './rng.js';
import { buildPuzzle, cap, matchWord, readLine, snap } from './puzzle.js';
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
 * }} State
 */

const PAD = 10;
// Which board THIS DEVICE deals. Resolved once, from screen rather than the viewport,
// so resizing a window or rotating a phone never changes it. It governs new games
// only — a restored board is rendered at the size it was saved at, whatever this says.
const PRESET = pickPreset({ screenW: screen.width, screenH: screen.height });
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
  subject: must('subject'), category: must('category'), win: must('win'), winmsg: must('winmsg'),
  picker: must('picker'), winclose: must('winclose'), appearance: must('appearance'),
  solved: must('solved'),
};

// The single home of every mutable value in the game. `dims` starts as a placeholder:
// `newPuzzle()` calls `layout()` synchronously before any event can fire, replacing it
// wholesale, so these numbers are never actually read.
/** @type {State} */
const state = {
  puzzle: null,
  size: PRESET.size,
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
/** @type {string} */
let subjectId;
/** @type {number} */
let boardCount;
// The word currently mid-glow in the list, rendered with the green-glow class instead
// of the struck-through one until a timer clears it. Only ever set by a live find,
// never by a restore.
/** @type {string|null} */
let justFound = null;

/** Which of the four pill hues a subject underlines its name with. Hashed from the
 * name rather than drawn from the rng so a subject keeps the same colour every time it
 * comes up, and rather than from its position so reordering the catalog doesn't
 * reshuffle all 600. Reuses the pill tokens; it introduces no colour of its own.
 * @param {string} name @returns {number} */
function accentSlot(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 4 + 1;
}

/** One phosphor pass across the grid as a puzzle appears. Restarting a CSS animation
 * needs the class gone, a forced reflow, then the class back — without the reflow the
 * browser coalesces remove+add into no change at all and a second new game is still.
 * @returns {void} */
function sweep() {
  if (prefersReducedMotion()) return;
  els.gridbox.classList.remove('sweep');
  void els.gridbox.offsetWidth;
  els.gridbox.classList.add('sweep');
}

/** Every puzzle is built from its own fresh rng seeded by `seed`, never the
 * shared/advanced one — that's what lets a stored seed reproduce an identical grid
 * later (see `restore`), and makes `newGame` safe to call repeatedly.
 *
 * The board's shape arrives as an argument rather than being read off PRESET: a
 * restored save may have been dealt at a different size, and the board on screen is
 * the one that has to be rendered.
 * @param {number} seed @param {import('./subjects.js').Subject} subject
 * @param {{size:number, count:number, mix:import('./puzzle.js').Bucket[]}} shape
 * @returns {void} */
function newPuzzle(seed, subject, shape) {
  currentSeed = seed;
  subjectId = subject.id;
  boardCount = shape.count;
  state.size = shape.size;
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
  // Cancel any pending win reveal; otherwise starting a new puzzle within the
  // 700ms delay lets the stale timer drop the overlay over a fresh grid, where
  // it swallows every pointer event and makes the game unplayable.
  if (state.winTimer) { clearTimeout(state.winTimer); state.winTimer = null; }
  els.win.style.display = 'none';
  layout();
  list();
  sweep();
  persist();
}

/** Save just enough to regenerate the identical grid on reload: the seed, the subject
 * and the board's shape (from which `buildPuzzle` reproduces the same cells) plus each
 * found word's selection — not the cells themselves.
 * @returns {void} */
function persist() {
  store.save({
    seed: currentSeed,
    subjectId,
    size: state.size,
    count: boardCount,
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
    size: state.size, pad: PAD, count: boardCount,
  });
  applyLayout(els, state.dims);
  // What the cells currently on screen were built from. Everything below derives from
  // exactly these three, so when none has changed the rebuild would produce a
  // byte-identical grid -- and most resize frames change none of them: the landscape
  // branch caps `cell` and derives it from height alone, so dragging a window's width
  // leaves it identical on all but one frame of a drag. Keyed on the puzzle object too,
  // not just its shape, or dealing a new board at the same size would skip the redraw
  // and leave the previous puzzle's letters on screen.
  if (rendered.puzzle === state.puzzle && rendered.cell === state.dims.cell && rendered.size === state.size) return;
  rendered = { puzzle: state.puzzle, cell: state.dims.cell, size: state.size };
  renderGrid(els, state.puzzle, state.dims, state.size, PAD);
  // renderGrid rebuilds every cell from scratch, so found-ness has to be reapplied
  // after it or a resize would wipe the grid's record of what you've already found.
  renderFoundCells(els, state, state.size);
  pills();
}
/** @type {{puzzle: Puzzle|null, cell: number, size: number}} */
let rendered = { puzzle: null, cell: 0, size: 0 };

let resizeFrame = 0;
/** One relayout per frame while resizing. Cancel-and-reschedule rather than a pending
 * flag: a flag that only clears inside the callback would latch shut for good if a
 * frame scheduled in a hidden tab were ever dropped rather than deferred.
 * `cancelAnimationFrame(0)` is a no-op, so the initial value is safe.
 *
 * This coalesces a burst into one call, but a real browser already fires resize at most
 * once per frame, so on its own it saves little -- the guard in `layout()` above is what
 * actually removes the work. @returns {void} */
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
  // Aliased to a local so the narrowing to non-null survives inside the
  // `setTimeout` closures below, the same reason `effects.js` aliases `ac`.
  const puzzle = state.puzzle;
  const hit = matchWord(puzzle.words, state.found, readLine(puzzle.cells, state.size, s));
  state.sel = null;
  if (hit) {
    state.found[hit] = { sel: s };
    state.foundOrder.push(hit);
    renderFoundCells(els, state, state.size);
    const won = state.foundOrder.length === puzzle.words.length;
    burst(els.fx, s, won ? 90 : 34, state.dims, PAD);
    pop(won);
    // Glow the word for one beat, then strike it through. The timer only
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
      renderSolvedShape(els, state, state.size);
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

/** Say why a deal failed, in the one place a subject name would otherwise sit.
 * Shared by every caller that can hit a rejected `loadCategory`/`loadSubject` —
 * `boot()` below, and the win card's "Play a new game" button — so a failure looks
 * and reads identically wherever it happens, rather than each call site inventing
 * its own wording.
 * @param {unknown} err @returns {void} */
function reportLoadFailure(err) {
  const offline = err instanceof SubjectLoadError && err.reason === 'unavailable';
  // Record it here, not just in newGame. boot()'s ?subject=/?category= path and
  // restore() call the loader directly, so a failure on either used to be shown to the
  // player and then forgotten -- the picker went on offering that category as enabled
  // and Surprise me went on drawing it, each attempt failing the same way. `err.id` is
  // whichever id the caller asked for, and categoryOf leaves a bare category id alone,
  // so this covers both entry points. Only 'unavailable': 'unknown' means an id that is
  // not in the catalog, which nothing offers in the first place.
  if (offline && err instanceof SubjectLoadError) unavailableCategories.add(categoryOf(err.id));
  els.subject.textContent = offline ? 'Offline' : 'Unavailable';
  els.category.textContent = '';
}

// Category ids whose module has failed to load this session. Read by newGame's random
// draw just below (so Surprise me never re-picks a category already known not to
// work) and by the picker's `isUnavailable` (so it can disable that option) — one
// shared record rather than two, so the win card, which bypasses the picker's own
// dialog entirely, still never repeats a draw already proven to fail.
/** @type {Set<string>} */
const unavailableCategories = new Set();

// A fresh subject is a player-facing surprise, so it stays on Math.random() rather
// than the seeded sequence — `?seed=` pins the puzzle you land on, not every one after.
// It also gets a fresh seed: `newPuzzle` builds its own rng from scratch each time, so
// reusing `currentSeed` would reproduce the same word and placement choices verbatim.
/** @param {string|null} [categoryId] restrict the pick to one category
 * @returns {Promise<void>} */
async function newGame(categoryId) {
  // The exclusion only narrows the RANDOM draw — an explicit categoryId (the picker
  // only ever offers one that isn't disabled, but this stays honest either way) is
  // attempted regardless. Falls back to the full catalog if somehow everything in it
  // is currently marked unavailable, the same "unless it's the only one" shape as the
  // subject pick below.
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
  // A category that failed before but loads now (cache warmed, network back) is no
  // longer a reason to skip it. Reached when something attempts it again despite the
  // record: the fallback above once everything is marked, or an explicit ?category=.
  // The loader retries on a fresh URL precisely so that attempt can succeed -- the
  // module map remembers a rejected specifier for the life of the page.
  unavailableCategories.delete(id);
  // Avoid dealing the subject already on screen, unless it is the only one there is.
  const fresh = cat.subjectIds.filter(s => s !== subjectId);
  const subjectPool = fresh.length ? fresh : cat.subjectIds;
  const pick = subjectPool[Math.floor(Math.random() * subjectPool.length)];
  newPuzzle(Date.now() >>> 0, await loadSubject(pick), PRESET);
}
// `newGame` rejects when a category cannot be fetched; the picker catches that to
// keep itself open, so the rejection must survive rather than being swallowed here.
const picker = makePicker({
  root: els.picker,
  select: /** @type {HTMLSelectElement} */ (must('picker-select')),
  warning: must('picker-warning'),
  error: must('picker-error'),
  start: must('picker-start'),
  cancel: must('picker-cancel'),
  categories: CATEGORIES,
  isUnavailable: (id) => unavailableCategories.has(id),
  onStart: (categoryId) => newGame(categoryId),
});
// Unconditional, unlike the confirm dialog it replaces: the dialog is now how a game
// is started, and the warning is one line inside it rather than a reason to show it.
must('newbtn').addEventListener('click', () => {
  const inProgress = !!state.puzzle && state.foundOrder.length > 0
    && state.foundOrder.length < state.puzzle.words.length;
  picker.open(inProgress);
});
must('winbtn').addEventListener('click', () => {
  newGame().catch((err) => {
    // An offline network, an evicted cache, or (right now) a category the parallel
    // content authoring hasn't reached yet: `newGame()` rejects before `newPuzzle()`
    // ever runs, so the just-solved board and win card are still on screen with
    // nothing telling the player their tap did nothing. Hide the stale overlay so
    // the header's failure text (the same `reportLoadFailure` boot() uses) is what
    // they actually see, rather than reporting it somewhere the win card covers.
    els.win.style.display = 'none';
    reportLoadFailure(err);
  });
});
els.winclose.addEventListener('click', () => { els.win.style.display = 'none'; });
els.win.addEventListener('click', (e) => { if (e.target === els.win) els.win.style.display = 'none'; });

// Appearance. `appearance.js` owns the preference and resolves it onto <html>; this
// callback is the page-shaped half — the button's icon and label, and the status-bar
// colour. The colour is read back off the resolved palette rather than duplicated
// here, so a future palette edit has exactly one home.
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const appearance = makeAppearance({
  onApply(pref, mode) {
    els.appearance.dataset.pref = pref;
    const label = appearanceLabel(pref, mode);
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

// Explicit `?seed=` / `?subject=` / `?category=` in the URL always wins (it is what the
// determinism e2e test relies on), even over a saved game — that is the whole point of
// pinning a puzzle by URL. Otherwise prefer a saved game; only fall back to a fresh
// random puzzle when there is nothing to restore.
/** @returns {Promise<void>} */
async function boot() {
  const params = new URLSearchParams(location.search);
  try {
    if (params.has('seed') || params.has('subject') || params.has('category')) {
      const seed = resolveSeed(location.search);
      // One rng for the whole resolution. resolveTarget draws from it only when the
      // URL did not pin a category, and the subject draw below uses the same stream,
      // so a given ?seed= always lands on the same subject.
      const rng = makeRng(seed);
      const target = resolveTarget(location.search, CATEGORIES, rng);
      const cat = await loadCategory(target.category);
      const id = target.subject && cat.words[target.subject]
        ? target.subject
        : cat.subjectIds[rng.int(cat.subjectIds.length)];
      newPuzzle(seed, await loadSubject(id), PRESET);
      return;
    }
    const saved = store.load();
    if (saved) { await restore(saved); return; }
    await newGame();
  } catch (err) {
    // Offline with an uncached category, or a save naming a subject since removed. A
    // blank grid with no explanation is the worst outcome available, so say what
    // happened and leave the board empty rather than half-built.
    reportLoadFailure(err);
  }
}

/** Regenerate the exact grid a save came from (same seed + same subject + same shape
 * -> same fresh rng -> same puzzle, per `newPuzzle`), then replay the found words on
 * top of it. The saved shape wins over this device's preset: a board is not something
 * a resize gets to discard. Guards against a stale/corrupt save: a word the
 * regenerated puzzle doesn't contain, or one already replayed, is skipped rather
 * than crashing.
 * @param {import('./storage.js').SaveData} saved @returns {Promise<void>} */
async function restore(saved) {
  const shape = saved.size === PRESETS.compact.size ? PRESETS.compact : PRESETS.full;
  newPuzzle(saved.seed, await loadSubject(saved.subjectId), {
    size: saved.size, count: saved.count, mix: shape.mix,
  });
  for (const f of saved.found) {
    if (!state.puzzle || !state.puzzle.words.includes(f.word) || state.found[f.word]) continue;
    state.found[f.word] = { sel: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 } };
    state.foundOrder.push(f.word);
  }
  renderFoundCells(els, state, state.size);
  pills();
  list(); // redraw pills + cross out; deliberately does NOT pop the win overlay
  // `newPuzzle()` above already called `persist()` with an empty `found` (it
  // always saves a fresh puzzle), so without this the just-replayed progress
  // would only live in memory — a second reload would silently lose it even
  // though the first one looked fine. Re-save now that `found` is populated.
  persist();
}

// boot() never rejects — its own try/catch (above) reports any failure into the DOM
// itself via reportLoadFailure — so there is nothing here for `void` to discard.
void boot();
// './sw.js' stays relative to the DOCUMENT, not to this module — register()
// resolves against the page's base URL. Writing '../sw.js' because the script
// now lives in src/ would resolve to the domain root and break the project-path
// deploy on GitHub Pages, where the app is served from /word-finder/.
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
