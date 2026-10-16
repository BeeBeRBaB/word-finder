// Background choices: the still category art (art.js) and the animated modules in
// src/backgrounds/, which load only when picked. Pure: the import is injected, and the
// host a background draws into is passed in.
import { retryingImport } from './importer.js';
import { makeRng } from './rng.js';
import { normalizeTheme } from './appearance.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed:number}} BackgroundOptions
 * `colors` are the theme's six confetti colours, which the subject backgrounds draw in (the
 * others keep their own); `subject` and `seed` are the dealt puzzle's.
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
