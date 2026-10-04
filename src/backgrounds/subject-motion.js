// Subject motion: the subject's icons move the way the subject does (fish swim, leaves fall),
// by handing the host to the motion module the subject's map entry names.

import { importBackground } from '../backgrounds.js';
import { motionFor } from './icon-scene.js';

/** @typedef {import('../backgrounds.js').BackgroundOptions} BackgroundOptions */

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
  let live = true, started = false, stop = () => {};
  // Through the registry's loader, so a motion that failed to load (offline) is tried under a new URL
  // on its next start, and back online too, where the backdrop sees this one running and leaves it.
  const load = () => importBackground(MOTIONS[id] ?? MOTIONS.drift).then(m => {
    if (!live || started) return;
    started = true;
    removeEventListener('online', load);
    stop = m.start(host, opts);
  }, () => {});
  addEventListener('online', load);
  load();
  return () => { live = false; removeEventListener('online', load); stop(); };
}
