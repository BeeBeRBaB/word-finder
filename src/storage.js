// Persistence. Pure aside from the store it's handed: given an injected
// {getItem,setItem,removeItem} (or the real localStorage by default) it never
// throws into the game — a disabled/full/throwing store just degrades to "no
// persistence" so backgrounding the app can't crash it.

const KEY = 'wordfinder-save-v1';

/**
 * @typedef {{seed:number, themeIdx:number, found:{word:string,x0:number,y0:number,x1:number,y1:number}[]}} SaveData
 */

/** @param {Pick<Storage,'getItem'|'setItem'|'removeItem'>|null} [store] */
export function makeStorage(store) {
  if (store === undefined) {
    try { store = /** @type {any} */ (globalThis).localStorage; } catch { store = null; }
  }
  return {
    /** @param {SaveData} data @returns {void} */
    save(data) { if (!store) return; try { store.setItem(KEY, JSON.stringify(data)); } catch { /* no persistence */ } },
    /** @returns {SaveData|null} */
    load() { if (!store) return null; try { const s = store.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; } },
    /** @returns {void} */
    clear() { if (!store) return; try { store.removeItem(KEY); } catch { /* ignore */ } },
  };
}
