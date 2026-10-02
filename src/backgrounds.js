// Background choices: the still category art (art.js) and the animated modules in
// src/backgrounds/, which load only when picked. Pure: the import is injected, and the
// host a background draws into is passed in.

/** @typedef {{colors:string[], dark:boolean, reducedMotion:boolean}} BackgroundOptions */
/** @typedef {{start:(host:HTMLElement, opts:BackgroundOptions)=>()=>void}} BackgroundModule */
/**
 * @typedef {{id:string, name:string, animated:boolean, file?:string, glyph:string}} Background
 * `file` is the module under src/backgrounds/; `glyph` is the picker tile's picture, the inner
 * markup of a 48x32 SVG whose g1..g4 classes take the palette's confetti colours.
 */

/** @type {readonly Background[]} */
export const BACKGROUNDS = Object.freeze([
  { id: 'illustrated', name: 'Illustrated', animated: false,
    glyph: '<circle class="g2" cx="35" cy="9" r="5"/><path class="g1" d="M3 29l12-15 8 9 6-6 16 12z"/>' },
  { id: 'pixel', name: 'Pixel art', animated: false,
    glyph: '<path class="g3" d="M14 8h4v4h-4zM30 8h4v4h-4zM10 12h28v4H10zM6 16h36v4H6zM6 20h4v4H6zM38 20h4v4h-4zM14 20h20v4H14zM18 24h4v4h-4zM26 24h4v4h-4z"/>' },
  { id: 'starfield', file: 'pixel-starfield', name: 'Starfield', animated: true,
    glyph: '<path class="g2" d="M6 6h2v2H6zM20 4h2v2h-2zM38 8h2v2h-2zM12 18h2v2h-2zM30 16h3v3h-3zM42 22h2v2h-2zM8 27h2v2H8zM24 26h2v2h-2z"/><path class="g4" d="M16 11h1v1h-1zM35 26h1v1h-1zM44 3h1v1h-1z"/>' },
  { id: 'skyline', file: 'pixel-skyline', name: 'Skyline', animated: true,
    glyph: '<path class="g4" d="M2 32V18h8v14zM12 32V10h9v22zM23 32V16h7v16zM32 32V6h8v26zM42 32V20h5v12z"/><path class="g2" d="M14 13h2v2h-2zM18 18h2v2h-2zM34 9h2v2h-2zM34 15h2v2h-2zM25 20h2v2h-2zM5 22h2v2H5z"/>' },
  { id: 'aquarium', file: 'pixel-aquarium', name: 'Aquarium', animated: true,
    glyph: '<path class="g3" d="M10 12h12v2h4v-2h2v8h-2v-2h-4v2H10v-2H8v-4h2z"/><path class="g2" d="M28 21h9v2h3v-2h2v6h-2v-2h-3v2h-9v-2h-2v-2h2z"/><path class="g1" d="M36 5h2v2h-2zM39 9h2v2h-2zM33 10h2v2h-2z"/><path class="g4" d="M2 30h44v2H2z"/>' },
  { id: 'confetti', file: 'pixel-confetti', name: 'Confetti', animated: true,
    glyph: '<path class="g1" d="M6 4h3v3H6zM30 22h3v3h-3z"/><path class="g2" d="M18 9h3v3h-3zM40 6h3v3h-3z"/><path class="g3" d="M11 20h3v3h-3zM34 13h3v3h-3z"/><path class="g4" d="M24 26h3v3h-3zM4 12h3v3H4zM44 24h3v3h-3z"/>' },
  { id: 'shimmer', file: 'shimmer-grid', name: 'Shimmer grid', animated: true,
    glyph: '<g class="g3"><path d="M4 4h6v6H4zM16 4h6v6h-6zM28 4h6v6h-6zM40 4h6v6h-6zM4 16h6v6H4zM28 16h6v6h-6zM16 28h6v4h-6zM40 28h6v4h-6z" opacity=".35"/><path d="M16 16h6v6h-6zM40 16h6v6h-6zM4 28h6v4H4zM28 28h6v4h-6z"/></g>' },
  { id: 'aurora', file: 'aurora-drift', name: 'Aurora', animated: true,
    glyph: '<ellipse class="g3" cx="16" cy="13" rx="15" ry="8" opacity=".7"/><ellipse class="g4" cx="31" cy="19" rx="16" ry="9" opacity=".6"/><ellipse class="g1" cx="22" cy="24" rx="12" ry="6" opacity=".5"/>' },
  { id: 'bokeh', file: 'silk-bokeh', name: 'Silk bokeh', animated: true,
    glyph: '<path class="g4" d="M0 22c10-10 18 6 28-2s14-10 20-6v6c-6-4-10 0-20 6S10 22 0 30z" opacity=".7"/><circle class="g2" cx="11" cy="9" r="5" opacity=".7"/><circle class="g1" cx="36" cy="8" r="4" opacity=".6"/><circle class="g3" cx="25" cy="13" r="3" opacity=".8"/>' },
  { id: 'constellation', file: 'constellation', name: 'Constellation', animated: true,
    glyph: '<path class="ln" d="M6 24L16 10l12 6 8-10 6 16-14 4z"/><g class="g2"><circle cx="6" cy="24" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="28" cy="16" r="2"/><circle cx="36" cy="6" r="2"/><circle cx="42" cy="22" r="2"/><circle cx="28" cy="26" r="2"/></g>' },
  { id: 'bubbles', file: 'letter-bubbles', name: 'Letter bubbles', animated: true,
    glyph: '<circle class="g3" cx="13" cy="19" r="9" opacity=".75"/><circle class="g1" cx="33" cy="12" r="7" opacity=".75"/><circle class="g2" cx="38" cy="26" r="4" opacity=".75"/><path class="ln" d="M9 23l4-9 4 9M10.5 20h5M30 9l3 7 3-7"/>' },
  { id: 'none', name: 'None', animated: false,
    glyph: '<circle class="ln" cx="24" cy="16" r="10"/><path class="ln" d="M17 23l14-14"/>' },
]);

/** @param {unknown} id @returns {Background} */
export function findBackground(id) {
  return BACKGROUNDS.find(b => b.id === id) ?? BACKGROUNDS[0];
}

/**
 * Runs at most one animated background at a time. show() resolves once the new one is
 * drawing, or immediately for a still choice; a show() overtaken by a later call never
 * starts. A module that fails to load (offline, say) leaves nothing running.
 * @param {{importFn?:(file:string)=>Promise<BackgroundModule>}} [deps]
 */
export function makeBackdrop(deps = {}) {
  const importFn = deps.importFn ?? (file => import(`./backgrounds/${file}.js`));
  /** @type {Map<string, Promise<BackgroundModule>>} */
  const loaded = new Map();
  /** @type {(() => void)|null} */
  let stop = null;
  let key = '';
  let gen = 0;

  /** @returns {void} */
  function halt() {
    gen++;
    key = '';
    if (stop) { const s = stop; stop = null; s(); }
  }

  return {
    /** @param {string} id @param {HTMLElement|null} host @param {BackgroundOptions} opts
     * @returns {Promise<boolean>} whether an animated background is now running */
    async show(id, host, opts) {
      const bg = findBackground(id);
      const next = bg.file && host ? `${bg.id}|${host.id}|${opts.dark}|${opts.reducedMotion}` : '';
      if (next && next === key && stop) return true;
      halt();
      if (!next || !bg.file || !host) return false;
      const my = gen;
      key = next;
      let mod = loaded.get(bg.file);
      if (!mod) { mod = importFn(bg.file); loaded.set(bg.file, mod); }
      try {
        const m = await mod;
        if (my !== gen) return false;
        stop = m.start(host, opts);
        return true;
      } catch {
        loaded.delete(bg.file);   // try the network again next time
        if (my === gen) key = '';
        return false;
      }
    },
    /** @returns {void} */
    stop: halt,
    /** @returns {string} the running background's id, or '' */
    running: () => key.split('|')[0],
  };
}
