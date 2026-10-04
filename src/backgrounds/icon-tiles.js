// Icon wallpaper: the subject's icons as a tidy staggered wallpaper, the hero on one tile in four,
// scrolling slowly while each tile breathes on a wave that crosses the grid. The seed picks the
// variant: drifting diagonally, sideways, or up and down. Each icon is rasterised once.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 */

const SPRITE = 86;                         // largest drawn edge in CSS px, breath included
const PITCH = Math.sqrt(2 / Math.sqrt(3)); // hex column pitch in cells, so each tile has one cell's area
const ROW = Math.sqrt(3) / 2;              // row pitch in column pitches
const SPEED = 0.08;                        // cells per second, so a small host scrolls as calmly as a big one
const BREATH = 0.04;                       // scale swing either side of 1
const PERIOD = 7;                          // seconds per breath
const WAVE = 6;                            // tiles per wavelength of the breathing wave

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const subject = opts.subject;
  const all = sceneColors(opts.colors, opts.dark === false ? '#555' : '#bbb');
  // Two of the four middle colours: a theme's first and sixth can sit near black or white.
  const colors = all.length > 4 ? all.slice(1, 5) : all;
  const reduced = !!opts.reducedMotion;
  const { layout, hero, seed } = variantOf(subject, opts.seed ?? 0);
  const ids = withHero(iconsFor(subject), hero);
  const rng = makeRng(seed);
  const hue0 = rng.int(colors.length), m = ids.length - 1;
  // 0 drifts on a diagonal, 1 sideways, 2 up or down; which way by seed.
  const deg = layout === 0 ? 90 * rng.int(4) + 30 + rng.random() * 15 : layout === 1 ? 180 * rng.int(2) : 90 + 180 * rng.int(2);
  const vx = Math.cos(deg * Math.PI / 180) * SPEED / PITCH, vy = Math.sin(deg * Math.PI / 180) * SPEED / PITCH;
  // The wave runs roughly across the direction of travel, so it reads as a motion of its own.
  const wa = (deg + 70 + rng.random() * 40) * Math.PI / 180;
  const kx = Math.cos(wa) * 2 * Math.PI / WAVE, ky = Math.sin(wa) * 2 * Math.PI / WAVE;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  // Scroll offset in column pitches from the host's centre: a resize scales the picture, never reshuffles it.
  let ox = rng.random() * 2, oy = rng.random() * 2 * ROW;
  let W = 0, H = 0, dpr = 1, cell = 64, t = 0;
  let cancel = () => {};

  /** Sprites are drawn at the device pixel ratio of the last resize that changed it; the hero
   * takes one colour and every other icon the one opposite. @returns {void} */
  function makeSprites() {
    // One still loading from before a density change would land over the new one.
    cancel();
    cancel = iconSprites(ids, i => colors[(hue0 + (i ? 2 : 0)) % colors.length], Math.round(SPRITE * dpr), (i, s) => {
      sprites[i] = s;
      draw();
    });
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr) return;
    const remake = d !== dpr || !W;
    W = w; H = h; dpr = d;
    // layoutScene's cell: about 120px on a laptop, never so small a narrow rail gets confetti.
    cell = Math.max(64, Math.min(150, Math.sqrt(W * H / 34), Math.min(W, H) / 1.6));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (remake) makeSprites(); else draw();
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = cell * PITCH, edge = cell * 0.3, cx = W / 2, cy = H / 2;
    const ph = t * 2 * Math.PI / PERIOD, amp = reduced ? 0 : BREATH;
    // Tile (c, r) sits (c + r/2, r * ROW) pitches from the origin; every one whose edge reaches the
    // host is drawn, so a row or column slides in from outside instead of popping.
    const r0 = Math.ceil(((-edge - cy) / p + oy) / ROW), r1 = Math.floor(((H + edge - cy) / p + oy) / ROW);
    const xlo = (-edge - cx) / p + ox, xhi = (W + edge - cx) / p + ox;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.55 : 0.42;
      const base = (pass ? 0.54 : 0.44) * cell;
      for (let r = r0; r <= r1; r++) {
        const Y = r * ROW, y = cy + (Y - oy) * p, rOdd = r & 1;
        for (let c = Math.ceil(xlo - r / 2), c1 = Math.floor(xhi - r / 2); c <= c1; c++) {
          const cOdd = c & 1, heroTile = !cOdd && !rOdd;
          if (heroTile !== !!pass) continue;
          // The others take the hero lattice's three other cosets in turn: no two alike touch.
          const k = heroTile || m < 1 ? 0 : 1 + ((cOdd + 2 * rOdd - 1 + 3 * ((c >> 1) + (r >> 1))) % m + m) % m;
          const spr = sprites[k];
          if (!spr) continue;
          const X = c + r / 2, s = base * (1 + amp * Math.sin(ph - kx * X - ky * Y));
          ctx.drawImage(spr, cx + (X - ox) * p - s / 2, y - s / 2, s, s);
        }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  resize();
  t = rng.random() * PERIOD;
  const stop = frameLoop(host, resize, (dt) => {
    t += dt;
    ox -= vx * dt; oy -= vy * dt;
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); };
}
