// Persistence. Pure aside from the store it's handed: given an injected
// {getItem,setItem,removeItem} (or the real localStorage by default) it never
// throws into the game — a disabled/full/throwing store just degrades to "no
// persistence" so backgrounding the app can't crash it.

const KEY = 'wordfinder-save-v1';

/**
 * @typedef {{word:string,x0:number,y0:number,x1:number,y1:number}} FoundWord
 * @typedef {{seed:number, subjectId:string, size:number, count:number, found:FoundWord[]}} SaveData
 */

/** The real `localStorage`, or `null` if it is unavailable. Merely *reading* the
 * property throws on Safari with "Block All Cookies" and in some private modes —
 * which once broke app boot — so the access itself has to be guarded, not just the
 * calls on it. Shared with `appearance.js` so that guard exists in exactly one place.
 * @returns {Storage|null} */
export function defaultStore() {
  try { return globalThis.localStorage; } catch { return null; }
}

/** @param {Pick<Storage,'getItem'|'setItem'|'removeItem'>|null} [store] */
export function makeStorage(store) {
  if (store === undefined) store = defaultStore();
  return {
    /** @param {SaveData} data @returns {void} */
    save(data) { if (!store) return; try { store.setItem(KEY, JSON.stringify(data)); } catch { /* no persistence */ } },
    /** A save is either complete or it is not a save. `size` and `count` were added
     * when word pools grew past twelve, and a board written before that cannot be
     * rebuilt at all — its twelve words came from a twelve-word list that no longer
     * exists. So the missing field is not migrated, it is the detection rule, and the
     * board is discarded rather than half-restored onto a grid it does not match.
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
        return d;
      } catch { return null; }
    },
    /** @returns {void} */
    clear() { if (!store) return; try { store.removeItem(KEY); } catch { /* ignore */ } },
  };
}
