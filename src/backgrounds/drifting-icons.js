// Drifting icons: the subject's icons float across the host at three depths, swaying and
// tilting as they go. The seed picks the variant: rising, falling or blowing sideways.
// Each icon is rasterised once into a sprite canvas in its own colour.

import { makeRng } from '../rng.js';
import { iconSvg, iconsFor, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject?:string, seed?:number}} BackgroundOptions
 * @typedef {{k:number, d:number, size:number, speed:number, along:number, across:number,
 *   sway:number, swayF:number, tilt:number, tiltF:number, ph:number, alpha:number}} Drifter
 * along is the distance travelled from the entry edge, across the position on the other axis.
 */

/** @type {{name:string, style:'pixel'|'modern', animated:boolean}} */
export const meta = { name: 'Drifting icons', style: 'modern', animated: true };

const SPRITE = 64;   // largest drawn edge in CSS px

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const subject = opts.subject ?? 'nature/trees';
  const colors = opts.colors.length ? opts.colors : [opts.dark === false ? '#555' : '#bbb'];
  const reduced = !!opts.reducedMotion;
  const { layout, hero, seed } = variantOf(subject, opts.seed ?? 0);
  const ids = withHero(iconsFor(subject), hero);
  const rng = makeRng(seed);
  const hue0 = rng.int(colors.length);
  // 0 rises, 1 falls, 2 blows sideways (left to right or back, by seed).
  const dir = layout, back = dir === 2 && rng.random() < 0.5;

  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  host.appendChild(cv);
  const c2d = cv.getContext('2d');
  if (!c2d) return () => cv.remove();
  const ctx = c2d;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  /** @type {Drifter[]} */
  const parts = [];
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, t = 0, dead = false, next = 0;

  /** Sprites are drawn at the device pixel ratio they were made for; a change remakes them.
   * @returns {void} */
  function makeSprites() {
    const px = Math.round(SPRITE * dpr);
    ids.forEach((id, i) => {
      const img = new Image();
      img.onload = () => {
        if (dead) return;
        const s = document.createElement('canvas');
        s.width = s.height = px;
        s.getContext('2d')?.drawImage(img, 0, 0, px, px);
        sprites[i] = s;
        draw();
      };
      img.src = 'data:image/svg+xml,' + encodeURIComponent(iconSvg(id, colors[(hue0 + i) % colors.length], px));
    });
  }

  /** @param {Drifter} p @param {boolean} anywhere true on (re)size: place mid-flight @returns {void} */
  function spawn(p, anywhere) {
    const span = dir === 2 ? W : H, cross = dir === 2 ? H : W;
    p.k = next++ % ids.length;
    p.across = rng.random() * cross;
    p.along = anywhere ? rng.random() * (span + p.size) : -p.size * (0.6 + rng.random());
  }

  /** @returns {void} */
  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    const d = Math.min(2, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && parts.length) return;
    const remake = d !== dpr || !parts.length;
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const n = Math.max(8, Math.min(36, Math.round(W * H / 26000)));
    parts.length = 0;
    for (let i = 0; i < n; i++) {
      const z = (i + rng.random()) / n;   // spread evenly over depth; far ones drawn first
      /** @type {Drifter} */
      const p = { k: 0, d: z, size: 22 + z * 40, speed: 9 + z * 20, along: 0, across: 0,
        sway: 6 + rng.random() * 18, swayF: 0.15 + rng.random() * 0.25, tilt: 5 + rng.random() * 12,
        tiltF: 0.2 + rng.random() * 0.3, ph: rng.random() * 6.3, alpha: 0.32 + z * 0.38 };
      spawn(p, true);
      parts.push(p);
    }
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    t += dt;
    const span = dir === 2 ? W : H;
    for (const p of parts) {
      p.along += p.speed * dt;
      if (p.along > span + p.size) spawn(p, false);
    }
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      const spr = sprites[p.k];
      if (!spr) continue;
      const off = Math.sin(t * p.swayF * 6.28 + p.ph) * p.sway;
      let x, y;
      if (dir === 2) { x = back ? W - p.along : p.along; y = p.across + off; }
      else { x = p.across + off; y = dir === 0 ? H - p.along : p.along; }
      const a = Math.sin(t * p.tiltF * 6.28 + p.ph * 1.7) * p.tilt * Math.PI / 180;
      const cos = Math.cos(a) * dpr, sin = Math.sin(a) * dpr;
      ctx.setTransform(cos, sin, -sin, cos, x * dpr, y * dpr);
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(spr, -p.size / 2, -p.size / 2, p.size, p.size);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  /** @param {number} now @returns {void} */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (last && now - last < 30) return;   // ~30 fps
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    step(dt); draw();
  }

  /** @returns {void} */
  function play() {
    if (dead || reduced || raf || document.hidden) return;
    last = 0; raf = requestAnimationFrame(frame);
  }
  /** @returns {void} */
  function pause() { cancelAnimationFrame(raf); raf = 0; }
  const onVis = () => (document.hidden ? pause() : play());

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(host); else window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);
  resize();
  if (!reduced) t = rng.random() * 20;
  play();

  return function stop() {
    dead = true; pause();
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    cv.remove();
    parts.length = 0;
  };
}
