// Background choices: the still category art (art.js) and the animated modules in
// src/backgrounds/, which load only when picked. Pure: the import is injected, and the
// host a background draws into is passed in.
import { retryingImport } from './importer.js';
import { makeRng } from './rng.js';
import { normalizeTheme } from './appearance.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed:number, ground?:string,
 *   lookOf?:(id:string) => Look}} BackgroundOptions
 * `colors` are the background's own six colours and `dark` whether its ground is dark (`lookOf`),
 * the same in every theme; `subject` and `seed` are the dealt puzzle's. `ground` is painted on the
 * host when the background starts (left as it is when absent: Subject motion paints its motion's,
 * through `lookOf`, passed in so an older copy of this file cannot break its import).
 */
/** @typedef {{start:(host:HTMLElement, opts:BackgroundOptions)=>()=>void}} BackgroundModule */
/**
 * @typedef {{id:string, name:string, animated:boolean, file?:string, glyph:string, perDeal?:boolean}} Background
 * `file` is the module under src/backgrounds/; `glyph` is the picker tile's picture, the inner
 * markup of a 48x32 SVG whose g1..g4 classes take its look's first four colours. `perDeal`
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
  { id: 'swim', file: 'icon-swim', name: 'Swim', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M2 27q5-3 10 0t10 0 10 0 10 0" opacity=".45"/><path class="g3" d="M12 13c4-5 11-5 15 0-4 5-11 5-15 0zM13 13l-6-4.5v9z"/><path class="g1" d="M30 21c3-3.6 8-3.6 11 0-3 3.6-8 3.6-11 0zM31 21l-4.5-3.3v6.6z"/><g class="g2"><circle cx="32" cy="8" r="2"/><circle cx="37" cy="4" r="1.4"/></g>' },
  { id: 'flutter', file: 'icon-flutter', name: 'Flutter', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M3 28q6-10 13-6" opacity=".45" stroke-dasharray="2 3"/><path class="g1" d="M28 15c-3-8-12-11-13-5-.5 4 5 6 13 5zM28 15c3-8 12-11 13-5 .5 4-5 6-13 5z"/><path class="g4" d="M28 15c-2 6-9 10-10.5 6-.8-3 4-5.5 10.5-6zM28 15c2 6 9 10 10.5 6 .8-3-4-5.5-10.5-6z"/><path class="ln" d="M28 9v12"/>' },
  { id: 'fall', file: 'icon-fall', name: 'Fall', animated: true, perDeal: true,
    glyph: '<path class="g1" d="M9 3c6 1 9 5 7 11-6-1-9-5-7-11z"/><path class="g3" d="M30 9c5 3 6 8 2 12-5-3-6-8-2-12z"/><path class="g2" d="M14 21c6 0 9 4 8 9-6 0-9-4-8-9z"/><path class="g4" d="M40 21c4 2 5 6 2 9-4-2-5-6-2-9z"/><path class="ln" d="M20 6q4 3 3 7M38 3q3 2 2 5" opacity=".45"/>' },
  { id: 'bounce', file: 'icon-bounce', name: 'Bounce', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M3 30h42M6 26q5-22 13 0M21 26q5-14 11 0" opacity=".45"/><circle class="g1" cx="12" cy="7" r="4.5"/><ellipse class="g3" cx="26.5" cy="14" rx="4.5" ry="4"/><ellipse class="g2" cx="39" cy="25" rx="5.5" ry="3.6"/>' },
  { id: 'rise', file: 'icon-rise', name: 'Rise', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M12 17q-2 6 1 13M34 13q2 6-1 12" opacity=".6"/><ellipse class="g1" cx="12" cy="10.5" rx="6" ry="7"/><ellipse class="g3" cx="34" cy="7" rx="5" ry="6"/><ellipse class="g2" cx="24" cy="22" rx="3.5" ry="4.2" opacity=".75"/><circle class="g4" cx="43" cy="24" r="2" opacity=".75"/>' },
  { id: 'pulse', file: 'icon-pulse', name: 'Pulse', animated: true, perDeal: true,
    glyph: '<circle class="ln" cx="24" cy="16" r="10" opacity=".35"/><circle class="ln" cx="24" cy="16" r="14.5" opacity=".2"/><path class="g3" d="M24 23c-5.5-3.7-8.5-6.2-8.5-9.4a4.3 4.3 0 0 1 8.5-.6 4.3 4.3 0 0 1 8.5.6c0 3.2-3 5.7-8.5 9.4z"/><circle class="g1" cx="5" cy="7" r="2.5"/><circle class="g2" cx="43" cy="26" r="2.5"/><circle class="g4" cx="43" cy="6" r="1.8"/><circle class="g4" cx="5" cy="26" r="1.8"/>' },
  { id: 'sway', file: 'icon-sway', name: 'Sway', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M2 5q22 8 44 0M12 7.5v6M25 9l1.5 7M38 7.5l2 5"/><circle class="g1" cx="12" cy="18" r="4.5"/><path class="g3" d="M22 16h9l-1.5 10h-6z"/><path class="g2" d="M41 12.5l4.5 7.5h-9z"/>' },
  { id: 'ripple', file: 'icon-ripple', name: 'Ripple', animated: true, perDeal: true,
    glyph: '<ellipse class="ln" cx="20" cy="22" rx="10" ry="3.5" opacity=".6"/><ellipse class="ln" cx="20" cy="22" rx="17" ry="6.5" opacity=".3"/><ellipse class="ln" cx="40" cy="10" rx="5" ry="2" opacity=".45"/><path class="g3" d="M13 21c1-6 4-9 7-9s6 3 7 9z"/><circle class="g1" cx="40" cy="9" r="2.2"/><path class="g2" d="M4 6c3 0 5 2 5 5-3 0-5-2-5-5z"/>' },
  { id: 'warp', file: 'icon-warp', name: 'Warp', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M21 14L6 5M27 14l15-9M21 18L7 28M27 18l14 10" opacity=".4"/><circle class="g4" cx="24" cy="16" r="1.6"/><circle class="g2" cx="31" cy="11" r="2.6"/><circle class="g1" cx="8" cy="7" r="5"/><path class="g3" d="M40 31c-5-3.4-7.5-5.6-7.5-8.4a3.8 3.8 0 0 1 7.5-.5 3.8 3.8 0 0 1 7.5.5c0 2.8-2.5 5-7.5 8.4z"/>' },
  { id: 'kaleido', file: 'icon-kaleido', name: 'Kaleidoscope', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M8 16h32M16 2.1l16 27.8M32 2.1L16 29.9" opacity=".3"/><path class="g3" d="M29 16 33 18.3 37 16 33 13.7zM26.5 20.3 26.5 24.9 30.5 27.3 30.5 22.6zM21.5 20.3 17.5 22.6 17.5 27.3 21.5 24.9zM19 16 15 13.7 11 16 15 18.3zM21.5 11.7 21.5 7.1 17.5 4.7 17.5 9.4zM26.5 11.7 30.5 9.4 30.5 4.7 26.5 7.1z"/><circle class="g1" cx="24" cy="16" r="3.2"/><g class="g2"><circle cx="38" cy="24" r="2"/><circle cx="10" cy="24" r="2"/><circle cx="24" cy="31" r="1.6"/><circle cx="10" cy="8" r="2"/><circle cx="38" cy="8" r="2"/><circle cx="24" cy="1.6" r="1.6"/></g>' },
  { id: 'flip', file: 'icon-flip', name: 'Flip board', animated: true, perDeal: true,
    glyph: '<path class="g1" d="M2 2h13v13H2zM33 17h13v13H33z"/><path class="g3" d="M33 2h13v13H33zM2 17h13v13H2z"/><path class="g2" d="M17.5 6.5h13v4h-13z"/><path class="g4" d="M17.5 17h13v13h-13z"/><path class="ln" d="M1 8.5h46M1 23.5h46" opacity=".5"/>' },
  { id: 'wave', file: 'icon-wave', name: 'Stadium wave', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M1 16.5h46M1 30.5h46" opacity=".4"/><g class="g3"><circle cx="5" cy="12" r="3.2"/><circle cx="13" cy="12" r="3.2"/><circle cx="37" cy="12" r="3.2"/><circle cx="45" cy="12" r="3.2"/></g><g class="g1"><circle cx="21" cy="5.5" r="3.8"/><circle cx="29" cy="9" r="3.4"/></g><g class="g2"><circle cx="9" cy="26" r="3.2"/><circle cx="17" cy="26" r="3.2"/><circle cx="25" cy="26" r="3.2"/><circle cx="41" cy="26" r="3.2"/></g><circle class="g4" cx="33" cy="19.5" r="3.8"/>' },
  { id: 'trail', file: 'icon-trail', name: 'Trail', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M3 28C10 19 18 23 26 18S37 8 45 6" opacity=".45"/><circle class="g3" cx="5" cy="26" r="2.6"/><circle class="g2" cx="12" cy="21" r="2.9"/><circle class="g4" cx="20" cy="20.5" r="3.1"/><circle class="g3" cx="28" cy="16.5" r="3.3"/><circle class="g2" cx="35.5" cy="10.5" r="3.5"/><circle class="g1" cx="43" cy="6.5" r="4.4"/>' },
  { id: 'whirlpool', file: 'icon-whirlpool', name: 'Whirlpool', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M25 16a1.5 1.5 0 0 0-3 0a3 3 0 0 0 6 0a4.5 4.5 0 0 0-9 0a6 6 0 0 0 12 0a7.5 7.5 0 0 0-15 0a9 9 0 0 0 18 0a10.5 10.5 0 0 0-21 0" opacity=".45"/><circle class="g1" cx="13" cy="16" r="3.8"/><circle class="g3" cx="31" cy="8.6" r="3.2"/><circle class="g2" cx="25" cy="25" r="2.6"/><circle class="g4" cx="23.5" cy="8.5" r="2"/><circle class="g4" cx="5" cy="7" r="3.2"/><circle class="g2" cx="43" cy="26" r="3.6"/>' },
  { id: 'stack', file: 'icon-stack', name: 'Stack', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M8 4v26h31V4" opacity=".5"/><path class="g1" d="M10 22h6v6h-6zM24 22h6v6h-6z"/><path class="g2" d="M17 22h6v6h-6zM24 15h6v6h-6z"/><path class="g3" d="M10 15h6v6h-6zM10 8h6v6h-6z"/><path class="g4" d="M31 5h6v6h-6z"/>' },
  { id: 'juggle', file: 'icon-juggle', name: 'Juggle', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M12 26q12-30 24 0" opacity=".4"/><path class="ln" d="M6 27q6 6 12 0M30 27q6 6 12 0"/><circle class="g1" cx="16.5" cy="15.5" r="4"/><circle class="g2" cx="24" cy="9.5" r="4"/><circle class="g3" cx="33" cy="18.5" r="4"/>' },
  { id: 'fountain', file: 'icon-fountain', name: 'Fountain', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M8 30h32M22 29l1-4h2l1 4"/><path class="ln" d="M24 24q-10-24-18 3M24 24q10-24 18 3" opacity=".4"/><circle class="g1" cx="14.5" cy="10" r="3.5"/><circle class="g2" cx="33.5" cy="10" r="3.5"/><circle class="g3" cx="24" cy="5" r="3"/><circle class="g4" cx="8" cy="20" r="2.6"/><circle class="g4" cx="40" cy="20" r="2.6"/>' },
  { id: 'conveyor', file: 'icon-conveyor', name: 'Conveyor', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M6 12h36a3 3 0 0 1 0 6H6a3 3 0 0 1 0-6zM6 25h36a3 3 0 0 1 0 6H6a3 3 0 0 1 0-6z"/><path class="g1" d="M8 4h7v7H8z"/><circle class="g2" cx="30" cy="7.5" r="3.6"/><path class="g3" d="M17 24l4.5-7.5 4.5 7.5z"/><circle class="g4" cx="38" cy="20.4" r="3.6"/>' },
  { id: 'ferris', file: 'icon-ferris', name: 'Ferris wheel', animated: true, perDeal: true,
    glyph: '<circle class="ln" cx="24" cy="15" r="11" opacity=".55"/><path class="ln" d="M24 15l-8 16M24 15l8 16M10 31h28M13 15h22M24 4v22" opacity=".45"/><path class="g1" d="M21 5h6a3 3 0 0 1-6 0z"/><path class="g2" d="M10 16h6a3 3 0 0 1-6 0z"/><path class="g3" d="M32 16h6a3 3 0 0 1-6 0z"/><path class="g4" d="M13 24h6a3 3 0 0 1-6 0z"/><path class="g1" d="M29 24h6a3 3 0 0 1-6 0z"/>' },
  { id: 'pendulums', file: 'icon-pendulums', name: 'Pendulum wave', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M3 3h42"/><path class="ln" d="M8 3l-2 18M17 3l-1 21M26 3l1 22M35 3l3 19M43 3l2 14" opacity=".45"/><circle class="g1" cx="6" cy="23" r="3.6"/><circle class="g2" cx="16" cy="26" r="3.6"/><circle class="g3" cx="27" cy="27" r="3.6"/><circle class="g4" cx="38" cy="24" r="3.6"/><circle class="g1" cx="45" cy="19" r="3"/>' },
  { id: 'roll', file: 'icon-roll', name: 'Roll', animated: true, perDeal: true,
    glyph: '<path class="ln" d="M2 30h16q12 0 28-8"/><circle class="g1" cx="9" cy="23" r="6"/><circle class="g3" cx="26" cy="20" r="8"/><circle class="g2" cx="41" cy="20" r="4.5"/><path class="ln" d="M5 19l8 8M20.5 14.5l11 11M38 17l6 6" opacity=".5"/>' },
  { id: 'billiards', file: 'icon-billiards', name: 'Billiards', animated: true, perDeal: true,
    glyph: '<rect class="ln" x="2" y="3" width="44" height="26" rx="3" opacity=".45"/><path class="ln" d="M10 16h8" opacity=".45"/><circle class="g1" cx="7" cy="16" r="3.8"/><circle class="g2" cx="23" cy="16" r="3.8"/><circle class="g3" cx="30" cy="12" r="3.8"/><circle class="g4" cx="30" cy="20" r="3.8"/><circle class="g1" cx="37" cy="8" r="3.8"/><circle class="g2" cx="37" cy="16" r="3.8"/><circle class="g3" cx="37" cy="24" r="3.8"/>' },
  { id: 'flock', file: 'icon-flock', name: 'Flock', animated: true, perDeal: true,
    glyph: '<path class="g1" d="M5 4l8 3.5-8 3.5 2-3.5z"/><path class="g2" d="M14 10l8 3.5-8 3.5 2-3.5z"/><path class="g3" d="M24 15l8 3.5-8 3.5 2-3.5z"/><path class="g4" d="M13 21l8 3.5-8 3.5 2-3.5z"/><path class="g2" d="M4 17l8 3.5-8 3.5 2-3.5z"/><path class="g3" d="M27 5l8 3.5-8 3.5 2-3.5z"/><path class="g1" d="M36 11l8 3.5-8 3.5 2-3.5z"/>' },
  { id: 'solar', file: 'icon-solar', name: 'Solar system', animated: true, perDeal: true,
    glyph: '<ellipse class="ln" cx="24" cy="16" rx="21" ry="11" opacity=".4"/><ellipse class="ln" cx="24" cy="16" rx="12" ry="6.5" opacity=".4"/><circle class="g1" cx="24" cy="16" r="5.5"/><circle class="g3" cx="33.6" cy="12.1" r="3"/><circle class="g2" cx="18" cy="21.6" r="2.4"/><circle class="g4" cx="7.2" cy="22.6" r="3.6"/><circle class="g2" cx="3" cy="26.5" r="1.6"/>' },
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
  { id: 'fireflies', file: 'fireflies', name: 'Fireflies', animated: true,
    glyph: '<g class="g2"><circle cx="9" cy="8" r="5" opacity=".3"/><circle cx="9" cy="8" r="2"/><circle cx="33" cy="20" r="6" opacity=".3"/><circle cx="33" cy="20" r="2.4"/></g><g class="g4"><circle cx="20" cy="25" r="4" opacity=".3"/><circle cx="20" cy="25" r="1.6"/><circle cx="41" cy="6" r="3.5" opacity=".3"/><circle cx="41" cy="6" r="1.4"/></g><path class="ln" d="M11 12q6 8 7 11" opacity=".4" stroke-dasharray="2 3"/>' },
  { id: 'rain', file: 'rain', name: 'Rain', animated: true,
    glyph: '<path class="g1" d="M9 2h2l-3.5 10h-2zM34 4h2l-3.5 10h-2z"/><path class="g3" d="M22 1h2l-3.5 10h-2zM16 13h2l-3 8.5h-2z"/><path class="g2" d="M44 9h2l-3 8.5h-2zM29 15h2l-3 8.5h-2z"/><ellipse class="ln" cx="12" cy="28" rx="7" ry="2.5"/><ellipse class="ln" cx="34" cy="28.5" rx="9" ry="3" opacity=".6"/>' },
  { id: 'snow', file: 'snowfall', name: 'Snowfall', animated: true,
    glyph: '<path class="ln" d="M15 4v16M8 8l14 8M8 16l14-8M35 15v10M30.7 17.5l8.6 5M30.7 22.5l8.6-5"/><g class="g1"><circle cx="5" cy="25" r="2.2"/><circle cx="41" cy="5" r="2.6"/></g><g class="g2"><circle cx="27" cy="5" r="2"/><circle cx="21" cy="27" r="2.6"/></g><circle class="g3" cx="44" cy="27" r="1.8"/><path class="g4" d="M0 32c8-3 16-1 24-2s16-3 24-1v3z" opacity=".5"/>' },
  { id: 'blobs', file: 'blobs', name: 'Blobs', animated: true,
    glyph: '<g class="g1"><circle cx="12" cy="13" r="8"/><circle cx="25" cy="18" r="6.5"/><path d="M14 7.5q6 5 11 4v13q-7-3-11 .5z"/></g><circle class="g3" cx="39" cy="8" r="5"/><g class="g2"><circle cx="35" cy="25" r="4.5"/><circle cx="43" cy="26" r="3.6"/><path d="M35 20.5h8v9h-8z"/></g><circle class="g4" cx="8" cy="27.5" r="3"/>' },
  { id: 'plasma', file: 'plasma', name: 'Plasma', animated: true,
    glyph: '<rect class="g1" width="48" height="32" rx="3" opacity=".4"/><path class="g3" d="M6 3c10-4 18 6 14 14S5 31 3 21 0 5 6 3z" opacity=".85"/><path class="g2" d="M30 5c8-3 16 3 14 11s-10 15-17 11-5-19 3-22z" opacity=".85"/><circle class="g4" cx="11" cy="13" r="4.5"/><circle class="g1" cx="35" cy="16" r="5"/>' },
  { id: 'letterrain', file: 'letter-rain', name: 'Letter rain', animated: true,
    glyph: '<g class="g1"><path d="M6 2h5v3H6z" opacity=".3"/><path d="M6 8h5v3H6z" opacity=".55"/><path d="M6 14h5v3H6z" opacity=".8"/></g><path class="ln" d="M6 27.5l2.5-7 2.5 7M7 25.5h3"/><g class="g3"><path d="M22 8h5v3h-5z" opacity=".3"/><path d="M22 14h5v3h-5z" opacity=".55"/><path d="M22 20h5v3h-5z" opacity=".8"/><path d="M38 1h5v3h-5z" opacity=".55"/></g><path class="ln" d="M38 7.5h5l-5 7h5"/><path class="g2" d="M38 18h5v3h-5z" opacity=".35"/>' },
  { id: 'waves', file: 'waves', name: 'Waves', animated: true,
    glyph: '<path class="ln" d="M2 7q5-5 10 0t10 0 10 0 10 0 6-1" opacity=".55"/><path class="g3" d="M0 15q6-6 12 0t12 0 12 0 12 0v6H0z" opacity=".7"/><path class="g1" d="M0 22q8-8 16 0t16 0 16 0v10H0z"/><circle class="g4" cx="15" cy="17.5" r="1.4"/><circle class="g4" cx="31" cy="17.5" r="1.4"/>' },
  { id: 'contours', file: 'contours', name: 'Contours', animated: true,
    glyph: '<path class="ln" d="M20 2c11-1 21 4 21 12s-8 16-20 15S2 24 3 15 9 3 20 2z" opacity=".4"/><path class="ln" d="M21 7c7 0 14 3 14 8s-6 10-14 9-12-4-12-9 5-8 12-8z" opacity=".7"/><path class="g1" d="M21 11c4 0 8 2 8 5s-4 5-8 4.5-6-2-6-4.5 2-5 6-5z"/><circle class="g3" cx="42" cy="27" r="3.5"/><path class="ln" d="M36 31.5c1-4 4-7 7-7.5s5 1 5 3" opacity=".55"/>' },
  { id: 'clouds', file: 'clouds', name: 'Clouds', animated: true,
    glyph: '<path class="g3" d="M30 12a4 4 0 0 1 1-8 5.5 5.5 0 0 1 10-1 4 4 0 0 1 4 9z" opacity=".6"/><path class="g1" d="M8 27a6 6 0 0 1 1-12 8 8 0 0 1 15-3 6 6 0 0 1 9 5 5 5 0 0 1 0 10z"/><path class="g2" d="M37 29a3.5 3.5 0 0 1 1-7 4.5 4.5 0 0 1 8.5 1 3 3 0 0 1 0 6z" opacity=".8"/>' },
  { id: 'ribbons', file: 'ribbons', name: 'Ribbons', animated: true,
    glyph: '<path class="g1" d="M2 25C7 13 13 10 20 13l-2 6c-5-2-9 0-12 8z"/><path class="g3" d="M20 13c4 2 7 3 10 2l-2 6c-4 1-7 0-10-2z"/><path class="g1" d="M30 15c6-2 10-8 16-10l-1 6c-5 2-9 7-17 10z"/><path class="g2" d="M4 31c8-3 14-4 20-2s12 1 20-3l1 2c-8 5-14 6-21 4s-12-1-19 1z" opacity=".6"/>' },
  { id: 'dunes', file: 'dunes', name: 'Dunes', animated: true,
    glyph: '<path class="g2" d="M0 19q10-3 18-9l10 9H0z" opacity=".6"/><path class="g1" d="M0 32v-6q14-2 25-11l15 17z"/><path class="g4" d="M25 15l15 17h-9z" opacity=".55"/><path class="ln" d="M28 12h5M30 8.5h6M34 14.5h5" opacity=".75"/>' },
  { id: 'voronoi', file: 'stained-glass', name: 'Stained glass', animated: true,
    glyph: '<path class="g1" d="M2 2h17l-4 14H2z"/><path class="g2" d="M19 2h27v11l-15 7-16-4z"/><path class="g3" d="M2 16h13l11 14H2z"/><path class="g4" d="M15 16l16 4-5 10z"/><path class="g1" d="M31 20l15-7v17H26z" opacity=".6"/><path class="ln" d="M2 2h44v28H2zM19 2l-4 14H2M15 16l16 4 15-7M15 16l11 14 5-10"/>' },
  { id: 'honeycomb', file: 'honeycomb', name: 'Honeycomb', animated: true,
    glyph: '<path class="ln" d="M1.8 10.4l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6zM46.2 10.4l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6z" opacity=".45"/><path class="g1" d="M12.9 10.4l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6zM35.1 10.4l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6zM18.5 0.8l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6z" opacity=".6"/><path class="g3" d="M29.5 0.8l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6zM18.5 20l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6zM29.5 20l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6z" opacity=".6"/><path class="g2" d="M24 10.4l4.8 2.8v5.6l-4.8 2.8-4.8-2.8v-5.6z"/>' },
  { id: 'blocks', file: 'blocks', name: 'Blocks', animated: true,
    glyph: '<path class="g1" d="M15 3h5v5h-5zM21 3h5v5h-5zM27 3h5v5h-5zM21 9h5v5h-5z"/><path class="g2" d="M2 20h5v5h-5zM8 20h5v5h-5zM8 14h5v5h-5z"/><path class="g3" d="M2 26h5v5h-5zM8 26h5v5h-5zM14 26h5v5h-5zM20 26h5v5h-5zM26 26h5v5h-5z"/><path class="g4" d="M32 26h5v5h-5zM38 26h5v5h-5zM44 26h5v5h-5zM32 20h5v5h-5zM38 20h5v5h-5zM44 20h5v5h-5z" opacity=".7"/>' },
  { id: 'synthwave', file: 'synthwave', name: 'Synthwave', animated: true,
    glyph: '<path class="g4" d="M0 17l5-5 4 3 4-5 3 7zM48 17l-4-6-4 4-3-2-3 4z" opacity=".6"/><path class="g2" d="M14.2 12a11 11 0 0 1 19.6 0zM13.6 13.6h20.8v1.6H13.6zM13.2 16h21.6v1H13.2z"/><path class="ln" d="M0 17h48M24 17L2 32M24 17L12 32M24 17v15M24 17l12 15M24 17l22 15M2 20h44M0 24h48M0 30.5h48" opacity=".7"/>' },
  { id: 'galaxy', file: 'galaxy', name: 'Galaxy', animated: true,
    glyph: '<path class="ln" d="M24 16c6-6 16-2 15 6M24 16c-6 6-16 2-15-6" opacity=".8"/><path class="ln" d="M28 12c8-2 14 4 12 11M20 20c-8 2-14-4-12-11" opacity=".4"/><circle class="g2" cx="24" cy="16" r="4"/><g class="g1"><circle cx="39" cy="22" r="1.6"/><circle cx="9" cy="10" r="1.6"/></g><g class="g3"><circle cx="33" cy="9" r="1.2"/><circle cx="15" cy="23" r="1.2"/><circle cx="42" cy="6" r="1"/><circle cx="6" cy="26" r="1"/></g>' },
  { id: 'tiles', file: 'letter-tiles', name: 'Letter tiles', animated: true,
    glyph: '<rect class="g1" x="3" y="5" width="14" height="14" rx="2.5" transform="rotate(-10 10 12)"/><path class="ln" d="M7 16l3-7.5 3 7.5M8 13.5h4" transform="rotate(-10 10 12)"/><rect class="g3" x="18" y="13" width="14" height="14" rx="2.5"/><path class="ln" d="M21.5 16.5h7M25 16.5v7.5"/><rect class="g2" x="38" y="6" width="5" height="14" rx="1.5" opacity=".75"/>' },
  { id: 'crossword', file: 'crossword', name: 'Crossword', animated: true,
    glyph: '<path class="g1" d="M4 13h7v7H4zM12 13h7v7h-7zM28 13h7v7h-7z" opacity=".75"/><path class="g3" d="M20 4h7v7h-7zM20 22h7v7h-7z" opacity=".75"/><path class="g2" d="M20 13h7v7h-7z"/><rect class="ln" x="36" y="13" width="7" height="7"/><path class="g4" d="M36 22h7v7h-7z" opacity=".35"/>' },
  { id: 'typewriter', file: 'typewriter', name: 'Typewriter', animated: true,
    glyph: '<path class="g1" d="M4 3h26v3H4zM8 9h34v3H8z" opacity=".4"/><path class="g3" d="M4 15h38v3H4z" opacity=".7"/><path class="g2" d="M4 21h18v3H4z"/><path class="ln" d="M25 25.5h4M2 28.5h44"/>' },
  { id: 'ink', file: 'ink', name: 'Ink bloom', animated: true,
    glyph: '<path class="g1" d="M9 4c6-3 13 1 12 8s-6 10-12 8S1 14 3 9s3-4 6-5z" opacity=".5"/><path class="g1" d="M10 9c3-1 6 1 5 4s-4 4-6 2-2-5 1-6z" opacity=".8"/><path class="g3" d="M33 14c5-2 11 1 11 6s-4 9-9 9-9-3-8-8 3-6 6-7z" opacity=".5"/><circle class="g3" cx="35" cy="21" r="3.5" opacity=".8"/><circle class="g2" cx="26" cy="6" r="2.5" opacity=".7"/><circle class="g4" cx="19" cy="27" r="2" opacity=".7"/>' },
  { id: 'smoke', file: 'smoke', name: 'Smoke', animated: true,
    glyph: '<path class="ln" d="M13 21c-3-4 4-7 1-11s3-6 1-8M35 22c3-4-3-7 0-11s-2-6 1-8" opacity=".55"/><path class="ln" d="M13 31v-8M35 31v-7"/><circle class="g1" cx="13" cy="22.5" r="2.2"/><circle class="g3" cx="35" cy="23.5" r="2.2"/><ellipse class="g2" cx="24" cy="8" rx="5" ry="2" opacity=".5"/>' },
  { id: 'halftone', file: 'halftone', name: 'Halftone', animated: true,
    glyph: '<g class="g1"><circle cx="6" cy="6" r="4.5"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="16" r="3"/><circle cx="30" cy="6" r="1.5"/><circle cx="18" cy="16" r="1.5"/><circle cx="6" cy="26" r="1.5"/></g><g class="g3"><circle cx="42" cy="6" r="3"/><circle cx="30" cy="16" r="3"/><circle cx="18" cy="26" r="3"/><circle cx="42" cy="16" r="4.5"/><circle cx="30" cy="26" r="4.5"/></g><circle class="g2" cx="42" cy="26" r="3"/>' },
  { id: 'flowfield', file: 'flowfield', name: 'Flow field', animated: true,
    glyph: '<path class="ln" d="M3 24c8-14 20-16 28-8s12 4 14-2M5 30c10-8 18-6 24 0M4 13c6-8 16-10 22-6M30 5c6-2 11 1 14 5"/><circle class="g1" cx="45" cy="14" r="2.2"/><circle class="g2" cx="29" cy="30" r="2.2"/><circle class="g3" cx="26" cy="7" r="2.2"/><circle class="g4" cx="44" cy="10" r="1.8"/>' },
  { id: 'lanterns', file: 'lanterns', name: 'Lanterns', animated: true,
    glyph: '<circle class="g2" cx="14" cy="18" r="11" opacity=".22"/><path class="g1" d="M6 9q8-6 16 0l-3 17h-10z"/><circle class="g2" cx="14" cy="28.5" r="1.8"/><path class="g3" d="M28 4q5-3.5 10 0l-2 11h-6z"/><circle class="g2" cx="33" cy="17" r="1.5"/><path class="g4" d="M36 19q4.5-3 9 0l-1.8 9.5h-5.4z"/><circle class="g2" cx="40.5" cy="30.3" r="1.5"/>' },
  { id: 'hills', file: 'hills', name: 'Paper hills', animated: true,
    glyph: '<circle class="g2" cx="36" cy="9" r="5.5"/><path class="g3" d="M0 19q10-10 22-4t26-3v20H0z" opacity=".55"/><circle class="g4" cx="11" cy="18" r="3.2"/><path class="ln" d="M11 21v4"/><path class="g1" d="M0 26q12-8 24-2t24-1v9H0z"/>' },
  { id: 'embers', file: 'embers', name: 'Embers', animated: true,
    glyph: '<path class="g2" d="M6 31.5q18-11 36 0z" opacity=".55"/><path class="g1" d="M15 21a2.2 2.2 0 0 1 4.4 0l-2.2 6.5zM31 23a2.2 2.2 0 0 1 4.4 0l-2.2 6.5z"/><path class="g3" d="M24 12a2 2 0 0 1 4 0l-2 6zM9 10a1.6 1.6 0 0 1 3.2 0l-1.6 4.5z"/><path class="g4" d="M36 8a1.8 1.8 0 0 1 3.6 0l-1.8 5zM19 4a1.4 1.4 0 0 1 2.8 0l-1.4 4z"/>' },
  { id: 'life', file: 'life', name: 'Life', animated: true,
    glyph: '<path class="g1" d="M13 5h6v6h-6zM20 12h6v6h-6zM6 19h6v6H6zM13 19h6v6h-6zM20 19h6v6h-6z"/><path class="g4" d="M6 12h6v6H6zM13 26h6v5h-6z" opacity=".4"/><path class="g3" d="M33 5h6v6h-6zM33 12h6v6h-6zM33 19h6v6h-6z"/><path class="g2" d="M40 26h6v5h-6zM33 26h6v5h-6z" opacity=".7"/>' },
  { id: 'maze', file: 'maze', name: 'Maze', animated: true,
    glyph: '<path class="ln" d="M2 10V2h44v20M46 30H2V18M10 2v8M10 18v12M18 10v12M18 10h8M26 18v12M34 2v12M34 22h12" opacity=".55"/><path class="g1" d="M2 13h12v2H2zM13 13h2v14h-2zM13 25h10v2H13zM21 13h2v14h-2zM21 13h10v2H21zM29 13h2v14h-2zM29 25h17v2H29z"/><circle class="g2" cx="4" cy="14" r="2.4"/><circle class="g3" cx="44" cy="26" r="2.4"/>' },
  { id: 'sand', file: 'sand', name: 'Falling sand', animated: true,
    glyph: '<path class="ln" d="M17 1.5h10l-3 3.5h-4z" opacity=".6"/><path class="g1" d="M21 5h2v8h-2zM38 9h2v2h-2zM37 14h2v2h-2z"/><path class="g3" d="M3 31l6-6h26l6 6z"/><path class="g2" d="M9 25l6-6h14l6 6z"/><path class="g1" d="M15 19l7-7 7 7z"/><path class="g4" d="M36 31l4-4 4 4z"/>' },
  { id: 'circuit', file: 'circuit', name: 'Circuit', animated: true,
    glyph: '<path class="ln" d="M5 8h11l6 6h13M5 23h9l5 5h10M30 22l6-6h7" opacity=".5"/><g class="g2"><circle cx="4" cy="8" r="2.4"/><circle cx="4" cy="23" r="2.4"/></g><g class="g3"><circle cx="37" cy="14" r="2.4"/><circle cx="40" cy="28" r="2.4"/></g><g class="g4"><circle cx="45" cy="16" r="2.4"/><circle cx="29" cy="23" r="2"/></g><circle class="g1" cx="29" cy="14" r="4.5" opacity=".35"/><path class="g1" d="M22.5 12.8H29v2.4h-6.5z"/>' },
  { id: 'koi', file: 'koi-pond', name: 'Koi pond', animated: true,
    glyph: '<path class="g4" d="M36 21l9-3A9.5 9.5 0 1 1 42.6 14.2z" opacity=".75"/><path class="g1" d="M3.9 12.4 6.8 11.2 8.8 11.4 11.3 11.7 14.5 12.5 17.9 13.4 21.6 13.6 25.1 12.6 24.9 11.4 21.6 11.5 18.8 10.4 15.9 8.8 12.8 7.1 9.2 5.9 5.2 6.8 2.1 9.6Q0.8 12.4 3.9 12.4zM21.6 12.5L31 15.1Q27.5 11.6 29.8 7.2z"/><circle class="g2" cx="9.3" cy="8.7" r="2"/><circle class="ln" cx="16" cy="25" r="4.5" opacity=".6"/><circle class="g3" cx="36" cy="21" r="2.6"/>' },
  { id: 'caustics', file: 'caustics', name: 'Caustics', animated: true,
    glyph: '<rect class="g4" width="48" height="32" rx="3" opacity=".3"/><path class="ln" d="M0 7c5 2 9-1 13 1s5 7 3 11-6 5-4 12M13 8c4-4 9-3 13 0s9 0 12-3M16 19c5 0 8 3 12 1s5-6 10-5 6 4 10 3M28 20c-1 4 2 7 1 12M26 8c-1 4 3 8 2 12M38 5c2 4 1 7 0 10M0 22c4-1 7 2 12 1" opacity=".75"/><g class="g1"><circle cx="13" cy="8" r="2.2"/><circle cx="28" cy="20" r="2.4"/><circle cx="38" cy="15" r="1.8"/></g><g class="g2"><circle cx="26" cy="8" r="1.8"/><circle cx="16" cy="19" r="2"/></g>' },
  { id: 'trails', file: 'light-trails', name: 'Light trails', animated: true,
    glyph: '<path class="ln" d="M0 8C18 8 28 24 48 22M0 13C18 13 27 29 48 27" opacity=".25"/><path class="g1" d="M2.6 8.4 7 9.3 11.1 10.8 15 12.6 18.9 14.7 22.7 16.9 23.8 14.6 19.8 12.7 15.8 11 11.6 9.5 7.3 8.4 2.7 7.8z"/><path class="g2" d="M45 26.9 39 26.3 33.8 24.8 29 22.8 24.5 20.4 20.1 17.8 18.9 20.1 23.5 22.3 28.3 24.4 33.4 26.1 38.9 27.2 44.9 27.5z"/><path class="g1" d="M30.3 19.4 34.8 21.3 39.7 22.7 45 23.4 45.2 21 39.9 20.9 35.1 20.2 30.5 18.9z" opacity=".7"/>' },
  { id: 'wireframe', file: 'wireframe', name: 'Wireframe', animated: true,
    glyph: '<path class="ln" d="M11 6v14h14M11 20l-6 6M38 13l-9 3M38 13l8 2M38 13 37 3M38 13l-1 16" opacity=".3"/><path class="ln" d="M5 12h14v14H5zM5 12l6-6h14l-6 6M25 6v14l-6 6M37 3l-8 13 8 13 9-14zM37 3l-3 16 3 10M29 16l5 3 12-4"/><g class="g1"><circle cx="5" cy="12" r="1.8"/><circle cx="19" cy="26" r="1.8"/><circle cx="25" cy="6" r="1.8"/></g><g class="g2"><circle cx="37" cy="3" r="1.8"/><circle cx="34" cy="19" r="1.8"/><circle cx="46" cy="15" r="1.8"/></g>' },
  { id: 'vines', file: 'vines', name: 'Vines', animated: true,
    glyph: '<path class="ln" d="M2 30c6-2 10-8 14-14s10-10 18-9c6 1 8 6 5 9s-6 0-4-2"/><path class="g1" d="M10 24.5c-4-1-6-4-6-7 4 0 7 3 6 7z"/><path class="g2" d="M17 15c0-4 2-7 6-8 1 4-2 7-6 8z"/><path class="g3" d="M27 8c3-3 7-3 9-1-3 3-6 3-9 1z"/><path class="g4" d="M14 19c4-1 7 0 9 3-4 2-7 0-9-3z"/>' },
  { id: 'tree', file: 'tree', name: 'Growing tree', animated: true,
    glyph: '<path class="ln" d="M24 31V19m0 0l-8-7m8 7l7-8m-15 1l-4-5m4 5l1-6m14 0l4-5m-4 5l-1-6"/><circle class="g1" cx="12" cy="6" r="4"/><circle class="g2" cx="18" cy="4" r="3.5"/><circle class="g3" cx="30" cy="4" r="3.5"/><circle class="g4" cx="36" cy="7" r="4"/><circle class="g2" cx="24" cy="9" r="3"/><path class="g1" d="M40 24c2-3 5-3 6-2-1 3-4 3-6 2z"/>' },
  { id: 'kinetic', file: 'kinetic', name: 'Kinetic', animated: true,
    glyph: '<path class="ln" d="M6 2v28M17 2v28M28 2v28M39 2v28"/><path class="g1" d="M2 5h8v8H2zM2 19h8v8H2z"/><path class="g3" d="M14 5h6v8h-6zM15.5 19h3v8h-3z"/><path class="g2" d="M27 5h2v8h-2zM25 19h6v8h-6z"/><path class="g4" d="M37 5h4v8h-4zM35 19h8v8h-8z"/>' },
  { id: 'orrery', file: 'orrery', name: 'Orrery', animated: true,
    glyph: '<ellipse class="ln" cx="24" cy="16" rx="10" ry="6.5"/><ellipse class="ln" cx="24" cy="16" rx="21" ry="13.5"/><path class="ln" d="M24 16l17-8"/><circle class="g2" cx="24" cy="16" r="4.5"/><circle class="g1" cx="14.5" cy="20" r="2.5"/><circle class="g3" cx="41" cy="8" r="3.5"/><circle class="g4" cx="45.5" cy="13.5" r="1.5"/>' },
  { id: 'jellyfish', file: 'jellyfish', name: 'Jellyfish', animated: true,
    glyph: '<path class="g1" d="M5 15c0-12 18-12 18 0z"/><path class="ln" d="M8 15c-1 5 1 9-1 14M14 15c1 5-1 9 1 14M20 15c1 4-1 8 1 12"/><path class="g3" d="M29 10c0-9 14-9 14 0z"/><path class="ln" d="M31.5 10c-1 4 1 7-1 11M36 10c1 4-1 7 1 11M40.5 10c1 3-1 6 1 9"/><circle class="g2" cx="14" cy="10" r="2"/><circle class="g4" cx="36" cy="6" r="1.6"/>' },
  { id: 'fireworks', file: 'fireworks', name: 'Fireworks', animated: true,
    glyph: '<path class="g1" d="M14 1.5 15.4 9.7 22.1 4.9 17.3 11.6 25.5 13 17.3 14.4 22.1 21.1 15.4 16.3 14 24.5 12.6 16.3 5.9 21.1 10.7 14.4 2.5 13 10.7 11.6 5.9 4.9 12.6 9.7z"/><g class="g2"><circle cx="38" cy="4" r="1.7"/><circle cx="43.5" cy="8" r="1.7"/><circle cx="41.5" cy="14.5" r="1.7"/><circle cx="34.5" cy="14.5" r="1.7"/><circle cx="32.5" cy="8" r="1.7"/></g><path class="ln" d="M25 31l2-6" opacity=".6"/><circle class="g3" cx="27.5" cy="23.5" r="2"/>' },
  { id: 'gears', file: 'gears', name: 'Gears', animated: true,
    glyph: '<path class="g1" fill-rule="evenodd" d="M26 13 30 13 30 17 26 17 24 20 27 24 25 26 21 23 18 25 18 29 14 29 14 25 11 23 7 26 5 24 8 20 6 17 2 17 2 13 6 13 8 10 5 6 7 4 11 7 14 5 14 1 18 1 18 5 21 7 25 4 27 6 24 10zM12 15a4 4 0 1 0 8 0 4 4 0 1 0-8 0z"/><path class="g2" fill-rule="evenodd" d="M43 24 45 26 44 28 41 27 38 29 37 32 35 32 34 29 31 27 28 28 27 26 29 24 29 20 27 18 28 16 31 17 34 15 35 12 37 12 38 15 41 17 44 16 45 18 43 20zM33 22a3 3 0 1 0 6 0 3 3 0 1 0-6 0z"/>' },
  { id: 'spirograph', file: 'spirograph', name: 'Spirograph', animated: true,
    glyph: '<path class="ln" d="M34 16 33 16 31 17 28 18 25 18 21 19 17 20 13 21 10 22 8 22 8 22 8 21 9 20 12 18 15 16 18 13 21 11 24 8 26 7 28 6 29 5 29 6 28 8 27 11 25 14 23 18 21 21 20 25 19 27 18 29 17 29 17 29 16 27 16 24 17 20 17 16 17 12 16 8 16 5 17 3 17 3 18 3 19 5 20 7 21 11 23 14 25 18 27 21 28 24 29 26 29 27 28 26 26 25 24 24 21 21 18 19 15 16 12 14 9 12 8 11 8 10 8 10 10 10 13 11 17 12 21 13 25 14 28 14 31 15 33 16z"/><circle class="g1" cx="40" cy="24" r="6.5" opacity=".55"/><circle class="g3" cx="37" cy="21" r="2.2"/>' },
  { id: 'radar', file: 'radar', name: 'Radar', animated: true,
    glyph: '<g class="ln" opacity=".45"><circle cx="24" cy="16" r="14"/><circle cx="24" cy="16" r="7.5"/><path d="M10 16h28M24 2v28"/></g><path class="g1" d="M24 16 33.9 6.1A14 14 0 0 1 38 16z" opacity=".6"/><path class="ln" d="M24 16h14"/><circle class="g2" cx="31" cy="10" r="2.2"/><circle class="g4" cx="16.5" cy="22" r="1.8" opacity=".6"/><circle class="g2" cx="19" cy="8" r="1.6" opacity=".4"/>' },
  { id: 'clocks', file: 'clocks', name: 'Clocks', animated: true,
    glyph: '<circle class="g1" cx="15" cy="16" r="13" opacity=".35"/><circle class="g2" cx="37" cy="10" r="8" opacity=".35"/><circle class="g4" cx="40" cy="26.5" r="4.5" opacity=".5"/><g class="ln"><circle cx="15" cy="16" r="13"/><path d="M15 16V7M15 16l6 3"/><circle cx="37" cy="10" r="8"/><path d="M37 10V5M37 10l-4 2.5"/></g>' },
  { id: 'puddles', file: 'puddles', name: 'Puddles', animated: true,
    glyph: '<ellipse class="ln" cx="17" cy="20" rx="14" ry="7"/><ellipse class="ln" cx="17" cy="20" rx="7.5" ry="3.7"/><ellipse class="ln" cx="35" cy="13" rx="10" ry="5"/><ellipse class="g2" cx="35" cy="13" rx="3.5" ry="1.8"/><ellipse class="g1" cx="17" cy="20" rx="2.5" ry="1.4"/><circle class="g3" cx="35" cy="4" r="1.8"/>' },
  { id: 'flag', file: 'flag', name: 'Flag', animated: true,
    glyph: '<path class="ln" d="M6 31V3"/><path class="g1" d="M7 5C13 2 17 8 24 5S35 2 42 5V12C35 9 31 9 24 12S13 9 7 12z"/><path class="g2" d="M7 12C13 9 17 15 24 12S35 9 42 12V19C35 16 31 16 24 19S13 16 7 19z"/><path class="g3" d="M7 19C13 16 17 22 24 19S35 16 42 19V26C35 23 31 23 24 26S13 23 7 26z"/>' },
  { id: 'string-art', file: 'stringart', name: 'String art', animated: true,
    glyph: '<circle class="ln" cx="24" cy="16" r="13.5" opacity=".3"/><path class="ln" d="M24 2.5L36.8 20.2L16.1 26.9L16.1 5.1L36.8 11.8L24 29.5L11.2 11.8L31.9 5.1L31.9 26.9L11.2 20.2z" opacity=".8"/><path class="g1" d="M22.4 0.9h3.2v3.2h-3.2zM35.2 10.2h3.2v3.2h-3.2zM30.3 25.3h3.2v3.2h-3.2zM14.5 25.3h3.2v3.2h-3.2zM9.6 10.2h3.2v3.2h-3.2z"/><path class="g2" d="M30.3 3.5h3.2v3.2h-3.2zM35.2 18.6h3.2v3.2h-3.2zM22.4 27.9h3.2v3.2h-3.2zM9.6 18.6h3.2v3.2h-3.2zM14.5 3.5h3.2v3.2h-3.2z"/>' },
  { id: 'oscilloscope', file: 'oscilloscope', name: 'Oscilloscope', animated: true,
    glyph: '<path class="ln" d="M4 4h40v24H4zM24 4v24M4 16h40" opacity=".3"/><path class="ln" d="M24 16L27.9 20.8L31.5 24.2L34.6 25.5L37 24.2L38.5 20.8L39 16L38.5 11.2L37 7.8L34.6 6.5L31.5 7.8L27.9 11.2L24 16L20.1 20.7L16.5 24.2L13.4 25.5L11 24.2L9.5 20.8L9 16L9.5 11.3L11 7.8L13.4 6.5L16.5 7.8L20.1 11.2z"/><circle class="g1" cx="34.6" cy="25.5" r="2.6"/>' },
  { id: 'paper-planes', file: 'planes', name: 'Paper planes', animated: true,
    glyph: '<path class="ln" d="M3 29C10 28 12 21 21 20" opacity=".55"/><path class="g1" d="M42.5 8.9L18.6 12.5L23.9 18.8z"/><path class="g2" d="M42.5 8.9L23.9 18.8L26.2 26.7z"/><path class="ln" d="M42.5 8.9L23.9 18.8"/>' },
  { id: 'turing', file: 'turing', name: 'Turing patterns', animated: true,
    glyph: '<g class="g1"><circle cx="8" cy="9" r="5"/><circle cx="35" cy="24" r="5"/></g><g class="g3"><circle cx="20" cy="22" r="4.5"/><circle cx="29" cy="10" r="4.5"/><path d="M19 19l8-11 4 3-8 11z"/></g><path class="g2" d="M38 4c5 0 8 3 8 8v14h-5V12c0-2-1-3-3-3z"/><circle class="g4" cx="9" cy="26" r="3.5"/>' },
  { id: 'slime', file: 'slime', name: 'Slime mould', animated: true,
    glyph: '<path class="ln" d="M3 6q8 4 11 10t-8 13M14 16q9-2 13 4t15 6M27 20q2-9 9-12t9-5M27 20q-4 6-2 11M36 8q2 8 8 9"/><g class="g1"><circle cx="14" cy="16" r="2.5"/><circle cx="27" cy="20" r="2.5"/></g><ellipse class="g3" cx="36" cy="8" rx="3.2" ry="2.3"/><ellipse class="g2" cx="42" cy="26" rx="3.2" ry="2.3"/>' },
  { id: 'ants', file: 'ants', name: 'Ant trails', animated: true,
    glyph: '<path class="ln" d="M7 25q9-14 21-10t15-9" stroke-dasharray="2 3"/><circle class="g3" cx="7" cy="25" r="4.5"/><g class="g2"><circle cx="42" cy="5.5" r="2"/><circle cx="45.5" cy="8.5" r="1.7"/><circle cx="39.5" cy="9" r="1.7"/></g><g class="g1"><ellipse cx="15" cy="18.5" rx="2.8" ry="2"/><circle cx="18.6" cy="16.6" r="1.6"/><ellipse cx="29" cy="15.5" rx="2.8" ry="2"/><circle cx="32.8" cy="14.2" r="1.6"/></g>' },
  { id: 'kelp', file: 'kelp', name: 'Kelp forest', animated: true,
    glyph: '<path class="ln" d="M10 32q-4-12 2-20t-1-11M25 32q4-10-1-18t2-12"/><path class="g1" d="M12 23q-7-1-9-6 6 0 9 6zM11 12q6-3 10-1-5 4-10 1z"/><path class="g2" d="M24 21q7-2 10 2-6 2-10-2zM25 9q-6-3-9-1 5 4 9 1z"/><path class="g3" d="M47 17q-5-5-11 0 6 5 11 0zm-11 0l-4-3.5v7z"/>' },
  { id: 'spiderweb', file: 'spider-web', name: 'Spider web', animated: true,
    glyph: '<path class="ln" d="M24 16L24 1M24 16L39 4M24 16L46 18M24 16L37 30M24 16L12 31M24 16L3 21M24 16L8 3M15 9L30 7L38 15L32 24L18 25L10 17ZM19 12L28 11L33 16L29 21L20 21L15 16Z"/><g class="g2"><circle cx="30" cy="7" r="1.8"/><circle cx="10" cy="17" r="1.8"/><circle cx="32" cy="24" r="1.8"/></g><ellipse class="g1" cx="24" cy="18" rx="2.6" ry="3.4"/><circle class="g1" cx="24" cy="13.6" r="1.9"/>' },
  { id: 'train-window', file: 'trainwindow', name: 'Train window', animated: true,
    glyph: '<path class="g1" d="M4 22q9-8 18-3t22-2v11H4z"/><circle class="g2" cx="15" cy="17" r="3.5"/><path class="g3" d="M4 27q14-3 40 0v2H4z"/><path class="ln" d="M33 8v20M29 9h8M4 11q14 6 29-2M33 9q6 3 11 1"/><rect class="ln" x="2.5" y="2.5" width="43" height="27" rx="6"/>' },
  { id: 'rainy-window', file: 'rainywindow', name: 'Rainy window', animated: true,
    glyph: '<circle class="g4" cx="34" cy="11" r="8" opacity=".45"/><circle class="g3" cx="12" cy="24" r="6" opacity=".4"/><path class="ln" d="M15 3v15M30 6v14" opacity=".5"/><circle class="g1" cx="15" cy="20.5" r="3.2"/><circle class="g1" cx="30" cy="22.5" r="3.6"/><g class="g2"><circle cx="7" cy="8" r="1.6"/><circle cx="23" cy="13" r="2"/><circle cx="41" cy="25" r="2"/><circle cx="23" cy="28" r="1.6"/><circle cx="40" cy="4" r="1.5"/></g>' },
  { id: 'dominoes', file: 'dominoes', name: 'Dominoes', animated: true,
    glyph: '<path class="ln" d="M2 29.5h44"/><path class="g1" d="M3 28l14-10.5 2.4 3.2L5.4 31.2z"/><path class="g2" d="M14 28l10-13 3.2 2.4-10 13z"/><rect class="g3" x="27" y="9" width="4" height="20" rx="1"/><rect class="g4" x="35" y="9" width="4" height="20" rx="1"/><rect class="g1" x="43" y="9" width="4" height="20" rx="1"/>' },
  { id: 'windmills', file: 'windmills', name: 'Windmills', animated: true,
    glyph: '<path class="g3" d="M2 31q12-9 24-4t20-3v7z" opacity=".55"/><path class="g1" d="M10 29l2.5-14h3L18 29z"/><path class="ln" d="M14 14L5 5M14 14l9-9M14 14l-9 9M14 14l9 9"/><path class="g2" d="M35 28l.8-17h1.4l.8 17z"/><path class="g4" d="M36.5 11l-1.5-10 2.2 9.6zM36.5 11l9 4.2-9.4-3.2zM36.5 11l-8.4 5.4 8-6z"/>' },
  { id: 'pegboard', file: 'pegboard', name: 'Pegboard', animated: true,
    glyph: '<g class="g4"><circle cx="24" cy="3" r="1.5"/><circle cx="20" cy="7" r="1.5"/><circle cx="28" cy="7" r="1.5"/><circle cx="16" cy="11" r="1.5"/><circle cx="24" cy="11" r="1.5"/><circle cx="32" cy="11" r="1.5"/></g><path class="ln" d="M8 18v13h32V18M16 22v9M24 22v9M32 22v9"/><g class="g1"><circle cx="20" cy="28" r="2.4"/><circle cx="28" cy="28" r="2.4"/><circle cx="20" cy="23.5" r="2.4"/></g><circle class="g2" cx="28" cy="23.5" r="2.4"/><circle class="g3" cx="12" cy="28" r="2.4"/><circle class="g2" cx="28" cy="15" r="2.4"/>' },
  { id: 'pong', file: 'pong', name: 'Pong', animated: true,
    glyph: '<path class="ln" d="M24 2v4M24 10v4M24 18v4M24 26v4" opacity=".45"/><path class="g1" d="M4 6h3.5v12H4z"/><path class="g2" d="M40.5 14h3.5v12h-3.5z"/><path class="g3" d="M30 9h4v4h-4z"/><path class="g3" d="M24.5 12.5h3v3h-3zM19.5 16h2.5v2.5h-2.5z" opacity=".45"/>' },
  { id: 'snake', file: 'snake', name: 'Snake', animated: true,
    glyph: '<path class="ln" d="M2 2h44v28H2z" opacity=".35"/><path class="g2" d="M7 21h5v5H7zM13 21h5v5h-5zM19 21h5v5h-5zM19 15h5v5h-5zM19 9h5v5h-5z" opacity=".7"/><path class="g1" d="M25 8h6v6h-6z"/><path class="g3" d="M37.5 9.5h4v4h-4z"/>' },
  { id: 'breakout', file: 'breakout', name: 'Breakout', animated: true,
    glyph: '<path class="g1" d="M3 3h9v4H3zM14 3h9v4h-9zM25 3h9v4h-9zM36 3h9v4h-9z"/><path class="g2" d="M3 9h9v4H3zM25 9h9v4h-9zM36 9h9v4h-9z"/><path class="g3" d="M14 15h9v4h-9zM36 15h9v4h-9z"/><circle class="g4" cx="18" cy="23" r="2.4"/><path class="ln" d="M12 29h14"/>' },
  { id: 'invaders', file: 'invaders', name: 'Invaders', animated: true,
    glyph: '<path class="g1" d="M6 3h8v2h2v4H4V5h2zM4 9h3v2H4zM13 9h3v2h-3zM20 3h8v2h2v4H18V5h2zM18 9h3v2h-3zM27 9h3v2h-3zM34 3h8v2h2v4H32V5h2zM32 9h3v2h-3zM41 9h3v2h-3z"/><path class="g2" d="M13 15h8v2h2v4H11v-4h2zM11 21h3v2h-3zM20 21h3v2h-3zM27 15h8v2h2v4H25v-4h2zM25 21h3v2h-3zM34 21h3v2h-3z"/><path class="g3" d="M22 26h4v2h3v3H19v-3h3z"/>' },
  { id: 'asteroids', file: 'asteroids', name: 'Asteroids', animated: true,
    glyph: '<path class="ln" d="M5 9l5-6h7l4 4-2 5 3 5-6 4-7-1-4-5zM33 4l6-1 5 4-1 6-5 2-5-3zM29 21l6-2 5 3 1 5-4 3-6-1-3-4z"/><path class="g1" d="M15 29l3.5-9 3.5 9-3.5-2.2z"/><circle class="g2" cx="23" cy="14" r="1.6"/><circle class="g3" cx="26" cy="8" r="1.6"/>' },
  { id: 'mandala', file: 'mandala', name: 'Mandala', animated: true,
    glyph: '<g class="g1" opacity=".8"><ellipse cx="24" cy="16" rx="10" ry="2.8"/><ellipse cx="24" cy="16" rx="10" ry="2.8" transform="rotate(45 24 16)"/><ellipse cx="24" cy="16" rx="10" ry="2.8" transform="rotate(90 24 16)"/><ellipse cx="24" cy="16" rx="10" ry="2.8" transform="rotate(135 24 16)"/></g><circle class="ln" cx="24" cy="16" r="12.3"/><circle class="ln" cx="24" cy="16" r="15" stroke-dasharray="0 4.7"/><circle class="g2" cx="24" cy="16" r="2.6"/>' },
  { id: 'sunflower', file: 'sunflower', name: 'Sunflower', animated: true,
    glyph: '<path class="g1" d="M40 16 33 18 37 24 31 23 32 29 26 25 24 32 22 25 16 29 17 23 11 24 15 18 8 16 15 14 11 8 17 9 16 3 22 7 24 0 26 7 32 3 31 9 37 8 33 14z"/><circle class="g3" cx="24" cy="16" r="9.6"/><path class="ln" d="M22.6 17.2h0M24.2 13.4h0M25.9 18.5h0M20.4 15.4h0M27.5 13.8h0M22.8 20.4h0M21.7 11.7h0M28.9 17.8h0M18.9 18.1h0M26.5 10.7h0M25.8 21.9h0M18.5 12.8h0M30.5 14.6h0M20 21.7h0M23.1 8.9h0M29.7 20.8h0M16.4 16.3h0M29.6 10.5h0M23.6 24.1h0M18.7 9.6h0"/>' },
  { id: 'truchet', file: 'truchet', name: 'Truchet', animated: true,
    glyph: '<circle class="g1" cx="16" cy="16" r="8" opacity=".6"/><path class="g3" d="M48 24v8h-8a8 8 0 0 1 8-8z" opacity=".6"/><path class="ln" d="M8 0A8 8 0 0 1 0 8M8 16A8 8 0 0 1 16 8M24 0A8 8 0 0 0 32 8M24 16A8 8 0 0 0 16 8M40 0A8 8 0 0 0 48 8M40 16A8 8 0 0 0 32 8M8 16A8 8 0 0 0 16 24M8 32A8 8 0 0 0 0 24M24 16A8 8 0 0 1 16 24M24 32A8 8 0 0 1 32 24M40 16A8 8 0 0 1 32 24M40 32A8 8 0 0 1 48 24"/>' },
  { id: 'weave', file: 'weave', name: 'Weave', animated: true,
    glyph: '<path class="ln" d="M4 0v8M12 0v8M20 0v8M28 0v8M36 0v8M44 0v8" opacity=".5"/><path class="g3" d="M0 9.5h48v5H0zM0 17.5h48v5H0zM0 25.5h48v5H0z"/><path class="g1" d="M1.5 16.8h5v6.4h-5zM9.5 8.8h5v6.4h-5zM9.5 24.8h5v6.4h-5zM17.5 16.8h5v6.4h-5zM25.5 8.8h5v6.4h-5zM25.5 24.8h5v6.4h-5zM33.5 16.8h5v6.4h-5zM41.5 8.8h5v6.4h-5zM41.5 24.8h5v6.4h-5z"/><path class="g2" d="M30 6l7-3 7 3-7 3z"/>' },
  { id: 'brushstrokes', file: 'brushstrokes', name: 'Brushstrokes', animated: true,
    glyph: '<path class="g1" d="M3 20C10 12 22 8 38 7l.5 5C24 13 14 18 7 27z"/><path class="ln" d="M38 7.5l8-1.5M39 9.8h7M38.5 12l7 1.5" opacity=".7"/><path class="g3" d="M10 30c8-4 18-6 28-5l-.5 4c-9-1-18 0-27.5 3z" opacity=".75"/><path class="g2" d="M4 7c6-3 13-4 20-3l-.5 3c-7-1-13 0-18.5 2.5z" opacity=".8"/>' },
  { id: 'word-hunt', file: 'wordhunt', name: 'Word hunt', animated: true,
    glyph: '<rect class="g1" x="9.5" y="2.5" width="36" height="9" rx="4.5" opacity=".6"/><rect class="g2" x=".5" y="2.5" width="9" height="27" rx="4.5" opacity=".6"/><rect class="g3" x="16.6" y="16" width="21.8" height="9" rx="4.5" transform="rotate(45 27.5 20.5)" opacity=".6"/><path class="ln" d="M5 7h0M14 7h0M23 7h0M32 7h0M41 7h0M5 16h0M14 16h0M23 16h0M32 16h0M41 16h0M5 25h0M14 25h0M23 25h0M32 25h0M41 25h0" stroke-width="2.6"/>' },
  { id: 'anagrams', file: 'anagrams', name: 'Anagrams', animated: true,
    glyph: '<rect class="g1" x="3" y="17" width="12" height="12" rx="2.6"/><rect class="g2" x="18" y="17" width="12" height="12" rx="2.6"/><rect class="g3" x="33" y="17" width="12" height="12" rx="2.6" opacity=".45"/><rect class="g3" x="24" y="2" width="12" height="12" rx="2.6" transform="rotate(-14 30 8)"/><path class="ln" d="M9 13C10 6 15 4 20 6"/><path class="ln" d="M17 3l3 3-4 2"/>' },
  { id: 'word-swarm', file: 'wordswarm', name: 'Word swarm', animated: true,
    glyph: '<path class="g1" d="M22.4 26.4h3.2v3.2h-3.2zM24.2 21.6h3.2v3.2h-3.2zM26 16.8h3.2v3.2h-3.2zM27.8 12h3.2v3.2h-3.2zM29.6 7.2h3.2v3.2h-3.2zM31.4 2.4h3.2v3.2h-3.2z"/><path class="g2" d="M33.2 7.2h3.2v3.2h-3.2zM35.2 12h3.2v3.2h-3.2zM37.3 16.8h3.2v3.2h-3.2zM39.4 21.6h3.2v3.2h-3.2zM41.4 26.4h3.2v3.2h-3.2z"/><path class="g3" d="M32.2 17.9h3.2v3.2h-3.2zM29 17.9h3.2v3.2h-3.2zM35.8 17.9h3.2v3.2h-3.2z"/><path class="g4" opacity=".7" d="M2.7 5.7h2.6v2.6h-2.6zM8.7 22.7h2.6v2.6h-2.6zM11.7 11.7h2.6v2.6h-2.6zM15.7 2.7h2.6v2.6h-2.6zM15.7 25.7h2.6v2.6h-2.6zM4.7 16.7h2.6v2.6h-2.6z"/>' },
  { id: 'neon', file: 'neon', name: 'Neon', animated: true,
    glyph: '<path class="g1" opacity=".3" d="M15 29C3 21 1 14 4 9s10-5 11 1c1-6 8-6 11-1s1 12-11 20z"/><path class="ln" d="M15 26C6 20 4 14 6.5 10.5S13 8 15 12c2-4 6-5 8.5-1.5S24 20 15 26z"/><path class="g2" opacity=".35" d="M37 1l3.5 8 8 .6-6 5.4 2 8.5-7.5-4.5-7.5 4.5 2-8.5-6-5.4 8-.6z"/><path class="ln" d="M37 5l2.4 5.4 5.6.5-4.3 3.8 1.3 5.8-5-3.1-5 3.1 1.3-5.8-4.3-3.8 5.6-.5z"/>' },
  { id: 'interference', file: 'interference', name: 'Interference', animated: true,
    glyph: '<circle class="ln" cx="15" cy="16" r="5"/><circle class="ln" cx="15" cy="16" r="10" opacity=".8"/><circle class="ln" cx="15" cy="16" r="15" opacity=".55"/><circle class="ln" cx="33" cy="16" r="5"/><circle class="ln" cx="33" cy="16" r="10" opacity=".8"/><circle class="ln" cx="33" cy="16" r="15" opacity=".55"/><circle class="g1" cx="15" cy="16" r="2.4"/><circle class="g2" cx="33" cy="16" r="2.4"/>' },
  { id: 'iron-filings', file: 'filings', name: 'Iron filings', animated: true,
    glyph: '<path class="g1" d="M24 13h9a3 3 0 0 1 0 6h-9z"/><path class="g3" d="M24 13h-9a3 3 0 0 0 0 6h9z"/><path class="ln" d="M6 10l4-3M14 5.5h5M29 5.5h5M38 7l4 3M4 14v4M44 14v4M6 26l4 3M14 30.5h5M29 30.5h5M38 29l4-3M16 10l3-1.5M29 8.5l3 1.5M16 22l3 1.5M29 23.5l3-1.5"/>' },
  { id: 'double-pendulum', file: 'doublependulum', name: 'Double pendulum', animated: true,
    glyph: '<path class="ln" d="M5 27c3-13 12-7 17-3s12 6 15-4 6-12 9-6" opacity=".45"/><path class="ln" d="M24 3l-9 10 14 8"/><circle class="g4" cx="24" cy="3" r="2"/><circle class="g2" cx="15" cy="13" r="3.2"/><circle class="g1" cx="29" cy="21" r="4.2"/>' },
  { id: 'equalizer', file: 'equalizer', name: 'Equalizer', animated: true,
    glyph: '<path class="g1" d="M3 27h6v4H3zM3 21.5h6v4H3zM12 27h6v4h-6zM12 21.5h6v4h-6zM21 27h6v4h-6zM21 21.5h6v4h-6zM30 27h6v4h-6zM30 21.5h6v4h-6zM39 27h6v4h-6zM39 21.5h6v4h-6z"/><path class="g3" d="M3 16h6v4H3zM3 10.5h6v4H3zM12 16h6v4h-6zM12 10.5h6v4h-6zM30 16h6v4h-6zM30 10.5h6v4h-6zM39 16h6v4h-6z"/><path class="g2" d="M12 5h6v4h-6z"/><path class="ln" d="M3 6.5h6M12 2.5h6M21 13h6M30 7h6M39 12.5h6"/>' },
  { id: 'meteors', file: 'meteors', name: 'Meteors', animated: true,
    glyph: '<path class="g1" d="M5 4l19 11.5-2 2.6z" opacity=".55"/><path class="g3" d="M27 3l17 11-1.8 2.4z" opacity=".55"/><circle class="g1" cx="23" cy="17" r="2.6"/><circle class="g3" cx="43" cy="15.8" r="2.2"/><g class="g2"><circle cx="6" cy="24" r="1.5"/><circle cx="16" cy="29" r="1.2"/><circle cx="33" cy="26" r="1.6"/><circle cx="44" cy="28" r="1.2"/><circle cx="40" cy="4" r="1.2"/></g>' },
  { id: 'marbling', file: 'marbling', name: 'Marbling', animated: true,
    glyph: '<path class="g1" d="M2 3h44v8l-5.5-5-5.5 5-5.5-5-5.5 5-5.5-5-5.5 5-5.5-5L2 11z"/><path class="g3" d="M2 14l5.5-5 5.5 5 5.5-5 5.5 5 5.5-5 5.5 5 5.5-5 5.5 5v5H2z"/><circle class="g2" cx="14" cy="25.5" r="5"/><circle class="g4" cx="14" cy="25.5" r="2.4"/><circle class="g2" cx="35" cy="25.5" r="4.5"/>' },
  { id: 'sunbeams', file: 'sunbeams', name: 'Sunbeams', animated: true,
    glyph: '<path class="g1" d="M7 4h7l13 28h-8zM23 4h6l13 28h-7z" opacity=".55"/><path class="g2" d="M0 0h48v5c-4 3-8 0-11 2s-8 3-12 0-9 2-13 0-7 1-12-1z"/><circle class="g3" cx="20" cy="18" r="1.8"/><circle class="g3" cx="36" cy="25" r="1.8"/><circle class="g4" cx="11" cy="24" r="1.8"/>' },
  { id: 'day-night', file: 'daynight', name: 'Day and night', animated: true,
    glyph: '<circle class="g2" cx="12" cy="13" r="5.5"/><path class="g3" d="M38 4a6.5 6.5 0 1 0 6.5 8.5 5 5 0 0 1-6.5-8.5z"/><circle class="g4" cx="26" cy="6" r="1.5"/><circle class="g4" cx="30" cy="15" r="1.5"/><path class="g1" d="M0 32V24q12-9 24-3t24-4v15z"/>' },
  { id: 'shoreline', file: 'shoreline', name: 'Shoreline', animated: true,
    glyph: '<path class="g1" d="M0 0h48v13q-6 4-12 1t-12 1-12-1-12 2z"/><path class="ln" d="M0 6q8-3 16 0t16 0 16 0M0 15q6-3 12-1t12-1 12 1 12-2"/><path class="g2" d="M0 19q6-3 12-1t12-1 12 1 12-2v5q-6 3-12 1t-12 1-12-1-12 2z" opacity=".5"/><circle class="g3" cx="10" cy="28" r="1.8"/><circle class="g4" cx="34" cy="27" r="1.8"/>' },
  { id: 'zen-garden', file: 'zengarden', name: 'Zen garden', animated: true,
    glyph: '<path class="ln" d="M0 4h48M0 9h22M38 9h10M0 28h48M0 23h7M23 23h25"/><circle class="ln" cx="30" cy="12" r="6.5"/><circle class="ln" cx="15" cy="20" r="6.5"/><circle class="g1" cx="30" cy="12" r="3"/><circle class="g2" cx="15" cy="20" r="3"/><path class="g3" d="M38 18h9v2.5h-9zM41.5 20.5l-3 9h2.5l3-9z"/>' },
  { id: 'frost', file: 'frost', name: 'Frost', animated: true,
    glyph: '<rect class="g1" x="1" y="1" width="46" height="30" rx="2" opacity=".3"/><path class="ln" d="M2 30l13-13M6 26l-3-6M10 22l-6-3M10 22l2 6M6 26l5 3M46 2L33 15M42 6l3 6M38 10l6 3M38 10l-2-6M42 6l-5-3"/><path class="ln" d="M28 9v10M23.7 11.5l8.6 5M23.7 16.5l8.6-5" stroke-width="1.5"/>' },
  { id: 'hanoi', file: 'hanoi', name: 'Tower of Hanoi', animated: true,
    glyph: '<path class="ln" d="M3 29.5h42M10 29V10M24 29V10M38 29V10"/><rect class="g1" x="2" y="23.5" width="16" height="5" rx="2"/><rect class="g2" x="4.5" y="18" width="11" height="5" rx="2"/><rect class="g3" x="31" y="23.5" width="14" height="5" rx="2"/><rect class="g4" x="19.5" y="3.5" width="9" height="5" rx="2" opacity=".75"/>' },
  { id: 'slide-puzzle', file: 'slidepuzzle', name: 'Slide puzzle', animated: true,
    glyph: '<rect class="ln" x="10" y="1" width="29" height="30" rx="3"/><path class="g1" d="M12.5 4h7.5v7.5h-7.5zM21 4h7.5v7.5H21zM29.5 4h7.5v7.5h-7.5z"/><path class="g2" d="M12.5 12.5h7.5v7.5h-7.5zM21 12.5h7.5v7.5H21zM29.5 12.5h7.5v7.5h-7.5z"/><path class="g3" d="M12.5 21h7.5v7.5h-7.5z"/><path class="g4" d="M25 21h7.5v7.5H25z"/>' },
  { id: 'sorting', file: 'sorting', name: 'Sorting', animated: true,
    glyph: '<path class="g1" d="M4 26h4v4H4zM10 22h4v8h-4zM16 18h4v12h-4z" opacity=".6"/><path class="g2" d="M22 6h4v24h-4zM40 14h4v16h-4z" opacity=".6"/><path class="g3" d="M28 10h4v20h-4zM34 20h4v10h-4z"/><path class="ln" d="M30 6.5q6-5 6 9"/>' },
  { id: 'abacus', file: 'abacus', name: 'Abacus', animated: true,
    glyph: '<path class="ln" d="M12 2v28M24 2v28M36 2v28" opacity=".45"/><rect class="ln" x="3" y="1.5" width="42" height="29" rx="2.5"/><path class="ln" d="M3 11h42"/><path class="g1" d="M7.5 8.5l2-2h5l2 2-2 2h-5zm12-4l2-2h5l2 2-2 2h-5zm12 4l2-2h5l2 2-2 2h-5z"/><path class="g2" d="M7.5 14l2-2h5l2 2-2 2h-5zm0 4l2-2h5l2 2-2 2h-5zm24-4l2-2h5l2 2-2 2h-5zm0 4l2-2h5l2 2-2 2h-5zm0 4l2-2h5l2 2-2 2h-5z"/><path class="g3" d="M7.5 23.5l2-2h5l2 2-2 2h-5zm0 4l2-2h5l2 2-2 2h-5zm12-12l2-2h5l2 2-2 2h-5zm0 4l2-2h5l2 2-2 2h-5zm0 4l2-2h5l2 2-2 2h-5zm0 4l2-2h5l2 2-2 2h-5zm12 0l2-2h5l2 2-2 2h-5z" opacity=".55"/>' },
  { id: 'sudoku', file: 'sudoku', name: 'Sudoku', animated: true,
    glyph: '<path class="ln" d="M19 1.5v29M29 1.5v29M9 11.2h30M9 20.8h30" opacity=".45"/><rect class="ln" x="9" y="1.5" width="30" height="29" rx="2"/><rect class="g2" x="19.8" y="12" width="8.4" height="8" rx="1.5" opacity=".55"/><path class="ln" d="M21.5 13.8h5l-3 5.4M14 23v6"/><path class="g1" d="M30.5 22.5h7v6.5h-7z" opacity=".6"/><g class="g3"><circle cx="31.8" cy="4.5" r="1.3"/><circle cx="36.2" cy="4.5" r="1.3"/><circle cx="31.8" cy="8.2" r="1.3"/></g><path class="g4" d="M10.5 3h7v6.5h-7z" opacity=".6"/>' },
  { id: 'dna', file: 'dna', name: 'DNA', animated: true,
    glyph: '<path class="g1" d="M5 10h2v6H5zM37 10h2v6h-2z"/><path class="g2" d="M5 16h2v6H5zM37 16h2v6h-2zM21 8h2v8h-2z"/><path class="g3" d="M17 10h2v6h-2zM25 16h2v6h-2z"/><path class="g4" d="M17 16h2v6h-2zM25 10h2v6h-2z"/><path class="g1" d="M21 16h2v8h-2z"/><path class="ln" d="M2 8c6 0 14 16 20 16s14-16 20-16M2 24c6 0 14-16 20-16s14 16 20 16" stroke-width="2"/>' },
  { id: 'molecules', file: 'molecules', name: 'Molecules', animated: true,
    glyph: '<path class="ln" d="M15 17L7 9M15 17L6 25M15 17h11M26 17l9-9M26 17l9 9" stroke-width="2"/><path class="ln" d="M37.5 23.5l4-4" stroke-dasharray="1.5 2.5"/><circle class="g1" cx="15" cy="17" r="5.5"/><circle class="g2" cx="26" cy="17" r="5"/><circle class="g3" cx="7" cy="9" r="3.2"/><circle class="g3" cx="6" cy="25" r="3.2"/><circle class="g4" cx="35" cy="8" r="3.2"/><circle class="g4" cx="35" cy="26" r="3.2"/><circle class="g1" cx="44" cy="17" r="3"/>' },
  { id: 'cells', file: 'cells', name: 'Cells', animated: true,
    glyph: '<circle class="g1" cx="27" cy="13" r="7"/><circle class="g1" cx="37.5" cy="13" r="7"/><circle class="g3" cx="26" cy="13" r="2.6"/><circle class="g3" cx="38.5" cy="13" r="2.6"/><circle class="g2" cx="11" cy="18" r="8.5"/><circle class="g4" cx="11.5" cy="17.5" r="3.2"/><circle class="g4" cx="31" cy="27" r="4.5"/><circle class="g2" cx="31" cy="27" r="1.8"/>' },
  { id: 'chladni', file: 'chladni', name: 'Chladni', animated: true,
    glyph: '<rect class="ln" x="8" y="1" width="32" height="30" opacity=".45"/><g class="ln" stroke-width="2" stroke-dasharray="0 3"><circle cx="24" cy="16" r="7"/><path d="M8 9q8 0 9-8M40 9q-8 0-9-8M8 23q8 0 9 8M40 23q-8 0-9 8"/></g><circle class="g1" cx="17" cy="16" r="1.6"/><circle class="g2" cx="31" cy="16" r="1.6"/><circle class="g3" cx="24" cy="9" r="1.6"/><circle class="g4" cx="24" cy="23" r="1.6"/>' },
  { id: 'cloud-chamber', file: 'cloudchamber', name: 'Cloud chamber', animated: true,
    glyph: '<path class="ln" d="M2 29L46 5"/><path class="ln" d="M30 21c4-2 9-1 9 4s-6 6-8 3 1-6 4-4 1 4-1 3" opacity=".85"/><path class="ln" d="M4 3l9 8M13 11l3 9M13 11l9 2" opacity=".85"/><circle class="g1" cx="13" cy="11" r="2"/><circle class="g2" cx="35" cy="26.3" r="1.6"/><circle class="g3" cx="40" cy="31" r="1.6"/><circle class="g4" cx="45" cy="17" r="1.6"/>' },
  { id: 'chess', file: 'chess', name: 'Chess', animated: true,
    glyph: '<path class="g4" d="M3 2h7v7H3zM17 2h7v7h-7zM31 2h7v7h-7zM10 9h7v7h-7zM24 9h7v7h-7zM38 9h7v7h-7zM3 16h7v7H3zM17 16h7v7h-7zM31 16h7v7h-7zM10 23h7v7h-7zM24 23h7v7h-7zM38 23h7v7h-7z" opacity=".3"/><path class="ln" d="M3 2h42v28H3z" opacity=".45"/><g class="g1"><circle cx="13.5" cy="12" r="3.4"/><path d="M11 15.5h5l3 9H8zM7.5 25h12v3.5h-12z"/></g><path class="g2" d="M27 28.5c0-5 1.5-7 4-10-3 .8-6 1-7-1s2-5 5-7l1.5-4.5 2.5 3.5c6 0 10 6 9.5 19z"/>' },
  { id: 'reversi', file: 'reversi', name: 'Reversi', animated: true,
    glyph: '<path class="ln" d="M4 1v30M14 1v30M24 1v30M34 1v30M44 1v30M4 1h40M4 11h40M4 21h40M4 31h40" opacity=".3"/><g class="g1"><circle cx="9" cy="6" r="3.4"/><circle cx="29" cy="6" r="3.4"/><circle cx="19" cy="16" r="3.4"/><circle cx="39" cy="16" r="3.4"/><circle cx="29" cy="26" r="3.4"/><ellipse cx="29" cy="16" rx="1.4" ry="3.4"/></g><g class="g2"><circle cx="19" cy="6" r="3.4"/><circle cx="9" cy="16" r="3.4"/><circle cx="39" cy="26" r="3.4"/><circle cx="19" cy="26" r="3.4"/></g>' },
  { id: 'card-cascade', file: 'cardcascade', name: 'Card cascade', animated: true,
    glyph: '<rect class="g1" x="38" y="2" width="8" height="11" rx="1.5"/><g class="g2"><path opacity=".4" d="M33 3h8v11h-8z"/><path opacity=".4" d="M29 5h8v11h-8z"/><path opacity=".4" d="M25 9h8v11h-8z"/><path opacity=".4" d="M21.5 14h8v11h-8z"/><path opacity=".4" d="M18 20h8v11h-8z"/><path opacity=".4" d="M14.5 16h8v11h-8z"/><path opacity=".4" d="M11 13h8v11h-8z"/><path opacity=".4" d="M7.5 12h8v11h-8z"/><rect x="3.5" y="12" width="8" height="11" rx="1.5"/></g><path class="ln" d="M2 31.5h44" opacity=".4"/>' },
  { id: 'dice', file: 'dice', name: 'Dice', animated: true,
    glyph: '<rect class="g1" x="4" y="9" width="17" height="17" rx="3.5"/><path class="ln" d="M8.5 13.5h0M16.5 13.5h0M12.5 17.5h0M8.5 21.5h0M16.5 21.5h0" stroke-width="3.2"/><g transform="rotate(22 34 15)"><rect class="g2" x="26" y="7" width="16" height="16" rx="3.5"/><path class="ln" d="M30 11h0M34 15h0M38 19h0" stroke-width="3.2"/></g><path class="ln" d="M2 30.5h44" opacity=".4"/>' },
  { id: 'pinball', file: 'pinball', name: 'Pinball', animated: true,
    glyph: '<path class="ln" d="M9 31V16a15 15 0 0 1 30 0v15M34.5 31V18M9 22l5 3M34.5 22l-5 3" opacity=".55"/><path class="ln" d="M14.5 25.5l5 3M29 25.5l-5 3" stroke-width="3"/><circle class="g1" cx="18" cy="12" r="3.4"/><circle class="g2" cx="28" cy="11" r="3.4"/><circle class="g3" cx="23" cy="18.5" r="3.4"/><circle class="g4" cx="27" cy="23" r="1.9"/>' },
  { id: 'pipes', file: 'pipes', name: 'Pipes', animated: true,
    glyph: '<path class="g1" d="M3 21.5h17v5H3zM17.5 8h5v16h-5zM20 5.5h14v5H20z"/><g class="g1"><circle cx="20" cy="24" r="4"/><circle cx="20" cy="8" r="4"/></g><path class="g2" d="M38.5 15h5v15h-5zM27 12.5h14v5H27z"/><g class="g2"><circle cx="41" cy="15" r="4"/><circle cx="27.5" cy="15" r="3.4"/></g><circle class="g3" cx="34" cy="8" r="3.4"/>' },
  { id: 'mystify', file: 'mystify', name: 'Mystify', animated: true,
    glyph: '<path class="g1" fill-rule="evenodd" opacity=".4" d="M8 9L26 6L23 20L11 16zM12 15L22 18L24 8L10 10z"/><path class="g1" fill-rule="evenodd" d="M4 6L22 3L19 17L7 13zM8 12L18 15L20 5L6 7z"/><path class="g2" fill-rule="evenodd" opacity=".4" d="M22 23L40 14L36 25L26 26zM26 24L35 24L37 17L25 23z"/><path class="g2" fill-rule="evenodd" d="M26 27L44 18L40 29L30 30zM30 28L39 28L41 21L29 27z"/>' },
  { id: 'light-cycles', file: 'lightcycles', name: 'Light cycles', animated: true,
    glyph: '<path class="ln" opacity=".28" d="M2 16h44M16 2v28M32 2v28"/><path class="g1" d="M3 22.8h19v2.4H3zM19.6 10h2.4v15h-2.4zM19.6 8.8h12v2.4h-12z" opacity=".75"/><rect class="g1" x="31" y="7.5" width="8" height="5" rx="2.5"/><path class="g2" d="M45 26.8H32v2.4h13zM42.6 17H45v12h-2.4z" opacity=".75"/><rect class="g2" x="24.5" y="25.5" width="8" height="5" rx="2.5"/>' },
  { id: 'maze-chase', file: 'mazechase', name: 'Maze chase', animated: true,
    glyph: '<path class="ln" opacity=".5" d="M2 6h44M2 26h44"/><path class="g1" d="M13 16l5.2-3a6 6 0 1 0 0 6z"/><path class="g4" d="M23 14.8h2.4v2.4H23zM28.5 14.8h2.4v2.4h-2.4z"/><path class="g2" fill-rule="evenodd" d="M35 22v-7a5.5 5.5 0 0 1 11 0v7zM37 15a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0zM41 15a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z"/>' },
  { id: 'ticker', file: 'ticker', name: 'Ticker', animated: true,
    glyph: '<path class="ln" opacity=".35" d="M1.5 3.5h45v25h-45z"/><path class="g1" d="M17 6h2v2H17zM14 9h2v2H14zM17 9h2v2H17zM11 12h2v2H11zM17 12h2v2H17zM8 15h2v2H8zM17 15h2v2H17zM8 18h2v2H8zM11 18h2v2H11zM14 18h2v2H14zM17 18h2v2H17zM20 18h2v2H20zM17 21h2v2H17zM17 24h2v2H17z"/><path class="g2" d="M29 6h2v2H29zM32 6h2v2H32zM35 6h2v2H35zM26 9h2v2H26zM38 9h2v2H38zM38 12h2v2H38zM35 15h2v2H35zM32 18h2v2H32zM29 21h2v2H29zM26 24h2v2H26zM29 24h2v2H29zM32 24h2v2H32zM35 24h2v2H35zM38 24h2v2H38z"/>' },
  { id: 'planet', file: 'planet', name: 'Planet', animated: true,
    glyph: '<path class="ln" d="M3 17a21 6 0 0 1 42 0" opacity=".5"/><circle class="g1" cx="24" cy="15" r="10"/><path class="g3" d="M14.3 12.5h19.4V15H14.3zM15.5 18h17v2.2h-17z" opacity=".7"/><path class="ln" d="M3 17a21 6 0 0 0 42 0"/><circle class="g2" cx="41" cy="5" r="2.6"/>' },
  { id: 'black-hole', file: 'blackhole', name: 'Black hole', animated: true,
    glyph: '<path class="g3" d="M9 17a15 12.5 0 0 1 30 0h-5.5a9.5 8.5 0 0 0-19 0z" opacity=".75"/><circle class="ln" cx="24" cy="17" r="6.5"/><ellipse class="g1" cx="24" cy="18.5" rx="22" ry="3.2"/><ellipse class="g3" cx="24" cy="18.5" rx="10" ry="1.4"/><circle class="g2" cx="6" cy="6" r="1.5"/><circle class="g4" cx="42" cy="27" r="1.5"/>' },
  { id: 'moon-phases', file: 'moonphases', name: 'Moon phases', animated: true,
    glyph: '<circle class="g4" cx="6.5" cy="22" r="4.5" opacity=".35"/><circle class="g2" cx="17.5" cy="13" r="4.5" opacity=".3"/><path class="g2" d="M17.5 8.5a4.5 4.5 0 0 1 0 9a1.6 4.5 0 0 0 0-9z"/><circle class="g3" cx="30" cy="10" r="4.5" opacity=".3"/><path class="g3" d="M30 5.5a4.5 4.5 0 0 1 0 9z"/><circle class="g1" cx="41.5" cy="16" r="4.5"/><path class="g4" d="M0 32c10-4 18-5 26-3s14 0 22-2v5z" opacity=".5"/>' },
  { id: 'kites', file: 'kites', name: 'Kites', animated: true,
    glyph: '<path class="ln" d="M14 10Q30 22 46 31M37 9q6 10 9 22" opacity=".45"/><path class="g1" d="M14 2 8 9l6 11z"/><path class="g3" d="M14 2l6 7-6 11z"/><path class="ln" d="M14 20q-3 3 0 5.5t0 6"/><path class="g2" d="M36 2l-8 11 8-2z"/><path class="g4" d="M36 2l8 11-8-2z"/><path class="ln" d="M36 11q-4 2-3 5.5t-4 5"/>' },
  { id: 'balloons', file: 'balloons', name: 'Hot air balloons', animated: true,
    glyph: '<path class="g4" d="M0 32c10-5 22-6 30-3s12 0 18-2v5z" opacity=".45"/><path class="g1" d="M8 12a9 9 0 0 1 18 0c0 5-5 8-6 11h-6c-1-3-6-6-6-11z"/><path class="g3" d="M17 3c-4 4-4 14-2.5 20h5c1.5-6 1.5-16-2.5-20z"/><path class="ln" d="M14.5 23v2.5M19.5 23v2.5"/><path class="g4" d="M14 25.5h6v3.5h-6z"/><path class="g2" d="M32 8a5 5 0 0 1 10 0c0 3-3 4.5-3.5 6h-3c-.5-1.5-3.5-3-3.5-6z"/><path class="g4" d="M35.5 15.5h3v2h-3z"/>' },
  { id: 'moire', file: 'moire', name: 'Moire', animated: true,
    glyph: '<path class="g1" d="M1 0h3v32h-3zM7 0h3v32h-3zM13 0h3v32h-3zM19 0h3v32h-3zM25 0h3v32h-3zM31 0h3v32h-3zM37 0h3v32h-3zM43 0h3v32h-3z"/><path class="g2" opacity=".75" transform="rotate(-12 24 16)" d="M-8 -8h3v48h-3zM-2 -8h3v48h-3zM4 -8h3v48h-3zM10 -8h3v48h-3zM16 -8h3v48h-3zM22 -8h3v48h-3zM28 -8h3v48h-3zM34 -8h3v48h-3zM40 -8h3v48h-3zM46 -8h3v48h-3zM52 -8h3v48h-3zM58 -8h3v48h-3z"/>' },
  { id: 'chaos-game', file: 'chaosgame', name: 'Chaos game', animated: true,
    glyph: '<path class="g1" d="M24 3l3.8 6.5h-7.5zM20.2 9.5l3.8 6.5h-7.5zM27.8 9.5l3.8 6.5h-7.5z"/><path class="g2" d="M16.5 16l3.8 6.5h-7.5zM12.8 22.5l3.8 6.5h-7.5zM20.2 22.5l3.8 6.5h-7.5z"/><path class="g3" d="M31.5 16l3.8 6.5h-7.5zM27.8 22.5l3.8 6.5h-7.5zM35.2 22.5l3.8 6.5h-7.5z"/>' },
  { id: 'attractor', file: 'attractor', name: 'Attractor', animated: true,
    glyph: '<path class="ln" opacity=".45" d="M24 16C19 8 9 3 5 9s1 15 7 13 9-5 12-6 9-11 15-8 4 12-1 14-8-3-14-6"/><path class="ln" opacity=".3" d="M24 16C20 11 13 8 10 11s0 9 4 8 7-2 10-3 6-7 10-5 2 8-2 9-6-2-10-4"/><circle class="g1" cx="5" cy="9" r="2.6"/><circle class="g2" cx="39" cy="10" r="2.6"/><circle class="g3" cx="24" cy="16" r="2.6"/><circle class="g4" cx="13" cy="22" r="2.2"/>' },
  { id: 'dragon-curve', file: 'dragoncurve', name: 'Dragon curve', animated: true,
    glyph: '<path class="ln" d="M33.4 12.1h5.1v-5.1h-5.1v-5.1h-5.1v5.1h-5.1v-5.1h-5.1v5.1h5.1v5.1h-5.1v5.1h-5.1v-5.1"/><path class="ln" opacity=".45" d="M27.4 26.4l3.6 3.6l3.6 -3.6l-3.6 -3.6l3.6 -3.6l-3.6 -3.6l-3.6 3.6l-3.6 -3.6l3.6 -3.6l-3.6 -3.6l-3.6 3.6l3.6 3.6l-3.6 3.6l-3.6 -3.6l-3.6 3.6l-3.6 -3.6l3.6 -3.6"/><circle class="g1" cx="13.1" cy="12.1" r="2.6"/>' },
  { id: 'automaton', file: 'automaton', name: 'Automaton', animated: true,
    glyph: '<path class="g1" d="M22.4 4h4.2v4.2h-4.2zM2.4 24h4.2v4.2h-4.2zM7.4 24h4.2v4.2h-4.2zM22.4 24h4.2v4.2h-4.2zM42.4 24h4.2v4.2h-4.2z"/><path class="g2" d="M17.4 9h4.2v4.2h-4.2zM22.4 9h4.2v4.2h-4.2zM27.4 9h4.2v4.2h-4.2z"/><path class="g3" d="M12.4 14h4.2v4.2h-4.2zM17.4 14h4.2v4.2h-4.2zM32.4 14h4.2v4.2h-4.2z"/><path class="g4" d="M7.4 19h4.2v4.2h-4.2zM12.4 19h4.2v4.2h-4.2zM22.4 19h4.2v4.2h-4.2zM27.4 19h4.2v4.2h-4.2zM32.4 19h4.2v4.2h-4.2zM37.4 19h4.2v4.2h-4.2z"/>' },
  { id: 'newtons-cradle', file: 'newtonscradle', name: 'Newton\'s cradle', animated: true,
    glyph: '<path class="ln" d="M2 3h44.5M2 3v25M46.5 3v25M1 29.5h46.5"/><path class="ln" d="M12 3v14M18 3v14M24 3v14M30 3v14M36 3l4.8 13.2" opacity=".55"/><circle class="g1" cx="12" cy="20" r="3"/><circle class="g2" cx="18" cy="20" r="3"/><circle class="g3" cx="24" cy="20" r="3"/><circle class="g4" cx="30" cy="20" r="3"/><circle class="g1" cx="41.8" cy="19" r="3"/>' },
  { id: 'metronomes', file: 'metronomes', name: 'Metronomes', animated: true,
    glyph: '<path class="g1" d="M4 30h12l-3.5-22h-5z"/><path class="g2" d="M18 30h12l-3.5-22h-5z"/><path class="g3" d="M32 30h12l-3.5-22h-5z"/><path class="ln" d="M10 27L1.8 4.5M24 27l2.4-23.9M38 27l7.1-22.9M1 31.2h46"/><circle class="g4" cx="4.7" cy="12.4" r="2.3"/><circle class="g4" cx="25.6" cy="11.5" r="2.3"/><circle class="g4" cx="42.6" cy="11.8" r="2.3"/>' },
  { id: 'slinky', file: 'slinky', name: 'Slinky', animated: true,
    glyph: '<path class="ln" d="M1 15h14v7h12v7h20"/><path class="ln" d="M6.4 7.9L11.2 8.0M8.3 3.4L11.7 6.8M12.4 1.4L13.1 6.2M16.6 1.9L15.0 6.4M20.1 4.2L16.7 7.6M22.4 7.4L18.0 9.4M23.4 11.1L18.7 11.7M23.5 14.6L18.7 14.3" opacity=".75"/><g class="g1"><ellipse cx="9" cy="13.2" rx="4" ry="1.4"/><ellipse cx="21" cy="20.2" rx="4" ry="1.4"/><ellipse cx="34" cy="27.2" rx="4" ry="1.4"/></g><g class="g2"><ellipse cx="9" cy="10.4" rx="4" ry="1.4"/><ellipse cx="21" cy="17.4" rx="4" ry="1.4"/><ellipse cx="34" cy="24.4" rx="4" ry="1.4"/></g><ellipse class="g3" cx="34" cy="21.6" rx="4" ry="1.4"/>' },
  { id: 'marble-run', file: 'marblerun', name: 'Marble run', animated: true,
    glyph: '<path class="ln" d="M41 4v26M46 4v26M38 6.5L4 11M8 13l29 6.5M33 23L4 28.5M4 9v4M37 17v4" opacity=".6"/><path class="ln" d="M40.5 12h6M40.5 19h6M40.5 26h6"/><circle class="g1" cx="43.5" cy="9.5" r="2.4"/><circle class="g2" cx="43.5" cy="23.5" r="2.4"/><circle class="g3" cx="22" cy="5.5" r="2.4"/><circle class="g4" cx="18" cy="12.3" r="2.4"/><circle class="g1" cx="34.5" cy="15.8" r="2.4"/><circle class="g3" cx="14" cy="23.5" r="2.4"/>' },
  { id: 'hourglass', file: 'hourglass', name: 'Hourglass', animated: true,
    glyph: '<g transform="translate(7 0)"><path class="g1" d="M6 2h22v2.6H6zM6 27.4h22V30H6z"/><path class="ln" d="M9 4.6c0 6 6.4 8 7.4 11.4C15.4 19.4 9 21.4 9 27.4h16c0-6-6.4-8-7.4-11.4C18.6 12.6 25 10.6 25 4.6M17 16.5v6"/><path class="g3" d="M11 9.5l6 3 6-3c-1.6 3-5 4.2-6 6.3-1-2.1-4.4-3.3-6-6.3zM10.2 26.6c.8-3 3.4-4.8 6.8-6 3.4 1.2 6 3 6.8 6z"/></g>' },
  { id: 'tangram', file: 'tangram', name: 'Tangram', animated: true,
    glyph: '<path class="g1" d="M10.9 2.3L37.1 2.3L24 15.1z"/><path class="g2" d="M10.3 2.9L23.1 16L10.3 29.1z"/><path class="g3" d="M37.6 16.8L37.4 29.4L24.8 29.6z"/><path class="g4" d="M45.4 1.5L45.4 13.7L39.6 7.6z"/><path class="g2" d="M31 9.9L37.1 16L31 22.1L24.9 16z"/><path class="g4" d="M24 16.9L30.1 22.7L17.9 22.7z"/><path class="g1" d="M10.9 29.7L17.6 23.6L30.1 23.3L23.4 29.4z"/>' },
  { id: 'chalkboard', file: 'chalkboard', name: 'Chalkboard', animated: true,
    glyph: '<path class="ln" d="M5 3v24h21" opacity=".55"/><path class="ln" d="M7 20c3-13 6-13 8-5s5 9 9-6"/><path class="g2" d="M30 5.6h7v2h-7zM32.5 3h2v7h-2zM39.5 4.4h6.5v2h-6.5zM39.5 8h6.5v2h-6.5z"/><rect class="g3" x="29" y="19" width="16" height="8" rx="1.5"/><rect class="g1" x="29" y="19" width="16" height="3.4" rx="1.5"/>' },
  { id: 'blueprint', file: 'blueprint', name: 'Blueprint', animated: true,
    glyph: '<path class="ln" d="M2 16h26M15 3v26" opacity=".45" stroke-dasharray="5 2 1.5 2"/><circle class="ln" cx="15" cy="16" r="10"/><circle class="g2" cx="15" cy="16" r="3.6"/><path class="g4" d="M30 6h7v7h-7zM30 19h7v7h-7z" opacity=".75"/><path class="ln" d="M43 6v20" opacity=".6"/><path class="g3" d="M43 5l-2.2 4h4.4zM43 27l-2.2-4h4.4z"/>' },
  { id: 'drips', file: 'drips', name: 'Drips', animated: true,
    glyph: '<path class="g1" d="M0 0h25v6.5q-3 1.5-6 .5t-6 .5-7-.5-6 .5zM8.6 6h2.8v13h-2.8zM19.5 6h2.4v6h-2.4z"/><circle class="g1" cx="10" cy="19.5" r="2.7"/><circle class="g1" cx="20.7" cy="12.4" r="2.1"/><path class="g3" d="M24 0h24v6q-3 1.5-6 .5t-6 .5-6-.5-6 .5zM31.6 6h2.8v22h-2.8zM41 6h2.4v5h-2.4z"/><ellipse class="g3" cx="33" cy="29.6" rx="7" ry="2.4"/><circle class="g3" cx="42.2" cy="11.4" r="2.1"/>' },
  { id: 'cross-stitch', file: 'crossstitch', name: 'Cross-stitch', animated: true,
    glyph: '<path class="g1" d="M17 4h5v5h-5zM27 4h5v5h-5zM12 9h25v5h-25zM12 14h25v5h-25zM17 19h15v5h-15zM22 24h5v5h-5z" opacity=".85"/><path class="ln" d="M17 4l5 5M17 9l5-5M27 4l5 5M27 9l5-5M12 9l5 5l5-5l5 5l5-5l5 5M12 14l5-5l5 5l5-5l5 5l5-5M12 14l5 5l5-5l5 5l5-5l5 5M12 19l5-5l5 5l5-5l5 5l5-5M17 19l5 5l5-5l5 5M17 24l5-5l5 5l5-5M22 24l5 5M22 29l5-5" stroke-width="1.4" opacity=".75"/><path class="g2" d="M40 3l2.2 1.4-6.8 9.4-1.1-.7z"/>' },
  { id: 'leaves', file: 'leaves', name: 'Autumn leaves', animated: true,
    glyph: '<path class="g1" d="M9.8 2.3L13.1 7L16.4 3.5L15.9 8.8L19.8 9.8L15.5 11.9L13.6 12.6L11.7 13.3L7 14.5L9.4 11.1L5.6 7.4L10.4 8.1z"/><path class="ln" d="M13.6 12.6L14.6 15.3"/><path class="g3" d="M30 4c6 1 9 6 7 12c-6-1-9-6-7-12z"/><path class="g2" d="M2 32c3-5 9-6 12-4c3-3 8-3 11 0c4-3 10-3 13 0c3-2 7-2 10 1v3z" opacity=".75"/><path class="g4" d="M20 30c1-4 5-6 8-5c-1 4-5 6-8 5zM36 29c2-3 6-4 9-2c-2 3-6 4-9 2z"/>' },
  { id: 'cracks', file: 'cracks', name: 'Cracks', animated: true,
    glyph: '<rect class="g1" x="1" y="1" width="46" height="30" rx="2" opacity=".25"/><path class="ln" d="M1 10l8 2 7-1 9 4 10-2 12 3M16 11l-1 8 3 5-1 7M25 15l2 7-3 4M35 13l1 7 5 4 6 5M27 22l8-2M9 12l-3 9-5 2M41 24l-6 7"/>' },
  { id: 'low-poly', file: 'lowpoly', name: 'Low poly', animated: true,
    glyph: '<g class="g1"><path d="M0 0h22L10 15z"/><path d="M0 0l10 15L0 32z" opacity=".6"/><path d="M48 18v14H22z" opacity=".75"/></g><g class="g2"><path d="M22 0h26L34 12z"/><path d="M10 15l24-3-12 20z" opacity=".55"/></g><g class="g3"><path d="M48 0v18L34 12z" opacity=".7"/><path d="M34 12l14 6-26 14z"/></g><g class="g4"><path d="M22 0l12 12-24 3z" opacity=".7"/><path d="M10 15l12 17H0z"/></g>' },
  { id: 'penrose', file: 'penrose', name: 'Penrose', animated: true,
    glyph: '<path class="g1" d="M24 16L24 6.6L32.9 3.7L32.9 13.1z"/><path class="g3" d="M24 16L32.9 13.1L38.5 20.7L29.5 23.6z"/><path class="g2" d="M24 16L29.5 23.6L24 31.2L18.5 23.6z"/><path class="g4" d="M24 16L18.5 23.6L9.5 20.7L15.1 13.1z"/><path class="g3" d="M24 16L15.1 13.1L15.1 3.7L24 6.6z"/><path class="ln" d="M24 16L24 6.6L32.9 3.7L32.9 13.1M24 16L32.9 13.1L38.5 20.7L29.5 23.6M24 16L29.5 23.6L24 31.2L18.5 23.6M24 16L18.5 23.6L9.5 20.7L15.1 13.1M24 16L15.1 13.1L15.1 3.7L24 6.6" stroke-width="1.2"/>' },
  { id: 'heart-monitor', file: 'heartmonitor', name: 'Heart monitor', animated: true,
    glyph: '<path class="ln" d="M4 8v20h40" opacity=".3"/><path class="ln" d="M4 20h7l2-3 2 3h3l2 4 3-15 3 14 2-3h5l2-3 3 3h6"/><circle class="g2" cx="40" cy="20" r="2.4"/><path class="g1" d="M41 11c-3-2-5-4-5-6a2.4 2.4 0 0 1 5-1a2.4 2.4 0 0 1 5 1c0 2-2 4-5 6z"/>' },
  { id: 'rail-map', file: 'railmap', name: 'Rail map', animated: true,
    glyph: '<path class="ln" d="M2 27q12-6 24 0t20 0" opacity=".35"/><path class="g2" d="M26.5 2h3v28h-3z"/><path class="g1" d="M2 10.5h17.6l13.2 13.2c.6.6 1.4.8 2.2.8H46v3H35c-1.6 0-3-.6-4.2-1.7L18.4 13.5H2z"/><path class="g1" d="M10 7.5h2v3h-2zM40 21.5h2v3h-2z"/><path class="g2" d="M29.5 7h3v2h-3z"/><circle class="ln" cx="28" cy="21" r="3.4"/><rect class="g3" x="3" y="9.6" width="8.5" height="4.8" rx="2.4"/>' },
  { id: 'traffic', file: 'traffic', name: 'Traffic', animated: true,
    glyph: '<path class="ln" opacity=".45" d="M0 10.5h18.5V0M29.5 0v10.5H48M0 21.5h18.5V32M29.5 32V21.5H48"/><path class="ln" opacity=".5" stroke-dasharray="3 3" d="M1 16h15M32 16h15M24 1v7M24 24v7"/><rect class="g1" x="4" y="17" width="9" height="4" rx="1.4"/><rect class="g2" x="19" y="2" width="3.8" height="9" rx="1.4"/><rect class="g4" x="34" y="11" width="9" height="4" rx="1.4"/><circle class="g3" cx="16" cy="24" r="1.8"/><circle class="g3" cx="32" cy="8" r="1.8"/>' },
  { id: 'river', file: 'river', name: 'River', animated: true,
    glyph: '<path class="g2" opacity=".5" d="M0 4c9 0 13 3 16 9s6 10 12 10 10-6 13-10 4-5 7-5v9c-2 0-3 1-5 4s-7 11-15 11-13-6-17-12S5 13 0 13z"/><path class="ln" opacity=".55" d="M3 8.5c5 0 8 2 10 5M22 22c4 3 8 3 11 0M37 19c2-1 3.5-3 5-5"/><path class="g1" d="M9 8.5c2-2.4 5.5-2.4 7 0-2 2.4-5 2.4-7 0z"/><path class="g3" d="M27 26c2-2.4 5.5-2.4 7 0-2 2.4-5 2.4-7 0z"/><g class="g4"><circle cx="40" cy="27" r="3"/><circle cx="44" cy="25" r="2.4"/><circle cx="7" cy="25" r="2.6"/></g>' },
  { id: 'weather-map', file: 'weathermap', name: 'Weather map', animated: true,
    glyph: '<g class="ln" opacity=".4"><circle cx="14" cy="12" r="5"/><circle cx="14" cy="12" r="10.5"/></g><path class="ln" d="M14 12q14 4 32-1M14 12q4 10-5 19M33 23l7 3m-3.5-4.5 3.5 4.5-4.5 2"/><path class="g1" d="M21.5 14a2.8 2.8 0 0 1 5.6.6zM31 14.5a2.8 2.8 0 0 1 5.6-.2zM40.5 13a2.8 2.8 0 0 1 5.4-.9z"/><path class="g2" d="M16.2 15l4.6 3.2-4.4 1.6zM15 22.6l4.8 1.8-4.6 3zM12 28.6l4.4.6-3.4 2.8z"/>' },
  { id: 'lighthouse', file: 'lighthouse', name: 'Lighthouse', animated: true,
    glyph: '<path class="g3" opacity=".45" d="M13 6.5 47 1v12z"/><path class="ln" d="M0 27.5h7l3-1h9q4 0 6 4.5M28 21.5h18" opacity=".55"/><path class="ln" opacity=".4" d="M31 25.5h7M41 29h5M33 31h4"/><path class="g1" d="M8.6 26.5h8.8l-.6-5.5H9.2zM9.6 16.5h6.8l-.4-4.5H10z"/><path class="ln" d="M9.2 21l.4-4.5M16.8 21l-.4-4.5M8.5 10.3h9M10 4.6q3-3 6 0"/><rect class="g3" x="10.5" y="5" width="5" height="4.2" rx="1"/><g class="g2"><circle cx="40" cy="17" r="1.5"/><circle cx="4" cy="6" r="1.2"/></g>' },
  { id: 'none', name: 'None', animated: false,
    glyph: '<circle class="ln" cx="24" cy="16" r="10"/><path class="ln" d="M17 23l14-14"/>' },
]);

/**
 * @typedef {{ground:string, dark:boolean, colors:readonly string[]}} Look
 * A background's own colours, whatever the theme: `ground` is #bg's CSS background, `dark`
 * whether it is a dark one, and `colors` the six a background draws in.
 */
/** @type {Readonly<Record<string, Look>>} */
export const LOOKS = Object.freeze({
  night: { ground: 'radial-gradient(120% 90% at 75% 15%,#2c1c78 0%,#120c3c 50%,#05040f 100%)', dark: true,
    colors: ['#ff5ca8', '#ffd23f', '#3ee8ff', '#7dff8a', '#ff8a3d', '#d4a5ff'] },
  ocean: { ground: 'linear-gradient(180deg,#0a6a9a 0%,#06456f 50%,#021f3d 100%)', dark: true,
    colors: ['#ff7a45', '#ffd166', '#3df5d0', '#ff5c8a', '#b5ecff', '#c3ff5a'] },
  sky: { ground: 'linear-gradient(180deg,#3fb3ff 0%,#8fd6ff 55%,#e3f6ff 100%)', dark: false,
    colors: ['#e5243b', '#ff8c00', '#ffcc00', '#13a26b', '#173a7a', '#ff3d9a'] },
  forest: { ground: 'linear-gradient(180deg,#145a3a 0%,#0b3a24 55%,#04190e 100%)', dark: true,
    colors: ['#ffe14d', '#ff8f3d', '#a6ff6b', '#ff6b8b', '#6be4ff', '#fff4d6'] },
  sand: { ground: 'linear-gradient(180deg,#ffe2a1 0%,#ffc370 60%,#f3a15a 100%)', dark: false,
    colors: ['#c1121f', '#7b2cbf', '#0067a3', '#1f7a3a', '#4a2511', '#e5007a'] },
  arcade: { ground: 'radial-gradient(130% 100% at 50% 0%,#1d1640 0%,#0a0818 55%,#030208 100%)', dark: true,
    colors: ['#ff2e88', '#00f0ff', '#fff200', '#39ff14', '#ff7a00', '#c06bff'] },
  paper: { ground: 'linear-gradient(160deg,#fffaf0 0%,#fbecc8 100%)', dark: false,
    colors: ['#e0262f', '#1f4fd8', '#f08c00', '#11924a', '#7b2fd6', '#d81b72'] },
  blueprint: { ground: 'linear-gradient(180deg,#1565c8 0%,#0b3f8f 100%)', dark: true,
    colors: ['#ffffff', '#a8e6ff', '#ffd23f', '#ff9ec2', '#86ffd6', '#d6ecff'] },
  sunset: { ground: 'linear-gradient(180deg,#ff8a5c 0%,#d63c7e 45%,#5a1a8c 75%,#1e0b45 100%)', dark: true,
    colors: ['#ffe66d', '#ffffff', '#ffb02e', '#5ee2ff', '#ff4fa8', '#b8f2e6'] },
  candy: { ground: 'linear-gradient(135deg,#ffc6e4 0%,#ffe9a8 50%,#b8e6ff 100%)', dark: false,
    colors: ['#e0115f', '#6a1fd1', '#0a7fd9', '#0f9b58', '#ff6a00', '#2a1a5e'] },
  neon: { ground: 'radial-gradient(120% 90% at 30% 20%,#4b16b8 0%,#1f0759 55%,#0b0222 100%)', dark: true,
    colors: ['#ff3fa4', '#3fd8ff', '#ffe03f', '#7dffd4', '#ff9d2e', '#ffffff'] },
  ember: { ground: 'radial-gradient(120% 90% at 50% 100%,#6b1a0a 0%,#2e0806 55%,#120303 100%)', dark: true,
    colors: ['#ff5a1f', '#ffb703', '#ffe8a3', '#ff3d7f', '#ff8c42', '#ffd6a5'] },
  chalk: { ground: 'linear-gradient(180deg,#2c5a46 0%,#1b3b2e 100%)', dark: true,
    colors: ['#ffffff', '#ffe066', '#ffa3c2', '#a5e8ff', '#c2f58f', '#ffbd7a'] },
  ice: { ground: 'linear-gradient(180deg,#bfe4ff 0%,#eef8ff 100%)', dark: false,
    colors: ['#0353a4', '#e0263f', '#6a1fb0', '#008f8f', '#e86a00', '#1b2440'] },
  lab: { ground: 'radial-gradient(120% 90% at 50% 30%,#0f5260 0%,#062a33 55%,#020f13 100%)', dark: true,
    colors: ['#00f5d4', '#fee440', '#ff5cbf', '#b98cff', '#3fc8ff', '#ffffff'] },
  steel: { ground: 'linear-gradient(180deg,#34495e 0%,#1a2633 60%,#0c131b 100%)', dark: true,
    colors: ['#ffb703', '#ff7b1c', '#8fd8ff', '#ff4b5c', '#7ff0c8', '#f1faee'] },
});

/** Which look each background wears, by look. A background left out wears night.
 * @type {Readonly<Record<string, readonly string[]>>} */
export const LOOK_OF = Object.freeze({
  night: ['starfield', 'aurora', 'constellation', 'galaxy', 'meteors', 'orrery', 'planet', 'black-hole', 'moon-phases',
    'fireworks', 'snow', 'rainy-window', 'lighthouse', 'spiderweb', 'traffic', 'trails', 'smoke', 'fireflies', 'warp',
    'solar', 'skyline'],
  ocean: ['rain', 'waves', 'caustics', 'koi', 'puddles', 'river', 'jellyfish', 'kelp', 'aquarium', 'bubbles', 'swim',
    'ripple', 'whirlpool'],
  sky: ['sunbeams', 'clouds', 'paper-planes', 'kites', 'balloons', 'day-night', 'sunflower', 'windmills', 'ferris',
    'train-window', 'flag', 'tree', 'flutter', 'flock', 'fountain', 'rise', 'drift'],
  forest: ['vines', 'slime', 'leaves', 'card-cascade', 'dice', 'reversi', 'chess', 'billiards', 'bloom', 'fall', 'sway'],
  sand: ['dunes', 'zen-garden', 'ants', 'shoreline', 'hourglass', 'cracks', 'roll', 'conveyor'],
  arcade: ['pong', 'snake', 'breakout', 'invaders', 'asteroids', 'pinball', 'maze-chase', 'light-cycles', 'pegboard',
    'dominoes', 'blocks', 'maze', 'pixel', 'letterrain', 'ticker', 'heart-monitor', 'oscilloscope', 'radar', 'equalizer',
    'wireframe', 'mystify', 'life', 'automaton', 'confetti'],
  paper: ['hanoi', 'slide-puzzle', 'sudoku', 'tangram', 'tiles', 'crossword', 'typewriter', 'word-hunt', 'anagrams',
    'word-swarm', 'weather-map', 'rail-map', 'sorting', 'ink', 'marbling', 'brushstrokes', 'drips', 'weave',
    'cross-stitch', 'halftone', 'contours', 'penrose', 'truchet', 'string-art', 'spirograph', 'dragon-curve',
    'chaos-game', 'illustrated', 'stack', 'flip'],
  blueprint: ['blueprint', 'gears', 'kinetic', 'newtons-cradle', 'pendulums'],
  sunset: ['hills', 'lanterns', 'low-poly', 'synthwave', 'ribbons', 'wave', 'juggle'],
  candy: ['parade', 'wallpaper', 'carousel', 'bounce', 'pulse', 'trail', 'motion', 'scene', 'kaleido', 'blobs'],
  neon: ['plasma', 'voronoi', 'honeycomb', 'flowfield', 'mandala', 'moire', 'shimmer', 'bokeh', 'neon', 'interference',
    'attractor'],
  ember: ['embers', 'marble-run', 'metronomes'],
  chalk: ['chalkboard'],
  ice: ['frost'],
  lab: ['turing', 'sand', 'iron-filings', 'double-pendulum', 'dna', 'molecules', 'cells', 'chladni', 'cloud-chamber',
    'circuit'],
  steel: ['clocks', 'abacus', 'pipes', 'slinky'],
});

const LOOK_BY_ID = new Map(Object.entries(LOOK_OF).flatMap(([look, ids]) => ids.map(id => [id, look])));

/** A background's own look, whatever the theme. @param {string} id @returns {Look} */
export function lookOf(id) {
  return LOOKS[LOOK_BY_ID.get(id) ?? 'night'];
}

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
      if (host && opts.ground !== undefined) host.style.background = opts.ground;
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
