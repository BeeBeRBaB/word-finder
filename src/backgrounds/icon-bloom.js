// Icon bloom: the subject's icons open one at a time at free spots, spring just past full size,
// turn gently while they hold, then shrink and fade as the next one opens somewhere else.
// The seed picks the variant: anywhere, a garden sprouting low and rising, or a ripple sweep.

import { makeRng } from '../rng.js';
import { frameLoop, hostCanvas, hostSize } from './frame-loop.js';
import { iconSprites, iconsFor, sceneColors, variantOf, withHero } from './icon-scene.js';

/**
 * @typedef {{colors:string[], dark:boolean, reducedMotion:boolean, subject:string, seed?:number}} BackgroundOptions
 * @typedef {{k:number, x:number, y:number, size:number, alpha:number, rot:number, spin:number,
 *   twist:number, ph:number, age:number, hold:number}} Bloom
 * x, y is the centre in CSS px, rot and twist radians, spin radians a second (or the garden's sway),
 * ph the sway's phase, age and hold seconds.
 * @typedef {{u:number, v:number, ph:number}} Cell
 * u, v is a ripple cell's centre as a fraction of the host, ph its place in the sweep, 0 to 1.
 */

const SPRITE = 90;           // largest drawn edge in CSS px: an 80px icon at its spring's peak
const GROW = 0.6, OUT = 0.9; // seconds to spring open, and to shrink and fade away
const PEAK = 1.9;            // back-out constant whose overshoot tops out at 1.12
const GAP = 0.3;             // least seconds between two icons opening
const RISE = 7;              // garden lift in CSS px a second, the same for all so none collide
const PAD = 8;               // clear CSS px kept between an opening icon and any showing
const RINGS = 2;             // ripple rings crossing the host at once

/**
 * @param {HTMLElement} host positioned element the canvas fills
 * @param {BackgroundOptions} opts
 * @returns {() => void} stop: undoes everything start did
 */
export function start(host, opts) {
  const subject = opts.subject;
  const colors = sceneColors(opts.colors, opts.dark === false ? '#555' : '#bbb');
  const reduced = !!opts.reducedMotion;
  const { layout, hero, seed } = variantOf(subject, opts.seed ?? 0);
  const ids = withHero(iconsFor(subject), hero);
  const rng = makeRng(seed);
  const hue0 = rng.int(colors.length);
  // 0 anywhere, 1 a garden, 2 a ripple from a point beyond one side (by seed).
  const side = rng.int(4), along = 0.15 + rng.random() * 0.7;
  const ox = side === 0 ? -0.3 : side === 1 ? 1.3 : along, oy = side === 2 ? -0.3 : side === 3 ? 1.3 : along;

  const layer = hostCanvas(host);
  if (!layer) return () => {};
  const { cv, ctx } = layer;
  /** @type {(HTMLCanvasElement|null)[]} */
  const sprites = ids.map(() => null);
  /** @type {Bloom[]} */
  const blooms = [];
  /** @type {Cell[]} ripple cells in sweep order */
  let cells = [];
  let W = 0, H = 0, dpr = 1, n = 0, big = 0, wait = 0, next = 0, front = 0, cols = 0, rows = 0;
  let cancel = () => {};

  /** Sprites are drawn at the device pixel ratio of the last resize that changed it.
   * @returns {void} */
  function makeSprites() {
    // One still loading from before a density change would land over the new one.
    cancel();
    cancel = iconSprites(ids, i => colors[(hue0 + i) % colors.length], Math.round(SPRITE * dpr), (i, s) => {
      sprites[i] = s;
      draw();
    });
  }

  /** The clear CSS px between a spot and the nearest icon showing, less both their reaches.
   * @param {number} x @param {number} y @param {number} size @returns {number} */
  function room(x, y, size) {
    let gap = Infinity;
    for (const b of blooms) gap = Math.min(gap, Math.hypot(b.x - x, b.y - y) - (b.size + size) * 0.56);
    return gap;
  }

  /** The best of a few random spots in a band: farthest from every icon showing, never touching
   * one. `lift` is how far it has already risen. @param {number} size @param {number} top
   * @param {number} lift @returns {[number, number]|null} */
  function freeSpot(size, top, lift) {
    const r = size * 0.5;
    const y0 = Math.max(r, top) - lift, y1 = H - r - lift;
    /** @type {[number, number]|null} */
    let best = null, most = PAD;
    for (let i = 0; i < 16; i++) {
      const x = r + rng.random() * Math.max(0, W - 2 * r), y = y0 + rng.random() * Math.max(0, y1 - y0);
      const gap = room(x, y, size);
      if (gap > most) { most = gap; best = [x, y]; }
    }
    return best;
  }

  /** Ripple cells on a jittered grid about as wide as the host fits, sorted by distance from
   * the ripple's source. Rebuilt only when the grid's shape changes. @returns {void} */
  function makeGrid() {
    const edge = Math.sqrt(W * H / (n * 2.6));
    const c0 = Math.max(2, Math.round(W / edge)), r0 = Math.max(2, Math.round(H / edge));
    if (c0 === cols && r0 === rows) return;
    cols = c0; rows = r0;
    // Its own rng, so the same shape always gets the same grid.
    const g = makeRng(seed ^ Math.imul(cols, 0x9E3779B1) ^ Math.imul(rows, 0x85EBCA6B));
    cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const u = (c + 0.5 + (g.random() - 0.5) * 0.3) / cols, v = (r + 0.5 + (g.random() - 0.5) * 0.3) / rows;
      cells.push({ u, v, ph: Math.hypot((u - ox) * W, (v - oy) * H) + g.random() * edge * 0.3 });
    }
    // Two rings cross the host at once, so the lit icons spread out instead of bunching in one band.
    const lo = Math.min(...cells.map(c => c.ph)), hi = Math.max(...cells.map(c => c.ph)) + 1;
    for (const c of cells) c.ph = (c.ph - lo) / (hi - lo) * RINGS % 1;
    cells.sort((a, b) => a.ph - b.ph);
  }

  /** A new icon's look, its size and place left to the caller.
   * @param {number} z 0 to 1, small and faint to large and strong @returns {Bloom} */
  function make(z) {
    const turn = (rng.random() < 0.5 ? -1 : 1) * (0.03 + rng.random() * 0.04);
    return { k: next++ % Math.max(1, ids.length), x: 0, y: 0, size: 0, alpha: 0.32 + z * 0.36,
      rot: (rng.random() - 0.5) * (layout === 1 ? 0.3 : 0.7), spin: turn, twist: (rng.random() - 0.5) * 0.9,
      ph: rng.random() * 6.3, age: 0, hold: 3 + rng.random() * 3 };
  }

  /** Opens the next icon where the variant puts it, `done` of the way through its time open.
   * @param {number} done 0 just opening to 1 about to leave
   * @param {boolean} still reduced motion: anywhere, open for good
   * @returns {boolean} false when nowhere is free yet */
  function open(done, still) {
    // Few show at once, so most are mid to large; the hero is never one of the small ones.
    let z = 1 - (1 - rng.random()) ** 2;
    if (next % Math.max(1, ids.length) === 0) z = 0.6 + z * 0.4;
    const b = make(z);
    b.age = still ? GROW : (GROW + b.hold) * done;
    if (still) b.hold = Infinity;
    /** @type {[number, number]|null} */
    let spot = null;
    if (layout === 2 && !still) {
      b.size = Math.min(big, Math.min(W / cols, H / rows) * 0.56) * (0.78 + z * 0.22);
      // At most two cells a call, so a cell skipped for being crowded never races the sweep.
      for (let tries = 0; tries < 2 && !spot; tries++) {
        const c = cells[Math.max(0, cells.findIndex(e => e.ph > front))];
        front = c.ph;
        if (room(c.u * W, c.v * H, b.size) >= PAD) spot = [c.u * W, c.v * H];
      }
    } else {
      // The garden keeps its large icons lowest, nearest the viewer, and has risen while open.
      const garden = layout === 1 && !still;
      b.size = 28 + z * (big - 28);
      spot = freeSpot(b.size, garden ? H * (0.4 + z * 0.3) : 0, garden ? RISE * b.age : 0);
    }
    if (!spot) { next--; return false; }
    [b.x, b.y] = spot;
    // Two alike never sit side by side: step past the icons showing close by.
    const near = new Set(blooms.filter(o => Math.hypot(o.x - b.x, o.y - b.y) < (o.size + b.size) * 1.7).map(o => o.k));
    for (let i = 0; i < ids.length && near.has(b.k); i++) b.k = (b.k + 1) % ids.length;
    blooms.push(b);
    return true;
  }

  /** The first picture: a full set already at every stage, oldest first, so the host never
   * starts empty. Reduced motion gets one even spread, all open. @returns {void} */
  function fill() {
    if (reduced) {
      for (let i = 0; i < n + 2; i++) open(1, true);
      return;
    }
    if (layout === 2) {
      // Back the sweep up n cells from a seeded point, so the newest lit is just behind it.
      const j = Math.max(0, cells.findIndex(c => c.ph > rng.random()));
      front = cells[((j - n - 1) % cells.length + cells.length) % cells.length].ph;
    }
    for (let i = 0; i < n; i++) open(1 - (i + 0.2 + rng.random() * 0.6) / n, false);
  }

  /** @returns {void} */
  function resize() {
    const [w, h] = hostSize(host);
    const d = Math.min(3, devicePixelRatio || 1);
    if (w === W && h === H && d === dpr && n) return;
    const first = !n, remake = d !== dpr || first;
    // Icons showing keep their place, scaled to the new size, so dragging a window edge does not
    // reshuffle the picture; the count follows the area as icons come and go.
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    for (const b of blooms) { b.x *= sx; b.y *= sy; }
    W = w; H = h; dpr = d;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    n = Math.max(7, Math.min(13, Math.round(5 + W * H / 110000)));
    big = Math.max(52, Math.min(80, Math.min(W, H) * 0.18));
    if (layout === 2) makeGrid();
    if (first) fill();
    if (remake) makeSprites(); else draw();
  }

  /** @param {number} dt seconds @returns {void} */
  function step(dt) {
    let opening = 0;
    for (let i = blooms.length - 1; i >= 0; i--) {
      const b = blooms[i];
      b.age += dt;
      if (layout === 1) b.y -= RISE * dt;
      if (b.age > GROW + b.hold + OUT) blooms.splice(i, 1);
      else if (b.age < GROW + b.hold) opening++;
    }
    // As one starts to leave another opens, one at a time.
    wait -= dt;
    if (wait <= 0 && opening < n && open(0, false)) wait = GAP;
  }

  /** @returns {void} */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const b of blooms) {
      const spr = sprites[b.k], a = b.age;
      if (!spr) continue;
      let s = 1, f = 1;
      if (a < GROW) {
        // Back-out: from nothing past 1.12 and settling on 1, fading in over the first part.
        const u = a / GROW - 1;
        s = 1 + (PEAK + 1) * u * u * u + PEAK * u * u;
        f = Math.min(1, a / GROW * 2.5);
      } else if (a > GROW + b.hold) {
        const u = Math.min(1, (a - GROW - b.hold) / OUT), e = u * u * (3 - 2 * u);
        s = 1 - 0.5 * e; f = 1 - e;
      }
      if (s <= 0 || f <= 0) continue;
      // The garden sways on its stem; the others turn steadily, with a twist as they spring open.
      const ang = b.rot + b.twist * (1 - s) + (layout === 1 ? b.spin * 2.5 * Math.sin(a * 0.8 + b.ph) : b.spin * a);
      const cos = Math.cos(ang) * dpr, sin = Math.sin(ang) * dpr, sz = b.size * s;
      const base = layout === 1 ? b.size / 2 : 0;
      ctx.setTransform(cos, sin, -sin, cos, b.x * dpr, (b.y + base) * dpr);
      ctx.globalAlpha = b.alpha * f;
      ctx.drawImage(spr, -sz / 2, base ? -sz : -sz / 2, sz, sz);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  resize();
  const stop = frameLoop(host, resize, (dt) => {
    step(dt);
    draw();
  }, reduced);
  return () => { cancel(); stop(); cv.remove(); blooms.length = 0; };
}
