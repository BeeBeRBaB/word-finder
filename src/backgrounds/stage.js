// Shared by the newer backgrounds, and not a background itself: a canvas over the host at the
// device pixel ratio, drawn in CSS px, the look's colours, a seeded rng and the 30fps loop.
// A background supplies a scene: lay() for a new size, step(dt) to advance, draw() to paint.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject?:string, seed?:number,
 *   icons?:import('./icon-scene.js').IconStyle}} StageOptions
 * @typedef {{lay:() => void, step:(dt:number) => void, draw:() => void, stop?:() => void}} Scene
 * @typedef {{cv:HTMLCanvasElement, ctx:CanvasRenderingContext2D, W:number, H:number, dpr:number,
 *   t:number, dark:boolean, reduced:boolean, colors:string[], ink:string, rng:import('../rng.js').Rng,
 *   seed:number, layout:number, paint:() => void, onDpr:() => void}} Stage
 * W, H are CSS px and draw() paints in them; t is seconds run; colors the background's own colours
 * (ink alone while they are empty); layout 0..2 is the variant a seed picks; paint() redraws now.
 */

/** @param {number} a @param {number} b @param {number} u 0..1 @returns {number} */
export const mix = (a, b, u) => a + (b - a) * u;

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const TAU = Math.PI * 2;

/**
 * Starts `make`'s scene on a canvas over `host`.
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {StageOptions} opts
 * @param {(s:Stage) => Scene} make builds the scene once; called after the first measure
 * @param {{seed?:number, layout?:number}} [given] the variant, when the caller picked it
 * @returns {() => void} stop: undoes everything start did
 */
export function stage(host, opts, make, given = {}) {
  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const ink = opts.dark === false ? '#555' : '#bbb';
  const colors = opts.colors.filter(Boolean);
  const seed = given.seed ?? (opts.seed ?? 0) >>> 0;
  /** @type {Stage} */
  const s = {
    cv: layer.cv, ctx: layer.ctx, W: 0, H: 0, dpr: 1, t: 0, dark: opts.dark !== false,
    reduced: !!opts.reducedMotion, colors: colors.length ? colors : [ink], ink, rng: makeRng(seed),
    seed, layout: given.layout ?? seed % 3, paint, onDpr: () => {},
  };
  /** @type {Scene|null} */
  let scene = null;

  /** @returns {void} */
  function paint() {
    if (!scene) return;
    const { ctx } = s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, s.cv.width, s.cv.height);
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    scene.draw();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (scene && w === s.W && h === s.H && d === s.dpr) return;
    const dprChanged = d !== s.dpr;
    s.W = w; s.H = h; s.dpr = d;
    s.cv.width = Math.round(w * d); s.cv.height = Math.round(h * d);
    if (!scene) scene = make(s);
    else if (dprChanged) s.onDpr();
    scene.lay();
    paint();
  }

  resize();
  const stop = frameLoop(host, resize, (dt) => {
    s.t += dt;
    scene?.step(dt);
    paint();
  }, s.reduced);
  return () => { stop(); scene?.stop?.(); s.cv.remove(); };
}
