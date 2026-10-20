// Shared by the newer icon motions, and not a background itself: stage.js plus the dealt
// subject's icons, hero first, as sprites in the look's colours, and a call to draw one.

import { stage } from './stage.js';
import { facingOf, iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {import('./stage.js').Stage & {ids:string[], n:number,
 *   icon:(k:number, x:number, y:number, size:number, rot?:number, alpha?:number, dir?:number, sy?:number) => void,
 *   hue:(k:number) => string}} IconStage
 * n is how many icons the subject has; icon(k, ...) draws icon k mod n centred on x, y, `size`
 * CSS px, turned rot radians, at alpha, mirrored to face dir (-1 left, 1 right) when it is
 * drawn side-on, and squashed to sy of its height (a flip). hue(k) is the colour icon k is in.
 */

const SPRITE = 80;   // largest drawn edge in CSS px

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {import('./stage.js').StageOptions} opts
 * @param {(s:IconStage) => import('./stage.js').Scene} make
 * @returns {() => void} stop
 */
export function iconStage(host, opts, make) {
  const subject = opts.subject ?? '';
  const { layout, hero, seed } = variantOf(subject, opts.seed ?? 0);
  const ids = withHero(iconsFor(subject), hero);
  const facing = ids.map(id => facingOf(id));
  const colors = sceneColors(opts.colors, opts.dark === false ? '#555' : '#bbb');
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  let cancel = () => {};
  let hue0 = 0;

  return stage(host, opts, (base) => {
    const s = /** @type {IconStage} */ (base);
    hue0 = s.rng.int(colors.length);
    s.ids = ids;
    s.n = Math.max(1, ids.length);
    s.hue = (k) => colors[(hue0 + 1 + (((k % s.n) + s.n) % s.n)) % colors.length];
    s.icon = (k, x, y, size, rot = 0, alpha = 1, dir = 0, sy = 1) => {
      const i = ((k % s.n) + s.n) % s.n;
      const spr = sprites[i];
      if (!spr || alpha <= 0 || size <= 0) return;
      const { ctx, dpr } = s;
      const fx = facing[i] && dir * facing[i] < 0 ? -1 : 1;
      const c = Math.cos(rot), sn = Math.sin(rot);
      ctx.setTransform(c * fx * dpr, sn * fx * dpr, -sn * sy * dpr, c * sy * dpr, x * dpr, y * dpr);
      ctx.globalAlpha = alpha;
      ctx.drawImage(spr, -size / 2, -size / 2, size, size);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const load = () => {
      cancel();
      cancel = iconSprites(ids, i => s.hue(i), Math.round(SPRITE * s.dpr), (i, spr) => {
        sprites[i] = spr;
        s.paint();
      }, opts);
    };
    s.onDpr = load;
    load();
    const scene = make(s);
    const own = scene.stop;
    scene.stop = () => { cancel(); own?.(); };
    return scene;
  }, { seed, layout });
}
