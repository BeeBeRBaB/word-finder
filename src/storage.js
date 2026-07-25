// Persistence. Pure aside from the store it's handed: given an injected
// {getItem,setItem,removeItem} (or the real localStorage by default) it never
// throws into the game — a disabled/full/throwing store just degrades to "no
// persistence" so backgrounding the app can't crash it.

const KEY = 'wordfinder-save-v1';

/**
 * @typedef {{seed:number, topicIdx:number, found:{word:string,x0:number,y0:number,x1:number,y1:number}[]}} SaveData
 * @typedef {SaveData & {themeIdx?:number}} StoredSave
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
    /** Saves written before the theme -> topic rename carry `themeIdx`; read both so a
     * game in progress at deploy time survives. `save()` only ever writes `topicIdx`.
     * The `?? 0` is not decoration: a save with neither key would otherwise hand
     * `undefined` to `buildPuzzle`, which throws rather than degrading.
     * @returns {SaveData|null} */
    load() {
      if (!store) return null;
      try {
        const s = store.getItem(KEY);
        if (!s) return null;
        const { themeIdx, ...rest } = /** @type {StoredSave} */ (JSON.parse(s));
        return { ...rest, topicIdx: rest.topicIdx ?? themeIdx ?? 0 };
      } catch { return null; }
    },
    /** @returns {void} */
    clear() { if (!store) return; try { store.removeItem(KEY); } catch { /* ignore */ } },
  };
}
