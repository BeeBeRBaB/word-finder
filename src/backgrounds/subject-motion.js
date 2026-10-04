// Subject motion: the subject's icons move the way the subject does (fish swim, leaves fall),
// by handing the host to the motion module the subject's map entry names.

import { motionFor } from './icon-scene.js';

/** @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions */

/** Each motion id in the map, and the module in this folder that draws it. */
export const MOTIONS = Object.freeze({
  drift: 'drifting-icons', parade: 'icon-parade', bloom: 'icon-bloom', wallpaper: 'icon-tiles',
  carousel: 'icon-orbit', swim: 'icon-swim', flutter: 'icon-flutter', fall: 'icon-fall',
  bounce: 'icon-bounce', rise: 'icon-rise', pulse: 'icon-pulse',
});

/**
 * @param {HTMLElement} host positioned element the motion fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did, even before the motion has loaded
 */
export function start(host, opts) {
  const id = /** @type {keyof typeof MOTIONS} */ (motionFor(opts.subject));
  let live = true, stop = () => {};
  // A motion that fails to load (offline) leaves the host empty, as any background's would.
  import(`./${MOTIONS[id] ?? MOTIONS.drift}.js`).then(m => { if (live) stop = m.start(host, opts); }, () => {});
  return () => { live = false; stop(); };
}
