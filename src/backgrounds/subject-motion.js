// Subject motion: the subject's icons move the way the subject does (fish swim, leaves fall),
// by handing the host to the motion module the subject's map entry names.

import { BACKGROUNDS, importBackground } from '../backgrounds.js';
import { motionFor } from './icon-scene.js';

/** @typedef {import('../backgrounds.js').BackgroundOptions} BackgroundOptions */

/** Each style the map can name, by registry id, and the module in this folder that draws it:
 * every animated background but this one. A stale registry without an id falls back to drift. */
export const MOTIONS = Object.freeze(/** @type {Record<string, string>} */ (Object.fromEntries(
  BACKGROUNDS.filter(b => b.id !== 'motion').map(b => [b.id, b.file]))));

/**
 * @param {HTMLElement} host positioned element the motion fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did, even before the motion has loaded
 */
export function start(host, opts) {
  const id = motionFor(opts.subject);
  let live = true, started = false, stop = () => {};
  // Through the registry's loader, so a motion that failed to load (offline) is tried under a new URL
  // on its next start, and back online too, where the backdrop sees this one running and leaves it.
  const load = () => importBackground(MOTIONS[id] ?? MOTIONS.drift).then(m => {
    if (!live || started) return;
    started = true;
    removeEventListener('online', load);
    // The motion's own look, not this background's.
    const look = opts.lookOf?.(MOTIONS[id] ? id : 'drift');
    if (look) host.style.background = look.ground;
    stop = m.start(host, look ? { ...opts, colors: [...look.colors], dark: look.dark } : opts);
  }, () => {});
  addEventListener('online', load);
  load();
  return () => { live = false; removeEventListener('online', load); stop(); };
}
