// Background choices: the still category art (art.js) and the animated modules in
// src/backgrounds/, which load only when picked. Pure: the import is injected, and the
// host a background draws into is passed in.
import { retryingImport } from './importer.js';
import { makeRng } from './rng.js';
import { normalizeTheme } from './appearance.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed:number, corner?:boolean}} BackgroundOptions
 * `colors` are the theme's six confetti colours, which the subject backgrounds draw in (the
 * others keep their own); `subject` and `seed` are the dealt puzzle's.
 * `corner` asks a scene for its main icon alone, placed by the host's CSS like the category art.
 */
/** @typedef {{start:(host:HTMLElement, opts:BackgroundOptions)=>()=>void}} BackgroundModule */
/**
 * @typedef {{id:string, name:string, animated:boolean, file?:string, glyph:string, perDeal?:boolean}} Background
 * `file` is the module under src/backgrounds/; `glyph` is the picker tile's picture, the inner
 * markup of a 48x32 SVG whose g1..g4 classes take the theme's confetti colours. `perDeal`
 * restarts it for every new subject or seed; the others keep running across deals.
 */

/** @type {readonly Background[]} */
export const BACKGROUNDS = Object.freeze([
  { id: 'illustrated', name: 'Illustrated', animated: false,
    glyph: '<circle class="g2" cx="35" cy="9" r="5"/><path class="g1" d="M3 29l12-15 8 9 6-6 16 12z"/>' },
  { id: 'pixel', name: 'Pixel art', animated: false,
    glyph: '<path class="g3" d="M14 8h4v4h-4zM30 8h4v4h-4zM10 12h28v4H10zM6 16h36v4H6zM6 20h4v4H6zM38 20h4v4h-4zM14 20h20v4H14zM18 24h4v4h-4zM26 24h4v4h-4z"/>' },
  { id: 'scene', file: 'subject-scene', name: 'Subject scene', animated: false, perDeal: true,
    glyph: '<circle class="g2" cx="10" cy="10" r="6"/><path class="g1" d="M33 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/><path class="g3" d="M15 30c-6-4-9-6.6-9-10a4.5 4.5 0 0 1 9-.6 4.5 4.5 0 0 1 9 .6c0 3.4-3 6-9 10z"/><path class="g4" d="M38 30c-6 0-8-5-5-11 3 2 8 4 8 8 0 2-1 3-3 3z"/>' },
  { id: 'drift', file: 'drifting-icons', name: 'Drifting icons', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M10 31v-5M25 31v-8M39 31v-4"/><circle class="g2" cx="10" cy="18" r="5"/><path class="g1" d="M25 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.9-3.8 5.4-.8z"/><path class="g3" d="M39 23c-5-3.4-7.5-5.6-7.5-8.4a3.8 3.8 0 0 1 7.5-.5 3.8 3.8 0 0 1 7.5.5c0 2.8-2.5 5-7.5 8.4z"/>' },
  { id: 'motion', file: 'subject-motion', name: 'Subject motion', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M4 30q8-14 18-12M27 12q6-6 14-4" opacity=".45"/><circle class="g2" cx="10" cy="10" r="5"/><path class="g1" d="M38 13l2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.3-4.4 2.3.8-5-3.6-3.5 5-.7z"/><path class="g3" d="M24 31c-5-3.4-7.5-5.6-7.5-8.4a3.8 3.8 0 0 1 7.5-.5 3.8 3.8 0 0 1 7.5.5c0 2.8-2.5 5-7.5 8.4z"/>' },
  { id: 'parade', file: 'icon-parade', name: 'Parade', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M3 11h42M3 21.5h42" opacity=".3"/><g class="g2"><circle cx="9" cy="6.5" r="3"/><circle cx="23" cy="4.3" r="3"/><circle cx="37" cy="6.5" r="3"/></g><path class="g1" d="M11.5 19.5l-2-6h6l2 6zM25.5 17.5l-2-6h6l2 6zM39.5 19.5l-2-6h6l2 6z"/><path class="g3" d="M4 30.5l6-7.5 3 7.5zM18 28.5l6-7.5 3 7.5zM32 30.5l6-7.5 3 7.5z"/>' },
  { id: 'bloom', file: 'icon-bloom', name: 'Bloom', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M19 1v1.5M28.6 5.6l-1.1 1.1M9.4 5.6l1.1 1.1M31.5 14h-1.5M6.5 14H8"/><g class="g1"><circle cx="19" cy="9.6" r="3.8"/><circle cx="23.4" cy="14" r="3.8"/><circle cx="19" cy="18.4" r="3.8"/><circle cx="14.6" cy="14" r="3.8"/></g><circle class="g2" cx="19" cy="14" r="2.4"/><circle class="g3" cx="6" cy="27" r="2.2"/><path class="g3" d="M33 30c0-7.5 4.5-12 12-12 0 7.5-4.5 12-12 12z"/><circle class="g4" cx="41" cy="7" r="3.5" opacity=".4"/>' },
  { id: 'wallpaper', file: 'icon-tiles', name: 'Wallpaper', animated: true, perDeal: true,
    glyph: '<path class="g1" d="M6 2.5l4.5 4.5-4.5 4.5-4.5-4.5zM30 2.5l4.5 4.5-4.5 4.5-4.5-4.5zM18 20.5l4.5 4.5-4.5 4.5-4.5-4.5zM42 20.5l4.5 4.5-4.5 4.5-4.5-4.5z"/><g class="g3"><circle cx="18" cy="7" r="3"/><circle cx="42" cy="7" r="2.6"/><circle cx="0" cy="16" r="3.2"/><circle cx="12" cy="16" r="3.2"/><circle cx="24" cy="16" r="2.8"/><circle cx="36" cy="16" r="2.6"/><circle cx="48" cy="16" r="2.6"/><circle cx="6" cy="25" r="3.2"/><circle cx="30" cy="25" r="2.8"/></g>' },
  { id: 'carousel', file: 'icon-orbit', name: 'Carousel', animated: true, perDeal: true,
    glyph: '<ellipse class="ln" cx="24" cy="14.5" rx="19" ry="8.5" opacity=".45"/><circle class="g4" cx="24" cy="6" r="2.6"/><circle class="g3" cx="10.6" cy="8.5" r="3"/><circle class="g2" cx="37.4" cy="8.5" r="3"/><circle class="g1" cx="7.5" cy="18.8" r="4.3"/><circle class="g4" cx="40.5" cy="18.8" r="4.3"/><circle class="g3" cx="24" cy="23" r="6"/>' },
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

/** @param {unknown} id @param {readonly Background[]} [list] @returns {Background} */
export function findBackground(id, list = BACKGROUNDS) {
  return list.find(b => b.id === id) ?? list[0];
}

/** Each theme's own background, the same in both flavours: what the Theme mode shows.
 * @type {Readonly<Record<string, string>>} */
export const THEME_BACKGROUNDS = Object.freeze({
  phosphor: 'starfield', graphite: 'constellation', broadsheet: 'illustrated', drafting: 'shimmer',
  sticker: 'motion', plum: 'bokeh', grove: 'aurora',
});

/** What Random picks from: every background but None. @type {readonly string[]} */
export const RANDOM_POOL = Object.freeze(BACKGROUNDS.filter(b => b.id !== 'none').map(b => b.id));

/**
 * The background a deal shows. Manual is the player's pick; Theme is the theme's own; Random is
 * picked by the deal's seed, never `previous` (the last pick), so a new game always changes it.
 * @param {string} mode 'theme' | 'random' | 'manual' @param {string} art the Manual pick
 * @param {string} theme @param {number} seed @param {string} [previous]
 * @param {readonly string[]} [pool] @returns {string} an id
 */
export function resolveBackground(mode, art, theme, seed, previous = '', pool = RANDOM_POOL) {
  if (mode === 'theme') return THEME_BACKGROUNDS[normalizeTheme(theme)];
  if (mode !== 'random') return findBackground(art).id;
  const others = pool.filter(id => id !== previous);
  const from = others.length ? others : pool;
  return from[makeRng(seed).int(from.length)];
}

/** A background's module, by its registry `file`, tried again under a new URL after a failure
 * (importer.js says why). Relative to this file, not the page.
 * @type {(file:string) => Promise<BackgroundModule>} */
export const importBackground = retryingImport((file, query) => import(`./backgrounds/${file}.js${query}`));

/**
 * Runs at most one animated background at a time. show() resolves once the new one is
 * drawing, or immediately for a still choice; a show() overtaken by a later call never
 * starts. A module that fails to load (offline, say) leaves nothing running.
 * @param {{importFn?:(file:string)=>Promise<BackgroundModule>, list?:readonly Background[]}} [deps]
 */
export function makeBackdrop(deps = {}) {
  const importFn = deps.importFn ?? importBackground;
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
      const bg = findBackground(id, deps.list);
      const deal = bg.perDeal ? `|${opts.subject}|${opts.seed}` : '';
      const next = bg.file && host ? `${bg.id}|${host.id}|${opts.dark}|${opts.reducedMotion}|${opts.colors}${deal}` : '';
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
