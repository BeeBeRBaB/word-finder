// Persistence. Pure aside from the store it's handed: given an injected
// {getItem,setItem,removeItem} (or the real localStorage by default) it never
// throws into the game — a disabled/full/throwing store just degrades to "no
// persistence" so backgrounding the app can't crash it.

const KEY = 'wordfinder-save-v1';

/**
 * @typedef {import('./puzzle.js').Placement} Placement
 * @typedef {{word:string,x0:number,y0:number,x1:number,y1:number,revealed?:boolean}} FoundWord
 * @typedef {{seed:number, subjectId:string, size:number, count:number, found:FoundWord[],
 *            cells?:string, placements?:Placement[]}} SaveData
 *   `cells` and `placements` are the board as dealt. Optional: a save written before they
 *   existed still loads, and restore regenerates it from the seed.
 */

/** Whether a save's board can be put back as-is: a letter for every square, and every
 * placement spelling its word inside the grid. A list naming a word the grid does not
 * spell would be an unwinnable board.
 * @param {SaveData} d @returns {boolean} */
function boardHolds({ size, count, cells, placements }) {
  if (typeof cells !== 'string' || cells.length !== size * size || !/^[A-Z]+$/.test(cells)) return false;
  if (!Array.isArray(placements) || placements.length !== count) return false;
  return placements.every((p) => {
    if (typeof p?.word !== 'string' || !p.word) return false;
    const { x0, y0, dx, dy } = p;
    if (![x0, y0, dx, dy].every(Number.isInteger) || Math.abs(dx) > 1 || Math.abs(dy) > 1 || !(dx || dy)) return false;
    for (let j = 0; j < p.word.length; j++) {
      const x = x0 + dx * j, y = y0 + dy * j;
      if (x < 0 || y < 0 || x >= size || y >= size || cells[y * size + x] !== p.word[j]) return false;
    }
    return true;
  });
}

/** The real `localStorage`, or `null` if it is unavailable. Merely *reading* the
 * property throws on Safari with "Block All Cookies" and in some private modes —
 * which once broke app boot — so the access itself has to be guarded, not just the
 * calls on it. Shared with `appearance.js` so that guard exists in exactly one place.
 * @returns {Storage|null} */
export function defaultStore() {
  try { return globalThis.localStorage; } catch { return null; }
}

/** @param {Pick<Storage,'getItem'|'setItem'>|null} [store] */
export function makeStorage(store) {
  if (store === undefined) store = defaultStore();
  return {
    /** @param {SaveData} data @returns {void} */
    save(data) { if (!store) return; try { store.setItem(KEY, JSON.stringify(data)); } catch { /* no persistence */ } },
    /** A save is either complete or it is not a save. A board written before `size` and
     * `count` existed cannot be rebuilt at all, so the missing field is not migrated —
     * it is the detection rule.
     * @returns {SaveData|null} */
    load() {
      if (!store) return null;
      try {
        const s = store.getItem(KEY);
        if (!s) return null;
        const d = /** @type {SaveData} */ (JSON.parse(s));
        if (typeof d?.seed !== 'number') return null;
        if (typeof d.subjectId !== 'string') return null;
        if (typeof d.size !== 'number' || typeof d.count !== 'number') return null;
        if (!Array.isArray(d.found)) return null;
        d.found = d.found.filter((f) => typeof f?.word === 'string');
        // Unlike the fields above, a bad board costs only itself: restore falls back to
        // the seed, as it did before boards were saved.
        if (!boardHolds(d)) { delete d.cells; delete d.placements; }
        return d;
      } catch { return null; }
    },
  };
}
