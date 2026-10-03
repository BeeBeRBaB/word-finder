// Word Finder — wiring. The only module that owns mutable game state, reads the URL, or
// listens for events; everything it calls is either pure (rng, puzzle, layout, catalog)
// or a stateless renderer (view, effects).
import { CATEGORIES, categoryOf } from './catalog.js';
import { loadCategory, loadSubject, SubjectLoadError } from './subjects.js';
import { makeRng, resolveSeed, resolveTarget } from './rng.js';
import { buildPuzzle, cap, matchWord, snap } from './puzzle.js';
import { computeLayout, pickPreset, PRESETS, mixFor } from './layout.js';
import { applyLayout, renderGrid, renderList, renderPills, renderFoundCells, renderSolvedShape, renderArt, placeArt } from './view.js';
import { burst, pop } from './effects.js';
import { makeStorage, defaultStore } from './storage.js';
import { makeProgress, chooseSubject } from './progress.js';
import { makeAppearance } from './appearance.js';
import { makeSettings } from './settings.js';
import { makePicker } from './picker.js';
import { makeBackdrop } from './backgrounds.js';
import { tilesMarkup, summaryMarkup } from './bgpicker.js';
import { makeSubpage } from './subpage.js';
import { tilesMarkup as lookTilesMarkup, summaryMarkup as lookSummaryMarkup, readLooks, varsOf, lookId } from './lookpicker.js';
import { makeCloud } from './cloud.js';
import { makeLevelPlay, levelPuzzle, replaySelections } from './levelplay.js';
import { renderAccount, renderSignIn, renderLevelChoice, showLevelWin, clearLevelWin } from './account.js';

/**
 * @typedef {import('./puzzle.js').Puzzle} Puzzle
 * @typedef {import('./puzzle.js').Selection} Selection
 * @typedef {import('./layout.js').LayoutDims} LayoutDims
 * @typedef {import('./layout.js').Preset} Preset
 * @typedef {import('./view.js').Els} Els
 * @typedef {import('./view.js').FoundEntry} FoundEntry
 * @typedef {import('./levelplay.js').Deal} Deal
 * @typedef {import('./levelplay.js').Finish} Finish
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
// The player's preferences (settings.js). Read at the moment each one matters.
const cfg = makeSettings();
/** The board the next deal uses: the device's own unless Settings picks a size.
 * @returns {Preset} */
const shapeFor = () => {
  const b = cfg.get().board;
  // A phone never gets the 13x13 board: at its 30px floor it overflows the screen, and a long
  // word then needs more finger travel than is on show. Large is disabled there too.
  if (b === 'auto' || (b === 'full' && PRESET === PRESETS.compact)) return PRESET;
  return PRESETS[b];
};
// How long a found word glows before it strikes through. Matches the `foundGlow`
// animation duration in styles.css.
const GLOW_MS = 900;
// How long the win card waits before dealing the next puzzle on its own. Matches the
// `drain` animation on #winbar in styles.css.
const AUTO_NEXT_MS = 5000;
/** @returns {boolean} */
const prefersReducedMotion = () => cfg.get().motion === 'reduce'
  || !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

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
  winstats: must('winstats'), art: must('art'), railart: must('railart'),
  picker: must('picker'), winclose: must('winclose'), appearance: must('appearance'),
  solved: must('solved'),
};

// The single home of every mutable value. `dims` is a placeholder newPuzzle() replaces
// before any event can fire.
/** @type {State} */
const state = {
  puzzle: null,
  size: shapeFor().size,
  minCell: shapeFor().minCell,
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
const progress = makeProgress();
// Installed status is a documented grant heuristic in both Chrome and WebKit, and a
// home-screen web app is exempt from WebKit's 7-day cap on script-writable storage.
// Optional chaining and a swallowed rejection: support is inconsistent and a storage
// request must never reach the game.
void navigator.storage?.persist?.().catch(() => {});
/** @type {number} */
let currentSeed;
/** @type {string} */
let subjectId;
// Levels: the signed-in account's numbered puzzles. Its copy on this device loads now, before
// boot() restores a board that may be the level in progress; the cloud's answers later.
const play = makeLevelPlay({ cloud: makeCloud() });
const booted = play.boot();
// The level on screen, or null for an ordinary game. Still set on its solved board, until the
// next deal.
/** @type {Deal|null} */
let levelBoard = null;
// What the header's label line says when the board is not a level.
let categoryName = '';
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

/** Every puzzle is built from its own fresh rng seeded by `seed`, so a `?seed=`
 * reproduces its grid. `shape` is an argument, not PRESET: a restored save may have been
 * dealt at a different size.
 * @param {number} seed @param {import('./subjects.js').Subject} subject
 * @param {Preset} shape
 * @param {boolean} [useBag] false for a restored board and for a URL-pinned puzzle. Both
 *   must REPRODUCE a grid rather than consume coverage: a restored board was already
 *   dealt, so recording it again would advance the bag twice for one puzzle, and letting
 *   player state pick the words would mean one `?seed=` dealt different grids to
 *   different players. rng.js keeps its pinned branches away from the rng for exactly
 *   that second reason.
 * @param {Puzzle} [dealt] a saved board to put back instead of building one
 * @param {Deal|null} [level] the level this board is; start timing it once its finds are back
 * @returns {void} */
function newPuzzle(seed, subject, shape, useBag = true, dealt, level = null) {
  // Leaving a level saves where it stood, so New game's Levels side picks it up again.
  if (levelBoard) play.pause();
  levelBoard = level;
  categoryName = subject.categoryName;
  currentSeed = seed;
  subjectId = subject.id;
  state.size = shape.size;
  state.minCell = shape.minCell;
  const rng = makeRng(seed);
  justFound = null;
  state.found = {}; state.foundOrder = []; state.sel = null; state.miss = null; state.drag = null;
  state.puzzle = dealt ?? buildPuzzle({
    name: subject.name, pool: subject.words, rng,
    size: shape.size, count: shape.count,
    // Difficulty only for an ordinary deal: a pinned ?seed= must deal every player the same board.
    mix: useBag ? mixFor(shape, cfg.get().difficulty) : shape.mix,
    undrawn: useBag ? progress.bagFor(subject.id, subject.words) : undefined,
  });
  // At deal time, not at the win: the bag records what you were SHOWN. Solving is a
  // separate fact, counted by addSolve, so an abandoned puzzle still advances coverage —
  // you saw those words either way.
  if (useBag) progress.noteDraw(subject.id, subject.words, state.puzzle.words);
  els.subject.textContent = cap(state.puzzle.name);
  els.subject.dataset.accent = String(accentSlot(state.puzzle.name));
  showCategory();
  renderArt(els, subject.id, cfg.get().art);
  showBackdrop();
  // Or a stale timer drops the win overlay over the fresh grid, swallowing every tap.
  if (state.winTimer) { clearTimeout(state.winTimer); state.winTimer = null; }
  hideWin();
  layout();
  list();
  sweep();
  persist();
}

/** The board as dealt, with the seed, the subject, the board's shape and each found
 * word's selection. The cells, not just the seed: a deal the coverage bag steered does
 * not regenerate from its seed, because the deal itself moved the bag on.
 * @returns {void} */
function persist() {
  if (!state.puzzle) return;   // nothing to save before the first deal
  store.save({
    seed: currentSeed,
    subjectId,
    size: state.size,
    // buildPuzzle never returns a short board, so the word list IS the count.
    count: state.puzzle.words.length,
    cells: state.puzzle.cells.join(''),
    placements: state.puzzle.placements,
    found: state.foundOrder.map(w => ({ word: w, ...state.found[w].sel, ...(state.found[w].revealed ? { revealed: true } : {}) })),
  });
}

/** The header's label line: the level's number on a level, else the subject's category.
 * @returns {void} */
function showCategory() {
  els.category.textContent = levelBoard ? `Level ${levelBoard.level}` : categoryName;
}

/** Time the level on screen. Finds the account already has for it go back on the board, and
 * finds the board has that the account lacks are recorded. A level the account has moved past
 * leaves an ordinary board. @param {Deal} deal @returns {void} */
function startLevel(deal) {
  const puzzle = state.puzzle;
  if (!puzzle) return;
  // A page loaded or dealt in the background starts the clock when it is shown, not before.
  const events = play.start(deal, puzzle.words, document.hidden);
  if (!play.playing()) { levelBoard = null; showCategory(); return; }
  const added = addFinds(events);
  for (const w of state.foundOrder) play.note(w, !!state.found[w].revealed);
  if (added) { renderFoundCells(els, state, state.size); pills(); list(); persist(); }
  // Complete without a win, as when the last find reached this device but not the account:
  // bank it quietly, the way a restored board never pops the win card.
  if (state.foundOrder.length === puzzle.words.length) play.finish();
}

/** Put a level's recorded finds on the board, reveals as reveals, skipping words already
 * there. @param {import('./levels.js').LevelEvent[]} events @returns {boolean} whether any were added */
function addFinds(events) {
  const puzzle = state.puzzle;
  if (!puzzle) return false;
  const revealed = new Set(events.filter(e => e.revealed).map(e => e.word));
  let added = false;
  for (const { word, sel } of replaySelections(puzzle, events)) {
    if (state.found[word]) continue;
    state.found[word] = revealed.has(word) ? { sel, revealed: true } : { sel };
    state.foundOrder.push(word);
    added = true;
  }
  return added;
}

/** @returns {void} */
function layout() {
  if (!state.puzzle) return;
  const wasLandscape = state.dims.landscape;
  const cs = getComputedStyle(els.app);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  state.dims = computeLayout({
    vw: window.innerWidth - padX,
    vh: window.innerHeight - padY,
    size: state.size, pad: PAD, count: state.puzzle.words.length, minCell: state.minCell,
  });
  applyLayout(els, state.dims);
  placeArt(els, state.dims);
  if (state.dims.landscape !== wasLandscape) showBackdrop();   // the scene moves between corner and rail
  // Unchanged means the rebuild would be byte-identical — true on nearly every resize
  // frame. Keyed on the puzzle object, not just its shape, or a new board at the same
  // size would keep the old letters. Size needs no check of its own: only newPuzzle
  // changes it, and it replaces state.puzzle in the same breath.
  const r = state.rendered;
  if (r.puzzle === state.puzzle && r.cell === state.dims.cell) return;
  state.rendered = { puzzle: state.puzzle, cell: state.dims.cell };
  renderGrid(els, state.puzzle, state.dims, state.size, PAD, cfg.get().letters === 'large' ? 0.58 : 0.46);
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
  revealBtn.disabled = state.foundOrder.length === state.puzzle.words.length;
  placeArt(els, state.dims);   // the list's height decides whether the rail has room
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

/** Record a found word and play everything that follows: cells, burst, glow, strike, save,
 * and the win card if it was the last. Shared by a drag and by Reveal.
 * @param {string} hit @param {Selection} s @param {boolean} [revealed] @returns {void} */
function claim(hit, s, revealed = false) {
  // A local, so the narrowing survives into the win timer's closure, the same reason
  // effects.js aliases `ac`.
  const puzzle = /** @type {Puzzle} */ (state.puzzle);
  state.found[hit] = revealed ? { sel: s, revealed } : { sel: s };
  state.foundOrder.push(hit);
  if (levelBoard && !play.account()) letLevelGo();
  const level = levelBoard;
  if (level) play.note(hit, revealed);
  renderFoundCells(els, state, state.size);
  const won = state.foundOrder.length === puzzle.words.length;
  if (won) progress.addSolve();
  // Banked at the find, not when the card shows: a reload in between must not lose the level.
  const finished = won && level ? play.finish() : null;
  burst(els.fx, s, won ? 90 : 34, state.dims, PAD);
  if (cfg.get().sound) pop(won);
  if (cfg.get().vibrate) navigator.vibrate?.(won ? [30, 50, 90] : 18);
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
    const paneOpen = els.picker.style.display === 'flex' || settings.style.display === 'flex';
    if (finished && level) { showLevelCard(finished, level.level, paneOpen); return; }
    els.winmsg.textContent = 'You found every ' + cap(puzzle.name) + ' word.';
    // Written here rather than in the markup so the live region is empty until there is
    // something to announce. The count is the only number shown anywhere — no
    // fractions, which are what turn a record into a target.
    const n = progress.get().puzzles;
    const counting = !paneOpen && startAutoNext();
    els.winstats.textContent = `${n} ${n === 1 ? 'puzzle' : 'puzzles'} solved`;
    // One announcement, including the countdown, rather than a live digit every second.
    // Visually hidden: the countdown row already shows it.
    if (counting) {
      const sr = document.createElement('span');
      sr.className = 'sr';
      sr.textContent = `. Next puzzle in ${AUTO_NEXT_MS / 1000} seconds.`;
      els.winstats.appendChild(sr);
    }
    renderSolvedShape(els, state, state.size);
    els.win.style.display = 'flex';
    if (!paneOpen) winbtn.focus({ preventScroll: true });
  }, 700);
}

/** Reveal a word: find one of the words still hidden, at random, as if the player had.
 * @returns {void} */
function revealWord() {
  const puzzle = state.puzzle;
  if (!puzzle || state.drag) return;
  const left = puzzle.placements.filter(p => !state.found[p.word]);
  if (!left.length) return;
  const p = left[Math.floor(Math.random() * left.length)];
  const n = p.word.length - 1;
  hideToast();   // like any move on the board, this accepts a one-click deal
  claim(p.word, { x0: p.x0, y0: p.y0, x1: p.x0 + p.dx * n, y1: p.y0 + p.dy * n }, true);
  pills();
}

/** @returns {void} */
function endDrag() {
  if (!state.drag) return;
  state.drag = null;
  if (!state.sel || !state.puzzle) { state.sel = null; pills(); return; }
  const s = state.sel;
  const hit = matchWord(state.puzzle.placements, state.found, state.size, s);
  state.sel = null;
  if (hit) {
    claim(hit, s);
  } else if (!(s.x0 === s.x1 && s.y0 === s.y1)) {
    // A plain tap's 1-cell selection can never match, so it is not a miss.
    flashMiss(s);
  }
  pills();
}
els.gridbox.addEventListener('pointerup', endDrag);
const revealBtn = /** @type {HTMLButtonElement} */ (must('reveal'));
revealBtn.addEventListener('click', revealWord);
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

// A category's size is only knowable once its module is imported, and importing all 25 to
// label a dropdown would defeat the lazy load sw.js routes a whole separate cache to
// protect. Learning it on load is enough, and it persists: a category can only be
// completed by playing it, and playing it loads it.
/** @param {import('./subjects.js').CategoryData} cat @returns {void} */
function noteCategory(cat) {
  progress.noteSize(cat.id, cat.subjectIds.length);
}

/** A fresh subject is a player-facing surprise, so it stays on Math.random() rather than
 * the seeded sequence: `?seed=` pins the puzzle you land on, not every one after. It also
 * gets a fresh seed, or newPuzzle would reproduce the same choices verbatim.
 * @param {string|null} [categoryId] restrict the pick to one category
 * @param {() => boolean} [stillWanted] checked after the loads, before dealing: a win-card
 *   deal the player has since moved on from must not replace their board, or record a draw
 * @returns {Promise<boolean>} whether it dealt */
async function newGame(categoryId, stillWanted = () => true) {
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
  noteCategory(cat);
  // Least-seen first, still avoiding the subject already on screen. This generalises the
  // filter that used to live here: chooseSubject drops `current` last and only when
  // something else remains, so it can never empty the pool and dead-end.
  const seen = new Map(cat.subjectIds.map(s => [s, progress.coverage(s)]));
  const pick = chooseSubject(cat.subjectIds, seen, subjectId ?? null,
    progress.get().favourLeastSeen, Math.random);
  const subject = await loadSubject(pick);
  if (!stillWanted()) return false;
  newPuzzle(Date.now() >>> 0, subject, shapeFor());
  return true;
}
/** A category for a level, recorded like newGame's: a level is dealt from the same catalog.
 * @param {string} id @returns {Promise<import('./subjects.js').CategoryData>} */
async function levelCategory(id) {
  try {
    const cat = await loadCategory(id);
    unavailableCategories.delete(id);
    noteCategory(cat);
    return cat;
  } catch (err) {
    unavailableCategories.add(id);
    throw err;
  }
}
/** Deal the account's level: the one in progress, else the next. No coverage bag, so every
 * device deals one level the same board at one size. Rejects as newGame does.
 * @param {() => boolean} [stillWanted] @returns {Promise<boolean>} whether it dealt */
async function dealLevel(stillWanted = () => true) {
  const deal = await play.deal(CATEGORIES.map(c => c.id), levelCategory, cfg.get().difficulty);
  if (!deal) throw new Error('no level to deal: signed out, or the account changed');
  const subject = await loadSubject(deal.subject);
  if (!stillWanted()) return false;
  const shape = shapeFor();
  newPuzzle(deal.seed, subject, shape, false, levelPuzzle(deal, subject, shape), deal);
  startLevel(deal);
  return true;
}
// newGame rejects when a category cannot be fetched; the picker catches that to keep
// itself open, so the rejection must survive rather than being swallowed here.
const picker = makePicker({
  root: els.picker,
  heading: must('picker-title'),
  select: /** @type {HTMLSelectElement} */ (must('picker-select')),
  warning: must('picker-warning'),
  error: must('picker-error'),
  start: must('picker-start'),
  cancel: must('picker-cancel'),
  categories: CATEGORIES,
  isUnavailable: (id) => unavailableCategories.has(id),
  isComplete: (id) => progress.isComplete(id),
  onStart: async (categoryId) => { await newGame(categoryId); },
  opener: must('catbtn'),
  levels: {
    enabled: () => play.enabled,
    getMode: () => cfg.get().play,
    setMode: (m) => cfg.set('play', m),
    render: (host) => renderLevelChoice(host, play, {
      difficulty: cfg.get().difficulty,
      onSignIn: () => openSignIn(true),
      onRetry: () => { void play.sync().then(afterSync); },
    }),
    onLevel: async () => { await dealLevel(); },
  },
});
// Unconditional, unlike the confirm it replaces: the dialog is now how a game is started,
// and the warning is one line inside it rather than a reason to show it.
// Where Settings is a full-screen page rather than a card. Must match styles.css.
const SETTINGS_PAGE = '(max-width:599px), (max-height:420px)';
/** On a wide screen a pane drops from under the header's buttons, which in landscape sit
 * at the end of the rail rather than the window's edge. Phones keep the CSS full-width
 * sheet, and a short landscape screen keeps its CSS top offset.
 * @param {HTMLElement} pane @returns {void} */
function anchorPane(pane) {
  pane.style.paddingRight = pane.style.paddingTop = '';
  // Queried fresh: WebKit reports a stored MediaQueryList's previous state inside resize.
  if (innerWidth < 600 || (pane.id === 'settings' && matchMedia(SETTINGS_PAGE).matches)) return;
  const r = must('actions').getBoundingClientRect();
  pane.style.paddingRight = Math.max(8, innerWidth - r.right) + 'px';
  if (innerHeight > 420) pane.style.paddingTop = (r.bottom + 8) + 'px';
}
/** @returns {void} */
function openPicker() {
  hideToast();   // an Undo must never restore over a board dealt from the pane
  quickGen++;    // nor a one-click deal still loading land over it
  cancelAutoNext();
  dealGen++;
  closeSettings();
  anchorPane(els.picker);
  // A level keeps its finds when left, so only an ordinary board in progress is lost.
  const inProgress = !levelBoard && !!state.puzzle && state.foundOrder.length > 0
    && state.foundOrder.length < state.puzzle.words.length;
  picker.open(inProgress);
}
must('catbtn').addEventListener('click', openPicker);
// ---- The win card's countdown ----
const winnext = must('winnext'), wincount = must('wincount'), winbtn = must('winbtn');
const wincard = must('wincard'), wintitle = must('wintitle');
/** @type {ReturnType<typeof setInterval>|null} */
let autoTimer = null;
// The score card while the win card is a level's. It runs its own countdown.
/** @type {import('./scorecard.js').Playback|null} */
let levelCard = null;
// True while the win card's deal is in flight, so a tap on Play as the countdown fires
// (or a double tap) deals once, not twice.
let dealing = false;
// Bumped whenever the player moves on from the win card (closes it, opens a pane, or a
// board is dealt). A win-card deal still loading checks it and quietly drops its result.
let dealGen = 0;
const prefs = defaultStore();

/** @returns {void} */
function cancelAutoNext() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  levelCard?.hold();
  winnext.hidden = true;
  winnext.classList.remove('run');
  // The announcement was of a deal that is no longer coming.
  els.winstats.querySelector('.sr')?.remove();
}
/** Deal from the win card: the Play button and the countdown share this exactly, and a level's
 * Next level and countdown likewise. @param {boolean} [level] the account's next level
 * @returns {void} */
function advance(level = false) {
  if (dealing) return;
  cancelAutoNext();
  dealing = true;
  const gen = ++dealGen;
  /** @returns {boolean} */
  const wanted = () => gen === dealGen;
  const card = levelCard;
  // Dropped because a pane opened over the card while it loaded: its Next works again.
  const rearm = () => { if (card && card === levelCard && els.win.style.display === 'flex') card.rearm(); };
  // Signed out since the level was won, as when the session lapsed: an ordinary game instead.
  const asLevel = level && !!play.account();
  (asLevel ? dealLevel(wanted) : newGame(null, wanted)).then((dealt) => {
    if (dealt && level && !asLevel) showToast("You're signed out, so this is a random game.", false);
    if (!dealt) rearm();
  }).catch((err) => {
    // The player has moved on, so this failure is not news; a card still up can try again.
    if (gen !== dealGen) { rearm(); return; }
    // newGame rejects before newPuzzle runs, so the solved board and win card are still
    // up with nothing saying the tap did nothing. Hide the overlay so the header's
    // failure text is what the player actually sees.
    hideWin();
    reportLoadFailure(err);
  }).finally(() => { dealing = false; });
}
/** Start counting down, unless the player turned it off or is looking elsewhere.
 * Timed from a deadline rather than by counting ticks, so a throttled timer cannot drift.
 * @returns {boolean} whether it started */
function startAutoNext() {
  cancelAutoNext();
  if (!cfg.get().autoNext || document.hidden || els.picker.style.display === 'flex' || settings.style.display === 'flex') return false;
  const deadline = performance.now() + AUTO_NEXT_MS;
  wincount.textContent = String(AUTO_NEXT_MS / 1000);
  winnext.hidden = false;
  void winnext.offsetWidth;   // restart the drain animation from full
  winnext.classList.add('run');
  autoTimer = setInterval(() => {
    const left = Math.ceil((deadline - performance.now()) / 1000);
    if (left <= 0) { advance(); return; }
    if (wincount.textContent !== String(left)) wincount.textContent = String(left);
  }, 200);
  return true;
}
/** @returns {void} */
function hideWin() {
  cancelAutoNext();
  dealGen++;
  // Unblock Play: a superseded deal may still be loading, and must not hold the button.
  dealing = false;
  // Hiding the focused Play button would drop focus to <body>; give it to New game.
  if (els.win.contains(document.activeElement)) must('newbtn').focus({ preventScroll: true });
  els.win.style.display = 'none';
  clearLevelWin(wincard, wintitle);
  levelCard = null;
}
/** The win card as a level's score card. The setting and an open pane decide its countdown, as
 * they do the plain card's. @param {Finish} f @param {number} level @param {boolean} paneOpen
 * @returns {void} */
function showLevelCard(f, level, paneOpen) {
  els.win.style.display = 'flex';
  levelCard = showLevelWin(wincard, wintitle, level, f, {
    reduceMotion: prefersReducedMotion(),
    countdownMs: cfg.get().autoNext && !paneOpen && !document.hidden ? undefined : 0,
    focus: !paneOpen,
    onNext: () => advance(true),
    onStay: () => {},
  });
}
winbtn.addEventListener('click', () => advance());

// ---- One-click New game, with Undo ----
const toast = must('toast'), toastMsg = must('toast-msg'), toastLive = must('toast-live');
const toastUndo = must('toast-undo'), newbtn = must('newbtn');
const UNDO_MS = 6000;
/** A board exactly as it stood, held in memory.
 * @typedef {{puzzle:Puzzle, found:State['found'], foundOrder:string[], seed:number,
 *   subjectId:string, size:number, minCell:number, category:string, level:Deal|null}} Snapshot */
/** @type {Snapshot|null} */
let undoSnap = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let toastTimer = null;
// Its own generation and guard, apart from the win card's: closing a pane or pressing
// Escape must not cancel a deal the player asked for with this button.
let quickGen = 0;
let quickDealing = false;

/** @returns {Snapshot|null} */
function snapshot() {
  const p = state.puzzle;
  if (!p) return null;
  return { puzzle: p, found: { ...state.found }, foundOrder: [...state.foundOrder], seed: currentSeed,
    subjectId, size: state.size, minCell: state.minCell, category: categoryName, level: levelBoard };
}
/** Put a snapshot back as the live board, without regenerating it.
 * @param {Snapshot} snap @returns {void} */
function reinstate(snap) {
  if (levelBoard) play.pause();
  levelBoard = snap.level; categoryName = snap.category;
  currentSeed = snap.seed; subjectId = snap.subjectId;
  state.size = snap.size; state.minCell = snap.minCell;
  state.puzzle = snap.puzzle; state.found = snap.found; state.foundOrder = snap.foundOrder;
  state.sel = null; state.miss = null; state.drag = null; justFound = null;
  els.subject.textContent = cap(snap.puzzle.name);
  els.subject.dataset.accent = String(accentSlot(snap.puzzle.name));
  showCategory();
  renderArt(els, snap.subjectId, cfg.get().art);
  showBackdrop();
  hideWin();
  layout();   // a different puzzle object, so this rebuilds the cells
  renderFoundCells(els, state, state.size);
  pills();
  list();
  persist();
  if (levelBoard) startLevel(levelBoard);
}
/** @returns {void} */
function armToastTimer() {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, UNDO_MS);
}
/** @param {string} msg @param {boolean} undoable @returns {void} */
function showToast(msg, undoable) {
  toastMsg.textContent = msg;
  toastUndo.hidden = !undoable;
  toast.hidden = false;
  // The live region is outside the toast and always rendered, so it exists before the
  // message does (ARIA22), the same reason #winstats ships empty.
  toastLive.textContent = undoable ? `${msg} Undo available.` : msg;
  armToastTimer();
}
/** @returns {void} */
function hideToast() {
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  undoSnap = null;
  // Never hide the element that has focus; hand it to the control that raised the toast.
  if (toast.contains(document.activeElement)) newbtn.focus();
  toast.hidden = true;
  toastMsg.textContent = '';
  toastLive.textContent = '';
}
/** Deal a random game now. A board in progress is not asked about first; it is kept for
 * Undo instead, so the common case stays one click and a misclick costs one more.
 * @returns {void} */
function quickDeal() {
  if (quickDealing) return;
  // A second press on a board still untouched keeps the first offer, rather than losing
  // the board that one was protecting.
  const carried = undoSnap;
  hideToast();
  cancelAutoNext();
  closeSettings();
  picker.close();
  quickDealing = true;
  const gen = ++quickGen;
  /** @type {Snapshot|null} */
  let snap = null;
  newGame(null, () => {
    if (gen !== quickGen) return false;
    // Taken as the deal lands, not at the click, so finds made during a slow load count.
    const p = state.puzzle, n = state.foundOrder.length;
    snap = !p || n === 0 ? carried : n < p.words.length ? snapshot() : null;
    return true;
  }).then((dealt) => {
    if (dealt && snap) { undoSnap = snap; showToast('New game dealt.', true); }
  }).catch((err) => {
    if (gen !== quickGen) return;
    // A board is still on screen and playable; say so in the toast, not by renaming it.
    if (state.puzzle) showToast("Couldn't load a new game. Check your connection.", false);
    else reportLoadFailure(err);
  }).finally(() => { quickDealing = false; });
}
newbtn.addEventListener('click', quickDeal);
toastUndo.addEventListener('click', () => {
  const snap = undoSnap;
  newbtn.focus();
  hideToast();
  if (snap) { quickGen++; reinstate(snap); }
});
// Hold the offer while someone is reaching for it.
toast.addEventListener('pointerenter', () => { if (toastTimer) clearTimeout(toastTimer); });
toast.addEventListener('focusin', () => { if (toastTimer) clearTimeout(toastTimer); });
toast.addEventListener('pointerleave', () => { if (!toast.hidden && !toast.contains(document.activeElement)) armToastTimer(); });
toast.addEventListener('focusout', (e) => { if (!toast.hidden && !toast.contains(/** @type {Node|null} */ (e.relatedTarget))) armToastTimer(); });
// The first move on the new board means the player has accepted it.
els.gridbox.addEventListener('pointerdown', () => { if (!toast.hidden) hideToast(); });
must('winstay').addEventListener('click', () => { cancelAutoNext(); winbtn.focus(); });
els.winclose.addEventListener('click', hideWin);
els.win.addEventListener('click', (e) => { if (e.target === els.win) hideWin(); });
// Cancel rather than pause: a player coming back to the tab should find the board they
// left, not one dealt behind their back. Play is still there. A level's clock stops while
// the page is hidden, and saving it then lets another device carry on.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAutoNext(); if (levelBoard) play.pause(); return; }
  if (levelBoard && play.account()) play.resume();
  catchUp();
});
/** Another device may have played on meanwhile: read the cloud before this one saves over it.
 * A session that lapsed while the page was away (a save was refused) says so on the board.
 * @returns {void} */
function catchUp() {
  if (play.account()) void play.sync().then(afterSync);
  else if (levelBoard) afterSync();
}

// appearance.js owns the preference and resolves it onto <html>; this callback is the
// page-shaped half. The status-bar colour is read back off the resolved palette rather
// than duplicated here, so a palette edit has exactly one home.
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const settings = must('settings');
const modeLight = must('mode-light'), modeDark = must('mode-dark');
const leastBox = /** @type {HTMLInputElement} */ (must('settings-least-box'));
// Vibration is a no-op where unsupported (iOS Safari, most desktops); do not offer it there.
if (!('vibrate' in navigator)) must('settings-vibrate').hidden = true;
// This screen's own board is the compact one, so the large board is not on offer.
if (PRESET === PRESETS.compact) {
  const large = /** @type {HTMLButtonElement} */ (settings.querySelector('[data-setting="board"] [data-value="full"]'));
  large.disabled = true;
  large.title = 'Needs a larger screen';
}
/** The browser chrome takes the ground colour. Skipped while no stylesheet applies (WebKit
 * holds it back at boot), when --bg reads empty; boot() calls it again once it is live.
 * @returns {void} */
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (themeColorMeta && bg) themeColorMeta.setAttribute('content', bg);
}
// One background runs at a time, behind the whole page or behind the word list.
const backdrop = makeBackdrop();
const bgFull = must('bg'), bgList = must('bgside');
/** Run the chosen background in its area for the current deal; a still choice stops it.
 * @returns {void} */
function showBackdrop() {
  const s = cfg.get();
  els.app.dataset.bgarea = s.area;
  if (!subjectId) return;   // nothing dealt yet; the deal calls again
  const root = getComputedStyle(document.documentElement);
  // With the list under the board, the still scene keeps the board corner as the category art does.
  const corner = s.art === 'scene' && s.area !== 'full' && !state.dims.landscape;
  void backdrop.show(s.art, corner ? els.art : s.area === 'full' ? bgFull : bgList, {
    colors: [1, 2, 3, 4, 5, 6].map(i => root.getPropertyValue(`--confetti-${i}`).trim()),
    dark: document.documentElement.dataset.appearance !== 'light', reducedMotion: prefersReducedMotion(),
    subject: subjectId, seed: currentSeed, corner,
  });
}
globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', showBackdrop);
// The Theme page: every theme and palette as one choice. Previews are read once per mode.
const lookTiles = must('theme-tiles'), lookNow = must('settings-theme-now');
lookTiles.innerHTML = lookTilesMarkup();
/** @type {Map<string, Map<string, string>>} */
const lookVars = new Map();
/** @returns {void} */
function fillPreviews() {
  const root = document.documentElement, mode = root.dataset.appearance ?? 'dark';
  const vars = lookVars.get(mode) ?? readLooks(root, getComputedStyle);
  lookVars.set(mode, vars);
  for (const tile of lookTiles.querySelectorAll('[data-look]')) {
    tile.querySelector('.lookprev')?.setAttribute('style', vars.get(/** @type {HTMLElement} */ (tile).dataset.look ?? '') ?? '');
  }
}
/** The Theme row's summary and the checked tile. @param {string} theme @param {string} palette @returns {void} */
function syncLook(theme, palette) {
  lookNow.innerHTML = lookSummaryMarkup(theme, palette, varsOf(getComputedStyle(document.documentElement)));
  const on = /** @type {HTMLInputElement|null} */ (lookTiles.querySelector(`input[value="${lookId(theme, palette)}"]`));
  if (on) on.checked = true;
}
const appearance = makeAppearance({
  onApply(mode, theme, palette) {
    els.appearance.dataset.pref = mode;
    modeLight.setAttribute('aria-pressed', String(mode === 'light'));
    modeDark.setAttribute('aria-pressed', String(mode === 'dark'));
    syncLook(theme, palette);
    syncThemeColor();
    showBackdrop();
  },
});
appearance.start();
const bgTiles = must('bg-tiles'), bgNow = must('settings-bg-now');
bgTiles.innerHTML = tilesMarkup();
const bgPage = makeSubpage({
  card: must('settingscard'), page: must('settings-bgpage'), row: must('settings-bg'), back: must('bg-back'), name: 'background',
});
const lookPage = makeSubpage({
  card: must('settingscard'), page: must('settings-themepage'), row: must('settings-theme'), back: must('theme-back'), name: 'theme',
  onOpen: fillPreviews,
});
// ---- The account ----
const accountHost = must('settings-account'), signInHost = must('signin-form');
// Sign in from New game's Levels side goes back to New game once signed in.
let signInFromPicker = false;
// The Account section's button is redrawn with it, so the page looks it up each time.
const signInPage = makeSubpage({
  card: must('settingscard'), page: must('settings-signinpage'), row: () => accountHost.querySelector('.acct-seg button'),
  back: must('signin-back'), name: 'signin',
  onOpen: () => { renderSignIn(signInHost, play, { onDone: signedIn }); },
  focus: () => signInHost.querySelector('input'),
});
/** The Account section, redrawn whenever the account or its saving changes. Focus on its
 * button stays on the button that replaces it. @returns {void} */
function renderAccountSection() {
  accountHost.hidden = !play.enabled;
  if (!play.enabled) return;
  const had = accountHost.contains(document.activeElement);
  renderAccount(accountHost, play, { onSignIn: () => signInPage.open(), onSignOut: signedOut });
  if (had) /** @type {HTMLElement|null} */ (accountHost.querySelector('button'))?.focus({ preventScroll: true });
}
/** Settings, at its sign-in page. @param {boolean} fromPicker @returns {void} */
function openSignIn(fromPicker) {
  picker.close();
  openSettings();
  signInFromPicker = fromPicker;
  signInPage.open();
}
/** @returns {void} */
function signedIn() {
  renderAccountSection();
  reconcileLevel();
  if (signInFromPicker) { signInFromPicker = false; closeSettings(); openPicker(); return; }
  signInPage.close();
}
/** The board stays, as an ordinary one; a level's score card goes with the account.
 * @returns {void} */
function signedOut() {
  if (levelBoard) { levelBoard = null; showCategory(); }
  if (wincard.dataset.level) hideWin();
  renderAccountSection();
}
/** After the account's progress changed under the board: link the board to the level it is,
 * pick up finds another device made on it, or let it go once the account is past it.
 * Not while the win card shows: that board is done. @returns {void} */
function reconcileLevel() {
  const puzzle = state.puzzle;
  if (!puzzle || els.win.style.display === 'flex') return;
  if (levelBoard && !play.account()) { letLevelGo(); return; }
  if (!levelBoard) {
    const deal = subjectId ? play.resumable(subjectId, currentSeed) : null;
    if (deal) { levelBoard = deal; showCategory(); startLevel(deal); }
    return;
  }
  if (!play.playing()) {
    const solved = state.foundOrder.length === puzzle.words.length;
    levelBoard = null;
    showCategory();
    if (!solved) showToast('This level was finished on another device.', false);
    return;
  }
  // Finds another device made on this level, which the sync folded into it.
  if (!addFinds(play.events())) return;
  renderFoundCells(els, state, state.size);
  pills();
  list();
  persist();
  if (state.foundOrder.length < puzzle.words.length) return;
  // The two devices' finds together complete it, and this one is being looked at: its score card.
  const level = levelBoard;
  const finished = play.finish();
  progress.addSolve();
  if (finished) showLevelCard(finished, level.level, els.picker.style.display === 'flex' || settings.style.display === 'flex');
}
/** The session ended here without Sign out (it lapsed, or a save was refused): an ordinary
 * board now, and the player is told why the header changed. @returns {void} */
function letLevelGo() {
  levelBoard = null;
  showCategory();
  showToast("You've been signed out, so this game no longer counts as a level.", false);
}
/** @returns {void} */
function afterSync() {
  renderAccountSection();
  picker.refresh();
  reconcileLevel();
}
/** @returns {void} */
function openSettings() {
  cancelAutoNext();
  dealGen++;
  picker.close();
  bgPage.close(false);
  lookPage.close(false);
  signInPage.close(false);
  signInFromPicker = false;
  syncSettings();
  renderAccountSection();
  // Progress this device has not got online yet is tried again when the player looks.
  const st = play.status();
  if (st.signedIn && (st.pending || st.error)) void play.sync().then(afterSync);
  anchorPane(settings);
  settings.style.display = 'flex';
  els.appearance.setAttribute('aria-expanded', 'true');
  // The title, not the first control: focusing a select from a tap opens it on an iPhone.
  must('settings-title').focus({ preventScroll: true });
}
/** @returns {void} */
function closeSettings() {
  if (settings.style.display !== 'flex') return;
  bgPage.close(false);
  lookPage.close(false);
  signInPage.close(false);
  // A sign-in still in flight lands in Settings, not by reopening New game.
  signInFromPicker = false;
  settings.style.display = 'none';
  els.appearance.setAttribute('aria-expanded', 'false');
  els.appearance.focus();
}
els.appearance.setAttribute('aria-expanded', 'false');
els.appearance.addEventListener('click', () => {
  if (settings.style.display === 'flex') closeSettings(); else openSettings();
});
modeLight.addEventListener('click', () => appearance.set('light'));
modeDark.addEventListener('click', () => appearance.set('dark'));
/** Show the stored settings in the pane's controls. Every control under [data-setting] is a
 * settings.js field: a checkbox (data-on/data-off map it to a two-value choice), a radio, a
 * select, or a .seg group of buttons. @returns {void} */
function syncSettings() {
  const now = /** @type {Record<string, unknown>} */ (cfg.get());
  for (const el of settings.querySelectorAll('[data-setting]')) {
    const v = now[/** @type {HTMLElement} */ (el).dataset.setting ?? ''];
    if (el instanceof HTMLInputElement) {
      el.checked = el.type === 'radio' ? el.value === v : el.dataset.on ? v === el.dataset.on : v === true;
    }
    else if (el instanceof HTMLSelectElement) el.value = String(v);
    else for (const btn of el.querySelectorAll('button[data-value]')) {
      btn.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (btn).dataset.value === v));
    }
  }
  leastBox.checked = progress.get().favourLeastSeen;
  bgNow.innerHTML = summaryMarkup(now.art);
  syncLook(appearance.getTheme(), appearance.getPalette());
}
/** Make a changed setting take effect now, where it has something to change now.
 * @param {string} key @returns {void} */
function applySetting(key) {
  const now = cfg.get();
  if (key === 'art') { if (subjectId) renderArt(els, subjectId, now.art); placeArt(els, state.dims); }
  if (key === 'art' || key === 'area' || key === 'motion') showBackdrop();
  if (key === 'letters') { state.rendered = { puzzle: null, cell: 0 }; layout(); }
  if (key === 'reveal') els.app.dataset.reveal = now.reveal ? 'on' : 'off';
  if (key === 'motion') document.documentElement.dataset.motion = now.motion;
  if (key === 'autoNext' && !now.autoNext) cancelAutoNext();
}
/** @param {string} key @param {unknown} value @returns {void} */
function changeSetting(key, value) {
  cfg.set(/** @type {any} */ (key), /** @type {any} */ (value));
  syncSettings();
  applySetting(key);
}
settings.addEventListener('click', (e) => {
  const btn = e.target instanceof Element ? e.target.closest('.seg[data-setting] button[data-value]') : null;
  if (!btn) return;
  const group = /** @type {HTMLElement} */ (btn.closest('[data-setting]'));
  changeSetting(group.dataset.setting ?? '', /** @type {HTMLElement} */ (btn).dataset.value);
});
settings.addEventListener('change', (e) => {
  const el = e.target;
  if (el === leastBox) { progress.setFavourLeastSeen(leastBox.checked); return; }
  if (el instanceof HTMLInputElement && el.name === 'look') { const [t, p] = el.value.split('/'); appearance.setLook(t, p); return; }
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || !el.dataset.setting) return;
  const value = el instanceof HTMLSelectElement || el.type === 'radio' ? el.value
    : el.dataset.on ? (el.checked ? el.dataset.on : el.dataset.off) : el.checked;
  changeSetting(el.dataset.setting, value);
});
// Settings that shape the page before any game is dealt.
applySetting('reveal');
applySetting('motion');
must('settings-close').addEventListener('click', closeSettings);
must('bg-close').addEventListener('click', closeSettings);
must('theme-close').addEventListener('click', closeSettings);
must('signin-close').addEventListener('click', closeSettings);
// Back to the Account section: signing in from there stays in Settings.
must('signin-back').addEventListener('click', () => { signInFromPicker = false; });
must('settings-back').addEventListener('click', closeSettings);
settings.addEventListener('click', (e) => { if (e.target === settings) closeSettings(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // A themed (base-select) dropdown's list is in the page, so its Escape arrives here;
    // it closes the list only, not the pane around it. The try: engines without :open throw.
    const sel = e.target instanceof Element ? e.target.closest('select') : null;
    try { if (sel && sel.matches(':open')) return; } catch { /* no :open, so no in-page list */ }
    // Only when it is showing: hideWin() also cancels a win-card deal in flight.
    if (els.win.style.display === 'flex') hideWin();
    picker.close(); closeSettings();
  }
});
// Styles or fonts that land after boot change the chrome around the board; re-measure once.
// The backdrop again too: WebKit can boot before the stylesheet, with no confetti colours yet.
window.addEventListener('load', () => { onResize(); syncThemeColor(); showBackdrop(); });
window.addEventListener('resize', () => {
  onResize();
  // An open pane's inline offsets were measured for the old shape.
  for (const p of [els.picker, settings]) if (p.style.display === 'flex') anchorPane(p);
});

/** Explicit `?seed=` / `?subject=` / `?category=` always wins, even over a saved game —
 * that is the point of pinning a puzzle by URL. Otherwise prefer the save, and only deal
 * fresh when there is nothing to restore.
 * @returns {Promise<void>} */
async function boot() {
  const params = new URLSearchParams(location.search);
  // WebKit can run this module before any stylesheet applies: styles.css is parsed but held
  // back while the cross-origin font sheet loads, so the first layout read #app's padding as
  // 0 and sized the board 20px too wide. Wait until it is live, or the page has loaded.
  const css = document.querySelector('link[rel="stylesheet"][href="styles.css"]');
  const live = () => [...document.styleSheets].some(s => s.ownerNode === css);
  if (css && !live()) await new Promise((done) => {
    window.addEventListener('load', done, { once: true });
    setTimeout(done, 2000);   // never hold the board for a font server
  });
  syncThemeColor();
  try {
    if (params.has('seed') || params.has('subject') || params.has('category')) {
      const seed = resolveSeed(location.search);
      // One rng for the whole resolution, so a given ?seed= always lands on the same
      // subject: resolveTarget draws from it only when the URL did not pin a category,
      // and the subject draw below continues the same stream.
      const rng = makeRng(seed);
      const target = resolveTarget(location.search, CATEGORIES, rng);
      const cat = await loadCategory(target.category);
      noteCategory(cat);
      const id = target.subject && cat.subjectIds.includes(target.subject)
        ? target.subject
        : cat.subjectIds[rng.int(cat.subjectIds.length)];
      // Only an explicit ?seed= bypasses the bag. That is the case that must reproduce a
      // grid identically for every player, so it cannot let coverage pick the words.
      // ?subject= or ?category= on their own are seeded by the clock and are therefore
      // ordinary play of that subject — bypassing them too would mean anyone who
      // bookmarks a subject link never accrues coverage at all.
      newPuzzle(seed, await loadSubject(id), shapeFor(), !params.has('seed'));
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

/** Put back the exact board a save holds, then replay the found words on top. A save
 * written before boards were stored is regenerated from its seed instead, which is exact
 * only for a deal the bag did not steer. The saved shape wins over this device's preset —
 * a board is not something a resize gets to discard. A word the restored puzzle doesn't
 * contain, or one already replayed, is skipped rather than crashing.
 * @param {import('./storage.js').SaveData} saved @returns {Promise<void>} */
async function restore(saved) {
  const shape = saved.size === PRESETS.compact.size ? PRESETS.compact : PRESETS.full;
  const subject = await loadSubject(saved.subjectId);
  const { cells, placements } = saved;
  const dealt = cells && placements
    ? { name: subject.name, cells: [...cells], words: placements.map(p => p.word), placements }
    : undefined;
  // The level in progress, when that is what this board is: the save does not say, the
  // account's progress does.
  const level = play.resumable(saved.subjectId, saved.seed);
  // useBag=false: this board was already dealt and its draw already recorded. Recording
  // it again would advance the bag twice for one puzzle, silently, on every reload.
  newPuzzle(saved.seed, subject, {
    size: saved.size, count: saved.count, mix: shape.mix, minCell: shape.minCell,
  }, false, dealt, level);
  for (const f of saved.found) {
    if (!state.puzzle || !state.puzzle.words.includes(f.word) || state.found[f.word]) continue;
    const sel = { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 };
    state.found[f.word] = f.revealed === true ? { sel, revealed: true } : { sel };
    state.foundOrder.push(f.word);
  }
  renderFoundCells(els, state, state.size);
  pills();
  list(); // redraw pills + cross out; deliberately does NOT pop the win overlay
  // newPuzzle above already saved an empty `found`, so without this the replayed
  // progress would only live in memory and a second reload would lose it.
  persist();
  if (level) startLevel(level);
}

renderAccountSection();
// The account's progress, once the cloud has answered; and again whenever the device is back online.
void booted.then(afterSync);
window.addEventListener('online', catchUp);
// boot() never rejects — it reports any failure into the DOM itself.
void boot();
// './sw.js' resolves against the DOCUMENT, not this module. Writing '../sw.js' because
// the script lives in src/ would resolve to the domain root and break the project-path
// deploy on GitHub Pages, where the app is served from /word-finder/.
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
